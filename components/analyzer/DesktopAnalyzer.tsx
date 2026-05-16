import type { AnalyzeClaimViewModel } from './useAnalyzeClaim'
import SharedAnalyzerLayout from './SharedAnalyzerLayout'

type DesktopAnalyzerProps = AnalyzeClaimViewModel

export default function DesktopAnalyzer(props: DesktopAnalyzerProps) {
  return <SharedAnalyzerLayout {...props} />
}
