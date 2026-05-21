'use client'

import Link from 'next/link'
import DamMarketingHeader from '@/components/navigation/DamMarketingHeader'
import ThisCouldBeYouCarousel from './ThisCouldBeYouCarousel'
import { thisCouldBeYouStories } from './stories'

const returnToAnalyzerHref = '/?focus=claim-input#verify'

export default function ThisCouldBeYouPage() {
  return (
    <main className="dam-shell this-could-be-you-page">
      {/* TODO: Track this route opening once frontend-only analytics hooks can be added without changing API event validation. */}
      <DamMarketingHeader activeHref="/this-could-be-you" />

      <section className="section-frame this-could-be-you-hero">
        <div className="this-could-be-you-copy">
          <p className="system-label">
            <span aria-hidden="true" />
            Product route / This Could Be You
          </p>
          <h1>This Could Be You</h1>
          <p className="this-could-be-you-subtitle">
            Small moments where five seconds of checking could have changed the outcome.
          </p>
          <Link className="this-could-be-you-backlink" href={returnToAnalyzerHref} scroll={false}>
            Back to the verification desk
          </Link>
        </div>
      </section>

      <ThisCouldBeYouCarousel stories={thisCouldBeYouStories} returnHref={returnToAnalyzerHref} />
    </main>
  )
}
