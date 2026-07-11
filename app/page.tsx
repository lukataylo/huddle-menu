import Link from 'next/link'
import { listVendors } from '@/lib/data'
import BottomNav from './bottom-nav'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const vendors = await listVendors().catch(() => [])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-paper px-6 pb-28 pt-10 text-midnight">
      <header>
        <h1 className="font-display text-4xl leading-none text-ink">HUDDLE MENU</h1>
        <p className="mt-1 font-medium text-midnight/70">
          Discover amazing food stalls — scan, order, skip the queue.
        </p>
      </header>

      {vendors.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">OPEN STALLS</h2>
            <Link href="/stamps" className="text-sm font-bold text-ink">
              My stamps
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {vendors.map((vendor) => (
              <li key={vendor.id}>
                <Link
                  href={`/v/${vendor.slug}`}
                  className="flex items-center gap-4 rounded-2xl border-2 border-ink/20 bg-card p-4 active:border-ink/50"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-ink/15 bg-paper text-2xl">
                    {vendor.emoji}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg font-extrabold">{vendor.name}</span>
                    <span className="block text-sm font-medium text-ink">Tap to see the menu</span>
                  </span>
                  <span className="text-ink">›</span>
                </Link>
              </li>
            ))}
          </ul>
          {vendors.length > 1 && (
            <Link
              href="/market"
              className="mt-4 block rounded-2xl bg-ink p-4 text-center font-extrabold text-white active:bg-ink-deep"
            >
              🧺 One basket, every stall →
            </Link>
          )}
        </section>
      )}

      <section className="mt-8 rounded-2xl border-2 border-dashed border-ink/30 bg-card p-5">
        <h2 className="font-display text-2xl leading-tight text-ink">
          RUN A FOOD STALL?
        </h2>
        <p className="mt-1 text-sm font-medium text-midnight/70">
          Photograph your paper menu and we&apos;ll get you live in five minutes.
        </p>
        <Link
          href="/start"
          className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-ink/20 bg-paper p-3 active:border-ink/50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-lg text-white">
            📸
          </span>
          <span className="flex-1">
            <span className="block font-extrabold">Get your menu live</span>
            <span className="block text-sm text-midnight/60">Scan it — we handle the rest</span>
          </span>
          <span className="text-ink">›</span>
        </Link>
      </section>

      <BottomNav />
    </div>
  )
}
