'use client'

export type PayMethod = 'card' | 'cash'

export default function PayMethodToggle({
  value,
  onChange,
  cashDetail = 'Cash or card reader when you collect',
}: {
  value: PayMethod
  onChange: (method: PayMethod) => void
  cashDetail?: string
}) {
  const option = (method: PayMethod, icon: string, label: string, detail: string) => (
    <button
      onClick={() => onChange(method)}
      className={`flex-1 rounded-xl border-2 p-3 text-left ${
        value === method ? 'border-ink bg-paper ring-2 ring-ink/20' : 'border-line bg-card'
      }`}
    >
      <span className="block text-lg">{icon}</span>
      <span className="mt-0.5 block text-sm font-extrabold">{label}</span>
      <span className="block text-xs font-medium text-midnight/60">{detail}</span>
    </button>
  )

  return (
    <div className="mt-6">
      <span className="mb-1 block text-sm font-medium text-midnight/80">How do you want to pay?</span>
      <div className="flex gap-2">
        {option('card', '💳', 'Pay online', 'Secure checkout, skip the till')}
        {option('cash', '💷', 'At the stall', cashDetail)}
      </div>
    </div>
  )
}
