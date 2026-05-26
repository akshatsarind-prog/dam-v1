# DAM Live Office-Holder False Contradiction Fix Report

## Scope

Live contradiction-path diagnosis and narrow fix only.

Files changed:
- `app/api/analyze/route.ts`

## Root Cause

The live contradiction path was treating current-office-holder claims as ordinary stable-fact contradictions.

The key failure was in the contradiction normalization layer, not retrieval:
- `current-office-holder` claims were folded into `stableFact`
- `buildContradictionDecision()` could still return `Direct contradiction detected` when `input.stableFact` was true
- `hasStableFactContradictionSignal()` could elevate generic contradiction heuristics even when source cards stayed `UNCLEAR`
- `applyOperationalTrustNormalization()` then used that contradiction signal to force a `Likely incorrect` style verdict

That is why the source cards could show `UNCLEAR` while the final response said:
- `Direct contradiction detected`
- `Retrieved evidence conflicts with established factual records`

## Exact Live Failure Path

For the claim:
- `Donald Trump is the current president of the USA`

The live path was:
1. Retrieval returned official WhiteHouse.gov evidence.
2. Evidence cards stayed `UNCLEAR` because source-level stance extraction did not produce explicit support or contradiction.
3. The contradiction layer still treated the claim as a generic stable fact because `stableFact` was true.
4. `buildContradictionDecision()` and downstream trust normalization were able to elevate the result into a direct contradiction verdict.
5. The final UI showed `Likely Incorrect` / `Direct contradiction detected` even though the evidence did not provide explicit contradiction.

## Why Source Cards Showed `UNCLEAR`

The evidence cards are rendered from source-level stance extraction.

For the WhiteHouse.gov pages:
- the titles and snippets are official and relevant
- but they are not being labeled as explicit `Supports` or `Contradicts`
- so the cards remain `UNCLEAR` with “Retrieved evidence preview awaiting model-level stance extraction.”

That is not a contradiction signal by itself.

The bug was that the final contradiction layer did not respect that uncertainty for current-office-holder claims.

## Local vs Production Mismatch

Observed mismatch:
- live production previously returned `Likely Incorrect` / `Direct contradiction detected`
- local runtime after the fix now returns `Evidence insufficient` with `No direct contradiction was identified in retrieved evidence` for the same claim

Inference:
- production was likely on a stale deployment or older build of the contradiction-normalization code when the bad live result was observed
- I could not fetch Vercel deployment metadata from the repo, so this is an inference from the behavior split

## Exact Fix Applied

Added a narrow current-office-holder guard in `app/api/analyze/route.ts`:
- `hasStableFactContradictionSignal()` now returns `false` for current-office-holder claims unless there is explicit source-level conflict
- `buildContradictionDecision()` now returns a low-severity “no direct contradiction” decision for current-office-holder claims when no source conflict exists

This preserves:
- retrieval behavior
- routing behavior
- source ranking
- the one-call architecture
- false-office-holder protection

This only prevents unclear official current-office-holder evidence from being upgraded into a direct contradiction.

## Focused Smoke Results

After the fix, focused runtime checks produced:

- `Donald Trump is the current president of the USA` -> `Evidence insufficient`, `5` official sources, `retrievalFailed=false`, no direct contradiction
- `JD Vance is the current vice president of the USA` -> `Evidence insufficient`, `5` official sources, `retrievalFailed=false`, no direct contradiction
- `Narendra Modi is the current Prime Minister of India` -> `Evidence insufficient`, `4` official sources, `retrievalFailed=false`, no direct contradiction
- `Barack Obama is the current president of the USA` -> `Evidence insufficient`, `5` official sources, `retrievalFailed=false`, not corroborated
- `JD Vance is the current president of the USA` -> `Evidence insufficient`, `5` official sources, `retrievalFailed=false`, not corroborated
- `Elon Musk is the current CEO of Apple` -> `Evidence insufficient`, `5` official sources, `retrievalFailed=false`, not corroborated

## What Not To Touch

- retrieval timeout values
- Tavily/provider logic
- current-office-holder routing detection
- source ranking design
- response schema
- prompts
- frontend/UI
- one-call architecture

## Validation

- `npm run lint`: passed
- `npm run build`: passed

