import type { PaymentMethodKind, PurchaseType, Region, VaBank } from "./catalog";
export type { PaymentMethodKind, PurchaseType, Region, VaBank };

export type Tier = "free" | "personal" | "business" | "enterprise";
export type Interval = "monthly" | "annual";
export type PaidTier = "personal" | "business";

export type SubStatus =
  | "active"
  | "past_due"
  | "cancel_scheduled"
  | "change_scheduled"
  | "ended";

export type CardBehavior = "success" | "soft_decline" | "hard_decline" | "requires_action";

export interface Card {
  /** Stable id (optional for states saved before backup cards existed). */
  id?: string;
  brand: "visa" | "mastercard" | "amex";
  last4: string;
  expMonth: number;
  expYear: number;
  /** How this card behaves when charged in the prototype (mirrors Stripe test cards). */
  behavior: CardBehavior;
  addedAt: string;
}

export type ChangeKind = "downgrade" | "interval_down" | "scheduled_upgrade";

export interface ScheduledChange {
  kind: ChangeKind;
  tier: PaidTier;
  interval: Interval;
  seats: number;
  effectiveAt: string;
  createdAt: string;
}

export type AttemptOutcome = "succeeded" | "soft_decline" | "hard_decline" | "requires_action";

export interface PaymentAttempt {
  id: string;
  at: string;
  periodStart: string;
  attemptNo: number;
  amount: number;
  outcome: AttemptOutcome;
  declineCode?: string;
  onSession: boolean;
  /** Which saved card was tried (default first, then backups in order). */
  cardLast4?: string;
}

export interface Subscription {
  id: string;
  tier: PaidTier;
  interval: Interval;
  seats: number;
  status: SubStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  anchorDay: number;
  cancelAtPeriodEnd: boolean;
  scheduledChange: ScheduledChange | null;
  pastDueSince: string | null;
  graceEndsAt: string | null;
  nextRetryAt: string | null;
  retryCount: number;
  hardDeclined: boolean;
  pendingAuthAmount: number | null;
  renewalCount: number;
  attempts: PaymentAttempt[];
  createdAt: string;
  endedAt: string | null;
  /** Business only: seat reduction that takes effect at the end of the current period (no refund). */
  pendingSeats?: number | null;
}

export interface PrepaidPeriod {
  start: string;
  end: string;
  tier: PaidTier;
  interval: Interval;
  purchasedAt: string;
  seats?: number;
  /** How this period was paid (Indonesia one-time purchases). Card payers are eligible to convert to auto-renewal. */
  paidWith?: PaymentMethodKind;
  paidWithLabel?: string;
}

export interface Prepaid {
  tier: PaidTier;
  periods: PrepaidPeriod[];
  /** "migration": old Global SKU units. "one_time": Indonesia one-time purchases (bills before expiry, no grace). */
  source?: "migration" | "one_time";
}

export type BillStatus = "awaiting" | "pending_payment" | "paid" | "expired" | "void";

/** A payment request for a one-time purchase or a renewal bill (Indonesia). */
export interface PaymentRequest {
  paymentId: string;
  method: PaymentMethodKind;
  bank?: VaBank;
  vaNumber?: string;
  cardLast4?: string;
  createdAt: string;
  expiresAt: string;
}

export interface Bill {
  id: string;
  kind: "purchase" | "renewal";
  tier: PaidTier;
  interval: Interval;
  seats: number;
  amount: number;
  /** Period the payment buys. For renewals: starts at the current expiry. */
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  /** Renewal bills die at the plan's expiry date; purchases die with their Payment ID. */
  dueAt: string;
  status: BillStatus;
  payment: PaymentRequest | null;
  invoiceId?: string;
  paidAt?: string;
}

export type InvoiceStatus = "paid" | "open" | "void" | "refunded";

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  description: string;
  periodStart?: string;
  periodEnd?: string;
  /** e.g. "Card ending 4242", "QRIS", "VA BCA" */
  method?: string;
}

export type HistoryType =
  | "subscribed"
  | "renewed"
  | "renewal_failed"
  | "recovered"
  | "upgraded"
  | "interval_changed"
  | "change_scheduled"
  | "change_undone"
  | "change_applied"
  | "cancel_scheduled"
  | "resumed"
  | "ended"
  | "card_updated"
  | "card_added"
  | "card_removed"
  | "seats_changed"
  | "opt_in"
  | "bill_issued"
  | "bill_paid"
  | "bill_expired"
  | "payment_pending"
  | "payment_expired"
  | "region_changed"
  | "note";

export interface HistoryEvent {
  id: string;
  at: string;
  type: HistoryType;
  title: string;
  detail?: string;
}

export interface SentEmail {
  id: string;
  templateId: string;
  at: string;
  to: string;
  subject: string;
  body: string[];
  cta?: { label: string; href: string };
}

export interface ConsentRecord {
  id: string;
  at: string;
  source: "checkout" | "upgrade" | "interval_change" | "resume" | "opt_in" | "seats";
  text: string;
  amount: number;
  interval: Interval;
  ip: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
}

export interface Workspace {
  name: string;
  members: Member[];
  automations: number;
  retentionPolicies: number;
  eSeal: boolean;
  branding: boolean;
  trustedDomain: string | null;
  closed: boolean;
}

export interface Usage {
  envelopesSent: number;
  templates: number;
  contacts: number;
}

export interface Task {
  id: string;
  title: string;
  from: string;
  assignedAgo: string;
  status: "waiting_for_you" | "waiting_for_others";
}

export interface UIState {
  showSpecTags: boolean;
  controlsOpen: boolean;
  /** In-flow test guide (right-hand panel). Optional so states saved before it existed still load. */
  guideOpen?: boolean;
  checkedSteps?: string[];
  toast: { id: string; text: string; tone: "success" | "info" | "warn" } | null;
}

export interface WorkspacePrefs {
  timezone: string;
  dateFormat: string;
}

export interface AppState {
  version: number;
  scenarioId: string;
  now: string;
  /** Workspace region (Settings → Workspace preferences). Drives currency, purchase types and payment methods. */
  region?: Region;
  prefs?: WorkspacePrefs;
  /** Indonesia one-time bills and payment requests. */
  bills?: Bill[];
  user: { name: string; email: string; maskedEmail: string };
  subscription: Subscription | null;
  prepaid: Prepaid | null;
  /** Default card. Backups are tried in order when the default is declined (R-19b). */
  card: Card | null;
  backupCards?: Card[];
  invoices: Invoice[];
  history: HistoryEvent[];
  emails: SentEmail[];
  consents: ConsentRecord[];
  sentKeys: string[];
  workspace: Workspace;
  usage: Usage;
  tasks: Task[];
  nextChargeOverride: CardBehavior | null;
  optInDismissed: boolean;
  ui: UIState;
}
