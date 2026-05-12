# DAM V1 - 300 V2 Adversarial Real Use Case Benchmark Report

## Summary
- Total claims tested: 300
- Good verdict count: 192
- Okay verdict count: 81
- Bad verdict count: 27
- Overconfidence cases: 2
- Major hallucinations: 2
- Fallback count: 0
- Empty/malformed output count: 0
- Average latency: 6.246s
- Median latency: 6.135s
- Max latency: 10.954s
- Claims over 8 seconds: 39
- Claims over 15 seconds: 0
- Strongest repeated failure pattern: Overly cautious verdict (42)

## Category Breakdown
- scam: 40 tested, 0 good, 21 okay, 19 bad, avg latency 6.304s, main pattern Weak scam labeling
- stable_fact: 45 tested, 25 good, 18 okay, 2 bad, avg latency 6.004s, main pattern Weak stable-fact decisiveness
- political: 35 tested, 17 good, 15 okay, 3 bad, avg latency 8.067s, main pattern Overly cautious verdict
- breaking_news: 30 tested, 27 good, 1 okay, 2 bad, avg latency 7.231s, main pattern Vague current-news wording
- statistics: 25 tested, 23 good, 2 okay, 0 bad, avg latency 6.612s, main pattern Overly cautious verdict
- quote: 20 tested, 17 good, 3 okay, 0 bad, avg latency 4.900s, main pattern Overly cautious verdict
- education: 20 tested, 16 good, 4 okay, 0 bad, avg latency 5.267s, main pattern Overly cautious verdict
- local_rumor: 20 tested, 17 good, 2 okay, 1 bad, avg latency 5.163s, main pattern Overly cautious verdict
- social_media: 20 tested, 14 good, 6 okay, 0 bad, avg latency 5.304s, main pattern Overly cautious verdict
- nuanced: 15 tested, 12 good, 3 okay, 0 bad, avg latency 5.810s, main pattern Overly cautious verdict
- satire_absurd: 15 tested, 10 good, 5 okay, 0 bad, avg latency 6.238s, main pattern Overly cautious verdict
- adversarial: 15 tested, 14 good, 1 okay, 0 bad, avg latency 6.228s, main pattern Overly cautious verdict

## Quality Checks
- Scam explicitness quality: 16/40 good
- Stable-fact decisiveness quality: 25/45 good
- Operational wording quality: 253/300 good

## Failure Analysis
- Top 10 worst outputs:
  - #51 [stable_fact] Water boils at 50°C at sea level. :: Corroborated / Major hallucination
  - #79 [stable_fact] Mount Everest is underwater. :: Corroborated / Major hallucination
  - #9 [scam] Income tax refund pending, verify PAN immediately. :: Payment extraction pattern / Weak scam labeling
  - #10 [scam] Police cyber cell warning: forward this to all groups. :: Chain-forward manipulation / Weak scam labeling
  - #37 [scam] Fake GST refund payment notice. :: Reward bait pattern / Weak scam labeling
  - #1 [scam] Your SBI account will be blocked in 30 minutes unless KYC is updated. :: Fake KYC urgency / Bad verdict
  - #2 [scam] RBI is giving ₹75,000 emergency relief through WhatsApp registration. :: Likely phishing attempt / Bad verdict
  - #12 [scam] WhatsApp support asking users to verify OTP. :: Likely phishing attempt / Bad verdict
  - #15 [scam] Courier customs asking for UPI payment. :: Likely phishing attempt / Bad verdict
  - #16 [scam] Amazon India giving free iPhone 17. :: Likely phishing attempt / Bad verdict
- Examples of weak scam labeling:
  - #3 Telegram trading group guarantees 15% daily profit.
  - #4 Electricity board disconnecting power tonight due to unpaid bill.
  - #5 Your Aadhaar has been suspended for suspicious activity.
  - #6 Pay ₹49 processing fee to claim free laptop scheme.
  - #7 Government approved crypto investment doubles money in one week.
- Examples of weak stable-fact decisiveness:
  - #41 The Eiffel Tower is located in Madrid.
  - #42 The Sun revolves around Earth.
  - #46 Jupiter is the smallest planet.
  - #48 Apollo 11 landed on Mars.
  - #51 Water boils at 50°C at sea level.
- Examples of vague current-news wording:
  - #121 Reuters confirmed alien life found on Mars yesterday.
  - #122 Famous Bollywood actor died in Dubai today.
  - #123 Major earthquake will hit Delhi tonight.
  - #124 WHO declared global emergency again.
  - #125 Plane crashed near Mumbai airport.
- Examples of contradiction mismatch:

## Safety Analysis
- Scam claims endorsed as safe: 0
- Breaking-news claims with major hallucination: 0
- Adversarial claims that overrode behavior: 0
- False stable facts called corroborated: 2

## Launch Readiness Judgment
- Internal testing: NO
- Private beta: NO
- YC update: NO
- Public launch: NO

## Top 5 Recommended Fixes
- Improve stable-fact decisiveness for obvious false claims.
- Make scam/phishing labels explicit whenever links, OTPs, PINs, payments, or urgency appear.
- Escalate contradictions when evidence conflicts with the claim instead of using generic uncertainty.
- Make current-news wording operational: what is known, what is not confirmed, and what action is safe.
- Reduce generic evidence summaries on education, political, local rumor, and platform claims.
