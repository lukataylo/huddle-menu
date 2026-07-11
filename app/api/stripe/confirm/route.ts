import { NextResponse } from 'next/server'
import { updateOrderStatus } from '@/lib/data'
import { getBaseUrl } from '@/lib/mollie'
import { getStripeSession, isStripeConfigured } from '@/lib/stripe'

// Stripe Checkout success redirect. The session id is retrieved back from
// Stripe's API (never trusted from the URL alone) before orders flip to paid.
export async function GET(req: Request) {
  const baseUrl = getBaseUrl(req)
  const sessionId = new URL(req.url).searchParams.get('session_id')
  if (!isStripeConfigured() || !sessionId) {
    return NextResponse.redirect(`${baseUrl}/`, 302)
  }

  let session
  try {
    session = await getStripeSession(sessionId)
  } catch (err) {
    console.error('[stripe confirm] session lookup failed:', err)
    return NextResponse.redirect(`${baseUrl}/`, 302)
  }

  if (session.paid) {
    for (const orderId of session.orderIds) {
      await updateOrderStatus(orderId, 'paid', ['pending'])
    }
  }
  return NextResponse.redirect(`${baseUrl}${session.nextPath}`, 302)
}
