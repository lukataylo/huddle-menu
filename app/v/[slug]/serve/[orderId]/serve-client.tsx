'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type ServeState = 'working' | 'served' | 'no-token' | 'error'

// Opened by the vendor scanning a customer's pickup QR. Uses the admin token
// this device saved when it last opened the kitchen console.
export default function ServeClient({ slug, orderId }: { slug: string; orderId: string }) {
  const [state, setState] = useState<ServeState>('working')
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [detail, setDetail] = useState('')

  const serve = useCallback(async () => {
    setState('working')
    let token: string | null = null
    try {
      token = localStorage.getItem(`huddle_admin_${slug}`)
    } catch {
      token = null
    }
    if (!token) {
      setState('no-token')
      return
    }
    try {
      const res = await fetch(
        `/api/vendor/${slug}/orders/${orderId}?token=${encodeURIComponent(token)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'collected' }),
        }
      )
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setOrderNumber(data.order.order_number)
        setState('served')
      } else if (res.status === 409 && typeof data?.error === 'string' && data.error.includes("'collected'")) {
        setDetail('This ticket was already served.')
        setState('served')
      } else {
        setDetail(data?.error ?? 'Something went wrong')
        setState('error')
      }
    } catch {
      setDetail('Network error')
      setState('error')
    }
  }, [slug, orderId])

  useEffect(() => {
    // deferred so the setState inside serve() isn't synchronous within the effect
    const timer = setTimeout(() => void serve(), 0)
    return () => clearTimeout(timer)
  }, [serve])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center bg-paper px-6 text-center text-midnight">
      {state === 'working' && <p className="font-display text-3xl text-ink">SERVING…</p>}

      {state === 'served' && (
        <>
          <p className="text-6xl" aria-hidden>
            ✅
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink">
            {orderNumber !== null ? `TICKET #${orderNumber} SERVED` : 'TICKET SERVED'}
          </h1>
          <p className="mt-2 font-medium text-midnight/70">{detail || 'Order complete. Next!'}</p>
        </>
      )}

      {state === 'no-token' && (
        <>
          <p className="text-5xl" aria-hidden>
            🔒
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-ink">STALL DEVICE ONLY</h1>
          <p className="mt-2 font-medium text-midnight/70">
            This link completes an order, so it only works on a device that has opened this
            stall&apos;s kitchen console. Open your console link once on this phone, then scan
            again.
          </p>
        </>
      )}

      {state === 'error' && (
        <>
          <p className="text-5xl" aria-hidden>
            ⚠️
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-ink">COULD NOT SERVE</h1>
          <p className="mt-2 font-medium text-midnight/70">{detail}</p>
          <button
            onClick={serve}
            className="mt-5 rounded-xl bg-ink px-6 py-3 font-semibold text-white active:bg-ink-deep"
          >
            Try again
          </button>
        </>
      )}

      <Link href={`/v/${slug}`} className="mt-8 text-sm font-medium text-ink">
        ← Back to the stall
      </Link>
    </div>
  )
}
