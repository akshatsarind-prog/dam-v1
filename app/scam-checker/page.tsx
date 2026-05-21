import type { Metadata } from 'next'
import CampaignLandingPage from '@/components/campaign/CampaignLandingPage'

export const metadata: Metadata = {
  title: 'Scam Message Checker | Check KYC, OTP, Bank & Aadhaar Messages | DAM',
  description:
    'Paste suspicious bank, KYC, OTP, Aadhaar, or phishing messages into DAM and check scam risk signals before clicking.',
}

export default function Page() {
  return (
    <CampaignLandingPage
      activeHref="/scam-checker"
      pageKey="scam-checker"
      telemetryEventName="campaign_scam_checker_cta_click"
      eyebrow="Use case / Scam message checker"
      title="Got a suspicious bank, KYC, OTP, or Aadhaar message?"
      subtitle="Paste it into DAM before clicking. DAM checks scam urgency, impersonation, phishing signals, and risky instructions in seconds."
      ctaLabel="Check suspicious message"
      heroPanelTitle="Common scam signals"
      heroPanelItems={[
        'Urgent KYC or account-freeze warnings',
        'OTP or verification-code requests',
        'Aadhaar, PAN, or bank-linking threats',
        'Reward, refund, or subsidy bait',
      ]}
      commonPatternsTitle="Common messages DAM can check"
      commonPatterns={[
        'KYC update warnings',
        'Bank account blocked messages',
        'OTP requests',
        'Aadhaar or PAN verification messages',
        'Reward or subsidy scams',
      ]}
      riskTitle="Why these scams work"
      riskBody="These messages win by compressing your decision window. They impersonate trusted institutions, create fear of loss, and push you into clicking or replying before you verify anything."
      checksTitle="How DAM checks the message"
      checks={[
        'Urgency and fear language',
        'Impersonation or authority cues',
        'Phishing or risky instruction patterns',
        'Missing evidence or unverifiable claims',
      ]}
      ctaTitle="Check the message before it gets your data."
      ctaBody="Send the suspicious text into DAM first. The analyzer stays the same; this page only routes you into the live input flow."
    />
  )
}
