/**
 * Notification catalogue (emails). Ids match tab 5 of Privy_Subscription_Rework_Scope.xlsx
 * and the billing-behaviour document. Copy is the first-pass English draft from that catalogue,
 * rendered with live data from the current scenario.
 */

export interface EmailCtx {
  name: string;
  memberName?: string;
  planName: string; // e.g. "Personal Monthly"
  tierLabel: string; // e.g. "Personal"
  intervalWord: "month" | "year";
  amount: string; // formatted
  nextDate: string; // formatted
  periodEnd: string; // formatted
  last4: string;
  graceEnd: string;
  daysLeft: number;
  oldPlanName: string;
  newPlanName: string;
  newAmount: string;
  effectiveDate: string;
  forfeitDays: number;
  workspaceName: string;
  memberCount: number;
  invoiceNumber: string;
  declineClass: "soft" | "hard" | "no_card";
  newEnd: string;
  prepaidEnd: string;
  isBusiness: boolean;
  rolledDays: number;
  retryDates: string;
  oldPrice: string;
  newPrice: string;
  seatsDelta: number;
  seatsTotal: number;
  proratedAmount: string;
  backupLast4: string;
  defaultLast4: string;
  /** Amount charged and reversed to check a new card (A$1 / Rp 10,000). */
  checkAmount: string;
}

export interface EmailTemplateMeta {
  id: string;
  name: string;
  trigger: string;
  timing: string;
  legal: string;
  group: "Lifecycle" | "Renewal" | "Dunning" | "Changes" | "Migration" | "Indonesia" | "Workspaces" | "Vouchers" | "Other";
}

export interface RenderedEmail {
  subject: string;
  body: string[];
  cta?: { label: string; href: string };
}

