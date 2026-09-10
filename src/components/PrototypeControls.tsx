"use client";

import Link from "next/link";
import { useEffect } from "react";
import { activeSubscription, CONFIG, prepaidEnd } from "@/lib/engine";
import { addDays, daysBetween, fmtDate, startOfDayUTC } from "@/lib/format";
import { SCENARIOS } from "@/lib/scenarios";
import { useAppState } from "@/lib/store";
import type { CardBehavior } from "@/lib/types";
import { IconClose, IconMail, IconRefresh, IconSliders } from "./Icons";

export function PrototypeControls() {
  const { s, api } = useAppState();
  const open = s.ui.controlsOpen;
  const guideOpen = s.ui.guideOpen ?? true;
  const rightOffset = guideOpen ? "lg:right-[376px] right-4" : "right-4";
  const sub = activeSubscription(s);
  const pe = prepaidEnd(s);
  const today = startOfDayUTC(s.now);

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

          <Section title="Demo helpers">
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary !py-1.5 text-xs" disabled={!s.card} onClick={() => api.makeCardExpireSoon()}>
                Make card expire this month
              </button>
              <Link href="/prototype/emails" className="btn-secondary !py-1.5 text-xs">
                <IconMail size={14} /> Emails ({s.emails.length} sent)
              </Link>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" className="accent-brand" checked={s.ui.showSpecTags} onChange={(e) => api.setShowSpecTags(e.target.checked)} />
              Show requirement tags (UX-xx, M-xx, R-xx) on the UI
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" className="accent-brand" checked={guideOpen} onChange={(e) => api.setGuideOpen(e.target.checked)} />
              Show the test guide panel (Ctrl/Cmd + /)
            </label>
          </Section>

          <p className="mt-3 text-[11px] text-muted">Shortcut: Ctrl/Cmd + . toggles this panel. State is saved in this browser only.</p>
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
