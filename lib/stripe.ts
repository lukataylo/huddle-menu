import type { OrderLineItem } from './types'

// Minimal Stripe REST client (no SDK): hosted Checkout Sessions only.
// Works identically with sk_test_ and sk_live_ keys.

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

async function stripeRequest(
  path: string,
  params?: URLSearchParams
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params,
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const err = (data.error as { message?: string } | undefined)?.message ?? res.statusText
    throw new Error(`Stripe ${path} failed: ${err}`)
  }
  return data
}

export interface StripeCheckoutInput {
  orderIds: string[]
  lineItems: Array<OrderLineItem & { stallName?: string }>
  currency: string
  description: string
  /** Path the customer lands on after paying (or when returning unpaid). */
  nextPath: string
  cancelPath: string
  baseUrl: string
}

export async function createStripeCheckout(
  input: StripeCheckoutInput
): Promise<{ sessionId: string; url: string }> {
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set(
    'success_url',
    `${input.baseUrl}/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}`
  )
  params.set('cancel_url', `${input.baseUrl}${input.cancelPath}`)
  input.lineItems.forEach((item, i) => {
    const name = item.stallName ? `${item.name} (${item.stallName})` : item.name
    params.set(`line_items[${i}][price_data][currency]`, input.currency.toLowerCase())
    params.set(`line_items[${i}][price_data][product_data][name]`, name.slice(0, 120))
    params.set(`line_items[${i}][price_data][unit_amount]`, String(item.price_pence))
    params.set(`line_items[${i}][quantity]`, String(item.quantity))
  })
  params.set('metadata[orderIds]', JSON.stringify(input.orderIds).slice(0, 500))
  params.set('metadata[next]', input.nextPath.slice(0, 500))
  params.set('payment_intent_data[description]', input.description.slice(0, 500))

  const session = await stripeRequest('/v1/checkout/sessions', params)
  return { sessionId: session.id as string, url: session.url as string }
}

export interface StripeSessionResult {
  paid: boolean
  orderIds: string[]
  nextPath: string
}

export async function getStripeSession(sessionId: string): Promise<StripeSessionResult> {
  const session = await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`)
  const metadata = (session.metadata ?? {}) as { orderIds?: string; next?: string }
  let orderIds: string[] = []
  try {
    orderIds = JSON.parse(metadata.orderIds ?? '[]') as string[]
  } catch {
    orderIds = []
  }
  return {
    paid: session.payment_status === 'paid',
    orderIds,
    nextPath: metadata.next ?? '/',
  }
}
