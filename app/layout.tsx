import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Analytics } from '@vercel/analytics/react'
import DamAttributionTracker from '@/components/analytics/DamAttributionTracker'
import './globals.css'

export const metadata: Metadata = {
  title: 'DAM | Defence Against Misinformation',
  description:
    'DAM is an evidence-first intelligence layer for reviewing claims before distribution.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <DamAttributionTracker />
        </Suspense>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
