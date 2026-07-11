'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { stallArtSrc } from '@/lib/stall-icon'

export interface DirectoryStall {
  slug: string
  name: string
  waiting: number
  open: boolean
}

// Searchable stall list, sorted by shortest wait.
export default function StallDirectory({ stalls }: { stalls: DirectoryStall[] }) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stalls
      .filter((stall) => !q || stall.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.open) - Number(a.open) || a.waiting - b.waiting)
  }, [stalls, query])

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stalls…"
        aria-label="Search stalls"
        className="mt-3 w-full rounded-xl border border-line-strong bg-card px-4 py-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20"
      />
      <ul className="mt-3 space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {visible.map((stall) => (
          <li key={stall.slug}>
            <Link
              href={`/v/${stall.slug}`}
              className="flex items-center gap-4 rounded-2xl border-2 border-line bg-card p-4 active:border-ink/50"
            >
              <Image
                src={stallArtSrc(stall.slug)}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 shrink-0 object-contain"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold">{stall.name}</span>
                <span
                  className={`block text-sm font-bold ${
                    !stall.open ? 'text-red-600' : stall.waiting === 0 ? 'text-green-700' : 'text-ink'
                  }`}
                >
                  {!stall.open
                    ? 'Closed right now'
                    : stall.waiting === 0
                      ? 'No queue — walk right up'
                      : `~${stall.waiting * 3} min wait · ${stall.waiting} in queue`}
                </span>
              </span>
              <span className="text-ink">›</span>
            </Link>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="mt-4 text-center text-sm text-midnight/60">
          No stalls match &ldquo;{query}&rdquo;.
        </p>
      )}
    </>
  )
}
