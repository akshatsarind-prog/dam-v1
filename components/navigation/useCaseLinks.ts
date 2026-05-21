export type UseCaseLink = {
  href: string
  label: string
  shortLabel: string
}

export const useCaseLinks: UseCaseLink[] = [
  {
    href: '/scam-checker',
    label: 'Scam / KYC Checker',
    shortLabel: 'Scam Checker',
  },
  {
    href: '/whatsapp-forward-checker',
    label: 'WhatsApp Forward Checker',
    shortLabel: 'WhatsApp Checker',
  },
  {
    href: '/fake-government-message-checker',
    label: 'Government Notice Checker',
    shortLabel: 'Govt Notice Checker',
  },
]

export const analyzerEntryHref = '/?focus=claim-input#verify'
