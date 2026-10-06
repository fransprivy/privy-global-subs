"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconDownload } from "@/components/Icons";
import { Spec, StatusPill } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { VoucherAuditRow } from "@/lib/types";

const REASON_TEXT: Record<string, string> = {
  SUCCESS: "Claimed",
  UNKNOWN: "Code does not exist",
  PAUSED: "Code is paused",
  EXPIRED: "Past the redeem-by date",
  REGION: "Wrong region",
  RATE_LIMIT_ACCOUNT: "Account locked (too many attempts)",
  RATE_LIMIT_IP: "IP locked (too many attempts)",
  EMAIL_UNVERIFIED: "Email not verified",
  NOT_FREE: "Account is not on Free",
  ACTIVE_BENEFIT: "Already has a voucher benefit",
  ALREADY_IN_CAMPAIGN: "Already claimed in this campaign",
  IP_LIMIT: "IP claim limit reached",
  NETWORK_ERROR: "Connection or server error",
  SESSION_EXPIRED: "Session expired",
  EXHAUSTED: "Quota used up",
  PROMO_ENDED: "Free period ended, back to Free",
  PROMO_ENDED_BY_PURCHASE: "Free period ended early by a purchase",
  PROMO_CONVERTED: "Paid plan set to start when the free period ends",
};

function toCsv(rows: VoucherAuditRow[]): string {
  const head = ["time_utc", "result", "reason", "code_entered", "code_id", "campaign", "account_id", "email", "region", "ip"];
  const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  return [head.join(","), ...rows.map((r) => [r.at, r.result, r.reason, r.codeEntered, r.codeId, r.campaign, r.accountId, r.email, r.region, r.ip].map(esc).join(","))].join("\n");
}

/** Internal view for the prototype: every voucher attempt, append-only (V22). */
export default function VoucherLogPage() {
  const { s } = useAppState();
  const v = s.vouchers;
  const [campaign, setCampaign] = useState("all");
  const [result, setResult] = useState("all");
  const campaigns = useMemo(() => Array.from(new Set((v?.codes ?? []).map((c) => c.campaign))), [v]);
  const rows = useMemo(() => (v?.audit ?? []).filter((r) => (campaign === "all" || r.campaign === campaign) && (result === "all" || r.result === result)), [v, campaign, result]);

  if (!v) return <p className="p-10 text-sm text-muted">No voucher data in this scenario.</p>;

  function download() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voucher-audit-${campaign === "all" ? "all-campaigns" : campaign}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const shownCodes = v.codes.filter((c) => campaign === "all" || c.campaign === campaign);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-ink">
            Voucher audit log <Spec id="V22" />
          </h1>
          <p className="text-sm text-muted">Every claim attempt, successful or not. Rows are only added, never changed. This is an internal view; users never see it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !w-auto" value={campaign} onChange={(e) => setCampaign(e.target.value)} aria-label="Campaign">
            <option value="all">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="input !w-auto" value={result} onChange={(e) => setResult(e.target.value)} aria-label="Result">
            <option value="all">All results</option>
            <option value="SUCCESS">Success</option>
            <option value="FAIL">Failed</option>
            <option value="INFO">Lifecycle</option>
          </select>
          <button className="btn-secondary" onClick={download} disabled={rows.length === 0}>
            <IconDownload size={16} /> Export CSV ({rows.length})
          </button>
          <Link href="/settings/billing" className="btn-ghost">
            Back to Billing
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shownCodes.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-mono text-sm font-semibold text-ink">{c.code}</p>
              <StatusPill tone={c.status === "paused" ? "neutral" : s.now >= c.redeemBy ? "warn" : c.used >= c.maxRedemptions ? "danger" : "success"}>
                {c.status === "paused" ? "Paused" : s.now >= c.redeemBy ? "Expired" : c.used >= c.maxRedemptions ? "Full" : "Active"}
              </StatusPill>
            </div>
            <p className="mt-1 text-xs text-muted">
              {c.campaign} · {c.tier === "business" ? "Pro" : "Personal"} free for {c.months} month{c.months === 1 ? "" : "s"} · {c.regions.join(", ")}
            </p>
            <p className="mt-2 text-sm text-ink-2">
              {c.used} of {c.maxRedemptions} redeemed · redeem by {fmtDate(c.redeemBy)}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-page">
              <div className={`h-full ${c.used >= c.maxRedemptions ? "bg-danger" : "bg-ink"}`} style={{ width: `${Math.min(100, (c.used / c.maxRedemptions) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink">
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Result</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Code entered</th>
              <th className="px-4 py-3 font-semibold">Campaign</th>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 font-semibold">Region</th>
              <th className="px-4 py-3 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No attempts match this filter.
                </td>
              </tr>
            )}
            {rows.slice(0, 300).map((r) => (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDateTime(r.at)}</td>
                <td className="px-4 py-2.5">
                  <StatusPill tone={r.result === "SUCCESS" ? "success" : r.result === "FAIL" ? "danger" : "info"}>{r.result === "SUCCESS" ? "Success" : r.result === "FAIL" ? "Failed" : "Lifecycle"}</StatusPill>
                </td>
                <td className="px-4 py-2.5 text-ink-2">
                  <span className="font-mono text-xs text-muted">{r.reason}</span>
                  <br />
                  {REASON_TEXT[r.reason] ?? r.reason}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink">{r.codeEntered || "(empty)"}</td>
                <td className="px-4 py-2.5 text-ink-2">{r.campaign ?? "none"}</td>
                <td className="px-4 py-2.5 text-ink-2">
                  {r.email}
                  <br />
                  <span className="font-mono text-xs text-muted">{r.accountId}</span>
                </td>
                <td className="px-4 py-2.5 text-ink-2">{r.region}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-2">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 300 && <p className="mt-2 text-xs text-muted">Showing the latest 300 of {rows.length} rows. The CSV has all of them.</p>}
    </div>
  );
}
