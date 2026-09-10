"use client";

import { useRouter } from "next/navigation";
import { PrivyMark } from "@/components/Logo";
import { IconArrowRight } from "@/components/Icons";
import { guideFor } from "@/lib/guide";
import { SCENARIOS } from "@/lib/scenarios";
import { useStore } from "@/lib/store";

const TAG_STYLE: Record<string, string> = {
  "Start here": "bg-brand text-white",
  Upgrade: "bg-info-tint text-info",
  Downgrade: "bg-success-tint text-success",
  Failure: "bg-danger-tint text-danger",
  Migration: "bg-gold-tint text-gold",
  Cancel: "bg-[#eeeeee] text-ink-2",
};

export default function ScenarioPicker() {
  const { selectScenario, state, ready } = useStore();
  const router = useRouter();

  function go(id: string) {
    selectScenario(id);
    router.push("/home");
  }

  return (
    <div className="min-h-screen bg-page">
      <div className="hero-gradient hero-pattern text-white">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
          <div className="flex items-center gap-2">
            <PrivyMark size={34} />
            <span className="font-display text-2xl font-semibold">privy</span>
            <span className="ml-3 rounded-full border border-white/30 px-3 py-1 text-xs font-medium text-white/90">Prototype · Global subscriptions</span>
          </div>
          <h1 className="mt-8 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl">From one-off units to true subscriptions</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            A clickable prototype of Privy Sign for the Global market: plans, checkout, renewal, upgrade, downgrade, cancellation and failed-payment handling, built to the billing-behaviour spec. Pick a persona to start; every screen works and every action updates the account, the invoices, the emails and the history.
          </p>
          {ready && state && (
            <button onClick={() => router.push("/home")} className="btn mt-6 bg-white text-maroon hover:bg-white/90">
              Continue where you left off ({SCENARIOS.find((x) => x.id === state.scenarioId)?.title}) <IconArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Choose a scenario</h2>
            <p className="text-sm text-muted">The simulated date is 10 September 2026. Inside the app, the test guide on the right lists each step with what to click and what to expect, ticks steps off as you go, and lets you move time forward. The Prototype button (bottom right) has the advanced controls.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((sc) => (
            <button key={sc.id} onClick={() => go(sc.id)} className="card group flex flex-col p-5 text-left transition-shadow hover:shadow-[var(--shadow-card)]">
              <span className={`chip self-start ${TAG_STYLE[sc.tag]}`}>{sc.tag}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-ink">{sc.title}</h3>
              <p className="mt-1 text-xs font-medium text-muted">{sc.persona}</p>
              <p className="mt-2 flex-1 text-sm text-ink-2">{sc.description}</p>
              <ol className="mt-3 space-y-1 text-xs text-muted">
                {guideFor(sc.id).steps.map((st, i) => (
                  <li key={st.id} className="flex gap-1.5">
                    <span className="font-semibold text-brand">{i + 1}.</span> {st.title}
                  </li>
                ))}
              </ol>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                Open scenario <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-4 rounded-2xl border border-line bg-white p-6 text-sm text-ink-2 md:grid-cols-3">
          <div>
            <p className="font-semibold text-ink">What is real</p>
            <p className="mt-1">Plan facts from privyid.com/pricing (AUD), the five matrix rules, month-end billing anchors, 14-day grace with Day 3/7/14 retries, consent records, invoices, the full email catalogue.</p>
          </div>
          <div>
            <p className="font-semibold text-ink">What is simulated</p>
            <p className="mt-1">Stripe is replaced by test cards (4242 succeeds, 3155 needs 3DS, 9995 soft-declines, 0069 hard-declines). Time moves only when you advance it. State lives in your browser.</p>
          </div>
          <div>
            <p className="font-semibold text-ink">For the team</p>
            <p className="mt-1">Each step in the test guide names the spec items it proves (UX-xx, M-xx, R-xx, N-xx). Turn on "Spec tags" in the guide footer to see those tags on the UI itself. The Emails page renders every template with live data.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
