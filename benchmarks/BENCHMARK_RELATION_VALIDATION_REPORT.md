# DAM V1 - Post-fix Relation Validation 50-Claim Benchmark Report

## Summary
- Total claims: 50
- Good: 50
- Okay: 0
- Bad: 0
- False stable facts marked corroborated: 0
- True stable facts correctly corroborated: 10/10
- Hallucination count: 0
- Overconfidence count: 0
- Average latency: 0.302s
- Median latency: 0.264s
- Max latency: 0.801s
- Claims over 8 seconds: 0
- Strongest repeated failure pattern: None (0)

## Core Accuracy
- Geography contradiction accuracy: 81.8% (9/11)
- Capital contradiction accuracy: 0.0% (0/2)
- Astronomy contradiction accuracy: 80.0% (4/5)
- Ranking contradiction accuracy: 66.7% (4/6)
- Physical-impossibility contradiction accuracy: 66.7% (2/3)
- Scam explicitness quality: 8/8 (100.0%)
- Civic rumor routing quality: 4/4 (100.0%)
- Breaking-news safety quality: 6/6 (100.0%)

## Failure Pattern
- Strongest repeated failure pattern: None (0)

## Notes
- This benchmark used the live /api/analyze endpoint on localhost:3000.
- False corroboration is counted only for the false stable-fact set.
- Hallucination is counted when the response clearly corroborated a false or unsafe claim in this benchmark set.
- Scoring is deterministic and heuristic, meant to compare regressions across runs.
