# DAM Current President Failure Analysis

## Scope

Inspection only. No production logic was changed.

Files inspected:
- `app/api/analyze/route.ts`
- `lib/claimRouter.ts`
- `lib/retrieval.ts`
- `lib/sourceRanker.ts`
- `lib/systemPrompt.ts`
- `components/analyzer/analyzerData.ts`
- `components/analyzer/SharedResultView.tsx`
- `components/analyzer/SharedAnalyzerLayout.tsx`

## Executive Summary

This failure was not one bug. It was a pipeline miss caused by:

1. `stable_fact` false-negative routing for a current office-holder claim.
2. Government retrieval that is India-biased and not office-holder aware.
3. Government retrieval using only the first query, which discards the more targeted fallback query.
4. Source ranking that treats prediction-market and low-signal domains as usable `Unknown` evidence instead of sharply penalizing them.
5. Final civic-rumor normalization that rewrites the result into civic unsupported language once evidence is not `strong`.
6. UI copy that treats any civic unsupported verdict as `No authoritative support identified.` and counts retrieved cards as evidence density even when they are low quality.

The claim likely never reached the intended stable-fact safeguards, and official US sources were very likely never retrieved in the failing run.

## 1. Exact Runtime Path For This Claim

Claim: `Donald Trump is the current president of the USA`

### Step 1: top-level routing

In `analyzeRequest` (`app/api/analyze/route.ts` around 8776-8782):
- `claimRoute = routeClaim(rawClaim)`
- `detectedCategory = claimRoute.retrievalCategory`
- `stableFact = claimRoute.isStableFactCandidate`

In `lib/claimRouter.ts`:
- `detectRetrievalCategory()` matches `president` and returns `government`.
- `isStableFactCandidate()` returns `false` because `current` is in `STABLE_FACT_NEGATIVE_SIGNALS`.
- `getRouteCategory()` does not match `stable_fact`, `breaking_news`, or `civic_rumor`, so category falls back to `general`.
- `routeClaim()` then still sets `isCivicRumor: category === 'civic_rumor' || retrievalCategory === 'government'`, so this claim is treated as civic anyway.

Net effect:
- `category = general`
- `retrievalCategory = government`
- `stableFact = false`
- `isCivicRumor = true`

This is the critical routing leak: the claim is not handled as a stable fact, but is later normalized as a civic rumor.

### Step 2: retrieval query construction

In `buildRetrievalQueries()` (`lib/retrieval.ts`):
- Base query added: `Donald Trump is the current president of the USA`
- Because category is `government`, it also adds: `Donald Trump is the current president of the USA official government PIB`
- Because `stableFact = false`, `getStableFactRetrievalHint()` is never used.
- Result list is truncated to 2 queries.

### Step 3: actual query used at retrieval time

In `retrieveEvidence()` (`lib/retrieval.ts`):
- Category `government` gets preferred domains from `getPreferredDomains('government')`:
  - `gov.in`
  - `pib.gov.in`
- `retrievalDomains = preferredDomains.slice(0, 1)` so only `gov.in` is used for the preferred-domain pass.
- `activeQueries` for `government` are `queries.slice(0, 1)`, so only the first query is ever searched.

That means the second, more targeted query with `official government PIB` is generated but never executed.

The first executed Tavily query becomes:
- `Donald Trump is the current president of the USA official government`

Why:
- `searchEvidence()` calls `buildTargetedQuery()`
- category hint for `government` is `official government`
- that suffix is appended if absent

The first pass is then restricted to:
- `includeDomains: ['gov.in']`

If that returns nothing, retrieval falls back to the same query without domain restriction.

### Step 4: evidence ranking and downstream verdicting

In `analyzeRequest()`:
- `rankEvidence()` ranks whatever Tavily returned.
- `classifyEvidenceStrength()` decides if evidence is `strong`, `moderate`, `weak`, or `none`.
- `evaluateConfidenceCaps()` caps confidence.
- The model is called with those retrieved cards.
- `responseNormalizer()` then applies multiple late-stage rewrites.

For this claim, the decisive late path is:
- `applyRoutingSeparationNormalization()` -> civic bucket can rewrite verdict to `Unsupported civic claim`
- `normalizeResponseState()` -> civic bucket and non-strong evidence rewrites wording to `No authoritative reporting currently supports this claim.`
- UI headline mapping -> `Unsupported civic claim` becomes `No authoritative support identified.`

## 2. Exact Failure Point

