"use client";

import Link from "next/link";
import { useFlows } from "@/components/flows";
import { IconArrowLeft, IconCard, IconInfo, IconReceipt } from "@/components/Icons";
import { CardBrandBadge } from "@/components/payments";
import { SettingsHeader } from "@/components/SettingsHeader";
import { Spec } from "@/components/ui";
import { activeSubscription, brandLabel, cardExpiresBefore, planName, planPrice } from "@/lib/engine";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useAppState } from "@/lib/store";

export default function PaymentMethodPage() {
  const { s } = useAppState();
  const flows = useFlows();
  const sub = activeSubscription(s);
  const expiring = sub && s.card && cardExpiresBefore(s.card, sub.currentPeriodEnd);

  return (
    <div>
      <SettingsHeader icon={<IconReceipt size={22} />} title="Billing" subtitle="Manage your plan and payment details" />
      <div className="px-6 py-6 sm:px-10">
        <p className="text-sm text-muted">
          <Link href="/settings/billing" className="hover:underline">
            Billing
          </Link>{" "}
          › <span className="text-ink">Payment method</span>
        </p>
        <Link href="/settings/billing" className="btn-secondary mt-4 !py-3 !px-5 text-[15px]">
          <IconArrowLeft size={18} /> Back
        </Link>

        <h2 className="mt-8 text-[19px] font-semibold text-ink">
          Payment method <Spec id="UX-17" />
        </h2>
        <p className="text-[15px] text-ink-2">One card per account. We charge it automatically for renewals and for plan changes you confirm.</p>

        <div className="card mt-5 p-6">
          {s.card ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-[120px] w-[200px] flex-col justify-between rounded-xl bg-gradient-to-br from-[#2b2b2f] to-[#111] p-4 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest opacity-70">Default</span>
                  <CardBrandBadge brand={s.card.brand} />
                </div>
                <p className="font-mono text-lg tracking-widest">•••• •••• •••• {s.card.last4}</p>
                <p className="text-xs opacity-80">
                  {s.user.name.toUpperCase()} · {String(s.card.expMonth).padStart(2, "0")}/{String(s.card.expYear).slice(-2)}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-[17px] font-medium text-ink">
                  {brandLabel(s.card.brand)} ending {s.card.last4}
                </p>
                <p className="text-sm text-muted">
                  Expires {String(s.card.expMonth).padStart(2, "0")}/{s.card.expYear} · added {fmtDate(s.card.addedAt)}
                </p>
                {expiring && (
                  <p className="mt-2 flex items-center gap-2 rounded-lg bg-warn-tint px-3 py-2 text-sm text-warn">
                    <IconInfo size={16} /> This card expires before your next renewal on {fmtDate(sub!.currentPeriodEnd)}. Replace it to avoid an interruption.
                  </p>
                )}
                {sub && (
                  <p className="mt-2 text-sm text-ink-2">
                    Next charge: {fmtMoney(planPrice(sub.scheduledChange?.tier ?? sub.tier, sub.scheduledChange?.interval ?? sub.interval, sub.scheduledChange?.seats ?? sub.seats))} on{" "}
                    {fmtDate(sub.currentPeriodEnd)} for {planName(sub.scheduledChange?.tier ?? sub.tier, sub.scheduledChange?.interval ?? sub.interval)}.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => flows.open({ type: "replaceCard" })}>
                    Replace card
                  </button>
                  {sub ? (
                    <span className="flex items-center gap-2 text-sm text-muted" title="Cancel your subscription first to remove your card.">
                      <button className="btn-secondary" disabled>
                        Remove card
                      </button>
                      Cancel your subscription first to remove your card.
                    </span>
                  ) : (
                    <button className="btn-secondary" onClick={() => alert("Prototype: card removed (no active subscription).")}>
                      Remove card
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="flex items-center gap-2 text-ink-2">
                <IconCard size={20} /> No payment method on file.
              </p>
              <button className="btn-primary" onClick={() => flows.open({ type: "replaceCard" })}>
                Add card
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl bg-page p-5 text-sm text-ink-2">
          <p className="font-medium text-ink">How we use your card</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Renewals are charged automatically on your billing date, at 00:00 UTC. Yearly plans get a reminder 30 and 7 days before.</li>
            <li>If a charge fails you keep full access for 14 days while we retry (Day 3, 7 and 14) and right away when you update the card.</li>
            <li>Replacing the card never charges you. Your bank may ask you to confirm the new card.</li>
            <li>Card details are stored by Stripe; Privy only keeps the brand, last four digits and expiry.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
