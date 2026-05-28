import Link from 'next/link'
import { getPublicScamOfTheDay } from '@/lib/scam-of-the-day/publicScamOfTheDay'

function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? 'Recently updated'
    : parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
}

export default async function ScamOfTheDayPage() {
  const publicScamOfTheDay = await getPublicScamOfTheDay()

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, rgba(170, 213, 255, 0.08), transparent 32%), #050607',
        color: '#f5f7fa',
      }}
    >
      <div
        style={{
          width: 'min(1080px, calc(100% - 32px))',
          margin: '0 auto',
          padding: '28px 0 56px',
          display: 'grid',
          gap: 22,
        }}
      >
        <header
          style={{
            display: 'grid',
            gap: 10,
            padding: '22px 20px 8px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(219, 228, 242, 0.66)',
            }}
          >
            Scam of the Day
          </p>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 6vw, 3.8rem)', lineHeight: 1.02 }}>
            Scam of the Day
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 700,
              color: 'rgba(225, 232, 244, 0.82)',
              lineHeight: 1.7,
              fontSize: 16,
            }}
          >
            Daily warning from real scam patterns people are checking on DAM.
          </p>
        </header>

        {publicScamOfTheDay ? (
          <>
            <section
              style={{
                display: 'grid',
                gap: 18,
                padding: '22px 20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 22,
                background: 'rgba(15, 17, 21, 0.96)',
                boxShadow: '0 24px 80px rgba(0, 0, 0, 0.28)',
              }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <p style={{ margin: 0, color: '#9cc9ff', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Reviewed public warning
                </p>
                <h2 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', lineHeight: 1.12 }}>
                  {publicScamOfTheDay.title}
                </h2>
                <p style={{ margin: 0, color: 'rgba(225, 232, 244, 0.86)', lineHeight: 1.75 }}>
                  {publicScamOfTheDay.scamPattern}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  color: 'rgba(219, 228, 242, 0.68)',
                  fontSize: 13,
                }}
              >
                <span>Updated {formatDate(publicScamOfTheDay.updatedAt)}</span>
                <span>{publicScamOfTheDay.sourceNote}</span>
              </div>
            </section>

            <section
              style={{
                display: 'grid',
                gap: 18,
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              }}
            >
              <article
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: '20px 18px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 20,
                  background: 'rgba(12, 14, 17, 0.94)',
                }}
              >
                <h3 style={{ margin: 0, fontSize: 20 }}>Why this is risky</h3>
                <p style={{ margin: 0, lineHeight: 1.75, color: 'rgba(225, 232, 244, 0.82)' }}>
                  {publicScamOfTheDay.whyRisky}
                </p>
              </article>

              <article
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: '20px 18px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 20,
                  background: 'rgba(12, 14, 17, 0.94)',
                }}
              >
                <h3 style={{ margin: 0, fontSize: 20 }}>Common warning signs</h3>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10, lineHeight: 1.7 }}>
                  {publicScamOfTheDay.warningSigns.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </article>
            </section>

            <section
              style={{
                display: 'grid',
                gap: 14,
                padding: '20px 18px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 20,
                background: 'rgba(12, 14, 17, 0.94)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 20 }}>What users should do</h3>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10, lineHeight: 1.7 }}>
                {publicScamOfTheDay.whatUsersShouldDo.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p style={{ margin: 0, color: 'rgba(225, 232, 244, 0.82)', lineHeight: 1.7 }}>
                {publicScamOfTheDay.damCta}
              </p>
            </section>
          </>
        ) : (
          <section
            style={{
              display: 'grid',
              gap: 14,
              padding: '22px 20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 22,
              background: 'rgba(12, 14, 17, 0.94)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24 }}>Scam of the Day is being reviewed. Check back soon.</h2>
            <p style={{ margin: 0, color: 'rgba(225, 232, 244, 0.78)', lineHeight: 1.7 }}>
              DAM only shows scam warnings after manual review and source-backed approval.
            </p>
          </section>
        )}

        <section
          style={{
            display: 'grid',
            gap: 12,
            padding: '20px 18px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            background: 'rgba(12, 14, 17, 0.9)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20 }}>Check a suspicious message</h3>
          <p style={{ margin: 0, color: 'rgba(225, 232, 244, 0.8)', lineHeight: 1.7 }}>
            Use the analyzer to inspect a message before you click, trust, forward, or act.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link
              href="/?focus=claim-input#verify"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 46,
                padding: '0 18px',
                borderRadius: 999,
                background: '#9cc9ff',
                color: '#06111c',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Check a suspicious message
            </Link>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 46,
                padding: '0 18px',
                borderRadius: 999,
                border: '1px solid rgba(255, 255, 255, 0.16)',
                color: '#f5f7fa',
                textDecoration: 'none',
              }}
            >
              Back to DAM
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
