"use client";

import Link from "next/link";
import { useState } from "react";
import { IconMail } from "@/components/Icons";
import { CompareTable, PlanCards } from "@/components/PlanCards";
import { Spec, Toggle } from "@/components/ui";
import { activeSubscription, currentInterval, currentPlanName } from "@/lib/engine";
import { fmtDate } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Interval } from "@/lib/types";

export default function PlansPage() {
  const { s } = useAppState();
  const [interval, setInterval] = useState<Interval>(currentInterval(s) ?? "monthly");
  const sub = activeSubscription(s);

  return (
    <div className="pricing-top">
      <div className="mx-auto max-w-[1180px] px-4 pt-10 pb-16 sm:px-8">
        <h1 className="text-center font-display text-[30px] font-semibold text-ink">Choose the plan that&apos;s right for you</h1>
        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="relative">
            <Toggle
              value={interval}
              onChange={(v) => setInterval(v as Interval)}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Yearly" },
              ]}
            />
            <span className="chip absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gold text-[10px] text-white">★ SAVE UP TO 14%</span>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-2">
            <IconMail size={14} /> Have a voucher code?{" "}
            <Link href="#" className="font-medium text-brand">
              Redeem it here
            </Link>
          </p>
          {sub && (
            <p className="text-xs text-muted">
              You are on <strong className="text-ink">{currentPlanName(s)}</strong>
              {sub.status === "cancel_scheduled" ? `, ending ${fmtDate(sub.currentPeriodEnd)}` : `, renews ${fmtDate(sub.currentPeriodEnd)}`}. <Spec id="UX-01" />
            </p>
          )}
        </div>

        <div className="mt-8">
          <PlanCards interval={interval} />
        </div>

        <div className="mt-14">
          <CompareTable interval={interval} />
        </div>

        <div className="mt-12 flex flex-col items-start gap-6 rounded-2xl bg-beige p-8 md:flex-row md:items-center">
          <DocsIllustration />
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

function DocsIllustration() {
  return (
    <svg width="120" height="110" viewBox="0 0 120 110" aria-hidden="true" className="shrink-0">
      <rect x="18" y="12" width="60" height="78" rx="4" fill="#fff" stroke="#e5d6cb" />
      <rect x="26" y="22" width="30" height="4" rx="2" fill="#c9d7e6" />
      <rect x="26" y="32" width="44" height="4" rx="2" fill="#dfe7ef" />
      <rect x="26" y="42" width="38" height="4" rx="2" fill="#dfe7ef" />
      <rect x="26" y="56" width="20" height="10" rx="2" fill="#f2c1c7" />
      <rect x="34" y="4" width="60" height="78" rx="4" fill="#fff" stroke="#e5d6cb" opacity=".8" />
      <path d="M78 72c8 4 14 14 12 26-8 2-16-2-20-8 0-6 2-14 8-18z" fill="#f4b28f" />
      <path d="M80 74c3 8 4 14 2 22" stroke="#e58f63" strokeWidth="2" fill="none" />
    </svg>
  );
}
