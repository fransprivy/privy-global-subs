import type { Interval, PaidTier, Tier } from "./types";

/**
 * Plan facts, corrected to match the privyid.com pricing page (Global, AUD, "after tax").
 * Source of truth for every plan card and comparison table in the prototype.
 */

/* ------------------------------------------------------------------ */
/* Regions                                                             */
/* ------------------------------------------------------------------ */
export type Region = "AU" | "ID" | "SG" | "MY" | "GB" | "US";

export interface RegionMeta {
  code: Region;
  name: string;
  flag: string;
  currency: "AUD" | "IDR" | "USD";
  /** Indonesia: manual payment and local payment methods; everywhere else: recurring cards only. Indonesia shows IDR, Australia AUD, every other country USD. */
  market: "global" | "indonesia";
  taxNote: string;
}

export const REGIONS: RegionMeta[] = [
  { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", market: "global", taxNote: "after tax" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", market: "indonesia", taxNote: "includes PPN" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", currency: "USD", market: "global", taxNote: "after tax" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", currency: "USD", market: "global", taxNote: "after tax" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "USD", market: "global", taxNote: "after tax" },
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", market: "global", taxNote: "after tax" },
];

export function regionMeta(code: Region): RegionMeta {
  return REGIONS.find((r) => r.code === code) ?? REGIONS[0];
}

/**
 * Prices per currency, from the doc "Pricing Page Update: Plans, Prices and Feature Comparison" (Oct 2026).
 * USD and AUD: yearly is 20% below 12 months of monthly. Pro prices are per seat.
 * Indonesia (IDR) per Frans, 22 Sep 2026: Personal 54K / 395K, Pro 99K / 725K per seat, tax inclusive (unchanged).
 */
export const PRICE_TABLES: Record<RegionMeta["currency"], Record<PaidTier, Record<Interval, number>>> = {
  USD: {
    personal: { monthly: 9.99, annual: 95.9 },
    business: { monthly: 27.5, annual: 264 },
  },
  AUD: {
    personal: { monthly: 11.99, annual: 115.1 },
    business: { monthly: 33, annual: 316.8 },
  },
  IDR: {
    personal: { monthly: 54000, annual: 395000 },
    business: { monthly: 99000, annual: 725000 },
  },
};

export const SAVINGS_TABLES: Record<RegionMeta["currency"], Record<PaidTier, { pct: number; amount: number; perMonth: number }>> = {
  USD: {
    personal: { pct: 20, amount: 23.98, perMonth: 7.99 },
    business: { pct: 20, amount: 66, perMonth: 22 },
  },
  AUD: {
    personal: { pct: 20, amount: 28.78, perMonth: 9.59 },
    business: { pct: 20, amount: 79.2, perMonth: 26.4 },
  },
  IDR: {
    // 54,000 × 12 = 648,000 vs 395,000 (save 39%); 99,000 × 12 = 1,188,000 vs 725,000 (save 39%)
    personal: { pct: 39, amount: 253000, perMonth: 32917 },
    business: { pct: 39, amount: 463000, perMonth: 60417 },
  },
};

/**
 * Active region for pricing and money formatting. The store sets this whenever the state changes
 * (prototype shortcut so the hundreds of fmtMoney/planPrice call sites need no region argument).
 */
let activeRegion: Region = "AU";
export function setActiveRegion(r: Region) {
  activeRegion = r;
}
export function getActiveRegion(): Region {
  return activeRegion;
}
export function activeCurrency(): RegionMeta["currency"] {
  return regionMeta(activeRegion).currency;
}
export function currencyPrefix(c = activeCurrency()): string {
  return c === "IDR" ? "Rp " : c === "USD" ? "US$" : "A$";
}

export const CURRENCY = "AUD";
export const CURRENCY_PREFIX = "A$";

