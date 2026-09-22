"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PAYMENT_ID_VALID_HOURS, REGIONS, TIER_LABEL, VA_BANKS, regionMeta } from "@/lib/catalog";
import { intervalWord, isOneTimeUser, methodLabel, paymentMethodsFor, periodEnd, planName, planPrice, prepaidEnd, regionOf } from "@/lib/engine";
import { dayOfMonthUTC, fmtDate, fmtDateTime, fmtMoney, isSameOrAfter, startOfDayUTC } from "@/lib/format";
import { useAppState } from "@/lib/store";
import type { Bill, Card, Interval, PaidTier, PaymentMethodKind, PurchaseType, VaBank } from "@/lib/types";
import { IconBank, IconCard, IconCheckCircle, IconChevronDown, IconDownload, IconInfo, IconMinus, IconPlus, IconQr, IconReceipt, IconRefresh, IconShield } from "./Icons";
import { CardForm, cardFormValid, cardFromForm, Radio, SavedCardRow, type CardFormValue } from "./payments";
import { Checkbox, Drawer, Modal, Spec } from "./ui";

/* ------------------------------------------------------------------ */
/* M-10: How do you want to pay? (Indonesia only)                        */
/* ------------------------------------------------------------------ */
export function PurchaseTypeModal({
  tier,
  interval,
  seats,
  close,
  onPick,
}: {
  tier: PaidTier;
  interval: Interval;
  seats: number;
  close: () => void;
  onPick: (t: PurchaseType) => void;
}) {
  const { s } = useAppState();
  const [choice, setChoice] = useState<PurchaseType>("recurring");
  const amount = planPrice(tier, interval, seats);
  const oneTime = isOneTimeUser(s);
  const pe = prepaidEnd(s);
  const region = regionMeta(regionOf(s));
  return (
    <Modal
      open
      onClose={close}
      title="How do you want to pay?"
      spec="M-10"
      width="max-w-xl"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onPick(choice)}>
            Continue
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm">
          {planName(tier, interval)}
          {tier === "business" ? ` × ${seats} seat${seats > 1 ? "s" : ""}` : ""}: <strong className="text-ink">{fmtMoney(amount)}</strong> per {intervalWord(interval)} ({region.taxNote}).
          {oneTime && pe && <span> Your current plan runs until {fmtDate(pe)}; the new period starts after it.</span>}
        </p>
        <TypeCard
          on={choice === "recurring"}
          onClick={() => setChoice("recurring")}
          title="Auto-renewal"
          badge="Recommended"
          lines={[
            "Pay with a credit or debit card. We charge it automatically every " + intervalWord(interval) + ".",
            "If a charge fails you keep full access for 14 days while we retry.",
            "Cancel any time online; access continues until the end of the paid period.",
          ]}
        />
        <TypeCard
          on={choice === "one_time"}
          onClick={() => setChoice("one_time")}
          title="One-time purchase"
          lines={[
            "Pay for this period only with QRIS, virtual account (BRI, BCA, CIMB, Mandiri, Permata) or card.",
            "We send you a bill 7 days before the plan expires. Pay it to continue, or let it expire.",
            "No automatic charge and no grace period: the plan ends on its expiry date if the bill is unpaid.",
          ]}
        />
        <p className="text-xs text-muted">
          Both options are the same Privy subscription; only the way you pay differs. You can switch from one-time to auto-renewal later from Billing. <Spec id="R-60" />
        </p>
      </div>
    </Modal>
  );
}

function TypeCard({ on, onClick, title, badge, lines }: { on: boolean; onClick: () => void; title: string; badge?: string; lines: string[] }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-2xl border px-5 py-4 text-left ${on ? "border-maroon bg-brand-tint/30" : "border-line-2 hover:bg-page"}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[16px] font-semibold text-ink">
          {title}
          {badge && <span className="chip bg-gold text-white">{badge}</span>}
        </span>
        <Radio on={on} />
      </div>
      <ul className="mt-2 space-y-1 text-sm text-ink-2">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="text-muted">•</span>
            {l}
          </li>
        ))}
      </ul>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* M-11 + M-01 variant: one-time checkout (pick a method, generate a Payment ID) */