export const EMAIL_META: EmailTemplateMeta[] = [
  { id: "N-01", name: "Subscription active", trigger: "First successful charge", timing: "Immediately", legal: "Yes: post-purchase acknowledgment (FTC / CA / UK)", group: "Lifecycle" },
  { id: "N-02", name: "Upgrade confirmed", trigger: "Upgrade completed (starts today, unused days of the old plan forfeited)", timing: "Immediately", legal: "Recommended", group: "Changes" },
  { id: "N-03", name: "Renewal receipt", trigger: "Renewal charge succeeded", timing: "Immediately", legal: "Receipt expected", group: "Renewal" },
  { id: "N-04", name: "Renewal reminder", trigger: "Annual: T-30 and T-7. Monthly: every 6th renewal at T-7", timing: "Before the charge", legal: "Yes: CA ARL 15-45 days for annual; UK DMCC every 6 months", group: "Renewal" },
  { id: "N-05", name: "Payment failed", trigger: "Renewal charge failed (Day 0)", timing: "Immediately", legal: "Recommended", group: "Dunning" },
  { id: "N-06", name: "Confirm with your bank", trigger: "Renewal needs authentication (SCA / 3DS)", timing: "Immediately", legal: "Recommended", group: "Dunning" },
  { id: "N-07", name: "Still unpaid", trigger: "Day 7 of grace", timing: "Day 7", legal: "Recommended", group: "Dunning" },
  { id: "N-08", name: "Final warning", trigger: "Day 12 of grace", timing: "2 days before grace ends", legal: "Recommended", group: "Dunning" },
  { id: "N-09", name: "Moved to Free", trigger: "Grace ended, downgraded to Free (Day 14)", timing: "At downgrade", legal: "Recommended", group: "Dunning" },
  { id: "N-10", name: "Card expiring", trigger: "Card expires before next renewal, not auto-updated", timing: "T-7", legal: "No", group: "Renewal" },
  { id: "N-11", name: "Billing switch scheduled", trigger: "Monthly to yearly or yearly to monthly switch requested (applies at period end)", timing: "Immediately", legal: "Recommended", group: "Changes" },
  { id: "N-11b", name: "Change reminder", trigger: "Billing switch or cancellation takes effect in 3 days (UX-10)", timing: "T-3", legal: "Recommended", group: "Changes" },
  { id: "N-12", name: "Billing switch applied", trigger: "Scheduled monthly / yearly switch took effect", timing: "At effective date", legal: "Receipt expected", group: "Changes" },
  { id: "N-13", name: "Cancellation confirmed", trigger: "Cancellation scheduled", timing: "Immediately", legal: "Yes: CA / UK confirmation of cancellation", group: "Lifecycle" },
  { id: "N-14", name: "Plan ended", trigger: "Cancelled subscription reached period end", timing: "At period end", legal: "Recommended", group: "Lifecycle" },
  { id: "N-15", name: "Welcome back", trigger: "Subscription resumed", timing: "Immediately", legal: "Recommended", group: "Lifecycle" },
  { id: "N-16", name: "Workspace read-only (members)", trigger: "Pro plan cancelled, not renewed or ended: workspace becomes read-only for members", timing: "At cancellation and at the end date", legal: "No", group: "Changes" },
  { id: "N-17", name: "Turn on auto-renewal", trigger: "Migration opt-in series for prepaid users", timing: "Go-live, T-30, T-7, T-1", legal: "Yes: terms change notice", group: "Migration" },
  { id: "N-18", name: "Payment dispute", trigger: "Chargeback opened", timing: "Immediately", legal: "No", group: "Other" },
  { id: "N-19", name: "Price change notice", trigger: "Price change", timing: "30 days before first renewal at new price", legal: "Yes", group: "Other" },
  { id: "N-20", name: "Prepaid plan ended", trigger: "Prepaid time ended without opt-in", timing: "At prepaid end", legal: "No", group: "Migration" },
  { id: "N-21", name: "Payment method updated", trigger: "Default card added, replaced or changed (card checked with A$1 / Rp 10,000, reversed)", timing: "Immediately", legal: "Recommended: explains the check charge", group: "Other" },
  { id: "N-22", name: "Seats changed", trigger: "Pro seats added (prorated charge) or reduction scheduled", timing: "Immediately", legal: "Receipt expected when charged", group: "Changes" },
  { id: "N-23", name: "Backup card charged", trigger: "Default card declined, a backup card succeeded", timing: "Immediately after the charge", legal: "Recommended (transparency on which card was used)", group: "Renewal" },
  { id: "N-24", name: "Backup card added", trigger: "A backup card was saved", timing: "Immediately", legal: "No", group: "Other" },
  { id: "N-30", name: "Plan ending reminder (manual payment)", trigger: "Indonesia manual payment plan, 7 days before it ends. No bill, nothing to pay yet", timing: "T-7", legal: "Recommended", group: "Indonesia" },
  { id: "N-30b", name: "Plan ending reminder (follow-up)", trigger: "Manual payment plan still ending, auto-renewal not on", timing: "T-3 and T-1", legal: "Recommended", group: "Indonesia" },
  { id: "N-31", name: "Plan ended (manual payment)", trigger: "Manual payment plan reached its end date", timing: "At the end date, no grace", legal: "Recommended", group: "Indonesia" },
  { id: "N-35", name: "You are the new owner: set up payment", trigger: "Ownership transferred to this member", timing: "Immediately", legal: "Recommended", group: "Workspaces" },
  { id: "N-36", name: "Ownership transferred (old owner)", trigger: "Owner handed the workspace to a member", timing: "Immediately", legal: "Recommended", group: "Workspaces" },
  { id: "N-40", name: "Voucher redeemed", trigger: "Voucher code claimed successfully", timing: "Immediately", legal: "Recommended: states the end date and that nothing is charged", group: "Vouchers" },
  { id: "N-41", name: "Free period ended", trigger: "Voucher benefit reached its end date", timing: "At the end date", legal: "Recommended", group: "Vouchers" },
  { id: "N-32", name: "Payment received (one-time)", trigger: "Payment ID paid via QRIS / VA / card", timing: "Immediately", legal: "Receipt expected", group: "Indonesia" },
  { id: "N-33", name: "Payment ID expired", trigger: "Payment ID not paid within 2 hours", timing: "At expiry of the Payment ID", legal: "No", group: "Indonesia" },
  { id: "N-34", name: "Auto-renewal turned on", trigger: "Manual payment user turned on auto-renewal (any time)", timing: "Immediately", legal: "Yes: express consent to recurring charge", group: "Indonesia" },
];

const planPage = "/settings/billing";

