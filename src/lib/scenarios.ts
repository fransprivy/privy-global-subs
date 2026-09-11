import { planPrice } from "./engine";
import { invoiceNumber } from "./format";
import type { AppState, Card, Interval, Invoice, PaidTier, Subscription, Workspace } from "./types";

export const NOW = "2026-09-10T09:00:00.000Z";

export interface ScenarioMeta {
  id: string;
  title: string;
  persona: string;
  description: string;
  tag: "Start here" | "Upgrade" | "Downgrade" | "Failure" | "Migration" | "Cancel";
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    id: "free",
    title: "Free user",
    persona: "Frans, Free plan, 1 of 5 envelopes used",
    description: "The starting point from the screenshots. No card on file. Subscribe to Personal or Business from the plan page.",
    tag: "Start here",
  },
  {
    id: "personal-monthly",
    title: "Personal Monthly subscriber",
    persona: "Frans, Personal Monthly since 10 Aug 2026, renews 10 Oct",
    description: "A month into a monthly plan with a saved Visa. Every plan change is one click away.",
    tag: "Upgrade",
  },
  {
    id: "personal-annual",
    title: "Personal Annual, 200 days left",
    persona: "Frans, Personal Yearly, paid until 29 Mar 2027",
    description: "The highest-risk matrix cell: upgrading now would forfeit 200 prepaid days. The scheduled option is the primary button here.",
    tag: "Upgrade",
  },
  {
    id: "business-owner",
    title: "Business owner, 8 seats",
    persona: "Frans, Business Monthly × 8 seats (6 in use), workspace 'Privy Product Team', Visa default + Mastercard backup",
    description: "Workspace with members, automations, retention policies, e-Seal and branding. Add or remove seats (prorated to the one renewal date), manage backup cards, or downgrade and read the live loss checklist.",
    tag: "Downgrade",
  },
  {
    id: "past-due",
    title: "Payment failed, Day 7 of grace",
    persona: "Frans, Personal Monthly, renewal on 3 Sep declined (insufficient funds)",
    description: "Retries on Day 3 failed; Day 7 retry is due today. Banner, emails and the Update payment method flow are all live.",
    tag: "Failure",
  },
  {
    id: "pending-downgrade",
    title: "Downgrade scheduled",
    persona: "Frans, Business Monthly × 3, changing to Personal Monthly on 1 Oct",
    description: "A scheduled change waiting to take effect. Shows the pending banner with undo, and what happens on the effective date.",
    tag: "Downgrade",
  },
  {
    id: "cancel-scheduled",
    title: "Cancellation pending",
    persona: "Frans, Personal Yearly, cancelled, access until 15 Oct 2026",
    description: "Cancelled but still inside the paid period. One-click resume from the banner or the email.",
    tag: "Cancel",
  },
  {
    id: "migrated-prepaid",
    title: "Migrated prepaid user (stacked)",
    persona: "Frans, two prepaid Personal Yearly units, paid until 10 Nov 2027",
    description: "Bought under the old one-off model. No card, no consent to recurring charges. Must opt in; nothing is charged until prepaid time ends.",
    tag: "Migration",
  },
];

const USER = { name: "Frans", email: "frans.privy@gmail.com", maskedEmail: "fr*******vy@gmail.com" };

const MEMBERS = [
  { id: "m0", name: "Frans", email: "frans.privy@gmail.com", role: "owner" as const },
  { id: "m1", name: "Kenny Hartono", email: "kenny@privy.id", role: "admin" as const },
  { id: "m2", name: "Rima Sari", email: "rima@privy.id", role: "member" as const },
  { id: "m3", name: "Fauzi Rahman", email: "fauzi@privy.id", role: "member" as const },
  { id: "m4", name: "Donny Prasetyo", email: "donny@privy.id", role: "member" as const },
  { id: "m5", name: "Ardhitia W.", email: "ardhitia@privy.id", role: "member" as const },
];

function workspace(business: boolean, memberCount = 1): Workspace {
  return business
    ? {
        name: "Privy Product Team",
        members: MEMBERS.slice(0, memberCount),
        automations: 3,
        retentionPolicies: 2,
        eSeal: true,
        branding: true,
        trustedDomain: "privy.id",
        closed: false,
      }
    : { name: "Personal · Frans", members: MEMBERS.slice(0, 1), automations: 0, retentionPolicies: 0, eSeal: false, branding: false, trustedDomain: null, closed: true };
}

