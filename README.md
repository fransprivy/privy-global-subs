# Privy Sign · Global subscriptions prototype

A clickable, fully working prototype of Privy Sign's subscription experience for the **Global** market: plans, checkout, renewal, upgrade, downgrade, cancellation and failed-payment handling. Built to the billing-behaviour specification (`Privy_Billing_Behaviour_Renewal_Upgrade_Downgrade`) so the team can copy the UI/UX into production.

- **Stack:** Next.js (App Router) + Tailwind v4, TypeScript. No backend, no database: all state lives in the browser (`localStorage`). Deploys on Vercel free with zero configuration.
- **Simulated date:** 10 September 2026. Time moves only when you advance it from the Prototype panel.
- **Stripe is simulated** with the official Stripe test card numbers (see below).

## Prices and currency (revised 21 Oct 2026)

- Region decides the currency: Indonesia shows IDR, Australia AUD, every other country USD (Settings › Workspace preferences, or the Prototype panel).
- New prices apply to existing subscribers from their next renewal, with no grandfathering.
- Cancelling during the 14-day grace period ends the plan at once (no access for the rest of the grace period); email N-14 says so.
- Indonesia manual payment sends one reminder only, at D-7 (N-30). N-30b is retired.

## Plan rules (revised 13 Oct 2026)

The engineering summary lives in the doc "Subscription Changes, October 2026".

- **Plans and quotas:** Free 5 envelopes a month; Personal unlimited envelopes; Pro unlimited with a dedicated team workspace and members. Each plan card leads with its main benefit (Personal vs Free: unlimited envelopes; Pro vs Personal: dedicated workspace and team members); the comparison table keeps the full list.
- **Upgrade (Personal to Pro) starts today** for every billing type (Global, Indonesia auto-renewal, Indonesia manual payment). The current plan ends today and its unused days are not refunded or credited; the user acknowledges this. There is no scheduled upgrade.
- **No downgrade from Pro to Personal.** The user cancels Pro (it runs to the end of the paid period, then the workspace turns read-only) and buys Personal afterwards. Cancel is available from Personal and Pro.
- **Monthly and yearly switches** are scheduled for the end of the current period (nothing charged now, no stacking, end date unchanged) and can be undone until then.
- **Indonesia manual payment:** no bill and no early payment. One reminder at D-7. On the end date the account moves to Free at once (Pro workspace read-only); the user can buy again any time and the new period starts on the day of payment. Auto-renewal can be turned on at any time by any manual user.
- **Card details are entered on the provider's page** (Stripe for Global, Doku for Indonesia), never on a Privy page. Saving a card charges US$1 / A$1 / Rp 10,000 to check it and reverses it at once; the saved card is used on the renewal date. The payment method can be changed at any time.

## Voucher codes (added 5 Oct 2026, revised 6 Oct 2026)

Requirements and every message (English and Bahasa Indonesia) live in the doc "Redeem Voucher: Short Requirements"; tags V1 to V22 in the app (V1 to V17 are the MVP, V18 to V22 the later phase) refer to it. "Business" is called **Pro** everywhere in the UI, copy and emails (internal ids keep `business`). Vouchers apply to Personal and Pro. The prototype UI is English only.

- **Where**: plan page "Have a voucher code? Redeem it here", and "Redeem a voucher code" on Billing for Free accounts. The window (M-20) mirrors production: title, one field, "Claim".
- **Benefit**: the plan free for N calendar months (month-end clamp), no card, no bill, never renewed. A Pro code creates the Pro workspace with 1 seat. On the end date the account returns to Free with no payment attempt (Pro workspace becomes read-only). Emails N-40 and N-41, banner B-11.
- **Checks, in order**: rate-limit lock, running voucher benefit (same code again returns the earlier success), Free plan, code exists, paused, redeem-by date, region (the editable region in Workspace preferences), verified email (6-digit code inside the window, not counted as a failure), once per campaign, claims per IP, quota last. The first three look at the account only, so a paid account always gets the Free-plan message. Unknown and paused codes share one generic message. There is no device check.
- **Limits**: 5 failures per account in 15 minutes locks for 15 minutes; 20 per IP in 1 hour locks that IP for 1 hour; 5 claims per IP per campaign per 24 hours. Values live in `DEFAULT_VOUCHER_CONFIG`, copy in `VOUCHER_COPY` (`src/lib/engine.ts`).
- **Buying during a free period** (M-21): the user chooses "start when my free period ends" (card saved, first charge on the end date) or "start today" (charged now, remaining free days are not credited).
- **Prototype panel → Voucher codes**: seeded codes with quota and an Active/Paused switch, network selector, "Next claim response" (connection error, session expired), email-verified toggle, "+15 min", "20 wrong guesses from this IP", "50 claims on last slot", and the audit log (`/prototype/voucher-log`, filter by campaign, CSV export). In the verify step 000000 is a wrong code and 999999 an expired one. There is no admin screen for creating codes; codes are seeded in `src/lib/scenarios.ts`.
- **Scenarios**: "Voucher: eligible Free user", "Voucher: guardrails and rejections", "Voucher: free Personal, 6 days left", "Voucher: free Pro workspace".

