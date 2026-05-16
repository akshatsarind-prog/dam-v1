'use client'

import DesktopAnalyzer from './DesktopAnalyzer'
import MobileAnalyzer from './MobileAnalyzer'
import { useAnalyzeClaim } from './useAnalyzeClaim'
import { useIsMobile } from './useIsMobile'

export default function AnalyzerShell() {
  const analyzer = useAnalyzeClaim()
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MobileAnalyzer {...analyzer} />
  }

  return <DesktopAnalyzer {...analyzer} />
}
