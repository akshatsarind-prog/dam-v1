import Image from 'next/image'

type AdminBrandVariant = 'icon' | 'wordmark' | 'lockup'

type AdminBrandProps = {
  variant: AdminBrandVariant
  className?: string
  priority?: boolean
  sizes?: string
}

const BRAND_ASSETS: Record<
  AdminBrandVariant,
  {
    src: string
    width: number
    height: number
    alt: string
  }
> = {
  icon: {
    src: '/brand/dam-icon.png',
    width: 1348,
    height: 1167,
    alt: 'DAM icon',
  },
  wordmark: {
    src: '/brand/dam-wordmark.png',
    width: 2065,
    height: 761,
    alt: 'DAM wordmark',
  },
  lockup: {
    src: '/brand/dam-lockup.png',
    width: 1774,
    height: 887,
    alt: 'DAM logo',
  },
}

export default function AdminBrand({
  variant,
  className,
  priority = false,
  sizes,
}: AdminBrandProps) {
  const asset = BRAND_ASSETS[variant]

  return (
    <span className={className} style={{ display: 'block', lineHeight: 0 }}>
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        sizes={sizes}
        className="dam-admin-brand-image"
        style={{
          width: '100%',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </span>
  )
}
