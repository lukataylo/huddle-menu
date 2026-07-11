import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listMarkets, listVendors } from '@/lib/data'
import { stallArtSrc } from '@/lib/stall-icon'
import BottomNav from '../bottom-nav'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Huddle Market — pick your market' }

export default async function MarketDirectoryPage() {
  const [markets, vendors] = await Promise.all([listMarkets(), listVendors()])
  const independents = vendors.filter((vendor) => !vendor.market_id)

  // With a single market and nothing outside it, skip the directory.
  if (markets.length === 1 && independents.length === 0) {
    redirect(`/m/${markets[0].slug}`)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-paper px-6 pb-28 pt-10 text-midnight">
      <header>
        <div className="flex items-center gap-2">
          <Image src="/icons/market.png" alt="" width={40} height={40} className="h-10 w-10" />
          <h1 className="font-display text-4xl leading-none text-ink">MARKETS</h1>
        </div>
        <p className="mt-1 font-medium text-midnight/70">
          Pick a market. One basket across all its stalls.
        </p>
      </header>

      {markets.length === 0 && independents.length === 0 && (
        <p className="mt-10 text-center text-midnight/60">
          No markets are open yet.{' '}
          <Link href="/start" className="font-medium text-ink underline">
            Run a stall?
          </Link>
        </p>
      )}

      {markets.length > 0 && (
        <ul className="mt-6 space-y-3">
          {markets.map((market) => (
            <li key={market.id}>
              <Link
                href={`/m/${market.slug}`}
                className="flex items-center gap-4 rounded-2xl border-2 border-line bg-card p-4 active:border-ink/50"
              >
                <Image
                  src="/icons/mappin.png"
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0"
                />
                <span className="flex-1">
                  <span className="block text-lg font-extrabold">{market.name}</span>
                  <span className="block text-sm font-medium text-ink">
                    {market.stall_count === 1 ? '1 stall' : `${market.stall_count} stalls`} · one
                    basket
                  </span>
                </span>
                <span className="text-ink">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {independents.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-ink">INDEPENDENT STALLS</h2>
          <ul className="mt-3 space-y-3">
            {independents.map((vendor) => (
              <li key={vendor.id}>
                <Link
                  href={`/v/${vendor.slug}`}
                  className="flex items-center gap-4 rounded-2xl border-2 border-line bg-card p-4 active:border-ink/50"
                >
                  <Image
                    src={stallArtSrc(vendor.slug)}
                    alt=""
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 shrink-0 object-contain"
                  />
                  <span className="flex-1">
                    <span className="block text-lg font-extrabold">{vendor.name}</span>
                    <span className="block text-sm font-medium text-ink">Tap to see the menu</span>
                  </span>
                  <span className="text-ink">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BottomNav />
    </div>
  )
}
