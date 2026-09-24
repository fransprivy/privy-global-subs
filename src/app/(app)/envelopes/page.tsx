"use client";

import { useState } from "react";
import { useFlows } from "@/components/flows";
import { IconDownload, IconEnvelope, IconHandover, IconLock, IconSignature } from "@/components/Icons";
import { Spec, StatusPill } from "@/components/ui";
import { handoverOptions, workspaceView } from "@/lib/engine";
import { fmtDate } from "@/lib/format";
import { useAppState } from "@/lib/store";

/** Envelope list per workspace. Expired workspaces are read-only: view, download and hand over only (R-72). */
export default function EnvelopesPage() {
  const { s } = useAppState();
  const flows = useFlows();
  const ws = workspaceView(s);
  const docs = ws.documents;
  const opts = handoverOptions(s);
  const canHandover = opts.destinations.length > 0;
  const [selected, setSelected] = useState<string[]>([]);
  const eligibleIds = docs.filter(opts.eligible).map((d) => d.id);
  const chosen = selected.filter((id) => eligibleIds.includes(id));
  const allChosen = eligibleIds.length > 0 && chosen.length === eligibleIds.length;
  const handedOver = ws.kind === "business" && ws.role === "owner" && s.workspace.handedOverAt;

  function toggle(id: string) {
    setSelected((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-ink">Envelopes</h1>
          <p className="mt-1 text-sm text-muted">
            {ws.name} · {ws.kind === "individual" ? "Individual" : ws.kind === "business" ? "Business" : "Enterprise"}
            {ws.envelopeLimit === null ? "" : ` · ${Math.max(0, ws.envelopeLimit - ws.usage.envelopesSent)} of ${ws.envelopeLimit} envelopes left this month`}
          </p>
        </div>
        <div className="flex gap-2">
          {canHandover && chosen.length > 0 && (
            <button className="btn-secondary" onClick={() => flows.open({ type: "handover", ids: chosen })}>
              <IconHandover size={18} /> Hand over {chosen.length}
            </button>
          )}
          {canHandover && chosen.length === 0 && ws.kind === "business" && eligibleIds.length > 0 && (
            <button className="btn-secondary" onClick={() => flows.open({ type: "handover", ids: eligibleIds })}>
              <IconHandover size={18} /> Hand over all
            </button>
          )}
          <button className="btn-primary" disabled={ws.readOnly} title={ws.readOnly ? "This workspace is read-only" : undefined} onClick={() => flows.open({ type: "upload" })}>
            {ws.readOnly ? <IconLock size={18} /> : <IconEnvelope size={18} />} New envelope
          </button>
        </div>
      </div>

      {ws.readOnly && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#f2b0b0] bg-danger-tint px-5 py-4 text-sm text-danger sm:flex-row sm:items-center">
          <IconLock size={20} />
          <div className="flex-1">
            <p className="font-semibold">
              This workspace is read-only{ws.expiredAt ? ` since ${fmtDate(ws.expiredAt)}` : ""}. <Spec id="R-72" />
            </p>
            <p className="text-xs opacity-90">
              {ws.kind === "enterprise"
                ? "The Enterprise contract has ended. You can view and download envelopes."
                : ws.role === "owner"
                  ? "Everyone can still view, download and hand over envelopes. Reactivate Business to sign and send again."
                  : `${ws.ownerName}'s Business plan has ended. You can view, download and hand over the envelopes you uploaded.`}
            </p>
          </div>
        </div>
      )}

      {handedOver && docs.length === 0 && (
        <div className="mt-6 rounded-xl border border-line bg-white px-5 py-4 text-sm text-ink-2">
          Envelopes were handed over on {fmtDate(s.workspace.handedOverAt!)}.
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-ink">
              {canHandover && (
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="accent-brand" checked={allChosen} disabled={eligibleIds.length === 0} onChange={() => setSelected(allChosen ? [] : eligibleIds)} aria-label="Select all" />
                </th>
              )}
              <th className="px-5 py-3 font-semibold">Envelope</th>
              <th className="px-5 py-3 font-semibold">From</th>
              <th className="px-5 py-3 font-semibold">Updated</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr>
                <td colSpan={canHandover ? 6 : 5} className="px-5 py-10 text-center text-muted">
                  No envelopes yet.
                </td>
              </tr>
            )}
            {docs.map((d) => {
              const eligible = opts.eligible(d);
              return (
                <tr key={d.id} className="border-b border-line last:border-b-0">
                  {canHandover && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="accent-brand"
                        checked={chosen.includes(d.id)}
                        disabled={!eligible}
                        onChange={() => toggle(d.id)}
                        aria-label={`Select ${d.title}`}
                        title={eligible ? undefined : "Only envelopes you uploaded can be handed over"}
                      />
                    </td>
                  )}
                  <td className="px-5 py-4 font-medium text-ink">{d.title}</td>
                  <td className="px-5 py-4 text-ink-2">{d.from}</td>
                  <td className="px-5 py-4 text-muted">{d.assignedAgo}</td>
                  <td className="px-5 py-4">
                    {d.status === "completed" && <StatusPill tone="success">Completed</StatusPill>}
                    {d.status === "waiting_for_you" && <StatusPill tone={ws.readOnly ? "neutral" : "warn"}>Waiting for you</StatusPill>}
                    {d.status === "waiting_for_others" && <StatusPill tone="info">Waiting for others</StatusPill>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary !py-2" title="Download PDF">
                        <IconDownload size={16} /> Download
                      </button>
                      {d.status === "waiting_for_you" && (
                        <button className="btn-primary !py-2" disabled={ws.readOnly} title={ws.readOnly ? "Signing is disabled in a read-only workspace" : undefined}>
                          <IconSignature size={16} /> Sign
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canHandover && (
        <p className="mt-3 text-xs text-muted">
          Select envelopes to hand them over to{" "}
          {ws.kind === "individual" ? s.workspace.name : ws.role === "owner" ? "your Individual workspace or to each uploader" : "your Individual workspace"}.
        </p>
      )}
    </div>
  );
}
