"use client";

import Link from "next/link";
import { useFlows } from "@/components/flows";
import { IconArrowLeft, IconCard, IconInfo, IconReceipt, IconStar, IconTrash } from "@/components/Icons";
import { CardBrandBadge } from "@/components/payments";
import { SettingsHeader } from "@/components/SettingsHeader";
import { Spec } from "@/components/ui";
import { activeSubscription, allCards, brandLabel, cardExpiresBefore, cardId, planName, planPrice } from "@/lib/engine";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Card } from "@/lib/types";

export default function PaymentMethodPage() {
  const { s, api } = useAppState();
  const flows = useFlows();
  const sub = activeSubscription(s);
  const cards = allCards(s);
  const backups = s.backupCards ?? [];
  const nextAmount = sub ? planPrice(sub.scheduledChange?.tier ?? sub.tier, sub.scheduledChange?.interval ?? sub.interval, sub.scheduledChange?.seats ?? sub.pendingSeats ?? sub.seats) : 0;
  const lastAttempt = sub?.attempts[0];

  return (
    <div>
      <SettingsHeader icon={<IconReceipt size={22} />} title="Billing" subtitle="Manage your plan and payment details" />
      <div className="px-6 py-6 sm:px-10">
        <p className="text-sm text-muted">
          <Link href="/settings/billing" className="hover:underline">
            Billing
          </Link>{" "}
          › <span className="text-ink">Payment methods</span>
        </p>
        <Link href="/settings/billing" className="btn-secondary mt-4 !py-3 !px-5 text-[15px]">
          <IconArrowLeft size={18} /> Back
        </Link>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-semibold text-ink">
              Payment methods <Spec id="UX-17" />
            </h2>
            <p className="text-[15px] text-ink-2">
              We charge your default card first. If it is declined, we try your backup cards in order before starting the 14-day grace period. <Spec id="R-19b" />
            </p>
          </div>
          <div className="flex gap-2">
            {cards.length > 0 && (
              <button className="btn-secondary" onClick={() => flows.open({ type: "addCard", makeDefault: false })}>
                Add backup card
              </button>
            )}
            <button className="btn-primary" onClick={() => flows.open({ type: "addCard", makeDefault: true })}>
              {cards.length ? "Replace default card" : "Add card"}
            </button>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="card mt-5 flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-ink-2">
              <IconCard size={20} /> No payment method on file.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {cards.map((c, i) => (
              <CardRow
                key={cardId(c)}
                card={c}
                index={i}
                isDefault={i === 0}
                sub={sub}
                canRemove={i > 0 || !sub || backups.length > 0}
                onSetDefault={() => api.setDefaultCard(cardId(c))}
                onRemove={() => flows.open({ type: "removeCard", id: cardId(c) })}
              />
            ))}
          </div>
        )}

        {sub && cards.length > 0 && (
          <div className="mt-5 rounded-xl border border-line bg-white p-5 text-sm">
            <p className="font-medium text-ink">Next charge</p>
            <p className="mt-1 text-ink-2">
              {fmtMoney(nextAmount)} on {fmtDate(sub.currentPeriodEnd)} for {planName(sub.scheduledChange?.tier ?? sub.tier, sub.scheduledChange?.interval ?? sub.interval)}. Charged to {brandLabel(cards[0].brand)} ending {cards[0].last4}
              {backups.length > 0 ? `, then ${backups.map((b) => `card ending ${b.last4}`).join(", then ")} if declined.` : "."}
            </p>
            {lastAttempt && lastAttempt.cardLast4 && (
              <p className="mt-2 text-xs text-muted">
                Last attempt: {fmtDate(lastAttempt.at)} on card ending {lastAttempt.cardLast4}, {lastAttempt.outcome.replace("_", " ")}
                {lastAttempt.declineCode ? ` (${lastAttempt.declineCode})` : ""}.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 rounded-xl bg-page p-5 text-sm text-ink-2">
          <p className="font-medium text-ink">How we use your cards</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Renewals are charged automatically on your billing date, at 00:00 UTC, to your default card. Yearly plans get a reminder 30 and 7 days before.</li>
            <li>If the default card is declined we immediately try each backup card in order. Only if every card fails do we start the 14-day grace period (retries on Day 3, 7 and 14, and right away when you update a card).</li>
            <li>Adding or replacing a card never charges you. Your bank may ask you to confirm the new card.</li>
            <li>The default card can be removed only when a backup exists (the first backup becomes the default) or when you have no active subscription.</li>
            <li>Card details are stored by Stripe; Privy only keeps the brand, last four digits and expiry.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function CardRow({
  card,
  index,
  isDefault,
  sub,
  canRemove,
  onSetDefault,
  onRemove,
}: {
  card: Card;
  index: number;
  isDefault: boolean;
  sub: ReturnType<typeof activeSubscription>;
  canRemove: boolean;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  const expiring = sub && cardExpiresBefore(card, sub.currentPeriodEnd);
  const behaviourNote =
    card.behavior === "soft_decline" ? "Prototype: this test card soft-declines" : card.behavior === "hard_decline" ? "Prototype: this test card hard-declines" : card.behavior === "requires_action" ? "Prototype: this test card asks for 3DS" : null;
  return (
    <div className={`card flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${isDefault ? "border-ink" : ""}`}>
      <div className={`flex h-[104px] w-[176px] shrink-0 flex-col justify-between rounded-xl p-3.5 text-white ${isDefault ? "bg-gradient-to-br from-[#2b2b2f] to-[#111]" : "bg-gradient-to-br from-[#6e6e73] to-[#4a4a4f]"}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest opacity-80">{isDefault ? "Default" : `Backup ${index}`}</span>
          <CardBrandBadge brand={card.brand} />
        </div>
        <p className="font-mono text-base tracking-widest">•••• {card.last4}</p>
        <p className="text-[11px] opacity-80">
          {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
        </p>
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[17px] font-medium text-ink">
            {brandLabel(card.brand)} ending {card.last4}
          </p>
          {isDefault ? <span className="chip bg-ink text-white">Default · charged first</span> : <span className="chip bg-[#eeeeee] text-ink-2">Backup {index} · used if earlier cards decline</span>}
        </div>
        <p className="text-sm text-muted">
          Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear} · added {fmtDate(card.addedAt)}
        </p>
        {expiring && (
          <p className="mt-2 flex items-center gap-2 rounded-lg bg-warn-tint px-3 py-2 text-sm text-warn">
            <IconInfo size={16} /> Expires before the next renewal on {fmtDate(sub!.currentPeriodEnd)}.
          </p>
        )}
        {behaviourNote && <p className="mt-1 text-xs text-info">{behaviourNote}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {!isDefault && (
            <button className="btn-secondary !py-2" onClick={onSetDefault}>
              <IconStar size={16} /> Set as default
            </button>
          )}
          <button className="btn-danger-outline !py-2" onClick={onRemove} disabled={!canRemove} title={canRemove ? undefined : "Add another card first, or cancel your subscription."}>
            <IconTrash size={16} /> Remove
          </button>
          {!canRemove && <span className="self-center text-xs text-muted">Only card on an active subscription.</span>}
        </div>
      </div>
    </div>
  );
}
