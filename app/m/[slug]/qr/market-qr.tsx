'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'

export default function MarketQr({ slug, name }: { slug: string; name: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = `${window.location.origin}/m/${slug}`
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: '#1b32a4', light: '#fbf8ef' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [slug])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center bg-paper px-6 py-10 text-center text-midnight">
      <h1 className="font-display text-4xl leading-tight text-ink">{name.toUpperCase()}</h1>
      <p className="mt-1 font-medium text-midnight/70">
        Scan to order from any stall. One basket, one payment.
      </p>

      {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={`QR code for the ${name} market menu`}
          className="mt-8 w-full max-w-sm rounded-2xl border-2 border-line bg-card p-4"
        />
      )}

      <button
        onClick={() => window.print()}
        className="mt-8 w-full max-w-sm rounded-xl bg-ink px-5 py-3.5 font-semibold text-white active:bg-ink-deep print:hidden"
      >
        Print this poster
      </button>
      <Link href={`/m/${slug}`} className="mt-4 text-sm font-medium text-ink print:hidden">
        ← Back to {name}
      </Link>
    </div>
  )
}
