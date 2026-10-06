"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buildLabel } from "@/lib/build";
import { regionMeta } from "@/lib/catalog";
import { activeSubscription, activeWorkspaceId, ipLocked, isPromoUser, allWorkspaces, CONFIG, isOneTimeUser, openBill, pendingPayment, prepaidEnd, regionOf } from "@/lib/engine";
import { addDays, daysBetween, fmtDate, fmtDateTime, startOfDayUTC } from "@/lib/format";
import { IP_HOME, IP_OFFICE, SCENARIOS } from "@/lib/scenarios";
import { useAppState } from "@/lib/store";
import type { CardBehavior, Region } from "@/lib/types";
import { IconClose, IconMail, IconRefresh, IconSliders } from "./Icons";
import { RegionSelect } from "./onetime";

export function PrototypeControls() {
  const { s, api } = useAppState();
  const open = s.ui.controlsOpen;
  const guideOpen = s.ui.guideOpen ?? true;
  const rightOffset = guideOpen ? "lg:right-[376px] right-4" : "right-4";
  const sub = activeSubscription(s);
  const pe = prepaidEnd(s);
  const today = startOfDayUTC(s.now);
  const region = regionMeta(regionOf(s));
  const pending = pendingPayment(s);
  const bill = openBill(s);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "." && (e.metaKey || e.ctrlKey)) api.setControlsOpen(!open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, api]);

  const nextEvent = (() => {
    if (sub?.status === "past_due" && sub.graceEndsAt) {
      if (sub.nextRetryAt && daysBetween(today, sub.nextRetryAt) > 0) return { label: `next retry (${fmtDate(sub.nextRetryAt)})`, iso: sub.nextRetryAt };
      return { label: `end of grace (${fmtDate(sub.graceEndsAt)})`, iso: sub.graceEndsAt };
    }
    if (sub) return { label: `${sub.status === "cancel_scheduled" ? "plan end" : sub.scheduledChange ? "scheduled change" : "next renewal"} (${fmtDate(sub.currentPeriodEnd)})`, iso: sub.currentPeriodEnd };
    if (pe && isOneTimeUser(s) && !bill && daysBetween(today, pe) > CONFIG.billLeadDays) return { label: `bill day (${fmtDate(addDays(pe, -CONFIG.billLeadDays))})`, iso: addDays(pe, -CONFIG.billLeadDays) };
    if (pe && isOneTimeUser(s)) return { label: `plan expiry (${fmtDate(pe)})`, iso: pe };
    if (pe && isPromoUser(s)) return { label: `end of free period (${fmtDate(pe)})`, iso: pe };
    if (pe) return { label: `end of prepaid time (${fmtDate(pe)})`, iso: pe };
    return null;
  })();

  const behaviors: { v: CardBehavior; label: string }[] = [
    { v: "success", label: "Succeed" },
    { v: "soft_decline", label: "Soft decline" },
    { v: "hard_decline", label: "Hard decline" },
    { v: "requires_action", label: "Needs 3DS" },
  ];

  return (
    <>
      <button
        onClick={() => api.setControlsOpen(!open)}
        className={`fixed bottom-4 ${rightOffset} z-[55] flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-black`}
        aria-label="Prototype controls"
      >
        <IconSliders size={16} /> Prototype
      </button>
      {open && (
        <div className={`fixed bottom-16 ${rightOffset} z-[55] w-[min(380px,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-2xl border border-line bg-white p-4 text-sm shadow-2xl`}>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-base font-semibold text-ink">Prototype controls</p>
            <button className="rounded p-1 text-muted hover:bg-page" onClick={() => api.setControlsOpen(false)} aria-label="Close">
              <IconClose size={18} />
            </button>
          </div>

          <Section title="Scenario">
            <select className="input" value={s.scenarioId} onChange={(e) => api.selectScenario(e.target.value)}>
              {SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.title}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <button className="btn-secondary !py-1.5 text-xs" onClick={() => api.reset()}>
                <IconRefresh size={14} /> Reset scenario
              </button>
              <Link href="/" className="btn-ghost !py-1.5 text-xs">
                All scenarios
              </Link>
            </div>
          </Section>

          <Section title="Workspace">
            <select className="input" value={activeWorkspaceId(s)} onChange={(e) => api.switchWorkspace(e.target.value)}>
              {allWorkspaces(s).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.kind === "individual" ? "Individual" : w.kind === "business" ? "Pro" : "Enterprise"}
                  {w.role === "member" ? " (member)" : ""}
                  {w.status === "expired" ? " · expired" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">Same as the avatar menu at the top right.</p>
          </Section>

          <Section title={`Region: ${region.flag} ${region.name} (${region.currency})`}>
            <RegionSelect value={regionOf(s)} onChange={(v) => api.setRegion(v as Region)} />
            <p className="mt-1 text-xs text-muted">
              {region.market === "indonesia" ? "Indonesia: one-time (QRIS, card, virtual account) or auto-renewal (card). Prices in IDR, includes PPN." : "Global: auto-renewal on a card only. Prices in AUD, after tax."} Same as Settings › Workspace preferences.
            </p>
          </Section>

          <Section title={`Simulated date: ${fmtDate(s.now)}`}>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary !py-1.5 text-xs" onClick={() => api.advanceDays(1)}>
                +1 day
              </button>
              <button className="btn-secondary !py-1.5 text-xs" onClick={() => api.advanceDays(7)}>
                +7 days
              </button>
              {nextEvent && (
                <button className="btn-primary !py-1.5 text-xs" onClick={() => api.advanceTo(addDays(nextEvent.iso, 0))}>
                  Jump to {nextEvent.label}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">The renewal sweep runs once per simulated day (00:00 UTC charges, reminders at T-30 / T-7, retries Day {CONFIG.retryOffsetsDays.join("/")}, grace {CONFIG.graceDays} days).</p>
          </Section>

          <Section title="Next automatic charge outcome">
            <div className="flex flex-wrap gap-1.5">
              {behaviors.map((b) => (
                <button
                  key={b.v}
                  onClick={() => api.setNextChargeOverride(s.nextChargeOverride === b.v ? null : b.v)}
                  className={`rounded-full border px-3 py-1 text-xs ${s.nextChargeOverride === b.v ? "border-ink bg-ink text-white" : "border-line-2 text-ink-2 hover:bg-page"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              Default: the saved card's behaviour ({s.card ? `card ending ${s.card.last4}: ${s.card.behavior.replace("_", " ")}` : "no card: hard decline"}).
            </p>
          </Section>

          {(pending || region.market === "indonesia") && (
            <Section title="One-time payments">
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary !py-1.5 text-xs" disabled={!pending} onClick={() => pending && api.confirmPayment(pending.id)}>
                  Simulate payment received
                </button>
                <button className="btn-secondary !py-1.5 text-xs" disabled={!pending} onClick={() => pending && api.cancelPayment(pending.id)}>
                  Expire / cancel Payment ID
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">
                {pending ? `Open: ${pending.payment?.paymentId} for ${pending.payment?.method.toUpperCase()}${pending.payment?.bank ? ` ${pending.payment.bank}` : ""}. "Received" is what the payment gateway webhook would send.` : bill ? `Bill ${bill.id} is waiting; open it from Billing to create a Payment ID.` : "No Payment ID open. Bills appear 7 days before a one-time plan expires."}
              </p>
            </Section>
          )}

          {s.vouchers && (
            <Section title="Voucher codes">
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
                {s.vouchers.codes.map((c) => {
                  const expired = s.now >= c.redeemBy;
                  const full = c.used >= c.maxRedemptions;
                  return (
                    <div key={c.id} className="rounded-lg border border-line px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          className="truncate font-mono text-xs font-semibold text-ink hover:underline"
                          title="Copy code"
                          onClick={() => navigator.clipboard?.writeText(c.code).catch(() => {})}
                        >
                          {c.code}
                        </button>
                        <button
                          onClick={() => api.toggleVoucherPause(c.id)}
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.status === "active" ? "border-[#b7dfc4] bg-success-tint text-success" : "border-line-2 bg-page text-muted"}`}
                          aria-label={`${c.status === "active" ? "Pause" : "Resume"} ${c.code}`}
                        >
                          {c.status === "active" ? "Active" : "Paused"}
                        </button>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {c.tier === "business" ? "Pro" : "Personal"} · {c.months} mo · {c.regions.join(", ")} · {c.maxRedemptions === 1 ? "unique" : "shared"} · {c.used} of {c.maxRedemptions} used
                        {full ? " · full" : ""}
                        {expired ? ` · expired ${fmtDate(c.redeemBy)}` : ` · until ${fmtDate(c.redeemBy)}`}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-page">
                          <div className={`h-full ${full ? "bg-danger" : "bg-ink"}`} style={{ width: `${Math.min(100, (c.used / c.maxRedemptions) * 100)}%` }} />
                        </div>
                        {c.maxRedemptions > 1 && !full && (
                          <button className="text-[11px] text-info underline" onClick={() => api.simulateLastSlot(c.id)} title="Fills the quota to one slot left, then fires 50 claims at once">
                            50 claims on last slot
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-muted">
                  Network (IP)
                  <select className="input mt-0.5 !py-1.5 text-xs" value={s.vouchers.ip} onChange={(e) => api.setVoucherClient({ ip: e.target.value })}>
                    <option value={IP_HOME}>Home · {IP_HOME}</option>
                    <option value={IP_OFFICE}>Office · {IP_OFFICE}</option>
                  </select>
                </label>
                <label className="text-[11px] text-muted">
                  Next claim response
                  <select className="input mt-0.5 !py-1.5 text-xs" value={s.vouchers.nextFault ?? ""} onChange={(e) => api.setVoucherFault((e.target.value || null) as "network" | "session" | null)}>
                    <option value="">Normal</option>
                    <option value="network">Connection error</option>
                    <option value="session">Session expired</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" className="accent-brand" checked={s.user.emailVerified !== false} onChange={(e) => api.setEmailVerified(e.target.checked)} />
                Email is verified
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-secondary !py-1.5 text-xs" onClick={() => api.advanceMinutes(15)}>
                  +15 min
                </button>
                <button className="btn-secondary !py-1.5 text-xs" onClick={() => api.addIpFailures(20)} title="Other accounts guessing codes from this network">
                  20 wrong guesses from this IP
                </button>
                <Link href="/prototype/voucher-log" className="btn-secondary !py-1.5 text-xs">
                  Audit log ({s.vouchers.audit.length})
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted">
                Clock: {fmtDateTime(s.now)}.
                {s.vouchers.accountLockUntil && s.vouchers.accountLockUntil > s.now ? ` Account locked until ${fmtDateTime(s.vouchers.accountLockUntil)}.` : ""}
                {ipLocked(s) ? ` This IP is locked until ${fmtDateTime(s.vouchers.ipLockUntil!)}.` : ""} Codes ignore case, spaces and dashes.
              </p>
            </Section>
          )}

          <Section title="Demo helpers">
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary !py-1.5 text-xs" disabled={!s.card} onClick={() => api.makeCardExpireSoon()}>
                Make card expire this month
              </button>
              <button className="btn-secondary !py-1.5 text-xs" onClick={() => api.useUpQuota()} title="Sets the Individual envelope counter to its limit so the next send opens the paywall">
                Use up envelope quota
              </button>
              <Link href="/prototype/emails" className="btn-secondary !py-1.5 text-xs">
                <IconMail size={14} /> Emails ({s.emails.length} sent)
              </Link>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" className="accent-brand" checked={s.ui.showSpecTags} onChange={(e) => api.setShowSpecTags(e.target.checked)} />
              Show prototype helpers: requirement tags (UX-xx, M-xx, R-xx), test-card hints, support panel
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" className="accent-brand" checked={guideOpen} onChange={(e) => api.setGuideOpen(e.target.checked)} />
              Show the test guide panel (Ctrl/Cmd + /)
            </label>
          </Section>

          <p className="mt-3 text-[11px] text-muted">Shortcut: Ctrl/Cmd + . toggles this panel. State is saved in this browser only.</p>
          <p className="mt-1 font-mono text-[11px] text-muted">{buildLabel()}</p>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}
