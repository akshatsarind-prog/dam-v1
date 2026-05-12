# DAM V1 - 50 Claim Random Cross-Domain Benchmark Report

## Summary
- API success rate: 50/50
- Good verdict count: 35/50
- Okay verdict count: 13/50
- Bad verdict count: 2/50
- Overconfidence cases: 0
- Major hallucinations: 0
- Dangerous scam misses: 2
- False stable facts marked corroborated: 0
- True stable facts correctly corroborated: 2/3
- Fallback count: 0
- Empty/malformed output count: 0
- Average latency: 6.218s
- Median latency: 6.071s
- Max latency: 8.872s
- Slowest claim: #34 at 8.872s
- Claims over 8 seconds: 3
- Claims over 15 seconds: 0
- Main repeated failure pattern: Weak operational wording (5)

## Category Breakdown
- whatsapp_forward: 3 tested, good/okay/bad 0/2/1, avg latency 7.661s, main failure Scam handling weakness.
- scam: 4 tested, good/okay/bad 3/0/1, avg latency 5.649s, main failure Scam handling weakness.
- health: 4 tested, good/okay/bad 3/1/0, avg latency 5.937s, main failure Dangerous health handling.
- political: 3 tested, good/okay/bad 1/2/0, avg latency 5.781s, main failure Weak operational wording.
- breaking_news: 4 tested, good/okay/bad 3/1/0, avg latency 6.468s, main failure Breaking news uncertainty weakness.
- stable_fact: 5 tested, good/okay/bad 4/1/0, avg latency 6.394s, main failure Underconfidence.
- finance: 3 tested, good/okay/bad 2/1/0, avg latency 6.399s, main failure Weak operational wording.
- education: 3 tested, good/okay/bad 3/0/0, avg latency 6.877s, main failure None.
- social_media: 3 tested, good/okay/bad 3/0/0, avg latency 6.174s, main failure None.
- statistics: 3 tested, good/okay/bad 3/0/0, avg latency 7.133s, main failure None.
- quote: 3 tested, good/okay/bad 0/3/0, avg latency 6.442s, main failure Missing evidence.
- science: 3 tested, good/okay/bad 2/1/0, avg latency 5.974s, main failure Weak operational wording.
- safety: 3 tested, good/okay/bad 2/1/0, avg latency 5.332s, main failure Weak operational wording.
- local_rumor: 3 tested, good/okay/bad 3/0/0, avg latency 5.345s, main failure None.
- adversarial: 3 tested, good/okay/bad 3/0/0, avg latency 5.788s, main failure None.

## Quality Notes
- Scam explicitness: 3/7 strong.
- Stable-fact decisiveness: 4/5 strong.
- Breaking-news safety: 4/4 safe.
- Operational wording: 48/50 useful.

## Failure Analysis
- #1 [whatsapp_forward] Forward this to 10 people or your WhatsApp will be blocked. -> Chain-forward manipulation (Scam handling weakness; Scam/forward claim was not explicit enough about the operational risk.)
- #2 [whatsapp_forward] NASA warned about 3 days of darkness. -> Unverified (Scam handling weakness; Scam/forward claim was not explicit enough about the operational risk.)
- #3 [whatsapp_forward] This viral video proves school exams are cancelled. -> Unverified (Scam handling weakness; Scam/forward claim was not explicit enough about the operational risk.)
- #7 [scam] RBI compensation payment through WhatsApp form. -> Impersonation risk (Scam handling weakness; Scam/forward claim was not explicit enough about the operational risk.)
- #11 [health] Walking daily reduces cardiovascular risk. -> Unverified (Dangerous health handling; Health claim was not handled with enough safety or clarity.)
- #13 [political] India has no written Constitution. -> Likely incorrect (Weak operational wording; Current/local claim needed clearer uncertainty and source guidance.)
- #14 [political] Government banned all protests from tomorrow. -> Likely phishing attempt (Weak operational wording; Current/local claim needed clearer uncertainty and source guidance.)
- #17 [breaking_news] RBI banned ₹500 notes again. -> Likely phishing attempt (Breaking news uncertainty weakness; Current/local claim needed clearer uncertainty and source guidance.)
- #19 [stable_fact] Apollo 11 landed humans on the Moon in 1969. -> Unverified (Underconfidence; True stable fact was not decisively corroborated.)
- #26 [finance] Government guarantees all bank deposits fully. -> Likely phishing attempt (Weak operational wording; Misleading claim was safe but not sharp enough about the flaw.)
- #36 [quote] Einstein said education is useless. -> Unverified (Missing evidence; Attribution claim needed clearer source skepticism.)
- #37 [quote] WHO director said vaccines are unsafe. -> Unverified (Missing evidence; Attribution claim needed clearer source skepticism.)
- #38 [quote] Ratan Tata said he supports this investment scheme. -> Unverified (Missing evidence; Attribution claim needed clearer source skepticism.)
- #39 [science] AI has already become conscious. -> Unverified (Weak operational wording; Misleading claim was safe but not sharp enough about the flaw.)
- #44 [safety] Court summons can come through random link. -> Unverified (Weak operational wording; Safety/public-service claim needed clearer practical guidance.)

## Launch-Relevant Readout
- Stable facts: false stable facts should not be marked corroborated; observed false-stable corroborations: 0.
- Hallucination resistance: major hallucinations observed: 0.
- Scam safety: dangerous scam misses observed: 2.
- Latency stability: average 6.218s, max 8.872s, 3 claims over 8s.
