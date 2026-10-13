"use client";

import React, { useState } from "react";
import { brandLabel, cardCheckAmount, cardFromNumber, isIndonesia, TEST_CARDS } from "@/lib/engine";
import { fmtMoney } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Card } from "@/lib/types";
import { IconApple, IconBank, IconCard, IconGoogle, IconLock, IconShieldCheck } from "./Icons";
import { Spec } from "./ui";

export function CardBrandBadge({ brand }: { brand: Card["brand"] }) {
  const map = { visa: ["VISA", "#1a1f71"], mastercard: ["MC", "#eb001b"], amex: ["AMEX", "#2e77bb"] } as const;
  const [label, color] = map[brand];
  return (
    <span className="inline-flex h-6 min-w-[40px] items-center justify-center rounded border border-line bg-white px-1.5 text-[10px] font-bold tracking-wide" style={{ color }}>
      {label}
    </span>
  );
}

export function SavedCardRow({ card, selected, onSelect, radio = true }: { card: Card; selected?: boolean; onSelect?: () => void; radio?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left ${selected ? "border-ink" : "border-line-2"} ${onSelect ? "hover:bg-page" : "cursor-default"}`}
    >
      <CardBrandBadge brand={card.brand} />
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-ink">
          {brandLabel(card.brand)} ending {card.last4}
        </span>
        <span className="block text-xs text-muted">
          Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}
        </span>
      </span>
      {radio && <Radio on={!!selected} />}
    </button>
  );
}

export function Radio({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-maroon" : "border-line-2"}`}>
      {on && <span className="h-2.5 w-2.5 rounded-full bg-maroon" />}
    </span>
  );
}

export interface CardFormValue {
  number: string;
  exp: string;
  cvc: string;
  name: string;
}

