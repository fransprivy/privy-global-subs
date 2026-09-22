import {
  ANNUAL_SAVINGS,
  BILL_LEAD_DAYS,
  BILL_REMINDER_DAYS,
  BUSINESS_ONLY_FEATURES,
  ENVELOPE_LIMIT,
  INTERVAL_LABEL,
  PAYMENT_ID_VALID_HOURS,
  PRICES,
  regionMeta,
  TIER_LABEL,
  TIER_RANK,
  VA_BANKS,
  type PaymentMethodKind,
  type PurchaseType,
  type Region,
  type VaBank,
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
  Bill,
  Card,
  CardBehavior,
  ChangeKind,
  ConsentRecord,
  HistoryType,
  Interval,
  Invoice,
  Member,
  PaidTier,
  Subscription,
  Task,
  Tier,
  Usage,
  WorkspaceStatus,
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
  /** Indonesia one-time plans: bill issued this many days before expiry; reminders at these days-left; no grace. */
  billLeadDays: BILL_LEAD_DAYS,
  billReminderDays: BILL_REMINDER_DAYS,
  paymentIdValidHours: PAYMENT_ID_VALID_HOURS,
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
export function regionOf(s: AppState): Region {
  return s.region ?? "AU";
}
export function isIndonesia(s: AppState): boolean {
  return regionMeta(regionOf(s)).market === "indonesia";
}
export function isOneTimeUser(s: AppState): boolean {
  return !activeSubscription(s) && !!s.prepaid && s.prepaid.source === "one_time" && !!prepaidEnd(s);
}
/** Purchase types offered at checkout for this region. */
export function purchaseTypesFor(s: AppState): PurchaseType[] {
  return isIndonesia(s) ? ["recurring", "one_time"] : ["recurring"];
}
/** Payment methods per purchase type. Recurring is card only everywhere; Indonesia one-time adds QRIS and virtual accounts. */
export function paymentMethodsFor(s: AppState, purchase: PurchaseType): PaymentMethodKind[] {
  if (purchase === "recurring" || !isIndonesia(s)) return ["card"];
  return ["qris", "card", "va"];
}
/** The open bill (awaiting or with a live Payment ID), if any. */
export function openBill(s: AppState): Bill | null {
  return (s.bills ?? []).find((b) => b.status === "awaiting" || b.status === "pending_payment") ?? null;
}
export function pendingPayment(s: AppState): Bill | null {
  return (s.bills ?? []).find((b) => b.status === "pending_payment") ?? null;
}
/** Phase 1: only one-time users whose last payment was by card see the convert-to-auto-renewal offer. */
export function convertEligible(s: AppState): boolean {
  if (!isOneTimeUser(s)) return false;
  const pe = prepaidEnd(s)!;
  const last = s.prepaid!.periods.find((p) => p.end === pe);
  return last?.paidWith === "card";
}
export function methodLabel(m: PaymentMethodKind, bank?: VaBank, last4?: string): string {
  if (m === "qris") return "QRIS";
  if (m === "va") return `Virtual Account ${bank ?? ""}`.trim();
  return last4 ? `Card ending ${last4}` : "Card";
}

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

export function currentSeats(s: AppState): number {
  const sub = activeSubscription(s);
  if (sub) return sub.seats;
  const pe = prepaidEnd(s);
  if (s.prepaid && pe) return s.prepaid.periods.find((p) => p.end === pe)?.seats ?? 1;
  return 1;
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

/* ------------------------------------------------------------------ */
/* Workspaces (R-70 to R-79)                                            */
/* ------------------------------------------------------------------ */
export function workspaceStatus(s: AppState): WorkspaceStatus {
  if (s.workspace.status) return s.workspace.status;
  // Older saved states: infer from the plan.
  if (currentTier(s) === "business") return "active";
  return s.workspace.closed && s.workspace.members.length > 1 ? "expired" : "none";
}
export function ownsBusinessWorkspace(s: AppState): boolean {
  return workspaceStatus(s) !== "none";
}
/** True while the user's own Business plan is live (active, in grace, cancel scheduled, or a paid one-time period). */
export function businessPlanActive(s: AppState): boolean {
  return currentTier(s) === "business";
}
export type IndividualPlan = "free" | "personal" | "personal_plus";
/** Plan of the Individual workspace. Business owners get "personal_plus": everything in Personal with unlimited envelopes (R-73). */
export function individualPlan(s: AppState): IndividualPlan {
  if (businessPlanActive(s)) return "personal_plus";
  const t = currentTier(s);
  return t === "personal" ? "personal" : "free";
}
export function activeWorkspaceId(s: AppState): string {
  const id = s.activeWorkspace ?? "individual";
  if (id === "business" && !ownsBusinessWorkspace(s)) return "individual";
  if (id !== "individual" && id !== "business" && !(s.otherWorkspaces ?? []).some((w) => w.id === id)) return "individual";
  return id;
}
export interface WorkspaceView {
  id: string;
  kind: "individual" | "business" | "enterprise";
  name: string;
  role: "owner" | "member";
  status: "active" | "expired";
  readOnly: boolean;
  /** Plan chip text and tone. */
  planLabel: string;
  planTone: "success" | "warn" | "danger" | "info" | "neutral";
  envelopeLimit: number | null;
  usage: Usage;
  documents: Task[];
  ownerName: string | null;
  initials: string;
  color: string;
  expiredAt: string | null;
}
export function workspaceView(s: AppState, id: string = activeWorkspaceId(s)): WorkspaceView {
  if (id === "individual") {
    const plan = individualPlan(s);
    return {
      id,
      kind: "individual",
      name: s.user.name,
      role: "owner",
      status: "active",
      readOnly: false,
      planLabel: plan === "personal_plus" ? "Personal · included with Business" : plan === "personal" ? planName("personal", currentInterval(s) ?? undefined) : "Free",
      planTone: plan === "free" ? "neutral" : "success",
      envelopeLimit: plan === "personal_plus" ? null : plan === "personal" ? ENVELOPE_LIMIT.personal : ENVELOPE_LIMIT.free,
      usage: s.usage,
      documents: s.tasks,
      ownerName: null,
      initials: s.user.name.slice(0, 2).toUpperCase(),
      color: "#8b1d3b",
      expiredAt: null,
    };
  }
  if (id === "business") {
    const st = workspaceStatus(s);
    const sub = activeSubscription(s);
    const expired = st === "expired";
    return {
      id,
      kind: "business",
      name: s.workspace.name,
      role: "owner",
      status: expired ? "expired" : "active",
      readOnly: expired,
      planLabel: expired ? "Business · expired" : sub?.status === "past_due" ? "Business · payment failed" : sub?.status === "cancel_scheduled" ? `Business · ends ${fmtDate(sub.currentPeriodEnd)}` : "Business · active",
      planTone: expired ? "danger" : sub?.status === "past_due" ? "danger" : sub?.status === "cancel_scheduled" ? "warn" : "success",
      envelopeLimit: null,
      usage: s.workspace.usage ?? { envelopesSent: 0, templates: 0, contacts: 0 },
      documents: s.workspace.documents ?? [],
      ownerName: s.user.name,
      initials: s.workspace.name.slice(0, 2).toUpperCase(),
      color: "#1f7a48",
      expiredAt: s.workspace.expiredAt ?? null,
    };
  }
  const w = (s.otherWorkspaces ?? []).find((o) => o.id === id)!;
  return {
    id,
    kind: w.kind,
    name: w.name,
    role: "member",
    status: w.status,
    readOnly: w.status === "expired",
    planLabel: `${w.kind === "enterprise" ? "Enterprise" : "Business"} · ${w.status === "expired" ? "expired" : "active"}`,
    planTone: w.status === "expired" ? "danger" : "success",
    envelopeLimit: null,
    usage: w.usage,
    documents: w.documents,
    ownerName: w.ownerName,
    initials: w.initials,
    color: w.color,
    expiredAt: w.expiredAt ?? null,
  };
}
/** All workspaces for the switcher, current first is handled by the UI. */
export function allWorkspaces(s: AppState): WorkspaceView[] {
  const ids = ["individual", ...(ownsBusinessWorkspace(s) ? ["business"] : []), ...(s.otherWorkspaces ?? []).map((w) => w.id)];
  return ids.map((id) => workspaceView(s, id));
}
export function switchWorkspace(s: AppState, id: string): AppState {
  const next = { ...s, activeWorkspace: id };
  const v = workspaceView(next);
  return toast(next, `Switched to ${v.name}${v.kind === "individual" ? " (Individual)" : v.kind === "business" ? " (Business)" : " (Enterprise)"}.`, "info");
}

/** Business plan ended: the owned workspace becomes read-only instead of disappearing (R-72). Members keep view/download access. */
function expireWorkspace(s: AppState, effectiveDateLabel: string): AppState {
  if (workspaceStatus(s) !== "active") return s;
  let next = s;
  for (const m of s.workspace.members.filter((mm) => mm.role !== "owner")) {
    next = sendEmail(next, "N-16", { effectiveDate: effectiveDateLabel }, `N-16:${m.id}:${effectiveDateLabel}`, m.email);
  }
  next = addHistory(next, "workspace_expired", `${s.workspace.name} is now read-only`, `The Business plan ended on ${effectiveDateLabel}. Envelopes can be viewed and downloaded; no signing or new envelopes until the plan is reactivated. Your Individual workspace is back to ${individualPlanLabelAfterEnd(s)}.`);
  return {
    ...next,
    workspace: { ...next.workspace, status: "expired", expiredAt: next.now, closed: true },
  };
}
function individualPlanLabelAfterEnd(s: AppState): string {
  const c = s.subscription?.scheduledChange;
  return c && c.tier === "personal" ? planName("personal", c.interval) : "Free";
}
/** Called whenever a Business plan starts (checkout, upgrade, one-time purchase, opt-in). Creates or reactivates the owned workspace (R-74, R-75). */
function activateWorkspace(s: AppState, name?: string): AppState {
  const st = workspaceStatus(s);
  if (st === "active") return { ...s, workspace: { ...s.workspace, status: "active", closed: false } };
  if (st === "expired") {
    let next: AppState = { ...s, workspace: { ...s.workspace, status: "active", expiredAt: null, closed: false } };
    next = addHistory(next, "workspace_reactivated", `${s.workspace.name} reactivated`, "Members can sign and send again. Your Individual workspace now has unlimited envelopes.");
    return next;
  }
  const wsName = (name ?? "").trim() || `${s.user.name}'s team`;
  const owner: Member = s.workspace.members.find((m) => m.role === "owner") ?? { id: "m0", name: s.user.name, email: s.user.email, role: "owner" };
  let next: AppState = {
    ...s,
    workspace: {
      ...s.workspace,
      name: wsName,
      status: "active",
      closed: false,
      createdAt: s.now,
      expiredAt: null,
      members: [owner],
      documents: s.workspace.documents ?? [],
      usage: s.workspace.usage ?? { envelopesSent: 0, templates: 0, contacts: 0 },
      handedOverAt: null,
    },
    activeWorkspace: "business",
    ui: { ...s.ui, welcomeBusiness: true },
  };
  next = addHistory(next, "workspace_created", `Business workspace "${wsName}" created`, "You are the owner. Your Individual workspace now has unlimited envelopes (Personal, included with Business).");
  return next;
}

/** Owner moves every envelope from the Business workspace into their Individual workspace (existing Document Handover feature, UX-08). */
export function handoverDocuments(s: AppState): AppState {
  const docs = s.workspace.documents ?? [];
  if (docs.length === 0) return toast(s, "There are no documents left to hand over.", "info");
  let next: AppState = {
    ...s,
    tasks: [...docs.map((d) => ({ ...d, id: `ho_${d.id}` })), ...s.tasks],
    workspace: { ...s.workspace, documents: [], handedOverAt: s.now },
  };
  next = addHistory(next, "handover", `${docs.length} document${docs.length === 1 ? "" : "s"} handed over to your Individual workspace`, `From ${s.workspace.name}. They stay accessible even if the Business workspace is never reactivated.`);
  return toast(next, `${docs.length} document${docs.length === 1 ? "" : "s"} moved to your Individual workspace.`);
}

/** Sending an envelope in the active workspace counts against its quota (UX-28). Returns null when the quota is exhausted (the UI shows the paywall). */
export function sendEnvelope(s: AppState): AppState | null {
  const ws = workspaceView(s);
  if (ws.readOnly) return null;
  if (ws.envelopeLimit !== null && ws.usage.envelopesSent >= ws.envelopeLimit) return null;
  const doc: Task = { id: uid("env"), title: `Envelope ${ws.usage.envelopesSent + 1} (prototype)`, from: s.user.name, assignedAgo: "just now", status: "waiting_for_others" };
  let next: AppState;
  if (ws.id === "individual") next = { ...s, usage: { ...s.usage, envelopesSent: s.usage.envelopesSent + 1 }, tasks: [doc, ...s.tasks] };
  else if (ws.id === "business") next = { ...s, workspace: { ...s.workspace, usage: { ...ws.usage, envelopesSent: ws.usage.envelopesSent + 1 }, documents: [doc, ...(s.workspace.documents ?? [])] } };
  else next = { ...s, otherWorkspaces: (s.otherWorkspaces ?? []).map((o) => (o.id === ws.id ? { ...o, usage: { ...o.usage, envelopesSent: o.usage.envelopesSent + 1 }, documents: [doc, ...o.documents] } : o)) };
  const left = ws.envelopeLimit === null ? null : ws.envelopeLimit - ws.usage.envelopesSent - 1;
  return toast(next, left === null ? "Envelope sent." : left === 0 ? "Envelope sent. That was your last one this month." : `Envelope sent. ${left} left this month.`, left === 0 ? "warn" : "success");
}
/** Prototype helper: exhaust the Individual quota to reach the paywall quickly. */
export function useUpQuota(s: AppState): AppState {
  const ws = workspaceView(s, "individual");
  if (ws.envelopeLimit === null) return toast(s, "This workspace has unlimited envelopes.", "info");
  return toast({ ...s, usage: { ...s.usage, envelopesSent: ws.envelopeLimit } }, "Quota used up: 0 sends left.", "warn");
}
/** Date the monthly quota resets: the plan's renewal date, or the 1st of next month for Free. */
export function quotaResetDate(s: AppState): string {
  const sub = activeSubscription(s);
  if (sub && sub.interval === "monthly") return sub.currentPeriodEnd;
  const d = new Date(s.now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

/**
 * Ownership transfer (R-81). The current paid period stays active for the workspace, but billing detaches from the old owner:
 * the subscription ends now (no further charges to their card), the new owner must add a payment method before the period end
 * or the workspace becomes read-only. The old owner loses the Individual perk immediately and stays in the workspace as a member.
 */
export function transferOwnership(s: AppState, memberId: string): AppState {
  const m = s.workspace.members.find((x) => x.id === memberId);
  if (!m || m.role === "owner" || workspaceStatus(s) !== "active") return s;
  const sub = activeSubscription(s);
  const periodEnd = sub ? sub.currentPeriodEnd : prepaidEnd(s);
  if (!periodEnd) return s;
  const transferred: import("./types").OtherWorkspace = {
    id: `ws_${uid("t")}`,
    name: s.workspace.name,
    kind: "business",
    ownerName: m.name,
    status: "active",
    endingAt: periodEnd,
    paymentPending: true,
    initials: s.workspace.name.slice(0, 2).toUpperCase(),
    color: "#1f7a48",
    documents: s.workspace.documents ?? [],
    usage: s.workspace.usage ?? { envelopesSent: 0, templates: 0, contacts: 0 },
    memberCount: s.workspace.members.length,
  };
  let next: AppState = {
    ...s,
    subscription: sub ? { ...sub, status: "ended", endedAt: s.now, scheduledChange: null, pendingSeats: null, cancelAtPeriodEnd: false } : s.subscription,
    prepaid: s.prepaid?.tier === "business" ? null : s.prepaid,
    bills: (s.bills ?? []).map((b) => (b.status === "awaiting" || b.status === "pending_payment" ? { ...b, status: "void" as const, payment: null } : b)),
    invoices: s.invoices.map((i) => (i.status === "open" ? { ...i, status: "void" as const } : i)),
    workspace: { name: "", members: s.workspace.members.filter((x) => x.role === "owner"), automations: 0, retentionPolicies: 0, eSeal: false, branding: false, trustedDomain: null, closed: true, status: "none", documents: [], usage: { envelopesSent: 0, templates: 0, contacts: 0 }, createdAt: null, expiredAt: null, handedOverAt: null },
    otherWorkspaces: [transferred, ...(s.otherWorkspaces ?? [])],
    activeWorkspace: transferred.id,
  };
  next = addHistory(next, "ownership_transferred", `${s.workspace.name} transferred to ${m.name}`, `Your card will not be charged again. The paid period runs to ${fmtDate(periodEnd)}; ${m.name} must add a payment method before then. Your Individual workspace is back to ${currentTier(next) === "personal" ? "Personal" : "Free"}.`);
  next = sendEmail(next, "N-35", { workspaceName: s.workspace.name, nextDate: fmtDate(periodEnd), memberName: m.name }, `N-35:${transferred.id}`, m.email);
  next = sendEmail(next, "N-36", { workspaceName: s.workspace.name, nextDate: fmtDate(periodEnd), memberName: m.name }, `N-36:${transferred.id}`);
  return toast(next, `${m.name} now owns ${s.workspace.name}. Your card will not be charged again.`, "info");
}

/** Member leaves someone else's workspace. Their documents there stay with the workspace owner (R-80). */
export function leaveWorkspace(s: AppState, id: string): AppState {
  const w = (s.otherWorkspaces ?? []).find((o) => o.id === id);
  if (!w) return s;
  const docs = w.documents.length;
  let next: AppState = {
    ...s,
    otherWorkspaces: (s.otherWorkspaces ?? []).filter((o) => o.id !== id),
    activeWorkspace: "individual",
  };
  next = addHistory(next, "workspace_left", `You left ${w.name}`, `${docs} document${docs === 1 ? "" : "s"} handed over to the workspace owner, ${w.ownerName}. Your own plan is unchanged.`);
  return toast(next, `You left ${w.name}. Your documents there now belong to ${w.ownerName}.`, "info");
}

export function inviteMember(s: AppState, name: string, email: string): AppState {
  const sub = activeSubscription(s);
  const seats = currentSeats(s);
  if (s.workspace.members.length >= seats) return toast(s, `All ${seats} seats are in use. Add seats first.`, "warn");
  if (workspaceStatus(s) !== "active") return toast(s, "This workspace is read-only. Reactivate the plan to invite members.", "warn");
  const m: Member = { id: uid("m"), name: name.trim() || email.split("@")[0], email: email.trim(), role: "member" };
  let next: AppState = { ...s, workspace: { ...s.workspace, members: [...s.workspace.members, m] } };
  next = addHistory(next, "member_invited", `${m.name} invited to ${s.workspace.name}`, `${m.email} · seat ${next.workspace.members.length} of ${seats}${sub ? "" : ""}.`);
  return toast(next, `Invitation sent to ${m.email}.`);
}
export function removeMember(s: AppState, id: string): AppState {
  const m = s.workspace.members.find((x) => x.id === id);
  if (!m || m.role === "owner") return s;
  let next: AppState = { ...s, workspace: { ...s.workspace, members: s.workspace.members.filter((x) => x.id !== id) } };
  next = addHistory(next, "member_removed", `${m.name} removed from ${s.workspace.name}`, "The seat is free again; it is still billed until you reduce seats.");
  return toast(next, `${m.name} removed. The seat stays on your plan until you reduce seats.`, "info");
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
      next = expireWorkspace(next, fmtDate(newStart));
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
  if (sub.tier === "business") next = expireWorkspace(next, fmtDate(s.now));
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

  // Expire Payment IDs that ran out (a day has passed since they were generated).
  next = expireStalePayments(next);

  // One-time (Indonesia) users: bill before expiry, no grace.
  if (!activeSubscription(next) && next.prepaid?.source === "one_time") {
    const pe = prepaidEnd(next);
    if (pe) {
      const dl = daysBetween(today, pe);
      const bill = openBill(next);
      if (dl > 0 && dl <= BILL_LEAD_DAYS && !bill && !(next.bills ?? []).some((b) => b.kind === "renewal" && b.periodStart === pe)) {
        next = issueRenewalBill(next);
      }
      if (bill && bill.kind === "renewal" && BILL_REMINDER_DAYS.includes(dl)) {
        next = sendEmail(next, "N-30b", { daysLeft: dl, amount: fmtMoney(bill.amount), prepaidEnd: fmtDate(pe) }, `N-30b:T${dl}:${pe}`);
      }
      if (isSameOrAfter(next.now, pe)) {
        next = expireOneTimePlan(next, pe);
      }
    }
  }
  // Prepaid (migrated) users without a subscription
  else if (!activeSubscription(next) && next.prepaid) {
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
  /** Name for the new Business workspace (first Business purchase only). */
  workspaceName?: string;
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
  if (input.tier === "business") next = activateWorkspace(next, input.workspaceName);
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
  workspaceName?: string;
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
  if (input.tier === "business") next = activateWorkspace(next, input.workspaceName);
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
/* Region (Settings → Workspace preferences)                            */
/* ------------------------------------------------------------------ */
/** Plans are entitlements on the account, so they stay active across regions. Future bills/charges use the new region's catalogue. */
export function setRegion(s: AppState, region: Region): AppState {
  if (regionOf(s) === region) return s;
  const from = regionMeta(regionOf(s));
  const to = regionMeta(region);
  let next: AppState = { ...s, region };
  next = addHistory(next, "region_changed", `Region changed to ${to.name}`, `Was ${from.name}. Your current plan stays active. Future bills and charges use ${to.currency} prices${to.market === "indonesia" ? " and Indonesian payment methods" : ""}.`);
  return toast(next, `Region set to ${to.flag} ${to.name}. Prices now in ${to.currency}.`, "info");
}

/* ------------------------------------------------------------------ */
/* Indonesia: one-time purchases, bills, Payment IDs                     */
/* ------------------------------------------------------------------ */
function vaNumberFor(bank: VaBank): string {
  const prefix = VA_BANKS.find((b) => b.code === bank)?.prefix ?? "8888";
  const rest = String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
  return `${prefix}${rest}`;
}

function newPaymentRequest(s: AppState, method: PaymentMethodKind, bank?: VaBank, cardLast4?: string) {
  return {
    paymentId: `PAY-${new Date(s.now).getUTCFullYear()}${String(new Date(s.now).getUTCMonth() + 1).padStart(2, "0")}-${uid("").slice(1, 7).toUpperCase()}`,
    method,
    bank,
    vaNumber: method === "va" && bank ? vaNumberFor(bank) : undefined,
    cardLast4,
    createdAt: s.now,
    expiresAt: new Date(new Date(s.now).getTime() + PAYMENT_ID_VALID_HOURS * 3600_000).toISOString(),
  };
}

/** Start a one-time purchase (new plan or "buy next period"): creates a bill with a live Payment ID. */
export function startOneTimePurchase(
  s: AppState,
  input: { tier: PaidTier; interval: Interval; seats: number; method: PaymentMethodKind; bank?: VaBank; card?: Card; saveCard?: boolean; workspaceName?: string }
): AppState {
  const pe = isOneTimeUser(s) ? prepaidEnd(s)! : null;
  const start = pe && isSameOrAfter(pe, startOfDayUTC(s.now)) ? pe : startOfDayUTC(s.now);
  const anchorDay = dayOfMonthUTC(start);
  const end = periodEnd(start, input.interval, anchorDay);
  const amount = planPrice(input.tier, input.interval, input.seats);
  // any earlier open bill is superseded
  let next: AppState = { ...s, bills: (s.bills ?? []).map((b) => (b.status === "awaiting" || b.status === "pending_payment" ? { ...b, status: "void" as const } : b)) };
  const bill: Bill = {
    id: uid("bill"),
    kind: "purchase",
    tier: input.tier,
    interval: input.interval,
    seats: input.seats,
    workspaceName: input.workspaceName,
    amount,
    periodStart: start,
    periodEnd: end,
    issuedAt: s.now,
    dueAt: end,
    status: "pending_payment",
    payment: newPaymentRequest(s, input.method, input.bank, input.card?.last4),
  };
  next = { ...next, bills: [bill, ...(next.bills ?? [])] };
  if (input.card && input.saveCard) next = addCardState(next, input.card, true);
  next = addHistory(next, "payment_pending", `Payment ID ${bill.payment!.paymentId} generated`, `${planName(input.tier, input.interval)} · ${fmtMoney(amount)} via ${methodLabel(input.method, input.bank, input.card?.last4)}. Valid for ${PAYMENT_ID_VALID_HOURS} hours.`);
  return next;
}

/** Renewal bill for a one-time plan, issued BILL_LEAD_DAYS before expiry (no Payment ID until the user clicks Pay). */
export function issueRenewalBill(s: AppState): AppState {
  const pe = prepaidEnd(s)!;
  const last = s.prepaid!.periods.find((p) => p.end === pe)!;
  const seats = last.seats ?? 1;
  const amount = planPrice(last.tier, last.interval, seats);
  const bill: Bill = {
    id: uid("bill"),
    kind: "renewal",
    tier: last.tier,
    interval: last.interval,
    seats,
    amount,
    periodStart: pe,
    periodEnd: periodEnd(pe, last.interval, dayOfMonthUTC(pe)),
    issuedAt: s.now,
    dueAt: pe,
    status: "awaiting",
    payment: null,
  };
  let next: AppState = { ...s, bills: [bill, ...(s.bills ?? [])] };
  next = addHistory(next, "bill_issued", `Bill issued: ${planName(last.tier, last.interval)} for ${periodLabel(pe, bill.periodEnd)}`, `${fmtMoney(amount)}, pay before ${fmtDate(pe)} to continue without interruption. No automatic charge.`);
  next = sendEmail(next, "N-30", { amount: fmtMoney(amount), prepaidEnd: fmtDate(pe), planName: planName(last.tier, last.interval), newEnd: fmtDate(bill.periodEnd), daysLeft: BILL_LEAD_DAYS }, `N-30:${pe}`);
  return next;
}

/** User clicks Pay on a renewal bill and picks a method: generates the Payment ID. */
export function payBill(s: AppState, billId: string, method: PaymentMethodKind, bank?: VaBank, card?: Card, saveCard?: boolean): AppState {
  const bill = (s.bills ?? []).find((b) => b.id === billId);
  if (!bill || (bill.status !== "awaiting" && bill.status !== "pending_payment")) return s;
  const payment = newPaymentRequest(s, method, bank, card?.last4);
  let next: AppState = { ...s, bills: s.bills!.map((b) => (b.id === billId ? { ...b, status: "pending_payment" as const, payment } : b)) };
  if (card && saveCard) next = addCardState(next, card, true);
  next = addHistory(next, "payment_pending", `Payment ID ${payment.paymentId} generated`, `${fmtMoney(bill.amount)} via ${methodLabel(method, bank, card?.last4)}. Valid for ${PAYMENT_ID_VALID_HOURS} hours.`);
  return next;
}

/** Abandon a live Payment ID. Renewal bills go back to "awaiting"; purchases are voided. */
export function cancelPayment(s: AppState, billId: string): AppState {
  const bill = (s.bills ?? []).find((b) => b.id === billId);
  if (!bill || bill.status !== "pending_payment") return s;
  const next: AppState = { ...s, bills: s.bills!.map((b) => (b.id === billId ? { ...b, status: bill.kind === "renewal" ? ("awaiting" as const) : ("void" as const), payment: null } : b)) };
  return toast(next, bill.kind === "renewal" ? "Payment cancelled. The bill is still open until your plan expires." : "Checkout cancelled. Nothing was paid.", "info");
}

function expireStalePayments(s: AppState): AppState {
  let next = s;
  for (const b of next.bills ?? []) {
    if (b.status === "pending_payment" && b.payment && isSameOrAfter(next.now, b.payment.expiresAt)) {
      next = { ...next, bills: next.bills!.map((x) => (x.id === b.id ? { ...x, status: b.kind === "renewal" ? ("awaiting" as const) : ("void" as const), payment: null } : x)) };
      next = addHistory(next, "payment_expired", `Payment ID ${b.payment.paymentId} expired unpaid`, b.kind === "renewal" ? "The bill is still open. Generate a new Payment ID to pay it." : "The checkout was not completed.");
      next = sendEmail(next, "N-33", { amount: fmtMoney(b.amount), planName: planName(b.tier, b.interval) }, `N-33:${b.payment.paymentId}`);
    }
  }
  return next;
}

/** Payment received for a Payment ID (simulated in the prototype): the period is added and the account is entitled. */
export function confirmPayment(s: AppState, billId: string): AppState {
  const bill = (s.bills ?? []).find((b) => b.id === billId);
  if (!bill || bill.status !== "pending_payment" || !bill.payment) return s;
  const label = methodLabel(bill.payment.method, bill.payment.bank, bill.payment.cardLast4);
  const r = addInvoice(s, {
    date: s.now,
    dueDate: s.now,
    amount: bill.amount,
    status: "paid",
    description: `${planName(bill.tier, bill.interval)}${bill.tier === "business" ? ` × ${bill.seats} seats` : ""} · one-time · ${periodLabel(bill.periodStart, bill.periodEnd)}`,
    periodStart: bill.periodStart,
    periodEnd: bill.periodEnd,
    method: label,
  });
  let next = r.state;
  const period = { start: bill.periodStart, end: bill.periodEnd, tier: bill.tier, interval: bill.interval, purchasedAt: s.now, seats: bill.seats, paidWith: bill.payment.method, paidWithLabel: label };
  const periods = s.prepaid?.source === "one_time" ? [...s.prepaid.periods, period] : [period];
  next = {
    ...next,
    prepaid: { tier: bill.tier, periods, source: "one_time" },
    bills: next.bills!.map((b) => (b.id === billId ? { ...b, status: "paid" as const, paidAt: s.now, invoiceId: r.invoice.id } : b)),
  };
  if (bill.tier === "business") next = activateWorkspace(next, bill.workspaceName);
  next = addHistory(next, bill.kind === "renewal" ? "bill_paid" : "bill_paid", `${bill.kind === "renewal" ? "Bill paid" : "One-time purchase"}: ${planName(bill.tier, bill.interval)}`, `${fmtMoney(bill.amount)} via ${label}. Active ${periodLabel(bill.periodStart, bill.periodEnd)}. No automatic renewal.`);
  next = sendEmail(next, "N-32", { amount: fmtMoney(bill.amount), planName: planName(bill.tier, bill.interval), newEnd: fmtDate(bill.periodEnd), invoiceNumber: r.invoice.number, last4: label }, `N-32:${bill.payment.paymentId}`);
  return toast(next, `Payment received. ${planName(bill.tier, bill.interval)} is active until ${fmtDate(bill.periodEnd)}.`);
}

function expireOneTimePlan(s: AppState, pe: string): AppState {
  let next: AppState = { ...s, bills: (s.bills ?? []).map((b) => (b.status === "awaiting" || b.status === "pending_payment" ? { ...b, status: "expired" as const, payment: null } : b)) };
  const tier = s.prepaid!.tier;
  next = addHistory(next, "bill_expired", `${TIER_LABEL[tier]} plan expired`, "The bill was not paid by the expiry date. Account moved to Free (no grace period for one-time plans). Documents kept.");
  next = sendEmail(next, "N-31", { prepaidEnd: fmtDate(pe), tierLabel: TIER_LABEL[tier] }, `N-31:${pe}`);
  if (tier === "business") next = expireWorkspace(next, fmtDate(pe));
  return { ...next, prepaid: null };
}

/** One-time user turns on auto-renewal: subscription anchored at the current expiry, first charge on that date, open bill voided. */
export function convertToAutoRenew(s: AppState, card: Card, consentText: string): AppState {
  const pe = prepaidEnd(s)!;
  const last = s.prepaid!.periods.find((p) => p.end === pe)!;
  const bills = (s.bills ?? []).map((b) => (b.status === "awaiting" || b.status === "pending_payment" ? { ...b, status: "void" as const, payment: null } : b));
  let next = optInAutoRenew({ ...s, bills }, card, consentText, last.interval, last.tier, last.seats ?? 1);
  next = sendEmail(next, "N-34", { planName: planName(last.tier, last.interval), nextDate: fmtDate(pe), amount: fmtMoney(planPrice(last.tier, last.interval, last.seats ?? 1)), last4: card.last4 });
  return toast(next, `Auto-renewal is on. We charge card ending ${card.last4} on ${fmtDate(pe)}; no more manual bills.`);
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
      `${s.workspace.name} becomes read-only for you and ${others.length} team member${others.length === 1 ? "" : "s"} (view and download only): ${others
        .slice(0, 3)
        .map((m) => m.name)
        .join(", ")}${others.length > 3 ? ` and ${others.length - 3} more` : ""}`
    );
  }
  out.push("Your Individual workspace loses the owner perk: envelopes limited to 50 per month instead of unlimited");
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
