# Privy Sign · Global subscriptions prototype

A clickable, fully working prototype of Privy Sign's subscription experience for the **Global** market: plans, checkout, renewal, upgrade, downgrade, cancellation and failed-payment handling. Built to the billing-behaviour specification (`Privy_Billing_Behaviour_Renewal_Upgrade_Downgrade`) so the team can copy the UI/UX into production.

- **Stack:** Next.js (App Router) + Tailwind v4, TypeScript. No backend, no database: all state lives in the browser (`localStorage`). Deploys on Vercel free with zero configuration.
- **Simulated date:** 10 September 2026. Time moves only when you advance it from the Prototype panel.
- **Stripe is simulated** with the official Stripe test card numbers (see below).

## Workspaces: Individual, Business, Enterprise (added 22 Sep 2026)

The avatar menu (top right) is the workspace switcher from production: current workspace, other workspaces, Settings, Help centre, Log out. Every page (Home, Envelopes, Billing, Plans) follows the active workspace.

- **One plan per user, shown per workspace.** A user owns at most one Business workspace (R-70). The Individual workspace is Free, Personal, or, for a Business owner, **"Personal, included with Business"**: everything in Personal with unlimited envelopes, at no charge, for as long as the Business plan is live (R-73). Members of other people's Business or Enterprise workspaces keep their own plan untouched (R-71); in those workspaces the billing page says "managed by the owner" and the plans page shows no cards.
- **Buying Business** (Free or Personal, Global or Indonesia, recurring or one-time) asks for a workspace name, creates the Business workspace, switches into it and shows the welcome step M-15 (R-74). Personal to Business keeps rule C (forfeit or schedule).
- **Team members** section in the owned Business workspace: invite within the seat count, remove, and Manage seats (R-78). A member can also **leave** a workspace themselves (avatar menu or Billing, M-16); the documents they created there stay with the owner (R-80).
- **Top bar**: the envelope quota ("x sends left") is always shown unless the workspace is unlimited; "Upgrade plan" appears only for Free users or a Personal plan with 0 sends left (UX-27).
- **Expired, not deleted.** When a Business plan ends (cancel, downgrade, grace end, unpaid Indonesian bill) the workspace becomes **read-only**: owner and members can view and download envelopes but not sign, send or upload (banner B-09, R-72). The owner's Individual workspace drops back to Free (or to Personal if a downgrade was scheduled). The owner can **hand over** every envelope to their Individual workspace (R-79) and **reactivate** with a normal Business checkout, which starts a new billing date (R-75). Expired Enterprise workspaces behave the same with a contact-sales note.
- Engine: `workspaceView`, `allWorkspaces`, `switchWorkspace`, `individualPlan`, `workspaceStatus`, `expireWorkspace`, `activateWorkspace`, `handoverDocuments`, `inviteMember`, `removeMember`. UI: `WorkspaceMenu.tsx`, envelopes page, per-workspace billing (`PerkCard`, `MemberPlanCard`, `TeamMembers`). Scenarios: **Member of someone else's Business**, **Personal subscriber who is also a member**, **Expired Business workspace (owner)**, **Enterprise member**; Business owner now starts in its Business workspace with the perk visible in Individual.

## Region and Indonesia one-time payments (added 22 Sep 2026)

The workspace has a **Region** (Settings → Workspace preferences, also in the Prototype panel). Every region except Indonesia keeps the Global behaviour: auto-renewal on a card, AUD prices, "after tax". Indonesia switches the same product to IDR prices shown inclusive ("includes PPN": Personal Rp 54,000/month or Rp 395,000/year, Business Rp 99,000 or Rp 725,000 per seat, Enterprise still contact sales) and adds a choice at checkout (M-10):

