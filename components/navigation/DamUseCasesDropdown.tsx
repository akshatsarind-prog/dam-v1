import Link from 'next/link'
import { useCaseLinks } from './useCaseLinks'

type DamUseCasesDropdownProps = {
  activeHref?: string
}

export default function DamUseCasesDropdown({
  activeHref,
}: DamUseCasesDropdownProps) {
  return (
    <div className="dam-nav-dropdown">
      <button
        type="button"
        className="dam-nav-dropdown__trigger"
        aria-haspopup="menu"
        aria-label="Open DAM use case pages"
      >
        <span>Use Cases</span>
        <span className="dam-nav-dropdown__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      <div className="dam-nav-dropdown__menu" role="menu" aria-label="DAM use case pages">
        {useCaseLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            data-active={item.href === activeHref}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