| Code | Result |
| --- | --- |
| `AU-PERSONAL-3M` | Personal, 3 months, shared (300), Australia |
| `7K2M9XQ4HT`, `B8R3NW6YD5`, `T4VC9G2KP7`, `M6HX3Q8ZJ2` | Pro, 3 months, unique, Australia |
| `W9D5R7B4NK` | Unique code already used: "no longer available" |
| `AU-EARLY-1M` | Expired on 31 Aug 2026 |
| `AU-PARTNER-3M` | Paused: generic message |
| `ID-PERSONAL-1M` | Indonesia only: wrong region from Australia |

## Workspaces: Individual, Pro, Enterprise (added 22 Sep 2026)

The avatar menu (top right) is the workspace switcher from production: current workspace, other workspaces, Settings, Help centre, Log out. Every page (Home, Envelopes, Billing, Plans) follows the active workspace.

- **One plan per user, shown per workspace.** A user owns at most one Pro workspace (R-70). The Individual workspace is Free, Personal, or, for a Pro owner, **"Personal, included with Pro"**: everything in Personal with unlimited envelopes, at no charge, for as long as the Pro plan is live (R-73). Members of other people's Pro or Enterprise workspaces keep their own plan untouched (R-71); in those workspaces the billing page says "managed by the owner" and the plans page shows no cards.
- **Buying Pro** (Free or Personal, Global or Indonesia, recurring or manual payment) asks for a workspace name, creates the Pro workspace, switches into it and shows the welcome step M-15 (R-74). Personal to Pro starts today and forfeits the unused Personal days.
- **Team members** section in the owned Pro workspace: invite within the seat count, remove, and Manage seats (R-78). A member can also **leave** a workspace themselves (avatar menu or Billing, M-16); the documents they created there stay with the owner (R-80).
- **Paywall (M-17)**: Send / New envelope opens the production "Upload a document" screen; choosing a file counts one envelope against the workspace quota (UX-28). With 0 sends left the paywall opens on top of it, styled after production ("Your plan does not go this far"): illustration, the numbers and reset date, Personal and Pro options (Pro only for Personal users), Not now / Upgrade plan. The drop zone stays blocked until the plan is upgraded or the counter resets.
- **Seat exhausted on invite (UX-29)**: when all seats are used, the invite modal adds one seat, charges it prorated to the renewal date and sends the invitation in one step.
- **Reactivation (R-75)**: once a Pro workspace has expired, Pro is offered as "Reactivate Pro" everywhere (plans page in any workspace, billing, checkout title), never as "Upgrade to Pro".
- **Handover (R-79)**: select envelopes on the Envelopes page and hand them over: Individual → own Pro workspace, own Pro → your Individual workspace or to each uploader's Individual workspace, member workspace → your Individual workspace (own uploads only). Works in expired workspaces too.
- **Delete workspace (M-19, R-83)**: owner of an expired workspace can delete it (optionally moving envelopes to Individual first, name confirmation); the next Pro purchase creates a new workspace.
- **Roles (R-82)**: owner sets admins. Admins invite and remove members, change seats and manage payment methods. Only the owner can change or cancel the plan, transfer ownership, set admins, hand over everything or delete the workspace. Scenario "Personal subscriber who is also a member" shows the admin view in Kenny's workspace.
- **Prototype helpers** (requirement tags, test-card hints, support panel, explanatory notes) are hidden unless "Show prototype helpers" is on in the Prototype panel, so screens read as production copy.
- **Ownership transfer (M-18, R-81)**: Team members → Make owner. The old owner's card is detached at once (subscription ended, nothing charged again, no refund), the paid period keeps the workspace active, and the new owner must add a payment method before it ends or the workspace becomes read-only. The old owner loses the Individual perk immediately and stays as a member; emails N-35 (new owner) and N-36 (old owner).
- **Member warnings (B-10)**: members of a workspace whose owner's plan is ending, or whose new owner has not set up payment, see a banner with the date. Indonesian manual payment reminders for Pro mention how many members would lose signing access (banner B-06, emails N-30, N-31).
- **Top bar**: the envelope quota ("x sends left") is shown only on Free (every paid plan is unlimited); "Upgrade plan" appears only for Free users (UX-27).
- **Expired, not deleted.** When a Pro plan ends (cancel, grace end, end of a manual payment period) the workspace becomes **read-only**: owner and members can view and download envelopes but not sign, send or upload (banner B-09, R-72). The owner's Individual workspace drops back to Free. The owner can **hand over** every envelope to their Individual workspace (R-79) and **reactivate** with a normal Pro checkout, which starts a new billing date (R-75). Expired Enterprise workspaces behave the same with a contact-sales note.
- Engine: `workspaceView`, `allWorkspaces`, `switchWorkspace`, `individualPlan`, `workspaceStatus`, `expireWorkspace`, `activateWorkspace`, `handoverDocuments`, `inviteMember`, `removeMember`. UI: `WorkspaceMenu.tsx`, envelopes page, per-workspace billing (`PerkCard`, `MemberPlanCard`, `TeamMembers`). Scenarios: **Member of someone else's Pro**, **Personal subscriber who is also a member**, **Expired Pro workspace (owner)**, **Enterprise member**; Pro owner now starts in its Pro workspace with the perk visible in Individual.

