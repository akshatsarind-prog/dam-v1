export type ThisCouldBeYouStory = {
  id: string
  category: string
  title: string
  lines: string[]
  consequence: string
}

export const thisCouldBeYouStories: ThisCouldBeYouStory[] = [
  {
    id: 'bank-alert-joe',
    category: 'BANK SCAM',
    title: 'Joe followed the alert.',
    lines: [
      'Joe received a "bank verification" message.',
      'His colleagues warned him it looked suspicious.',
      'He followed the instructions anyway.',
    ],
    consequence: 'By evening, his account was compromised.',
  },
  {
    id: 'forward-priya',
    category: 'WHATSAPP FORWARD',
    title: 'Priya sent it before reading past the headline.',
    lines: [
      'A family-group forward claimed a local school had shut down overnight.',
      'She shared it into three parent chats before checking the notice.',
      'The school opened on time the next morning.',
    ],
    consequence: 'She spent the day apologizing to anxious parents.',
  },
  {
    id: 'internship-aarav',
    category: 'FAKE INTERNSHIP',
    title: 'Aarav paid the onboarding fee.',
    lines: [
      'The internship offer arrived with a polished logo and a short deadline.',
      'It asked for a refundable training deposit.',
      'He sent the money to avoid losing the role.',
    ],
    consequence: 'The recruiter number stopped responding within an hour.',
  },
  {
    id: 'health-claim-nisha',
    category: 'HEALTH CLAIM',
    title: 'Nisha trusted the reel.',
    lines: [
      'A short video promised a home remedy that could replace her prescribed tablets.',
      'The comments made it sound routine and harmless.',
      'She paused her treatment without speaking to a doctor.',
    ],
    consequence: 'Her symptoms returned before the week was over.',
  },
  {
    id: 'scheme-ramesh',
    category: 'GOVERNMENT SCHEME',
    title: 'Ramesh believed the deadline banner.',
    lines: [
      'A poster in a group chat claimed a new cash-benefit scheme closed at midnight.',
      'It linked to an unfamiliar registration page.',
      'He entered his ID details in a rush.',
    ],
    consequence: 'He later realized the site was not an official government portal.',
  },
  {
    id: 'kyc-alert-anita',
    category: 'KYC ALERT',
    title: 'Anita called the number on the message.',
    lines: [
      'The SMS said her wallet would be frozen unless KYC was updated immediately.',
      'The caller sounded calm, scripted, and prepared.',
      'She shared her OTP to "finish verification."',
    ],
    consequence: 'The fraud happened while she was still on the call.',
  },
  {
    id: 'crypto-fraud-dev',
    category: 'CRYPTO FRAUD',
    title: 'Dev chased the guaranteed return.',
    lines: [
      'A friend-of-a-friend sent him a private crypto group invite.',
      'The screenshots showed daily profits and zero losses.',
      'He transferred a small amount just to test it.',
    ],
    consequence: 'The platform demanded more money before any withdrawal was possible.',
  },
  {
    id: 'school-group-meera',
    category: 'SCHOOL GROUP',
    title: 'Meera forwarded the screenshot.',
    lines: [
      'Someone posted a blurred fee-circular screenshot in the school group.',
      'It looked urgent and expensive.',
      'She sent it to other parents before confirming it with the school office.',
    ],
    consequence: 'The screenshot turned out to be an old notice taken out of context.',
  },
  {
    id: 'family-group-sanjay',
    category: 'FAMILY GROUP',
    title: 'Sanjay wanted to be helpful.',
    lines: [
      'A relative shared a message about a dangerous product recall.',
      'He pushed it into every family subgroup within minutes.',
      'Nobody noticed the message was from years earlier.',
    ],
    consequence: 'His warning created panic over a product that was still on shelves legitimately.',
  },
  {
    id: 'breaking-news-asma',
    category: 'BREAKING NEWS',
    title: 'Asma posted before the facts settled.',
    lines: [
      'A fast-moving post claimed a major fire had shut part of the city.',
      'The image looked real enough to believe.',
      'She reposted it before any local authority confirmed the incident.',
    ],
    consequence: 'Friends reached out in alarm about an event that had not happened there.',
  },
  {
    id: 'bank-scam-karan',
    category: 'BANK SCAM',
    title: 'Karan trusted the "executive."',
    lines: [
      'The caller knew his name and the last four digits of his card.',
      'That made the request feel official.',
      'He installed the remote-access app they asked for.',
    ],
    consequence: 'He watched money move out of his account in real time.',
  },
  {
    id: 'whatsapp-forward-leena',
    category: 'WHATSAPP FORWARD',
    title: 'Leena forwarded the warning voice note.',
    lines: [
      'The audio claimed a local market would be sealed the next morning.',
      'It sounded personal, emotional, and immediate.',
      'She believed the urgency and passed it along.',
    ],
    consequence: 'Shop owners lost a morning responding to a rumor.',
  },
  {
    id: 'fake-internship-zoya',
    category: 'FAKE INTERNSHIP',
    title: 'Zoya sent her documents too early.',
    lines: [
      'The offer letter looked neat and the email domain was close to a real brand.',
      'It asked for ID proof before the interview slot could be locked.',
      'She shared everything to stay in the process.',
    ],
    consequence: 'Her information was handed over to strangers before any employer existed.',
  },
  {
    id: 'health-claim-vikram',
    category: 'HEALTH CLAIM',
    title: 'Vikram repeated the claim at home.',
    lines: [
      'A forwarded message said a common kitchen ingredient could "flush toxins" in one night.',
      'He treated it like useful advice, not medical advice.',
      'The message was shared again at dinner as if it were settled fact.',
    ],
    consequence: 'The bad information spread faster than the correction ever did.',
  },
  {
    id: 'gov-scheme-farah',
    category: 'GOVERNMENT SCHEME',
    title: 'Farah clicked because the page looked familiar.',
    lines: [
      'The fake portal copied the colors and language of a real public-service site.',
      'It asked for account details to "release benefits."',
      'She assumed the design meant it was legitimate.',
    ],
    consequence: 'The form captured enough information to become a second problem later.',
  },
  {
    id: 'kyc-alert-imran',
    category: 'KYC ALERT',
    title: 'Imran ignored the wording and reacted to the threat.',
    lines: [
      'The message said his salary account would be blocked before lunch.',
      'The link was shortened and impossible to identify at a glance.',
      'He tapped first and questioned it second.',
    ],
    consequence: 'His morning turned into damage control over a message that was never from his bank.',
  },
]
