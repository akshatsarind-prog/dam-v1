import type { Metadata } from 'next'
import ThisCouldBeYouPage from '@/components/this-could-be-you/ThisCouldBeYouPage'

export const metadata: Metadata = {
  title: 'This Could Be You | DAM V1',
  description:
    'A menu-only DAM product experience with short fictional stories about misinformation, scams, and unverified sharing.',
}

export default function Page() {
  return <ThisCouldBeYouPage />
}