- **Auto-renewal** (card only): identical to Global, including the 14-day grace, retries and backup cards.
- **One-time purchase** (QRIS, card, or virtual account BRI / BCA / CIMB / Mandiri / Permata): the checkout (M-11) creates a **Payment ID** valid for 2 hours and shows the payment detail (M-12: VA number, QR code, amount, guidance). "Confirm payment → Refresh" (or "Simulate payment received" in the Prototype panel) is the gateway webhook. Card payments can save the card for later bills.
- **Bills:** 7 days before a one-time plan expires a renewal bill is issued (email N-30, banner B-06, reminders N-30b at T-3 and T-1). Paying it extends the plan from the current expiry; the plan keeps one end date. The bill dies at the expiry date: **no grace period**. Unpaid → account moves to Free (Business: workspace closed), email N-31, banner B-08, bill marked "Expired unpaid".
- **Convert to auto-renewal** (M-14): offered on the banner and the subscription card only to one-time users whose last payment was by card (phase 1); everyone else finds it under Billing → Payment methods. It voids the open bill and starts a subscription whose first charge is the current expiry date (email N-34).
- **Changing region** is always allowed; Personal and Business plans are shared across regions, so nothing expires or is charged on a switch (history entry "Region changed"). Future bills and charges use the new currency.
- Engine: `setRegion`, `startOneTimePurchase`, `issueRenewalBill`, `payBill`, `cancelPayment`, `confirmPayment`, `convertToAutoRenew`, `expireOneTimePlan`; helpers `isIndonesia`, `isOneTimeUser`, `openBill`, `pendingPayment`, `convertEligible`. Catalog: `REGIONS`, `PRICE_TABLES`, `VA_BANKS`, `BILL_LEAD_DAYS`. UI: `src/components/onetime.tsx`, `settings/workspace-preferences`. Scenarios: **Indonesia: Free user**, **one-time plan, bill due in 5 days**, **Business paid by QRIS, expires in 2 days**, **auto-renewal on a card**. Requirement IDs R-60 to R-66.

## Seats and backup cards (added 11 Sep 2026)

- **Seats (Business):** Billing → Manage seats. Adding seats charges a prorated amount today (`seats × unit × remaining days / period days`) and keeps the existing renewal date, so one Business subscription always has one end date. Reducing seats is scheduled for the renewal date (no refund) and can be undone from the banner or the email. You cannot reduce below the number of members in the workspace. Engine: `previewSeatChange`, `changeSeats`, `undoSeatChange`; UI: `SeatsModal` (M-09); email N-22.
- **Backup cards:** Billing → Payment methods → Manage. One default card plus any number of backups, in order. A renewal charges the default; if it is declined the sweep tries each backup in the same run before starting the 14-day grace (R-19b). Set default, add, remove (the only card on an active subscription cannot be removed; removing the default promotes the first backup). Saving any card during grace retries immediately. Engine: `addCard`, `setDefaultCard`, `removeCard`, `allCards`; emails N-21, N-23 (backup charged), N-24 (backup added).
- Scenario **Business owner** now has 8 seats (6 in use) and a Mastercard backup; the test guide walks through both flows. Use the Prototype panel's "Soft decline" override plus "Jump to next renewal" to watch the backup card catch the declined default.

## Test guide (in-app)

Every scenario has a step-by-step walkthrough docked on the right of the app: what to click, what you should see, and which spec items (UX-xx, M-xx, R-xx, N-xx) each step proves. Steps tick themselves off from the live state where possible; the rest can be ticked by hand. The footer of the guide has the simulated date, the "Jump to next event" button, the test-card cheat sheet and the Emails link, so you never have to leave the flow to check the README.

- Collapse / expand: the X in the guide header, the tab on the right edge, or Ctrl/Cmd + /
- Previous / next scenario: the arrows next to the scenario title
- Reset: clears the scenario and the ticked steps
- The steps live in `src/lib/guide.ts`; the scenario picker on the start page lists the same steps.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Deploy to Vercel

1. Push this repo to GitHub (already done: `fransprivy/privy-global-subs`).
2. In Vercel: **Add New → Project → Import** the repo. Framework preset is detected as Next.js; keep every default.
3. Deploy. No environment variables are needed.

## How to use the prototype

Open `/` and pick a scenario. Each scenario is a complete account state:

