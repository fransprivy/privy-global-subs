"use client";

import { ANNUAL_SAVINGS, COMPARE_TABLE, PLAN_CARDS, TIER_LABEL, type CellValue } from "@/lib/catalog";
import { activeSubscription, classifyChange, currentTier, isPrepaidUser, planPrice, prepaidEnd } from "@/lib/engine";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Interval, PaidTier, Tier } from "@/lib/types";
import { useFlows } from "./flows";
import { IconBadge, IconCheck, IconCheckCircle } from "./Icons";
import { Spec } from "./ui";

type Cta = { label: string; kind: "current" | "action" | "sales" | "cancel" | "scheduled" | "disabled" };

export function useCta() {
  const { s } = useAppState();
  const flows = useFlows();
  const tier = currentTier(s);
  const sub = activeSubscription(s);
  const prepaid = isPrepaidUser(s);

  function ctaFor(target: Tier, interval: Interval): Cta {
    if (target === "enterprise") return { label: "Talk to sales", kind: "sales" };
    if (target === "free") {
      if (tier === "free") return { label: "Your current plan", kind: "current" };
      if (prepaid) return { label: `Prepaid until ${fmtDate(prepaidEnd(s)!)}`, kind: "disabled" };
      if (sub?.status === "cancel_scheduled") return { label: `Ends ${fmtDate(sub.currentPeriodEnd)}`, kind: "disabled" };
      return { label: "Downgrade to Free", kind: "cancel" };
    }
    const t = target as PaidTier;
    if (sub?.scheduledChange && sub.scheduledChange.tier === t && sub.scheduledChange.interval === interval) {
      return { label: `Scheduled for ${fmtDate(sub.scheduledChange.effectiveAt)}`, kind: "scheduled" };
    }
    const d = classifyChange(s, { tier: t, interval });
    switch (d) {
      case "subscribe":
        return { label: `Upgrade to ${TIER_LABEL[t]}`, kind: "action" };
      case "same":
        return { label: "Your current plan", kind: "current" };
      case "tier_up":
        return { label: `Upgrade to ${TIER_LABEL[t]}`, kind: "action" };
      case "tier_down":
        return { label: `Downgrade to ${TIER_LABEL[t]}`, kind: "action" };
      case "interval_up":
        return { label: "Switch to yearly", kind: "action" };
      case "interval_down":
        return { label: "Switch to monthly", kind: "action" };
    }
  }

  function act(target: Tier, interval: Interval) {
    const c = ctaFor(target, interval);
    if (c.kind === "cancel") flows.open({ type: "cancel" });
    else if (c.kind === "action") flows.open({ type: "plan", tier: target as PaidTier, interval });
    else if (c.kind === "sales") window.open("https://privyid.com/contact", "_blank");
  }

  return { ctaFor, act };
}

export function CtaButton({ target, interval, size = "md" }: { target: Tier; interval: Interval; size?: "md" | "sm" }) {
  const { ctaFor, act } = useCta();
  const c = ctaFor(target, interval);
  const base = size === "sm" ? "!py-1.5 !px-3 text-[13px]" : "w-full !py-2.5 text-[15px]";
  if (c.kind === "current") {
    return (
      <button disabled className={`btn ${base} bg-brand-soft text-white`}>
        {c.label}
      </button>
    );
  }
  if (c.kind === "scheduled" || c.kind === "disabled") {
    return (
      <button disabled className={`btn ${base} border border-line-2 bg-white text-muted`}>
        {c.label}
      </button>
    );
  }
  if (c.kind === "cancel") {
    return (
      <button onClick={() => act(target, interval)} className={`btn ${base} border border-line-2 bg-white text-ink hover:bg-page`}>
        {c.label}
      </button>
    );
  }
  return (
    <button onClick={() => act(target, interval)} className={`btn-primary ${base}`}>
      {c.label}
    </button>
  );
}

