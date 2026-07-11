import Link from 'next/link'
import { listVendors } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const vendors = await listVendors().catch(() => [])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50 px-6 py-12 text-stone-900">
      <div className="text-center">
        <p className="text-5xl">🍜</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Huddle Menu</h1>
        <p className="mt-3 text-stone-500">
          Scan, order, pay, skip the queue. QR-code ordering for street food stalls.
        </p>
      </div>

      {vendors.length > 0 && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400">
              Open stalls
            </h2>
            <Link href="/stamps" className="text-sm font-medium text-amber-700">
              My stamps
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {vendors.map((vendor) => (
              <li key={vendor.id}>
                <Link
                  href={`/v/${vendor.slug}`}
                  className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-sm active:bg-stone-50"
                >
                  <span className="font-medium">
                    {vendor.emoji} {vendor.name}
                  </span>
                  <span className="text-stone-400">→</span>
                </Link>
              </li>
            ))}
          </ul>
          {vendors.length > 1 && (
            <Link
              href="/market"
              className="mt-3 block rounded-xl bg-amber-600 p-4 text-center font-semibold text-white active:bg-amber-700"
            >
              🧺 Order from every stall in one basket
            </Link>
          )}
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-dashed border-stone-300 p-5 text-center">
        <p className="font-medium">Run a food stall?</p>
        <p className="mt-1 text-sm text-stone-500">
          Photograph your paper menu and be taking orders in five minutes.
        </p>
        <Link
          href="/start"
          className="mt-3 inline-block rounded-xl border border-amber-600 px-5 py-2.5 text-sm font-semibold text-amber-700"
        >
          Get your stall online →
        </Link>
      </div>
    </div>
  )
}
