"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ANNUAL_SAVINGS, TIER_LABEL } from "@/lib/catalog";
import { activeSubscription, classifyChange, intervalWord, periodEnd, planName, planPrice } from "@/lib/engine";
import { addDays, daysBetween, dayOfMonthUTC, fmtDate, fmtMoney, startOfDayUTC } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Card, Interval, PaidTier } from "@/lib/types";
import { IconCheckCircle, IconChevronRight, IconGift, IconMinus, IconPlus, IconShield, IconWarning } from "./Icons";
import { CardForm, cardFormValid, cardFromForm, Radio, SavedCardRow, ThreeDSModal, WalletButtons, type CardFormValue } from "./payments";
import { Checkbox, Drawer, Spec } from "./ui";

export type CheckoutMode = "subscribe" | "upgrade" | "interval";

export function CheckoutDrawer({
  open,
  onClose,
  mode,
  tier,
  interval: initialInterval,
  seats: initialSeats,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  mode: CheckoutMode;
  tier: PaidTier;
  interval: Interval;
  seats: number;
  onDone: () => void;
}) {
  const { s, api } = useAppState();
  const sub = activeSubscription(s);
  const [interval, setInterval] = useState<Interval>(initialInterval);
  const [seats, setSeats] = useState(Math.max(1, initialSeats));
  const [useSaved, setUseSaved] = useState(!!s.card);
  const [form, setForm] = useState<CardFormValue>({ number: "", exp: "", cvc: "", name: "" });
  const [consent, setConsent] = useState(false);
  const [ack, setAck] = useState(false);
  const [stage, setStage] = useState<"form" | "processing" | "3ds" | "declined" | "success">("form");
  const [declineMsg, setDeclineMsg] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promo, setPromo] = useState("");

  const amount = planPrice(tier, interval, seats);
  const today = startOfDayUTC(s.now);
  const anchorDay = dayOfMonthUTC(today);
  const [direction] = useState(() => classifyChange(s, { tier, interval }));
  const [frozen] = useState(() => ({ sub, remaining: sub ? Math.max(0, daysBetween(startOfDayUTC(s.now), sub.currentPeriodEnd)) : 0 }));
  const remaining = frozen.remaining;
  const oldSub = frozen.sub;
  const rolled = direction === "interval_up" && oldSub && oldSub.status !== "past_due" ? remaining : 0;
  const newEnd = useMemo(() => {
    const e = periodEnd(today, interval, anchorDay);
    return rolled > 0 ? addDays(e, rolled) : e;
  }, [today, interval, anchorDay, rolled]);

  const isTierUpgrade = mode === "upgrade";
  const card: Card | null = useSaved && s.card ? s.card : cardFormValid(form) ? cardFromForm(form, s.now) : null;
  const consentText = `I agree that Privy will charge ${fmtMoney(amount)} to my card every ${intervalWord(interval)}${mode === "subscribe" ? " starting today" : ""} until I cancel. I can cancel any time from Plan settings and keep access until the end of the paid period.`;
  const ackText = oldSub ? `I understand my current ${planName(oldSub.tier, oldSub.interval)}, paid until ${fmtDate(oldSub.currentPeriodEnd)} (${remaining} days), will end today and is not refunded or credited.` : "";
  const canPay = !!card && consent && (!isTierUpgrade || ack) && stage === "form";

  function complete(finalCard: Card) {
    if (mode === "subscribe") {
      api.completeSubscription({ tier, interval, seats, card: finalCard, consentText });
    } else {
      api.upgradeNow({ tier, interval, seats, consentText: isTierUpgrade ? `${ackText} ${consentText}` : consentText, card: finalCard });
    }
    setStage("success");
  }

  function pay() {
    if (!card) return;
    setStage("processing");
    setTimeout(() => {
      switch (card.behavior) {
        case "success":
          complete(card);
          break;
        case "requires_action":
          setStage("3ds");
          break;
        case "soft_decline":
          setDeclineMsg("Your bank declined the card (insufficient funds). Your current plan is unchanged. Try another card or contact your bank.");
          setStage("declined");
          break;
        case "hard_decline":
          setDeclineMsg("Your bank told us this card cannot be used (expired or blocked). Your current plan is unchanged. Please add a different card.");
          setStage("declined");
          break;
      }
    }, 900);
  }

  const savings = ANNUAL_SAVINGS[tier];
  const titles: Record<CheckoutMode, string> = { subscribe: "Checkout", upgrade: "Checkout", interval: "Switch to yearly billing" };

  if (stage === "success") {
    const end = fmtDate(newEnd);
    return (
      <Drawer open={open} onClose={onDone} title="Payment successful">
        <div className="flex flex-col items-center py-8 text-center">
          <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success-tint text-success">
            <IconCheckCircle size={36} />
          </span>
          <h3 className="font-display text-2xl font-semibold text-ink">You are now on {planName(tier, interval)}</h3>
          <p className="mt-2 max-w-sm text-sm text-ink-2">
            We charged {fmtMoney(amount)} to your card ending {card?.last4 ?? s.card?.last4}. Your plan runs until <strong>{end}</strong> and renews automatically. A receipt is on its way to {s.user.email}.
          </p>
          {isTierUpgrade && oldSub && (
            <p className="mt-3 max-w-sm rounded-lg bg-page px-3 py-2 text-xs text-muted">
              Your previous {planName(oldSub.tier, oldSub.interval)} ended today. Your billing date is now the {anchorDay}
              {ordinal(anchorDay)} of each {intervalWord(interval)}.
            </p>
          )}
          <div className="mt-6 flex gap-2">
            <Link href="/settings/billing" className="btn-secondary" onClick={onDone}>
              Go to Billing
            </Link>
            <button className="btn-primary" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      </Drawer>
    );
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={titles[mode]}
        spec="M-01"
        footer={
          <div className="space-y-3">
            <button className="flex w-full items-center justify-between py-1 text-[15px]" onClick={() => setPromoOpen((v) => !v)}>
              <span className="flex items-center gap-2 text-ink">
                <IconGift size={18} className="text-muted" /> Promo code
              </span>
              <span className="flex items-center gap-1 text-ink-2">
                {promo ? promo.toUpperCase() : "Add"} <IconChevronRight size={16} />
              </span>
            </button>
            {promoOpen && (
              <div className="flex gap-2">
                <input className="input" placeholder="Enter promo code" value={promo} onChange={(e) => setPromo(e.target.value)} />
                <button className="btn-secondary" onClick={() => setPromoOpen(false)}>
                  Apply
                </button>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-3 text-[15px]">
              <span className="text-ink">Grand total</span>
              <span className="flex items-center gap-1 font-semibold text-ink">
                {fmtMoney(amount)} <IconChevronRight size={16} className="text-muted" />
              </span>
            </div>
            <div className="rounded-lg bg-page px-3 py-2 text-xs text-ink-2">
              <Spec id="UX-06" className="float-right" />
              <div className="flex justify-between">
                <span>Today</span>
                <strong className="text-ink">{fmtMoney(amount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Next renewal</span>
                <strong className="text-ink">
                  {fmtDate(newEnd)}, {fmtMoney(amount)}
                </strong>
              </div>
              {rolled > 0 && (
                <div className="mt-1 text-[11px] text-muted">
                  Your {rolled} remaining days are added, so the new end date is {fmtDate(newEnd)}.
                </div>
              )}
            </div>
            {stage === "declined" && (
              <div className="flex items-start gap-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                <IconWarning size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p>{declineMsg}</p>
                  <button
                    className="mt-1 text-xs font-semibold underline"
                    onClick={() => {
                      setUseSaved(false);
                      setStage("form");
                    }}
                  >
                    Use another card
                  </button>
                  <Spec id="UX-15" className="ml-2" />
                </div>
              </div>
            )}
            <button className="btn-primary h-12 w-full text-base" disabled={!canPay} onClick={pay}>
              <IconShield size={18} /> {stage === "processing" ? "Processing…" : `Pay ${fmtMoney(amount)}`}
            </button>
            <p className="text-center text-[11px] text-muted">
              Your bank may ask you to confirm this payment. <Spec id="UX-14" />
            </p>
          </div>
        }
      >
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-[17px] font-medium text-ink">Selected plan</h3>
            <div className="space-y-3">
              {(["monthly", "annual"] as Interval[]).map((iv) => {
                const price = planPrice(tier, iv, seats);
                const selected = iv === interval;
                const disabled = mode === "interval" && iv === "monthly";
                return (
                  <button
                    key={iv}
                    type="button"
                    disabled={disabled}
                    onClick={() => setInterval(iv)}
                    className={`w-full rounded-2xl border px-5 py-4 text-left ${selected ? "border-maroon" : "border-line-2"} ${disabled ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[17px] font-medium text-ink">
                        {TIER_LABEL[tier]} {iv === "monthly" ? "Monthly" : "Yearly"}
                        {iv === "annual" && <span className="chip bg-gold text-white">★ SAVE {savings.pct}%</span>}
                      </span>
                      <Radio on={selected} />
                    </div>
                    <div className="mt-1 text-[22px] font-semibold text-ink">
                      {fmtMoney(price)} <span className="text-sm font-normal text-muted">/{iv === "monthly" ? "month" : "year"}{tier === "business" ? ` · ${seats} seat${seats > 1 ? "s" : ""}` : ""}</span>
                    </div>
                    <div className="mt-1 text-sm text-ink-2">
                      {iv === "monthly" ? "Monthly" : "Yearly"} billing starting today. Cancel anytime online.{" "}
                      <Link href="#" className="font-medium text-maroon underline">
                        Terms apply.
                      </Link>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {tier === "business" && (
            <section>
              <h3 className="mb-2 text-[17px] font-medium text-ink">Member seats</h3>
              <div className="flex items-center gap-3">
                <button type="button" className="btn-secondary !px-3" onClick={() => setSeats((v) => Math.max(1, v - 1))} aria-label="Fewer seats">
                  <IconMinus size={16} />
                </button>
                <span className="w-8 text-center text-[17px] font-medium">{seats}</span>
                <button type="button" className="btn-secondary !px-3" onClick={() => setSeats((v) => Math.min(50, v + 1))} aria-label="More seats">
                  <IconPlus size={16} />
                </button>
                <span className="text-sm text-ink-2">
                  {fmtMoney(planPrice(tier, interval, 1))} per seat per {intervalWord(interval)}. Includes you.
                </span>
              </div>
            </section>
          )}

          {isTierUpgrade && oldSub && (
            <section className="rounded-xl border border-[#f2b9a5] bg-[#fff4ee] p-4">
              <p className="text-sm font-semibold text-ink">
                Upgrading now ends your {planName(oldSub.tier, oldSub.interval)} today <Spec id="UX-05" />
              </p>
              <p className="mt-1 text-sm text-ink-2">
                Your current plan is paid until {fmtDate(oldSub.currentPeriodEnd)} ({remaining} days). That time is not refunded or credited, as per Privy's plan terms.
              </p>
              <div className="mt-3">
                <Checkbox checked={ack} onChange={setAck} id="ack">
                  {ackText}
                </Checkbox>
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[17px] font-medium text-ink">Payment method</h3>
            <div className="space-y-3">
              {s.card && (
                <SavedCardRow card={s.card} selected={useSaved} onSelect={() => setUseSaved(true)} />
              )}
              <button
                type="button"
                onClick={() => setUseSaved(false)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-[15px] ${!useSaved ? "border-ink" : "border-line-2 hover:bg-page"}`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-muted">
                    <IconCardSmall />
                  </span>
                  {s.card ? "Use a different card" : "Credit or debit card"}
                </span>
                <Radio on={!useSaved} />
              </button>
              {!useSaved && <CardForm value={form} onChange={setForm} nowIso={s.now} />}
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" /> or pay with <span className="h-px flex-1 bg-line" />
              </div>
              <WalletButtons
                onPick={() => {
                  setUseSaved(false);
                  setForm({ number: "4242 4242 4242 4242", exp: "12 / 27", cvc: "123", name: s.user.name });
                }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm text-ink-2">
              By agreeing, you authorize Privy to automatically renew your subscription {interval === "monthly" ? "monthly" : "yearly"} until you choose to cancel. You may cancel at any time, but refunds are not provided upon cancellation. Full terms and instructions on how to cancel available{" "}
              <Link href="#" className="font-medium text-maroon underline">
                here.
              </Link>
            </p>
            <Checkbox checked={consent} onChange={setConsent} id="consent">
              {consentText} <Spec id="R-12" />
            </Checkbox>
          </section>
        </div>
      </Drawer>
      {stage === "3ds" && card && (
        <ThreeDSModal
          amount={fmtMoney(amount)}
          last4={card.last4}
          onApprove={() => complete({ ...card, behavior: "success" })}
          onCancel={() => {
            setDeclineMsg("Authentication was cancelled. Nothing was charged and your current plan is unchanged.");
            setStage("declined");
          }}
        />
      )}
    </>
  );
}

function IconCardSmall() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
