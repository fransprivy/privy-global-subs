"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ANNUAL_SAVINGS, TIER_LABEL } from "@/lib/catalog";
import {
  activeSubscription,
  classifyChange,
  CONFIG,
  downgradeLosses,
  intervalWord,
  isPrepaidUser,
  periodEnd,
  planName,
  planPrice,
  prepaidEnd,
} from "@/lib/engine";
import { addDays, daysBetween, dayOfMonthUTC, fmtDate, fmtMoney, startOfDayUTC } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Card, Interval, PaidTier } from "@/lib/types";
import { CheckoutDrawer, type CheckoutMode } from "./CheckoutDrawer";
import { IconArrowRight, IconCheckCircle, IconHandover, IconInfo, IconMinus, IconPlus, IconWarning } from "./Icons";
import { CardForm, cardFormValid, cardFromForm, ThreeDSModal, type CardFormValue } from "./payments";
import { Checkbox, Modal, Spec } from "./ui";

export type Flow =
  | { type: "plan"; tier: PaidTier; interval: Interval; seats?: number }
  | { type: "cancel" }
  | { type: "resume" }
  | { type: "replaceCard" }
  | { type: "authenticate" }
  | { type: "optin"; tier?: PaidTier; interval?: Interval }
  | { type: "handover" };

interface FlowApi {
  open: (f: Flow) => void;
  close: () => void;
}

const FlowCtx = createContext<FlowApi | null>(null);

export function useFlows(): FlowApi {
  const c = useContext(FlowCtx);
  if (!c) throw new Error("useFlows outside FlowProvider");
  return c;
}

export function FlowProvider({ children }: { children: React.ReactNode }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const api = useMemo<FlowApi>(() => ({ open: (f) => setFlow(f), close: () => setFlow(null) }), []);
  return (
    <FlowCtx.Provider value={api}>
      {children}
      {flow && <FlowHost flow={flow} close={() => setFlow(null)} />}
    </FlowCtx.Provider>
  );
}

function FlowHost({ flow, close }: { flow: Flow; close: () => void }) {
  switch (flow.type) {
    case "plan":
      return <PlanFlow tier={flow.tier} interval={flow.interval} seats={flow.seats} close={close} />;
    case "cancel":
      return <CancelModal close={close} />;
    case "resume":
      return <ResumeModal close={close} />;
    case "replaceCard":
      return <ReplaceCardModal close={close} />;
    case "authenticate":
      return <AuthenticateFlow close={close} />;
    case "optin":
      return <OptInModal close={close} tier={flow.tier} interval={flow.interval} />;
    case "handover":
      return <HandoverModal close={close} />;
  }
}

/* ------------------------------------------------------------------ */
/* Plan change orchestration (rules A to E)                             */
/* ------------------------------------------------------------------ */
function PlanFlow({ tier, interval, seats: seatsIn, close }: { tier: PaidTier; interval: Interval; seats?: number; close: () => void }) {
  const { s, api } = useAppState();
  const sub = activeSubscription(s);
  // Freeze the decision at mount: after a successful charge the state changes and the flow must not re-route.
  const [direction] = useState(() => classifyChange(s, { tier, interval }));
  const [prepaid] = useState(() => isPrepaidUser(s));
  const [seats, setSeats] = useState(seatsIn ?? (tier === "business" ? Math.max(1, s.workspace.members.length) : 1));
  const [step, setStep] = useState<"decide" | "checkout">(direction === "subscribe" ? "checkout" : "decide");
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("subscribe");

  const onDone = useCallback(() => close(), [close]);

  // Prepaid (migrated) users: any paid change routes through opt-in (nothing charged until prepaid ends), R-43.
  if (prepaid) {
    return <OptInModal close={close} tier={tier} interval={interval} fromUpgrade />;
  }

  if (direction === "same") {
    close();
    return null;
  }

  if (step === "checkout" || direction === "subscribe") {
    return (
      <CheckoutDrawer
        open
        onClose={close}
        mode={direction === "subscribe" ? "subscribe" : checkoutMode}
        tier={tier}
        interval={interval}
        seats={seats}
        onDone={onDone}
      />
    );
  }

  if (direction === "tier_up" && sub) {
    return (
      <UpgradeTimingModal
        tier={tier}
        interval={interval}
        seats={seats}
        setSeats={setSeats}
        close={close}
        onNow={() => {
          setCheckoutMode("upgrade");
          setStep("checkout");
        }}
        onScheduled={() => {
          api.scheduleChange({ kind: "scheduled_upgrade", tier, interval, seats });
          close();
        }}
      />
    );
  }

  if (direction === "interval_up" && sub) {
    return (
      <IntervalUpModal
        tier={tier}
        seats={sub.seats}
        close={close}
        onContinue={() => {
          setCheckoutMode("interval");
          setStep("checkout");
        }}
      />
    );
  }

  if ((direction === "tier_down" || direction === "interval_down") && sub) {
    return (
      <DowngradeModal
        tier={tier}
        interval={interval}
        seats={tier === "business" ? sub.seats : 1}
        kind={direction === "tier_down" ? "downgrade" : "interval_down"}
        close={close}
        onConfirm={() => {
          api.scheduleChange({ kind: direction === "tier_down" ? "downgrade" : "interval_down", tier, interval, seats: tier === "business" ? sub.seats : 1 });
          close();
        }}
      />
    );
  }

  close();
  return null;
}

