import { NextResponse } from 'next/server'
import { updateOrderStatus } from '@/lib/data'
import { getMollieClient, isMollieConfigured } from '@/lib/mollie'

// Mollie POSTs `id=tr_xxx` (form-encoded) and expects a 200. The payment id
// is not trusted by itself: we fetch the payment back from Mollie's API.
export async function POST(req: Request) {
  if (!isMollieConfigured()) {
    return NextResponse.json({ error: 'Mollie not configured' }, { status: 503 })
  }

  const form = await req.formData().catch(() => null)
  const paymentId = form?.get('id')
  if (typeof paymentId !== 'string' || !paymentId) {
    return NextResponse.json({ error: 'Missing payment id' }, { status: 400 })
  }

  let payment
  try {
    payment = await getMollieClient().payments.get(paymentId)
  } catch (err) {
    console.error('[mollie webhook] Failed to fetch payment', paymentId, err)
    // 404 from Mollie means a bogus id; anything else is transient — let Mollie retry.
    return NextResponse.json({ error: 'Payment lookup failed' }, { status: 500 })
  }

  // Single-vendor checkouts carry `orderId`; market checkouts carry `orderIds`
  // for every per-vendor order covered by the one payment.
  const metadata = payment.metadata as { orderId?: string; orderIds?: string[] } | null
  const orderIds = metadata?.orderIds ?? (metadata?.orderId ? [metadata.orderId] : [])
  if (orderIds.length === 0) {
    console.error('[mollie webhook] Payment has no order metadata:', paymentId)
    return NextResponse.json({ ok: true })
  }

  for (const orderId of orderIds) {
    if (payment.status === 'paid') {
      await updateOrderStatus(orderId, 'paid', ['pending'])
    } else if (['canceled', 'expired', 'failed'].includes(payment.status)) {
      await updateOrderStatus(orderId, 'cancelled', ['pending'])
    }
    // 'open' / 'pending' / 'authorized' → nothing to do yet.
  }

  return NextResponse.json({ ok: true })
}
