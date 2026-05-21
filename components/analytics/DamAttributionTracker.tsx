'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  getDamSessionSignalMetadata,
  getOrCreateDamSessionId,
  sendDamTrackEvent,
  syncDamAttribution,
} from '@/lib/analytics'

function getPageLabel(pathname: string) {
  if (pathname === '/') {
    return 'home'
  }

  return pathname.replace(/^\/+/, '') || 'home'
}

export default function DamAttributionTracker() {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const search = searchParams.toString()

  useEffect(() => {
    const sessionId = getOrCreateDamSessionId()

    syncDamAttribution({
      pathname,
      search,
      sessionId,
    })

    sendDamTrackEvent({
      event_name: 'page_view',
      session_id: sessionId,
      metadata: getDamSessionSignalMetadata(sessionId, {
        page: getPageLabel(pathname),
      }),
    })
  }, [pathname, search])

  return null
}
