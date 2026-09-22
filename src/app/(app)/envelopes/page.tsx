"use client";

import { useFlows } from "@/components/flows";
import { IconDownload, IconEnvelope, IconHandover, IconLock, IconSignature } from "@/components/Icons";
import { Spec, StatusPill } from "@/components/ui";
import { workspaceView } from "@/lib/engine";
import { fmtDate } from "@/lib/format";
import { useAppState } from "@/lib/store";

/** Envelope list per workspace. In an expired workspace everything is read-only: view and download only (R-72). */
export default function EnvelopesPage() {
  const { s } = useAppState();
  const flows = useFlows();
  const ws = workspaceView(s);
  const docs = ws.documents;
  const handedOver = ws.kind === "business" && ws.role === "owner" && s.workspace.handedOverAt;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-ink">Envelopes</h1>
          <p className="mt-1 text-sm text-muted">
            {ws.name} · {ws.kind === "individual" ? "Individual workspace" : ws.kind === "business" ? "Business workspace" : "Enterprise workspace"}
            {ws.envelopeLimit === null ? " · unlimited envelopes" : ` · ${Math.max(0, ws.envelopeLimit - ws.usage.envelopesSent)} of ${ws.envelopeLimit} sends left this month`}
          </p>
        </div>
        <div className="flex gap-2">
          {ws.readOnly && ws.role === "owner" && ws.kind === "business" && docs.length > 0 && (
            <button className="btn-secondary" onClick={() => flows.open({ type: "handover" })}>
              <IconHandover size={18} /> Hand over documents
            </button>
          )}
          <button
            className="btn-primary"
            disabled={ws.readOnly}
            title={ws.readOnly ? "Read-only workspace" : undefined}
            onClick={() => flows.open({ type: "upload" })}
          >
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
                ? "The Enterprise contract has ended. You can view and download envelopes; contact sales to renew."
                : ws.role === "owner"
                  ? "You and your members can view and download envelopes but cannot sign, send or upload. Reactivate the Business plan or hand the documents over to your Individual workspace."
                  : `The Business plan of ${ws.ownerName} has ended. You can view and download envelopes; ask the owner to reactivate the plan.`}
            </p>
          </div>
        </div>
      )}

      {handedOver && (
        <div className="mt-6 rounded-xl border border-line bg-white px-5 py-4 text-sm text-ink-2">
          Documents were handed over to your Individual workspace on {fmtDate(s.workspace.handedOverAt!)}. Switch to <strong className="text-ink">{s.user.name} (Individual)</strong> to find them.
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-ink">
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
                <td colSpan={5} className="px-5 py-10 text-center text-muted">
                  No envelopes in this workspace.
                </td>
              </tr>
            )}
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-b-0">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
