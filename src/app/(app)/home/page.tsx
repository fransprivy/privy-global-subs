"use client";

import { useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconDownload, IconEnvelope, IconLock, IconSignature } from "@/components/Icons";
import { Spec } from "@/components/ui";
import { useFlows } from "@/components/flows";
import { workspaceView } from "@/lib/engine";
import { useAppState } from "@/lib/store";

export default function HomePage() {
  const { s, api } = useAppState();
  const flows = useFlows();
  const ws = workspaceView(s);
  const [filter, setFilter] = useState<"all" | "yours" | "others">("all");
  const open = ws.documents.filter((t) => t.status !== "completed");
  const tasks = open.filter((t) => (filter === "all" ? true : filter === "yours" ? t.status === "waiting_for_you" : t.status === "waiting_for_others"));
  const pending = open.filter((t) => t.status === "waiting_for_you").length;
  const waiting = open.filter((t) => t.status === "waiting_for_others").length;

  return (
    <div>
      <section className="hero-gradient hero-pattern text-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-display text-[32px] font-semibold">Hello, {s.user.name}</h1>
            <p className="mt-2 text-lg text-white/85">Here&apos;s your summary for today</p>
            <button
              className="mt-8 flex items-center gap-3 rounded-lg border border-white/70 px-6 py-4 text-lg font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={ws.readOnly}
              title={ws.readOnly ? "This workspace is read-only until the plan is reactivated." : undefined}
              onClick={() => {
                if (!api.sendEnvelope()) flows.open({ type: "paywall" });
              }}
            >
              {ws.readOnly ? <IconLock size={22} /> : <IconEnvelope size={22} />} Send an envelope <IconChevronDown size={18} />
            </button>
          </div>
          <div className="flex flex-col gap-6 lg:items-end">
            <div className="flex flex-wrap items-center gap-2 text-[15px]">
              <span className="text-white/85">Workspace:</span>
              <span className="rounded-md bg-white/90 px-2.5 py-1 text-sm font-semibold text-ink-2">
                {ws.name} · {ws.kind === "individual" ? "Individual" : ws.kind === "business" ? "Business" : "Enterprise"}
              </span>
              <span className={`rounded-md px-2.5 py-1 text-sm font-semibold ${ws.status === "expired" ? "bg-[#ffd5d5] text-danger" : "bg-white/20 text-white"}`}>{ws.planLabel}</span>
              <Spec id="R-77" />
            </div>
            <div className="flex gap-14">
              <Stat n={pending} label="Pending tasks" />
              <Stat n={waiting} label="Waiting for others" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
        <h2 className="font-display text-[22px] font-semibold text-ink">Task activity</h2>
        <p className="text-sm text-muted">Updated today • 09:09 PM</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "All"],
              ["yours", "Your tasks"],
              ["others", "Others' tasks"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-md border px-4 py-2 text-[15px] ${filter === k ? "border-[#8ec3e8] bg-[#eef6fc] text-ink" : "border-line-2 bg-white text-ink-2"}`}>
              {l}
            </button>
          ))}
          <button className="ml-auto flex items-center gap-2 rounded-md border border-line-2 bg-white px-4 py-2 text-[15px] text-ink">
            Newest first <IconChevronDown size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {tasks.length === 0 && (
            <div className="card px-6 py-10 text-center text-sm text-muted">
              No open tasks in this workspace.{" "}
              <Link href="/envelopes" className="text-ink underline">
                See all envelopes
              </Link>
            </div>
          )}
          {tasks.map((t) => (
            <div key={t.id} className="card flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center">
              <div className="flex-1">
                <p className="text-[17px] font-medium text-ink">{t.title}</p>
                <p className="text-sm text-muted">From: {t.from}</p>
              </div>
              <p className="text-sm text-muted">Assigned {t.assignedAgo}</p>
              <div className="w-full md:w-72">
                <div className="h-1 w-full rounded bg-line">
                  <div className="h-1 rounded bg-[#5f8fb5]" style={{ width: t.status === "waiting_for_you" ? "33%" : "66%" }} />
                </div>
                <p className="mt-2 text-sm text-ink-2">{t.status === "waiting_for_you" ? "Waiting for you" : "Waiting for others"}</p>
              </div>
              {ws.readOnly ? (
                <button className="btn-secondary !px-6 !py-3 text-base" title="Read-only workspace: download only">
                  <IconDownload size={18} /> Download
                </button>
              ) : t.status === "waiting_for_you" ? (
                <button className="btn-primary !px-8 !py-3 text-base">
                  <IconSignature size={18} /> Sign
                </button>
              ) : (
                <button className="btn-secondary !px-6 !py-3 text-base">Remind</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-5xl font-medium">{n}</p>
      <p className="mt-1 text-lg text-white/90">{label}</p>
    </div>
  );
}
