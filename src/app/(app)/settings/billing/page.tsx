"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useFlows } from "@/components/flows";
import { IconCard, IconChevronRight, IconDownload, IconHistory, IconReceipt, IconSearch, IconUsers } from "@/components/Icons";
import { CardBrandBadge } from "@/components/payments";
import { SettingsHeader } from "@/components/SettingsHeader";
import { Spec, StatusPill } from "@/components/ui";
import { ENVELOPE_LIMIT, TEMPLATE_LIMIT } from "@/lib/catalog";
import { activeSubscription, brandLabel, cardExpiresBefore, currentPlanName, currentTier, graceDaysLeft, isPrepaidUser, planName, planPrice, prepaidEnd } from "@/lib/engine";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Invoice } from "@/lib/types";

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
    if (a === "authenticate" && sub?.status === "past_due") flows.open({ type: "authenticate" });
    if (a === "optin" && prepaid) flows.open({ type: "optin" });
    if (a === "card") flows.open({ type: "replaceCard" });
    router.replace("/settings/billing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div>
      <SettingsHeader icon={<IconReceipt size={22} />} title="Billing" subtitle="Manage your plan and payment details" />
      <div className="space-y-8 px-6 py-6 sm:px-10">
        <SubscriptionCard />

        <section>
          <h2 className="mb-3 text-[17px] font-medium text-ink">Usage limits</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UsageTile icon={<IconReceipt size={20} />} title="Envelopes sent" value={limitText(s.usage.envelopesSent, ENVELOPE_LIMIT[tier], "used this month", "sent this month")} />
            <UsageTile icon={<IconHistory size={20} />} title="Reusable templates" value={limitText(s.usage.templates, TEMPLATE_LIMIT[tier], "used", "saved")} />
            <UsageTile icon={<IconUsers size={20} />} title="Saved contacts" value={`${s.usage.contacts} saved · unlimited`} />
            <UsageTile
              icon={<IconUsers size={20} />}
              title="Team members"
              value={tier === "business" && sub ? `${s.workspace.members.length} of ${sub.seats} seats used` : tier === "enterprise" ? "Custom" : "1 (you) · Business adds seats"}
            />
          </div>
        </section>

        <PaymentMethodCard />
        <Invoices />
        <History />
        <SupportPanel />
      </div>
    </div>
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
  const tier = currentTier(s);

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
      status = <StatusPill tone="success">Active</StatusPill>;
      footer = (
        <span className="text-ink-2">
          Renews on <strong className="text-ink">{fmtDate(sub.currentPeriodEnd)}</strong> for <strong className="text-ink">{fmtMoney(amount)}</strong> on {cardText}
          {sub.tier === "business" ? ` · ${sub.seats} seat${sub.seats > 1 ? "s" : ""}` : ""}
        </span>
      );
    }
    if (sub.status !== "cancel_scheduled") {
      actions.push(
        <button key="cancel" className="btn-ghost text-ink-2" onClick={() => flows.open({ type: "cancel" })}>
          Cancel subscription
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
          <p className="font-display text-[34px] font-semibold text-ink">{tier === "free" ? "Free Plan" : currentPlanName(s)}</p>
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
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-medium text-ink">
        Payment method <Spec id="UX-17" />
      </h2>
      <div className="card flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
        {s.card ? (
          <>
            <CardBrandBadge brand={s.card.brand} />
            <div className="flex-1">
              <p className="text-[15px] font-medium text-ink">
                {brandLabel(s.card.brand)} ending {s.card.last4}
              </p>
              <p className="text-sm text-muted">
                Expires {String(s.card.expMonth).padStart(2, "0")}/{s.card.expYear}
                {expiring && <span className="ml-2 font-medium text-warn">Expires before your next renewal</span>}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center gap-3 text-ink-2">
            <IconCard size={20} /> No payment method on file
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => flows.open({ type: "replaceCard" })}>
            {s.card ? "Replace card" : "Add card"}
          </button>
          <Link href="/settings/billing/payment-method" className="btn-ghost">
            Manage
          </Link>
        </div>
      </div>
    </section>
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
              <th className="py-3 pr-4 font-semibold">Status</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted">
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