/** Live price table for the active region. */
export const PRICES: Record<PaidTier, Record<Interval, number>> = new Proxy({} as Record<PaidTier, Record<Interval, number>>, {
  get: (_t, tier: string) => PRICE_TABLES[activeCurrency()][tier as PaidTier],
});
export const ANNUAL_SAVINGS: Record<PaidTier, { pct: number; amount: number; perMonth: number }> = new Proxy({} as Record<PaidTier, { pct: number; amount: number; perMonth: number }>, {
  get: (_t, tier: string) => SAVINGS_TABLES[activeCurrency()][tier as PaidTier],
});

/* ------------------------------------------------------------------ */
/* Indonesia payment methods                                           */
/* ------------------------------------------------------------------ */
export type PurchaseType = "recurring" | "one_time";
export type PaymentMethodKind = "card" | "qris" | "va";
export type VaBank = "BRI" | "BCA" | "CIMB" | "Mandiri" | "Permata";
export const VA_BANKS: { code: VaBank; name: string; prefix: string }[] = [
  { code: "BRI", name: "Bank BRI", prefix: "26215" },
  { code: "BCA", name: "Bank BCA", prefix: "39012" },
  { code: "CIMB", name: "CIMB Niaga", prefix: "5919" },
  { code: "Mandiri", name: "Bank Mandiri", prefix: "88908" },
  { code: "Permata", name: "Bank Permata", prefix: "8625" },
];
/** How long a generated Payment ID stays payable (hours). */
export const PAYMENT_ID_VALID_HOURS = 2;
/** Manual payment (Indonesia): reminder days before the plan ends. No bill is issued and nothing can be paid early. */
export const BILL_LEAD_DAYS = 7;

export const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  personal: "Personal",
  business: "Pro",
  enterprise: "Enterprise",
};

export const INTERVAL_LABEL: Record<Interval, string> = {
  monthly: "Monthly",
  annual: "Yearly",
};

export const TIER_RANK: Record<Tier, number> = { free: 0, personal: 1, business: 2, enterprise: 3 };

export interface PlanCardSpec {
  tier: Tier;
  blurb: string;
  bestFor: string;
  highlights: { label: string; value?: string; info?: boolean }[];
  everythingIn?: Tier;
  recommended?: boolean;
}

export const PLAN_CARDS: PlanCardSpec[] = [
  {
    tier: "free",
    blurb: "No cost",
    bestFor: "For individuals who want to experience signing digitally",
    highlights: [
      { label: "Envelopes", value: "5 / month", info: true },
      { label: "Reusable templates", value: "5" },
      { label: "Storage", value: "10 GB" },
    ],
  },
  {
    tier: "personal",
    blurb: "Billed monthly",
    bestFor: "For individuals who send and sign often",
    everythingIn: "free",
    highlights: [
      { label: "Envelopes", value: "Unlimited", info: true },
      { label: "Reusable templates", value: "Unlimited" },
      { label: "Storage", value: "Unlimited" },
    ],
  },
  {
    tier: "business",
    blurb: "Billed monthly per seat",
    bestFor: "For teams that send and sign together",
    everythingIn: "personal",
    recommended: true,
    highlights: [
      { label: "Team members", value: "1 to Unlimited" },
      { label: "Recipient groups" },
      { label: "Scheduled reminders" },
      { label: "Expiry date on envelopes" },
      { label: "Your own branding" },
    ],
  },
  {
    tier: "enterprise",
    blurb: "Priced on your team size and needs",
    bestFor: "For medium to large companies with compliance needs",
    everythingIn: "business",
    highlights: [
      { label: "Team size", value: "Custom" },
      { label: "Handover when someone leaves or changes roles" },
      { label: "Delegate actions to a teammate" },
      { label: "Seals and stamps" },
      { label: "Approved domains for invites" },
      { label: "Add-ons", value: "SSO/SAML, API, Bulk Sign, e-Meterai" },
    ],
  },
];

export type CellValue = true | false | string;

