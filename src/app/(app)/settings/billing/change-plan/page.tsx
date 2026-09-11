"use client";

import Link from "next/link";
import { useState } from "react";
import { IconArrowLeft, IconChevronDown, IconReceipt } from "@/components/Icons";
import { CompareTable, PlanCards } from "@/components/PlanCards";
import { SettingsHeader } from "@/components/SettingsHeader";
import { Spec, Toggle } from "@/components/ui";
import { ENVELOPE_LIMIT, TEMPLATE_LIMIT } from "@/lib/catalog";
import { activeSubscription, currentInterval, currentPlanName, currentTier, isPrepaidUser, planPrice, prepaidEnd } from "@/lib/engine";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Interval } from "@/lib/types";

export default function ChangePlanPage() {
  const { s } = useAppState();
  const sub = activeSubscription(s);
  const tier = currentTier(s);
  const [interval, setInterval] = useState<Interval>(currentInterval(s) ?? "monthly");
  const [compare, setCompare] = useState(false);
  const prepaid = isPrepaidUser(s);

  const applyLine = sub
    ? sub.status === "cancel_scheduled"
      ? `Your plan ends on ${fmtDate(sub.currentPeriodEnd)}. Resume it from Billing to change plans.`
      : `Upgrades can start today or on ${fmtDate(sub.currentPeriodEnd)}. Downgrades take effect on ${fmtDate(sub.currentPeriodEnd)}.`
    : prepaid
      ? `Your prepaid time runs until ${fmtDate(prepaidEnd(s)!)}. Any change starts on that date.`
      : "Your new plan will apply starting today.";

  return (
    <div>
      <SettingsHeader icon={<IconReceipt size={22} />} title="Billing" subtitle="Manage your plan and payment details" />
      <div className="px-6 py-6 sm:px-10">
        <p className="text-sm text-muted">
          <Link href="/settings/billing" className="hover:underline">
            Billing
          </Link>{" "}
          › <span className="text-ink">Change plan</span>
        </p>
        <Link href="/settings/billing" className="btn-secondary mt-4 !py-3 !px-5 text-[15px]">
          <IconArrowLeft size={18} /> Back
        </Link>

        <h2 className="mt-8 text-[19px] font-semibold text-ink">Change plan</h2>
        <p className="text-[15px] text-ink-2">
          {applyLine} <Spec id="UX-02" />
        </p>

        <div className="mt-5 rounded-xl border-2 border-[#6cb2e2] bg-white p-5">
          <span className="inline-block rounded bg-[#e3f1fb] px-2.5 py-1 text-sm font-semibold uppercase tracking-wide text-[#1d6fb8]">Current plan</span>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[17px] text-ink">{tier === "free" ? "Free" : currentPlanName(s)}</p>
              <p className="text-[15px] text-muted">
                {sub
                  ? `Billed ${sub.interval === "monthly" ? "monthly" : "yearly"} · ${fmtMoney(planPrice(sub.tier, sub.interval, sub.seats))}${sub.tier === "business" ? ` for ${sub.seats} seats` : ""} · ${sub.status === "cancel_scheduled" ? "ends" : "renews"} ${fmtDate(sub.currentPeriodEnd)}`
                  : prepaid
                    ? `Prepaid until ${fmtDate(prepaidEnd(s)!)}`
                    : "Billed monthly"}
              </p>
            </div>
            <div className="space-y-2 text-[15px]">
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-ink">Envelopes sent</span>
                <span className="font-semibold text-ink">{ENVELOPE_LIMIT[tier] === null ? "Unlimited" : `${ENVELOPE_LIMIT[tier]} / month`}</span>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-ink">Reusable templates</span>
                <span className="font-semibold text-ink">{TEMPLATE_LIMIT[tier] === null ? "Unlimited" : TEMPLATE_LIMIT[tier]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink">Team members</span>
                <span className="font-semibold text-ink">{tier === "business" && sub ? `${sub.seats} seats` : "1"}</span>
              </div>
            </div>
          </div>
        </div>

        <h3 className="mt-8 text-[19px] font-semibold text-ink">Plan options</h3>
        <div className="relative mt-3 inline-block">
          <Toggle
            value={interval}
            onChange={(v) => setInterval(v as Interval)}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annual", label: "Yearly" },
            ]}
          />
          <span className="chip pointer-events-none absolute -bottom-3.5 left-[52%] whitespace-nowrap bg-gold px-2.5 text-[10px] text-white shadow-sm">★ SAVE UP TO 14%</span>
        </div>

        <div className="mt-8">
          <PlanCards interval={interval} compact />
        </div>

        <button className="mx-auto mt-6 flex items-center gap-1 text-[15px] font-medium text-maroon" onClick={() => setCompare((v) => !v)}>
          Compare all features <IconChevronDown size={16} className={`transition-transform ${compare ? "rotate-180" : ""}`} />
        </button>
        {compare && (
          <div className="mt-6">
            <CompareTable interval={interval} showCtas={false} title="" />
          </div>
        )}

        <div className="mt-10 flex flex-col items-start gap-6 rounded-2xl bg-beige p-8 md:flex-row md:items-center">
          <div>
            <p className="font-display text-xl font-semibold text-ink">Have needs that don&apos;t fit a standard plan?</p>
            <p className="mt-1 text-sm text-ink-2">We&apos;ll scope a plan around your volume, security requirements, and the systems you need to connect.</p>
            <a href="https://privyid.com/contact" target="_blank" rel="noreferrer" className="btn-primary mt-4">
              Talk to sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
