import type { AnalyzeClaimViewModel } from './useAnalyzeClaim'
import SharedAnalyzerLayout from './SharedAnalyzerLayout'
import type { PublicScamOfTheDay } from '@/lib/scam-of-the-day/publicScamOfTheDay'

type MobileAnalyzerProps = AnalyzeClaimViewModel & {
  publicScamOfTheDay: PublicScamOfTheDay | null
}

export default function MobileAnalyzer(props: MobileAnalyzerProps) {
  return <SharedAnalyzerLayout {...props} isMobile />
}
