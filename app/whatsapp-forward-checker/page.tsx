import type { Metadata } from 'next'
import CampaignLandingPage from '@/components/campaign/CampaignLandingPage'

export const metadata: Metadata = {
  title: 'WhatsApp Forward Checker | Check Fake Messages Before Sharing | DAM',
  description:
    'Check risky WhatsApp forwards, viral claims, scams, health rumors, and breaking-news messages before sharing them.',
}

export default function Page() {
  return (
    <CampaignLandingPage
      activeHref="/whatsapp-forward-checker"
      pageKey="whatsapp-forward-checker"
      telemetryEventName="campaign_whatsapp_checker_cta_click"
      eyebrow="Use case / WhatsApp forward checker"
      title="Check a WhatsApp forward before sharing it."
      subtitle="DAM helps you analyze risky forwards, viral claims, scam warnings, health rumors, and breaking-news messages before you pass them on."
      ctaLabel="Check a WhatsApp forward"
      heroPanelTitle="What to paste"
      heroPanelItems={[
        'Viral forwards and copy-paste messages',
        'Breaking-news screenshots or text',
        'Health and treatment claims',
        'Rumors framed as urgent warnings',
      ]}
      commonPatternsTitle="What you can paste"
      commonPatterns={[
        'Viral forwards',
        'Breaking news screenshots or text',
        'Health claims',
        'Political rumors',
        'Scam warnings',
        'Community messages',
      ]}
      riskTitle="Why forwarding without checking is risky"
      riskBody="A forward can look harmless because it came from someone you know. That trust shortcut is exactly why false alerts, scams, and rumors spread faster than corrections."
      checksTitle="How DAM gives a verdict"
      checks={[
        'Claim wording and implied certainty',
        'Evidence gaps and missing attribution',
        'Contradiction or rumor signals',
        'Distribution risk before sharing',
      ]}
      ctaTitle="Read it once. Verify it once. Share it only if it holds."
      ctaBody="Use the same DAM analyzer to inspect the forward before it leaves your chat history and becomes someone else’s problem."
    />
  )
}
