'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMoney } from '@/lib/format'
import { rememberOrder } from '@/lib/loyalty'
import { useNotificationPermission, useReadyBuzzer } from '@/lib/use-ready-buzzer'
import type { OrderLineItem, OrderStatus } from '@/lib/types'

interface VendorInfo {
  slug: string
  name: string
  emoji: string
  currency: string
}

interface TrackedOrder {
  id: string
  order_number: number
  customer_name: string
  items: OrderLineItem[]
  total_pence: number
  status: OrderStatus
}

const STATUS_COPY: Record<OrderStatus, { title: string; detail: string }> = {
  pending: { title: 'Waiting for payment…', detail: 'Complete the payment to send your order to the kitchen.' },
  paid: { title: 'Order received!', detail: "We're prepping your food fresh and fast!" },
  preparing: { title: 'Being prepared 🔥', detail: 'Your food is on the grill right now.' },
  ready: { title: 'Ready for pickup! 🎉', detail: 'Head to the stall and show this screen.' },
  collected: { title: 'Enjoy your food 😋', detail: 'This order has been collected.' },
  cancelled: { title: 'Order cancelled', detail: 'This order was cancelled. You have not been charged.' },
}

const STEPS: Array<{ key: OrderStatus; label: string; icon: string }> = [
  { key: 'paid', label: 'Received', icon: '✓' },
  { key: 'preparing', label: 'Preparing', icon: '🍳' },
  { key: 'ready', label: 'Ready', icon: '🛎️' },
  { key: 'collected', label: 'Picked up', icon: '🛍️' },
]

export default function OrderTracker({
  vendor,
  initialOrder,
}: {
  vendor: VendorInfo
  initialOrder: TrackedOrder
}) {
  const [order, setOrder] = useState(initialOrder)
  const { permission, request } = useNotificationPermission()

  useEffect(() => {
    rememberOrder(initialOrder.id, vendor.slug)
  }, [initialOrder.id, vendor.slug])

  useReadyBuzzer(order.status === 'ready', `${vendor.name} order #${order.order_number}`)

  useEffect(() => {
    if (order.status === 'collected' || order.status === 'cancelled') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' })
        if (res.ok) setOrder(await res.json())
      } catch {
        // transient network error — keep polling
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [order.id, order.status])

  const copy = STATUS_COPY[order.status]
  const stepIndex = STEPS.findIndex((step) => step.key === order.status)

  return (
    <div
      className={`mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-8 text-midnight transition-colors ${
        order.status === 'ready' ? 'animate-pulse bg-green-50' : 'bg-paper'
      }`}
    >
      <p className="text-center text-sm font-bold text-midnight/60">Your order</p>

      <p className="mt-4 text-center font-display text-3xl leading-none text-ink">ORDER</p>
      <p className="text-center font-display text-8xl leading-none text-ink">
        #{order.order_number}
      </p>

      <div
        className={`mt-6 rounded-3xl border-2 bg-card p-6 text-center ${
          order.status === 'ready' ? 'border-green-500 ring-2 ring-green-300' : 'border-ink'
        }`}
      >
        <h1 className="text-xl font-extrabold text-ink">{copy.title}</h1>
        <p className="mt-1 text-sm font-medium text-midnight/70">{copy.detail}</p>
        <p className="mt-1 text-sm font-bold text-midnight/80">for {order.customer_name}</p>

        {order.status !== 'cancelled' && order.status !== 'pending' && (
          <div className="mt-6 flex items-center">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : ''} ${i <= stepIndex ? 'bg-ink' : 'bg-ink/20'}`} />
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                      i < stepIndex
                        ? 'border-ink bg-ink text-white'
                        : i === stepIndex
                          ? 'border-ink bg-card text-ink'
                          : 'border-ink/20 bg-card text-ink/30'
                    }`}
                  >
                    {i < stepIndex ? '✓' : step.icon}
                  </div>
                  <div className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'invisible' : ''} ${i < stepIndex ? 'bg-ink' : 'bg-ink/20'}`} />
                </div>
                <span
                  className={`mt-1.5 text-[11px] font-bold ${
                    i <= stepIndex ? 'text-ink' : 'text-ink/30'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {['pending', 'paid', 'preparing'].includes(order.status) && permission === 'default' && (
          <button
            onClick={request}
            className="mt-5 w-full rounded-2xl border-2 border-ink/30 bg-paper px-4 py-3 text-sm font-bold text-ink"
          >
            🔔 Notify me when it&apos;s ready
          </button>
        )}
      </div>

      <div className="mt-4 rounded-3xl border-2 border-ink/20 bg-card p-5">
        <h2 className="font-display text-lg text-ink">PICKUP AT</h2>
        <p className="mt-1 text-lg font-extrabold">
          {vendor.emoji} {vendor.name}
        </p>
      </div>

      <div className="mt-4 rounded-3xl border-2 border-ink/20 bg-card p-5">
        <h2 className="font-display text-lg text-ink">SUMMARY</h2>
        <ul className="mt-2 space-y-1.5">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm font-medium">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span className="font-extrabold">
                {formatMoney(item.price_pence * item.quantity, vendor.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t-2 border-dashed border-ink/20 pt-3 font-extrabold">
          <span>Total</span>
          <span>{formatMoney(order.total_pence, vendor.currency)}</span>
        </div>
      </div>

      <Link href={`/v/${vendor.slug}`} className="mt-6 text-center text-sm font-bold text-ink">
        ← Back to menu
      </Link>
    </div>
  )
}
