'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatMoney } from '@/lib/format'
import { stallIconPath } from '@/lib/stall-icon'
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
  { key: 'paid', label: 'Received', icon: '/icons/receipt.png' },
  { key: 'preparing', label: 'Preparing', icon: '/icons/bowl.png' },
  { key: 'ready', label: 'Ready', icon: '/icons/bag.png' },
  { key: 'collected', label: 'Picked up', icon: '/icons/heart.png' },
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

      <div className="relative mt-4">
        <span className="absolute left-8 top-4 text-lg text-ink" aria-hidden>
          ✦
        </span>
        <span className="absolute right-12 -top-1 text-xs text-ink" aria-hidden>
          ✦
        </span>
        <span className="absolute right-6 top-14 text-sm text-ink" aria-hidden>
          ✦
        </span>
        <p className="text-center font-display text-4xl leading-none tracking-widest text-ink">
          ORDER
        </p>
        <p className="text-center font-display text-8xl leading-none text-ink">
          #{order.order_number}
        </p>
      </div>

      <div
        className={`mt-6 rounded-3xl border-2 bg-card p-6 text-center ${
          order.status === 'ready' ? 'border-green-500 ring-2 ring-green-300' : 'border-ink'
        }`}
      >
        <h1 className="text-xl font-extrabold text-ink">{copy.title}</h1>
        <p className="mt-1 text-sm font-medium text-midnight/70">{copy.detail}</p>
        {order.customer_name !== 'Guest' && (
          <p className="mt-1 text-sm font-bold text-midnight/80">for {order.customer_name}</p>
        )}

        {order.status !== 'cancelled' && order.status !== 'pending' && (
          <div className="mt-6 flex items-start">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
                {i === stepIndex ? (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink ring-2 ring-ink ring-offset-2 ring-offset-card">
                    <Image src={step.icon} alt="" width={24} height={24} className="brightness-0 invert" />
                  </span>
                ) : i < stepIndex ? (
                  <span className="mt-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                    ✓
                  </span>
                ) : (
                  <span className="mt-1.5 flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-dashed border-line-strong bg-card">
                    <Image src={step.icon} alt="" width={18} height={18} className="opacity-30 grayscale" />
                  </span>
                )}
                <span
                  className={`text-center text-[11px] ${
                    i === stepIndex
                      ? 'font-bold text-ink'
                      : i < stepIndex
                        ? 'font-semibold text-midnight/70'
                        : 'font-semibold text-midnight/40'
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
            className="mt-5 w-full rounded-2xl border-2 border-line-strong bg-paper px-4 py-3 text-sm font-bold text-ink"
          >
            🔔 Notify me when it&apos;s ready
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-3xl border-2 border-line bg-card p-5">
        <div>
          <h2 className="font-display text-lg text-ink">PICKUP AT</h2>
          <p className="mt-1 text-lg font-extrabold">
            {vendor.emoji} {vendor.name}
          </p>
        </div>
        <Image
          src={stallIconPath(vendor.emoji, vendor.name)}
          alt=""
          width={72}
          height={72}
          className="h-18 w-18 shrink-0"
        />
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-line/40 px-4 py-3">
        <Image src="/icons/bag.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
        <div>
          <p className="text-sm font-bold">No cutlery needed</p>
          <p className="text-xs font-medium text-midnight/60">Thanks for helping us reduce waste!</p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border-2 border-line bg-card p-5">
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
        <div className="mt-3 flex justify-between border-t-2 border-dashed border-line pt-3 font-extrabold">
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
