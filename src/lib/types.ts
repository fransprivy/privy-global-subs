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
  /** First Business purchase: name of the workspace to create when the payment lands. */
  workspaceName?: string;
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
  | "workspace_created"
  | "workspace_expired"
  | "workspace_reactivated"
  | "handover"
  | "member_invited"
  | "member_removed"
  | "workspace_left"
  | "ownership_transferred"
  | "envelope_sent"
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

/**
 * "none": the user has never bought Business (no Business workspace exists).
 * "active": the owned Business workspace is usable.
 * "expired": the Business plan ended; the workspace is read-only (view and download only) until reactivated (R-72).
 */
export type WorkspaceStatus = "none" | "active" | "expired";

/** The Business workspace this user OWNS. There is at most one per user (R-70). */
export interface Workspace {
  name: string;
  members: Member[];
  automations: number;
  retentionPolicies: number;
  eSeal: boolean;
  branding: boolean;
  trustedDomain: string | null;
  /** Legacy flag kept for older saved states; `status` is authoritative. */
  closed: boolean;
  status?: WorkspaceStatus;
  createdAt?: string | null;
  expiredAt?: string | null;
  /** Envelopes that live in this workspace. */
  documents?: Task[];
  /** Set when the owner handed the workspace documents over to their Individual workspace. */
  handedOverAt?: string | null;
  usage?: Usage;
}

/** A Business or Enterprise workspace the user is a MEMBER of (bought by someone else). Never affects the user's own plan (R-71). */
export interface OtherWorkspace {
  id: string;
  name: string;
  kind: "business" | "enterprise";
  ownerName: string;
  status: "active" | "expired";
  expiredAt?: string | null;
  /** The owner's plan is scheduled to end on this date (cancel or downgrade): the workspace becomes read-only then (B-10). */
  endingAt?: string | null;
  /** Ownership was just transferred to this owner and they have not added a payment method yet (R-81). */
  paymentPending?: boolean;
  /** Enterprise: contract end shown on the billing page. */
  contractEnd?: string | null;
  initials: string;
  color: string;
  documents: Task[];
  usage: Usage;
  memberCount: number;
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
  status: "waiting_for_you" | "waiting_for_others" | "completed";
}

export interface UIState {
  showSpecTags: boolean;
  controlsOpen: boolean;
  /** In-flow test guide (right-hand panel). Optional so states saved before it existed still load. */
  guideOpen?: boolean;
  checkedSteps?: string[];
  /** Shown once after the Business workspace is created (M-15). */
  welcomeBusiness?: boolean;
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
  /** Workspaces the user was invited to. */
  otherWorkspaces?: OtherWorkspace[];
  /** "individual" | "business" (the owned one) | id of an OtherWorkspace. */
  activeWorkspace?: string;
  /** Individual workspace usage. */
  usage: Usage;
  /** Individual workspace envelopes (the home page task list). */
  tasks: Task[];
  nextChargeOverride: CardBehavior | null;
  optInDismissed: boolean;
  ui: UIState;
}
