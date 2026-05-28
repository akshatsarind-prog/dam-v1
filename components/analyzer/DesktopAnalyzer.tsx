import type { AnalyzeClaimViewModel } from './useAnalyzeClaim'
import SharedAnalyzerLayout from './SharedAnalyzerLayout'
import type { PublicScamOfTheDay } from '@/lib/scam-of-the-day/publicScamOfTheDay'

type DesktopAnalyzerProps = AnalyzeClaimViewModel & {
  publicScamOfTheDay: PublicScamOfTheDay | null
}

export default function DesktopAnalyzer(props: DesktopAnalyzerProps) {
  return <SharedAnalyzerLayout {...props} />
}