The earliest decisive failure is routing:

- `isStableFactCandidate()` rejects the claim because it contains `current`.
- But `routeClaim()` still marks it civic-like because `retrievalCategory === 'government'`.

That single combination causes the claim to lose:
- stable-fact retrieval hinting
- stable-fact contradiction/support safeguards
- any path that expects settled entity-relation verification

Then the claim is forced through a civic unsupported path if evidence is not `strong`.

## 3. All Contributing Failure Points

### A. Stable-fact routing failure

This office-holder claim is not recognized as a stable-fact-like entity-relation claim.

Evidence:
- `current` is a hard negative signal in `lib/claimRouter.ts`.
- There is no dedicated office-holder classifier for president / prime minister / vice president / CEO.
- Only generic `president` / `prime minister` token checks exist for retrieval category or retrieval hint logic.

Impact:
- No stable-fact hint.
- No stable-fact direct support logic.
- No stable-fact support/contradiction protections.

### B. Civic-claim routing leakage

Even though the claim is not classified as `civic_rumor`, it is effectively treated as one later.

Evidence:
- `routeClaim().isCivicRumor` becomes `true` when `retrievalCategory === 'government'`.
- `classifyRoutingBucket()` returns `civic_rumor` when `claimCategory === 'government'` or `route.isCivicRumor`.
- `normalizeResponseState()` applies civic unsupported wording whenever `civicRumor` is true and evidence is not `strong`.

Impact:
- Current office-holder verification gets civic-rumor handling.

### C. Retrieval query failure

The query is not office-holder aware and not country-aware in the right way.

Problems:
- No year/current-office-holder intent is injected.
- No official US domains are requested.
- No `WhiteHouse.gov`, `usa.gov`, `congress.gov`, `apnews.com`, or `reuters.com` preference exists for this case.
- Only the first query executes for `government`, so the extra targeted query is dead code for this claim.
- The preferred-domain pass is wrongly restricted to `gov.in`, which is India-specific and irrelevant for a US president claim.

Impact:
- Official US sources are not intentionally targeted.
- Retrieval can drift toward generic web results.

### D. Old-source contamination

Government claims are searched with:
- `topic: 'general'`
- no `days` filter

So old content is allowed by design unless the claim is classified as `breaking_news`.

Impact:
- Stale pages, prediction markets, and unrelated historical pages can enter the candidate set.

### E. Source credibility misclassification

In `lib/sourceRanker.ts`:
- `facebook.com` is `Low`
- `polymarketanalytics.com` is not listed, so it becomes `Unknown`
- `wizedu.com` is not listed, so it becomes `Unknown`

There is no special penalty for:
- prediction markets
- user-generated answer farms
- off-topic aggregators

`Unknown` still gets `weightedScore: 48`, which is materially better than `Low` and not far from `Moderate`.

Impact:
- Low-value domains remain competitive in ranking.

### F. Source ranking failure

`rankEvidence()` scores:
- `credibility.weightedScore + item.score + preferredDomain bonus`

Because none of the weak sources match preferred domains, ranking depends heavily on Tavily score plus a lenient `Unknown = 48`.

There is special treatment for `.gov` if present, but no special demotion for prediction markets or answer sites.

Impact:
- Weak sources can still become top evidence cards if retrieval did not fetch better ones.

### G. Final normalization over-conservatism

This is the subsystem that produced the exact bad verdict shape.

In `applyRoutingSeparationNormalization()`:
- civic bucket rewrites cautious verdicts to `Unsupported civic claim`

In `normalizeResponseState()`:
- if `civicRumor` and evidence is not `strong`, reason/reasoning/uncertainty are rewritten to:
  - `No authoritative reporting currently supports this claim.`
  - contradiction label becomes `Authoritative support missing`

Impact:
- Once routing leaked this claim into civic mode and retrieval was weak, the final answer was deterministically pushed into unsupported-civic wording.

## 4. Were Official Sources Retrieved Or Never Reached?

Most likely: official sources were never meaningfully reached.

Why that is the safest reading:
- The preferred-domain retrieval pass for this claim is `gov.in`, not US government domains.
- Only one query is executed for `government`, and it is the untargeted first query.
- There is no code path that discards high-trust `.gov` / Reuters / AP sources after retrieval.
- If `whitehouse.gov`, `usa.gov`, `congress.gov`, `reuters.com`, or `apnews.com` had been retrieved with matching snippets, they would have been scored `High` and likely dominated the ranked evidence.

