'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: 'Home', icon: '/icons/home.png' },
  { href: '/market', label: 'Market', icon: '/icons/market.png' },
  { href: '/stamps', label: 'Stamps', icon: '/icons/heart.png' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg border-t-2 border-ink/15 bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex justify-around pt-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-4 pb-1 text-xs font-bold ${
                active ? 'text-ink' : 'text-ink-soft'
              }`}
            >
              <Image
                src={tab.icon}
                alt=""
                width={28}
                height={28}
                className={active ? '' : 'opacity-50 grayscale'}
              />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
