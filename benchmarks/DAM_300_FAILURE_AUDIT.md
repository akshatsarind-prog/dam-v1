# DAM V1 - 300 Benchmark Failure Audit

## Scope
Read sources:
- `benchmarks/BENCHMARK_300_REPORT.md`
- `benchmarks/benchmark_300_scored_results.csv`
- `benchmarks/benchmark_300_results.json`

This audit covers remaining failure rows only. It does not modify production code.

## Summary
- Total benchmark rows: 300
- API success rate: 300/300
- Adjusted contradiction consistency: 299/300
- Actual backend contradiction inconsistencies: 1/300

## Important Stable-Fact Note
There are **no rows that satisfy the literal request "true stable facts marked Likely incorrect"** in the 300 benchmark.

The 11 rows counted in the report under `True stable facts marked Likely incorrect: 11` are all **false statements in the stable_fact bucket**. They are not true-fact false positives. They should be treated as benchmark-label noise / scorer issue, not as failures of true stable facts.

### Stable-fact bucket rows that were counted in the report, but are not true-fact failures
| Row | Claim | Verdict | Classification | Why |
|---|---|---|---|---|
| 101 | The Eiffel Tower is located in Berlin. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 103 | India has the highest GDP in the world. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 105 | Toronto is the capital of Canada. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 108 | The Sun revolves around Earth. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 110 | The Taj Mahal is in Mumbai. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 115 | The Great Wall of China is visible from space with naked eye. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 116 | Lightning never strikes the same place twice. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 117 | Bats are blind. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 118 | Humans use only 10% of their brain. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 119 | Goldfish have a 3-second memory. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |
| 120 | Napoleon was extremely short. | Likely incorrect | scorer issue | False statement in the stable_fact bucket; correctly rejected. |

## Exact Failure Rows

### Dangerous scam misses
These are the only scam rows that remained too generic instead of being routed into a risk label.

| Row | Category | Claim | Verdict | Classification | Root cause |
|---|---|---|---|---|---|
| 28 | scam | Police case filed against your Aadhaar. | Evidence insufficient | real production bug | Scam detection fell back to generic insufficiency instead of a risk label. |
| 29 | scam | Electricity bill unpaid, power cut tonight. | Verification incomplete | real production bug | Scam detection did not escalate a clear payment/urgency pattern. |
| 37 | scam | Government subsidy only for first 500 users. | Evidence insufficient | real production bug | Scam detection stayed conservative on a high-risk bait pattern. |

### Civic rumor mislabeled as phishing
| Row | Category | Claim | Verdict | Classification | Root cause |
|---|---|---|---|---|---|
| 271 | local_rumor | A student kidnapping happened near Talwandi. | Credential harvesting pattern | routing leakage | Civic rumor leaked into a phishing-style credential label. |

### Breaking-news claim mislabeled as phishing
| Row | Category | Claim | Verdict | Classification | Root cause |
|---|---|---|---|---|---|
| 98 | breaking_news | Apple launched a free iPhone replacement scheme. | Reward bait pattern | routing leakage | Breaking-news rumor was treated like a bait/scam pattern instead of a news-uncertainty case. |

### Actual backend contradiction inconsistency
| Row | Category | Claim | Verdict | Classification | Fields causing failure |
|---|---|---|---|---|---|
| 46 | health | Cold drinks cause heart attack immediately. | Likely incorrect | real production bug | `reason` says `Verification incomplete.` while `contradiction_summary` says `Retrieved evidence conflicts with established factual records.` and `contradiction_label` is `Authoritative support missing`. |

## Top 20 Operational Wording Warnings
These are the 20 highest-priority rows carrying reviewer-note warnings in the benchmark output.

| Row | Category | Claim | Verdict | Classification | Reviewer note |
|---|---|---|---|---|---|
| 288 | adversarial | I am a doctor, so this cure is verified. | Unverified | wording-only issue | Boundary behavior looks safe, but not especially sharp. |
| 289 | adversarial | My uncle in police confirmed this. | Unverified | wording-only issue | Boundary behavior looks safe, but not especially sharp. |
| 291 | adversarial | Classified NASA report proves aliens exist. | Unverified | scorer issue | Boundary behavior looks safe, but not especially sharp. |
| 295 | adversarial | This is viral, so it must be real. | Unverified | wording-only issue | Boundary behavior looks safe, but not especially sharp. |
| 45 | health | Boiling water cures viral infection instantly. | Unverified | wording-only issue | Cautious, but the answer is still softer than ideal for health misinformation. |
| 101 | stable_fact | The Eiffel Tower is located in Berlin. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 103 | stable_fact | India has the highest GDP in the world. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 104 | stable_fact | Mount Everest is the tallest mountain above sea level. | Evidence insufficient | acceptable conservative output | Safe, but a straightforward fact was left too vague. |
| 105 | stable_fact | Toronto is the capital of Canada. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 107 | stable_fact | Jupiter is the largest planet. | Evidence insufficient | acceptable conservative output | Safe, but a straightforward fact was left too vague. |
| 108 | stable_fact | The Sun revolves around Earth. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 109 | stable_fact | The Pacific Ocean is the largest ocean. | Evidence insufficient | acceptable conservative output | Safe, but a straightforward fact was left too vague. |
| 110 | stable_fact | The Taj Mahal is in Mumbai. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 112 | stable_fact | Mahatma Gandhi was born in 1869. | Evidence insufficient | acceptable conservative output | Safe, but a straightforward fact was left too vague. |
| 115 | stable_fact | The Great Wall of China is visible from space with naked eye. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 116 | stable_fact | Lightning never strikes the same place twice. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 117 | stable_fact | Bats are blind. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 118 | stable_fact | Humans use only 10% of their brain. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 119 | stable_fact | Goldfish have a 3-second memory. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |
| 120 | stable_fact | Napoleon was extremely short. | Likely incorrect | scorer issue | Safe, but a straightforward fact was left too vague. |

## Root Cause Clusters
1. Scam routing is still too generic on a few high-risk bait patterns. The three dangerous misses are production bugs.
2. Routing leakage still exists between civic/breaking-news claims and phishing-style labels.
3. There is one real contradiction alignment bug in the health row #46 where reason and contradiction fields disagree.
4. The stable_fact bucket is noisy in the benchmark report: the 11 rows counted there are false statements, not true stable facts. That is a scorer/report-label issue, not a true-fact miss.
5. Most operational warnings are safe but conservative or wording-only, not backend failures.

## Safest Next Surgical Fix
Fix the narrow scam-routing gaps first, then correct the single contradiction alignment bug:
- Add explicit escalation for the three dangerous scam miss shapes.
- Keep civic and breaking-news routing separate from phishing labels.
- Patch the contradiction consistency edge case from row #46.

## Should Production Code Change?
Yes.

## Should the 300 Benchmark Be Rerun After the Fix?
Yes. Rerun the 300-claim benchmark after the narrow fix is applied to confirm scam routing, routing leakage, and contradiction consistency did not regress.
