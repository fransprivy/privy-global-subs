"use client";

import Link from "next/link";
import { useState } from "react";
import { IconInfo, IconSliders } from "@/components/Icons";
import { RegionSelect } from "@/components/onetime";
import { SettingsHeader } from "@/components/SettingsHeader";
import { Spec } from "@/components/ui";
import { activeSubscription, isOneTimeUser, regionOf } from "@/lib/engine";
import { regionMeta } from "@/lib/catalog";
import { useAppState } from "@/lib/store";
import type { Region } from "@/lib/types";

const TIMEZONES = ["Automatic (browser)", "Asia/Jakarta (WIB, UTC+7)", "Asia/Singapore (UTC+8)", "Australia/Sydney (AEST, UTC+10)", "Europe/London (UTC+0)", "America/New_York (UTC-5)"];
const DATE_FORMATS = ["dd MMM yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"];

export default function WorkspacePreferencesPage() {
  const { s, api } = useAppState();
  const region = regionOf(s);
  const meta = regionMeta(region);
  const prefs = s.prefs ?? { timezone: "auto", dateFormat: "dd MMM yyyy" };
  const sub = activeSubscription(s);
  const oneTime = isOneTimeUser(s);
  const [pendingRegion, setPendingRegion] = useState<Region | null>(null);
  const [timezone, setTimezone] = useState(prefs.timezone === "auto" ? TIMEZONES[0] : prefs.timezone);
  const [dateFormat, setDateFormat] = useState(prefs.dateFormat);
  const dirty = pendingRegion !== null || timezone !== (prefs.timezone === "auto" ? TIMEZONES[0] : prefs.timezone) || dateFormat !== prefs.dateFormat;

  function save() {
    if (pendingRegion && pendingRegion !== region) api.setRegion(pendingRegion);
    api.setPrefs({ timezone: timezone === TIMEZONES[0] ? "auto" : timezone, dateFormat });
    setPendingRegion(null);
  }

  const shownRegion = pendingRegion ?? region;
  const shownMeta = regionMeta(shownRegion);

  return (
    <div>
      <SettingsHeader icon={<IconSliders size={22} />} title="Workspace preferences" subtitle="Region, time zone and date format for this workspace" />
      <div className="px-6 py-6 sm:px-10">
        <div className="max-w-[720px]">
          <h2 className="text-[19px] font-semibold text-ink">
            General <Spec id="R-60" />
          </h2>
          <p className="text-[15px] text-ink-2">These settings apply to everyone in this workspace.</p>

          <div className="card mt-5 space-y-6 p-6">
            <Field label="Region" hint="Sets the currency, tax display and the ways you can pay for your subscription.">
              <RegionSelect value={shownRegion} onChange={(v) => setPendingRegion(v as Region)} className="max-w-[360px]" />
              <div className="mt-3 rounded-xl bg-page p-4 text-sm text-ink-2">
                <p className="font-medium text-ink">
                  {shownMeta.flag} {shownMeta.name} · prices in {shownMeta.currency}, {shownMeta.taxNote}
                </p>
                {shownMeta.market === "indonesia" ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>
                      Pay each period yourself (QRIS, card or virtual account) or turn on automatic renewal with a card. <Spec id="R-61" />
                    </li>
                    <li>One-time payments have no grace period: a plan that is not paid by its expiry date ends on that day.</li>
                    <li>Business plans are available in Indonesia at the same seat model as everywhere else.</li>
                  </ul>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Subscriptions renew automatically on a card, with a 14-day grace period if a payment fails.</li>
                    <li>Enterprise plans are arranged with our sales team in every region.</li>
                  </ul>
                )}
              </div>
              {pendingRegion && pendingRegion !== region && (sub || oneTime) && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-info-tint px-3 py-2 text-sm text-info">
                  <IconInfo size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Your current plan stays active after the change. Personal and Business plans are shared between regions, so nothing expires or is charged when you switch. Future bills and renewals use {shownMeta.currency}. <Spec id="R-62" />
                  </span>
                </p>
              )}
            </Field>

            <Field label="Time zone" hint="Used for envelope timestamps and the time shown on bills and reminders.">
              <select className="input max-w-[360px]" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>

            <Field label="Date format" hint="How dates appear across the workspace.">
              <select className="input max-w-[360px]" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                {DATE_FORMATS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>

            <div className="flex items-center justify-end gap-2 border-t border-line pt-5">
              <button
                className="btn-secondary"
                disabled={!dirty}
                onClick={() => {
                  setPendingRegion(null);
                  setTimezone(prefs.timezone === "auto" ? TIMEZONES[0] : prefs.timezone);
                  setDateFormat(prefs.dateFormat);
                }}
              >
                Discard
              </button>
              <button className="btn-primary" disabled={!dirty} onClick={save}>
                Save changes
              </button>
            </div>
          </div>

          <p className="mt-5 text-sm text-muted">
            Current region: {meta.flag} {meta.name}.{" "}
            <Link href="/settings/billing" className="text-ink underline">
              Go to Billing
            </Link>{" "}
            to see how it affects your plan and payment options.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[15px] font-medium text-ink">{label}</label>
      <p className="mb-2 text-sm text-muted">{hint}</p>
      {children}
    </div>
  );
}
