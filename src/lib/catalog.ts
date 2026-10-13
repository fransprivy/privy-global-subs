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
  currency: "AUD" | "IDR";
  /** Indonesia: one-time purchases and local payment methods; everywhere else: recurring cards only. */
  market: "global" | "indonesia";
  taxNote: string;
}

export const REGIONS: RegionMeta[] = [
  { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", market: "global", taxNote: "after tax" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", market: "indonesia", taxNote: "includes PPN" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", currency: "AUD", market: "global", taxNote: "after tax" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", currency: "AUD", market: "global", taxNote: "after tax" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "AUD", market: "global", taxNote: "after tax" },
  { code: "US", name: "United States", flag: "🇺🇸", currency: "AUD", market: "global", taxNote: "after tax" },
];

export function regionMeta(code: Region): RegionMeta {
  return REGIONS.find((r) => r.code === code) ?? REGIONS[0];
}

/**
 * Prices per region. Global (AUD) matches the privyid.com pricing page.
 * Indonesia (IDR) per Frans, 22 Sep 2026: Personal 54K / 395K, Pro 99K / 725K per seat, tax inclusive.
 */
export const PRICE_TABLES: Record<RegionMeta["currency"], Record<PaidTier, Record<Interval, number>>> = {
  AUD: {
    personal: { monthly: 7.49, annual: 79 },
    business: { monthly: 38.5, annual: 396 },
  },
  IDR: {
    personal: { monthly: 54000, annual: 395000 },
    business: { monthly: 99000, annual: 725000 },
  },
};

export const SAVINGS_TABLES: Record<RegionMeta["currency"], Record<PaidTier, { pct: number; amount: number; perMonth: number }>> = {
  AUD: {
    personal: { pct: 12, amount: 10.88, perMonth: 6.58 },
    business: { pct: 14, amount: 66, perMonth: 33 },
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
  return c === "IDR" ? "Rp " : "A$";
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
export const BILL_REMINDER_DAYS = [3, 1];

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
  /** The one thing this plan adds over the plan below it. Shown first on the card. */
  mainBenefit: string;
  mainBenefitDetail: string;
  highlights: { label: string; value?: string }[];
  everythingIn?: Tier;
  recommended?: boolean;
}

export const PLAN_CARDS: PlanCardSpec[] = [
  {
    tier: "free",
    blurb: "No card needed, no expiry",
    bestFor: "Individuals who want to experience signing digitally.",
    mainBenefit: "5 envelopes a month",
    mainBenefitDetail: "Sign and send for free, no card needed.",
    highlights: [
      { label: "Envelopes sent", value: "5 / month" },
      { label: "Reusable templates", value: "5" },
      { label: "Saved contacts", value: "Unlimited" },
      { label: "Chat feature" },
    ],
  },
  {
    tier: "personal",
    blurb: "Billed monthly",
    bestFor: "Individuals signing documents on a regular basis.",
    mainBenefit: "Unlimited envelopes",
    mainBenefitDetail: "Send as many envelopes as you need, every month.",
    everythingIn: "free",
    highlights: [
      { label: "Envelopes sent", value: "Unlimited" },
      { label: "Reusable templates", value: "Unlimited" },
      { label: "Reports & analytics" },
    ],
  },
  {
    tier: "business",
    blurb: "Billed monthly per seat",
    bestFor: "Small to medium size businesses that sign together.",
    mainBenefit: "Dedicated workspace and team members",
    mainBenefitDetail: "A shared workspace for your company, with members you invite.",
    everythingIn: "personal",
    recommended: true,
    highlights: [
      { label: "Dedicated team workspace" },
      { label: "Team members", value: "1 to Unlimited" },
      { label: "Workflow automation" },
      { label: "Custom branding" },
    ],
  },
  {
    tier: "enterprise",
    blurb: "Priced on your team size and needs",
    bestFor: "Companies with compliance needs.",
    mainBenefit: "Custom limits, SSO and API",
    mainBenefitDetail: "Contract, onboarding and controls for larger companies.",
    everythingIn: "business",
    highlights: [
      { label: "Envelopes sent", value: "Custom" },
      { label: "SSO / SAML sign-in" },
      { label: "API & integration" },
      { label: "Handover" },
    ],
  },
];

export type CellValue = true | false | string;

export interface CompareRow {
  label: string;
  values: [CellValue, CellValue, CellValue, CellValue]; // free, personal, business, enterprise
  annualValues?: [CellValue, CellValue, CellValue, CellValue];
}

export interface CompareGroup {
  group: string;
  rows: CompareRow[];
}

export const COMPARE_TABLE: CompareGroup[] = [
  {
    group: "Limits",
    rows: [
      {
        label: "Envelopes sent",
        values: ["5 / month", "Unlimited", "Unlimited", "Custom"],
      },
      { label: "Dedicated team workspace", values: [false, false, true, true] },
      { label: "Team members", values: ["1", "1", "1 to Unlimited", "Custom"] },
      { label: "Reusable templates", values: ["5", "Unlimited", "Unlimited", "Yes"] },
      { label: "Saved contacts", values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
    ],
  },
  {
    group: "In every plan",
    rows: [
      { label: "Chat feature", values: [true, true, true, true] },
      { label: "Document upload (PDF, DOCX, PPTX, XLSX, JPG, PNG)", values: [true, true, true, true] },
      { label: "Auto reminder", values: [true, true, true, true] },
      { label: "Digital signature verification", values: [true, true, true, true] },
      { label: "Linked documents & attachments", values: [true, true, true, true] },
      { label: "Cloud connections (Google Drive & OneDrive)", values: [true, true, true, true] },
      { label: "Expiry", values: [true, true, true, true] },
      { label: "Repeat reminder", values: [true, true, true, true] },
    ],
  },
  {
    group: "Insight",
    rows: [{ label: "Reports & analytics", values: [false, true, true, true] }],
  },
  {
    group: "Teams and control",
    rows: [
      { label: "Participant groups", values: [false, false, true, true] },
      { label: "Workflow automation", values: [false, false, true, true] },
      { label: "Retention policy", values: [false, false, true, true] },
      { label: "e-Seal", values: [false, false, true, true] },
      { label: "Company e-Stamp", values: [false, false, true, true] },
      { label: "Workspace preferences & role management", values: [false, false, true, true] },
      { label: "Action delegation", values: [false, false, true, true] },
      { label: "Trusted domain", values: [false, false, true, true] },
      { label: "Custom branding", values: [false, false, true, true] },
    ],
  },
  {
    group: "Enterprise controls",
    rows: [
      { label: "SSO / SAML sign-in", values: [false, false, false, true] },
      { label: "API & integration", values: [false, false, false, true] },
      { label: "Handover", values: [false, false, false, true] },
    ],
  },
];

/** Features a workspace loses when going Pro -> Personal (used by the downgrade checklist, UX-07). */
export const BUSINESS_ONLY_FEATURES = [
  "Participant groups",
  "Workflow automation",
  "Retention policy",
  "e-Seal and Company e-Stamp",
  "Workspace preferences & role management",
  "Action delegation",
  "Trusted domain",
  "Custom branding",
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
