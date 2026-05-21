import type { Metadata } from 'next'
import CampaignLandingPage from '@/components/campaign/CampaignLandingPage'

export const metadata: Metadata = {
  title: 'Fake Government Notice Checker | Aadhaar, PAN, RBI & Subsidy Message Check | DAM',
  description:
    'Check suspicious government scheme, Aadhaar, PAN, RBI, subsidy, and official-looking messages before trusting them.',
}

export default function Page() {
  return (
    <CampaignLandingPage
      activeHref="/fake-government-message-checker"
      pageKey="fake-government-message-checker"
      telemetryEventName="campaign_govt_checker_cta_click"
      eyebrow="Use case / Government notice checker"
      title="Got a government scheme, Aadhaar, PAN, RBI, or subsidy message?"
      subtitle="Check official-looking messages before trusting them. DAM looks for urgency, impersonation, suspicious claims, and missing evidence."
      ctaLabel="Check government notice"
      heroPanelTitle="Official-looking warning signs"
      heroPanelItems={[
        'Threats tied to Aadhaar, PAN, or bank access',
        'RBI or government branding without proof',
        'Refund, benefit, or subsidy claims',
        'Court, police, or tax pressure language',
      ]}
      commonPatternsTitle="Common fake notice patterns"
      commonPatterns={[
        'Subsidy claims',
        'Aadhaar or PAN warnings',
        'RBI or bank notices',
        'Tax or refund messages',
        'Police or court-style threats',
      ]}
      riskTitle="Why official-looking messages are dangerous"
      riskBody="They borrow the tone and formatting of real institutions, then pair it with consequences that feel immediate. People act fast because the message sounds administrative, final, and expensive to ignore."
      checksTitle="What DAM checks"
      checks={[
        'Authority and impersonation language',
        'Urgency, penalties, and forced next steps',
        'Evidence quality and missing verification',
        'Risky links, requests, or instructions',
      ]}
      ctaTitle="Treat official-looking messages like claims, not facts."
      ctaBody="Open the existing analyzer, paste the notice exactly as it appeared, and let DAM review the risk signals before you respond."
    />
  )
}
