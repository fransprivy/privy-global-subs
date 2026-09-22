"use client";

import { useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ANNUAL_SAVINGS, TIER_LABEL, regionMeta } from "@/lib/catalog";
import {
  activeSubscription,
  allCards,
  brandLabel,
  cardId,
  classifyChange,
  CONFIG,
  currentSeats,
  downgradeLosses,
  individualPlan,
  quotaResetDate,
  regionOf,
  workspaceView,
  isIndonesia,
  isOneTimeUser,
  pendingPayment,
  previewSeatChange,
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
import { CardBrandBadge, CardForm, cardFormValid, cardFromForm, ThreeDSModal, type CardFormValue } from "./payments";
import { ConvertModal, OneTimeCheckoutDrawer, PaymentDetailDrawer, PurchaseTypeModal } from "./onetime";
import { Checkbox, Modal, Spec } from "./ui";

export type Flow =
  | { type: "plan"; tier: PaidTier; interval: Interval; seats?: number }
  | { type: "cancel" }
  | { type: "resume" }
  | { type: "replaceCard" }
  | { type: "addCard"; makeDefault?: boolean }
  | { type: "removeCard"; id: string }
  | { type: "seats" }
  | { type: "payBill"; billId: string }
  | { type: "paymentDetail"; billId: string }
  | { type: "convert" }
  | { type: "invite" }
  | { type: "leave"; id: string }
  | { type: "paywall" }
  | { type: "upload" }
  | { type: "transfer"; memberId?: string }
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
      {!flow && <WelcomeBusinessModal />}
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
      return <AddCardModal close={close} makeDefault />;
    case "addCard":
      return <AddCardModal close={close} makeDefault={flow.makeDefault} />;
    case "removeCard":
      return <RemoveCardModal close={close} id={flow.id} />;
    case "seats":
      return <SeatsModal close={close} />;
    case "payBill":
      return <PayBillFlow billId={flow.billId} close={close} />;
    case "paymentDetail":
      return <PaymentDetailDrawer billId={flow.billId} close={close} />;
    case "convert":
      return <ConvertModal close={close} />;
    case "invite":
      return <InviteModal close={close} />;
    case "leave":
      return <LeaveWorkspaceModal close={close} id={flow.id} />;
    case "paywall":
      return <PaywallModal close={close} />;
    case "upload":
      return <UploadDocumentScreen close={close} />;
    case "transfer":
      return <TransferOwnershipModal close={close} memberId={flow.memberId} />;
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
  // Indonesia: choose auto-renewal vs one-time first (M-10). Global: recurring only.
  const [indonesia] = useState(() => isIndonesia(s));
  const [oneTimeUser] = useState(() => isOneTimeUser(s));
  const [purchase, setPurchase] = useState<"recurring" | "one_time" | null>(null);
  const [oneTimeStage, setOneTimeStage] = useState<"checkout" | "detail">("checkout");

  const onDone = useCallback(() => close(), [close]);

  const needsPurchaseChoice = (indonesia || oneTimeUser) && !sub && purchase === null;
  if (needsPurchaseChoice) {
    return <PurchaseTypeModal tier={tier} interval={interval} seats={seats} close={close} onPick={setPurchase} />;
  }
  if (purchase === "one_time") {
    if (oneTimeStage === "detail") {
      const pp = pendingPayment(s);
      if (!pp) {
        close();
        return null;
      }
      return <PaymentDetailDrawer billId={pp.id} close={close} />;
    }
    return <OneTimeCheckoutDrawer tier={tier} interval={interval} seats={seats} close={close} onPaymentCreated={() => setOneTimeStage("detail")} />;
  }
  // One-time (Indonesia) user choosing auto-renewal, or a migrated prepaid user: subscription starts when prepaid time ends (R-43, R-65).
  if (prepaid || oneTimeUser) {
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
function AddCardModal({ close, makeDefault: makeDefaultIn }: { close: () => void; makeDefault?: boolean }) {
  const { s, api } = useAppState();
  const sub = activeSubscription(s);
  const hasDefault = !!s.card;
  const [form, setForm] = useState<CardFormValue>({ number: "", exp: "", cvc: "", name: "" });
  const [makeDefault, setMakeDefault] = useState(makeDefaultIn ?? !hasDefault);
  const [stage, setStage] = useState<"form" | "3ds" | "saving">("form");
  const pastDue = sub?.status === "past_due";
  const pendingAmount = sub ? planPrice(sub.scheduledChange?.tier ?? sub.tier, sub.scheduledChange?.interval ?? sub.interval, sub.scheduledChange?.seats ?? sub.pendingSeats ?? sub.seats) : 0;
  const backups = s.backupCards ?? [];

  function save(card: Card) {
    setStage("saving");
    setTimeout(() => {
      api.addCard(card, makeDefault);
      close();
    }, 500);
  }

  function submit() {
    const card = cardFromForm(form, s.now);
    if (card.behavior === "requires_action") setStage("3ds");
    else save(card);
  }

  const title = !hasDefault ? "Add a payment method" : makeDefault ? "Replace your default card" : "Add a backup card";

  return (
    <>
      <Modal
        open
        onClose={close}
        title={title}
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
                Because a payment of <strong className="text-ink">{fmtMoney(pendingAmount)}</strong> is pending, we will retry it right away after saving. <Spec id="R-22" />
              </span>
            )}
          </p>
          <CardForm value={form} onChange={setForm} nowIso={s.now} />
          {hasDefault && (
            <label className="flex items-start gap-2 rounded-lg border border-line-2 px-3 py-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 accent-brand" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
              <span>
                <span className="font-medium text-ink">Make this my default card</span>
                <span className="block text-xs text-muted">
                  {makeDefault
                    ? `Charged first from now on. Your current default (ending ${s.card!.last4}) becomes a backup.`
                    : `Saved as backup ${backups.length + 1}. Only charged if your default card${backups.length ? " and earlier backups are" : " is"} declined.`}
                </span>
              </span>
            </label>
          )}
          <p className="text-xs text-muted">
            Your bank may ask you to confirm the new card (no charge). <Spec id="UX-14" />
          </p>
        </div>
      </Modal>
      {stage === "3ds" && (
        <ThreeDSModal
          amount={`${fmtMoney(0)} (card verification)`}
          last4={cardFromForm(form, s.now).last4}
          onApprove={() => save({ ...cardFromForm(form, s.now), behavior: "success" })}
          onCancel={() => setStage("form")}
        />
      )}
    </>
  );
}