/* M-02 */
function UpgradeTimingModal({ tier, interval, seats, setSeats, close, onNow, onScheduled }: { tier: PaidTier; interval: Interval; seats: number; setSeats: (n: number) => void; close: () => void; onNow: () => void; onScheduled: () => void }) {
  const { s } = useAppState();
  const sub = activeSubscription(s)!;
  const today = startOfDayUTC(s.now);
  const remaining = Math.max(0, daysBetween(today, sub.currentPeriodEnd));
  const amount = planPrice(tier, interval, seats);
  const scheduledPrimary = remaining > CONFIG.smartDefaultThresholdDays;
  const target = planName(tier, interval);
  const pendingNote = sub.scheduledChange || sub.cancelAtPeriodEnd;
  const pastDue = sub.status === "past_due";
  const newEndNow = periodEnd(today, interval, dayOfMonthUTC(today));

  const Primary = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button className="btn-primary h-12 w-full text-base" onClick={onClick}>
      {children}
    </button>
  );
  const Secondary = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button className="btn-secondary h-12 w-full text-base" onClick={onClick}>
      {children}
    </button>
  );

  const nowBtn = (
    <div className="space-y-1">
      {scheduledPrimary ? (
        <Secondary onClick={onNow}>Upgrade now and pay {fmtMoney(amount)}</Secondary>
      ) : (
        <Primary onClick={onNow}>Upgrade now and pay {fmtMoney(amount)}</Primary>
      )}
      <p className="text-center text-xs text-muted">
        Business starts today. Your remaining {remaining} days of {planName(sub.tier, sub.interval)} are forfeited.
      </p>
    </div>
  );
  const laterBtn = (
    <div className="space-y-1">
      {scheduledPrimary ? (
        <Primary onClick={onScheduled}>
          Upgrade on {fmtDate(sub.currentPeriodEnd)} instead <IconArrowRight size={16} />
        </Primary>
      ) : (
        <Secondary onClick={onScheduled}>Upgrade on {fmtDate(sub.currentPeriodEnd)} instead</Secondary>
      )}
      <p className="text-center text-xs text-muted">Nothing charged until then. Nothing lost. You can undo any time before.</p>
    </div>
  );

  return (
    <Modal open onClose={close} title={`Upgrade to ${TIER_LABEL[tier]}`} spec="M-02" width="max-w-xl">
      <div className="space-y-4">
        <p>
          You are on <strong className="text-ink">{planName(sub.tier, sub.interval)}</strong>, paid until <strong className="text-ink">{fmtDate(sub.currentPeriodEnd)}</strong> ({remaining} days left).
          {pastDue && " Your last renewal payment failed; a successful upgrade payment clears that."}
        </p>

        {tier === "business" && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-page px-3 py-2">
            <span className="text-sm text-ink">Member seats</span>
            <button className="btn-secondary !px-2 !py-1" onClick={() => setSeats(Math.max(1, seats - 1))} aria-label="Fewer seats">
              <IconMinus size={14} />
            </button>
            <span className="w-6 text-center text-sm font-semibold">{seats}</span>
            <button className="btn-secondary !px-2 !py-1" onClick={() => setSeats(Math.min(50, seats + 1))} aria-label="More seats">
              <IconPlus size={14} />
            </button>
            <span className="ml-auto text-xs text-muted">
              {fmtMoney(planPrice(tier, interval, 1))} per seat per {intervalWord(interval)}
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`rounded-xl border p-4 ${scheduledPrimary ? "border-line" : "border-ink"}`}>
            <p className="text-sm font-semibold text-ink">Upgrade now</p>
            <ul className="mt-2 space-y-1 text-xs text-ink-2">
              <li>Today: charged {fmtMoney(amount)}</li>
              <li>{target} starts today, runs to {fmtDate(newEndNow)}</li>
              <li className="text-danger">Remaining {remaining} days of {planName(sub.tier, sub.interval)} are not refunded or credited</li>
              <li>Your billing date moves to the {dayOfMonthUTC(today)}{ordinal(dayOfMonthUTC(today))}</li>
            </ul>
          </div>
          <div className={`rounded-xl border p-4 ${scheduledPrimary ? "border-ink" : "border-line"}`}>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              Upgrade when my plan ends {scheduledPrimary && <span className="chip bg-success-tint text-success">Recommended</span>}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-ink-2">
              <li>Today: nothing charged</li>
              <li>{target} starts {fmtDate(sub.currentPeriodEnd)}, charged {fmtMoney(amount)} then</li>
              <li className="text-success">You use every day you already paid for</li>
              <li>Billing date stays the same</li>
            </ul>
          </div>
        </div>

        {pendingNote && (
          <p className="flex items-start gap-2 rounded-lg bg-info-tint px-3 py-2 text-xs text-info">
            <IconInfo size={16} className="mt-0.5 shrink-0" /> Your pending {sub.cancelAtPeriodEnd ? "cancellation" : "plan change"} will be removed by this upgrade.
          </p>
        )}

        <div className="space-y-3 pt-1">
          {scheduledPrimary ? laterBtn : nowBtn}
          {scheduledPrimary ? nowBtn : laterBtn}
          <p className="text-center text-[11px] text-muted">
            Smart default: the scheduled option is primary when more than {CONFIG.smartDefaultThresholdDays} days remain. <Spec id="UX-04" />
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* M-03 */
function IntervalUpModal({ tier, seats, close, onContinue }: { tier: PaidTier; seats: number; close: () => void; onContinue: () => void }) {
  const { s } = useAppState();
  const sub = activeSubscription(s)!;
  const today = startOfDayUTC(s.now);
  const remaining = sub.status === "past_due" ? 0 : Math.max(0, daysBetween(today, sub.currentPeriodEnd));
  const amount = planPrice(tier, "annual", seats);
  const newEnd = addDays(periodEnd(today, "annual", dayOfMonthUTC(today)), remaining);
  const monthlyYear = planPrice(tier, "monthly", seats) * 12;
  return (
    <Modal
      open
      onClose={close}
      title="Switch to yearly billing"
      spec="M-03"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Keep monthly
          </button>
          <button className="btn-primary" onClick={onContinue}>
            Continue to payment
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p>
          We charge <strong className="text-ink">{fmtMoney(amount)}</strong> today. Your <strong className="text-ink">{remaining} remaining days</strong> are added, so your plan runs until <strong className="text-ink">{fmtDate(newEnd)}</strong> and then renews yearly.
        </p>
        <div className="rounded-lg bg-success-tint px-3 py-2 text-sm text-success">
          Save {ANNUAL_SAVINGS[tier].pct}% compared to monthly ({fmtMoney(monthlyYear)} a year on monthly billing). <Spec id="UX-21" />
        </div>
        <div className="rounded-lg bg-page px-3 py-2 text-xs text-ink-2">
          <div className="flex justify-between"><span>Today</span><strong className="text-ink">{fmtMoney(amount)}</strong></div>
          <div className="flex justify-between"><span>New end date</span><strong className="text-ink">{fmtDate(newEnd)}</strong></div>
          <div className="flex justify-between"><span>Next renewal</span><strong className="text-ink">{fmtDate(newEnd)}, {fmtMoney(amount)}</strong></div>
        </div>
        <p className="text-xs text-muted">Unused monthly envelopes are not carried over; the yearly allowance starts today.</p>
      </div>
    </Modal>
  );
}

/* M-04 and M-04b */
function DowngradeModal({ tier, interval, seats, kind, close, onConfirm }: { tier: PaidTier; interval: Interval; seats: number; kind: "downgrade" | "interval_down"; close: () => void; onConfirm: () => void }) {
  const { s } = useAppState();
  const flows = useFlows();
  const sub = activeSubscription(s)!;
  const effective = sub.currentPeriodEnd;
  const newAmount = planPrice(tier, interval, seats);
  const losses = kind === "downgrade" ? downgradeLosses(s) : [];
  const isBusinessDown = kind === "downgrade" && sub.tier === "business";
  const [understood, setUnderstood] = useState(kind !== "downgrade");

  return (
    <Modal
      open
      onClose={close}
      title={kind === "downgrade" ? `Change to ${planName(tier, interval)} on ${fmtDate(effective)}` : `Switch to monthly billing from ${fmtDate(effective)}`}
      spec={kind === "downgrade" ? "M-04" : "M-04b"}
      width="max-w-xl"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Keep {planName(sub.tier, sub.interval)}
          </button>
          <button className="btn-primary" disabled={!understood} onClick={onConfirm}>
            Schedule change
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p>
          You keep <strong className="text-ink">{planName(sub.tier, sub.interval)}</strong> until <strong className="text-ink">{fmtDate(effective)}</strong>. From then you are on <strong className="text-ink">{planName(tier, interval)}</strong> at {fmtMoney(newAmount)} per {intervalWord(interval)}.
        </p>
        {kind === "downgrade" && (
          <div className="rounded-xl border border-[#f2b9a5] bg-[#fff4ee] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <IconWarning size={16} className="text-danger" /> What changes on {fmtDate(effective)} <Spec id="UX-07" />
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              {losses.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {isBusinessDown && (
              <button
                className="mt-3 flex items-center gap-2 text-sm font-semibold text-maroon underline-offset-2 hover:underline"
                onClick={() => flows.open({ type: "handover" })}
              >
                <IconHandover size={16} /> Hand over team documents first <Spec id="UX-08" />
              </button>
            )}
          </div>
        )}
        <div className="rounded-lg bg-page px-3 py-2 text-xs text-ink-2">
          <Spec id="UX-06" className="float-right" />
          <div className="flex justify-between"><span>Today</span><strong className="text-ink">Nothing charged</strong></div>
          <div className="flex justify-between"><span>From {fmtDate(effective)}</span><strong className="text-ink">{fmtMoney(newAmount)} / {intervalWord(interval)}</strong></div>
          <div className="flex justify-between"><span>Refund for the current period</span><strong className="text-ink">None (you keep using it)</strong></div>
        </div>
        <p className="text-xs text-muted">You can undo this any time before {fmtDate(effective)} from the banner or Plan settings. <Spec id="UX-09" /></p>
        {kind === "downgrade" && (
          <Checkbox checked={understood} onChange={setUnderstood} id="dg-ack">
            I understand what changes on {fmtDate(effective)}.
          </Checkbox>
        )}
      </div>
    </Modal>
  );
}

/* M-05 */
function CancelModal({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const flows = useFlows();
  const sub = activeSubscription(s)!;
  const accessUntil = sub.status === "past_due" && sub.graceEndsAt ? sub.graceEndsAt : sub.currentPeriodEnd;
  const [reason, setReason] = useState<string | null>(null);
  const [step, setStep] = useState<"confirm" | "survey">("confirm");
  const REASONS = ["Too expensive", "Not signing enough documents", "Missing a feature I need", "Switching to another tool", "Just trying it out", "Other"];
  const isBusiness = sub.tier === "business";

  function doCancel() {
    api.cancelAtPeriodEnd(reason ?? undefined);
    close();
  }

  if (step === "survey") {
    return (
      <Modal
        open
        onClose={close}
        title="Tell us why (optional)"
        spec="UX-11"
        footer={
          <>
            <button className="btn-ghost" onClick={doCancel}>
              Skip and cancel
            </button>
            <button className="btn-primary" onClick={doCancel}>
              Cancel subscription
            </button>
          </>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)} className={`rounded-lg border px-3 py-2 text-left text-sm ${reason === r ? "border-ink bg-page" : "border-line-2 hover:bg-page"}`}>
              {r}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">One screen only, always skippable. Never gates the cancel button.</p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={close}
      title={`Cancel your ${planName(sub.tier, sub.interval)}?`}
      spec="M-05"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Keep my plan
          </button>
          <button className="btn-primary" onClick={() => setStep("survey")}>
            Cancel subscription
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p>
          You keep full access until <strong className="text-ink">{fmtDate(accessUntil)}</strong>. No further charges. Your documents stay in your account.
        </p>
        {isBusiness && (
          <div className="rounded-xl border border-[#f2b9a5] bg-[#fff4ee] p-4 text-sm">
            <p className="font-semibold text-ink">Your workspace {s.workspace.name} closes on {fmtDate(accessUntil)}</p>
            <p className="mt-1 text-ink-2">
              {Math.max(0, s.workspace.members.length - 1)} team members lose access; automations, retention policies, e-Seal and branding turn off. Signed documents are never deleted; the workspace is recoverable for 90 days if you resubscribe.
            </p>
            <button className="mt-2 flex items-center gap-2 text-sm font-semibold text-maroon underline-offset-2 hover:underline" onClick={() => flows.open({ type: "handover" })}>
              <IconHandover size={16} /> Hand over team documents first
            </button>
          </div>
        )}
        <p className="text-xs text-muted">Two clicks, no call, no chat, no email required. You can resume with one click before {fmtDate(accessUntil)}. <Spec id="UX-11" /></p>
      </div>
    </Modal>
  );
}

/* M-06 */
function ResumeModal({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const sub = activeSubscription(s)!;
  const amount = planPrice(sub.tier, sub.interval, sub.seats);
  const text = `I agree that Privy will charge ${fmtMoney(amount)} to my card every ${intervalWord(sub.interval)} until I cancel.`;
  return (
    <Modal
      open
      onClose={close}
      title="Resume auto-renewal"
      spec="M-06"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Not now
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              api.resume(text);
              close();
            }}
          >
            Resume
          </button>
        </>
      }
    >
      <p>
        Your <strong className="text-ink">{planName(sub.tier, sub.interval)}</strong> will renew on <strong className="text-ink">{fmtDate(sub.currentPeriodEnd)}</strong> for {fmtMoney(amount)} on card ending {s.card?.last4}. Nothing is charged today.
      </p>
      <p className="mt-3 rounded-lg bg-page px-3 py-2 text-xs text-muted">{text}</p>
    </Modal>
  );
}

/* M-08 */
function ReplaceCardModal({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const sub = activeSubscription(s);
  const [form, setForm] = useState<CardFormValue>({ number: "", exp: "", cvc: "", name: "" });
  const [stage, setStage] = useState<"form" | "3ds" | "saving">("form");
  const pastDue = sub?.status === "past_due";
  const pendingAmount = sub ? planPrice(sub.scheduledChange?.tier ?? sub.tier, sub.scheduledChange?.interval ?? sub.interval, sub.scheduledChange?.seats ?? sub.seats) : 0;

  function save(card: Card) {
    setStage("saving");
    setTimeout(() => {
      api.replaceCard(card);
      close();
    }, 500);
  }

  function submit() {
    const card = cardFromForm(form, s.now);
    if (card.behavior === "requires_action") setStage("3ds");
    else save(card);
  }

  return (
    <>
      <Modal
        open
        onClose={close}
        title={s.card ? "Update payment method" : "Add a payment method"}
        spec="M-08"
        footer={
          <>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!cardFormValid(form) || stage !== "form"} onClick={submit}>
              {stage === "saving" ? "Saving…" : "Save card"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">
            We will not charge you now.{" "}
            {pastDue && (
              <span>
                Because a payment of <strong className="text-ink">{fmtMoney(pendingAmount)}</strong> is pending, we will retry it right away with the new card. <Spec id="R-22" />
              </span>
            )}
          </p>
          <CardForm value={form} onChange={setForm} nowIso={s.now} />
          <p className="text-xs text-muted">Your bank may ask you to confirm the new card (no charge). <Spec id="UX-14" /></p>
        </div>
      </Modal>
      {stage === "3ds" && (
        <ThreeDSModal
          amount="A$0.00 (card verification)"
          last4={cardFromForm(form, s.now).last4}
          onApprove={() => save({ ...cardFromForm(form, s.now), behavior: "success" })}
          onCancel={() => setStage("form")}
        />
      )}
    </>
  );
}

/* N-06 link: on-session confirmation of the same PaymentIntent */
function AuthenticateFlow({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const sub = activeSubscription(s);
  if (!sub || sub.status !== "past_due") {
    close();
    return null;
  }
  const amount = sub.pendingAuthAmount ?? planPrice(sub.tier, sub.interval, sub.seats);
  return (
    <ThreeDSModal
      amount={fmtMoney(amount)}
      last4={s.card?.last4 ?? "----"}
      onApprove={() => {
        api.confirmAuthentication();
        close();
      }}
      onCancel={close}
    />
  );
}

/* Migration opt-in (UX-24, R-42). Also the only self-serve upgrade path for prepaid users (R-43). */
function OptInModal({ close, tier: tierIn, interval: intervalIn, fromUpgrade }: { close: () => void; tier?: PaidTier; interval?: Interval; fromUpgrade?: boolean }) {
  const { s, api } = useAppState();
  const pe = prepaidEnd(s)!;
  const tier = tierIn ?? s.prepaid!.tier;
  const [interval, setInterval] = useState<Interval>(intervalIn ?? "annual");
  const [seats, setSeats] = useState(1);
  const [form, setForm] = useState<CardFormValue>({ number: "", exp: "", cvc: "", name: "" });
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<"form" | "3ds" | "done">("form");
  const amount = planPrice(tier, interval, seats);
  const text = `I agree that Privy will charge ${fmtMoney(amount)} to my card every ${intervalWord(interval)} starting ${fmtDate(pe)} until I cancel. I can cancel any time before then and nothing will be charged.`;
  const upgrading = tier !== s.prepaid!.tier;

  function finish(card: Card) {
    api.optIn(card, text, interval, tier, seats);
    setStage("done");
  }
  function submit() {
    const card = cardFromForm(form, s.now);
    if (card.behavior === "requires_action") setStage("3ds");
    else finish(card);
  }

  if (stage === "done") {
    return (
      <Modal open onClose={close} title="Auto-renewal is on" footer={<button className="btn-primary" onClick={close}>Done</button>}>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success"><IconCheckCircle size={32} /></span>
          <p>
            Your prepaid time runs until <strong className="text-ink">{fmtDate(pe)}</strong>. On that date we charge {fmtMoney(amount)} for {planName(tier, interval)} and your plan continues without interruption.
          </p>
          <p className="mt-2 text-xs text-muted">Nothing was charged today. Cancel any time before {fmtDate(pe)} from Plan settings.</p>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        open
        onClose={close}
        title={upgrading ? `Upgrade to ${TIER_LABEL[tier]} when your prepaid time ends` : "Turn on auto-renewal"}
        spec={upgrading ? "R-43" : "UX-24"}
        width="max-w-xl"
        footer={
          <>
            <button className="btn-secondary" onClick={close}>
              Not now
            </button>
            <button className="btn-primary" disabled={!cardFormValid(form) || !consent} onClick={submit}>
              {upgrading ? `Schedule upgrade for ${fmtDate(pe)}` : "Turn on auto-renewal"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {upgrading && fromUpgrade && (
            <p className="flex items-start gap-2 rounded-lg bg-info-tint px-3 py-2 text-xs text-info">
              <IconInfo size={16} className="mt-0.5 shrink-0" />
              You bought {s.prepaid!.periods.length} prepaid period{s.prepaid!.periods.length > 1 ? "s" : ""} under the old model, so upgrading now would forfeit all of them. Self-serve offers the scheduled option only; contact helpdesk@privy.id if you need Business sooner.
            </p>
          )}
          <p>
            Your prepaid {planName(s.prepaid!.tier)} plan is paid until <strong className="text-ink">{fmtDate(pe)}</strong>. Save a card now and we charge {fmtMoney(amount)} for {planName(tier, interval)} on that date, not before.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["monthly", "annual"] as Interval[]).map((iv) => (
              <button key={iv} onClick={() => setInterval(iv)} className={`rounded-lg border px-3 py-2 text-left text-sm ${interval === iv ? "border-ink" : "border-line-2"}`}>
                <span className="block font-semibold text-ink">{TIER_LABEL[tier]} {iv === "monthly" ? "Monthly" : "Yearly"}</span>
                <span className="text-xs text-muted">{fmtMoney(planPrice(tier, iv, seats))} / {intervalWord(iv)}{iv === "annual" ? ` · save ${ANNUAL_SAVINGS[tier].pct}%` : ""}</span>
              </button>
            ))}
          </div>
          {tier === "business" && (
            <div className="flex items-center gap-3 rounded-lg border border-line bg-page px-3 py-2 text-sm">
              Member seats
              <button className="btn-secondary !px-2 !py-1" onClick={() => setSeats(Math.max(1, seats - 1))}><IconMinus size={14} /></button>
              <span className="w-6 text-center font-semibold">{seats}</span>
              <button className="btn-secondary !px-2 !py-1" onClick={() => setSeats(Math.min(50, seats + 1))}><IconPlus size={14} /></button>
            </div>
          )}
          <CardForm value={form} onChange={setForm} nowIso={s.now} compact />
          <Checkbox checked={consent} onChange={setConsent} id="optin-consent">
            {text}
          </Checkbox>
          <p className="text-xs text-muted">No pre-ticked boxes, no countdown. If you do nothing, your account moves to Free on {fmtDate(pe)}.</p>
        </div>
      </Modal>
      {stage === "3ds" && (
        <ThreeDSModal amount="A$0.00 (card verification)" last4={cardFromForm(form, s.now).last4} onApprove={() => finish({ ...cardFromForm(form, s.now), behavior: "success" })} onCancel={() => setStage("form")} />
      )}
    </>
  );
}

/* Handover: reuses the existing Document Handover feature (stub in the prototype). */
function HandoverModal({ close }: { close: () => void }) {
  const { s } = useAppState();
  const others = s.workspace.members.filter((m) => m.role !== "owner");
  const [done, setDone] = useState(false);
  return (
    <Modal
      open
      onClose={close}
      title="Hand over team documents"
      spec="UX-08"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>Close</button>
          {!done && <button className="btn-primary" onClick={() => setDone(true)}>Hand over to me</button>}
        </>
      }
    >
      {done ? (
        <p className="flex items-center gap-2 text-success"><IconCheckCircle size={18} /> Documents from {others.length} members are now in your account. Nothing will be lost when the workspace closes.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <p>This is the existing Document Handover flow. Choose who receives the documents owned by members who will lose access:</p>
          <ul className="list-disc pl-5 text-ink-2">
            {others.map((m) => (
              <li key={m.id}>{m.name} · {m.email}</li>
            ))}
          </ul>
          <p className="text-xs text-muted">Prototype: this step is a placeholder for the production Handover feature.</p>
        </div>
      )}
    </Modal>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

