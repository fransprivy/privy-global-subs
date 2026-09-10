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
}

export interface PrepaidPeriod {
  start: string;
  end: string;
  tier: PaidTier;
  interval: Interval;
  purchasedAt: string;
}

export interface Prepaid {
  tier: PaidTier;
  periods: PrepaidPeriod[];
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
  | "opt_in"
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
  source: "checkout" | "upgrade" | "interval_change" | "resume" | "opt_in";
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

export interface AppState {
  version: number;
  scenarioId: string;
  now: string;
  user: { name: string; email: string; maskedEmail: string };
  subscription: Subscription | null;
  prepaid: Prepaid | null;
  card: Card | null;
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