So the code suggests:
- official US sources were not retrieved in the failing run,
- not that they were retrieved and then filtered out.

## 5. Which Subsystem Caused The Final Wrong Verdict?

Primary subsystem responsible for the final wrong verdict:
- final normalization in `app/api/analyze/route.ts`

Specifically:
- `applyRoutingSeparationNormalization()`
- `normalizeResponseState()`
- UI headline mapping in `components/analyzer/analyzerData.ts`

These layers converted a retrieval miss into:
- verdict: `Unsupported civic claim`
- operational headline: `No authoritative support identified.`
- corroboration/contradiction wording about missing authoritative support

However, that normalization only became wrong because upstream routing and retrieval already failed. So the full causal chain is:

1. stable-fact routing failure
2. government retrieval query failure
3. weak-source ranking survival
4. civic normalization override

## 6. Why Confidence Landed Around 40%

The observed `40%` is consistent with the cap logic.

In `applyConfidenceCaps()`:
- weak evidence or evidence that `evidenceLooksWeak()` triggers a `40` cap
- a single source also triggers `40`, but this case likely hit the weak-evidence branch instead

In this failure:
- evidence was low-quality and not direct
- source credibility was weak/unknown
- evidence strength was almost certainly `weak`

So confidence likely got capped to `40`, then the civic normalization rewrote the language without fixing the underlying retrieval failure.

## 7. Why The UI Shows Evidence Cards: 3

This is not a contradiction in the current implementation.

Backend behavior:
- `fallbackEvidenceCards()` and `normalizeEvidenceCards()` preserve retrieved sources as visible cards.
- `corroborationLevel.sourceCount` is set from `evidence.length`.

UI behavior:
- `SharedResultView.tsx` displays `corroborationLevel.sourceCount`
- `SharedAnalyzerLayout.tsx` also surfaces the same count
- The UI does not distinguish:
  - retrieved cards
  - authoritative supporting evidence
  - low-quality / irrelevant retrieval

So `3` means:
- three retrieved/ranked cards were attached to the response,
- not that DAM found three valid corroborating sources.

This is a misleading state for users.

## 8. Root Cause Classification

This failure should be classified as:
- `stable-fact routing failure`
- `civic-claim routing leakage`
- `retrieval query failure`
- `source ranking failure`
- `source credibility misclassification`
- `old-source contamination`
- `final normalization over-conservatism`
- `UI evidence-count misleading state`

## 9. Is This Isolated?

No. It is likely systemic for current office-holder claims and some current-entity claims.

Claims likely affected:
- current president / vice president
- current prime minister
- current cabinet posts
- current CEO / current leader claims if they fail stable-fact detection and fall back to generic retrieval

Why:
- `current` blocks stable-fact classification
- there is no dedicated office-holder/current-entity route
- government retrieval is not geography-aware
- final civic normalization is broad and aggressive

The same pattern can also affect:
- `JD Vance is the current vice president of the USA`
- `Narendra Modi is the current Prime Minister of India`
- `Keir Starmer is the current Prime Minister of the UK`
- `Emmanuel Macron is the current President of France`
- `Tim Cook is the current CEO of Apple`

## 10. Safest Surgical Fix Recommendation

Safest next fix:

Introduce a narrow current-office-holder / current-entity routing guard before generic civic normalization.

That guard should:
- recognize claims like `X is the current president/prime minister/vice president/CEO of Y`
- bypass civic-rumor normalization
- use office-holder-aware retrieval preferences
- require direct official/high-authority support

This is safer than broad prompt or ranker changes because it isolates the fix to the failing claim family.

## 11. What Not To Touch

Per request, do not change as part of this investigation:
- prompts
- retrieval implementation
- source ranking implementation
- `responseNormalizer`

Also avoid broad trust-score tuning first. The earlier routing/query failure is the larger issue.

## 12. Suggested Smoke Tests

- `Donald Trump is the current president of the USA`
- `JD Vance is the current vice president of the USA`
- `Narendra Modi is the current Prime Minister of India`
- `Keir Starmer is the current Prime Minister of the UK`
- `Emmanuel Macron is the current President of France`
- `Tim Cook is the current CEO of Apple`

## Bottom Line

The wrong verdict was finalized in normalization, but the root problem started earlier:
- DAM did not recognize this as a current office-holder fact claim,
- generated the wrong government retrieval strategy,
- failed to target authoritative US sources,
- then normalized the weak result as an unsupported civic rumor.
