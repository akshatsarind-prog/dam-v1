'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useCaseLinks } from './useCaseLinks'

type DamUseCasesDropdownProps = {
  activeHref?: string
}

export default function DamUseCasesDropdown({
  activeHref,
}: DamUseCasesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div
      ref={dropdownRef}
      className="dam-usecase-dropdown dam-nav-dropdown"
      data-open={isOpen}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="dam-usecase-trigger dam-nav-dropdown__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label="Open DAM use case pages"
        data-open={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>Use Cases</span>
        <span
          className="dam-usecase-trigger__chevron dam-nav-dropdown__chevron"
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      <div
        id={menuId}
        className="dam-usecase-menu dam-nav-dropdown__menu"
        role="menu"
        aria-label="DAM use case pages"
      >
        {useCaseLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="dam-usecase-item"
            role="menuitem"
            data-active={item.href === activeHref}
            onClick={() => setIsOpen(false)}
          >
            <span className="dam-usecase-title">{item.title}</span>
            <span className="dam-usecase-desc">{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
