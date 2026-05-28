import AnalyzerShell from '@/components/analyzer/AnalyzerShell'
import { getPublicScamOfTheDay } from '@/lib/scam-of-the-day/publicScamOfTheDay'

export default async function Page() {
  const publicScamOfTheDay = await getPublicScamOfTheDay()

  return <AnalyzerShell publicScamOfTheDay={publicScamOfTheDay} />
}