export function renderEmail(id: string, c: EmailCtx): RenderedEmail {
  switch (id) {
    case "N-01":
      return {
        subject: `Your Privy ${c.tierLabel} plan is active`,
        body: [
          `Hi ${c.name}, you are on ${c.planName}, billed ${c.amount} every ${c.intervalWord}.`,
          `Your next renewal is ${c.nextDate}. You can cancel any time from Plan settings and keep access until the end of the paid period.`,
          `Your invoice ${c.invoiceNumber} is attached.`,
        ],
        cta: { label: "View plan settings", href: planPage },
      };
    case "N-02":
      return {
        subject: `You are now on Privy ${c.newPlanName}`,
        body: [
          `We charged ${c.newAmount} today. Your ${c.newPlanName} plan starts today, runs until ${c.newEnd} and renews automatically.`,
          c.forfeitDays > 0
            ? `Your previous ${c.oldPlanName} plan ended today and, as you acknowledged, its remaining ${c.forfeitDays} day${c.forfeitDays === 1 ? "" : "s"} are not refunded or credited.`
            : `Your previous ${c.oldPlanName} plan ended today.`,
        ],
        cta: { label: "View plan settings", href: planPage },
      };
    case "N-03":
      return {
        subject: `Receipt for your Privy ${c.planName} renewal`,
        body: [
          `We renewed your ${c.planName} plan and charged ${c.amount} to card ending ${c.last4}.`,
          `Next renewal: ${c.nextDate}. Invoice ${c.invoiceNumber} is attached.`,
          `You can cancel any time from Plan settings and keep access until the end of the paid period.`,
        ],
        cta: { label: "View invoice", href: planPage },
      };
    case "N-04":
      return {
        subject: `Your Privy ${c.planName} renews on ${c.nextDate}`,
        body: [
          `On ${c.nextDate} we will charge ${c.amount} to card ending ${c.last4}.`,
          `Nothing to do if you want to continue. To stop the renewal, use the link below: one click, and you keep access until ${c.nextDate}.`,
        ],
        cta: { label: "Cancel renewal", href: `${planPage}?action=cancel` },
      };
    case "N-05":
      if (c.declineClass === "hard" || c.declineClass === "no_card") {
        return {
          subject: `We could not renew your Privy ${c.planName}`,
          body: [
            c.declineClass === "no_card"
              ? `There is no payment method on your account, so we could not charge ${c.amount} for your renewal.`
              : `Your bank told us that card ending ${c.last4} cannot be used anymore, so we could not charge ${c.amount} for your renewal.`,
            `You keep full access until ${c.graceEnd}. Add a new card and we will complete the renewal right away. We will not retry the old card.`,
          ],
          cta: { label: "Add a new card", href: "/settings/billing/payment-method" },
        };
      }
      return {
        subject: `We could not renew your Privy ${c.planName}`,
        body: [
          `Your bank declined the ${c.amount} charge on card ending ${c.last4}.`,
          `You keep full access until ${c.graceEnd}. Update your card and we will retry right away; otherwise we retry on ${c.retryDates}.`,
        ],
        cta: { label: "Update payment method", href: "/settings/billing/payment-method" },
      };
    case "N-06":
      return {
        subject: `Action needed: confirm your Privy renewal with your bank`,
        body: [
          `Your bank requires a quick confirmation before we can renew ${c.planName} for ${c.amount}.`,
          `Confirm using the secure link below. Your access continues until ${c.graceEnd}.`,
        ],
        cta: { label: "Confirm payment", href: `${planPage}?action=authenticate` },
      };
    case "N-07":
      return {
        subject: `Reminder: update your payment method to keep ${c.planName}`,
        body: [
          `We still could not charge card ending ${c.last4}. You have ${c.daysLeft} days of access left.`,
          c.isBusiness
            ? `Because ${c.workspaceName} is a Pro workspace, please hand over team documents before ${c.graceEnd} if you do not plan to continue.`
            : `Your documents are safe either way.`,
        ],
        cta: { label: "Update payment method", href: "/settings/billing/payment-method" },
      };
    case "N-08":
      return {
        subject: `Final notice: your Privy ${c.planName} ends on ${c.graceEnd}`,
        body: [
          `Unless payment succeeds by ${c.graceEnd}, your account moves to the Free plan: 5 envelopes a month, 5 reusable templates${c.isBusiness ? ", and your team workspace becomes read-only" : ""}.`,
          `Your documents stay safe.${c.isBusiness ? ` Hand over team documents before then so nobody loses access.` : ""}`,
        ],
        cta: { label: "Update payment method", href: "/settings/billing/payment-method" },
      };
    case "N-09":
      return {
        subject: `Your Privy account is now on the Free plan`,
        body: [
          `We could not collect payment, so your ${c.planName} plan has ended. Your documents are safe.`,
          c.isBusiness
            ? `${c.workspaceName} is now read-only for you and your ${c.memberCount} member${c.memberCount === 1 ? "" : "s"}: envelopes can be viewed and downloaded, not signed or sent. Reactivate any time, or hand the documents over to your Individual workspace.`
            : `Resubscribe any time to get your plan back.`,
        ],
        cta: { label: c.isBusiness ? "Reactivate Pro" : "See plans", href: c.isBusiness ? "/settings/billing" : "/plans" },
      };
    case "N-10":
      return {
        subject: `Your card ending ${c.last4} expires before your next renewal`,
        body: [`Update it before ${c.nextDate} to avoid an interruption to your ${c.planName} plan.`],
        cta: { label: "Update card", href: "/settings/billing/payment-method" },
      };
    case "N-11":
      return {
        subject: `Your billing switches to ${c.intervalWord === "year" ? "yearly" : "monthly"} on ${c.effectiveDate}`,
        body: [
          `You stay on ${c.oldPlanName} until ${c.effectiveDate}. From then you are on ${c.newPlanName}, ${c.newAmount} per ${c.intervalWord}, charged to card ending ${c.last4}. Nothing is charged today.`,
          `Changed your mind? Keep your current billing with one click before ${c.effectiveDate}.`,
        ],
        cta: { label: "Keep my current billing", href: `${planPage}?action=undo` },
      };
    case "N-11b":
      if (c.newPlanName === "Free") {
        return {
          subject: `Reminder: your Privy ${c.oldPlanName} ends in 3 days`,
          body: [
            `On ${c.effectiveDate} your ${c.oldPlanName} plan ends and your account moves to Free (5 envelopes a month). Your documents are safe.`,
            c.isBusiness && c.memberCount > 0
              ? `${c.workspaceName} becomes read-only for you and ${c.memberCount} team member${c.memberCount === 1 ? "" : "s"} on that date. Hand over team documents before then if they should stay with you.`
              : `Changed your mind? Resume with one click before then.`,
          ],
          cta: { label: "Resume subscription", href: `${planPage}?action=resume` },
        };
      }
      return {
        subject: `Reminder: your billing changes in 3 days`,
        body: [`On ${c.effectiveDate} you move from ${c.oldPlanName} to ${c.newPlanName} and we charge ${c.newAmount} to card ending ${c.last4}.`, `Nothing to do if that is what you want.`],
        cta: { label: "Keep my current billing", href: `${planPage}?action=undo` },
      };
    case "N-12":
      return {
        subject: `You are now on Privy ${c.newPlanName}`,
        body: [`Your billing switch took effect. We charged ${c.newAmount} for the new period; next renewal ${c.nextDate}. Your plan and its features stay the same.`],
        cta: { label: "View plan settings", href: planPage },
      };
    case "N-13":
      return {
        subject: `Your Privy ${c.planName} is cancelled`,
        body: [
          `You will not be charged again. You keep full access until ${c.periodEnd}.`,
          `Resume any time before then with one click.`,
        ],
        cta: { label: "Resume subscription", href: `${planPage}?action=resume` },
      };
    case "N-14":
      return {
        subject: `Your Privy ${c.planName} has ended`,
        body: [`You are now on the Free plan. Your documents are safe.`],
        cta: { label: "See plans", href: "/plans" },
      };
    case "N-15":
      return {
        subject: `Welcome back: your Privy ${c.planName} continues`,
        body: [`Auto-renewal is on again. Next renewal ${c.nextDate}, ${c.amount}.`],
        cta: { label: "View plan settings", href: planPage },
      };
    case "N-16":
      return {
        subject: `${c.workspaceName} becomes read-only on ${c.effectiveDate}`,
        body: [
          `The Pro plan for ${c.workspaceName} ends on ${c.effectiveDate}. From then the workspace is read-only: you can still open and download envelopes, but not sign, send or upload.`,
          `Your own Privy plan is not affected. The owner can reactivate the plan at any time.`,
        ],
      };
    case "N-17":
      return {
        subject: `Keep your Privy ${c.tierLabel} going after ${c.prepaidEnd}`,
        body: [
          `Your prepaid plan runs until ${c.prepaidEnd}. Privy now offers automatic renewal so you never lose access.`,
          `Turn it on in one step; we only charge on ${c.prepaidEnd}. If you do nothing, your account moves to Free on ${c.prepaidEnd}.`,
        ],
        cta: { label: "Turn on auto-renewal", href: `${planPage}?action=optin` },
      };
    case "N-18":
      return {
        subject: `A payment dispute has paused your Privy ${c.planName}`,
        body: [
          `Your bank has disputed the charge of ${c.amount}. Paid features are paused until it is resolved.`,
          `If this was a mistake, withdraw the dispute with your bank or contact helpdesk@privy.id.`,
        ],
      };
    case "N-19":
      return {
        subject: `A change to your Privy ${c.planName} price from ${c.nextDate}`,
        body: [
          `From your renewal on ${c.nextDate}, ${c.planName} will cost ${c.newPrice} instead of ${c.oldPrice}. Nothing changes before then.`,
          `You can cancel any time.`,
        ],
        cta: { label: "View plan settings", href: planPage },
      };
    case "N-20":
      return {
        subject: `Your prepaid Privy ${c.tierLabel} plan has ended`,
        body: [`Your prepaid time ended on ${c.prepaidEnd}, so your account is now on the Free plan. Your documents are safe.`],
        cta: { label: "Resubscribe", href: "/plans" },
      };
    case "N-21":
      return {
        subject: `Your payment method was updated`,
        body: [
          `Card ending ${c.last4} is now the card we charge for ${c.planName}, starting with your next renewal.`,
          c.checkAmount ? `To confirm the card we charged ${c.checkAmount} and reversed it right away. It may show as pending for a few days and is never kept.` : `If you did not make this change, contact helpdesk@privy.id right away.`,
        ],
      };
    case "N-22":
      return c.seatsDelta > 0
        ? {
            subject: `${c.seatsDelta} seat${c.seatsDelta === 1 ? "" : "s"} added to your Privy Pro workspace`,
            body: [
              `We charged ${c.proratedAmount} today for the rest of your current billing period. Your workspace now has ${c.seatsTotal} seats and keeps the same renewal date.`,
              `From ${c.nextDate} your renewal is ${c.newAmount} per ${c.intervalWord}. Invoice ${c.invoiceNumber} is attached.`,
            ],
            cta: { label: "Manage seats", href: "/settings/billing" },
          }
        : {
            subject: `Your seats change to ${c.seatsTotal} on ${c.effectiveDate}`,
            body: [
              `You keep your current seats until ${c.effectiveDate}. Nothing is refunded for the rest of this period.`,
              `From ${c.effectiveDate} your renewal is ${c.newAmount} per ${c.intervalWord}. Changed your mind? Keep your current seats with one click.`,
            ],
            cta: { label: "Keep my current seats", href: "/settings/billing?action=undo-seats" },
          };
    case "N-23":
      return {
        subject: `We charged your backup card for ${c.planName}`,
        body: [
          `Your default card ending ${c.defaultLast4} was declined, so we charged ${c.amount} to your backup card ending ${c.backupLast4}. Your plan continues without interruption.`,
          `To avoid this next time, update your default card or make the backup card your default.`,
        ],
        cta: { label: "Manage payment methods", href: "/settings/billing/payment-method" },
      };
    case "N-30":
      return {
        subject: `Your Privy ${c.planName} ends on ${c.prepaidEnd}`,
        body: [
          `Your ${c.planName} plan is paid until ${c.prepaidEnd}. It does not renew automatically, and there is nothing to pay yet.`,
          `After ${c.prepaidEnd} your account moves to Free (5 envelopes a month) with your documents kept${c.isBusiness && c.memberCount > 0 ? `, and ${c.workspaceName} becomes read-only for your ${c.memberCount} team member${c.memberCount === 1 ? "" : "s"}` : ""}. To continue, buy a new period on or after ${c.prepaidEnd}; it starts on the day you pay.`,
          `Prefer no gap? Turn on auto-renewal with a card now and we charge it on ${c.prepaidEnd}.`,
        ],
        cta: { label: "Turn on auto-renewal", href: "/settings/billing?action=convert" },
      };
    case "N-30b":
      return {
        subject: `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left: your Privy ${c.planName} ends on ${c.prepaidEnd}`,
        body: [`Nothing to pay yet. On ${c.prepaidEnd} your account moves to Free; there is no grace period for manual payment.${c.isBusiness && c.memberCount > 0 ? ` Your ${c.memberCount} team member${c.memberCount === 1 ? "" : "s"} in ${c.workspaceName} lose signing access on that date.` : ""} Buy again after it ends, or turn on auto-renewal now to continue without a gap.`],
        cta: { label: "Turn on auto-renewal", href: "/settings/billing?action=convert" },
      };
    case "N-31":
      return {
        subject: `Your Privy ${c.tierLabel} plan has ended`,
        body: [`Your ${c.tierLabel} plan ended on ${c.prepaidEnd}, so your account is now on the Free plan with 5 envelopes a month. Your documents are safe. Buy a new plan any time; it starts on the day you pay.${c.isBusiness && c.memberCount > 0 ? ` ${c.workspaceName} is read-only for you and your ${c.memberCount} member${c.memberCount === 1 ? "" : "s"} until you buy Pro again.` : ""}`],
        cta: { label: "Buy a plan", href: "/plans" },
      };
    case "N-40":
      return {
        subject: `Your free Privy ${c.tierLabel} is active until ${c.newEnd}`,
        body: [
          `Your voucher is claimed. You have Privy ${c.tierLabel} free for ${c.daysLeft} month${c.daysLeft === 1 ? "" : "s"}, until ${c.newEnd}.`,
          `We did not ask for a card, so nothing can be charged. On ${c.newEnd} your account returns to the Free plan automatically, and your documents stay with you.`,
          `Want to keep ${c.tierLabel} afterwards? You can subscribe any time from Plan settings.`,
        ],
        cta: { label: "View plan settings", href: planPage },
      };
    case "N-41":
      return {
        subject: `Your free Privy ${c.tierLabel} period has ended`,
        body: [
          `Your free ${c.tierLabel} period ended on ${c.prepaidEnd}. Your account is now on the Free plan and nothing was charged.`,
          c.isBusiness
            ? `${c.workspaceName} is now read-only: envelopes can be viewed, downloaded and handed over. Subscribe to Pro to sign and send there again.`
            : `Your documents are safe. Free includes 5 envelopes a month.`,
        ],
        cta: { label: "See plans", href: "/plans" },
      };
    case "N-35":
      return {
        subject: `You now own ${c.workspaceName} on Privy: add a payment method before ${c.nextDate}`,
        body: [
          `${c.name} transferred ownership of ${c.workspaceName} to you. The current paid period runs until ${c.nextDate}; nothing changes for members until then.`,
          `To keep the workspace running after ${c.nextDate}, add a card (or, on manual payment in Indonesia, buy the next period after that date). If no payment method is set up by then, the workspace becomes read-only until it is reactivated.`,
          `As the owner, your Individual workspace now gets Personal, included with Pro.`,
        ],
        cta: { label: "Set up payment", href: "/settings/billing" },
      };
    case "N-36":
      return {
        subject: `${c.workspaceName} now belongs to ${c.memberName}`,
        body: [
          `You handed ${c.workspaceName} over to ${c.memberName}. Your card will not be charged for it again; the period already paid runs until ${c.nextDate}.`,
          `You stay in the workspace as a member. Your Individual workspace goes back to its own plan.`,
        ],
        cta: { label: "View billing", href: "/settings/billing" },
      };
    case "N-32":
      return {
        subject: `Payment received: ${c.planName} is active until ${c.newEnd}`,
        body: [`We received ${c.amount} via ${c.last4}. Your ${c.planName} plan is active until ${c.newEnd}. Invoice ${c.invoiceNumber} is attached.`, `This plan does not renew automatically. We remind you 7 days before it ends; you can buy the next period after that date, or turn on auto-renewal any time.`],
        cta: { label: "View invoice", href: "/settings/billing" },
      };
    case "N-33":
      return {
        subject: `Your Payment ID for ${c.planName} has expired`,
        body: [`The Payment ID for ${c.amount} was not paid within 2 hours, so it is no longer valid. Nothing was charged. Generate a new one from Billing when you are ready.`],
        cta: { label: "Go to Billing", href: "/settings/billing" },
      };
    case "N-34":
      return {
        subject: `Auto-renewal is on for your Privy ${c.planName}`,
        body: [
          `Your current plan runs until ${c.nextDate} as paid. From ${c.nextDate} we charge ${c.amount} to card ending ${c.last4} every ${c.intervalWord} until you cancel. No more manual payments.`,
          `To confirm the card we charged ${c.checkAmount} and reversed it right away. You can cancel any time from Plan settings and keep access until the end of the paid period.`,
        ],
        cta: { label: "View plan settings", href: "/settings/billing" },
      };
    case "N-24":
      return {
        subject: `Backup card added`,
        body: [`Card ending ${c.backupLast4} was saved as a backup. We only charge it if your default card is declined. To confirm the card we charged ${c.checkAmount} and reversed it right away. If you did not make this change, contact helpdesk@privy.id right away.`],
      };
    default:
      return { subject: id, body: [] };
  }
}
