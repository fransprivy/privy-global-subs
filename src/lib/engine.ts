import {
  ANNUAL_SAVINGS,
  BUSINESS_ONLY_FEATURES,
  INTERVAL_LABEL,
  PRICES,
  TIER_LABEL,
  TIER_RANK,
} from "./catalog";
import { renderEmail, type EmailCtx } from "./emails";
import {
  addDays,
  addMonthsClamped,
  addYearsClamped,
  dayOfMonthUTC,
  daysBetween,
  daysSince,
  fmtDate,
  fmtMoney,
  invoiceNumber,
  isSameOrAfter,
  startOfDayUTC,
  uid,
} from "./format";
import type {
  AppState,
  AttemptOutcome,
  Card,
  CardBehavior,
  ChangeKind,
  ConsentRecord,
  HistoryType,
  Interval,
  Invoice,
  PaidTier,
  Subscription,
  Tier,
} from "./types";

/* ------------------------------------------------------------------ */
/* Configuration (every number is config, per the spec)                */
/* ------------------------------------------------------------------ */
export const CONFIG = {
  graceDays: 14,
  retryOffsetsDays: [3, 7, 14],
  dunningEmailDays: { reminder: 7, finalWarning: 12 },
  reminderOffsetsAnnualDays: [30, 7],
  reminderEveryNthMonthlyRenewal: 6,
  cardExpiringLeadDays: 7,
  changeReminderLeadDays: 3,
  migrationReminderDays: [30, 7, 1],
  smartDefaultThresholdDays: 14,
};

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */
export function unitPrice(tier: PaidTier, interval: Interval): number {
  return PRICES[tier][interval];
}

export function planPrice(tier: PaidTier, interval: Interval, seats: number): number {
  const unit = unitPrice(tier, interval);
  return round2(tier === "business" ? unit * Math.max(1, seats) : unit);
}

export function planName(tier: Tier, interval?: Interval): string {
  if (tier === "free" || tier === "enterprise" || !interval) return TIER_LABEL[tier];
  return `${TIER_LABEL[tier]} ${INTERVAL_LABEL[interval]}`;
}

export function intervalWord(interval: Interval): "month" | "year" {
  return interval === "monthly" ? "month" : "year";
}

