import Image from 'next/image'
import Link from 'next/link'
import { getWaitingCounts, listMarkets, listVendors } from '@/lib/data'
import BottomNav from './bottom-nav'
import StallDirectory from './stall-directory'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const vendors = await listVendors().catch(() => [])
  const markets = await listMarkets().catch(() => [])
  const waiting = await getWaitingCounts().catch(() => new Map<string, number>())

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg md:max-w-3xl flex-col bg-paper px-6 pb-28 pt-10 text-midnight">
      <header>
        <h1 className="font-display text-4xl leading-none text-ink">HUDDLE MENU</h1>
        <p className="mt-1 font-medium text-midnight/70">
          Scan the QR, join the queue, get buzzed when it&apos;s your turn.
        </p>
      </header>

      {markets.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-ink">MARKETS</h2>
          <ul className="mt-3 space-y-3">
            {markets.map((market) => (
              <li key={market.id}>
                <Link
                  href={`/m/${market.slug}`}
                  className="flex items-center gap-4 rounded-2xl border-2 border-line bg-card p-4 active:border-ink/50"
                >
                  <Image
                    src="/icons/mappin.png"
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0"
                  />
                  <span className="flex-1">
                    <span className="block text-lg font-extrabold">{market.name}</span>
                    <span className="block text-sm font-medium text-ink">
                      {market.stall_count === 1 ? '1 stall' : `${market.stall_count} stalls`} · one
                      basket, one payment
                    </span>
                  </span>
                  <span className="text-ink">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vendors.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">OPEN STALLS</h2>
            <Link href="/stamps" className="text-sm font-bold text-ink">
              My stamps
            </Link>
          </div>
          <StallDirectory
            stalls={vendors.map((vendor) => ({
              slug: vendor.slug,
              name: vendor.name,
              waiting: waiting.get(vendor.id) ?? 0,
              open: vendor.open,
            }))}
          />
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

      <section className="mt-8 rounded-2xl border-2 border-dashed border-line-strong bg-card p-5">
        <h2 className="font-display text-2xl leading-tight text-ink">
          RUN A FOOD STALL?
        </h2>
        <p className="mt-1 text-sm font-medium text-midnight/70">
          Photograph your paper menu and we&apos;ll get you live in five minutes.
        </p>
        <Link
          href="/start"
          className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-line bg-paper p-3 active:border-ink/50"
        >
          <Image src="/icons/qr.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0" />
          <span className="flex-1">
            <span className="block font-extrabold">Get your menu live</span>
            <span className="block text-sm text-midnight/60">Scan it — we handle the rest</span>
          </span>
          <span className="text-ink">›</span>
        </Link>
        <p className="mt-3 text-center text-sm text-midnight/60">
          Already set up?{' '}
          <Link href="/dashboard" className="font-bold text-ink underline">
            Open your dashboard
          </Link>
        </p>
      </section>

      <BottomNav />
    </div>
  )
}
