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
  paid: { title: 'Order received!', detail: 'The kitchen has your order in the queue.' },
  preparing: { title: 'Being prepared 🔥', detail: 'Your food is on the grill right now.' },
  ready: { title: 'Ready to collect! 🎉', detail: 'Head to the counter and show this screen.' },
  collected: { title: 'Enjoy your food 😋', detail: 'This order has been collected.' },
  cancelled: { title: 'Order cancelled', detail: 'This order was cancelled. You have not been charged.' },
}

const PROGRESS_STEPS: OrderStatus[] = ['paid', 'preparing', 'ready']

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
  const progressIndex = PROGRESS_STEPS.indexOf(order.status)

  return (
    <div
      className={`mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-8 text-stone-900 transition-colors ${
        order.status === 'ready' ? 'animate-pulse bg-green-50' : 'bg-stone-50'
      }`}
    >
      <p className="text-sm text-stone-500">
        {vendor.emoji} {vendor.name}
      </p>

      <div
        className={`mt-6 rounded-2xl border bg-white p-6 text-center shadow-sm ${
          order.status === 'ready' ? 'border-green-400 ring-2 ring-green-300' : 'border-stone-200'
        }`}
      >
        <p className="text-sm font-medium uppercase tracking-widest text-stone-400">Order</p>
        <p className="mt-1 text-6xl font-black tracking-tight text-amber-600">#{order.order_number}</p>
        <p className="mt-2 font-medium text-stone-600">for {order.customer_name}</p>

        {order.status !== 'cancelled' && (
          <div className="mx-auto mt-6 flex max-w-xs items-center gap-2">
            {PROGRESS_STEPS.map((step, i) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full ${
                  progressIndex >= i || order.status === 'collected' ? 'bg-amber-500' : 'bg-stone-200'
                }`}
              />
            ))}
          </div>
        )}

        <h1 className="mt-5 text-2xl font-bold">{copy.title}</h1>
        <p className="mt-1 text-stone-500">{copy.detail}</p>

        {['pending', 'paid', 'preparing'].includes(order.status) && permission === 'default' && (
          <button
            onClick={request}
            className="mt-4 w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
          >
            🔔 Notify me when it&apos;s ready
          </button>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-stone-400">Summary</h2>
        <ul className="space-y-1.5">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span className="font-medium">
                {formatMoney(item.price_pence * item.quantity, vendor.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-stone-100 pt-3 font-bold">
          <span>Total</span>
          <span>{formatMoney(order.total_pence, vendor.currency)}</span>
        </div>
      </div>

      <Link
        href={`/v/${vendor.slug}`}
        className="mt-6 text-center text-sm font-medium text-amber-700"
      >
        ← Back to menu
      </Link>
    </div>
  )
}