/* ------------------------------------------------------------------ */
export function OneTimeCheckoutDrawer({
  tier,
  interval: initialInterval,
  seats: initialSeats,
  bill,
  close,
  onPaymentCreated,
}: {
  tier: PaidTier;
  interval: Interval;
  seats: number;
  /** When paying an existing renewal bill, plan/interval/seats are fixed. */
  bill?: Bill;
  close: () => void;
  onPaymentCreated: () => void;
}) {
  const { s, api } = useAppState();
  const [interval, setInterval] = useState<Interval>(bill?.interval ?? initialInterval);
  const [seats, setSeats] = useState(bill?.seats ?? Math.max(1, initialSeats));
  const methods = paymentMethodsFor(s, "one_time");
  const [method, setMethod] = useState<PaymentMethodKind>("qris");
  const [bank, setBank] = useState<VaBank>("BCA");
  const [useSaved, setUseSaved] = useState(!!s.card);
  const [form, setForm] = useState<CardFormValue>({ number: "", exp: "", cvc: "", name: "" });
  const [saveCard, setSaveCard] = useState(true);
  const [busy, setBusy] = useState(false);
  const region = regionMeta(regionOf(s));

  const amount = bill ? bill.amount : planPrice(tier, interval, seats);
  const pe = prepaidEnd(s);
  const start = bill ? bill.periodStart : isOneTimeUser(s) && pe && isSameOrAfter(pe, startOfDayUTC(s.now)) ? pe : startOfDayUTC(s.now);
  const end = bill ? bill.periodEnd : periodEnd(start, interval, dayOfMonthUTC(start));
  const card: Card | null = method !== "card" ? null : useSaved && s.card ? s.card : cardFormValid(form) ? cardFromForm(form, s.now) : null;
  const canPay = !busy && (method !== "card" || !!card);

  function pay() {
    setBusy(true);
    setTimeout(() => {
      const newCard = method === "card" && !useSaved && card ? card : undefined;
      if (bill) api.payBill(bill.id, method, method === "va" ? bank : undefined, method === "card" ? card ?? undefined : undefined, !!newCard && saveCard);
      else api.startOneTimePurchase({ tier, interval, seats, method, bank: method === "va" ? bank : undefined, card: method === "card" ? card ?? undefined : undefined, saveCard: !!newCard && saveCard });
      onPaymentCreated();
    }, 500);
  }

  return (
    <Drawer
      open
      onClose={close}
      title={bill ? "Pay your bill" : "Checkout"}
      spec="M-11"
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between border-t border-line pt-3 text-[15px]">
            <span className="text-ink">Grand total</span>
            <span className="font-semibold text-ink">{fmtMoney(amount)}</span>
          </div>
          <div className="rounded-lg bg-page px-3 py-2 text-xs text-ink-2">
            <Spec id="UX-06" className="float-right" />
            <div className="flex justify-between">
              <span>Today (once)</span>
              <strong className="text-ink">{fmtMoney(amount)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Plan active</span>
              <strong className="text-ink">
                {fmtDate(start)} to {fmtDate(end)}
              </strong>
            </div>
            <div className="mt-1 text-[11px] text-muted">No automatic renewal. We will send a bill 7 days before {fmtDate(end)}.</div>
          </div>
          <button className="btn-primary h-12 w-full text-base" disabled={!canPay} onClick={pay}>
            <IconShield size={18} /> {busy ? "Generating Payment ID…" : method === "card" ? `Pay ${fmtMoney(amount)}` : `Continue to ${method === "qris" ? "QRIS" : `${bank} virtual account`}`}
          </button>
          <p className="text-center text-[11px] text-muted">
            A Payment ID valid for {PAYMENT_ID_VALID_HOURS} hours is created; nothing is charged until you complete the payment. <Spec id="R-62" />
          </p>
        </div>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-[17px] font-medium text-ink">Selected plan</h3>
          {bill ? (
            <div className="rounded-2xl border border-maroon px-5 py-4">
              <p className="text-[17px] font-medium text-ink">
                {planName(bill.tier, bill.interval)}
                {bill.tier === "business" ? ` × ${bill.seats} seats` : ""}
              </p>
              <p className="mt-1 text-[22px] font-semibold text-ink">
                {fmtMoney(bill.amount)} <span className="text-sm font-normal text-muted">for {fmtDate(bill.periodStart)} to {fmtDate(bill.periodEnd)}</span>
              </p>
              <p className="mt-1 text-sm text-ink-2">Bill issued {fmtDate(bill.issuedAt)}. Pay before {fmtDate(bill.dueAt)}; the plan expires on that date if unpaid.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(["monthly", "annual"] as Interval[]).map((iv) => {
                const price = planPrice(tier, iv, seats);
                const selected = iv === interval;
                return (
                  <button key={iv} type="button" onClick={() => setInterval(iv)} className={`w-full rounded-2xl border px-5 py-4 text-left ${selected ? "border-maroon" : "border-line-2"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[17px] font-medium text-ink">
                        {TIER_LABEL[tier]} {iv === "monthly" ? "Monthly" : "Yearly"} · one-time
                      </span>
                      <Radio on={selected} />
                    </div>
                    <div className="mt-1 text-[22px] font-semibold text-ink">
                      {fmtMoney(price)} <span className="text-sm font-normal text-muted">/{iv === "monthly" ? "month" : "year"}{tier === "business" ? ` · ${seats} seat${seats > 1 ? "s" : ""}` : ""} · {region.taxNote}</span>
                    </div>
                    <div className="mt-1 text-sm text-ink-2">Paid once. Does not renew automatically.</div>
                  </button>
                );
              })}
              {tier === "business" && (
                <div className="flex items-center gap-3">
                  <button type="button" className="btn-secondary !px-3" onClick={() => setSeats((v) => Math.max(1, v - 1))} aria-label="Fewer seats">
                    <IconMinus size={16} />
                  </button>
                  <span className="w-8 text-center text-[17px] font-medium">{seats}</span>
                  <button type="button" className="btn-secondary !px-3" onClick={() => setSeats((v) => Math.min(50, v + 1))} aria-label="More seats">
                    <IconPlus size={16} />
                  </button>
                  <span className="text-sm text-ink-2">
                    {fmtMoney(planPrice(tier, interval, 1))} per seat per {intervalWord(interval)}. Seats are fixed for a one-time period; change them when you buy the next one.
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[17px] font-medium text-ink">
            Payment method <Spec id="R-61" />
          </h3>
          <div className="space-y-2">
            {methods.includes("qris") && (
              <MethodRow on={method === "qris"} onClick={() => setMethod("qris")} icon={<IconQr size={20} />} title="QRIS" sub="Scan with any Indonesian banking or e-wallet app (GoPay, OVO, DANA, ShopeePay, bank apps)" />
            )}
            {methods.includes("card") && (
              <MethodRow on={method === "card"} onClick={() => setMethod("card")} icon={<IconCard size={20} />} title="Card" sub="Debit or credit card (Visa, Mastercard, JCB)" />
            )}
            {method === "card" && (
              <div className="ml-2 space-y-3 border-l-2 border-line pl-4">
                {s.card && <SavedCardRow card={s.card} selected={useSaved} onSelect={() => setUseSaved(true)} />}
                <button type="button" onClick={() => setUseSaved(false)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${!useSaved ? "border-ink" : "border-line-2 hover:bg-page"}`}>
                  <span>{s.card ? "Use a different card" : "Enter card details"}</span>
                  <Radio on={!useSaved} />
                </button>
                {!useSaved && (
                  <>
                    <CardForm value={form} onChange={setForm} nowIso={s.now} compact />
                    <Checkbox checked={saveCard} onChange={setSaveCard}>
                      Save this card for future bills. We never charge it automatically unless you turn on auto-renewal. <Spec id="R-64" />
                    </Checkbox>
                  </>
                )}
              </div>
            )}
            {methods.includes("va") && (
              <MethodRow on={method === "va"} onClick={() => setMethod("va")} icon={<IconBank size={20} />} title="Virtual account" sub="Bank transfer to a virtual account number (BRI, BCA, CIMB Niaga, Mandiri, Permata)" />
            )}
            {method === "va" && (
              <div className="ml-2 grid grid-cols-2 gap-2 border-l-2 border-line pl-4 sm:grid-cols-3">
                {VA_BANKS.map((b) => (
                  <button key={b.code} type="button" onClick={() => setBank(b.code)} className={`rounded-lg border px-3 py-2 text-left text-sm ${bank === b.code ? "border-ink bg-page" : "border-line-2 hover:bg-page"}`}>
                    <span className="block font-medium text-ink">{b.code}</span>
                    <span className="text-xs text-muted">{b.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <p className="text-xs text-muted">
          One-time purchases are not refundable. Prices {region.taxNote}. The plan does not renew automatically; you will receive a bill before it expires.
        </p>
      </div>
    </Drawer>
  );
}

function MethodRow({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${on ? "border-ink" : "border-line-2 hover:bg-page"}`}>
      <span className="text-muted">{icon}</span>
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
      <Radio on={on} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* M-12: Payment detail (VA number / QRIS / card) + M-13: transaction status */
/* ------------------------------------------------------------------ */
export function PaymentDetailDrawer({ billId, close }: { billId: string; close: () => void }) {
  const { s, api } = useAppState();
  const bill = (s.bills ?? []).find((b) => b.id === billId);
  const [stage, setStage] = useState<"detail" | "checking" | "paid">("detail");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const invoice = useMemo(() => s.invoices.find((i) => bill?.invoiceId === i.id), [s.invoices, bill?.invoiceId]);

  if (!bill) {
    close();
    return null;
  }
  const paid = bill.status === "paid";
  const p = bill.payment;
  const seconds = Math.max(0, PAYMENT_ID_VALID_HOURS * 3600 - tick);
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const deadline = p ? fmtDateTime(p.expiresAt) : "";
  const invoiceNumber = invoice?.number ?? `${bill.id.replace("bill_", "").toUpperCase()}/PID-FIN/PRO/${new Date(s.now).getUTCFullYear().toString().slice(-2)}`;

  if (paid || stage === "paid") {
    return (
      <Drawer open onClose={close} title="Transaction status" spec="M-13">
        <div className="flex flex-col items-center py-8 text-center">
          <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success-tint text-success">
            <IconCheckCircle size={36} />
          </span>
          <h3 className="font-display text-2xl font-semibold text-ink">Payment received</h3>
          <p className="mt-2 max-w-sm text-sm text-ink-2">
            {planName(bill.tier, bill.interval)} is active from {fmtDate(bill.periodStart)} to {fmtDate(bill.periodEnd)}. Paid {fmtMoney(bill.amount)} via {p ? methodLabel(p.method, p.bank, p.cardLast4) : invoice?.method}. A receipt is on its way to {s.user.email}.
          </p>
          <p className="mt-3 max-w-sm rounded-lg bg-page px-3 py-2 text-xs text-muted">This plan does not renew automatically. We will send you a bill 7 days before {fmtDate(bill.periodEnd)}.</p>
          <div className="mt-6 flex gap-2">
            <Link href="/settings/billing" className="btn-secondary" onClick={close}>
              Go to Billing
            </Link>
            <button className="btn-primary" onClick={close}>
              Done
            </button>
          </div>
        </div>
      </Drawer>
    );
  }

  if (!p) {
    close();
    return null;
  }

  if (stage === "checking") {
    return (
      <Drawer
        open
        onClose={close}
        title="Transaction status"
        spec="M-13"
        footer={
          <button
            className="btn-secondary w-full"
            onClick={() => {
              // Prototype: the first refresh finds the payment (real: webhook from the payment gateway).
              api.confirmPayment(bill.id);
              setStage("paid");
            }}
          >
            <IconRefresh size={16} /> Refresh
          </button>
        }
      >
        <div className="py-4">
          <div className="mx-auto mb-6 flex h-40 w-40 items-center justify-center rounded-full bg-info-tint text-info">
            <IconReceipt size={64} />
          </div>
          <h3 className="font-display text-2xl font-semibold text-ink">Checking for payment</h3>
          <p className="mt-2 text-ink-2">Complete payment before {deadline}</p>
          <p className="mt-4 text-sm text-muted">Invoice number</p>
          <p className="text-[17px] text-ink">{invoiceNumber}</p>
          <div className="mt-6 rounded-xl bg-page p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-ink">
              <IconInfo size={16} className="text-info" /> Payment status update
            </p>
            <p className="mt-1 text-ink-2">You can check the payment status by refreshing this page or going to the Billing section.</p>
            <Link href="/settings/billing" className="mt-2 inline-block font-medium text-info underline" onClick={close}>
              Go to Billing
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">Prototype: Refresh simulates the payment gateway confirming the payment. In production this arrives as a webhook.</p>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer
      open
      onClose={close}
      title="Detail"
      spec="M-12"
      footer={
        <div className="space-y-3">
          <p className="text-center text-sm text-ink-2">
            After making the payment, click <strong className="text-ink">Confirm payment</strong> to process your transaction
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary !px-3" title="View invoice" aria-label="View invoice">
              <IconReceipt size={18} />
            </button>
            <button className="btn-secondary !px-3" title="Download instructions" aria-label="Download">
              <IconDownload size={18} />
            </button>
            <button className="btn-primary flex-1" onClick={() => setStage("checking")}>
              Confirm payment
            </button>
          </div>
          <button className="w-full text-center text-xs text-muted hover:text-ink" onClick={() => { api.cancelPayment(bill.id); close(); }}>
            Cancel this Payment ID
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-page px-4 py-3 text-sm">
          <span className="text-ink-2">
            Complete payment before <strong className="text-ink">{deadline}</strong>
          </span>
          <span className="rounded-md bg-warn-tint px-2 py-1 font-mono text-warn">
            {hh}:{mm}:{ss}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line-2">
          <div className="flex items-center justify-between bg-page px-5 py-3">
            <span className="text-[17px] font-medium text-ink">{methodLabel(p.method, p.bank)}</span>
            {p.method === "va" ? <IconBank size={20} className="text-muted" /> : p.method === "qris" ? <IconQr size={20} className="text-muted" /> : <IconCard size={20} className="text-muted" />}
          </div>
          <div className="space-y-4 px-5 py-4">
            {p.method === "va" && (
              <div>
                <p className="text-sm text-muted">Virtual account number</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[20px] tracking-wider text-ink">{p.vaNumber}</p>
                  <CopyButton text={p.vaNumber ?? ""} />
                </div>
                <p className="mt-1 text-xs text-muted">Account name: PRIVY IDENTITAS DIGITAL · {VA_BANKS.find((b) => b.code === p.bank)?.name}</p>
              </div>
            )}
            {p.method === "qris" && (
              <div className="flex flex-col items-center">
                <FakeQr seed={p.paymentId} />
                <p className="mt-2 text-xs text-muted">Scan with GoPay, OVO, DANA, ShopeePay or your banking app</p>
              </div>
            )}
            {p.method === "card" && (
              <p className="text-sm text-ink-2">
                Card ending {p.cardLast4}. Your bank may ask you to confirm (3DS). Click Confirm payment to complete the charge.
              </p>
            )}
            <div>
              <p className="text-sm text-muted">Amount to pay</p>
              <div className="flex items-center justify-between">
                <p className="text-[20px] text-ink">{fmtMoney(bill.amount)}</p>
                <CopyButton text={String(Math.round(bill.amount))} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted">Payment ID</p>
          <p className="font-mono text-[15px] text-ink">{p.paymentId}</p>
          <p className="mt-2 text-sm text-muted">Invoice number</p>
          <p className="text-[17px] text-ink">{invoiceNumber}</p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-ink">Transaction guidance</p>
          {guidanceFor(p.method, p.bank).map((g) => (
            <Guide key={g.title} title={g.title} steps={g.steps} />
          ))}
        </div>
      </div>
    </Drawer>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="flex items-center gap-1 text-sm font-medium text-ink hover:underline"
      onClick={() => {
        try {
          navigator.clipboard?.writeText(text);
        } catch {
          /* ignore */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Guide({ title, steps }: { title: string; steps: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button type="button" className="flex w-full items-center justify-between py-3 text-left text-[15px] text-ink" onClick={() => setOpen((v) => !v)}>
        {title} <IconChevronDown size={18} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-ink-2">
          {steps.map((st) => (
            <li key={st}>{st}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function guidanceFor(method: PaymentMethodKind, bank?: VaBank): { title: string; steps: string[] }[] {
  if (method === "qris") {
    return [
      { title: "Pay with an e-wallet (GoPay, OVO, DANA, ShopeePay)", steps: ["Open the app and choose Scan / Pay.", "Scan the QRIS code above.", "Check the amount and merchant name (Privy Identitas Digital).", "Confirm with your PIN. The status updates within a minute."] },
      { title: "Pay with mobile banking", steps: ["Open your banking app and choose QRIS.", "Scan the code, check the amount, confirm."] },
    ];
  }
  if (method === "va") {
    const b = bank ?? "BCA";
    return [
      { title: `ATM ${b}`, steps: ["Insert your card and enter your PIN.", "Choose Transfer → Virtual Account.", "Enter the virtual account number above and confirm the amount.", "Keep the receipt. The status updates within a few minutes."] },
      { title: `${b} mobile banking`, steps: ["Open the app and choose Transfer → Virtual Account.", "Enter the virtual account number and the amount.", "Confirm with your PIN."] },
      { title: `${b} internet banking`, steps: ["Log in and choose Transfer → Virtual Account.", "Enter the virtual account number, confirm the amount and approve with your token."] },
    ];
  }
  return [{ title: "Card payment", steps: ["Click Confirm payment.", "If your bank asks, approve the payment in your banking app (3DS).", "Your plan activates immediately."] }];
}

/** Deterministic QR-looking grid from the payment id (prototype). */
function FakeQr({ seed }: { seed: string }) {
  const n = 25;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push((h >> 16) % 3 === 0);
  }
  const finder = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#111" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#111" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={180} height={180} className="rounded-lg border border-line bg-white p-2" shapeRendering="crispEdges">
      {cells.map((on, i) => {
        const x = i % n;
        const y = Math.floor(i / n);
        const inFinder = (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
        return on && !inFinder ? <rect key={i} x={x} y={y} width={1} height={1} fill="#111" /> : null;
      })}
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* M-14: convert a one-time plan to auto-renewal                         */
/* ------------------------------------------------------------------ */
export function ConvertModal({ close }: { close: () => void }) {
  const { s, api } = useAppState();
  const pe = prepaidEnd(s);
  const last = pe ? s.prepaid?.periods.find((p) => p.end === pe) : undefined;
  const [useSaved, setUseSaved] = useState(!!s.card);
  const [form, setForm] = useState<CardFormValue>({ number: "", exp: "", cvc: "", name: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!pe || !last) {
    close();
    return null;
  }
  const amount = planPrice(last.tier, last.interval, last.seats ?? 1);
  const card: Card | null = useSaved && s.card ? s.card : cardFormValid(form) ? cardFromForm(form, s.now) : null;
  const consentText = `I agree that Privy will charge ${fmtMoney(amount)} to my card every ${intervalWord(last.interval)} starting ${fmtDate(pe)} until I cancel. I can cancel any time from Plan settings and keep access until the end of the paid period.`;
  return (
    <Modal
      open
      onClose={close}
      title="Turn on auto-renewal"
      spec="M-14"
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            Not now
          </button>
          <button
            className="btn-primary"
            disabled={!card || !consent || busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => {
                api.convertToAutoRenew({ ...card!, behavior: card!.behavior === "requires_action" ? "success" : card!.behavior }, consentText);
                close();
              }, 600);
            }}
          >
            {busy ? "Saving…" : "Turn on auto-renewal"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          Your {planName(last.tier, last.interval)} is paid until <strong className="text-ink">{fmtDate(pe)}</strong>. With auto-renewal we charge your card on that date and every {intervalWord(last.interval)} after, so you never get a bill or lose access. Nothing is charged today.
        </p>
        <div className="rounded-lg bg-page px-3 py-2 text-xs text-ink-2">
          <div className="flex justify-between">
            <span>Today</span>
            <strong className="text-ink">Nothing</strong>
          </div>
          <div className="flex justify-between">
            <span>First automatic charge</span>
            <strong className="text-ink">
              {fmtDate(pe)}, {fmtMoney(amount)}
            </strong>
          </div>
          <div className="mt-1 text-[11px] text-muted">14-day grace and retries apply if a charge fails. Cancel any time.</div>
        </div>
        {s.card && <SavedCardRow card={s.card} selected={useSaved} onSelect={() => setUseSaved(true)} />}
        <button type="button" onClick={() => setUseSaved(false)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${!useSaved ? "border-ink" : "border-line-2 hover:bg-page"}`}>
          <span>{s.card ? "Use a different card" : "Add a credit or debit card"}</span>
          <Radio on={!useSaved} />
        </button>
        {!useSaved && <CardForm value={form} onChange={setForm} nowIso={s.now} compact />}
        <Checkbox checked={consent} onChange={setConsent}>
          {consentText} <Spec id="R-65" />
        </Checkbox>
        <p className="text-xs text-muted">Any open bill for this plan is cancelled; auto-renewal replaces it.</p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Region select used by Workspace preferences and the Prototype panel  */
/* ------------------------------------------------------------------ */
export function RegionSelect({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <select className={`input ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {REGIONS.map((r) => (
        <option key={r.code} value={r.code}>
          {r.flag} {r.name}
        </option>
      ))}
    </select>
  );
}