## Region and Indonesia one-time payments (added 22 Sep 2026)

The workspace has a **Region** (Settings → Workspace preferences, also in the Prototype panel). Every region except Indonesia keeps the Global behaviour: auto-renewal on a card, AUD prices, "after tax". Indonesia switches the same product to IDR prices shown inclusive ("includes PPN": Personal Rp 54,000/month or Rp 395,000/year, Pro Rp 99,000 or Rp 725,000 per seat, Enterprise still contact sales) and adds a choice at checkout (M-10):

- **Auto-renewal** (card only): identical to Global, including the 14-day grace, retries and backup cards.
- **Manual payment** (QRIS, card, or virtual account BRI / BCA / CIMB / Mandiri / Permata): QRIS and virtual account create a **Payment ID** valid for 2 hours and show the payment detail (M-12: VA number, QR code, amount, guidance). "Confirm payment → Refresh" (or "Simulate payment received" in the Prototype panel) is the gateway webhook. Card payments happen on Doku's page and activate the plan at once; the card can be saved for faster payments. A new period always starts on the day of payment.
- **Reminders, not bills:** 7 days before a manual plan ends the user gets one reminder (email N-30, banner B-06) with nothing to pay. On the end date the account moves to Free at once (**no grace period**; Pro: workspace read-only), email N-31, banner B-08. The user buys again whenever they want.
- **Turn on auto-renewal** (M-14): offered to every manual user at any time (banner, subscription card, payment methods). The card is saved on Doku's page with a Rp 10,000 check that is reversed; the subscription's first charge is the current end date (email N-34).
- **Changing region** is always allowed; Personal and Pro plans are shared across regions, so nothing expires or is charged on a switch (history entry "Region changed"). Future bills and charges use the new currency.
- Engine: `setRegion`, `startOneTimePurchase`, `buyOneTimeByCard`, `cancelPayment`, `confirmPayment`, `convertToAutoRenew`, `expireOneTimePlan`; helpers `isIndonesia`, `isOneTimeUser`, `openBill`, `pendingPayment`, `convertEligible`. Catalog: `REGIONS`, `PRICE_TABLES`, `VA_BANKS`, `BILL_LEAD_DAYS`. UI: `src/components/onetime.tsx`, `settings/workspace-preferences`. Scenarios: **Indonesia: Free user**, **manual payment, ends in 5 days**, **Pro paid by QRIS, ends in 2 days**, **auto-renewal on a card**. Requirement IDs R-60 to R-66.

