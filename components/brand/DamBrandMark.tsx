import Image from 'next/image'

type DamBrandMarkProps = {
  collapseTextOnNarrow?: boolean
  label?: string
}

export default function DamBrandMark({
  collapseTextOnNarrow = false,
  label = 'DAM',
}: DamBrandMarkProps) {
  return (
    <>
      <span className="dam-brand-mark__icon-shell">
        <Image
          src="/brand/dam-icon.png"
          alt="DAM logo"
          fill
          sizes="24px"
          className="dam-brand-mark__image"
        />
      </span>
      {label ? (
        <span
          className={
            collapseTextOnNarrow
              ? 'dam-brand-mark__text dam-brand-mark__text--collapse'
              : 'dam-brand-mark__text'
          }
        >
          {label}
        </span>
      ) : null}
    </>
  )
}
