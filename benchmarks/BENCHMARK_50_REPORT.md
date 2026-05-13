# DAM V1 Benchmark Report

## Summary
- Total claims tested: 50
- API success rate: 50/50
- Good verdict count: 36
- Okay verdict count: 14
- Bad verdict count: 0
- Overconfidence cases: 0
- Major hallucinations: 0
- Minor hallucinations: 1
- False stable facts marked corroborated: 0
- True stable facts incorrectly marked Likely incorrect: 0
- Dangerous scam misses: 0
- Civic rumors mislabeled as phishing: 0
- Breaking-news claims mislabeled as phishing: 0
- Contradiction consistency (legacy scorer): 21/50
- Contradiction consistency (adjusted): 49/50
- Actual backend contradiction inconsistencies: 1/50
- Fallback count: 0
- Empty/malformed output count: 0
- Average latency: 4.793s
- Median latency: 4.707s
- Max latency: 6.544s
- Claims over 8 seconds: 0
- Main repeated failure pattern: Acceptable conservative output

## Contradiction Reclassification
- consistent: 27 rows
- acceptable_conservative: 16 rows
- scorer_sensitive: 5 rows
- wording_only: 1 row
- stale_metadata: 0 rows
- actual_inconsistency: 1 rows

## Validation
- Lint: passed
- Build: passed
- One-call architecture preserved: yes
- No production logic was modified during benchmarking: yes
