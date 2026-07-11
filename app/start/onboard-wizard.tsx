'use client'

import { useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'

interface DraftItem {
  name: string
  description: string
  price_pence: number
  category: string
}

interface CreatedStall {
  slug: string
  adminToken: string
  menuPath: string
  kitchenPath: string
  qrDataUrl: string | null
}

const EMOJI_OPTIONS = ['🍜', '🥟', '🌮', '🍔', '🍕', '🥙', '🍛', '🍩', '☕', '🍦', '🥘', '🍗']

export default function OnboardWizard() {
  const [step, setStep] = useState<'details' | 'confirm' | 'done'>('details')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🍜')
  const [items, setItems] = useState<DraftItem[]>([])
  const [extracting, setExtracting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedStall | null>(null)

  async function handlePhoto(file: File) {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB — try a smaller photo.')
      return
    }
    setExtracting(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsDataURL(file)
      })
      const [prefix, base64] = dataUrl.split(',')
      const mediaType = prefix.match(/data:([^;]+);/)?.[1] ?? file.type

      const res = await fetch('/api/onboard/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
      if (!data.items?.length) throw new Error('No menu items found in that photo. Try a clearer one?')
      setItems(data.items)
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setExtracting(false)
    }
  }

  function startManually() {
    setItems([{ name: '', description: '', price_pence: 0, category: 'Menu' }])
    setStep('confirm')
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  async function createStall() {
    const validItems = items.filter((item) => item.name.trim())
    if (!name.trim() || validItems.length === 0 || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/onboard/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), emoji, currency: 'GBP', items: validItems }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not create your stall')
      const menuUrl = `${window.location.origin}${data.menuPath}`
      const qrDataUrl = await QRCode.toDataURL(menuUrl, { width: 480, margin: 2 }).catch(() => null)
      setCreated({ ...data, qrDataUrl })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-paper px-5 py-8 text-midnight">
      <h1 className="font-display text-4xl leading-tight text-ink">
        LET&apos;S GET YOUR MENU LIVE
      </h1>
      <p className="mt-1 text-midnight/60">
        Photograph your menu, confirm the items, get a QR code. About five minutes.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {step === 'details' && (
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-midnight/80">Stall name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Borough Bao"
              maxLength={80}
              className="w-full rounded-xl border border-ink/30 bg-card px-4 py-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/20"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm font-medium text-midnight/80">Pick an emoji</span>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setEmoji(option)}
                  className={`h-11 w-11 rounded-xl border text-xl ${
                    emoji === option
                      ? 'border-ink bg-paper ring-2 ring-ink/20'
                      : 'border-ink/20 bg-card'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-3 ${name.trim() ? '' : 'pointer-events-none opacity-40'}`}>
            <span className="mb-1 block text-sm font-medium text-midnight/80">Your menu</span>
            <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-ink/20 bg-card p-4 active:border-ink/50">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-2xl">
                📸
              </span>
              <span className="flex-1">
                <span className="block text-lg font-extrabold text-ink">
                  {extracting ? 'Reading your menu…' : 'Scan Menu'}
                </span>
                <span className="block text-sm font-medium text-midnight/60">
                  Take a photo of your menu and we&apos;ll extract it.
                </span>
              </span>
              <span className="text-xl text-ink">›</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={extracting}
                onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
              />
            </label>
            <button
              onClick={startManually}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-ink/20 bg-card p-4 text-left active:border-ink/50"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-2xl">
                ✏️
              </span>
              <span className="flex-1">
                <span className="block text-lg font-extrabold text-ink">Type It In</span>
                <span className="block text-sm font-medium text-midnight/60">
                  Add your menu items manually.
                </span>
              </span>
              <span className="text-xl text-ink">›</span>
            </button>
            <p className="pt-1 text-center text-sm text-midnight/50">
              You can always edit your menu later.
            </p>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="mt-6">
          <h2 className="text-lg font-bold">Confirm your menu</h2>
          <p className="mb-4 text-sm text-midnight/60">Fix anything we misread, then create your stall.</p>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="rounded-xl border border-ink/20 bg-card p-3">
                <div className="flex gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                    placeholder="Item name"
                    className="min-w-0 flex-1 rounded-lg border border-ink/20 px-3 py-2 text-sm font-medium outline-none focus:border-ink"
                  />
                  <div className="flex w-24 items-center rounded-lg border border-ink/20 px-2">
                    <span className="text-sm text-midnight/40">£</span>
                    <input
                      value={(item.price_pence / 100).toFixed(2)}
                      onChange={(e) => {
                        const pounds = parseFloat(e.target.value)
                        updateItem(index, {
                          price_pence: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
                        })
                      }}
                      inputMode="decimal"
                      className="w-full px-1 py-2 text-sm outline-none"
                      aria-label={`Price for ${item.name || 'item'}`}
                    />
                  </div>
                  <button
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    className="shrink-0 px-1 text-midnight/40"
                    aria-label={`Remove ${item.name || 'item'}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="Description (optional)"
                    className="min-w-0 flex-1 rounded-lg border border-ink/20 px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                  <input
                    value={item.category}
                    onChange={(e) => updateItem(index, { category: e.target.value })}
                    placeholder="Category"
                    className="w-28 rounded-lg border border-ink/20 px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setItems((prev) => [
                ...prev,
                { name: '', description: '', price_pence: 0, category: prev.at(-1)?.category ?? 'Menu' },
              ])
            }
            className="mt-3 text-sm font-medium text-ink"
          >
            + Add another item
          </button>

          <button
            onClick={createStall}
            disabled={creating || !items.some((item) => item.name.trim())}
            className="mt-6 w-full rounded-xl bg-ink px-5 py-3.5 font-semibold text-white active:bg-ink-deep disabled:bg-ink/20"
          >
            {creating ? 'Creating your stall…' : `Create ${emoji} ${name || 'my stall'}`}
          </button>
        </div>
      )}

      {step === 'done' && created && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
            <p className="text-3xl">🎉</p>
            <h2 className="mt-2 text-lg font-bold">{emoji} {name} is live!</h2>
            {created.qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={created.qrDataUrl}
                alt={`QR code for the ${name} menu`}
                className="mx-auto mt-3 w-56 rounded-lg bg-card p-2"
              />
            )}
            <p className="mt-2 text-sm text-midnight/70">
              Print this QR and stick it on your stall — customers scan it to order.
            </p>
          </div>

          <div className="rounded-2xl border border-ink/20 bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-midnight/40">
              Your links
            </h3>
            <p className="mt-3 text-sm">
              <span className="font-medium">Customer menu:</span>{' '}
              <Link href={created.menuPath} className="break-all text-ink underline">
                {created.menuPath}
              </Link>
            </p>
            <p className="mt-2 text-sm">
              <span className="font-medium">Kitchen screen:</span>{' '}
              <Link href={created.kitchenPath} className="break-all text-ink underline">
                {created.kitchenPath}
              </Link>
            </p>
            <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink">
              ⚠️ Save the kitchen link somewhere safe — it&apos;s your only way to manage orders.
              Anyone with it can run your stall.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