export function PlanCards({ interval, compact }: { interval: Interval; compact?: boolean }) {
  return (
    <div className={`grid gap-4 ${compact ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}>
      {PLAN_CARDS.map((p) => (
        <PlanCard key={p.tier} spec={p} interval={interval} compact={compact} />
      ))}
    </div>
  );
}

function PlanCard({ spec, interval, compact }: { spec: (typeof PLAN_CARDS)[number]; interval: Interval; compact?: boolean }) {
  const tier = spec.tier;
  const paid = tier === "personal" || tier === "business";
  const price = paid ? (interval === "monthly" ? planPrice(tier, "monthly", 1) : ANNUAL_SAVINGS[tier].perMonth) : null;
  const yearly = paid ? planPrice(tier, "annual", 1) : null;
  const blurb =
    tier === "free"
      ? "No cost"
      : tier === "enterprise"
        ? "Priced on your team size and needs"
        : interval === "monthly"
          ? tier === "business"
            ? "Billed monthly per seat"
            : "Billed monthly"
          : `Billed yearly ${fmtMoney(yearly!)}${tier === "business" ? " per seat" : ""}`;

  return (
    <div className={`relative flex flex-col rounded-[14px] border bg-white ${spec.recommended ? "border-maroon" : "border-line"}`}>
      {spec.recommended && (
        <span className="absolute -top-px right-0 rounded-bl-lg rounded-tr-[13px] bg-maroon px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Recommended</span>
      )}
      <div className="flex-1 px-4 pt-5 pb-4">
        <p className="text-[15px] font-medium text-ink">{TIER_LABEL[tier]}</p>
        <p className="mt-2 font-display text-[26px] font-semibold leading-none text-ink">
          {tier === "free" ? "Free" : tier === "enterprise" ? "Custom" : fmtMoney(price!)}
        </p>
        <p className="mt-1.5 text-xs text-muted">{blurb}</p>
        {paid && interval === "annual" && (
          <p className="mt-1 text-xs font-medium text-success">
            Save {fmtMoney(ANNUAL_SAVINGS[tier].amount)} · {ANNUAL_SAVINGS[tier].pct}%
          </p>
        )}
        <div className="mt-4">
          <CtaButton target={tier} interval={interval} />
        </div>
        <div className="mt-4 space-y-2.5 text-[13px]">
          {spec.everythingIn ? (
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <IconCheckCircle size={16} className="text-success" /> Everything in {TIER_LABEL[spec.everythingIn]}, plus
            </p>
          ) : (
            <p className="font-semibold text-ink">What you get</p>
          )}
          {spec.highlights.map((h) => (
            <div key={h.label} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
              <span className="text-ink-2">{h.label}</span>
              {h.value ? <span className="font-semibold text-ink">{h.value}</span> : <IconCheck size={16} className="text-success" />}
            </div>
          ))}
        </div>
      </div>
      {!compact && (
        <div className={`rounded-b-[13px] px-4 pb-4 pt-3 ${spec.recommended ? "bg-[#fbf1ea]" : "bg-[#f5f5f5]"}`}>
          <span className="chip -mt-6 mb-2 bg-white text-[10px] uppercase tracking-wider text-ink-2 shadow-sm">
            <IconBadge size={12} /> Best for
          </span>
          <p className="text-xs text-ink-2">{spec.bestFor}</p>
        </div>
      )}
    </div>
  );
}

export function CompareTable({ interval, showCtas = true, title = "Compare features across plans" }: { interval: Interval; showCtas?: boolean; title?: string }) {
  const tiers: Tier[] = ["free", "personal", "business", "enterprise"];
  return (
    <section>
      {title && <h2 className="mb-6 text-center font-display text-[22px] font-semibold text-ink">{title}</h2>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-[34%]" />
              {tiers.map((t) => (
                <th key={t} className="px-2 pb-3 text-center text-[15px] font-medium text-ink">
                  {TIER_LABEL[t]}
                </th>
              ))}
            </tr>
            {showCtas && (
              <tr>
                <th />
                {tiers.map((t) => (
                  <th key={t} className="px-2 pb-6 text-center">
                    <span className="inline-block">
                      <CtaButton target={t} interval={interval} size="sm" />
                    </span>
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {COMPARE_TABLE.map((g) => (
              <GroupRows key={g.group} group={g.group} rows={g.rows} interval={interval} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Plan facts follow privyid.com/pricing (Australia, AUD, after tax). <Spec id="catalog" />
      </p>
    </section>
  );
}

function GroupRows({ group, rows, interval }: { group: string; rows: (typeof COMPARE_TABLE)[number]["rows"]; interval: Interval }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="border-t border-line pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {group}
        </td>
      </tr>
      {rows.map((r) => {
        const values = interval === "annual" && r.annualValues ? r.annualValues : r.values;
        return (
          <tr key={r.label} className="border-t border-line">
            <td className="py-3.5 pr-4 text-ink">{r.label}</td>
            {values.map((v, i) => (
              <td key={i} className={`px-2 py-3.5 text-center ${i === 2 ? "bg-[#fdf3f3]/60" : ""}`}>
                <Cell v={v} />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

function Cell({ v }: { v: CellValue }) {
  if (v === true) return <IconCheck size={18} className="mx-auto text-success" />;
  if (v === false) return <span className="text-muted-2">–</span>;
  return <span className={/Unlimited|Custom|Yes/.test(v) ? "font-medium text-ink" : "text-ink-2"}>{v}</span>;
}
