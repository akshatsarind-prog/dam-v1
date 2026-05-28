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

function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'verified' | 'review'
}) {
  const styles =
    tone === 'verified'
      ? {
          border: '1px solid rgba(125, 211, 252, 0.34)',
          background: 'rgba(11, 43, 58, 0.9)',
          color: '#b9edff',
        }
      : tone === 'review'
        ? {
            border: '1px solid rgba(245, 158, 11, 0.34)',
            background: 'rgba(56, 33, 8, 0.92)',
            color: '#ffd694',
          }
        : {
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'rgba(227, 234, 245, 0.76)',
          }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 32,
        padding: '0 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        ...styles,
      }}
    >
      {children}
    </span>
  )
}

function ActionLink({
  href,
  label,
  variant = 'primary',
}: {
  href: string
  label: string
  variant?: 'primary' | 'secondary'
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        padding: '0 18px',
        borderRadius: 999,
        fontWeight: 700,
        textDecoration: 'none',
        transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease',
        ...(variant === 'primary'
          ? {
              background: 'linear-gradient(180deg, #aad5ff, #82bbff)',
              color: '#04111d',
              boxShadow: '0 18px 40px rgba(79, 153, 236, 0.24)',
            }
          : {
              border: '1px solid rgba(255, 255, 255, 0.14)',
              background: 'rgba(255, 255, 255, 0.03)',
              color: '#f5f7fa',
            }),
      }}
    >
      {label}
    </Link>
  )
}

