'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useEffect, useId, useRef, useState } from 'react'
import DamBrandMark from '@/components/brand/DamBrandMark'
import { useIsMobile } from '@/components/analyzer/useIsMobile'
import DamUseCasesDropdown from './DamUseCasesDropdown'
import { analyzerEntryHref, useCaseLinks } from './useCaseLinks'

const mobileNavButtonStyle = {
  minWidth: 44,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 12px',
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.94)',
  color: 'var(--text)',
  font: 'inherit',
  cursor: 'pointer',
  borderRadius: 10,
  transition: 'background 180ms ease, border-color 180ms ease, transform 180ms ease',
} as const

const mobileDrawerShellStyle = {
  width: 'min(100% - 32px, 1180px)',
  margin: '0 auto',
  overflow: 'hidden',
  transformOrigin: 'top center',
  willChange: 'max-height, opacity, margin-top',
  transition:
    'max-height 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out, margin-top 240ms cubic-bezier(0.22, 1, 0.36, 1)',
} as const

const mobileDrawerPanelStyle = {
  padding: 10,
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.98)',
  boxShadow: 'var(--shadow)',
  borderRadius: 14,
  backdropFilter: 'blur(10px)',
} as const

const mobileNavMenuItemStyle = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '12px 14px',
  border: 0,
  background: 'transparent',
  color: 'var(--text)',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: 10,
  transition: 'background 180ms ease, opacity 180ms ease, transform 180ms ease',
} as const

type DamMarketingHeaderProps = {
  activeHref?: string
}

export default function DamMarketingHeader({
  activeHref,
}: DamMarketingHeaderProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const mobileMenuId = useId()
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)

  function handleRouteNavigation(href: string) {
    setIsMobileMenuOpen(false)
    startTransition(() => {
      router.push(href)
    })
  }

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileMenuOpen])

  return (
    <div ref={mobileMenuRef}>
      <header className="dam-header">
        <Link className="dam-mark" href="/" aria-label="DAM home">
          <DamBrandMark collapseTextOnNarrow={isMobile} />
        </Link>
        {isMobile ? (
          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls={mobileMenuId}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            style={mobileNavButtonStyle}
          >
            <span aria-hidden="true">Menu</span>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-grid',
                gap: 3,
                width: 14,
              }}
            >
              <span style={{ display: 'block', height: 2, background: 'currentColor' }} />
              <span style={{ display: 'block', height: 2, background: 'currentColor' }} />
              <span style={{ display: 'block', height: 2, background: 'currentColor' }} />
            </span>
          </button>
        ) : (
          <nav className="dam-nav" aria-label="Product pages">
            <Link href={analyzerEntryHref}>Open App</Link>
            <DamUseCasesDropdown activeHref={activeHref} />
            <Link href="/this-could-be-you" data-active={activeHref === '/this-could-be-you'}>
              This Could Be You
            </Link>
          </nav>
        )}
      </header>
      {isMobile ? (
        <section
          style={{
            ...mobileDrawerShellStyle,
            maxHeight: isMobileMenuOpen ? 420 : 0,
            opacity: isMobileMenuOpen ? 1 : 0,
            marginTop: isMobileMenuOpen ? 8 : 0,
          }}
        >
          <nav
            id={mobileMenuId}
            aria-label="Product pages"
            aria-hidden={!isMobileMenuOpen}
            style={{
              ...mobileDrawerPanelStyle,
              overflow: 'hidden',
              opacity: isMobileMenuOpen ? 1 : 0,
              transform: isMobileMenuOpen
                ? 'translateY(0) scaleY(1)'
                : 'translateY(-14px) scaleY(0.94)',
              transformOrigin: 'top center',
              pointerEvents: isMobileMenuOpen ? 'auto' : 'none',
              padding: isMobileMenuOpen ? 10 : 0,
              borderWidth: isMobileMenuOpen ? 1 : 0,
              boxShadow: isMobileMenuOpen ? 'var(--shadow)' : 'none',
              willChange: 'transform, opacity, padding',
              transition:
                'opacity 180ms ease-out, transform 240ms cubic-bezier(0.22, 1, 0.36, 1), padding 240ms cubic-bezier(0.22, 1, 0.36, 1), border-width 180ms ease, box-shadow 180ms ease',
            }}
          >
            <button
              type="button"
              onClick={() => handleRouteNavigation(analyzerEntryHref)}
              style={mobileNavMenuItemStyle}
            >
              <span>Open App</span>
            </button>
            {useCaseLinks.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => handleRouteNavigation(item.href)}
                style={mobileNavMenuItemStyle}
              >
                <span>{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleRouteNavigation('/this-could-be-you')}
              style={mobileNavMenuItemStyle}
            >
              <span>This Could Be You</span>
            </button>
          </nav>
        </section>
      ) : null}
    </div>
  )
}
