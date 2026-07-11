'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <path
        d="M3 10.5 12 3l9 7.5M5.5 8.5V21h13V8.5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: '/market',
    label: 'Market',
    icon: (
      <path
        d="M4 10h16M5 10l1-5h12l1 5M5 10v10h14V10M10 14h4"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: '/stamps',
    label: 'Stamps',
    icon: (
      <path
        d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8ZM12 6v12"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0 0"
      />
    ),
  },
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
              className={`flex flex-col items-center gap-0.5 px-4 pb-1 text-xs font-semibold ${
                active ? 'text-ink' : 'text-ink-soft'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
