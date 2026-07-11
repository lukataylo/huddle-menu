# Huddle Menu

QR-code ordering for street food stalls. A vendor photographs their paper menu, confirms the AI-extracted items, and gets a QR code. Customers scan it, order, pay through Mollie, and skip the queue — their phone becomes a visual buzzer that goes off when the food is ready. The vendor runs everything from a kitchen screen.

## Features

- **5-minute onboarding** (`/start`) — photograph a paper menu, Claude extracts the items, confirm, done. Manual entry works too (no API key required).
- **Customer ordering** (`/v/[slug]`) — mobile-first menu, basket, pay with Mollie (or instant dev-mode "paid" when Mollie isn't configured).
- **Market mode** (`/market`) — when several stalls are live, one basket spans all of them: one payment, one order per stall.
- **Live order tracking** (`/v/[slug]/order/[id]`, `/track?ids=...`) — status page polls the kitchen and acts as a buzzer: vibration + browser notification + green flash when the order is ready.
- **Kitchen screen** (`/v/[slug]/kitchen?token=...`) — live order board (new → preparing → ready → collected), sold-out toggles for menu items, printable QR code. Protected by the vendor's secret admin token.
- **Loyalty stamps** (`/stamps`) — device-local stamp card summarising every order this browser has placed, per stall.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Postgres (`pg`) · Mollie payments · Anthropic API (menu photo extraction) · `qrcode`

## Running locally

```bash
npm install
export DATABASE_URL=postgres://...   # any Postgres
npm run db:migrate                   # create tables
npm run db:seed                      # optional demo stall (Borough Bao)
npm run dev
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `STRIPE_SECRET_KEY` | no | Enables Stripe Checkout for online card payments. Takes priority over Mollie when both are set. |
| `MOLLIE_API_KEY` | no | Enables Mollie payments (used when Stripe is not configured). |
| `ANTHROPIC_API_KEY` | no | Enables AI menu-photo extraction on `/start`. Without it, vendors type their menu in manually. |
| `OPENAI_KEY` | no | Enables AI stall art (gpt-image-2 logo drawn at signup; `npm run art:backfill` for existing stalls). `OPENAI_API_KEY` works too. |
| `APP_URL` | production | Public base URL, used for payment redirect/webhook URLs |

## How payments flow

Customers choose at checkout: **Pay online** or **At the stall**.

1. Pay online creates order(s) with status `pending` and a single payment covering the basket — Stripe Checkout when `STRIPE_SECRET_KEY` is set, otherwise Mollie.
2. Stripe: the success redirect hits `/api/stripe/confirm`, which retrieves the session from Stripe's API and flips the order(s) to `paid`. Mollie: `/api/mollie/webhook` does the same.
3. The kitchen advances `paid → preparing → ready → collected`; the customer's status page polls and buzzes on `ready`.
4. **At the stall**: order(s) are created `pending` with no payment attached; the customer pays cash or on the stall's own card reader and the kitchen taps "Mark paid".
5. With neither payment provider configured, online orders are created as `paid` directly (local dev mode).

## Security model

No accounts. Each vendor has a secret `admin_token` (in the kitchen URL); each order id is an unguessable UUID that acts as the customer's claim ticket. Loyalty stamps live in the customer's localStorage.
