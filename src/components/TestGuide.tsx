"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { activeSubscription, prepaidEnd } from "@/lib/engine";
import { daysBetween, fmtDate, startOfDayUTC } from "@/lib/format";
import { guideFor, stepDone } from "@/lib/guide";
import { SCENARIOS } from "@/lib/scenarios";
import { useAppState } from "@/lib/store";
import { IconCheck, IconChevronLeft, IconChevronRight, IconClose, IconMail, IconRefresh } from "./Icons";

const TAG_STYLE: Record<string, string> = {
  "Start here": "bg-brand text-white",
  Upgrade: "bg-info-tint text-info",
  Downgrade: "bg-success-tint text-success",
  Failure: "bg-danger-tint text-danger",
  Migration: "bg-gold-tint text-gold",
  Cancel: "bg-[#eeeeee] text-ink-2",
};

export const GUIDE_WIDTH = 360;

/** Next simulated event the tester can jump to (same logic as the Prototype panel). */
export function useNextEvent() {
  const { s } = useAppState();
  const sub = activeSubscription(s);
  const pe = prepaidEnd(s);
  const today = startOfDayUTC(s.now);
  if (sub?.status === "past_due" && sub.graceEndsAt) {
    if (sub.nextRetryAt && daysBetween(today, sub.nextRetryAt) > 0) return { label: `next retry (${fmtDate(sub.nextRetryAt)})`, iso: sub.nextRetryAt };
    return { label: `end of grace (${fmtDate(sub.graceEndsAt)})`, iso: sub.graceEndsAt };
  }
  if (sub) return { label: `${sub.status === "cancel_scheduled" ? "plan end" : sub.scheduledChange ? "scheduled change" : "next renewal"} (${fmtDate(sub.currentPeriodEnd)})`, iso: sub.currentPeriodEnd };
  if (pe) return { label: `end of prepaid time (${fmtDate(pe)})`, iso: pe };
  return null;
}

