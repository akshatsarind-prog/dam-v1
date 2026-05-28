'use client'

import DesktopAnalyzer from './DesktopAnalyzer'
import MobileAnalyzer from './MobileAnalyzer'
import type { PublicScamOfTheDay } from '@/lib/scam-of-the-day/publicScamOfTheDay'
import { useAnalyzeClaim } from './useAnalyzeClaim'
import { useIsMobile } from './useIsMobile'

type AnalyzerShellProps = {
  publicScamOfTheDay: PublicScamOfTheDay | null
}

export default function AnalyzerShell({ publicScamOfTheDay }: AnalyzerShellProps) {
  const analyzer = useAnalyzeClaim()
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MobileAnalyzer {...analyzer} publicScamOfTheDay={publicScamOfTheDay} />
  }

  return <DesktopAnalyzer {...analyzer} publicScamOfTheDay={publicScamOfTheDay} />
}
