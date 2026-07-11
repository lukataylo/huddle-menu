'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SavedConsole {
  slug: string
  token: string
}

// Stall-owner "login": the stall key is the credential. Devices that have
// opened a console before get one-tap access.
export default function DashboardClient() {
  const router = useRouter()
  const [saved, setSaved] = useState<SavedConsole[]>([])
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const found: SavedConsole[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i)
        if (storageKey?.startsWith('huddle_admin_')) {
          const token = localStorage.getItem(storageKey)
          if (token) found.push({ slug: storageKey.slice('huddle_admin_'.length), token })
        }
      }
      setSaved(found.sort((a, b) => a.slug.localeCompare(b.slug)))
    } catch {
      // private browsing — key entry still works
    }
  }, [])

  async function login() {
    if (!key.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/vendor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: key.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Login failed')
      try {
        localStorage.setItem(`huddle_admin_${data.slug}`, key.trim())
      } catch {
        // private browsing — the redirect still carries the token
      }
      router.push(data.kitchenPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-paper px-6 py-10 text-midnight">
      <h1 className="font-display text-4xl leading-tight text-ink">STALL DASHBOARD</h1>
      <p className="mt-1 font-medium text-midnight/70">
        Run your queue, edit your menu, flip your live status.
      </p>

      {saved.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-ink">YOUR STALLS ON THIS DEVICE</h2>
          <ul className="mt-3 space-y-3">
            {saved.map((console_) => (
              <li key={console_.slug}>
                <Link
                  href={`/v/${console_.slug}/kitchen?token=${encodeURIComponent(console_.token)}`}
                  className="flex items-center justify-between rounded-2xl border-2 border-line bg-card p-4 font-extrabold active:border-ink/50"
                >
                  {console_.slug}
                  <span className="text-ink">Open console ›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">
          {saved.length > 0 ? 'ANOTHER STALL?' : 'LOG IN WITH YOUR STALL KEY'}
        </h2>
        <p className="mt-1 text-sm text-midnight/60">
          Your stall key is in your kitchen link (the part after <code className="rounded bg-ink/10 px-1">token=</code>),
          shown when you created your stall.
        </p>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your stall key"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="mt-3 w-full rounded-xl border border-line-strong bg-card px-4 py-3 font-mono text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/20"
        />
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          onClick={login}
          disabled={submitting || !key.trim()}
          className="mt-4 w-full rounded-xl bg-ink px-5 py-3.5 font-semibold text-white active:bg-ink-deep disabled:bg-ink/20"
        >
          {submitting ? 'Checking…' : 'Open my dashboard'}
        </button>
      </section>

      <p className="mt-8 text-center text-sm text-midnight/60">
        New here?{' '}
        <Link href="/start" className="font-bold text-ink underline">
          Get your stall live in 5 minutes
        </Link>
      </p>
    </div>
  )
}
