import type { Interval, PaidTier, Tier } from "./types";

/**
 * Plan facts, corrected to match the privyid.com pricing page (Global, AUD, "after tax").
 * Source of truth for every plan card and comparison table in the prototype.
 */

export const CURRENCY = "AUD";
export const CURRENCY_PREFIX = "A$";

export const PRICES: Record<PaidTier, Record<Interval, number>> = {
  // per month for monthly, per year for annual; Business is per seat
  personal: { monthly: 7.49, annual: 79 },
  business: { monthly: 38.5, annual: 396 },
};

export const ANNUAL_SAVINGS: Record<PaidTier, { pct: number; amount: number; perMonth: number }> = {
  personal: { pct: 12, amount: 10.88, perMonth: 6.58 },
  business: { pct: 14, amount: 66, perMonth: 33 },
};

export const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  personal: "Personal",
  business: "Business",
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
  highlights: { label: string; value?: string }[];
  everythingIn?: Tier;
  recommended?: boolean;
}

export const PLAN_CARDS: PlanCardSpec[] = [
  {
    tier: "free",
    blurb: "No card needed, no expiry",
    bestFor: "Individuals who want to experience signing digitally.",
    highlights: [
      { label: "Envelopes sent", value: "5 / month" },
      { label: "Reusable templates", value: "5" },
      { label: "Saved contacts", value: "Unlimited" },
      { label: "Chat feature" },
    ],
  },
  {
    tier: "personal",
    blurb: "Billed monthly · after tax",
    bestFor: "Individuals signing documents on a regular basis.",
    everythingIn: "free",
    highlights: [
      { label: "Envelopes sent", value: "50 / month" },
      { label: "Reusable templates", value: "Unlimited" },
      { label: "Reports & analytics" },
    ],
  },
  {
    tier: "business",
    blurb: "Billed monthly per seat · after tax",
    bestFor: "Small to medium size businesses that sign together.",
    everythingIn: "personal",
    recommended: true,
    highlights: [
      { label: "Envelopes sent", value: "Unlimited" },
      { label: "Team members", value: "1 to Unlimited" },
      { label: "Workflow automation" },
      { label: "Custom branding" },
    ],
  },
  {
    tier: "enterprise",
    blurb: "Priced on your team size and needs",
    bestFor: "Companies with compliance needs.",
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
        values: ["5 / month", "50 / month", "Unlimited", "Custom"],
        annualValues: ["5 / month", "600 / year", "Unlimited", "Custom"],
      },
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

/** Features a workspace loses when going Business -> Personal (used by the downgrade checklist, UX-07). */
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
  personal: 50,
  business: null,
  enterprise: null,
};
export const TEMPLATE_LIMIT: Record<Tier, number | null> = {
  free: 5,
  personal: null,
  business: null,
  enterprise: null,
};
