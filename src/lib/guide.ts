import type { AppState, HistoryType } from "./types";

/**
 * In-flow test guide: one walkthrough per scenario.
 * Each step says what to click, what you should see, and which spec items it proves.
 * `check` auto-ticks the step from the live state; steps without a check are ticked by hand.
 */
export interface GuideStep {
  id: string;
  title: string;
  do: string;
  expect: string;
  href?: string;
  refs?: string[];
  /** Optional hint shown in amber, e.g. "Reset the scenario first". */
  note?: string;
  check?: (s: AppState, pathname: string) => boolean;
}

export interface Guide {
  scenarioId: string;
  goal: string;
  steps: GuideStep[];
}

const has = (s: AppState, t: HistoryType) => s.history.some((h) => h.type === t);
const sub = (s: AppState) => s.subscription;

export const GUIDES: Record<string, Guide> = {
  free: {
    scenarioId: "free",
    goal: "Prove the checkout: consent before pay, saved card, 3DS handling, and the first receipt.",
    steps: [
      {
        id: "free-1",
        title: "Open the plan page",
        do: "Click 'Upgrade plan' in the top bar (or Settings → Billing → Change plan).",
        expect: "Four plans with the Monthly / Yearly toggle. Free is marked 'Your current plan'. Plan facts match privyid.com/pricing (AUD).",
        href: "/plans",
        refs: ["UX-01", "UX-13"],
        check: (_s, p) => p.startsWith("/plans") || p.startsWith("/settings/billing/change-plan"),
      },
      {
        id: "free-2",
        title: "Subscribe to Personal Monthly with card 4242",
        do: "Upgrade to Personal → keep Monthly → card 4242 4242 4242 4242, any future expiry → tick the consent box → Pay.",
        expect: "Pay stays disabled until the unticked consent box is ticked. Toast confirms. Billing shows 'Renews on Oct 10, 2026 for A$7.49 on card ending 4242'. Email N-01 with invoice.",
        href: "/plans",
        refs: ["M-01", "R-12", "R-13", "N-01", "UX-06"],
        check: (s) => !!sub(s) && sub(s)!.tier === "personal" && has(s, "subscribed"),
      },
      {
        id: "free-3",
        title: "See the 3DS step",
        do: "Reset scenario (Prototype panel), subscribe again with 4000 0025 0000 3155.",
        expect: "A 'Your bank needs a quick confirmation' step appears before the charge completes; approving it finishes the checkout on the same screen.",
        href: "/plans",
        refs: ["M-07", "UX-14"],
        note: "Optional. Reset the scenario first.",
        check: (s) => s.card?.last4 === "3155" && has(s, "subscribed"),
      },
      {
        id: "free-4",
        title: "Compare Monthly vs Yearly",
        do: "Flip the toggle to Yearly on the plan page.",
        expect: "Personal A$6.58/mo billed A$79 (save 12%), Business A$33/seat/mo billed A$396 (save 14%). The checkout lets you switch between the two as well.",
        href: "/plans",
        refs: ["UX-21"],
      },
    ],
  },

  "personal-monthly": {
    scenarioId: "personal-monthly",
    goal: "Prove the three plan changes from Personal Monthly: tier upgrade with a timing choice, interval switch with roll-over, cancel and resume.",
    steps: [
      {
        id: "pm-1",
        title: "Upgrade to Business and read the timing choice",
        do: "Settings → Billing → Change plan → Upgrade to Business.",
        expect: "Modal with two buttons: 'Upgrade now and pay A$38.50' and 'Upgrade on Oct 10, 2026 instead'. The acknowledgment sentence names the days forfeited. Pending downgrades/cancellations would be removed (stated in the modal).",
        href: "/settings/billing/change-plan",
        refs: ["M-02", "UX-03", "UX-05", "R-26", "R-27"],
        check: (s) => has(s, "upgraded") || sub(s)?.scheduledChange?.kind === "scheduled_upgrade",
      },
      {
        id: "pm-2",
        title: "Switch to Personal Yearly (roll-over)",
        do: "Reset scenario → Change plan → Yearly toggle → Personal → confirm.",
        expect: "A$79 charged today; the 30 remaining monthly days are appended, so the new end date is Oct 10, 2027. Billing anchor becomes today (the 10th). No forfeiture warning.",
        href: "/settings/billing/change-plan",
        refs: ["M-03", "R-28", "Rule B"],
        note: "Reset the scenario first if you did step 1.",
        check: (s) => has(s, "interval_changed"),
      },
      {
        id: "pm-3",
        title: "Cancel, then resume",
        do: "Billing → Cancel subscription → (skip the survey) → Cancel. Then click Resume in the banner.",
        expect: "Two clicks to cancel; access continues to Oct 10; email N-13. Resume is one click with a consent line; email N-15; same renewal date, nothing charged.",
        href: "/settings/billing",
        refs: ["M-05", "M-06", "UX-11", "UX-12", "R-33", "R-34"],
        check: (s) => has(s, "cancel_scheduled") && has(s, "resumed"),
      },
    ],
  },

  "personal-annual": {
    scenarioId: "personal-annual",
    goal: "The highest-risk matrix cell: upgrading now would forfeit 200 prepaid days. Prove the smart default, the acknowledgment and the scheduled path.",
    steps: [
      {
        id: "pa-1",
        title: "Open the upgrade modal and read it",
        do: "Change plan → Upgrade to Business. Do not confirm yet.",
        expect: "Because 200 days remain (more than 14), 'Upgrade on Mar 29, 2027 instead' is the primary button and 'Upgrade now' is secondary. The checkbox reads '...paid until Mar 29, 2027 (200 days), will end today and is not refunded or credited'.",
        href: "/settings/billing/change-plan",
        refs: ["UX-04", "UX-05", "M-02"],
      },
      {
        id: "pa-2",
        title: "Choose the scheduled upgrade",
        do: "Click 'Upgrade on Mar 29, 2027 instead'.",
        expect: "Nothing charged. Banner 'Your plan changes to Business on Mar 29, 2027. Keep my current plan'. Email N-11. Billing page shows the pending change.",
        refs: ["R-27", "UX-09", "B-02", "N-11"],
        check: (s) => sub(s)?.scheduledChange?.kind === "scheduled_upgrade",
      },
      {
        id: "pa-3",
        title: "Undo it from the banner",
        do: "Click 'Keep my current plan'.",
        expect: "Pending change removed, toast confirms, history shows 'change undone'.",
        refs: ["UX-09", "R-30"],
        check: (s) => has(s, "change_undone"),
      },
      {
        id: "pa-4",
        title: "Downgrade to Personal Monthly",
        do: "Change plan → Monthly toggle → Personal (Get Personal monthly).",
        expect: "Light confirmation: 'From Mar 29, 2027 you pay A$7.49 per month'. Effective at the end of the annual term, anchor unchanged, undo available until then.",
        href: "/settings/billing/change-plan",
        refs: ["M-04b", "R-32", "Rule D"],
        check: (s) => ["downgrade", "interval_down"].includes(sub(s)?.scheduledChange?.kind ?? "") && sub(s)?.scheduledChange?.interval === "monthly",
      },
    ],
  },

  "business-owner": {
    scenarioId: "business-owner",
    goal: "Prove seats are prorated to the one renewal date, backup cards catch a declined default, and the downgrade checklist uses real workspace data.",
    steps: [
      {
        id: "bo-seats-1",
        title: "Add 2 seats, prorated to the same end date",
        do: "Billing → Manage seats → set 10 → read the breakdown → tick the consent → 'Add 2 seats and pay'.",
        expect: "Today: 2 × A$38.50 × 21 of 30 days = A$53.90 (A$26.95 per seat). Next renewal Oct 1 stays the same date, now A$385.00 for 10 seats. Invoice for the prorated amount, email N-22, history entry.",
        href: "/settings/billing",
        refs: ["M-09", "UX-06", "N-22", "Rule B"],
        check: (s) => s.history.some((h) => h.type === "seats_changed" && h.title.startsWith("Added")),
      },
      {
        id: "bo-seats-2",
        title: "Reduce seats: takes effect at the renewal date",
        do: "Manage seats → set 7 → 'Reduce to 7 on Oct 1, 2026'. Try 5 as well: blocked because 6 members are using seats.",
        expect: "Nothing charged or refunded now; banner 'Your seats change from 10 to 7 on Oct 1' with 'Keep my seats'. Renewal shows the new amount. Jumping to Oct 1 applies it and the history shows 'Seats reduced to 7'.",
        href: "/settings/billing",
        refs: ["M-09", "Rule D", "B-02", "UX-09"],
        check: (s) => s.subscription?.pendingSeats != null || s.history.some((h) => h.type === "seats_changed" && h.title.startsWith("Seats reduced")),
      },
      {
        id: "bo-cards-1",
        title: "See the backup card catch a declined default",
        do: "Prototype panel → 'Next automatic charge outcome' → Soft decline. Then in this panel 'Jump to next renewal (Oct 1)'.",
        expect: "The Visa default declines, the Mastercard backup is charged in the same sweep. No grace period, no dunning email. History: 'Backup card ending 4444 was charged'. Email N-23 explains which card was used.",
        refs: ["R-19b", "N-23"],
        check: (s) => s.history.some((h) => h.type === "note" && h.title.includes("Backup card")),
      },
      {
        id: "bo-cards-2",
        title: "Manage cards: set default, add, remove",
        do: "Billing → Payment methods → Manage. Set the Mastercard as default, add a backup card (5555 5555 5555 4444 or 4242), remove a backup.",
        expect: "Default is charged first; backups listed in order; 'Remove' on the only card of an active subscription is disabled; removing the default promotes the first backup. N-21 / N-24 emails.",
        href: "/settings/billing/payment-method",
        refs: ["UX-17", "N-21", "N-24"],
        check: (s) => s.history.some((h) => h.type === "card_removed" || (h.type === "card_updated" && h.title.includes("changed"))),
      },
      {
        id: "bo-1",
        title: "Downgrade to Personal and read the checklist",
        do: "Change plan → Personal (Get Personal).",
        expect: "Checklist lists the 5 members by name (Kenny, Rima, Fauzi, Donny, Ardhitia), 3 automations, 2 retention policies, e-Seal, branding and trusted domain privy.id, envelopes to 50/month. 'Hand over team documents' link. Effective Oct 1, 2026. Seat changes are blocked while a plan change is pending.",
        href: "/settings/billing/change-plan",
        refs: ["M-04", "UX-07", "UX-08", "R-31"],
        check: (s) => sub(s)?.scheduledChange?.kind === "downgrade",
      },
      {
        id: "bo-2",
        title: "Undo from the banner",
        do: "Click 'Keep my current plan' in the banner.",
        expect: "Pending change removed; members untouched.",
        refs: ["UX-09"],
        check: (s) => has(s, "change_undone"),
      },
      {
        id: "bo-3",
        title: "Schedule again and jump to Oct 1",
        do: "Repeat step 1, then in this panel click 'Jump to scheduled change'.",
        expect: "A$7.49 charged for Personal Monthly, the 5 members removed, workspace closed (recoverable 90 days), emails N-12 to Frans and N-16 to each member.",
        refs: ["R-31", "N-12", "N-16", "R-36"],
        check: (s) => has(s, "change_applied"),
      },
    ],
  },

  "past-due": {
    scenarioId: "past-due",
    goal: "Prove dunning: the grace banner, the email series, recovery with unchanged billing date, and the Day-14 drop to Free.",
    steps: [
      {
        id: "pd-1",
        title: "Read the past-due banner",
        do: "Look at the top of any page.",
        expect: "'We could not renew your Personal Monthly. You have 7 days of full access left.' with 'Update payment method'. Everything still works (full access during grace).",
        href: "/home",
        refs: ["B-01", "UX-16", "R-22"],
      },
      {
        id: "pd-2",
        title: "Open the emails sent so far",
        do: "Prototype panel → Emails (or the link below).",
        expect: "N-05 (Day 0, payment failed, retry dates) and N-07 (Day 7 reminder), both with a one-click 'Update payment method' link.",
        href: "/prototype/emails",
        refs: ["N-05", "N-07", "UX-18"],
        check: (_s, p) => p.startsWith("/prototype/emails"),
      },
      {
        id: "pd-3",
        title: "Recover by replacing the card",
        do: "Billing → Payment method → Replace card with 4242.",
        expect: "Immediate retry succeeds; status back to active; renewal date stays Oct 3, 2026 (anchor unchanged); banner gone; receipt N-03; toast 'Payment received'.",
        href: "/settings/billing/payment-method",
        refs: ["R-22", "R-25", "R-37", "UX-17", "N-03"],
        check: (s) => has(s, "recovered"),
      },
      {
        id: "pd-3b",
        title: "Alternative: add a backup card instead",
        do: "Reset scenario → Billing → Payment methods → Manage → Add backup card 4242 (leave 'Make default' unticked).",
        expect: "Saving any card during grace retries right away: the Visa 9995 is declined again, the new backup succeeds, plan recovers with the same billing date. Email N-23 explains the backup was used; N-24 confirms the card was added.",
        href: "/settings/billing/payment-method",
        refs: ["R-19b", "R-22", "N-23", "N-24"],
        note: "Reset the scenario first.",
        check: (s) => (s.backupCards ?? []).length > 0 && has(s, "recovered"),
      },
      {
        id: "pd-4",
        title: "Alternative: let grace run out",
        do: "Reset scenario, then click 'Jump to end of grace' in this panel.",
        expect: "Day 12: N-08 final warning; Day 14: last retry fails, account drops to Free, documents intact, open invoice voided, email N-09, banner replaced by 'Resubscribe'.",
        refs: ["R-23", "N-08", "N-09"],
        note: "Reset the scenario first.",
        check: (s) => has(s, "ended"),
      },
    ],
  },

  "pending-downgrade": {
    scenarioId: "pending-downgrade",
    goal: "A scheduled change waiting to happen: prove undo, the effective-date job, and that an upgrade replaces the pending change.",
    steps: [
      {
        id: "pdg-1",
        title: "Undo from the banner",
        do: "Click 'Keep my current plan'.",
        expect: "Pending change cleared; Business Monthly × 3 continues; history 'change undone'.",
        refs: ["UX-09", "R-30"],
        check: (s) => has(s, "change_undone"),
      },
      {
        id: "pdg-2",
        title: "Let it take effect",
        do: "Reset scenario → 'Jump to scheduled change' (Oct 1).",
        expect: "Personal Monthly charged A$7.49, the 2 other members removed, workspace closed, N-12 to Frans and N-16 to Kenny and Rima.",
        refs: ["R-31", "N-12", "N-16"],
        note: "Reset the scenario first.",
        check: (s) => has(s, "change_applied"),
      },
      {
        id: "pdg-3",
        title: "Upgrade instead",
        do: "Reset scenario → Change plan → Yearly → Business → Upgrade now.",
        expect: "Modal states the pending downgrade will be removed. After paying, no scheduled change remains; Business Yearly runs from today.",
        href: "/settings/billing/change-plan",
        refs: ["R-29", "M-02"],
        note: "Reset the scenario first.",
        check: (s) => has(s, "upgraded") || has(s, "interval_changed"),
      },
    ],
  },

  "cancel-scheduled": {
    scenarioId: "cancel-scheduled",
    goal: "Cancelled but still paid: prove one-click resume, the clean end of the period, and that resubscribing starts a fresh billing date.",
    steps: [
      {
        id: "cs-1",
        title: "Resume from the banner",
        do: "Click 'Resume' in the banner.",
        expect: "Consent line for the recurring charge, then auto-renewal is back on: next renewal Oct 15, 2026 for A$79. Email N-15. Nothing charged now.",
        refs: ["M-06", "UX-12", "R-34", "N-15"],
        check: (s) => has(s, "resumed"),
      },
      {
        id: "cs-2",
        title: "Let the plan end",
        do: "Reset scenario → 'Jump to plan end' (Oct 15).",
        expect: "Account on Free, documents intact, no charge attempted, email N-14.",
        refs: ["R-33", "N-14"],
        note: "Reset the scenario first.",
        check: (s) => has(s, "ended"),
      },
      {
        id: "cs-3",
        title: "Resubscribe after the lapse",
        do: "Upgrade plan → Personal Monthly → card 4242.",
        expect: "A new subscription with billing anchor = today's simulated date (not the old 15th).",
        href: "/plans",
        refs: ["R-25"],
        check: (s) => has(s, "ended") && s.history[0]?.type === "subscribed",
      },
    ],
  },

  "migrated-prepaid": {
    scenarioId: "migrated-prepaid",
    goal: "Old one-off buyer with stacked prepaid time: prove we never auto-enrol, opt-in charges nothing, and upgrades are scheduled only.",
    steps: [
      {
        id: "mp-1",
        title: "Turn on auto-renewal from the banner",
        do: "Click 'Turn on auto-renewal' → card 4242 → tick consent → Save.",
        expect: "No charge today. A subscription is created whose first charge is Nov 10, 2027 (end of prepaid time). Consent stored. Banner gone.",
        refs: ["B-03", "UX-24", "R-42", "Q-J1"],
        check: (s) => has(s, "opt_in"),
      },
      {
        id: "mp-2",
        title: "Try to upgrade to Business",
        do: "Change plan → Upgrade to Business.",
        expect: "Only 'Upgrade on Nov 10, 2027' is offered in self-serve (more than one prepaid period: no immediate forfeiture path). Credit is a CS action.",
        href: "/settings/billing/change-plan",
        refs: ["R-43", "Q-D7"],
        check: (s) => sub(s)?.scheduledChange?.kind === "scheduled_upgrade",
      },
      {
        id: "mp-3",
        title: "Jump to the end of prepaid time",
        do: "Click 'Jump to end of prepaid time' in this panel (reminders N-04 fire at T-30 and T-7 on the way).",
        expect: "First automatic charge on Nov 10, 2027; receipt N-03; entitlement continues with no gap.",
        refs: ["R-16", "R-17", "N-04"],
        check: (s) => has(s, "renewed"),
      },
    ],
  },
  "id-free": {
    scenarioId: "id-free",
    goal: "Indonesia checkout: choose one-time or auto-renewal, pay once with QRIS / card / virtual account through a Payment ID, and see IDR prices with PPN included.",
    steps: [
      {
        id: "idf-1",
        title: "Check the region and prices",
        do: "Open Settings → Workspace preferences: Region shows Indonesia. Then open the plan page.",
        expect: "Plan cards show Rp 54,000 / month for Personal and Rp 99,000 per seat for Business, with 'includes PPN'. Yearly: Rp 395,000 and Rp 725,000 per seat. Enterprise still says Contact sales.",
        href: "/settings/workspace-preferences",
        refs: ["R-60", "R-61", "UX-25"],
        check: (_s, p) => p.startsWith("/plans") || p.startsWith("/settings/billing/change-plan"),
      },
      {
        id: "idf-2",
        title: "Choose 'Pay once' for Personal Monthly",
        do: "Upgrade to Personal → the 'How do you want to pay?' step appears → pick 'Pay once' → Continue.",
        expect: "The one-time checkout drawer opens with three methods: QRIS, Card (with 'Save this card for future bills') and Virtual Account (BRI, BCA, CIMB, Mandiri, Permata). It says the plan does not renew automatically and a bill comes 7 days before expiry.",
        href: "/plans",
        refs: ["M-10", "M-11", "R-61", "R-62"],
        check: (s) => (s.bills ?? []).length > 0,
      },
      {
        id: "idf-3",
        title: "Generate a Payment ID with QRIS",
        do: "Pick QRIS → Continue to payment.",
        expect: "A payment detail screen with a Payment ID (PAY-…), the QR code, the amount and a 2-hour countdown. Billing shows banner B-07 'A payment is still open' with Continue / Cancel.",
        refs: ["M-12", "R-63", "B-07"],
        check: (s) => has(s, "payment_pending"),
      },
      {
        id: "idf-4",
        title: "Confirm the payment",
        do: "Click 'I have paid' → Refresh status (or 'Simulate payment received' in the Prototype panel).",
        expect: "Status becomes Paid. Billing shows 'One-time · expires Oct 10, 2026', an invoice paid via QRIS, email N-32 (receipt). No card on file, no consent to recurring charges.",
        refs: ["M-13", "N-32", "R-64"],
        check: (s) => has(s, "bill_paid") && !s.subscription,
      },
      {
        id: "idf-5",
        title: "Jump to the bill day, then let it expire",
        do: "Prototype panel → 'Jump to bill day' (T-7) → then 'Jump to plan expiry' without paying.",
        expect: "At T-7 a bill is issued (banner B-06, email N-30, reminders N-30b at T-3 and T-1). At expiry the plan ends with no grace: account is Free, bill marked 'Expired unpaid', email N-31, banner B-08 'Buy a plan'.",
        refs: ["R-65", "N-30", "N-30b", "N-31", "B-06", "B-08"],
        check: (s) => has(s, "bill_expired"),
      },
      {
        id: "idf-6",
        title: "Switch region back to Australia",
        do: "Settings → Workspace preferences → Region: Australia → Save changes.",
        expect: "Prices return to AUD and the checkout goes straight to the card form (no 'Pay once' option). Any active plan would stay active across the change.",
        href: "/settings/workspace-preferences",
        refs: ["R-60", "R-66"],
        check: (s) => has(s, "region_changed") && s.region !== "ID",
      },
    ],
  },
  "id-onetime-card": {
    scenarioId: "id-onetime-card",
    goal: "A bill is waiting: pay it with a saved card, or convert a card payer to auto-renewal at the expiry date.",
    steps: [
      {
        id: "idc-1",
        title: "Read the bill",
        do: "Look at banner B-06 and Settings → Billing → Bills.",
        expect: "'Personal Monthly bill of Rp 54,000 is due by Sep 15, 2026 (5 days left)'. Status pill: 'One-time · expires Sep 15, 2026'. Buttons: Pay bill and Switch to auto-renewal (card payer). Invoice list shows the method column.",
        href: "/settings/billing",
        refs: ["B-06", "R-63", "R-64", "UX-26"],
        check: (_s, p) => p === "/settings/billing",
      },
      {
        id: "idc-2",
        title: "Pay with the saved card",
        do: "Pay bill → Card → 'Use saved card ending 4242' → Continue to payment → I have paid → Refresh.",
        expect: "Bill becomes Paid via card. The subscription line now reads 'expires Oct 15, 2026'. Still no auto-renewal; email N-32.",
        refs: ["M-11", "M-12", "M-13", "N-32"],
        check: (s) => has(s, "bill_paid"),
      },
      {
        id: "idc-3",
        title: "Turn on auto-renewal",
        do: "Reset the scenario. Banner → 'Switch to auto-renewal' → keep card 4242 → tick consent → Turn on.",
        expect: "The open bill is voided. A subscription starts with its first charge on Sep 15, 2026 (nothing charged today). Consent stored, email N-34, status 'Active · auto-renewal'. Jump to next renewal: Rp 54,000 charged, receipt N-03.",
        refs: ["M-14", "R-66", "N-34", "R-09"],
        note: "Reset the scenario first if you paid the bill in step 2.",
        check: (s) => has(s, "opt_in") && !!sub(s),
      },
      {
        id: "idc-4",
        title: "Let the bill expire instead",
        do: "Reset the scenario. Prototype panel → 'Jump to plan expiry' without paying.",
        expect: "Reminders N-30b at T-3 and T-1, then on Sep 15 the plan ends immediately (no 14-day grace). Bill 'Expired unpaid', account Free, email N-31, banner B-08.",
        refs: ["R-65", "N-30b", "N-31", "B-08"],
        note: "Optional. Reset the scenario first.",
        check: (s) => has(s, "bill_expired"),
      },
    ],
  },
  "id-onetime-qris": {
    scenarioId: "id-onetime-qris",
    goal: "Business paid once by QRIS: no convert offer on the banner (phase 1), pay via virtual account, or expire and watch the workspace close with no grace.",
    steps: [
      {
        id: "idq-1",
        title: "No convert offer for non-card payers",
        do: "Look at the banner and the subscription card.",
        expect: "Banner B-06 shows only 'Pay bill' (2 days left). The 'Turn on auto-renewal' button is not on the subscription card, but the Payment methods section still offers it.",
        href: "/settings/billing",
        refs: ["R-66", "B-06"],
        check: (_s, p) => p === "/settings/billing",
      },
      {
        id: "idq-2",
        title: "Pay with a virtual account",
        do: "Pay bill → Virtual Account → BCA → Continue to payment.",
        expect: "Payment detail shows a BCA virtual account number with Copy, the exact amount (Rp 297,000 for 3 seats), the Payment ID and the 2-hour expiry. Bank-specific instructions are listed.",
        refs: ["M-12", "R-63"],
        check: (s) => has(s, "payment_pending"),
      },
      {
        id: "idq-3",
        title: "Cancel the Payment ID and pick another method",
        do: "Cancel this Payment ID → Pay bill again → QRIS → Continue → I have paid → Refresh.",
        expect: "Cancelling keeps the bill open. The second Payment ID succeeds; plan now runs to Oct 12, 2026 with 3 seats.",
        refs: ["B-07", "M-13", "N-32"],
        check: (s) => has(s, "bill_paid"),
      },
      {
        id: "idq-4",
        title: "Expire the workspace",
        do: "Reset the scenario. Prototype panel → 'Jump to plan expiry'.",
        expect: "On Sep 12 the workspace closes: members lose access, account is Free, bill expired, email N-31. Documents are kept.",
        refs: ["R-65", "N-31", "R-32"],
        note: "Reset the scenario first.",
        check: (s) => has(s, "bill_expired") && s.workspace.closed,
      },
    ],
  },
  "id-recurring": {
    scenarioId: "id-recurring",
    goal: "Indonesian auto-renewal behaves exactly like Global: same renewal engine, grace and retries, but in IDR.",
    steps: [
      {
        id: "idr-1",
        title: "Check the subscription card",
        do: "Open Settings → Billing.",
        expect: "'Active · auto-renewal', 'Renews on Oct 5, 2026 for Rp 54,000 on Visa ending 4242'. No Bills waiting. Payment methods show default and backup cards as usual.",
        href: "/settings/billing",
        refs: ["UX-01", "R-61"],
        check: (_s, p) => p === "/settings/billing",
      },
      {
        id: "idr-2",
        title: "Fail the renewal and see the grace period",
        do: "Prototype panel → 'Soft decline' → Jump to next renewal.",
        expect: "Banner B-01 with 14 days of access, retries on Day 3/7/14, email N-05 in IDR. Same behaviour as the Global past-due scenario.",
        refs: ["R-19", "B-01", "N-05"],
        check: (s) => sub(s)?.status === "past_due",
      },
      {
        id: "idr-3",
        title: "Upgrade to Business",
        do: "Reset. Change plan → Upgrade to Business → 2 seats → pay now.",
        expect: "Prorated charge in IDR for the rest of the period; renewal date unchanged. Same rules as Global.",
        href: "/settings/billing/change-plan",
        refs: ["R-24", "UX-08"],
        note: "Optional. Reset the scenario first.",
        check: (s) => sub(s)?.tier === "business",
      },
    ],
  },
};

export function guideFor(scenarioId: string): Guide {
  return GUIDES[scenarioId] ?? GUIDES.free;
}

export function stepDone(step: GuideStep, s: AppState, pathname: string): boolean {
  const manual = (s.ui.checkedSteps ?? []).includes(step.id);
  if (manual) return true;
  try {
    return step.check ? step.check(s, pathname) : false;
  } catch {
    return false;
  }
}
