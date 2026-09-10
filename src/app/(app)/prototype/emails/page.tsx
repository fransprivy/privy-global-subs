"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PrivyMark } from "@/components/Logo";
import { Spec } from "@/components/ui";
import { EMAIL_META, renderEmail, type RenderedEmail } from "@/lib/emails";
import { buildCtx } from "@/lib/engine";
import { fmtDateTime } from "@/lib/format";
import { useAppState } from "@/lib/store";

export default function EmailsPage() {
  const { s } = useAppState();
  const [tab, setTab] = useState<"sent" | "catalogue">(s.emails.length ? "sent" : "catalogue");
  const [selected, setSelected] = useState<string | null>(null);
  const ctx = useMemo(() => buildCtx(s), [s]);

  const catalogue = useMemo(() => EMAIL_META.map((m) => ({ meta: m, rendered: renderEmail(m.id, ctx) })), [ctx]);
  const sentSel = s.emails.find((e) => e.id === selected);
  const catSel = catalogue.find((c) => c.meta.id === selected);
  const shown: { subject: string; body: string[]; cta?: RenderedEmail["cta"]; id: string; meta?: string } | null =
    tab === "sent" && sentSel
      ? { subject: sentSel.subject, body: sentSel.body, cta: sentSel.cta, id: sentSel.templateId, meta: `Sent ${fmtDateTime(sentSel.at)} to ${sentSel.to}` }
      : tab === "catalogue" && catSel
        ? { subject: catSel.rendered.subject, body: catSel.rendered.body, cta: catSel.rendered.cta, id: catSel.meta.id, meta: `${catSel.meta.trigger} · ${catSel.meta.timing}` }
        : null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-ink">Notifications</h1>
          <p className="text-sm text-muted">Every email from the catalogue, rendered with live data from the current scenario. Banners (B-01 to B-04) appear in the app itself.</p>
        </div>
        <div className="inline-flex rounded-full bg-[#ecebe9] p-1">
          <button onClick={() => setTab("sent")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "sent" ? "bg-white shadow-sm" : "text-muted"}`}>
            Sent in this scenario ({s.emails.length})
          </button>
          <button onClick={() => setTab("catalogue")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === "catalogue" ? "bg-white shadow-sm" : "text-muted"}`}>
            Catalogue ({EMAIL_META.length})
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="card max-h-[70vh] overflow-y-auto">
          {tab === "sent" &&
            (s.emails.length === 0 ? (
              <p className="p-6 text-sm text-muted">No emails sent yet. Take an action (subscribe, cancel, advance the clock) and they will appear here.</p>
            ) : (
              s.emails.map((e) => (
                <button key={e.id} onClick={() => setSelected(e.id)} className={`block w-full border-b border-line px-4 py-3 text-left hover:bg-page ${selected === e.id ? "bg-page" : ""}`}>
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono font-semibold text-info">{e.templateId}</span> {fmtDateTime(e.at)}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink">{e.subject}</p>
                  <p className="truncate text-xs text-muted">To {e.to}</p>
                </button>
              ))
            ))}
          {tab === "catalogue" &&
            catalogue.map(({ meta, rendered }) => (
              <button key={meta.id} onClick={() => setSelected(meta.id)} className={`block w-full border-b border-line px-4 py-3 text-left hover:bg-page ${selected === meta.id ? "bg-page" : ""}`}>
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-mono font-semibold text-info">{meta.id}</span> {meta.group} · {meta.name}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-ink">{rendered.subject}</p>
                <p className="truncate text-xs text-muted">{meta.trigger}</p>
              </button>
            ))}
        </div>

        <div>
          {shown ? (
            <div className="card overflow-hidden">
              <div className="border-b border-line bg-page px-5 py-3 text-xs text-muted">
                <span className="font-mono font-semibold text-info">{shown.id}</span> · {shown.meta}
                {tab === "catalogue" && catSel && (
                  <span className="ml-2">
                    · Legal: {catSel.meta.legal}
                  </span>
                )}
              </div>
              <div className="mx-auto max-w-[600px] px-6 py-8">
                <div className="flex items-center gap-2">
                  <PrivyMark size={26} />
                  <span className="font-display text-lg font-semibold text-logo">privy</span>
                </div>
                <h2 className="mt-6 font-display text-xl font-semibold text-ink">{shown.subject}</h2>
                <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-2">
                  {shown.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {shown.cta && (
                  <Link href={shown.cta.href} className="btn-primary mt-6">
                    {shown.cta.label} <Spec id="UX-18" />
                  </Link>
                )}
                <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
                  Privy Pty Ltd · This is a transactional email about your account and cannot be unsubscribed from. Questions: helpdesk@privy.id
                </p>
              </div>
            </div>
          ) : (
            <div className="card flex h-64 items-center justify-center text-sm text-muted">Select an email to preview it.</div>
          )}
        </div>
      </div>
    </div>
  );
}