export function annualSavingsPct(tier: PaidTier): number {
  return ANNUAL_SAVINGS[tier].pct;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Period arithmetic                                                   */
/* ------------------------------------------------------------------ */
export function periodEnd(startIso: string, interval: Interval, anchorDay: number): string {
  return interval === "monthly"
    ? addMonthsClamped(startIso, 1, anchorDay)
    : addYearsClamped(startIso, 1, anchorDay);
}

/* ------------------------------------------------------------------ */
/* Derived state                                                       */
/* ------------------------------------------------------------------ */
export function activeSubscription(s: AppState): Subscription | null {
  return s.subscription && s.subscription.status !== "ended" ? s.subscription : null;
}

export function prepaidEnd(s: AppState): string | null {
  if (!s.prepaid || s.prepaid.periods.length === 0) return null;
  return s.prepaid.periods.reduce((m, p) => (isSameOrAfter(p.end, m) ? p.end : m), s.prepaid.periods[0].end);
}

export function currentTier(s: AppState): Tier {
  const sub = activeSubscription(s);
  if (sub) return sub.tier;
  const pe = prepaidEnd(s);
  if (s.prepaid && pe && !isSameOrAfter(s.now, pe)) return s.prepaid.tier;
  return "free";
}

export function currentInterval(s: AppState): Interval | null {
  const sub = activeSubscription(s);
  if (sub) return sub.interval;
  if (s.prepaid) {
    const pe = prepaidEnd(s);
    if (pe && !isSameOrAfter(s.now, pe)) {
      const last = s.prepaid.periods.find((p) => p.end === pe);
      return last?.interval ?? "monthly";
    }
  }
  return null;
}

export function currentPlanName(s: AppState): string {
  const t = currentTier(s);
  const i = currentInterval(s);
  return planName(t, i ?? undefined);
}

export function isPrepaidUser(s: AppState): boolean {
  return !activeSubscription(s) && !!s.prepaid && !!prepaidEnd(s) && !isSameOrAfter(s.now, prepaidEnd(s)!);
}

export function daysLeftInPeriod(s: AppState): number | null {
  const sub = activeSubscription(s);
  if (sub) return Math.max(0, daysBetween(startOfDayUTC(s.now), sub.currentPeriodEnd));
  const pe = prepaidEnd(s);
  if (pe) return Math.max(0, daysBetween(startOfDayUTC(s.now), pe));
  return null;
}

export function graceDaysLeft(s: AppState): number | null {
  const sub = activeSubscription(s);
  if (!sub || sub.status !== "past_due" || !sub.graceEndsAt) return null;
  return Math.max(0, daysBetween(startOfDayUTC(s.now), sub.graceEndsAt));
}

export function cardExpiresBefore(card: Card | null, iso: string): boolean {
  if (!card) return false;
  const d = new Date(iso);
  const expiry = Date.UTC(card.expYear, card.expMonth, 0); // last day of exp month
  return expiry < d.getTime();
}

/** Compare a target plan with the current one. */
export type ChangeDirection = "same" | "tier_up" | "tier_down" | "interval_up" | "interval_down" | "subscribe";

export function classifyChange(
  s: AppState,
  target: { tier: PaidTier; interval: Interval }
): ChangeDirection {
  const tier = currentTier(s);
  const interval = currentInterval(s);
  if (tier === "free") return "subscribe";
  if (tier === target.tier && interval === target.interval) return "same";
  if (TIER_RANK[target.tier] > TIER_RANK[tier]) return "tier_up";
  if (TIER_RANK[target.tier] < TIER_RANK[tier]) return "tier_down";
  return target.interval === "annual" ? "interval_up" : "interval_down";
}

/* ------------------------------------------------------------------ */
/* Internal helpers: emails, history, invoices                          */
/* ------------------------------------------------------------------ */
function ctx(s: AppState, extra: Partial<EmailCtx> = {}): EmailCtx {
  const sub = s.subscription;
  const tier = sub?.tier ?? s.prepaid?.tier ?? "personal";
  const interval = sub?.interval ?? "monthly";
  const seats = sub?.seats ?? 1;
  const amount = planPrice(tier, interval, seats);
  const base: EmailCtx = {
    name: s.user.name,
    planName: planName(tier, interval),
    tierLabel: TIER_LABEL[tier],
    intervalWord: intervalWord(interval),
    amount: fmtMoney(amount),
    nextDate: sub ? fmtDate(sub.currentPeriodEnd) : "",
    periodEnd: sub ? fmtDate(sub.currentPeriodEnd) : "",
    last4: s.card?.last4 ?? "----",
    graceEnd: sub?.graceEndsAt ? fmtDate(sub.graceEndsAt) : "",
    daysLeft: graceDaysLeft(s) ?? 0,
    oldPlanName: planName(tier, interval),
    newPlanName: sub?.scheduledChange ? planName(sub.scheduledChange.tier, sub.scheduledChange.interval) : "",
    newAmount: sub?.scheduledChange
      ? fmtMoney(planPrice(sub.scheduledChange.tier, sub.scheduledChange.interval, sub.scheduledChange.seats))
      : "",
    effectiveDate: sub?.scheduledChange ? fmtDate(sub.scheduledChange.effectiveAt) : sub ? fmtDate(sub.currentPeriodEnd) : "",
    forfeitDays: 0,
    workspaceName: s.workspace.name,
    memberCount: Math.max(0, s.workspace.members.length - 1),
    invoiceNumber: s.invoices[0]?.number ?? "",
    declineClass: s.card ? (s.card.behavior === "hard_decline" ? "hard" : "soft") : "no_card",
    newEnd: "",
    prepaidEnd: prepaidEnd(s) ? fmtDate(prepaidEnd(s)!) : "",
    isBusiness: tier === "business",
    rolledDays: 0,
    retryDates: sub?.pastDueSince
      ? CONFIG.retryOffsetsDays.map((d) => fmtDate(addDays(sub.pastDueSince!, d))).join(", ")
      : "",
    oldPrice: "",
    newPrice: "",
    seatsDelta: 0,
    seatsTotal: sub?.seats ?? 1,
    proratedAmount: "",
    backupLast4: "",
    defaultLast4: s.card?.last4 ?? "----",
  };
  return { ...base, ...extra };
}

export function buildCtx(s: AppState, extra: Partial<EmailCtx> = {}): EmailCtx {
  return ctx(s, extra);
}

function sendEmail(s: AppState, templateId: string, extra: Partial<EmailCtx> = {}, key?: string, to?: string): AppState {
  if (key && s.sentKeys.includes(key)) return s;
  const r = renderEmail(templateId, ctx(s, extra));
  return {
    ...s,
    sentKeys: key ? [...s.sentKeys, key] : s.sentKeys,
    emails: [
      { id: uid("em"), templateId, at: s.now, to: to ?? s.user.email, subject: r.subject, body: r.body, cta: r.cta },
      ...s.emails,
    ],
  };
}

function addHistory(s: AppState, type: HistoryType, title: string, detail?: string): AppState {
  return { ...s, history: [{ id: uid("ev"), at: s.now, type, title, detail }, ...s.history] };
}

function addInvoice(s: AppState, inv: Omit<Invoice, "id" | "number">): { state: AppState; invoice: Invoice } {
  const seq = s.invoices.length + 1;
  const invoice: Invoice = { id: uid("inv"), number: invoiceNumber(seq, inv.date), ...inv };
  return { state: { ...s, invoices: [invoice, ...s.invoices] }, invoice };
}

function setInvoiceStatus(s: AppState, id: string, status: Invoice["status"]): AppState {
  return { ...s, invoices: s.invoices.map((i) => (i.id === id ? { ...i, status } : i)) };
}

function addConsent(s: AppState, c: Omit<ConsentRecord, "id" | "at" | "ip">): AppState {
  return { ...s, consents: [{ id: uid("cs"), at: s.now, ip: "103.28.114.20", ...c }, ...s.consents] };
}

export function toast(s: AppState, text: string, tone: "success" | "info" | "warn" = "success"): AppState {
  return { ...s, ui: { ...s.ui, toast: { id: uid("t"), text, tone } } };
}

function behaviorToOutcome(b: CardBehavior): AttemptOutcome {
  return b === "success" ? "succeeded" : b;
}

/** Default card first, then backups in the order the user set them. */
export function allCards(s: AppState): Card[] {
  return [...(s.card ? [s.card] : []), ...(s.backupCards ?? [])];
}

export function cardId(c: Card): string {
  return c.id ?? `${c.brand}-${c.last4}-${c.addedAt}`;
}

function declineCode(outcome: AttemptOutcome, card: Card | null): string | undefined {
  if (outcome === "soft_decline") return "insufficient_funds";
  if (outcome === "hard_decline") return card ? "expired_card" : "no_payment_method";
  if (outcome === "requires_action") return "authentication_required";
  return undefined;
}

function closeWorkspace(s: AppState, effectiveDateLabel: string): AppState {
  if (s.workspace.members.length <= 1 && s.workspace.closed) return s;
  let next = s;
  const others = s.workspace.members.filter((m) => m.role !== "owner");
  for (const m of others) {
    next = sendEmail(next, "N-16", { effectiveDate: effectiveDateLabel }, `N-16:${m.id}:${effectiveDateLabel}`, m.email);
  }
  return {
    ...next,
    workspace: {
      ...next.workspace,
      members: next.workspace.members.filter((m) => m.role === "owner"),
      closed: true,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Charging                                                            */
/* ------------------------------------------------------------------ */
interface Target {
  tier: PaidTier;
  interval: Interval;
  seats: number;
}

function periodLabel(start: string, end: string): string {
  return `${fmtDate(start)} to ${fmtDate(end)}`;
}

/** Attempt the renewal charge for the subscription (off-session). Tries the default card, then each backup card in order (R-19b). */
function attemptRenewal(s: AppState, forced?: AttemptOutcome): AppState {
  const sub = s.subscription!;
  const target: Target = sub.scheduledChange
    ? { tier: sub.scheduledChange.tier, interval: sub.scheduledChange.interval, seats: sub.scheduledChange.seats }
    : { tier: sub.tier, interval: sub.interval, seats: sub.pendingSeats ?? sub.seats };
  const amount = planPrice(target.tier, target.interval, target.seats);
  const cards = allCards(s);
  const baseNo = sub.attempts.filter((a) => a.periodStart === sub.currentPeriodEnd).length;

  // One attempt per card until one succeeds. 3DS stops the chain: the user has to act.
  const attempts: NonNullable<Subscription["attempts"]> = [];
  let outcome: AttemptOutcome = "hard_decline";
  let usedCard: Card | null = null;
  if (forced) {
    outcome = forced;
    usedCard = cards[0] ?? null;
    attempts.push({ id: uid("pa"), at: s.now, periodStart: sub.currentPeriodEnd, attemptNo: baseNo + 1, amount, outcome, declineCode: declineCode(outcome, usedCard), onSession: true, cardLast4: usedCard?.last4 });
  } else if (cards.length === 0) {
    attempts.push({ id: uid("pa"), at: s.now, periodStart: sub.currentPeriodEnd, attemptNo: baseNo + 1, amount, outcome, declineCode: "no_payment_method", onSession: false });
  } else {
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const o: AttemptOutcome = i === 0 && s.nextChargeOverride ? behaviorToOutcome(s.nextChargeOverride) : behaviorToOutcome(c.behavior);
      attempts.push({ id: uid("pa"), at: s.now, periodStart: sub.currentPeriodEnd, attemptNo: baseNo + attempts.length + 1, amount, outcome: o, declineCode: declineCode(o, c), onSession: false, cardLast4: c.last4 });
      outcome = o;
      usedCard = c;
      if (o === "succeeded" || o === "requires_action") break;
    }
  }
  const attempt = attempts[attempts.length - 1];
  const usedBackup = outcome === "succeeded" && usedCard && s.card && usedCard.last4 !== s.card.last4;

  let next: AppState = {
    ...s,
    nextChargeOverride: null,
    subscription: { ...sub, attempts: [...attempts.slice().reverse(), ...sub.attempts] },
  };

  // Ensure an open invoice exists for this period (created at first attempt).
  const existingOpen = next.invoices.find((i) => i.status === "open" && i.periodStart === sub.currentPeriodEnd);
  let invoiceId = existingOpen?.id;
  if (!invoiceId) {
    const newEnd = periodEnd(sub.currentPeriodEnd, target.interval, sub.anchorDay);
    const r = addInvoice(next, {
      date: s.now,
      dueDate: s.now,
      amount,
      status: "open",
      description: `${planName(target.tier, target.interval)}${target.tier === "business" ? ` × ${target.seats} seats` : ""} · ${periodLabel(sub.currentPeriodEnd, newEnd)}`,
      periodStart: sub.currentPeriodEnd,
      periodEnd: newEnd,
    });
    next = r.state;
    invoiceId = r.invoice.id;
  }

  if (outcome === "succeeded") {
    next = applySuccessfulRenewal(next, target, invoiceId, sub.status === "past_due");
    if (usedBackup && usedCard) {
      next = addHistory(next, "note", `Backup card ending ${usedCard.last4} was charged`, `Your default card ending ${s.card!.last4} was declined, so we used your backup card. Update your default card to avoid this next time.`);
      next = sendEmail(next, "N-23", { backupLast4: usedCard.last4, defaultLast4: s.card!.last4, amount: fmtMoney(amount) }, `N-23:${sub.currentPeriodEnd}:${attempt.attemptNo}`);
    }
    return next;
  }

  const wasPastDue = sub.status === "past_due";
  const pastDueSince = wasPastDue ? sub.pastDueSince! : s.now;
  const graceEndsAt = wasPastDue ? sub.graceEndsAt! : addDays(startOfDayUTC(s.now), CONFIG.graceDays);
  const retryCount = wasPastDue ? sub.retryCount + 1 : 0;
  // Hard-declined only when every card on file is unusable.
  const hard = outcome !== "requires_action" && attempts.every((a) => a.outcome === "hard_decline");
  const nextOffset = CONFIG.retryOffsetsDays[retryCount];
  const nextRetryAt =
    outcome !== "requires_action" && !hard && nextOffset !== undefined ? addDays(startOfDayUTC(pastDueSince), nextOffset) : null;
  const triedLabel = attempts.length > 1 ? ` (${attempts.length} cards tried: ${attempts.map((a) => `${a.cardLast4} ${a.outcome.replace("_", " ")}`).join("; ")})` : "";

  next = {
    ...next,
    subscription: {
      ...next.subscription!,
      status: "past_due",
      pastDueSince,
      graceEndsAt,
      retryCount,
      nextRetryAt,
      hardDeclined: hard || (wasPastDue && sub.hardDeclined),
      pendingAuthAmount: outcome === "requires_action" ? amount : null,
    },
  };

  if (!wasPastDue) {
    next = addHistory(
      next,
      "renewal_failed",
      `Renewal charge of ${fmtMoney(amount)} failed`,
      outcome === "requires_action"
        ? "Your bank asked for authentication. Grace period started."
        : `${attempt.declineCode}${triedLabel}. ${hard ? "No automatic retries on these cards." : `Retrying on ${CONFIG.retryOffsetsDays.map((d) => fmtDate(addDays(startOfDayUTC(pastDueSince), d))).join(", ")}.`}`
    );
    next = sendEmail(
      next,
      outcome === "requires_action" ? "N-06" : "N-05",
      { declineClass: hard ? (cards.length ? "hard" : "no_card") : "soft", amount: fmtMoney(amount), last4: usedCard?.last4 ?? s.card?.last4 ?? "----" },
      `${outcome === "requires_action" ? "N-06" : "N-05"}:${sub.currentPeriodEnd}`
    );
  } else {
    next = addHistory(next, "renewal_failed", `Retry ${attempt.attemptNo} of ${fmtMoney(amount)} failed`, `${attempt.declineCode}${triedLabel}`);
  }
  return next;
}

function applySuccessfulRenewal(s: AppState, target: Target, invoiceId: string, recovered: boolean): AppState {
  const sub = s.subscription!;
  const newStart = sub.currentPeriodEnd;
  const newEnd = periodEnd(newStart, target.interval, sub.anchorDay);
  const changeApplied = !!sub.scheduledChange;
  const tierDown = TIER_RANK[target.tier] < TIER_RANK[sub.tier];
  const amount = planPrice(target.tier, target.interval, target.seats);

  let next: AppState = {
    ...s,
    subscription: {
      ...sub,
      tier: target.tier,
      interval: target.interval,
      seats: target.seats,
      status: "active",
      currentPeriodStart: newStart,
      currentPeriodEnd: newEnd,
      scheduledChange: null,
      pastDueSince: null,
      graceEndsAt: null,
      nextRetryAt: null,
      retryCount: 0,
      hardDeclined: false,
      pendingAuthAmount: null,
      renewalCount: sub.renewalCount + 1,
      pendingSeats: null,
    },
  };
  next = setInvoiceStatus(next, invoiceId, "paid");
  if (!changeApplied && sub.pendingSeats != null && sub.pendingSeats !== sub.seats) {
    next = addHistory(next, "seats_changed", `Seats reduced to ${target.seats}`, `The scheduled seat reduction took effect with this renewal.`);
  }

  if (changeApplied) {
    next = addHistory(
      next,
      "change_applied",
      `Changed to ${planName(target.tier, target.interval)}`,
      `Charged ${fmtMoney(amount)} for ${periodLabel(newStart, newEnd)}.`
    );
    if (tierDown && sub.tier === "business") {
      next = closeWorkspace(next, fmtDate(newStart));
    }
    next = sendEmail(next, "N-12", {
      newPlanName: planName(target.tier, target.interval),
      newAmount: fmtMoney(amount),
      nextDate: fmtDate(newEnd),
      isBusiness: sub.tier === "business",
    });
  } else {
    next = addHistory(
      next,
      recovered ? "recovered" : "renewed",
      recovered ? `Payment recovered: ${planName(target.tier, target.interval)} renewed` : `${planName(target.tier, target.interval)} renewed`,
      `Charged ${fmtMoney(amount)} for ${periodLabel(newStart, newEnd)}.${recovered ? " Billing date unchanged." : ""}`
    );
    next = sendEmail(next, "N-03", {
      planName: planName(target.tier, target.interval),
      amount: fmtMoney(amount),
      nextDate: fmtDate(newEnd),
      invoiceNumber: next.invoices.find((i) => i.id === invoiceId)?.number ?? "",
    });
  }
  if (recovered) next = toast(next, "Payment received, thank you. Your plan continues.");
  return next;
}

function endSubscription(s: AppState, reason: "grace_expired" | "cancelled", templateId: "N-09" | "N-14"): AppState {
  const sub = s.subscription!;
  let next: AppState = {
    ...s,
    subscription: { ...sub, status: "ended", endedAt: s.now, scheduledChange: null, nextRetryAt: null, pendingAuthAmount: null },
  };
  // void open invoices for this subscription
  next = {
    ...next,
    invoices: next.invoices.map((i) => (i.status === "open" ? { ...i, status: "void" } : i)),
  };
  if (sub.tier === "business") next = closeWorkspace(next, fmtDate(s.now));
  next = addHistory(
    next,
    "ended",
    reason === "grace_expired" ? `${planName(sub.tier, sub.interval)} ended: payment not received` : `${planName(sub.tier, sub.interval)} ended`,
    reason === "grace_expired" ? "Account moved to Free after the 14-day grace period. Documents kept." : "Cancelled subscription reached the end of its paid period. Account moved to Free."
  );
  next = sendEmail(next, templateId, { planName: planName(sub.tier, sub.interval) });
  return next;
}

/* ------------------------------------------------------------------ */
/* The sweep (runs once per simulated day)                              */
/* ------------------------------------------------------------------ */
export function runSweep(s: AppState): AppState {
  let next = s;
  const today = startOfDayUTC(next.now);

  // Prepaid (migrated) users without a subscription
  if (!activeSubscription(next) && next.prepaid) {
    const pe = prepaidEnd(next);
    if (pe) {
      const dl = daysBetween(today, pe);
      for (const d of CONFIG.migrationReminderDays) {
        if (dl === d) next = sendEmail(next, "N-17", {}, `N-17:T${d}:${pe}`);
      }
      if (isSameOrAfter(next.now, pe)) {
        next = addHistory(next, "ended", `Prepaid ${TIER_LABEL[next.prepaid!.tier]} plan ended`, "No auto-renewal was turned on. Account moved to Free.");
        next = sendEmail(next, "N-20", { prepaidEnd: fmtDate(pe) });
        next = { ...next, prepaid: null };
      }
    }
  }

  const sub = activeSubscription(next);
  if (!sub) return next;

  // Reminders before the charge (not when cancelling)
  if (sub.status === "active" || sub.status === "change_scheduled") {
    const dl = daysBetween(today, sub.currentPeriodEnd);
    const target = sub.scheduledChange ?? { tier: sub.tier, interval: sub.interval, seats: sub.pendingSeats ?? sub.seats };
    const amt = fmtMoney(planPrice(target.tier, target.interval, target.seats));
    if (sub.interval === "annual") {
      for (const d of CONFIG.reminderOffsetsAnnualDays) {
        if (dl === d) next = sendEmail(next, "N-04", { amount: amt }, `N-04:T${d}:${sub.currentPeriodEnd}`);
      }
    } else if ((sub.renewalCount + 1) % CONFIG.reminderEveryNthMonthlyRenewal === 0 && dl === 7) {
      next = sendEmail(next, "N-04", { amount: amt }, `N-04:T7:${sub.currentPeriodEnd}`);
    }
    if (dl === CONFIG.cardExpiringLeadDays && cardExpiresBefore(next.card, sub.currentPeriodEnd)) {
      next = sendEmail(next, "N-10", {}, `N-10:${sub.currentPeriodEnd}`);
    }
    if (sub.scheduledChange && dl === CONFIG.changeReminderLeadDays) {
      next = sendEmail(next, "N-11b", {}, `N-11b:${sub.currentPeriodEnd}`);
    }
  }
  if (sub.status === "cancel_scheduled") {
    const dl = daysBetween(today, sub.currentPeriodEnd);
    if (dl === CONFIG.changeReminderLeadDays) {
      next = sendEmail(next, "N-11b", { newPlanName: "Free" }, `N-11b:cancel:${sub.currentPeriodEnd}`);
    }
  }

  // Dunning
  if (sub.status === "past_due") {
    if (sub.nextRetryAt && isSameOrAfter(next.now, sub.nextRetryAt)) {
      next = attemptRenewal(next);
    }
    const s2 = activeSubscription(next);
    if (s2 && s2.status === "past_due") {
      const day = daysSince(startOfDayUTC(s2.pastDueSince!), today);
      if (day === CONFIG.dunningEmailDays.reminder) next = sendEmail(next, "N-07", {}, `N-07:${s2.pastDueSince}`);
      if (day === CONFIG.dunningEmailDays.finalWarning) next = sendEmail(next, "N-08", {}, `N-08:${s2.pastDueSince}`);
      if (s2.graceEndsAt && isSameOrAfter(next.now, s2.graceEndsAt)) {
        next = endSubscription(next, "grace_expired", "N-09");
      }
    }
    return next;
  }

  // Period end reached
  if (isSameOrAfter(next.now, sub.currentPeriodEnd)) {
    if (sub.status === "cancel_scheduled" || sub.cancelAtPeriodEnd) {
      next = endSubscription(next, "cancelled", "N-14");
    } else {
      next = attemptRenewal(next);
    }
  }
  return next;
}

/** Advance the simulated clock one day at a time, running the sweep each day. */
export function advanceDays(s: AppState, days: number): AppState {
  let next = s;
  for (let i = 0; i < days; i++) {
    next = { ...next, now: addDays(next.now, 1) };
    next = runSweep(next);
  }
  return next;
}

export function advanceTo(s: AppState, targetIso: string): AppState {
  const days = Math.max(0, daysBetween(s.now, targetIso));
  return advanceDays(s, days);
}

/* ------------------------------------------------------------------ */
/* User actions                                                        */
/* ------------------------------------------------------------------ */
export interface CheckoutInput {
  tier: PaidTier;
  interval: Interval;
  seats: number;
  card: Card;
  consentText: string;
}

/** First subscription (Free -> paid) or resubscribe after ENDED. On-session, charge already succeeded in the UI flow. */
export function completeSubscription(s: AppState, input: CheckoutInput): AppState {
  const start = startOfDayUTC(s.now);
  const anchorDay = dayOfMonthUTC(start);
  const end = periodEnd(start, input.interval, anchorDay);
  const amount = planPrice(input.tier, input.interval, input.seats);
  const sub: Subscription = {
    id: uid("sub"),
    tier: input.tier,
    interval: input.interval,
    seats: input.seats,
    status: "active",
    currentPeriodStart: start,
    currentPeriodEnd: end,
    anchorDay,
    cancelAtPeriodEnd: false,
    scheduledChange: null,
    pastDueSince: null,
    graceEndsAt: null,
    nextRetryAt: null,
    retryCount: 0,
    hardDeclined: false,
    pendingAuthAmount: null,
    renewalCount: 0,
    attempts: [
      { id: uid("pa"), at: s.now, periodStart: start, attemptNo: 1, amount, outcome: "succeeded", onSession: true },
    ],
    createdAt: s.now,
    endedAt: null,
  };
  let next: AppState = addCardState({ ...s, subscription: sub, prepaid: null, nextChargeOverride: null }, input.card, true);
  const r = addInvoice(next, {
    date: s.now,
    dueDate: s.now,
    amount,
    status: "paid",
    description: `${planName(input.tier, input.interval)}${input.tier === "business" ? ` × ${input.seats} seats` : ""} · ${periodLabel(start, end)}`,
    periodStart: start,
    periodEnd: end,
  });
  next = r.state;
  if (input.tier === "business") {
    next = { ...next, workspace: { ...next.workspace, closed: false } };
  }
  next = addConsent(next, { source: "checkout", text: input.consentText, amount, interval: input.interval });
  next = addHistory(next, "subscribed", `Subscribed to ${planName(input.tier, input.interval)}`, `Charged ${fmtMoney(amount)} to card ending ${input.card.last4}. Renews ${fmtDate(end)}.`);
  next = sendEmail(next, "N-01", {
    planName: planName(input.tier, input.interval),
    tierLabel: TIER_LABEL[input.tier],
    intervalWord: intervalWord(input.interval),
    amount: fmtMoney(amount),
    nextDate: fmtDate(end),
    invoiceNumber: r.invoice.number,
    last4: input.card.last4,
  });
  return toast(next, `You are now on ${planName(input.tier, input.interval)}.`);
}

export interface UpgradeInput {
  tier: PaidTier;
  interval: Interval;
  seats: number;
  consentText: string;
  card?: Card; // when the user added a new card during upgrade
}

/** Rule C (upgrade now) and rule B (monthly -> annual now). Old plan ends today. */
export function upgradeNow(s: AppState, input: UpgradeInput): AppState {
  const old = activeSubscription(s)!;
  const direction = classifyChange(s, input);
  const today = startOfDayUTC(s.now);
  const anchorDay = dayOfMonthUTC(today);
  const remaining = Math.max(0, daysBetween(today, old.currentPeriodEnd));
  const rolled = direction === "interval_up" && old.status !== "past_due" ? remaining : 0;
  let end = periodEnd(today, input.interval, anchorDay);
  if (rolled > 0) end = addDays(end, rolled);
  const amount = planPrice(input.tier, input.interval, input.seats);
  const card = input.card ?? s.card!;

  const sub: Subscription = {
    id: uid("sub"),
    tier: input.tier,
    interval: input.interval,
    seats: input.seats,
    status: "active",
    currentPeriodStart: today,
    currentPeriodEnd: end,
    anchorDay,
    cancelAtPeriodEnd: false,
    scheduledChange: null,
    pastDueSince: null,
    graceEndsAt: null,
    nextRetryAt: null,
    retryCount: 0,
    hardDeclined: false,
    pendingAuthAmount: null,
    renewalCount: 0,
    attempts: [{ id: uid("pa"), at: s.now, periodStart: today, attemptNo: 1, amount, outcome: "succeeded", onSession: true }],
    createdAt: s.now,
    endedAt: null,
  };

  let next: AppState = { ...s, subscription: sub, nextChargeOverride: null };
  if (input.card && (!s.card || s.card.last4 !== input.card.last4)) next = addCardState(next, input.card, true);
  else next = { ...next, card };
  // void any open invoice from a failed renewal that this upgrade supersedes
  next = { ...next, invoices: next.invoices.map((i) => (i.status === "open" ? { ...i, status: "void" } : i)) };
  const r = addInvoice(next, {
    date: s.now,
    dueDate: s.now,
    amount,
    status: "paid",
    description: `${planName(input.tier, input.interval)}${input.tier === "business" ? ` × ${input.seats} seats` : ""} · ${periodLabel(today, end)}`,
    periodStart: today,
    periodEnd: end,
  });
  next = r.state;
  if (input.tier === "business") next = { ...next, workspace: { ...next.workspace, closed: false } };
  next = addConsent(next, {
    source: direction === "interval_up" ? "interval_change" : "upgrade",
    text: input.consentText,
    amount,
    interval: input.interval,
  });
  const title = direction === "interval_up" ? `Switched to ${planName(input.tier, input.interval)}` : `Upgraded to ${planName(input.tier, input.interval)}`;
  const detail =
    direction === "interval_up"
      ? `Charged ${fmtMoney(amount)}. ${rolled} remaining days rolled over; new end date ${fmtDate(end)}. Billing date is now the ${anchorDay}${ordinal(anchorDay)}.`
      : `Charged ${fmtMoney(amount)}. Previous ${planName(old.tier, old.interval)} ended today; ${remaining} remaining days forfeited (acknowledged). Billing date is now the ${anchorDay}${ordinal(anchorDay)}.`;
  next = addHistory(next, direction === "interval_up" ? "interval_changed" : "upgraded", title, detail);
  if (old.scheduledChange || old.cancelAtPeriodEnd) {
    next = addHistory(next, "change_undone", "Pending change removed by the upgrade");
  }
  if (old.status === "past_due") {
    next = addHistory(next, "recovered", "Past-due renewal cleared by the upgrade charge");
  }
  next = sendEmail(next, "N-02", {
    newPlanName: planName(input.tier, input.interval),
    newAmount: fmtMoney(amount),
    newEnd: fmtDate(end),
    oldPlanName: planName(old.tier, old.interval),
    forfeitDays: direction === "interval_up" ? 0 : remaining,
    rolledDays: rolled,
  });
  return toast(next, `You are now on ${planName(input.tier, input.interval)}.`);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/** Rule D (downgrade) and scheduled upgrade: change at period end, nothing charged now. */
export function scheduleChange(
  s: AppState,
  input: { kind: ChangeKind; tier: PaidTier; interval: Interval; seats: number }
): AppState {
  const sub = activeSubscription(s)!;
  const change = {
    kind: input.kind,
    tier: input.tier,
    interval: input.interval,
    seats: input.seats,
    effectiveAt: sub.status === "past_due" && sub.graceEndsAt ? sub.currentPeriodEnd : sub.currentPeriodEnd,
    createdAt: s.now,
  };
  let next: AppState = {
    ...s,
    subscription: {
      ...sub,
      scheduledChange: change,
      cancelAtPeriodEnd: false,
      status: sub.status === "past_due" ? "past_due" : "change_scheduled",
    },
  };
  const newAmount = fmtMoney(planPrice(input.tier, input.interval, input.seats));
  next = addHistory(
    next,
    "change_scheduled",
    `${input.kind === "scheduled_upgrade" ? "Upgrade" : "Downgrade"} to ${planName(input.tier, input.interval)} scheduled for ${fmtDate(change.effectiveAt)}`,
    `Nothing charged today. ${newAmount} will be charged on ${fmtDate(change.effectiveAt)}. You can undo until then.`
  );
  if (input.kind !== "scheduled_upgrade" && sub.tier === "business" && input.tier === "personal") {
    for (const m of s.workspace.members.filter((m) => m.role !== "owner")) {
      next = sendEmail(next, "N-16", { effectiveDate: fmtDate(change.effectiveAt) }, `N-16:heads-up:${m.id}:${change.effectiveAt}`, m.email);
    }
  }
  next = sendEmail(next, "N-11", {
    oldPlanName: planName(sub.tier, sub.interval),
    newPlanName: planName(input.tier, input.interval),
    newAmount,
    intervalWord: intervalWord(input.interval),
    effectiveDate: fmtDate(change.effectiveAt),
  });
  return toast(next, `Change scheduled for ${fmtDate(change.effectiveAt)}. You can undo it any time before then.`, "info");
}

export function undoScheduledChange(s: AppState): AppState {
  const sub = activeSubscription(s)!;
  let next: AppState = {
    ...s,
    subscription: { ...sub, scheduledChange: null, status: sub.status === "past_due" ? "past_due" : "active" },
  };
  next = addHistory(next, "change_undone", `Kept ${planName(sub.tier, sub.interval)}`, "Scheduled change removed.");
  return toast(next, `You are staying on ${planName(sub.tier, sub.interval)}.`);
}

/** Rule E: cancel at period end. */
export function cancelAtPeriodEnd(s: AppState, reason?: string): AppState {
  const sub = activeSubscription(s)!;
  const accessUntil = sub.status === "past_due" && sub.graceEndsAt ? sub.graceEndsAt : sub.currentPeriodEnd;
  let next: AppState = {
    ...s,
    subscription: {
      ...sub,
      cancelAtPeriodEnd: true,
      status: "cancel_scheduled",
      scheduledChange: null,
      nextRetryAt: null,
      pendingAuthAmount: null,
      currentPeriodEnd: accessUntil,
    },
  };
  next = addHistory(next, "cancel_scheduled", `Cancellation scheduled`, `Access continues until ${fmtDate(accessUntil)}. No further charges.${reason ? ` Reason: ${reason}.` : ""}`);
  if (sub.tier === "business") {
    for (const m of s.workspace.members.filter((m) => m.role !== "owner")) {
      next = sendEmail(next, "N-16", { effectiveDate: fmtDate(accessUntil) }, `N-16:cancel:${m.id}:${accessUntil}`, m.email);
    }
  }
  next = sendEmail(next, "N-13", { periodEnd: fmtDate(accessUntil) });
  return toast(next, `Cancelled. You keep full access until ${fmtDate(accessUntil)}.`, "info");
}

export function resumeSubscription(s: AppState, consentText: string): AppState {
  const sub = activeSubscription(s)!;
  let next: AppState = {
    ...s,
    subscription: { ...sub, cancelAtPeriodEnd: false, status: "active" },
  };
  next = addConsent(next, { source: "resume", text: consentText, amount: planPrice(sub.tier, sub.interval, sub.seats), interval: sub.interval });
  next = addHistory(next, "resumed", `Auto-renewal resumed for ${planName(sub.tier, sub.interval)}`, `Next renewal ${fmtDate(sub.currentPeriodEnd)}.`);
  next = sendEmail(next, "N-15");
  if (isSameOrAfter(next.now, sub.currentPeriodEnd)) next = attemptRenewal(next);
  return toast(next, "Welcome back. Auto-renewal is on again.");
}

/* ------------------------------------------------------------------ */
/* Payment methods: default + backup cards (UX-17b)                     */
/* ------------------------------------------------------------------ */
function withId(card: Card): Card {
  return card.id ? card : { ...card, id: uid("card") };
}

const sameCard = (a: Card, b: Card) => a.brand === b.brand && a.last4 === b.last4;

function addCardState(s: AppState, cardIn: Card, makeDefault: boolean): AppState {
  const card = withId(cardIn);
  if (s.card && sameCard(s.card, card)) {
    // Re-entering the default card (e.g. checkout with the same number): refresh expiry, keep id.
    return { ...s, card: { ...s.card, expMonth: card.expMonth, expYear: card.expYear, behavior: card.behavior } };
  }
  const backups = (s.backupCards ?? []).filter((c) => !sameCard(c, card));
  if (makeDefault || !s.card) {
    return { ...s, card, backupCards: [...(s.card ? [s.card] : []), ...backups] };
  }
  return { ...s, backupCards: [...backups, card] };
}

function retryIfPastDue(s: AppState): AppState {
  const sub = activeSubscription(s);
  if (sub && sub.status === "past_due") {
    // immediate retry with the updated cards (R-22)
    const next = { ...s, subscription: { ...sub, hardDeclined: false } };
    return attemptRenewal(next);
  }
  return s;
}

/** Add a card. As default: the previous default becomes the first backup. As backup: appended to the fallback order. */
export function addCard(s: AppState, card: Card, makeDefault: boolean): AppState {
  const hadDefault = !!s.card;
  let next = addCardState(s, card, makeDefault);
  const isDefault = !hadDefault || makeDefault;
  next = addHistory(
    next,
    isDefault ? "card_updated" : "card_added",
    isDefault ? `Default payment method ${hadDefault ? "updated" : "added"}` : "Backup card added",
    `${brandLabel(card.brand)} ending ${card.last4}, expires ${String(card.expMonth).padStart(2, "0")}/${card.expYear}.${isDefault && hadDefault ? ` Card ending ${s.card!.last4} kept as a backup.` : ""}`
  );
  const sub = activeSubscription(next);
  if (sub && isDefault) next = sendEmail(next, "N-21", { last4: card.last4 });
  if (sub && !isDefault) next = sendEmail(next, "N-24", { backupLast4: card.last4 });
  if (sub && sub.status === "past_due") return retryIfPastDue(next);
  return toast(next, isDefault ? "Default payment method updated." : `Backup card ending ${card.last4} added.`);
}

/** Kept for existing callers: the new card becomes the default. */
export function replaceCard(s: AppState, card: Card): AppState {
  return addCard(s, card, true);
}

export function setDefaultCard(s: AppState, id: string): AppState {
  const target = allCards(s).find((c) => cardId(c) === id);
  if (!target || (s.card && cardId(s.card) === id)) return s;
  const oldDefault = s.card;
  const backups = (s.backupCards ?? []).filter((c) => cardId(c) !== id);
  let next: AppState = { ...s, card: target, backupCards: oldDefault ? [oldDefault, ...backups] : backups };
  next = addHistory(next, "card_updated", `Default payment method changed`, `${brandLabel(target.brand)} ending ${target.last4} is now charged first${oldDefault ? `; card ending ${oldDefault.last4} is a backup` : ""}.`);
  if (activeSubscription(next)) next = sendEmail(next, "N-21", { last4: target.last4 });
  if (activeSubscription(next)?.status === "past_due") return retryIfPastDue(next);
  return toast(next, `Card ending ${target.last4} is now your default.`);
}

export type RemoveCardResult = { ok: true; state: AppState } | { ok: false; reason: string };

/** Remove a card. The default can only be removed when a backup exists (it is promoted) or there is no active subscription. */
export function removeCard(s: AppState, id: string): RemoveCardResult {
  const cards = allCards(s);
  const target = cards.find((c) => cardId(c) === id);
  if (!target) return { ok: false, reason: "Card not found." };
  const isDefault = !!s.card && cardId(s.card) === id;
  const backups = (s.backupCards ?? []).filter((c) => cardId(c) !== id);
  const sub = activeSubscription(s);
  if (isDefault && sub && backups.length === 0) {
    return { ok: false, reason: "This is the only card on an active subscription. Add another card first, or cancel your subscription." };
  }
  let next: AppState = isDefault ? { ...s, card: backups[0] ?? null, backupCards: backups.slice(1) } : { ...s, backupCards: backups };
  next = addHistory(
    next,
    "card_removed",
    `${isDefault ? "Default" : "Backup"} card ending ${target.last4} removed`,
    isDefault && backups[0] ? `Backup card ending ${backups[0].last4} is now the default.` : undefined
  );
  return { ok: true, state: toast(next, `Card ending ${target.last4} removed.`) };
}

/* ------------------------------------------------------------------ */
/* Business seats: add now (prorated), remove at period end             */
/* ------------------------------------------------------------------ */
export interface SeatPreview {
  current: number;
  target: number;
  delta: number;
  membersInUse: number;
  minSeats: number;
  remainingDays: number;
  periodDays: number;
  unit: number;
  proratedPerSeat: number;
  chargeToday: number;
  nextRenewalAmount: number;
  effectiveAt: string;
  blockedReason: string | null;
}

/** One Business subscription has one end date: added seats are prorated to it, removed seats leave at it. */
export function previewSeatChange(s: AppState, target: number): SeatPreview {
  const sub = activeSubscription(s)!;
  const today = startOfDayUTC(s.now);
  const periodDays = Math.max(1, daysBetween(sub.currentPeriodStart, sub.currentPeriodEnd));
  const remainingDays = Math.max(0, Math.min(periodDays, daysBetween(today, sub.currentPeriodEnd)));
  const unit = unitPrice("business", sub.interval);
  const proratedPerSeat = round2((unit * remainingDays) / periodDays);
  const membersInUse = s.workspace.members.length;
  const minSeats = Math.max(1, membersInUse);
  const delta = target - sub.seats;
  let blockedReason: string | null = null;
  if (sub.scheduledChange) blockedReason = "You have a plan change scheduled. Undo it first to change seats.";
  else if (sub.status === "cancel_scheduled") blockedReason = "Your subscription is cancelled. Resume it to change seats.";
  else if (delta > 0 && sub.status === "past_due") blockedReason = "Update your payment method before adding seats.";
  else if (target < minSeats) blockedReason = `${membersInUse} members are using seats. Remove members from the workspace before reducing below ${minSeats}.`;
  return {
    current: sub.seats,
    target,
    delta,
    membersInUse,
    minSeats,
    remainingDays,
    periodDays,
    unit,
    proratedPerSeat,
    chargeToday: delta > 0 ? round2(proratedPerSeat * delta) : 0,
    nextRenewalAmount: planPrice("business", sub.interval, target),
    effectiveAt: sub.currentPeriodEnd,
    blockedReason,
  };
}

/** Add seats: charged today, prorated to the existing end date. Remove seats: scheduled for the end date, no refund. */
export function changeSeats(s: AppState, target: number, consentText: string): AppState {
  const sub = activeSubscription(s)!;
  const p = previewSeatChange(s, target);
  if (p.blockedReason || p.delta === 0) return s;
  if (p.delta > 0) {
    const desc = `${p.delta} additional seat${p.delta === 1 ? "" : "s"} · prorated ${p.remainingDays} of ${p.periodDays} days · ${periodLabel(startOfDayUTC(s.now), sub.currentPeriodEnd)}`;
    let next: AppState = {
      ...s,
      nextChargeOverride: null,
      subscription: {
        ...sub,
        seats: target,
        pendingSeats: null,
        attempts: [{ id: uid("pa"), at: s.now, periodStart: sub.currentPeriodStart, attemptNo: 1, amount: p.chargeToday, outcome: "succeeded", onSession: true, cardLast4: s.card?.last4 }, ...sub.attempts],
      },
    };
    const r = addInvoice(next, { date: s.now, dueDate: s.now, amount: p.chargeToday, status: "paid", description: desc, periodStart: startOfDayUTC(s.now), periodEnd: sub.currentPeriodEnd });
    next = r.state;
    next = addConsent(next, { source: "seats", text: consentText, amount: p.nextRenewalAmount, interval: sub.interval });
    next = addHistory(
      next,
      "seats_changed",
      `Added ${p.delta} seat${p.delta === 1 ? "" : "s"} (now ${target})`,
      `Charged ${fmtMoney(p.chargeToday)} today: ${p.delta} × ${fmtMoney(p.unit)} × ${p.remainingDays}/${p.periodDays} days. From ${fmtDate(sub.currentPeriodEnd)} the renewal is ${fmtMoney(p.nextRenewalAmount)} per ${intervalWord(sub.interval)}. Same end date.`
    );
    next = sendEmail(next, "N-22", { seatsDelta: p.delta, seatsTotal: target, proratedAmount: fmtMoney(p.chargeToday), newAmount: fmtMoney(p.nextRenewalAmount), nextDate: fmtDate(sub.currentPeriodEnd), invoiceNumber: r.invoice.number });
    return toast(next, `${p.delta} seat${p.delta === 1 ? "" : "s"} added. Charged ${fmtMoney(p.chargeToday)} for the rest of this period.`);
  }
  // Reduction: nothing refunded; takes effect at the end of the period.
  let next: AppState = { ...s, subscription: { ...sub, pendingSeats: target } };
  next = addHistory(
    next,
    "seats_changed",
    `Seat reduction to ${target} scheduled for ${fmtDate(sub.currentPeriodEnd)}`,
    `You keep ${sub.seats} seats until then. Nothing is refunded. From ${fmtDate(sub.currentPeriodEnd)} the renewal is ${fmtMoney(p.nextRenewalAmount)} per ${intervalWord(sub.interval)}. You can undo until then.`
  );
  next = sendEmail(next, "N-22", { seatsDelta: p.delta, seatsTotal: target, proratedAmount: "", newAmount: fmtMoney(p.nextRenewalAmount), nextDate: fmtDate(sub.currentPeriodEnd), effectiveDate: fmtDate(sub.currentPeriodEnd) });
  return toast(next, `Seats change to ${target} on ${fmtDate(sub.currentPeriodEnd)}. You can undo until then.`, "info");
}

export function undoSeatChange(s: AppState): AppState {
  const sub = activeSubscription(s);
  if (!sub || sub.pendingSeats == null) return s;
  let next: AppState = { ...s, subscription: { ...sub, pendingSeats: null } };
  next = addHistory(next, "change_undone", `Kept ${sub.seats} seats`, "Scheduled seat reduction removed.");
  return toast(next, `You are keeping ${sub.seats} seats.`);
}

/** User completed 3DS from the N-06 link (R-18). */
export function confirmAuthentication(s: AppState): AppState {
  const sub = activeSubscription(s);
  if (!sub || sub.status !== "past_due") return s;
  return attemptRenewal(s, "succeeded");
}

/** Migration opt-in: prepaid user saves a card and creates a subscription that starts charging when prepaid time ends. */
export function optInAutoRenew(s: AppState, card: Card, consentText: string, interval: Interval, targetTier?: PaidTier, seats = 1): AppState {
  const pe = prepaidEnd(s)!;
  const tier = targetTier ?? s.prepaid!.tier;
  const last = s.prepaid!.periods.find((p) => p.end === pe)!;
  const anchorDay = dayOfMonthUTC(pe);
  const sub: Subscription = {
    id: uid("sub"),
    tier,
    interval,
    seats,
    status: "active",
    currentPeriodStart: last.start,
    currentPeriodEnd: pe,
    anchorDay,
    cancelAtPeriodEnd: false,
    scheduledChange: null,
    pastDueSince: null,
    graceEndsAt: null,
    nextRetryAt: null,
    retryCount: 0,
    hardDeclined: false,
    pendingAuthAmount: null,
    renewalCount: 0,
    attempts: [],
    createdAt: s.now,
    endedAt: null,
  };
  let next: AppState = addCardState({ ...s, subscription: sub, prepaid: null }, card, true);
  next = addConsent(next, { source: "opt_in", text: consentText, amount: planPrice(tier, interval, seats), interval });
  next = addHistory(
    next,
    "opt_in",
    targetTier && targetTier !== s.prepaid!.tier
      ? `Upgrade to ${planName(tier, interval)} scheduled for ${fmtDate(pe)} (auto-renewal on)`
      : `Auto-renewal turned on for ${planName(tier, interval)}`,
    `Prepaid time honoured until ${fmtDate(pe)}. First charge of ${fmtMoney(planPrice(tier, interval, seats))} on ${fmtDate(pe)}.`
  );
  next = sendEmail(next, "N-01", {
    planName: planName(tier, interval),
    tierLabel: TIER_LABEL[tier],
    intervalWord: intervalWord(interval),
    amount: fmtMoney(planPrice(tier, interval, seats)),
    nextDate: fmtDate(pe),
    invoiceNumber: "",
    last4: card.last4,
  });
  return toast(next, `Auto-renewal is on. Nothing is charged until ${fmtDate(pe)}.`);
}

export function brandLabel(brand: Card["brand"]): string {
  return brand === "visa" ? "Visa" : brand === "mastercard" ? "Mastercard" : "American Express";
}

/* ------------------------------------------------------------------ */
/* Card simulation (mirrors Stripe test cards)                          */
/* ------------------------------------------------------------------ */
export const TEST_CARDS: { number: string; label: string; behavior: CardBehavior; brand: Card["brand"] }[] = [
  { number: "4242 4242 4242 4242", label: "Succeeds", behavior: "success", brand: "visa" },
  { number: "4000 0025 0000 3155", label: "Requires 3DS authentication", behavior: "requires_action", brand: "visa" },
  { number: "4000 0000 0000 9995", label: "Soft decline: insufficient funds", behavior: "soft_decline", brand: "visa" },
  { number: "4000 0000 0000 0069", label: "Hard decline: expired card", behavior: "hard_decline", brand: "visa" },
  { number: "5555 5555 5555 4444", label: "Succeeds (Mastercard)", behavior: "success", brand: "mastercard" },
];

export function cardFromNumber(numberRaw: string, expMonth: number, expYear: number, nowIso: string): Card {
  const digits = numberRaw.replace(/\D/g, "");
  const match = TEST_CARDS.find((c) => c.number.replace(/\s/g, "") === digits);
  const brand: Card["brand"] = match?.brand ?? (digits.startsWith("5") ? "mastercard" : digits.startsWith("3") ? "amex" : "visa");
  return {
    brand,
    last4: digits.slice(-4).padStart(4, "0"),
    expMonth,
    expYear,
    behavior: match?.behavior ?? "success",
    addedAt: nowIso,
  };
}

/** Losses shown in the Business -> Personal checklist (UX-07). */
export function downgradeLosses(s: AppState): string[] {
  const others = s.workspace.members.filter((m) => m.role !== "owner");
  const out: string[] = [];
  if (others.length > 0) {
    out.push(
      `${others.length} team member${others.length === 1 ? "" : "s"} lose access: ${others
        .slice(0, 3)
        .map((m) => m.name)
        .join(", ")}${others.length > 3 ? ` and ${others.length - 3} more` : ""}`
    );
  }
  out.push("Envelopes limited to 50 per month (Business is unlimited)");
  if (s.workspace.automations > 0) out.push(`${s.workspace.automations} workflow automation${s.workspace.automations === 1 ? "" : "s"} pause`);
  if (s.workspace.retentionPolicies > 0) out.push(`${s.workspace.retentionPolicies} retention polic${s.workspace.retentionPolicies === 1 ? "y" : "ies"} pause`);
  const off: string[] = [];
  if (s.workspace.eSeal) off.push("e-Seal and Company e-Stamp");
  if (s.workspace.branding) off.push("custom branding");
  if (s.workspace.trustedDomain) off.push(`trusted domain (${s.workspace.trustedDomain})`);
  if (off.length) out.push(`${capitalize(off.join(", "))} turn off`);
  out.push(`Business-only features disabled: ${BUSINESS_ONLY_FEATURES.filter((f) => !/e-Seal|branding|Trusted|automation|Retention/.test(f)).join(", ")}`);
  return out;
}

function capitalize(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