function RemoveCardModal({ close, id }: { close: () => void; id: string }) {
  const { s, api } = useAppState();
  const [error, setError] = useState<string | null>(null);
  const card = allCards(s).find((c) => cardId(c) === id);
  const sub = activeSubscription(s);
  if (!card) {
    close();
    return null;
  }
  const isDefault = !!s.card && cardId(s.card) === id;
  const backups = s.backupCards ?? [];
  const promoted = isDefault ? backups[0] : null;
  const blocked = isDefault && !!sub && backups.length === 0;

  return (
    <Modal
      open
      onClose={close}
      title={`Remove card ending ${card.last4}?`}
      spec="UX-17"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Keep card
          </button>
          <button
            className="btn-danger-outline"
            disabled={blocked}
            onClick={() => {
              const err = api.removeCard(id);
              if (err) setError(err);
              else close();
            }}
          >
            Remove card
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3 rounded-xl border border-line-2 px-4 py-3">
          <CardBrandBadge brand={card.brand} />
          <div>
            <p className="font-medium text-ink">
              {brandLabel(card.brand)} ending {card.last4} <span className="ml-1 text-xs font-normal text-muted">{isDefault ? "Default" : "Backup"}</span>
            </p>
            <p className="text-xs text-muted">
              Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}
            </p>
          </div>
        </div>
        {blocked ? (
          <p className="rounded-lg bg-warn-tint px-3 py-2 text-warn">This is the only card on an active subscription. Add another card first, or cancel your subscription to remove it.</p>
        ) : isDefault && promoted ? (
          <p>
            Your backup card ending <strong className="text-ink">{promoted.last4}</strong> becomes the default and will be charged for {sub ? planName(sub.tier, sub.interval) : "future plans"}.
          </p>
        ) : (
          <p>{sub ? "Your default card is not affected. We will no longer fall back to this card if the default is declined." : "This card will no longer be saved to your account."}</p>
        )}
        {error && <p className="text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

/* Business seats: add now (prorated to the same end date), remove at period end */
function SeatsModal({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const sub = activeSubscription(s);
  const [target, setTarget] = useState(sub?.pendingSeats ?? sub?.seats ?? 1);
  const [ack, setAck] = useState(false);
  const [stage, setStage] = useState<"form" | "processing" | "3ds" | "declined">("form");
  if (!sub || sub.tier !== "business") {
    close();
    return null;
  }
  const p = previewSeatChange(s, target);
  const adding = p.delta > 0;
  const removing = p.delta < 0;
  const card = s.card;
  const consentText = adding
    ? `I agree to be charged ${fmtMoney(p.chargeToday)} today for ${p.delta} additional seat${p.delta === 1 ? "" : "s"} and ${fmtMoney(p.nextRenewalAmount)} every ${intervalWord(sub.interval)} from ${fmtDate(sub.currentPeriodEnd)} until I cancel.`
    : "";

  function finish() {
    api.changeSeats(target, consentText);
    close();
  }
  function pay() {
    if (!card) return;
    setStage("processing");
    setTimeout(() => {
      switch (card.behavior) {
        case "success":
          finish();
          break;
        case "requires_action":
          setStage("3ds");
          break;
        default:
          setStage("declined");
      }
    }, 600);
  }

  const canSubmit = !p.blockedReason && p.delta !== 0 && (!adding || (ack && !!card)) && stage === "form";

  return (
    <>
      <Modal
        open
        onClose={close}
        title="Manage seats"
        spec="M-09"
        footer={
          <>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            {sub.pendingSeats != null && (
              <button
                className="btn-secondary"
                onClick={() => {
                  api.undoSeatChange();
                  close();
                }}
              >
                Keep my {sub.seats} seats
              </button>
            )}
            <button className="btn-primary" disabled={!canSubmit} onClick={adding ? pay : finish}>
              {stage === "processing" ? "Processing…" : adding ? `Add ${p.delta} seat${p.delta === 1 ? "" : "s"} and pay ${fmtMoney(p.chargeToday)}` : removing ? `Reduce to ${target} on ${fmtDate(sub.currentPeriodEnd)}` : "No change"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-xl border border-line-2 px-4 py-3">
            <div>
              <p className="font-medium text-ink">Seats in this workspace</p>
              <p className="text-xs text-muted">
                {p.membersInUse} of {sub.seats} in use · {fmtMoney(p.unit)} per seat per {intervalWord(sub.interval)} · renews {fmtDate(sub.currentPeriodEnd)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-line-2 p-1.5 text-ink-2 hover:bg-page disabled:opacity-40" disabled={target <= 1} onClick={() => setTarget((n) => Math.max(1, n - 1))} aria-label="Fewer seats">
                <IconMinus size={16} />
              </button>
              <span className="w-8 text-center text-lg font-semibold text-ink">{target}</span>
              <button className="rounded-md border border-line-2 p-1.5 text-ink-2 hover:bg-page disabled:opacity-40" disabled={target >= 50} onClick={() => setTarget((n) => Math.min(50, n + 1))} aria-label="More seats">
                <IconPlus size={16} />
              </button>
            </div>
          </div>

          {sub.pendingSeats != null && p.delta === 0 && (
            <p className="rounded-lg bg-info-tint px-3 py-2 text-info">
              A reduction to {sub.pendingSeats} seats is scheduled for {fmtDate(sub.currentPeriodEnd)}. Change the number above to replace it, or keep your current seats.
            </p>
          )}

          {p.blockedReason && p.delta !== 0 && <p className="rounded-lg bg-warn-tint px-3 py-2 text-warn">{p.blockedReason}</p>}

          {adding && !p.blockedReason && (
            <div className="space-y-3">
              <div className="rounded-xl bg-page p-4">
                <p className="font-medium text-ink">
                  Today: {fmtMoney(p.chargeToday)} <Spec id="UX-06" />
                </p>
                <p className="mt-1 text-xs text-ink-2">
                  {p.delta} seat{p.delta === 1 ? "" : "s"} × {fmtMoney(p.unit)} × {p.remainingDays} of {p.periodDays} days left in this period = {fmtMoney(p.proratedPerSeat)} per seat. Prorated so every seat shares the same renewal date.
                </p>
                <p className="mt-2 font-medium text-ink">
                  Next renewal, {fmtDate(sub.currentPeriodEnd)}: {fmtMoney(p.nextRenewalAmount)} per {intervalWord(sub.interval)} for {target} seats
                </p>
                <p className="mt-1 text-xs text-muted">One Business subscription has one end date; added seats never start a separate billing cycle.</p>
              </div>
              {card ? (
                <p className="text-xs text-ink-2">
                  Charged to your default card, {brandLabel(card.brand)} ending {card.last4}. Your bank may ask you to confirm. <Spec id="UX-14" />
                </p>
              ) : (
                <p className="rounded-lg bg-warn-tint px-3 py-2 text-warn">Add a payment method before adding seats.</p>
              )}
              <Checkbox checked={ack} onChange={setAck}>{consentText}</Checkbox>
              {stage === "declined" && (
                <p className="rounded-lg bg-danger-tint px-3 py-2 text-danger">
                  Your bank declined the card. Your seats are unchanged. Try another card from Billing → Payment method.
                </p>
              )}
            </div>
          )}

          {removing && !p.blockedReason && (
            <div className="rounded-xl bg-page p-4">
              <p className="font-medium text-ink">Nothing charged or refunded today</p>
              <p className="mt-1 text-xs text-ink-2">
                You keep {sub.seats} seats until {fmtDate(sub.currentPeriodEnd)}. From then you pay {fmtMoney(p.nextRenewalAmount)} per {intervalWord(sub.interval)} for {target} seats. Seats reduced mid-period are not refunded (no-refund policy); you can undo until the renewal date. <Spec id="Rule D" />
              </p>
            </div>
          )}
        </div>
      </Modal>
      {stage === "3ds" && card && (
        <ThreeDSModal
          amount={fmtMoney(p.chargeToday)}
          last4={card.last4}
          onApprove={finish}
          onCancel={() => setStage("form")}
        />
      )}
    </>
  );
}

/* Indonesia: pay an existing renewal bill (M-11 → M-12 → M-13) */
function PayBillFlow({ billId, close }: { billId: string; close: () => void }) {
  const { s } = useAppState();
  const bill = (s.bills ?? []).find((b) => b.id === billId);
  const [stage, setStage] = useState<"checkout" | "detail">(bill?.status === "pending_payment" ? "detail" : "checkout");
  if (!bill) {
    close();
    return null;
  }
  if (stage === "detail") return <PaymentDetailDrawer billId={billId} close={close} />;
  return <OneTimeCheckoutDrawer tier={bill.tier} interval={bill.interval} seats={bill.seats} bill={bill} close={close} onPaymentCreated={() => setStage("detail")} />;
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
        <ThreeDSModal amount={`${fmtMoney(0)} (card verification)`} last4={cardFromForm(form, s.now).last4} onApprove={() => finish({ ...cardFromForm(form, s.now), behavior: "success" })} onCancel={() => setStage("form")} />
      )}
    </>
  );
}

/* Handover: reuses the existing Document Handover feature (stub in the prototype). */
function HandoverModal({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const docs = s.workspace.documents ?? [];
  const others = s.workspace.members.filter((m) => m.role !== "owner");
  const [done, setDone] = useState(false);
  return (
    <Modal
      open
      onClose={close}
      title="Hand over workspace documents"
      spec="UX-08"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Close
          </button>
          {!done && docs.length > 0 && (
            <button
              className="btn-primary"
              onClick={() => {
                api.handoverDocuments();
                setDone(true);
              }}
            >
              Hand over {docs.length} document{docs.length === 1 ? "" : "s"} to me
            </button>
          )}
        </>
      }
    >
      {done ? (
        <p className="flex items-center gap-2 text-success">
          <IconCheckCircle size={18} /> Done. The documents are now in your Individual workspace and stay there whatever happens to {s.workspace.name}.
        </p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-ink-2">There are no documents left in {s.workspace.name}.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            Move every envelope in <strong className="text-ink">{s.workspace.name}</strong> to your Individual workspace ({s.user.name}). Use this before the workspace expires, or any time while it is read-only, so nothing depends on the Business plan. <Spec id="R-79" />
          </p>
          <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-ink-2">
            {docs.map((d) => (
              <li key={d.id}>
                {d.title} <span className="text-muted">· from {d.from}</span>
              </li>
            ))}
          </ul>
          {others.length > 0 && (
            <p className="text-xs text-muted">
              Includes documents owned by {others.length} member{others.length === 1 ? "" : "s"} ({others.map((m) => m.name).join(", ")}). Members keep view and download access to the workspace while it is expired.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** R-78: invite a member into the owned Business workspace. When every seat is taken, one seat is added and paid (prorated) in the same flow (UX-29). */
function InviteModal({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const sub = activeSubscription(s);
  const seats = currentSeats(s);
  const used = s.workspace.members.length;
  const full = used >= seats;
  const emailOk = /.+@.+\..+/.test(email);
  // Recurring subscriptions can add a seat now; one-time (Indonesia) periods have fixed seats.
  const canBuySeat = full && !!sub && sub.tier === "business" && !!s.card;
  const preview = canBuySeat ? previewSeatChange(s, seats + 1) : null;
  const consentText = preview && sub ? `I agree to be charged ${fmtMoney(preview.chargeToday)} today for 1 additional seat and ${fmtMoney(preview.nextRenewalAmount)} every ${intervalWord(sub.interval)} from ${fmtDate(sub.currentPeriodEnd)} until I cancel.` : "";
  const ok = emailOk && (!full || (canBuySeat && ack)) && !busy;

  function send() {
    if (full && canBuySeat) {
      setBusy(true);
      setTimeout(() => {
        api.changeSeats(seats + 1, consentText);
        api.inviteMember(name, email);
        close();
      }, 700);
      return;
    }
    api.inviteMember(name, email);
    close();
  }

  return (
    <Modal
      open
      onClose={close}
      title={`Invite to ${s.workspace.name}`}
      spec="R-78"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!ok} onClick={send}>
            {busy ? "Processing…" : full && preview ? `Add seat, pay ${fmtMoney(preview.chargeToday)} and invite` : "Send invitation"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-ink-2">
          {used} of {seats} seats in use. The invitee signs in with their own Privy account; their own Individual plan is not changed by joining. <Spec id="R-71" />
        </p>
        <div>
          <label className="block text-[15px] font-medium text-ink">Name</label>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="block text-[15px] font-medium text-ink">Email</label>
          <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </div>
        {full && preview && sub && (
          <div className="rounded-xl border border-line bg-page p-4">
            <p className="flex items-center gap-2 font-medium text-ink">
              <IconPlus size={16} /> All seats are taken: add 1 seat for this invite <Spec id="UX-29" />
            </p>
            <div className="mt-2 space-y-1 text-ink-2">
              <div className="flex justify-between">
                <span>
                  Today, prorated {preview.remainingDays} of {preview.periodDays} days
                </span>
                <strong className="text-ink">{fmtMoney(preview.chargeToday)}</strong>
              </div>
              <div className="flex justify-between">
                <span>
                  From {fmtDate(sub.currentPeriodEnd)}, {seats + 1} seats every {intervalWord(sub.interval)}
                </span>
                <strong className="text-ink">{fmtMoney(preview.nextRenewalAmount)}</strong>
              </div>
              <p className="text-xs text-muted">
                Charged to {s.card ? `card ending ${s.card.last4}` : "your card"}. Same renewal date as today; one Business subscription keeps one end date.
              </p>
            </div>
            <div className="mt-3">
              <Checkbox checked={ack} onChange={setAck} id="invite-seat-consent">
                {consentText} <Spec id="R-12" />
              </Checkbox>
            </div>
          </div>
        )}
        {full && !canBuySeat && (
          <p className="text-xs text-danger">
            All seats are in use.{" "}
            {sub ? "Add a card in Payment methods to buy a seat." : "Seats on a one-time period are fixed; buy the next period with more seats, or remove a member first."}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Upload a document (the first step of sending an envelope), mirrored from production.
 * When the workspace quota is exhausted the paywall (M-17) opens on top of it (UX-28).
 */
function UploadDocumentScreen({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const ws = workspaceView(s);
  const left = ws.envelopeLimit === null ? null : Math.max(0, ws.envelopeLimit - ws.usage.envelopesSent);
  const blocked = left === 0;
  const [paywall, setPaywall] = useState(blocked);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !paywall && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, paywall]);

  function pickFile() {
    if (blocked) {
      setPaywall(true);
      return;
    }
    api.sendEnvelope();
    close();
  }

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-page">
      <header className="flex h-[64px] items-center justify-between border-b border-line bg-white px-4 sm:px-6">
        <p className="flex items-center gap-2 text-[17px] font-medium text-ink">
          <IconCloudUp size={20} className="text-ink-2" /> Upload a document
        </p>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 text-right sm:flex">
            <div>
              <p className="text-[11px] text-muted">Sending as</p>
              <p className="text-sm font-semibold leading-tight text-ink">{ws.name}</p>
              <p className="text-[11px] text-muted">{ws.kind === "individual" ? "Individual" : ws.kind === "business" ? "Business" : "Enterprise"}</p>
            </div>
          </div>
          <button className="rounded-md p-2 text-ink-2 hover:bg-page" onClick={close} aria-label="Close upload">
            <IconCloseX />
          </button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[780px] flex-1 overflow-y-auto px-4 py-8">
        <p className="text-[17px] font-medium text-ink">Let&apos;s start with select your file(s)</p>
        <button
          type="button"
          onClick={pickFile}
          className={`mt-4 flex w-full flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center ${blocked ? "cursor-not-allowed border-line-2 bg-[#f7f7f7] text-muted" : "border-[#2f6fb5] bg-white hover:bg-[#f4f8fc]"}`}
          aria-disabled={blocked}
        >
          <IconCloudUp size={40} className={blocked ? "text-muted-2" : "text-[#2f6fb5]"} />
          <p className="mt-3 text-[15px] text-ink">
            Drag your document here or click <span className="font-medium text-[#2f6fb5] underline">browse</span>
          </p>
          <p className="mt-1 text-xs text-muted">PDF, DOCX, PPTX, XLSX, JPG, PNG up to 25MB</p>
          {blocked && <p className="mt-3 text-xs font-medium text-danger">You have used every envelope your plan includes this month.</p>}
          {!blocked && left !== null && <p className="mt-3 text-xs text-muted">{left} of {ws.envelopeLimit} envelopes left this month</p>}
        </button>
        <div className="mt-10 border-t border-line pt-8">
          <p className="text-[17px] font-medium text-ink">Start from a template</p>
          <div className="mt-6 flex flex-col items-center text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#e6eef8] text-[#2f6fb5]">
              <IconHandover size={28} />
            </span>
            <p className="mt-3 text-[15px] font-medium text-ink">You have no template</p>
            <p className="text-sm text-muted">Create reusable templates to send envelope faster</p>
            <button className="btn-secondary mt-4" disabled={blocked}>
              Create new <IconPlus size={16} />
            </button>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted">Prototype: choosing a file counts one envelope against the workspace quota. <Spec id="UX-28" /></p>
      </div>
      {paywall && <PaywallModal close={() => setPaywall(false)} />}
    </div>
  );
}

function IconCloudUp({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 7.97" />
      <path d="M12 12v9" />
      <path d="M8.5 15.5 12 12l3.5 3.5" />
    </svg>
  );
}
function IconCloseX() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Original illustration for the paywall: a signed page, a pen and a globe (no brand assets). */
function PaywallArt() {
  return (
    <svg viewBox="0 0 400 150" className="h-[150px] w-full" aria-hidden="true">
      <defs>
        <linearGradient id="pw-sky" x1="0" x2="1">
          <stop offset="0" stopColor="#eaf3fb" />
          <stop offset="1" stopColor="#d3e6f6" />
        </linearGradient>
      </defs>
      <rect width="400" height="150" fill="url(#pw-sky)" />
      <circle cx="330" cy="30" r="44" fill="#bcd6ee" />
      <path d="M286 30h88M330 -14v88M300 8c18 12 42 12 60 0M300 52c18-12 42-12 60 0" stroke="#ffffff" strokeWidth="2.5" fill="none" opacity=".8" />
      <g transform="rotate(-8 150 90)">
        <rect x="95" y="38" width="115" height="100" rx="8" fill="#ffffff" stroke="#c9d8e8" />
        <rect x="108" y="52" width="60" height="6" rx="3" fill="#dbe6f1" />
        <rect x="108" y="66" width="86" height="6" rx="3" fill="#e6eef6" />
        <rect x="108" y="80" width="72" height="6" rx="3" fill="#e6eef6" />
        <path d="M110 118c10-16 16-18 18-6s6 12 14-4 14-10 20 2 12 6 22-6" stroke="#1d3557" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M108 128h90" stroke="#1d3557" strokeWidth="2" strokeLinecap="round" />
        <path d="M100 148l16-14M108 148l16-14" stroke="#1d3557" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g transform="rotate(35 250 95)">
        <rect x="236" y="40" width="22" height="90" rx="6" fill="#c0392b" />
        <rect x="236" y="40" width="22" height="18" rx="6" fill="#8b1d3b" />
        <path d="M236 130l11 16 11-16z" fill="#f2c9a6" />
        <path d="M244 140l3 6 3-6z" fill="#1d3557" />
      </g>
    </svg>
  );
}

/** M-17: quota exhausted paywall, styled after production ("Your plan does not go this far"). */
function PaywallModal({ close }: { close: () => void }) {
  const { s } = useAppState();
  const flows = useFlows();
  const router = useRouter();
  const plan = individualPlan(s);
  const ws = workspaceView(s);
  const limit = ws.envelopeLimit ?? 0;
  const reset = quotaResetDate(s);
  const region = regionMeta(regionOf(s));
  const personalPrice = fmtMoney(planPrice("personal", "monthly", 1));
  const businessPrice = fmtMoney(planPrice("business", "monthly", 1));
  const planLabel = plan === "free" ? "Free" : "Personal";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  function upgrade(tier?: PaidTier) {
    close();
    if (tier) flows.open({ type: "plan", tier, interval: "monthly" });
    else router.push(plan === "free" ? "/plans" : "/settings/billing/change-plan");
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="animate-fade w-full max-w-[400px] overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-label="Your plan does not go this far">
        <div className="relative">
          <PaywallArt />
          <button className="absolute right-3 top-3 rounded-md bg-white/70 p-1 text-ink-2 hover:bg-white" onClick={close} aria-label="Close">
            <IconCloseX />
          </button>
          <Spec id="M-17" className="absolute left-3 top-3" />
        </div>
        <div className="px-6 pb-6 pt-5 text-center">
          <h2 className="font-display text-[19px] font-semibold text-ink">Your plan does not go this far</h2>
          <p className="mt-2 text-sm text-ink-2">
            You have used all <strong className="text-ink">{limit} envelopes</strong> your {planLabel} plan includes this month. Your counter resets on <strong className="text-ink">{fmtDate(reset)}</strong>. Upgrade to send more today.
          </p>
          <div className="mt-4 space-y-2 text-left">
            {plan === "free" && (
              <button type="button" onClick={() => upgrade("personal")} className="flex w-full items-center justify-between rounded-xl border border-line-2 px-4 py-3 hover:border-ink hover:bg-page">
                <span>
                  <span className="block text-[15px] font-medium text-ink">Personal</span>
                  <span className="block text-xs text-muted">50 envelopes a month · {personalPrice}/month · {region.taxNote}</span>
                </span>
                <IconArrowRight size={16} className="text-ink-2" />
              </button>
            )}
            <button type="button" onClick={() => upgrade("business")} className="flex w-full items-center justify-between rounded-xl border border-maroon bg-brand-tint/20 px-4 py-3 hover:bg-brand-tint/40">
              <span>
                <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                  Business <span className="chip bg-maroon text-white">Unlimited</span>
                </span>
                <span className="block text-xs text-muted">Unlimited envelopes + a team workspace · {businessPrice}/seat/month · {region.taxNote}</span>
              </span>
              <IconArrowRight size={16} className="text-ink-2" />
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button className="btn-ghost text-ink-2" onClick={close}>
              Not now
            </button>
            <button className="btn-primary" onClick={() => upgrade()}>
              Upgrade plan
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted">Nothing is lost while you wait: drafts and received envelopes stay available.</p>
        </div>
      </div>
    </div>
  );
}

/** M-18: transfer ownership of the owned Business workspace to a member (R-81). */
function TransferOwnershipModal({ close, memberId }: { close: () => void; memberId?: string }) {
  const { s, api } = useAppState();
  const router = useRouter();
  const others = s.workspace.members.filter((m) => m.role !== "owner");
  const [pick, setPick] = useState(memberId ?? others[0]?.id ?? "");
  const [ack, setAck] = useState(false);
  const sub = activeSubscription(s);
  const periodEnd = sub ? sub.currentPeriodEnd : prepaidEnd(s);
  const m = others.find((x) => x.id === pick);
  const plan = individualPlan(s);
  return (
    <Modal
      open
      onClose={close}
      title={`Transfer ownership of ${s.workspace.name}`}
      spec="M-18"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button
            className="btn-danger"
            disabled={!m || !ack}
            onClick={() => {
              api.transferOwnership(pick);
              close();
              router.push("/settings/billing");
            }}
          >
            Transfer to {m?.name ?? "…"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-2">
        {others.length === 0 ? (
          <p>Invite a member first; ownership can only go to an existing member.</p>
        ) : (
          <div>
            <label className="block text-[15px] font-medium text-ink">New owner</label>
            <select className="input mt-1" value={pick} onChange={(e) => setPick(e.target.value)}>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.email}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="rounded-xl bg-page p-4">
          <p className="font-medium text-ink">What happens to billing</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Your card is detached today and <strong className="text-ink">will not be charged again</strong> for this workspace. Nothing is refunded for the current period.
            </li>
            <li>
              The period already paid keeps the workspace active until <strong className="text-ink">{periodEnd ? fmtDate(periodEnd) : "the end of the paid period"}</strong>.
            </li>
            <li>
              {m?.name ?? "The new owner"} must add a payment method (or, in Indonesia, pay the next bill) before that date; otherwise the workspace becomes read-only until it is reactivated. <Spec id="R-81" />
            </li>
            <li>
              You stay in the workspace as a member. Your Individual workspace goes back to {plan === "personal_plus" ? "its own plan (Free unless you buy Personal)" : plan === "personal" ? "Personal" : "Free"} right away, since the owner perk moves with ownership.
            </li>
          </ul>
        </div>
        <Checkbox checked={ack} onChange={setAck} id="transfer-ack">
          I understand my card will not be charged again and {m?.name ?? "the new owner"} needs to set up payment before {periodEnd ? fmtDate(periodEnd) : "the period ends"}.
        </Checkbox>
      </div>
    </Modal>
  );
}

/** M-16: member leaves someone else's Business or Enterprise workspace (R-80). */
function LeaveWorkspaceModal({ close, id }: { close: () => void; id: string }) {
  const { s, api } = useAppState();
  const router = useRouter();
  const w = (s.otherWorkspaces ?? []).find((o) => o.id === id);
  const [ack, setAck] = useState(false);
  if (!w) {
    close();
    return null;
  }
  const mine = w.documents.filter((d) => d.from === s.user.name).length;
  return (
    <Modal
      open
      onClose={close}
      title={`Leave ${w.name}?`}
      spec="M-16"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Stay
          </button>
          <button
            className="btn-danger"
            disabled={!ack}
            onClick={() => {
              api.leaveWorkspace(w.id);
              close();
              router.push("/home");
            }}
          >
            Leave workspace
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-2">
        <p>
          You will lose access to <strong className="text-ink">{w.name}</strong> and its {w.documents.length} envelope{w.documents.length === 1 ? "" : "s"}. The seat goes back to {w.ownerName}, who can invite someone else.
        </p>
        <p>
          Every document you created or signed in this workspace ({mine} of them) is <strong className="text-ink">handed over to the workspace owner, {w.ownerName}</strong>. They are not copied to your Individual workspace. Download anything you need before leaving.
        </p>
        <p className="text-xs text-muted">Your own plan ({individualPlanLabel(s)}) is not affected. You can be invited again later. <Spec id="R-80" /></p>
        <Checkbox checked={ack} onChange={setAck} id="leave-ack">
          I understand my documents in {w.name} stay with {w.ownerName}.
        </Checkbox>
      </div>
    </Modal>
  );
}

function individualPlanLabel(s: ReturnType<typeof useAppState>["s"]): string {
  const p = individualPlan(s);
  return p === "free" ? "Free" : p === "personal" ? "Personal" : "Personal, included with Business";
}

/** M-15: shown once after the Business workspace is created. */
export function WelcomeBusinessModal() {
  const { s, api } = useAppState();
  const router = useRouter();
  if (!s.ui.welcomeBusiness) return null;
  const close = () => api.dismissWelcome();
  return (
    <Modal
      open
      onClose={close}
      title={`Welcome to ${s.workspace.name}`}
      spec="M-15"
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              close();
              api.switchWorkspace("individual");
              router.push("/home");
            }}
          >
            Stay in my Individual workspace
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              close();
              router.push("/settings/billing");
            }}
          >
            Invite my team
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-2">
        <p>Your Business plan comes with two workspaces. Switch between them from the avatar menu at the top right.</p>
        <ul className="space-y-2">
          <li className="flex gap-2">
            <IconCheckCircle size={18} className="mt-0.5 shrink-0 text-success" />
            <span>
              <strong className="text-ink">{s.workspace.name} (Business)</strong>: unlimited envelopes, {currentSeats(s)} seat{currentSeats(s) > 1 ? "s" : ""} for your team, delegation, workflow automation, e-Seal and branding.
            </span>
          </li>
          <li className="flex gap-2">
            <IconCheckCircle size={18} className="mt-0.5 shrink-0 text-success" />
            <span>
              <strong className="text-ink">{s.user.name} (Individual)</strong>: now Personal with <strong className="text-ink">unlimited envelopes</strong>, included with Business at no extra cost. Use it for your own documents; the Business workspace is optional.
            </span>
          </li>
        </ul>
        <p className="text-xs text-muted">
          Only you, as the owner, get the Individual upgrade. Members you invite keep their own plans. <Spec id="R-73" />
        </p>
      </div>
    </Modal>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

