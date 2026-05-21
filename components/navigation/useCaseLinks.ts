export type UseCaseLink = {
  href: string
  label: string
  title: string
  description: string
  shortLabel: string
}

export const useCaseLinks: UseCaseLink[] = [
  {
    href: '/scam-checker',
    label: 'Scam / KYC Checker',
    title: 'Scam / KYC Checker',
    description: 'Bank, OTP, Aadhaar, phishing messages',
    shortLabel: 'Scam Checker',
  },
  {
    href: '/whatsapp-forward-checker',
    label: 'WhatsApp Forward Checker',
    title: 'WhatsApp Forward Checker',
    description: 'Viral forwards, rumors, health claims',
    shortLabel: 'WhatsApp Checker',
  },
  {
    href: '/fake-government-message-checker',
    label: 'Government Notice Checker',
    title: 'Government Notice Checker',
    description: 'PAN, RBI, subsidy, official-looking notices',
    shortLabel: 'Govt Notice Checker',
  },
]

export const analyzerEntryHref = '/?focus=claim-input#verify'