export default async function ScamOfTheDayPage() {
  const publicScamOfTheDay = await getPublicScamOfTheDay()

  return (
    <main
      style={{
        minHeight: '100vh',
        background: `
          radial-gradient(circle at top, rgba(147, 197, 253, 0.12), transparent 26%),
          radial-gradient(circle at 18% 24%, rgba(214, 38, 38, 0.08), transparent 22%),
          #050607
        `,
        color: '#f5f7fa',
      }}
    >
      <div
        style={{
          width: 'min(1080px, calc(100% - 32px))',
          margin: '0 auto',
          padding: '28px 0 56px',
          display: 'grid',
          gap: 20,
        }}
      >
        <header
          style={{
            display: 'grid',
            gap: 14,
            padding: '18px 4px 6px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <Pill tone={publicScamOfTheDay ? 'verified' : 'review'}>Scam of the Day</Pill>
            {publicScamOfTheDay ? (
              <>
                <Pill tone="verified">Source-backed warning</Pill>
                <Pill>{`${publicScamOfTheDay.sourceCount} sources checked`}</Pill>
              </>
            ) : (
              <Pill tone="review">Under review</Pill>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.1rem, 6vw, 4rem)', lineHeight: 0.98 }}>
            {publicScamOfTheDay
              ? publicScamOfTheDay.title
              : "Today's scam warning is under review"}
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 760,
              color: 'rgba(225, 232, 244, 0.84)',
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
                position: 'relative',
                display: 'grid',
                gap: 18,
                padding: '24px 22px',
                border: '1px solid rgba(214, 38, 38, 0.2)',
                borderRadius: 24,
                background:
                  'linear-gradient(180deg, rgba(31, 13, 15, 0.92), rgba(13, 15, 19, 0.96))',
                boxShadow: '0 24px 80px rgba(0, 0, 0, 0.34)',
                overflow: 'hidden',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: 5,
                  background: 'linear-gradient(180deg, #ff7a7d, #f59e0b)',
                }}
              />
              <div style={{ display: 'grid', gap: 10 }}>
                <p
                  style={{
                    margin: 0,
                    color: '#ffb8ba',
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  Operational warning
                </p>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 'clamp(1.45rem, 4vw, 2.3rem)',
                    lineHeight: 1.12,
                  }}
                >
                  {publicScamOfTheDay.candidatePattern}
                </h2>
                <p style={{ margin: 0, color: 'rgba(235, 239, 245, 0.86)', lineHeight: 1.75 }}>
                  {publicScamOfTheDay.scamPattern}
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  alignItems: 'center',
                  color: 'rgba(232, 236, 244, 0.7)',
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
                  borderTop: '3px solid rgba(214, 38, 38, 0.7)',
                  borderRadius: 22,
                  background: 'rgba(12, 14, 17, 0.95)',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: '#ffb8ba',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Why this is risky
                </p>
                <p style={{ margin: 0, lineHeight: 1.75, color: 'rgba(225, 232, 244, 0.84)' }}>
                  {publicScamOfTheDay.whyRisky}
                </p>
              </article>

              <article
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: '20px 18px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderTop: '3px solid rgba(245, 158, 11, 0.72)',
                  borderRadius: 22,
                  background: 'rgba(12, 14, 17, 0.95)',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: '#ffd694',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Warning signs
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {publicScamOfTheDay.warningSigns.map((warning, index) => (
                    <div
                      key={warning}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '34px 1fr',
                        gap: 12,
                        alignItems: 'start',
                        padding: '12px 12px 12px 10px',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: 16,
                        background: 'rgba(255, 255, 255, 0.025)',
                      }}
                    >
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          background: 'rgba(245, 158, 11, 0.14)',
                          color: '#ffd694',
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {index + 1}
                      </span>
                      <p style={{ margin: 0, lineHeight: 1.65 }}>{warning}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section
              style={{
                display: 'grid',
                gap: 16,
                padding: '20px 18px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderTop: '3px solid rgba(125, 211, 252, 0.72)',
                borderRadius: 22,
                background: 'rgba(12, 14, 17, 0.95)',
              }}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                <p
                  style={{
                    margin: 0,
                    color: '#b9edff',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  What users should do
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {publicScamOfTheDay.whatUsersShouldDo.map((step) => (
                    <div
                      key={step}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '10px 1fr',
                        gap: 12,
                        alignItems: 'start',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          marginTop: 8,
                          borderRadius: 999,
                          background: '#9cc9ff',
                        }}
                      />
                      <p style={{ margin: 0, lineHeight: 1.68 }}>{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  padding: '14px 14px 15px',
                  border: '1px solid rgba(156, 201, 255, 0.16)',
                  borderRadius: 16,
                  background: 'rgba(9, 19, 31, 0.72)',
                }}
              >
                <p style={{ margin: 0, color: 'rgba(232, 238, 246, 0.88)', lineHeight: 1.7 }}>
                  {publicScamOfTheDay.damCta}
                </p>
              </div>
            </section>
          </>
        ) : (
          <section
            style={{
              display: 'grid',
              gap: 16,
              padding: '24px 22px',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: 24,
              background:
                'linear-gradient(180deg, rgba(40, 26, 10, 0.9), rgba(12, 14, 17, 0.96))',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.28)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Pill tone="review">Under review</Pill>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', lineHeight: 1.08 }}>
                Today&apos;s scam warning is under review
              </h2>
              <p style={{ margin: 0, color: 'rgba(230, 235, 243, 0.84)', lineHeight: 1.72 }}>
                DAM only shows public scam warnings after manual review and source-backed approval.
              </p>
              <p style={{ margin: 0, color: 'rgba(255, 214, 148, 0.88)', lineHeight: 1.72 }}>
                This prevents unverified user-submitted patterns from becoming public claims.
              </p>
            </div>
          </section>
        )}

        <section
          style={{
            display: 'grid',
            gap: 14,
            padding: '20px 18px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 22,
            background: 'rgba(12, 14, 17, 0.92)',
          }}
        >
          <p
            style={{
              margin: 0,
              color: 'rgba(185, 237, 255, 0.88)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Trust note
          </p>
          <p style={{ margin: 0, color: 'rgba(225, 232, 244, 0.82)', lineHeight: 1.72 }}>
            Public warnings appear only after manual review and source-backed approval.
          </p>
        </section>

        <section
          style={{
            display: 'grid',
            gap: 14,
            padding: '22px 20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 22,
            background:
              'linear-gradient(180deg, rgba(11, 16, 24, 0.96), rgba(10, 12, 15, 0.94))',
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <p
              style={{
                margin: 0,
                color: '#9cc9ff',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Need to check a message?
            </p>
            <h3 style={{ margin: 0, fontSize: 24 }}>Check a suspicious message</h3>
            <p style={{ margin: 0, color: 'rgba(225, 232, 244, 0.8)', lineHeight: 1.72 }}>
              Before you click, forward, trust, or act — check the message on DAM.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <ActionLink href="/?focus=claim-input#verify" label="Check a suspicious message" />
            <ActionLink href="/" label="Back to DAM" variant="secondary" />
          </div>
        </section>
      </div>
    </main>
  )
}
