# DAM V1 Contradiction Consistency Audit

## Scope
- Source artifacts reviewed:
  - `benchmarks/benchmark_50_results.csv`
  - `benchmarks/benchmark_50_scored.csv`
  - `benchmarks/BENCHMARK_50_REPORT.md`
- This audit is read-only. No production code was changed.

## Bottom Line
- Benchmark contradiction consistency: `21/50`
- Explicitly flagged suspicious rows in the benchmark report: `12`
- Manual classification of those 12 rows:
  - `5` acceptable conservative behaviors
  - `4` scorer-sensitive wording or label issues
  - `3` actual backend inconsistencies

## Root Cause Summary
The contradiction-consistency loss is mostly not a single hard backend bug. It is a mix of:

1. Conservative outputs that the benchmark appears to score too strictly.
2. Stale or loosely aligned nested metadata in a few rows, where top-level verdicts are coherent but `reason`, `contradiction_summary`, or `corroborationLevel` are not perfectly synchronized.
3. One or two rows where the final contradiction wording is plainly stronger than the evidence language.

The main repeated pattern is `Underconfident stable fact`, which indicates the pipeline is staying safe on known facts but is not satisfying the benchmark's decisiveness expectation.

## Row-by-Row Audit

| Row | Claim | Classification | Why it failed or looked suspicious | Exact fields involved |
| --- | --- | --- | --- | --- |
| 1 | Humans landed on the Moon in 1969. | Acceptable conservative behavior | The model chose `Evidence insufficient` instead of corroborating a common fact, but the contradiction fields stayed low and internally consistent. | `verdict=Evidence insufficient`, `contradiction_level=Low`, `contradiction_summary=No direct contradiction was identified in retrieved evidence.`, `corroborationLevel.label=Insufficient verification` |
| 2 | Mount Everest is the tallest mountain above sea level. | Acceptable conservative behavior | Same underconfident stable-fact pattern as row 1. Safe, but not decisive enough for the benchmark. | `verdict=Evidence insufficient`, `contradiction_level=Low`, `contradiction_summary=No direct contradiction was identified in retrieved evidence.` |
| 7 | Water boils at 100C at standard atmospheric pressure. | Acceptable conservative behavior | Another safe stable-fact downgrade. No direct contradiction was claimed. | `verdict=Evidence insufficient`, `contradiction_level=Low`, `contradiction_summary=No direct contradiction was identified in retrieved evidence.` |
| 19 | Drinking hot water instantly kills all viruses in the throat. | Wording-only inconsistency | The rejection is safe, but the explanation is thin and the benchmark marked it as weak operational wording rather than a contradiction error. | `verdict=Evidence insufficient`, `reason=Retrieved sources do not provide direct support for the claim.`, `failure_type=Weak operational wording` |
| 22 | Walking daily reduces cardiovascular risk. | Acceptable conservative behavior | Safe underconfidence on a common fact. Not a contradiction mismatch. | `verdict=Evidence insufficient`, `contradiction_level=Low`, `contradiction_summary=No direct contradiction was identified in retrieved evidence.` |
| 24 | The human body has exactly 206 bones in adulthood. | Acceptable conservative behavior | Safe underconfidence, same pattern as rows 1, 2, and 7. | `verdict=Evidence insufficient`, `contradiction_level=Low`, `contradiction_summary=No direct contradiction was identified in retrieved evidence.` |
| 25 | Dettol can safely be consumed in small amounts to prevent infection. | Actual backend inconsistency | The top-level verdict is a dangerous-claim label, but the nested fields conflict: the reason says the retrieved evidence directly supports the claim, while the contradiction summary says no authoritative support exists. | `verdict=Dangerous unsupported claim`, `reason=Retrieved evidence directly supports the claim.`, `contradiction_level=Moderate`, `contradiction_summary=Retrieved evidence does not provide authoritative support for this high-risk claim.`, `corroborationLevel.label=None` |
| 28 | NASA announced the Moon is hollow during a live conference today. | Acceptable conservative behavior | The model stayed cautious on breaking news. The benchmark treated that caution as a weakness, not a contradiction. | `verdict=Verification incomplete`, `contradiction_level=Moderate`, `contradiction_summary=No authoritative reporting currently confirms this event.` |
| 30 | A famous Bollywood actor died in a helicopter crash this morning. | Acceptable conservative behavior | Same pattern as row 28. The output is conservative and coherent. | `verdict=Verification incomplete`, `contradiction_level=Moderate`, `contradiction_summary=No authoritative reporting currently confirms this event.` |
| 31 | Apple announced permanent free iPhones for students worldwide. | Scorer-sensitive wording issue | The scam-like framing is coherent, but the benchmark seems to penalize it as a breaking-news uncertainty case. | `verdict=Reward bait pattern`, `contradiction_level=Low`, `contradiction_summary=Prize and reward promises indicate bait behavior.`, `failure_type=Breaking-news uncertainty weakness` |
| 37 | 100% of people who drank water eventually died. | Actual backend inconsistency | The verdict is `Likely incorrect`, but the reason says `Verification incomplete`. The contradiction fields stay on the strong side, so the row reads as mixed and stale. | `verdict=Likely incorrect`, `reason=Verification incomplete.`, `contradiction_level=Moderate`, `contradiction_summary=Retrieved evidence conflicts with established factual records.` |
| 40 | Warren Buffett said Bitcoin will replace all currencies by 2030. | Acceptable conservative behavior | The model chose `Unverified` with low contradiction, which is coherent for an unsupported quote claim. | `verdict=Unverified`, `contradiction_level=Low`, `contradiction_summary=No direct contradiction was identified in retrieved evidence.` |
| 43 | Wikipedia cannot be trusted because anyone can edit it. | Scorer-sensitive wording issue | The model gave a nuanced `Likely Reliable` answer with low contradiction. The benchmark appears to want different wording, not a contradiction change. | `verdict=Likely Reliable`, `contradiction_level=None`, `contradiction_summary=No direct contradiction was identified in retrieved evidence.`, `failure_type=Weak operational wording` |
| 45 | News channels intentionally spread misinformation for profit. | Actual backend inconsistency | The reason says the framing is broader than the evidence, but the contradiction summary jumps to high conflict. That is a real internal mismatch. | `verdict=Likely incorrect`, `reason=Evidence supports part of the claim, but the framing is broader than the evidence.`, `contradiction_level=High`, `contradiction_summary=Retrieved evidence conflicts with established factual records.` |
| 46 | Social media algorithms amplify emotionally charged misinformation. | Scorer-sensitive wording issue | The answer is cautious and internally coherent, but the benchmark treats the broad sociotechnical wording as weak operational phrasing. | `verdict=Likely Reliable`, `contradiction_level=None`, `contradiction_summary=No direct contradiction was identified in retrieved evidence.`, `failure_type=Weak operational wording` |
| 49 | Satirical articles are often mistaken for real news online. | Actual backend inconsistency | Same shape as row 45: the reason is broad/contextual, while the contradiction summary escalates to direct factual conflict. | `verdict=Likely incorrect`, `reason=Evidence supports part of the claim, but the framing is broader than the evidence.`, `contradiction_level=High`, `contradiction_summary=Retrieved evidence conflicts with established factual records.` |
| 50 | Viral information spreads faster than verified corrections online. | Actual backend inconsistency | Same mismatch pattern again. The broad framing is acknowledged, but the contradiction summary remains too strong. | `verdict=Likely incorrect`, `reason=Evidence supports part of the claim, but the framing is broader than the evidence.`, `contradiction_level=High`, `contradiction_summary=Retrieved evidence conflicts with established factual records.` |

