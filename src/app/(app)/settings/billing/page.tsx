"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useFlows } from "@/components/flows";
import { IconCard, IconChevronRight, IconClock, IconDownload, IconHandover, IconHistory, IconLock, IconPlus, IconReceipt, IconRefresh, IconSearch, IconTrash, IconUsers } from "@/components/Icons";
import { WorkspaceAvatar } from "@/components/WorkspaceMenu";
import { CardBrandBadge } from "@/components/payments";
import { SettingsHeader } from "@/components/SettingsHeader";
import { Spec, StatusPill } from "@/components/ui";
import { BILL_LEAD_DAYS, TEMPLATE_LIMIT, regionMeta } from "@/lib/catalog";
import { activeSubscription, brandLabel, cardExpiresBefore, convertEligible, currentInterval, currentPlanName, currentSeats, currentTier, daysLeftInPeriod, graceDaysLeft, individualPlan, isIndonesia, isOneTimeUser, isPrepaidUser, methodLabel, openBill, planName, planPrice, prepaidEnd, regionOf, workspaceStatus, workspaceView, type WorkspaceView } from "@/lib/engine";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Bill, Invoice } from "@/lib/types";

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <Billing />
    </Suspense>
  );
}

function Billing() {
  const { s, api } = useAppState();
  const flows = useFlows();
  const params = useSearchParams();
  const router = useRouter();
  const sub = activeSubscription(s);
  const tier = currentTier(s);
  const prepaid = isPrepaidUser(s);

  // Deep links from emails (UX-18): one click lands on the action.
  useEffect(() => {
    const a = params.get("action");
    if (!a) return;
    if (a === "cancel" && sub && sub.status !== "cancel_scheduled") flows.open({ type: "cancel" });
    if (a === "resume" && sub?.status === "cancel_scheduled") flows.open({ type: "resume" });
    if (a === "undo" && sub?.scheduledChange) api.undoScheduledChange();
    if (a === "undo-seats" && sub?.pendingSeats != null) api.undoSeatChange();
    if (a === "authenticate" && sub?.status === "past_due") flows.open({ type: "authenticate" });
    if (a === "optin" && prepaid) flows.open({ type: "optin" });
    if (a === "card") flows.open({ type: "replaceCard" });
    if (a === "pay-bill") {
      const b = openBill(s);
      if (b) flows.open(b.status === "pending_payment" ? { type: "paymentDetail", billId: b.id } : { type: "payBill", billId: b.id });
    }
    if (a === "convert" && isOneTimeUser(s)) flows.open({ type: "convert" });
    router.replace("/settings/billing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const ws = workspaceView(s);
  const perk = ws.kind === "individual" && individualPlan(s) === "personal_plus";
  const member = ws.role === "member";

  const usage = (
    <section>
      <h2 className="mb-3 text-[17px] font-medium text-ink">Usage limits</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UsageTile
          icon={<IconReceipt size={20} />}
          title="Envelopes sent"
          value={ws.envelopeLimit === null ? `${ws.usage.envelopesSent} sent this month · unlimited${perk ? " (included with Business)" : ""}` : `${ws.usage.envelopesSent} of ${ws.envelopeLimit} used this month`}
        />
        <UsageTile icon={<IconHistory size={20} />} title="Reusable templates" value={limitText(ws.usage.templates, ws.kind === "individual" && !perk ? TEMPLATE_LIMIT[tier] : null, "used", "saved")} />
        <UsageTile icon={<IconUsers size={20} />} title="Saved contacts" value={`${ws.usage.contacts} saved · unlimited`} />
        <UsageTile
          icon={<IconUsers size={20} />}
          title="Team members"
          value={
            ws.kind === "individual"
              ? "1 (you) · invite people in a Business workspace"
              : ws.kind === "enterprise"
                ? "Custom"
                : member
                  ? `Managed by ${ws.ownerName}`
                  : sub
                    ? `${s.workspace.members.length} of ${sub.seats} seats used${sub.pendingSeats != null ? ` · ${sub.pendingSeats} from ${fmtDate(sub.currentPeriodEnd)}` : ""}`
                    : `${s.workspace.members.length} of ${currentSeats(s)} seats`
          }
        />
      </div>
    </section>
  );

  if (member) {
    return (
      <div>
        <SettingsHeader icon={<IconReceipt size={22} />} title="Billing" subtitle={`${ws.name} · managed by ${ws.ownerName}`} />
        <div className="space-y-8 px-6 py-6 sm:px-10">
          <MemberPlanCard ws={ws} />
          {usage}
        </div>
      </div>
    );
  }

  if (perk) {
    return (
      <div>
        <SettingsHeader icon={<IconReceipt size={22} />} title="Billing" subtitle="Your Individual workspace" />
        <div className="space-y-8 px-6 py-6 sm:px-10">
          <PerkCard />
          {usage}
          <History />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsHeader icon={<IconReceipt size={22} />} title="Billing" subtitle={ws.kind === "business" ? `${ws.name} · Business workspace` : "Manage your plan and payment details"} />
      <div className="space-y-8 px-6 py-6 sm:px-10">
        <SubscriptionCard />
        {usage}
        {ws.kind === "business" && <TeamMembers />}
        <Bills />
        <PaymentMethodCard />
        <Invoices />
        <History />
        <SupportPanel />
      </div>
    </div>
  );
}

/** Individual workspace of a Business owner: the plan is paid for in the Business workspace (R-73). */
function PerkCard() {
  const { s, api } = useAppState();
  const sub = activeSubscription(s);
  const pe = prepaidEnd(s);
  const until = sub ? sub.currentPeriodEnd : pe;
  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-b from-[#f2f2f2] to-white px-6 pt-5 pb-5">
        <p className="text-[15px] text-muted">Your subscription</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="font-display text-[34px] font-semibold text-ink">Personal</p>
          <StatusPill tone="success">Included with Business</StatusPill>
          <Spec id="R-73" />
        </div>
        <p className="mt-2 max-w-[760px] text-[15px] text-ink-2">
          Because you own the Business workspace <strong className="text-ink">{s.workspace.name}</strong>, this Individual workspace has everything in Personal with <strong className="text-ink">unlimited envelopes</strong>. Nothing is charged for it; it stays as long as your Business plan is active{until ? ` (currently until ${fmtDate(until)})` : ""}.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={() => api.switchWorkspace("business")}>
            Open {s.workspace.name}
          </button>
          <Link href="/settings/billing/change-plan" className="btn-ghost">
            See plans
          </Link>
        </div>
      </div>
      <div className="border-t border-line bg-[#f5f5f5] px-6 py-3 text-right text-sm text-ink-2">Invoices, payment methods, seats and cancellation live in the Business workspace billing page.</div>
    </section>
  );
}

/** Member of someone else's Business or Enterprise workspace: nothing to buy here (R-71). */
function MemberPlanCard({ ws }: { ws: WorkspaceView }) {
  const { s } = useAppState();
  const other = (s.otherWorkspaces ?? []).find((w) => w.id === ws.id);
  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-b from-[#f2f2f2] to-white px-6 pt-5 pb-5">
        <p className="text-[15px] text-muted">Workspace plan</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <WorkspaceAvatar w={ws} size={40} />
          <p className="font-display text-[34px] font-semibold text-ink">{ws.kind === "enterprise" ? "Enterprise" : "Business"}</p>
          <StatusPill tone={ws.status === "expired" ? "danger" : "success"}>{ws.status === "expired" ? `Expired${ws.expiredAt ? ` · ${fmtDate(ws.expiredAt)}` : ""}` : "Active"}</StatusPill>
          <Spec id="R-71" />
        </div>
        <p className="mt-2 max-w-[760px] text-[15px] text-ink-2">
          {ws.kind === "enterprise" ? (
            <>
              Billing for <strong className="text-ink">{ws.name}</strong> is handled under an Enterprise contract with {ws.ownerName}
              {other?.contractEnd ? ` (contract ${ws.status === "expired" ? "ended" : "runs until"} ${fmtDate(other.contractEnd)})` : ""}. There is no self-service plan here; renewals go through our sales team.
            </>
          ) : (
            <>
              <strong className="text-ink">{ws.ownerName}</strong> owns this workspace and pays for its seats. You are one of {other?.memberCount ?? 1} members. Your own Individual plan ({individualPlan(s) === "free" ? "Free" : "Personal"}) is not changed by this membership.
            </>
          )}
        </p>
        {ws.status === "expired" && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            <IconLock size={16} /> Read-only: view and download only until {ws.kind === "enterprise" ? "the contract is renewed" : "the owner reactivates the plan"}.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ws.kind === "enterprise" && <button className="btn-secondary">Contact sales</button>}
          <Link href="/plans" className="btn-ghost">
            Plans for your Individual workspace
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Owner view of the Business workspace members (R-78). Seats come from the subscription; invites are limited to the seat count. */
function TeamMembers() {
  const { s, api } = useAppState();
  const flows = useFlows();
  const members = s.workspace.members;
  const seats = currentSeats(s);
  const expired = workspaceStatus(s) === "expired";
  const free = Math.max(0, seats - members.length);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-medium text-ink">
          Team members <Spec id="R-78" />
        </h2>
        <div className="flex gap-2">
          {!expired && (
            <button className="btn-secondary !py-2" onClick={() => flows.open({ type: "seats" })}>
              Manage seats
            </button>
          )}
          <button className="btn-primary !py-2" disabled={expired || free === 0} onClick={() => flows.open({ type: "invite" })} title={expired ? "Read-only workspace" : free === 0 ? "All seats are in use. Add seats first." : undefined}>
            <IconPlus size={16} /> Invite member
          </button>
        </div>
      </div>
      <div className="card divide-y divide-line">
        {members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eeeeee] text-sm font-semibold text-ink-2">{m.name.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-ink">
                {m.name} {m.role === "owner" && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
              </p>
              <p className="text-sm text-muted">{m.email}</p>
            </div>
            <span className="chip bg-[#eeeeee] text-ink-2">{m.role === "owner" ? "Owner" : m.role === "admin" ? "Admin" : "Member"}</span>
            {m.role !== "owner" && (
              <button className="btn-ghost !py-1.5 text-xs text-ink-2" disabled={expired} onClick={() => api.removeMember(m.id)}>
                <IconTrash size={14} /> Remove
              </button>
            )}
          </div>
        ))}
        <div className="px-5 py-3 text-sm text-muted">
          {members.length} of {seats} seats in use{free > 0 ? ` · ${free} free seat${free > 1 ? "s" : ""} (still billed)` : " · add seats to invite more people"}. Removing a member frees the seat but does not change your bill until you reduce seats.
        </div>
      </div>
    </section>
  );
}

function limitText(used: number, limit: number | null, usedWord: string, unlimitedWord: string): string {
  return limit === null ? `${used} ${unlimitedWord} · unlimited` : `${used} of ${limit} ${usedWord}`;
}

function SubscriptionCard() {
  const { s, api } = useAppState();
  const flows = useFlows();
  const sub = activeSubscription(s);
  const prepaid = isPrepaidUser(s);
  const oneTime = isOneTimeUser(s);
  const tier = currentTier(s);
  const indonesia = isIndonesia(s);
  const bill = openBill(s);

  let status: React.ReactNode = null;
  let footer: React.ReactNode = <span className="text-ink-2">Free</span>;
  const actions: React.ReactNode[] = [];

  if (sub) {
    const amount = planPrice(sub.tier, sub.interval, sub.seats);
    const cardText = s.card ? `${brandLabel(s.card.brand)} ending ${s.card.last4}` : "no card on file";
    if (sub.status === "past_due") {
      const left = graceDaysLeft(s) ?? 0;
      status = <StatusPill tone="danger">Payment failed · {left} days of access left</StatusPill>;
      footer = (
        <span className="text-danger">
          Renewal of {fmtMoney(amount)} due since {fmtDate(sub.currentPeriodEnd)}. Full access until {fmtDate(sub.graceEndsAt!)}.
        </span>
      );
      actions.push(
        <button key="card" className="btn-primary" onClick={() => flows.open({ type: sub.pendingAuthAmount ? "authenticate" : "replaceCard" })}>
          {sub.pendingAuthAmount ? "Confirm with your bank" : "Update payment method"}
        </button>
      );
    } else if (sub.status === "cancel_scheduled") {
      status = <StatusPill tone="warn">Cancelled · ends {fmtDate(sub.currentPeriodEnd)}</StatusPill>;
      footer = <span className="text-ink-2">No further charges. Full access until {fmtDate(sub.currentPeriodEnd)}.</span>;
      actions.push(
        <button key="resume" className="btn-primary" onClick={() => flows.open({ type: "resume" })}>
          Resume subscription
        </button>
      );
    } else if (sub.status === "change_scheduled" && sub.scheduledChange) {
      const c = sub.scheduledChange;
      status = <StatusPill tone="info">Changing to {planName(c.tier, c.interval)} on {fmtDate(c.effectiveAt)}</StatusPill>;
      footer = (
        <span className="text-ink-2">
          Current plan until {fmtDate(c.effectiveAt)}. Then {fmtMoney(planPrice(c.tier, c.interval, c.seats))} per {c.interval === "monthly" ? "month" : "year"} on {cardText}.
        </span>
      );
      actions.push(
        <button key="undo" className="btn-secondary" onClick={() => api.undoScheduledChange()}>
          Keep my current plan
        </button>
      );
    } else {
      status = <StatusPill tone="success">{indonesia ? "Active · auto-renewal" : "Active"}</StatusPill>;
      footer = (
        <span className="text-ink-2">
          Renews on <strong className="text-ink">{fmtDate(sub.currentPeriodEnd)}</strong> for <strong className="text-ink">{fmtMoney(sub.pendingSeats != null ? planPrice(sub.tier, sub.interval, sub.pendingSeats) : amount)}</strong> on {cardText}
          {sub.tier === "business" ? ` · ${sub.seats} seat${sub.seats > 1 ? "s" : ""}${sub.pendingSeats != null ? ` until then, ${sub.pendingSeats} after` : ""}` : ""}
        </span>
      );
    }
    if (sub.tier === "business" && sub.status !== "cancel_scheduled") {
      actions.push(
        <button key="seats" className="btn-secondary" onClick={() => flows.open({ type: "seats" })}>
          Manage seats{sub.pendingSeats != null ? ` (${sub.seats} → ${sub.pendingSeats} on ${fmtDate(sub.currentPeriodEnd)})` : ""}
        </button>
      );
    }
    if (sub.status !== "cancel_scheduled") {
      actions.push(
        <button key="cancel" className="btn-ghost text-ink-2" onClick={() => flows.open({ type: "cancel" })}>
          Cancel subscription
        </button>
      );
    }
  } else if (workspaceStatus(s) === "expired" && (s.activeWorkspace ?? "individual") === "business") {
    const ended = s.workspace.expiredAt;
    status = <StatusPill tone="danger">Expired · read-only{ended ? ` since ${fmtDate(ended)}` : ""}</StatusPill>;
    footer = (
      <span className="text-danger">
        The Business plan ended{ended ? ` on ${fmtDate(ended)}` : ""}. Envelopes can be viewed and downloaded only. Reactivate to start a new billing period today, or hand the documents over to your Individual workspace. <Spec id="R-72" />
      </span>
    );
    actions.push(
      <button key="react" className="btn-primary" onClick={() => flows.open({ type: "plan", tier: "business", interval: "monthly", seats: Math.max(1, s.workspace.members.length) })}>
        <IconRefresh size={16} /> Reactivate Business
      </button>
    );
    if ((s.workspace.documents ?? []).length > 0) {
      actions.push(
        <button key="handover" className="btn-secondary" onClick={() => flows.open({ type: "handover" })}>
          <IconHandover size={16} /> Hand over documents
        </button>
      );
    }
  } else if (oneTime) {
    const pe = prepaidEnd(s)!;
    const left = daysLeftInPeriod(s) ?? 0;
    const last = s.prepaid!.periods.find((p) => p.end === pe);
    status = <StatusPill tone={left <= 3 ? "warn" : "neutral"}>One-time · expires {fmtDate(pe)}</StatusPill>;
    footer = (
      <span className="text-ink-2">
        Paid until <strong className="text-ink">{fmtDate(pe)}</strong> ({last?.paidWithLabel ?? "one-time payment"}). No automatic renewal: {bill ? `your bill for the next period is ${bill.status === "pending_payment" ? "waiting for payment" : "ready"}.` : `a bill is sent ${BILL_LEAD_DAYS} days before expiry.`} <Spec id="R-63" />
      </span>
    );
    if (bill) {
      actions.push(
        <button key="pay" className="btn-primary" onClick={() => flows.open(bill.status === "pending_payment" ? { type: "paymentDetail", billId: bill.id } : { type: "payBill", billId: bill.id })}>
          {bill.status === "pending_payment" ? "Continue payment" : `Pay ${fmtMoney(bill.amount)} bill`}
        </button>
      );
    } else {
      actions.push(
        <button key="buy" className="btn-primary" onClick={() => flows.open({ type: "plan", tier: s.prepaid!.tier, interval: currentInterval(s) ?? "monthly", seats: currentSeats(s) })}>
          Buy next period
        </button>
      );
    }
    if (convertEligible(s)) {
      actions.push(
        <button key="convert" className="btn-secondary" onClick={() => flows.open({ type: "convert" })}>
          <IconRefresh size={16} /> Turn on auto-renewal
        </button>
      );
    }
  } else if (prepaid) {
    const pe = prepaidEnd(s)!;
    status = <StatusPill tone="neutral">Prepaid · until {fmtDate(pe)}</StatusPill>;
    footer = <span className="text-ink-2">Paid until {fmtDate(pe)} (one-off purchase). No card on file. Auto-renewal is off.</span>;
    actions.push(
      <button key="optin" className="btn-primary" onClick={() => flows.open({ type: "optin" })}>
        Turn on auto-renewal
      </button>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-b from-[#f2f2f2] to-white px-6 pt-5 pb-5">
        <p className="text-[15px] text-muted">Your subscription</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="font-display text-[34px] font-semibold text-ink">{workspaceStatus(s) === "expired" && (s.activeWorkspace ?? "individual") === "business" ? "Business" : tier === "free" ? "Free Plan" : currentPlanName(s)}</p>
          {status}
          <Spec id="UX-01" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/settings/billing/change-plan" className="flex items-center gap-1 text-[15px] font-medium text-maroon underline underline-offset-2">
            Change plan <IconChevronRight size={16} />
          </Link>
          {actions}
        </div>
      </div>
      <div className="border-t border-line bg-[#f5f5f5] px-6 py-3 text-right text-sm">{footer}</div>
    </section>
  );
}

function UsageTile({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="card flex items-start gap-3 px-5 py-5">
      <span className="text-ink-2">{icon}</span>
      <div>
        <p className="text-[17px] font-medium text-ink">{title}</p>
        <p className="text-[15px] text-muted">{value}</p>
      </div>
    </div>
  );
}

function PaymentMethodCard() {
  const { s } = useAppState();
  const flows = useFlows();
  const sub = activeSubscription(s);
  const expiring = sub && s.card && cardExpiresBefore(s.card, sub.currentPeriodEnd);
  const backups = s.backupCards ?? [];
  const oneTime = isOneTimeUser(s);
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-medium text-ink">
        Payment methods <Spec id="UX-17" />
      </h2>
      {oneTime && (
        <div className="card mb-3 flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <span className="text-ink-2">
            <IconRefresh size={20} />
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-medium text-ink">Automatic renewal is off</p>
            <p className="text-sm text-muted">
              You pay each period yourself. Switch to automatic renewal with a card and we charge it on {fmtDate(prepaidEnd(s)!)} and every period after, with a 14-day grace period if a payment ever fails. <Spec id="R-66" />
            </p>
          </div>
          <button className="btn-secondary" onClick={() => flows.open({ type: "convert" })}>
            Turn on auto-renewal
          </button>
        </div>
      )}
      <div className="card flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
        {s.card ? (
          <>
            <CardBrandBadge brand={s.card.brand} />
            <div className="flex-1">
              <p className="text-[15px] font-medium text-ink">
                {brandLabel(s.card.brand)} ending {s.card.last4} <span className="ml-1 text-xs font-normal text-muted">Default</span>
              </p>
              <p className="text-sm text-muted">
                Expires {String(s.card.expMonth).padStart(2, "0")}/{s.card.expYear}
                {expiring && <span className="ml-2 font-medium text-warn">Expires before your next renewal</span>}
                {oneTime ? " · saved for paying bills faster" : backups.length > 0 ? ` · ${backups.length} backup card${backups.length > 1 ? "s" : ""} (ending ${backups.map((b) => b.last4).join(", ")})` : " · no backup card"}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center gap-3 text-ink-2">
            <IconCard size={20} /> No payment method on file
          </div>
        )}
        <div className="flex gap-2">
          {s.card && (
            <button className="btn-secondary" onClick={() => flows.open({ type: "addCard", makeDefault: false })}>
              Add backup card
            </button>
          )}
          {!s.card && (
            <button className="btn-secondary" onClick={() => flows.open({ type: "addCard", makeDefault: true })}>
              Add card
            </button>
          )}
          <Link href="/settings/billing/payment-method" className="btn-ghost">
            Manage
          </Link>
        </div>
      </div>
    </section>
  );
}

function Bills() {
  const { s, api } = useAppState();
  const flows = useFlows();
  const bills = [...(s.bills ?? [])].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  if (bills.length === 0 && !isIndonesia(s)) return null;
  const open = openBill(s);
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-medium text-ink">
        Bills <Spec id="R-64" />
      </h2>
      {open ? <BillRow bill={open} onPay={() => flows.open(open.status === "pending_payment" ? { type: "paymentDetail", billId: open.id } : { type: "payBill", billId: open.id })} onCancel={open.payment ? () => api.cancelPayment(open.id) : undefined} highlight /> : (
        <div className="card px-5 py-4 text-sm text-ink-2">
          No bill waiting for payment.{" "}
          {isOneTimeUser(s) ? `Your next bill is issued ${BILL_LEAD_DAYS} days before ${fmtDate(prepaidEnd(s)!)}.` : activeSubscription(s) ? "Your plan renews automatically, so there is nothing to pay by hand." : "Buy a plan to get started."}
        </div>
      )}
      {bills.filter((b) => b !== open).length > 0 && (
        <div className="card mt-3 divide-y divide-line">
          {bills
            .filter((b) => b !== open)
            .slice(0, 6)
            .map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-24 text-muted">{fmtDate(b.issuedAt)}</span>
                <span className="flex-1 text-ink">
                  {b.kind === "renewal" ? "Renewal bill" : "Purchase"} · {planName(b.tier, b.interval)}
                  {b.tier === "business" ? ` · ${b.seats} seat${b.seats > 1 ? "s" : ""}` : ""} · {fmtDate(b.periodStart)} to {fmtDate(b.periodEnd)}
                </span>
                <span className="text-ink">{fmtMoney(b.amount)}</span>
                {b.status === "paid" && <StatusPill tone="success">Paid{b.payment ? ` · ${methodLabel(b.payment.method, b.payment.bank, b.payment.cardLast4)}` : ""}</StatusPill>}
                {b.status === "expired" && <StatusPill tone="danger">Expired unpaid</StatusPill>}
                {b.status === "void" && <StatusPill tone="neutral">Void</StatusPill>}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

function BillRow({ bill, onPay, onCancel, highlight }: { bill: Bill; onPay: () => void; onCancel?: () => void; highlight?: boolean }) {
  const { s } = useAppState();
  const daysToDue = Math.max(0, Math.ceil((new Date(bill.dueAt).getTime() - new Date(s.now).getTime()) / 86400000));
  const pending = bill.status === "pending_payment" && bill.payment;
  return (
    <div className={`card flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center ${highlight ? "border-warn" : ""}`}>
      <span className="text-warn">
        <IconClock size={22} />
      </span>
      <div className="flex-1">
        <p className="text-[15px] font-medium text-ink">
          {bill.kind === "renewal" ? "Renewal bill" : "Purchase"} · {planName(bill.tier, bill.interval)}
          {bill.tier === "business" ? ` · ${bill.seats} seat${bill.seats > 1 ? "s" : ""}` : ""} · {fmtMoney(bill.amount)}
        </p>
        <p className="text-sm text-muted">
          Covers {fmtDate(bill.periodStart)} to {fmtDate(bill.periodEnd)}. Pay by <strong className="text-ink">{fmtDate(bill.dueAt)}</strong> ({daysToDue === 0 ? "today" : `${daysToDue} day${daysToDue > 1 ? "s" : ""} left`}) or the plan ends on that day. No grace period for one-time payments.
          {pending && (
            <>
              {" "}
              Payment ID <span className="font-mono text-ink">{bill.payment!.paymentId}</span> via {methodLabel(bill.payment!.method, bill.payment!.bank, bill.payment!.cardLast4)} is open until {fmtDateTime(bill.payment!.expiresAt)}.
            </>
          )}{" "}
          {regionMeta(regionOf(s)).taxNote === "includes PPN" ? "Includes PPN." : ""}
        </p>
      </div>
      <div className="flex gap-2">
        {pending && onCancel && (
          <button className="btn-ghost text-ink-2" onClick={onCancel}>
            Cancel Payment ID
          </button>
        )}
        <button className="btn-primary" onClick={onPay}>
          {pending ? "Continue payment" : "Pay now"}
        </button>
      </div>
    </div>
  );
}

function Invoices() {
  const { s } = useAppState();
  const [status, setStatus] = useState<"all" | Invoice["status"]>("all");
  const [q, setQ] = useState("");
  const rows = useMemo(
    () => s.invoices.filter((i) => (status === "all" || i.status === status) && (!q || i.number.toLowerCase().includes(q.toLowerCase()) || i.description.toLowerCase().includes(q.toLowerCase()))),
    [s.invoices, status, q]
  );
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-medium text-ink">Invoices</h2>
        <div className="flex gap-2">
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All status</option>
            <option value="paid">Paid</option>
            <option value="open">Unpaid</option>
            <option value="void">Void</option>
            <option value="refunded">Refunded</option>
          </select>
          <div className="relative">
            <input className="input !w-56 pr-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <IconSearch size={16} className="pointer-events-none absolute right-3 top-3 text-muted" />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-ink">
              <th className="py-3 pr-4 font-semibold">Invoice date</th>
              <th className="py-3 pr-4 font-semibold">Invoice number</th>
              <th className="py-3 pr-4 font-semibold">Description</th>
              <th className="py-3 pr-4 font-semibold">Due date</th>
              <th className="py-3 pr-4 font-semibold">Amount</th>
              <th className="py-3 pr-4 font-semibold">Method</th>
              <th className="py-3 pr-4 font-semibold">Status</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted">
                  No invoices yet.
                </td>
              </tr>
            )}
            {rows.map((i) => (
              <tr key={i.id} className="border-b border-line">
                <td className="py-4 pr-4 text-ink">{fmtDate(i.date)}</td>
                <td className="py-4 pr-4 text-ink">{i.number}</td>
                <td className="py-4 pr-4 text-sm text-ink-2">{i.description}</td>
                <td className="py-4 pr-4 text-ink">{fmtDate(i.dueDate)}</td>
                <td className="py-4 pr-4 text-ink">{fmtMoney(i.amount)}</td>
                <td className="py-4 pr-4 text-sm text-ink-2">{i.method ?? (s.card ? `Card ending ${s.card.last4}` : "Card")}</td>
                <td className="py-4 pr-4">
                  {i.status === "paid" && <StatusPill tone="success">Paid</StatusPill>}
                  {i.status === "open" && <StatusPill tone="warn">Unpaid</StatusPill>}
                  {i.status === "void" && <StatusPill tone="neutral">Void</StatusPill>}
                  {i.status === "refunded" && <StatusPill tone="info">Refunded</StatusPill>}
                </td>
                <td className="py-4 text-right">
                  <button className="rounded p-1.5 text-ink-2 hover:bg-page" aria-label="Download invoice PDF">
                    <IconDownload size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-ink-2">
        <span>Page 1 of 1</span>
        <span className="flex items-center gap-3">
          Show rows <span className="rounded border border-line px-3 py-1">10</span>
          <span className="text-muted">First ‹ › Last</span>
        </span>
      </div>
    </section>
  );
}

function History() {
  const { s } = useAppState();
  if (s.history.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-medium text-ink">
        Plan history <Spec id="UX-20" />
      </h2>
      <div className="card divide-y divide-line">
        {s.history.slice(0, 12).map((h) => (
          <div key={h.id} className="flex gap-4 px-5 py-3.5">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${h.type === "renewal_failed" || h.type === "ended" ? "bg-danger" : h.type.includes("scheduled") ? "bg-info" : "bg-success"}`} />
            <div className="flex-1">
              <p className="text-[15px] text-ink">{h.title}</p>
              {h.detail && <p className="text-sm text-muted">{h.detail}</p>}
            </div>
            <span className="shrink-0 text-xs text-muted">{fmtDateTime(h.at)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SupportPanel() {
  const { s } = useAppState();
  const [open, setOpen] = useState(false);
  const sub = s.subscription;
  return (
    <section className="rounded-xl border border-dashed border-line-2 p-4 text-sm">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <span className="font-medium text-ink">For support and engineering (prototype only): payment attempts and consent records</span>
        <IconChevronRight size={16} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Payment attempts (R-10)</p>
            {!sub || sub.attempts.length === 0 ? (
              <p className="text-muted">None.</p>
            ) : (
              <ul className="space-y-1 font-mono text-[12px] text-ink-2">
                {sub.attempts.map((a) => (
                  <li key={a.id}>
                    {fmtDate(a.at)} · #{a.attemptNo} · {fmtMoney(a.amount)} · {a.outcome}
                    {a.declineCode ? ` (${a.declineCode})` : ""} · {a.onSession ? "on-session" : "off-session"}
                  </li>
                ))}
              </ul>
            )}
            {sub && (
              <p className="mt-3 font-mono text-[12px] text-muted">
                status={sub.status} · anchorDay={sub.anchorDay} · period={fmtDate(sub.currentPeriodStart)}→{fmtDate(sub.currentPeriodEnd)}
                {sub.graceEndsAt ? ` · graceEndsAt=${fmtDate(sub.graceEndsAt)}` : ""}
                {sub.nextRetryAt ? ` · nextRetry=${fmtDate(sub.nextRetryAt)}` : ""}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Consent records (R-09)</p>
            {s.consents.length === 0 ? (
              <p className="text-muted">None.</p>
            ) : (
              <ul className="space-y-2 text-[12px] text-ink-2">
                {s.consents.map((c) => (
                  <li key={c.id} className="rounded bg-page p-2">
                    <span className="font-mono text-muted">
                      {fmtDateTime(c.at)} · {c.source} · {c.ip}
                    </span>
                    <br />
                    {c.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
