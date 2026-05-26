# DAM AI Context Pack

## What DAM is
DAM is an AI-powered misinformation and claim-verification product. Users submit a claim or suspicious content, and DAM returns a verdict with reasoning and evidence.

## Current stage
Early product, active development, user testing, distribution experiments.

## Current metrics
- Total claims: 76
- Page views: 311
- Highly engaged users: 7-8
- Landing visitors: cannot be determined accurately

## Current priorities
1. Improve result page clarity.
2. Improve share/download flow.
3. Improve source verification reliability.
4. Increase user feedback.
5. Improve admin analytics.
6. Build stronger failure-case benchmark set.

## Current risks
- Weak source verification can damage trust.
- Poor verdict clarity can reduce user confidence.
- Missing failure-case coverage can allow regressions.
- Limited analytics can hide funnel and retention problems.

## Current workflow
1. Capture task.
2. Check current context.
3. Route task.
4. Run relevant agents.
5. Generate Codex task.
6. Run implementation.
7. Run Claude review.
8. Record result.
9. Update context.
10. Human approves high-risk actions.

## Core rule
`dam-v1` is the codebase.
`dam-ai-hq` is the command center.