export function TestGuide() {
  const { s, api } = useAppState();
  const pathname = usePathname();
  const open = s.ui.guideOpen ?? true;
  const idx = Math.max(0, SCENARIOS.findIndex((x) => x.id === s.scenarioId));
  const meta = SCENARIOS[idx];
  const guide = guideFor(s.scenarioId);
  const nextEvent = useNextEvent();

  const done = useMemo(() => guide.steps.map((st) => stepDone(st, s, pathname)), [guide, s, pathname]);
  const doneCount = done.filter(Boolean).length;
  const currentIdx = done.findIndex((d) => !d);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        api.setGuideOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, api]);

  if (!open) {
    return (
      <button
        onClick={() => api.setGuideOpen(true)}
        className="fixed right-0 top-1/2 z-[52] -translate-y-1/2 rounded-l-xl bg-maroon px-2.5 py-4 text-white shadow-lg hover:bg-maroon-2"
        aria-label="Open test guide"
        title="Open the test guide (Ctrl/Cmd + /)"
      >
        <span className="block text-xs font-semibold [writing-mode:vertical-rl] [text-orientation:mixed] rotate-180">
          Test guide · {doneCount}/{guide.steps.length} done
        </span>
      </button>
    );
  }

  return (
    <aside
      className="fixed right-0 top-0 z-[52] flex h-screen w-[min(360px,100vw)] flex-col border-l border-line bg-white shadow-[-8px_0_32px_rgba(20,20,30,0.08)]"
      aria-label="Test guide"
    >
      {/* Header */}
      <div className="border-b border-line bg-cream px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Test guide · scenario {idx + 1} of {SCENARIOS.length}</p>
          <button className="rounded p-1 text-muted hover:bg-beige" onClick={() => api.setGuideOpen(false)} aria-label="Collapse guide" title="Collapse (Ctrl/Cmd + /)">
            <IconClose size={16} />
          </button>
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          <button
            className="mt-0.5 rounded-md border border-line-2 bg-white p-1 text-ink-2 hover:bg-page disabled:opacity-40"
            disabled={idx === 0}
            onClick={() => api.selectScenario(SCENARIOS[idx - 1].id)}
            aria-label="Previous scenario"
          >
            <IconChevronLeft size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${TAG_STYLE[meta.tag]}`}>{meta.tag}</span>
              <h2 className="font-display text-[15px] font-semibold leading-tight text-ink">{meta.title}</h2>
            </div>
            <p className="mt-1 text-xs text-muted">{meta.persona}</p>
          </div>
          <button
            className="mt-0.5 rounded-md border border-line-2 bg-white p-1 text-ink-2 hover:bg-page disabled:opacity-40"
            disabled={idx === SCENARIOS.length - 1}
            onClick={() => api.selectScenario(SCENARIOS[idx + 1].id)}
            aria-label="Next scenario"
          >
            <IconChevronRight size={14} />
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-2">
          <span className="font-semibold text-ink">Goal: </span>
          {guide.goal}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-beige-2">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(doneCount / guide.steps.length) * 100}%` }} />
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <ol className="space-y-2">
          {guide.steps.map((st, i) => {
            const isDone = done[i];
            const isCurrent = i === currentIdx;
            const onPage = st.href ? pathname === st.href || pathname.startsWith(st.href + "/") : false;
            return (
              <li
                key={st.id}
                className={`rounded-xl border p-3 transition-colors ${isCurrent ? "border-brand bg-brand-tint/40" : isDone ? "border-line bg-page" : "border-line bg-white"}`}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => api.toggleStep(st.id)}
                    aria-label={isDone ? "Mark as not done" : "Mark as done"}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${isDone ? "border-success bg-success text-white" : isCurrent ? "border-brand text-brand" : "border-line-2 text-muted"}`}
                  >
                    {isDone ? <IconCheck size={12} /> : i + 1}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-semibold leading-snug ${isDone ? "text-muted line-through decoration-muted-2" : "text-ink"}`}>{st.title}</p>
                    {(isCurrent || !isDone) && (
                      <div className="mt-1.5 space-y-1.5 text-xs">
                        <p className="text-ink-2">
                          <span className="font-semibold text-ink">Do: </span>
                          {st.do}
                        </p>
                        <p className="text-ink-2">
                          <span className="font-semibold text-ink">Expect: </span>
                          {st.expect}
                        </p>
                        {st.note && <p className="text-warn">{st.note}</p>}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {st.href && !onPage && !isDone && (
                        <Link href={st.href} className="rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white hover:bg-black">
                          Go there →
                        </Link>
                      )}
                      {onPage && !isDone && <span className="rounded-md bg-info-tint px-2 py-1 text-[11px] font-semibold text-info">You are here</span>}
                      {st.refs?.map((r) => (
                        <span key={r} className="rounded bg-[#eef0f3] px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {doneCount === guide.steps.length && (
          <div className="mt-3 rounded-xl border border-success/40 bg-success-tint p-3 text-xs text-ink-2">
            <p className="font-semibold text-success">Scenario complete.</p>
            <p className="mt-1">Move to the next scenario with the arrow above, or reset and try the alternatives in the steps marked optional.</p>
          </div>
        )}
      </div>

      {/* Footer: time + helpers */}
      <div className="border-t border-line bg-page px-3 py-3 text-xs">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-ink">Simulated date: {fmtDate(s.now)}</p>
          <button className="inline-flex items-center gap-1 text-muted hover:text-ink" onClick={() => { api.reset(); }} title="Reset this scenario (clears progress)">
            <IconRefresh size={12} /> Reset
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button className="btn-secondary !px-2.5 !py-1 text-[11px]" onClick={() => api.advanceDays(1)}>+1 day</button>
          <button className="btn-secondary !px-2.5 !py-1 text-[11px]" onClick={() => api.advanceDays(7)}>+7 days</button>
          {nextEvent && (
            <button className="btn-primary !px-2.5 !py-1 text-[11px]" onClick={() => api.advanceTo(nextEvent.iso)}>
              Jump to {nextEvent.label}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span><span className="font-mono text-ink-2">4242</span> succeeds</span>
          <span><span className="font-mono text-ink-2">3155</span> needs 3DS</span>
          <span><span className="font-mono text-ink-2">9995</span> soft decline</span>
          <span><span className="font-mono text-ink-2">0069</span> hard decline</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Link href="/prototype/emails" className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
            <IconMail size={13} /> Emails ({s.emails.length})
          </Link>
          <label className="flex items-center gap-1.5 text-ink-2">
            <input type="checkbox" className="accent-brand" checked={s.ui.showSpecTags} onChange={(e) => api.setShowSpecTags(e.target.checked)} />
            Spec tags
          </label>
          <Link href="/" className="text-muted hover:text-ink">All scenarios</Link>
        </div>
      </div>
    </aside>
  );
}
