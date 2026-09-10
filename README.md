# Privy Sign · Global subscriptions prototype

A clickable, fully working prototype of Privy Sign's subscription experience for the **Global** market: plans, checkout, renewal, upgrade, downgrade, cancellation and failed-payment handling. Built to the billing-behaviour specification (`Privy_Billing_Behaviour_Renewal_Upgrade_Downgrade`) so the team can copy the UI/UX into production.

- **Stack:** Next.js (App Router) + Tailwind v4, TypeScript. No backend, no database: all state lives in the browser (`localStorage`). Deploys on Vercel free with zero configuration.
- **Simulated date:** 10 September 2026. Time moves only when you advance it from the Prototype panel.
- **Stripe is simulated** with the official Stripe test card numbers (see below).

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
- **Notifications**: emails N-01…N-21 (`src/lib/emails.ts`), banners B-01…B-04 (`src/components/Banners.tsx`), modals M-01…M-08 (`src/components/flows.tsx`, `CheckoutDrawer.tsx`).
- **Screens** mirrored from the production screenshots: Home, Upgrade plan (pricing), Checkout drawer, Settings › Personal info, Settings › Billing, Billing › Change plan (with comparison), plus new Payment method page and Emails page. Responsive down to phone width.

## Project structure

```
src/lib/        types, catalog (plan facts), format (dates/money), engine (state machine), emails, scenarios, store (React context + localStorage)
src/components/ TopNav, Banners, PlanCards + CompareTable, CheckoutDrawer, flows (all modals), payments (card form, 3DS), PrototypeControls, AppShell
src/app/        / (scenario picker), /home, /plans, /settings/*, /prototype/emails
```

## Not in scope

Indonesia (stays on one-off units), Enterprise sales flow, real Stripe integration, tax calculation, seat changes after purchase, disputes (documented in the spec, not simulated).