const VISA: Card = { id: "card_visa4242", brand: "visa", last4: "4242", expMonth: 12, expYear: 2027, behavior: "success", addedAt: "2026-08-10T09:00:00.000Z" };
const SOFT_VISA: Card = { id: "card_visa9995", brand: "visa", last4: "9995", expMonth: 11, expYear: 2027, behavior: "soft_decline", addedAt: "2026-07-03T09:00:00.000Z" };
const MASTERCARD: Card = { id: "card_mc4444", brand: "mastercard", last4: "4444", expMonth: 6, expYear: 2028, behavior: "success", addedAt: "2026-08-15T09:00:00.000Z" };

function baseState(scenarioId: string): AppState {
  return {
    version: 3,
    scenarioId,
    now: NOW,
    user: USER,
    subscription: null,
    prepaid: null,
    card: null,
    backupCards: [],
    invoices: [],
    history: [],
    emails: [],
    consents: [],
    sentKeys: [],
    workspace: workspace(false),
    usage: { envelopesSent: 1, templates: 0, contacts: 0 },
    tasks: [
      { id: "t1", title: "Privacy Notice Privy Global (Clean) (270826)", from: "Frans", assignedAgo: "1 week ago", status: "waiting_for_you" },
      { id: "t2", title: "Enterprise Order Form (Draft)", from: "Kenny Hartono", assignedAgo: "3 days ago", status: "waiting_for_others" },
    ],
    nextChargeOverride: null,
    optInDismissed: false,
    ui: { showSpecTags: false, controlsOpen: false, guideOpen: true, checkedSteps: [], toast: null },
  };
}

function sub(partial: Partial<Subscription> & Pick<Subscription, "tier" | "interval" | "currentPeriodStart" | "currentPeriodEnd" | "anchorDay">): Subscription {
  return {
    id: `sub_${partial.tier}_${partial.interval}`,
    seats: 1,
    status: "active",
    cancelAtPeriodEnd: false,
    scheduledChange: null,
    pastDueSince: null,
    graceEndsAt: null,
    nextRetryAt: null,
    retryCount: 0,
    hardDeclined: false,
    pendingAuthAmount: null,
    renewalCount: 0,
    attempts: [],
    createdAt: partial.currentPeriodStart,
    endedAt: null,
    ...partial,
  };
}

