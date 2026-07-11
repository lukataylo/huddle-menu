import type { Metadata } from 'next'
import OnboardWizard from './onboard-wizard'

export const metadata: Metadata = { title: 'Get your stall online — Huddle Menu' }

export default function StartPage() {
  return <OnboardWizard />
}