## Seats and backup cards (added 11 Sep 2026)

- **Seats (Pro):** Billing → Manage seats. Adding seats charges a prorated amount today (`seats × unit × remaining days / period days`) and keeps the existing renewal date, so one Pro subscription always has one end date. Reducing seats is scheduled for the renewal date (no refund) and can be undone from the banner or the email. You cannot reduce below the number of members in the workspace. Engine: `previewSeatChange`, `changeSeats`, `undoSeatChange`; UI: `SeatsModal` (M-09); email N-22.
- **Backup cards:** Billing → Payment methods → Manage. One default card plus any number of backups, in order. A renewal charges the default; if it is declined the sweep tries each backup in the same run before starting the 14-day grace (R-19b). Set default, add, remove (the only card on an active subscription cannot be removed; removing the default promotes the first backup). Saving any card during grace retries immediately. Engine: `addCard`, `setDefaultCard`, `removeCard`, `allCards`; emails N-21, N-23 (backup charged), N-24 (backup added).
- Scenario **Pro owner** now has 8 seats (6 in use) and a Mastercard backup; the test guide walks through both flows. Use the Prototype panel's "Soft decline" override plus "Jump to next renewal" to watch the backup card catch the declined default.

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
| Free user | The screenshots' starting point. Subscribe with a test card on the Stripe page, see 3DS. |
| Personal Monthly subscriber | Upgrade to Pro (starts today), switch to yearly (from the renewal date), cancel and resume. |
| Personal Annual, 200 days left | Upgrading forfeits 200 days and needs an acknowledgment; switching to monthly waits for the renewal date. |
| Pro owner, 8 seats | Workspaces, seats, backup cards; moving to Personal means cancelling Pro and buying Personal after it ends. |
| Payment failed, Day 7 of grace | Dunning banner, emails, update card to recover with the same billing date, or let it lapse on Day 14. |
| Yearly switch scheduled | Pending billing switch with undo; advance to the effective date. |
| Cancellation pending | One-click resume; advance past the period end. |
| Migrated prepaid user (stacked) | Opt-in to auto-renewal (card check only, first charge when prepaid time ends); an upgrade starts today. |

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

Card numbers are typed on the simulated Stripe (Global) or Doku (Indonesia) page that opens from checkout and from every "add card" action. The saved card's behaviour also decides the outcome of automatic renewals, unless overridden in the Prototype panel.

## What is implemented (mapping to the spec)

- **Plan facts** (doc "Pricing Page Update: Plans, Prices and Feature Comparison"): Free 5 envelopes/mo, 5 templates, 10 GB storage; Personal unlimited envelopes, templates and storage, US$9.99 / US$95.90 or A$11.99 / A$115.10; Pro per seat US$27.50 / US$264 or A$33 / A$316.80, team members, groups, scheduled reminders, expiry, branding; Enterprise custom. Yearly is 20% below monthly. Indonesia (IDR) unchanged. Comparison table grouped as in the doc, with "Included in every plan" last. Storage is copy only (not tracked or enforced). (`src/lib/catalog.ts`)
- **Plan change rules**: same plan disabled; Monthly↔Yearly at the end of the period with undo; Personal→Pro starts today (forfeit, full price, acknowledgment); no Pro→Personal (cancel Pro, buy Personal after); cancel at period end, two clicks, skippable survey, one-click resume.
- **Billing engine** (`src/lib/engine.ts`): anniversary billing with month-end clamp (31 Jan → 28 Feb → 31 Mar), hourly-sweep semantics run once per simulated day, invoices created at charge time, soft/hard decline classes, 14-day grace with retries Day 3/7/14 and immediate retry on card update, SCA fallback (N-06 → confirm), recovery keeps the anchor, end of grace → Free with documents kept and Pro workspace closure, monthly/yearly switches charged at the effective date, consent records, payment-attempt ledger, change history.
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