function paidInvoice(seq: number, date: string, tier: PaidTier, interval: Interval, seats: number, start: string, end: string, status: Invoice["status"] = "paid"): Invoice {
  const amount = planPrice(tier, interval, seats);
  return {
    id: `inv_${seq}`,
    number: invoiceNumber(seq, date),
    date,
    dueDate: date,
    amount,
    status,
    description: `${tier === "personal" ? "Personal" : "Business"} ${interval === "monthly" ? "Monthly" : "Yearly"}${tier === "business" ? ` × ${seats} seats` : ""} · ${fmt(start)} to ${fmt(end)}`,
    periodStart: start,
    periodEnd: end,
  };
}
function fmt(iso: string): string {
  const d = new Date(iso);
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function buildScenario(id: string): AppState {
  const s = baseState(id);
  switch (id) {
    case "personal-monthly": {
      const start = "2026-09-10T00:00:00.000Z";
      return {
        ...s,
        card: VISA,
        subscription: sub({ tier: "personal", interval: "monthly", currentPeriodStart: start, currentPeriodEnd: "2026-10-10T00:00:00.000Z", anchorDay: 10, renewalCount: 1, createdAt: "2026-08-10T09:00:00.000Z" }),
        usage: { envelopesSent: 12, templates: 4, contacts: 23 },
        invoices: [
          paidInvoice(2, "2026-09-10T00:00:00.000Z", "personal", "monthly", 1, start, "2026-10-10T00:00:00.000Z"),
          paidInvoice(1, "2026-08-10T09:00:00.000Z", "personal", "monthly", 1, "2026-08-10T00:00:00.000Z", start),
        ],
        history: [
          { id: "h2", at: "2026-09-10T00:05:00.000Z", type: "renewed", title: "Personal Monthly renewed", detail: "Charged A$7.49 for Sep 10, 2026 to Oct 10, 2026." },
          { id: "h1", at: "2026-08-10T09:00:00.000Z", type: "subscribed", title: "Subscribed to Personal Monthly", detail: "Charged A$7.49 to card ending 4242." },
        ],
        consents: [{ id: "c1", at: "2026-08-10T09:00:00.000Z", source: "checkout", text: "I agree that Privy will charge A$7.49 to my card every month starting today until I cancel.", amount: 7.49, interval: "monthly", ip: "103.28.114.20" }],
      };
    }
    case "personal-annual": {
      const start = "2026-03-29T00:00:00.000Z";
      const end = "2027-03-29T00:00:00.000Z";
      return {
        ...s,
        card: VISA,
        subscription: sub({ tier: "personal", interval: "annual", currentPeriodStart: start, currentPeriodEnd: end, anchorDay: 29, createdAt: start }),
        usage: { envelopesSent: 31, templates: 9, contacts: 58 },
        invoices: [paidInvoice(1, start, "personal", "annual", 1, start, end)],
        history: [{ id: "h1", at: start, type: "subscribed", title: "Subscribed to Personal Yearly", detail: "Charged A$79.00 to card ending 4242. Renews Mar 29, 2027." }],
        consents: [{ id: "c1", at: start, source: "checkout", text: "I agree that Privy will charge A$79.00 to my card every year starting today until I cancel.", amount: 79, interval: "annual", ip: "103.28.114.20" }],
      };
    }
    case "business-owner": {
      const start = "2026-09-01T00:00:00.000Z";
      const end = "2026-10-01T00:00:00.000Z";
      return {
        ...s,
        card: VISA,
        backupCards: [MASTERCARD],
        workspace: workspace(true, 6),
        subscription: sub({ tier: "business", interval: "monthly", seats: 8, currentPeriodStart: start, currentPeriodEnd: end, anchorDay: 1, renewalCount: 2, createdAt: "2026-07-01T09:00:00.000Z" }),
        usage: { envelopesSent: 143, templates: 22, contacts: 210 },
        invoices: [
          paidInvoice(3, start, "business", "monthly", 8, start, end),
          paidInvoice(2, "2026-08-01T00:00:00.000Z", "business", "monthly", 8, "2026-08-01T00:00:00.000Z", start),
          paidInvoice(1, "2026-07-01T09:00:00.000Z", "business", "monthly", 8, "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"),
        ],
        history: [
          { id: "h4", at: start, type: "renewed", title: "Business Monthly renewed", detail: "Charged A$308.00 for Sep 1, 2026 to Oct 1, 2026." },
          { id: "h3", at: "2026-08-15T09:00:00.000Z", type: "card_added", title: "Backup card added", detail: "Mastercard ending 4444, expires 06/2028. Only charged if the default card is declined." },
          { id: "h2", at: "2026-08-01T00:05:00.000Z", type: "renewed", title: "Business Monthly renewed", detail: "Charged A$308.00 for Aug 1, 2026 to Sep 1, 2026." },
          { id: "h1", at: "2026-07-01T09:00:00.000Z", type: "subscribed", title: "Subscribed to Business Monthly × 8 seats", detail: "Charged A$308.00 to card ending 4242." },
        ],
        consents: [{ id: "c1", at: "2026-07-01T09:00:00.000Z", source: "checkout", text: "I agree that Privy will charge A$308.00 to my card every month starting today until I cancel.", amount: 308, interval: "monthly", ip: "103.28.114.20" }],
      };
    }
    case "past-due": {
      const start = "2026-08-03T00:00:00.000Z";
      const due = "2026-09-03T00:00:00.000Z";
      const graceEnd = "2026-09-17T00:00:00.000Z";
      return {
        ...s,
        card: SOFT_VISA,
        subscription: sub({
          tier: "personal",
          interval: "monthly",
          currentPeriodStart: start,
          currentPeriodEnd: due,
          anchorDay: 3,
          status: "past_due",
          pastDueSince: "2026-09-03T09:00:00.000Z",
          graceEndsAt: graceEnd,
          nextRetryAt: "2026-09-10T00:00:00.000Z",
          retryCount: 1,
          renewalCount: 2,
          createdAt: "2026-06-03T09:00:00.000Z",
          attempts: [
            { id: "pa2", at: "2026-09-06T09:00:00.000Z", periodStart: due, attemptNo: 2, amount: 7.49, outcome: "soft_decline", declineCode: "insufficient_funds", onSession: false },
            { id: "pa1", at: "2026-09-03T09:00:00.000Z", periodStart: due, attemptNo: 1, amount: 7.49, outcome: "soft_decline", declineCode: "insufficient_funds", onSession: false },
          ],
        }),
        usage: { envelopesSent: 18, templates: 6, contacts: 40 },
        invoices: [
          paidInvoice(3, "2026-09-03T09:00:00.000Z", "personal", "monthly", 1, due, "2026-10-03T00:00:00.000Z", "open"),
          paidInvoice(2, start, "personal", "monthly", 1, start, due),
          paidInvoice(1, "2026-07-03T00:00:00.000Z", "personal", "monthly", 1, "2026-07-03T00:00:00.000Z", start),
        ],
        history: [
          { id: "h4", at: "2026-09-06T09:00:00.000Z", type: "renewal_failed", title: "Retry 2 of A$7.49 failed", detail: "insufficient_funds" },
          { id: "h3", at: "2026-09-03T09:00:00.000Z", type: "renewal_failed", title: "Renewal charge of A$7.49 failed", detail: "insufficient_funds. Retrying on Sep 6, 2026, Sep 10, 2026, Sep 17, 2026." },
          { id: "h2", at: start, type: "renewed", title: "Personal Monthly renewed", detail: "Charged A$7.49 for Aug 3, 2026 to Sep 3, 2026." },
          { id: "h1", at: "2026-06-03T09:00:00.000Z", type: "subscribed", title: "Subscribed to Personal Monthly" },
        ],
        emails: [
          { id: "e2", templateId: "N-07", at: "2026-09-10T08:00:00.000Z", to: USER.email, subject: "Reminder: update your payment method to keep Personal Monthly", body: ["We still could not charge card ending 9995. You have 7 days of access left.", "Your documents are safe either way."], cta: { label: "Update payment method", href: "/settings/billing/payment-method" } },
          { id: "e1", templateId: "N-05", at: "2026-09-03T09:00:00.000Z", to: USER.email, subject: "We could not renew your Privy Personal Monthly", body: ["Your bank declined the A$7.49 charge on card ending 9995.", "You keep full access until Sep 17, 2026. Update your card and we will retry right away; otherwise we retry on Sep 6, 2026, Sep 10, 2026, Sep 17, 2026."], cta: { label: "Update payment method", href: "/settings/billing/payment-method" } },
        ],
        sentKeys: ["N-05:2026-09-03T00:00:00.000Z", "N-07:2026-09-03T09:00:00.000Z"],
        consents: [{ id: "c1", at: "2026-06-03T09:00:00.000Z", source: "checkout", text: "I agree that Privy will charge A$7.49 to my card every month starting today until I cancel.", amount: 7.49, interval: "monthly", ip: "103.28.114.20" }],
      };
    }
    case "pending-downgrade": {
      const start = "2026-09-01T00:00:00.000Z";
      const end = "2026-10-01T00:00:00.000Z";
      return {
        ...s,
        card: VISA,
        workspace: workspace(true, 3),
        subscription: sub({
          tier: "business",
          interval: "monthly",
          seats: 3,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          anchorDay: 1,
          status: "change_scheduled",
          renewalCount: 1,
          createdAt: "2026-08-01T09:00:00.000Z",
          scheduledChange: { kind: "downgrade", tier: "personal", interval: "monthly", seats: 1, effectiveAt: end, createdAt: "2026-09-08T10:00:00.000Z" },
        }),
        usage: { envelopesSent: 66, templates: 12, contacts: 90 },
        invoices: [
          paidInvoice(2, start, "business", "monthly", 3, start, end),
          paidInvoice(1, "2026-08-01T09:00:00.000Z", "business", "monthly", 3, "2026-08-01T00:00:00.000Z", start),
        ],
        history: [
          { id: "h3", at: "2026-09-08T10:00:00.000Z", type: "change_scheduled", title: "Downgrade to Personal Monthly scheduled for Oct 1, 2026", detail: "Nothing charged today. A$7.49 will be charged on Oct 1, 2026. You can undo until then." },
          { id: "h2", at: start, type: "renewed", title: "Business Monthly renewed", detail: "Charged A$115.50 for Sep 1, 2026 to Oct 1, 2026." },
          { id: "h1", at: "2026-08-01T09:00:00.000Z", type: "subscribed", title: "Subscribed to Business Monthly × 3 seats" },
        ],
        emails: [
          { id: "e1", templateId: "N-11", at: "2026-09-08T10:00:00.000Z", to: USER.email, subject: "Your plan change is scheduled for Oct 1, 2026", body: ["You keep Business Monthly until Oct 1, 2026. From then you are on Personal Monthly at A$7.49 per month.", "Changed your mind? Keep your current plan with one click."], cta: { label: "Keep my current plan", href: "/settings/billing?action=undo" } },
        ],
        consents: [{ id: "c1", at: "2026-08-01T09:00:00.000Z", source: "checkout", text: "I agree that Privy will charge A$115.50 to my card every month starting today until I cancel.", amount: 115.5, interval: "monthly", ip: "103.28.114.20" }],
      };
    }
    case "cancel-scheduled": {
      const start = "2025-10-15T00:00:00.000Z";
      const end = "2026-10-15T00:00:00.000Z";
      return {
        ...s,
        card: VISA,
        subscription: sub({ tier: "personal", interval: "annual", currentPeriodStart: start, currentPeriodEnd: end, anchorDay: 15, status: "cancel_scheduled", cancelAtPeriodEnd: true, createdAt: start }),
        usage: { envelopesSent: 7, templates: 3, contacts: 15 },
        invoices: [paidInvoice(1, start, "personal", "annual", 1, start, end)],
        history: [
          { id: "h2", at: "2026-09-09T14:20:00.000Z", type: "cancel_scheduled", title: "Cancellation scheduled", detail: "Access continues until Oct 15, 2026. No further charges. Reason: Not signing enough documents." },
          { id: "h1", at: start, type: "subscribed", title: "Subscribed to Personal Yearly" },
        ],
        emails: [
          { id: "e1", templateId: "N-13", at: "2026-09-09T14:20:00.000Z", to: USER.email, subject: "Your Privy Personal Yearly is cancelled", body: ["You will not be charged again. You keep full access until Oct 15, 2026.", "Resume any time before then with one click."], cta: { label: "Resume subscription", href: "/settings/billing?action=resume" } },
        ],
      };
    }
    case "migrated-prepaid": {
      return {
        ...s,
        prepaid: {
          tier: "personal",
          periods: [
            { start: "2025-11-10T00:00:00.000Z", end: "2026-11-10T00:00:00.000Z", tier: "personal", interval: "annual", purchasedAt: "2025-11-10T09:00:00.000Z" },
            { start: "2026-11-10T00:00:00.000Z", end: "2027-11-10T00:00:00.000Z", tier: "personal", interval: "annual", purchasedAt: "2026-02-02T09:00:00.000Z" },
          ],
        },
        usage: { envelopesSent: 22, templates: 7, contacts: 44 },
        invoices: [
          paidInvoice(2, "2026-02-02T09:00:00.000Z", "personal", "annual", 1, "2026-11-10T00:00:00.000Z", "2027-11-10T00:00:00.000Z"),
          paidInvoice(1, "2025-11-10T09:00:00.000Z", "personal", "annual", 1, "2025-11-10T00:00:00.000Z", "2026-11-10T00:00:00.000Z"),
        ],
        history: [
          { id: "h2", at: "2026-02-02T09:00:00.000Z", type: "note", title: "Bought Personal Yearly (one-off unit)", detail: "Stacked after the current unit: active Nov 10, 2026 to Nov 10, 2027." },
          { id: "h1", at: "2025-11-10T09:00:00.000Z", type: "note", title: "Bought Personal Yearly (one-off unit)", detail: "Active Nov 10, 2025 to Nov 10, 2026." },
        ],
        emails: [
          { id: "e1", templateId: "N-17", at: "2026-09-02T09:00:00.000Z", to: USER.email, subject: "Keep your Privy Personal going after Nov 10, 2027", body: ["Your prepaid plan runs until Nov 10, 2027. Privy now offers automatic renewal so you never lose access.", "Turn it on in one step; we only charge on Nov 10, 2027. If you do nothing, your account moves to Free on Nov 10, 2027."], cta: { label: "Turn on auto-renewal", href: "/settings/billing?action=optin" } },
        ],
        sentKeys: ["N-17:golive"],
      };
    }
    case "free":
    default:
      return s;
  }
}