export function CardForm({
  value,
  onChange,
  nowIso,
  compact,
}: {
  value: CardFormValue;
  onChange: (v: CardFormValue) => void;
  nowIso: string;
  compact?: boolean;
}) {
  const [showTest, setShowTest] = useState(false);
  const helpers = useAppState().s.ui.showSpecTags;
  const set = (k: keyof CardFormValue, v: string) => onChange({ ...value, [k]: v });
  const digits = value.number.replace(/\D/g, "");
  const known = TEST_CARDS.find((c) => c.number.replace(/\s/g, "") === digits);
  const preview = digits.length >= 12 ? cardFromNumber(value.number, 12, 2030, nowIso) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line-2 bg-white p-3">
        <label className="mb-1 block text-xs font-medium text-muted">Card number</label>
        <div className="flex items-center gap-2 rounded-lg border border-line-2 px-3 py-2.5 focus-within:border-ink">
          <IconCard size={18} className="text-muted" />
          <input
            inputMode="numeric"
            autoComplete="cc-number"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
            placeholder="1234 1234 1234 1234"
            value={value.number}
            onChange={(e) => set("number", formatCardNumber(e.target.value))}
          />
          {preview && <CardBrandBadge brand={preview.brand} />}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Expiry</label>
            <input className="input" placeholder="MM / YY" inputMode="numeric" autoComplete="cc-exp" value={value.exp} onChange={(e) => set("exp", formatExp(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">CVC</label>
            <input className="input" placeholder="CVC" inputMode="numeric" autoComplete="cc-csc" value={value.cvc} onChange={(e) => set("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </div>
        </div>
        {!compact && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-muted">Name on card</label>
            <input className="input" placeholder="Name on card" autoComplete="cc-name" value={value.name} onChange={(e) => set("name", e.target.value)} />
          </div>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <IconLock size={12} /> Card details stay with the payment provider and are never stored by Privy. <Spec id="R-52" />
        </p>
      </div>
      {helpers && known && (
        <p className="rounded-lg bg-info-tint px-3 py-2 text-xs text-info">
          Test card: <strong>{known.label.toLowerCase()}</strong>.
        </p>
      )}
      {helpers && (
        <button type="button" className="text-xs font-medium text-brand underline-offset-2 hover:underline" onClick={() => setShowTest((v) => !v)}>
          {showTest ? "Hide test cards" : "Use a test card"}
        </button>
      )}
      {helpers && showTest && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {TEST_CARDS.map((c) => (
            <button
              key={c.number}
              type="button"
              onClick={() => onChange({ ...value, number: c.number, exp: value.exp || "12 / 27", cvc: value.cvc || "123", name: value.name || "Frans" })}
              className="rounded-lg border border-line-2 px-3 py-2 text-left text-xs hover:bg-page"
            >
              <span className="block font-mono text-[12px] text-ink">{c.number}</span>
              <span className="text-muted">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function cardFormValid(v: CardFormValue): boolean {
  const digits = v.number.replace(/\D/g, "");
  const exp = v.exp.replace(/\D/g, "");
  return digits.length >= 15 && exp.length === 4 && v.cvc.length >= 3;
}

export function cardFromForm(v: CardFormValue, nowIso: string): Card {
  const exp = v.exp.replace(/\D/g, "");
  const mm = parseInt(exp.slice(0, 2), 10) || 12;
  const yy = parseInt(exp.slice(2, 4), 10) || 30;
  return cardFromNumber(v.number, Math.min(12, Math.max(1, mm)), 2000 + yy, nowIso);
}

function formatCardNumber(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}
function formatExp(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

export function WalletButtons({ onPick }: { onPick: (kind: "apple" | "google") => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => onPick("apple")} className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-black text-sm font-semibold text-white">
        <IconApple size={16} /> Pay
      </button>
      <button type="button" onClick={() => onPick("google")} className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-line-2 bg-white text-sm font-semibold text-ink">
        <IconGoogle size={16} /> Pay
      </button>
    </div>
  );
}

/** M-07: simulated bank authentication (3DS). */
export function ThreeDSModal({ amount, onApprove, onCancel, last4 }: { amount: string; onApprove: () => void; onCancel: () => void; last4: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="animate-fade w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 bg-[#0b2a4a] px-5 py-3 text-white">
          <IconBank size={18} />
          <span className="text-sm font-semibold">Your bank · Secure checkout</span>
          <Spec id="M-07" className="ml-auto" />
        </div>
        <div className="space-y-3 px-5 py-5 text-sm text-ink-2">
          <p className="text-base font-semibold text-ink">Confirm this payment</p>
          <p>
            Privy Pty Ltd is requesting <strong className="text-ink">{amount}</strong> on your card ending {last4}. Approve in your banking app or confirm below.
          </p>
          <p className="rounded-lg bg-page px-3 py-2 text-xs text-muted">
            Privy shows this step only when your bank requires it. You will be returned to the same screen automatically.
          </p>
          <div className="flex gap-2 pt-1">
            <button className="btn-secondary flex-1" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn flex-1 bg-[#0b2a4a] text-white hover:bg-[#123a63]"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setTimeout(onApprove, 700);
              }}
            >
              <IconShieldCheck size={16} /> {busy ? "Confirming…" : "Approve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Card details are never typed into a Privy page: they go to the payment provider's hosted page
 *  (Stripe for Privy Global, Doku for Privy Indonesia), shown here as an embedded secure frame (R-90). */
export function cardProvider(indonesia: boolean): { name: string; host: string; color: string } {
  return indonesia ? { name: "DOKU", host: "checkout.doku.com", color: "#e2231a" } : { name: "stripe", host: "checkout.stripe.com", color: "#635bff" };
}

/** Line shown in Privy where a card form used to be. */
export function HostedCardNote({ action = "pay" }: { action?: "pay" | "save" }) {
  const { s } = useAppState();
  const p = cardProvider(isIndonesia(s));
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line-2 bg-page px-4 py-3 text-sm text-ink-2">
      <IconLock size={16} className="mt-0.5 shrink-0 text-muted" />
      <span>
        You enter your card on {p.name === "stripe" ? "Stripe" : "Doku"}&apos;s secure page; Privy never sees or stores the card number.
        {action === "save" ? ` To check the card we charge ${fmtMoney(cardCheckAmount(s))} and reverse it right away.` : ""} <Spec id="R-90" />
      </span>
    </div>
  );
}

/**
 * Simulated provider page. purpose "pay": the provider charges `amount` and returns the card.
 * purpose "save": the provider charges the card check amount, reverses it, and returns the card.
 * Declines are shown on the provider page; 3DS runs inside it.
 */
export function HostedCardPage({ purpose, amount, description, onComplete, onCancel }: { purpose: "pay" | "save"; amount?: number; description: string; onComplete: (card: Card) => void; onCancel: () => void }) {
  const { s } = useAppState();
  const indonesia = isIndonesia(s);
  const p = cardProvider(indonesia);
  const check = cardCheckAmount(s);
  const [form, setForm] = useState<CardFormValue>({ number: "", exp: "", cvc: "", name: "" });
  const [stage, setStage] = useState<"form" | "processing" | "3ds">("form");
  const [error, setError] = useState<string | null>(null);
  const shown = purpose === "pay" ? amount ?? 0 : check;

  function submit() {
    const card = cardFromForm(form, s.now);
    setError(null);
    setStage("processing");
    setTimeout(() => {
      if (card.behavior === "hard_decline") {
        setError("Your card was declined. Use a different card.");
        setStage("form");
      } else if (card.behavior === "soft_decline" && purpose === "pay") {
        setError("Your card has insufficient funds. Use a different card or contact your bank.");
        setStage("form");
      } else if (card.behavior === "requires_action") {
        setStage("3ds");
      } else {
        onComplete(card);
      }
    }, 700);
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`${p.name} secure payment page`}>
      <div className="animate-fade flex max-h-[95vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line bg-[#f6f6f7] px-4 py-2 text-xs text-muted">
          <IconLock size={12} className="text-success" />
          <span className="truncate font-mono">https://{p.host}/{purpose === "pay" ? "pay" : "setup"}/privy</span>
          <Spec id="R-90" className="ml-auto" />
        </div>
        <div className="overflow-y-auto px-6 pb-6 pt-5">
          <div className="flex items-center justify-between">
            <button className="text-sm text-muted hover:text-ink" onClick={onCancel}>
              ← Back to Privy
            </button>
            <span className="text-lg font-bold tracking-tight" style={{ color: p.color }}>
              {p.name}
            </span>
          </div>
          <p className="mt-5 text-sm text-muted">Privy</p>
          <p className="text-[26px] font-semibold text-ink">{fmtMoney(shown)}</p>
          <p className="mt-1 text-sm text-ink-2">{description}</p>
          {purpose === "save" && (
            <p className="mt-2 rounded-lg bg-[#f6f6f7] px-3 py-2 text-xs text-ink-2">
              {fmtMoney(check)} is charged to check the card and reversed right away. Your bank may show it for a few days.
            </p>
          )}
          <div className="mt-5">
            <CardForm value={form} onChange={setForm} nowIso={s.now} compact />
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            className="btn mt-4 h-12 w-full text-base text-white disabled:opacity-50"
            style={{ background: p.color }}
            disabled={!cardFormValid(form) || stage !== "form"}
            onClick={submit}
          >
            {stage === "processing" ? "Processing…" : purpose === "pay" ? `Pay ${fmtMoney(shown)}` : "Save card"}
          </button>
          <p className="mt-3 text-center text-[11px] text-muted">
            Powered by {p.name === "stripe" ? "Stripe" : "DOKU"} · Terms · Privacy
          </p>
        </div>
      </div>
      {stage === "3ds" && (
        <ThreeDSModal
          amount={fmtMoney(shown)}
          last4={cardFromForm(form, s.now).last4}
          onApprove={() => onComplete({ ...cardFromForm(form, s.now), behavior: "success" })}
          onCancel={() => {
            setStage("form");
            setError("Authentication was cancelled. Nothing was charged.");
          }}
        />
      )}
    </div>
  );
}
