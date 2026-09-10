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
    goal: "Prove the downgrade loss checklist uses real workspace data, the pending state is reversible, and the change applies cleanly at period end.",
    steps: [
      {
        id: "bo-1",
        title: "Downgrade to Personal and read the checklist",
        do: "Change plan → Personal (Get Personal).",
        expect: "Checklist lists the 5 members by name (Kenny, Rima, Fauzi, Donny, Ardhitia), 3 automations, 2 retention policies, e-Seal, branding and trusted domain privy.id, envelopes to 50/month. 'Hand over team documents' link. Effective Oct 1, 2026.",
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
