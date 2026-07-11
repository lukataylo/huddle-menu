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
| `MOLLIE_API_KEY` | no | Enables real payments. Without it, orders are created as already paid (dev mode). |
| `ANTHROPIC_API_KEY` | no | Enables AI menu-photo extraction on `/start`. Without it, vendors type their menu in manually. |
| `APP_URL` | production | Public base URL, used for Mollie redirect/webhook URLs |

## How payments flow

1. Checkout creates order(s) with status `pending` and a single Mollie payment (metadata carries the order ids).
2. Mollie calls `/api/mollie/webhook`; the order(s) flip to `paid`.
3. The kitchen advances `paid → preparing → ready → collected`; the customer's status page polls and buzzes on `ready`.
4. Without `MOLLIE_API_KEY`, step 1 creates orders as `paid` directly — useful for local dev and cash-only stalls (the kitchen also has a "Mark paid" button for pending orders).

## Security model

No accounts. Each vendor has a secret `admin_token` (in the kitchen URL); each order id is an unguessable UUID that acts as the customer's claim ticket. Loyalty stamps live in the customer's localStorage.
