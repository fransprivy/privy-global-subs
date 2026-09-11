"use client";

import Link from "next/link";
import { activeSubscription, cardExpiresBefore, graceDaysLeft, isPrepaidUser, planName, planPrice, prepaidEnd } from "@/lib/engine";
import { daysBetween, fmtDate, fmtMoney, startOfDayUTC } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { useFlows } from "./flows";
import { IconCard, IconClock, IconHandover, IconInfo, IconWarning } from "./Icons";
import { Spec } from "./ui";

/** B-01 to B-04 from the notification catalogue. Rendered on every app page under the top nav. */
export function Banners() {
  const { s, api } = useAppState();
  const flows = useFlows();
  const sub = activeSubscription(s);
  const items: React.ReactNode[] = [];

  if (sub && sub.status === "past_due") {
    const left = graceDaysLeft(s) ?? 0;
    const day = 14 - left;
    const red = day >= 12;
    const needsAuth = !!sub.pendingAuthAmount;
    items.push(
      <Banner key="b01" tone={red ? "danger" : "warn"} icon={<IconWarning size={20} />} spec="B-01">
        <div className="flex-1">
          <p className="font-semibold">
            {needsAuth ? `Your bank needs you to confirm the renewal of ${planName(sub.tier, sub.interval)}.` : `We could not renew your ${planName(sub.tier, sub.interval)}.`}{" "}
            You have <strong>{left} day{left === 1 ? "" : "s"}</strong> of full access left.
          </p>
          <p className="text-xs opacity-80">
            {sub.hardDeclined
              ? "Your card cannot be used anymore; we will not retry it. Add a new card to keep your plan."
              : needsAuth
                ? "Confirm with your bank and your plan continues with the same billing date."
                : sub.nextRetryAt
                  ? `Next automatic retry ${fmtDate(sub.nextRetryAt)}. Update your card and we retry right away.`
                  : "Update your card and we retry right away."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sub.tier === "business" && day >= 7 && (
            <button className="btn-secondary !py-1.5 text-xs" onClick={() => flows.open({ type: "handover" })}>
              <IconHandover size={14} /> Hand over documents
            </button>
          )}
          {needsAuth ? (
            <button className="btn-primary !py-1.5 text-xs" onClick={() => flows.open({ type: "authenticate" })}>
              Confirm with your bank
            </button>
          ) : (
            <button className="btn-primary !py-1.5 text-xs" onClick={() => flows.open({ type: "replaceCard" })}>
              <IconCard size={14} /> Update payment method
            </button>
          )}
        </div>
      </Banner>
    );
  }

  if (sub && sub.status === "change_scheduled" && sub.scheduledChange) {
    const c = sub.scheduledChange;
    items.push(
      <Banner key="b02" tone="info" icon={<IconClock size={20} />} spec="B-02">
        <div className="flex-1">
          <p className="font-semibold">
            Your plan changes to {planName(c.tier, c.interval)} on {fmtDate(c.effectiveAt)}.
          </p>
          <p className="text-xs opacity-80">
            You keep {planName(sub.tier, sub.interval)} until then. From {fmtDate(c.effectiveAt)} you pay {fmtMoney(planPrice(c.tier, c.interval, c.seats))} per {c.interval === "monthly" ? "month" : "year"}.
            {c.kind === "downgrade" && sub.tier === "business" && " Team members lose access on that date."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.kind === "downgrade" && sub.tier === "business" && (
            <button className="btn-secondary !py-1.5 text-xs" onClick={() => flows.open({ type: "handover" })}>
              <IconHandover size={14} /> Hand over documents
            </button>
          )}
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => api.undoScheduledChange()}>
            Keep my current plan
          </button>
        </div>
      </Banner>
    );
  }

  if (sub && sub.pendingSeats != null && sub.status !== "cancel_scheduled") {
    items.push(
      <Banner key="b02s" tone="info" icon={<IconClock size={20} />} spec="B-02">
        <div className="flex-1">
          <p className="font-semibold">
            Your seats change from {sub.seats} to {sub.pendingSeats} on {fmtDate(sub.currentPeriodEnd)}.
          </p>
          <p className="text-xs opacity-80">
            You keep {sub.seats} seats until then. From {fmtDate(sub.currentPeriodEnd)} you pay {fmtMoney(planPrice(sub.tier, sub.interval, sub.pendingSeats))} per {sub.interval === "monthly" ? "month" : "year"}. Nothing is refunded for the current period.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => flows.open({ type: "seats" })}>
            Change
          </button>
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => api.undoSeatChange()}>
            Keep my {sub.seats} seats
          </button>
        </div>
      </Banner>
    );
  }

  if (sub && sub.status === "cancel_scheduled") {
    items.push(
      <Banner key="b02c" tone="info" icon={<IconClock size={20} />} spec="B-02">
        <div className="flex-1">
          <p className="font-semibold">
            Your {planName(sub.tier, sub.interval)} ends on {fmtDate(sub.currentPeriodEnd)}. No further charges.
          </p>
          <p className="text-xs opacity-80">You keep full access until then. Resume any time before that date with one click.</p>
        </div>
        <button className="btn-primary !py-1.5 text-xs" onClick={() => flows.open({ type: "resume" })}>
          Resume subscription <Spec id="UX-12" />
        </button>
      </Banner>
    );
  }

  if (isPrepaidUser(s) && !s.optInDismissed) {
    const pe = prepaidEnd(s)!;
    items.push(
      <Banner key="b03" tone="neutral" icon={<IconInfo size={20} />} spec="B-03">
        <div className="flex-1">
          <p className="font-semibold">Your {planName(s.prepaid!.tier)} plan is paid until {fmtDate(pe)}.</p>
          <p className="text-xs opacity-80">Turn on auto-renewal so you never lose access. Nothing is charged until {fmtDate(pe)}.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => api.dismissOptIn()}>
            Later
          </button>
          <button className="btn-primary !py-1.5 text-xs" onClick={() => flows.open({ type: "optin" })}>
            Turn on auto-renewal
          </button>
        </div>
      </Banner>
    );
  }

  if (sub && (sub.status === "active" || sub.status === "change_scheduled") && s.card && cardExpiresBefore(s.card, sub.currentPeriodEnd)) {
    const dl = daysBetween(startOfDayUTC(s.now), sub.currentPeriodEnd);
    if (dl <= 14) {
      items.push(
        <Banner key="b04" tone="warn" icon={<IconCard size={20} />} spec="B-04">
          <div className="flex-1">
            <p className="font-semibold">
              Your card ending {s.card.last4} expires before your next renewal on {fmtDate(sub.currentPeriodEnd)}.
            </p>
            <p className="text-xs opacity-80">Update it now to avoid an interruption.</p>
          </div>
          <button className="btn-primary !py-1.5 text-xs" onClick={() => flows.open({ type: "replaceCard" })}>
            Update card
          </button>
        </Banner>
      );
    }
  }

  if (items.length === 0) return null;
  return <div className="mx-auto w-full max-w-[1600px] space-y-2 px-4 pt-4 sm:px-8">{items}</div>;
}

function Banner({ tone, icon, spec, children }: { tone: "warn" | "danger" | "info" | "neutral"; icon: React.ReactNode; spec: string; children: React.ReactNode }) {
  const styles = {
    warn: "border-[#f3d9a4] bg-warn-tint text-[#7a4b00]",
    danger: "border-[#f2b0b0] bg-danger-tint text-danger",
    info: "border-[#bfd9ee] bg-info-tint text-[#124a7a]",
    neutral: "border-line bg-white text-ink",
  };
  return (
    <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center ${styles[tone]}`}>
      <span className="shrink-0">{icon}</span>
      {children}
      <Spec id={spec} />
    </div>
  );
}

export function CheckoutOpenNotice({ tier }: { tier: string }) {
  return (
    <div className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-white px-5 py-4">
      <IconCard size={22} className="text-ink-2" />
      <div>
        <p className="text-[17px] font-medium text-ink">A checkout is still open</p>
        <p className="text-sm text-ink-2">The change to {tier} has not been paid for yet.</p>
      </div>
      <Link href="#" className="ml-auto hidden text-sm font-medium text-maroon underline sm:inline">
        Continue
      </Link>
    </div>
  );
}
