# DAM Retrieval Provider Failure Fix Report

## Scope

Diagnosis and minimal retrieval-layer fix only.

Files changed:
- `lib/retrieval.ts`

Files inspected:
- `lib/retrieval.ts`
- `app/api/analyze/route.ts`
- `lib/claimRouter.ts`
- `lib/sourceRanker.ts`
- environment variable usage in `.env.local`

## Root Cause

The retrieval provider was being cut off by an overly aggressive hard timeout.

Two limits were stacked in `lib/retrieval.ts`:
- Tavily search timeout was set to `4` seconds
- the outer `withTimeout()` wrapper was set to `4000` ms

That produced the observed failure signature:
- every claim clustered around ~4020 ms
- `evidence: []`
- `retrievalFailed: true`
- even a control query like `Paris is the capital of France` failed the same way

So the failure was global retrieval timeout/provider behavior, not office-holder routing, source ranking, or response normalization.

## Environment Variable Check

Retrieval uses `TAVILY_API_KEY`.

Findings:
- `.env.local` already contained `TAVILY_API_KEY`
- the code in `getClient()` reads `process.env.TAVILY_API_KEY`
- there was no env var name mismatch

Conclusion:
- the env var was correct
- the failure was not caused by a missing or misnamed key

## Exact Fix Applied

Smallest safe retrieval-only fix:
- increased Tavily search timeout from `4` to `8` seconds
- increased the outer retrieval timeout from `4000` ms to `8500` ms
- added safe `console.warn('[retrieval] search failed', ...)` logging inside the per-query catch so provider failures are visible in server logs without exposing secrets

No changes were made to:
- `responseNormalizer`
- claim routing
- office-holder routing logic
- source ranking logic
- prompts
- UI
- response schema
- one-call architecture

## Retrieval Probe Results

After the fix, focused probes succeeded:

| Query | Evidence | retrievalFailed | Approx latency | Notes |
| --- | ---: | ---: | ---: | --- |
| `Paris is the capital of France` | 3 | false | ~1295 ms | Control query now returns evidence |
| `White House President Donald Trump` | 3 | false | ~649 ms | Official White House sources retrieved |
| `Narendra Modi Prime Minister India` | 3 | false | ~801 ms | Official Indian government sources retrieved |
| `Tim Cook CEO Apple` | 3 | false | ~sub-1s | Retrieved evidence, but this query did not force the office-holder profile path the same way the full claim does |

The important result is that the provider no longer returns empty evidence globally.

## 10-Claim Current-Office-Holder Smoke Result

I reran the focused runtime smoke against `/api/analyze`.

Result summary:
- true office-holder claims now retrieve official/high-authority sources
- false office-holder claims are still not corroborated
- civic-rumor unsupported wording did not regress
- no false stable-fact corroboration was introduced

Observed runtime behavior:
- `Donald Trump is the current president of the USA` retrieved 5 White House sources
- `JD Vance is the current vice president of the USA` retrieved 5 White House sources
- `Narendra Modi is the current Prime Minister of India` retrieved 4 PMO sources
- `Keir Starmer is the current Prime Minister of the UK` retrieved official UK government sources
- `Emmanuel Macron is the current President of France` retrieved official French sources
- `Tim Cook is the current CEO of Apple` retrieved Apple/authoritative leadership sources
- false claims such as `Barack Obama is the current president of the USA` and `Elon Musk is the current CEO of Apple` remained uncorroborated

Important limitation:
- verdicts are still conservative in some cases because verdict logic and normalization were intentionally left untouched
- this report is about restoring retrieval availability, not changing final corroboration policy

## Why `claimDecomposition.retrievalQueries` Was Misleading

The runtime response still shows stale/raw-query metadata in `claimDecomposition.retrievalQueries`.

That is a reporting issue in the runtime output path, not the cause of the zero-source failure.

## Remaining Risk

The retrieval timeout is now less aggressive, but it is still a budgeted live provider call.

Residual risks:
- provider latency may still vary under load
- a future provider-side slowdown could reintroduce empty evidence if the timeout budget becomes too tight again

## Validation

- `npm run lint`: passed
- `npm run build`: passed