## Most Repeated Root Cause
- Conservative outputs are being penalized as contradiction problems even when they are safe and internally coherent.
- When there is a real mismatch, it is usually one of two shapes:
  - `reason` says the claim is only broadly/partially supported, but `contradiction_summary` still says direct factual conflict.
  - Nested metadata such as `corroborationLevel` or `confidence.drivers` stays semantically close but not perfectly aligned with the top-level verdict.

## Exact Fields Causing Failures
- `verdict`
- `reason`
- `contradiction_level`
- `contradiction_summary`
- `corroborationLevel.label`
- `corroborationLevel.agreement`
- `confidence.drivers`

## Safest Next Fix
- Do not change the core production pipeline yet.
- First, separate benchmark-scorer expectations for conservative outputs from true contradiction failures.
- If a production change is still needed after scorer clarification, the safest target is the final nested metadata cleanup around `corroborationLevel`, `confidence.drivers`, and `contradictionSummary`, not retrieval or routing.

## Production Code vs Scorer
- Production code should not be changed immediately based on this audit alone.
- The benchmark scorer likely needs adjustment because it is treating safe conservative outputs as contradiction failures.
- The remaining hard mismatches are narrow and should be fixed only after the scorer criteria are clarified.

## 300-Benchmark Readiness
- Not safe yet.
- The contradiction-consistency signal is still too noisy, and the audit shows a mix of real mismatches and scorer-sensitive conservative answers.
- Run the 300 benchmark only after the contradiction scorer is aligned with the intended conservative behavior.
