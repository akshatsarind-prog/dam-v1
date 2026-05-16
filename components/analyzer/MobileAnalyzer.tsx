import type { AnalyzeClaimViewModel } from './useAnalyzeClaim'
import SharedAnalyzerLayout from './SharedAnalyzerLayout'

type MobileAnalyzerProps = AnalyzeClaimViewModel

export default function MobileAnalyzer(props: MobileAnalyzerProps) {
  return <SharedAnalyzerLayout {...props} isMobile />
}