export interface CompareRow {
  label: string;
  values: [CellValue, CellValue, CellValue, CellValue]; // free, personal, business, enterprise
  annualValues?: [CellValue, CellValue, CellValue, CellValue];
  /** Show the "What uses an envelope" info button next to the label. */
  info?: boolean;
}

export interface CompareGroup {
  group: string;
  rows: CompareRow[];
}

/**
 * Feature comparison, from the Tiered Subscription Matrix (Privy Global columns), same for USD and AUD.
 * Group order: limits, team, reminders, branding, control and compliance, support, add-ons, then every plan.
 */
export const COMPARE_TABLE: CompareGroup[] = [
  {
    group: "Usage limits",
    rows: [
      { label: "Envelopes", values: ["5 / month", "Unlimited", "Unlimited", "Unlimited"], info: true },
      { label: "Reusable templates", values: ["5", "Unlimited", "Unlimited", "Unlimited"] },
      { label: "Storage", values: ["10 GB", "Unlimited", "Unlimited", "Unlimited"] },
      { label: "Team members", values: ["1", "1", "1 to unlimited", "Custom"] },
    ],
  },
  {
    group: "Team and admin",
    rows: [
      { label: "Participant groups", values: [false, false, true, true] },
      { label: "Reports & analytics", values: [false, false, true, true] },
      { label: "Admin center & role management", values: [false, false, true, true] },
    ],
  },
  {
    group: "Reminders and expiry",
    rows: [
      { label: "Repeat reminders", values: [false, false, true, true] },
      { label: "Envelope expiry", values: [false, false, true, true] },
    ],
  },
  {
    group: "Branding",
    rows: [{ label: "Custom branding", values: [false, false, true, true] }],
  },
  {
    group: "Control and compliance",
    rows: [
      { label: "Organization & Departments", values: [false, false, false, true] },
      { label: "Document Category", values: [false, false, false, true] },
      { label: "Action delegation", values: [false, false, false, true] },
      { label: "Handover", values: [false, false, false, true] },
      { label: "Company e-Seal", values: [false, false, false, true] },
      { label: "Company e-Stamp", values: [false, false, false, true] },
      { label: "Trusted domain", values: [false, false, false, true] },
    ],
  },
  {
    group: "Support",
    rows: [{ label: "Support", values: ["Help center", "Email", "Priority", "Dedicated CSM"] }],
  },
  {
    group: "Add-ons (priced separately)",
    rows: [
      { label: "Bulk Sign", values: [false, false, false, "Add-on"] },
      { label: "SSO / SAML sign-in", values: [false, false, false, "Add-on"] },
      { label: "API integration", values: [false, false, false, "Add-on"] },
      { label: "e-Meterai", values: ["Add-on", "Add-on", "Add-on", "Add-on"] },
    ],
  },
  {
    group: "Included in every plan",
    rows: [
      { label: "PrivyChat messaging", values: [true, true, true, true] },
      { label: "Upload formats (PDF, DOCX, PPTX, XLSX, JPG, PNG)", values: [true, true, true, true] },
      { label: "Digital signature verification", values: [true, true, true, true] },
      { label: "Auto reminders", values: [true, true, true, true] },
      { label: "Workflow automation", values: [true, true, true, true] },
      { label: "Linked documents & attachments", values: [true, true, true, true] },
      { label: "Retention policy", values: [true, true, true, true] },
      { label: "Cloud connections (Google Drive & OneDrive)", values: [true, true, true, true] },
      { label: "Contacts", values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
      { label: "Recipients per document", values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
      { label: "Access Web & Mobile App", values: [true, true, true, true] },
      { label: "Parallel and serial signing", values: [true, true, true, true] },
    ],
  },
];

export const ENVELOPE_LIMIT: Record<Tier, number | null> = {
  free: 5,
  personal: null,
  business: null,
  enterprise: null,
};
export const TEMPLATE_LIMIT: Record<Tier, number | null> = {
  free: 5,
  personal: null,
  business: null,
  enterprise: null,
};
