import type { Metadata } from 'next'
import StampCard from './stamp-card'

export const metadata: Metadata = { title: 'My stamps' }

export default function StampsPage() {
  return <StampCard />
}