| Scenario | What it shows |
|---|---|
| Free user | The screenshots' starting point. Subscribe with a test card, see 3DS. |
| Personal Monthly subscriber | Upgrade (now vs when the plan ends), switch to yearly (days roll over), cancel and resume. |
| Personal Annual, 200 days left | The highest-risk matrix cell; the scheduled upgrade is the primary button. |
| Business owner, 6 seats | Downgrade checklist with live member names, automations, e-Seal, branding. |
| Payment failed, Day 7 of grace | Dunning banner, emails, update card to recover with the same billing date, or let it lapse on Day 14. |
| Downgrade scheduled | Pending-change banner with undo; advance to the effective date. |
| Cancellation pending | One-click resume; advance past the period end. |
| Migrated prepaid user (stacked) | Opt-in to auto-renewal, nothing charged until prepaid time ends; upgrades only as scheduled changes. |

**Prototype panel** (button bottom-right, or `Ctrl/Cmd + .`): switch scenario, reset, advance the clock (+1 day, +7 days, jump to the next renewal/retry/grace end), force the outcome of the next automatic charge, make the card expire, open the Emails page, and toggle **requirement tags** (small blue chips such as `UX-03`, `M-02`, `R-22`, `N-05`) that show which spec item each element implements.

**Emails page** (`/prototype/emails`): every template from the notification catalogue (N-01 to N-21) rendered with live data, plus the log of emails "sent" in the current scenario.

### Test cards

| Number | Behaviour |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3DS authentication (simulated bank screen) |
| `4000 0000 0000 9995` | Soft decline (insufficient funds): retried on Day 3 / 7 / 14 |
| `4000 0000 0000 0069` | Hard decline (expired): not retried, user must add a new card |
| `5555 5555 5555 4444` | Succeeds (Mastercard) |

The saved card's behaviour also decides the outcome of automatic renewals, unless overridden in the Prototype panel.

## What is implemented (mapping to the spec)

- **Plan facts** from privyid.com/pricing (AUD, after tax): Free 5 envelopes/mo, 5 templates; Personal A$7.49/mo or A$79/yr (600 envelopes/yr); Business A$38.50 per seat/mo or A$396 per seat/yr, unlimited envelopes; Enterprise custom. Full "What changes between plans" table. (`src/lib/catalog.ts`)
- **Matrix rules A to E**: same plan disabled; Monthly→Annual now with day roll-over (rule B); Personal→Business with **Upgrade now** (forfeit, full price, acknowledgment) or **Upgrade when my plan ends** (rule C, UX-03/04/05); downgrades at period end with loss checklist and undo (rule D, UX-07/09); cancel at period end, two clicks, skippable survey, one-click resume (rule E, UX-11/12).
- **Billing engine** (`src/lib/engine.ts`): anniversary billing with month-end clamp (31 Jan → 28 Feb → 31 Mar), hourly-sweep semantics run once per simulated day, invoices created at charge time, soft/hard decline classes, 14-day grace with retries Day 3/7/14 and immediate retry on card update, SCA fallback (N-06 → confirm), recovery keeps the anchor, end of grace → Free with documents kept and Business workspace closure, scheduled changes charged at the effective date, consent records, payment-attempt ledger, change history.
- **Notifications**: emails N-01…N-24 and N-30…N-34 (`src/lib/emails.ts`), banners B-01…B-09 (`src/components/Banners.tsx`), modals M-01…M-15 (`src/components/flows.tsx`, `CheckoutDrawer.tsx`, `onetime.tsx`).
- **Screens** mirrored from the production screenshots: Home, Upgrade plan (pricing), Checkout drawer, Settings › Personal info, Settings › Billing, Billing › Change plan (with comparison), plus new Payment method page and Emails page. Responsive down to phone width.

## Project structure

```
src/lib/        types, catalog (plan facts, regions, prices per currency), format (dates/money), engine (state machine), emails, scenarios, guide, store (React context + localStorage)
src/components/ TopNav + WorkspaceMenu (switcher), Banners, PlanCards + CompareTable, CheckoutDrawer, flows (all modals), onetime (Indonesia purchase type, one-time checkout, payment detail, convert), payments (card form, 3DS), PrototypeControls, TestGuide, AppShell
src/app/        / (scenario picker), /home, /plans, /settings/*, /prototype/emails
```

## Not in scope

Enterprise sales flow, real Stripe or Indonesian payment-gateway integration (Payment IDs, QR codes and VA numbers are generated locally), tax calculation, disputes (documented in the spec, not simulated).
