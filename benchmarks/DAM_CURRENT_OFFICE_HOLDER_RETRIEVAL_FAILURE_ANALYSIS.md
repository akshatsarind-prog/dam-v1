# DAM Current Office Holder Retrieval Failure Analysis

## Scope

Inspection and runtime diagnosis only. No production code was changed in this pass.

Files inspected:
- `app/api/analyze/route.ts`
- `lib/retrieval.ts`
- `lib/claimRouter.ts`
- `lib/sourceRanker.ts`

## Bottom Line

The office-holder route is wired into runtime, but retrieval is timing out before it can return evidence.

The important distinction is:
- the office-holder query set is generated and passed into `retrieveEvidence`
- the live retrieval layer returns `evidence: []` and `retrievalFailed: true` after about 4 seconds
- the same behavior happens for a control query (`Paris is the capital of France`), so this is not office-holder-specific

That makes the primary root cause a retrieval timeout/provider failure in the current local runtime, not a route wiring failure.

## 1. Exact Runtime Path For One True Claim

Claim: `Donald Trump is the current president of the USA`

### Route selection

In `app/api/analyze/route.ts`:
- `claimRoute = routeClaim(rawClaim)`
- `claimRoute.isCurrentOfficeHolder` is `true`
- `stableFact` is computed as `claimRoute.isStableFactCandidate || claimRoute.isCurrentOfficeHolder`

This part is working.

### Query generation

In `lib/retrieval.ts`:
- `buildRetrievalQueries()` detects a current-office-holder profile
- it returns the targeted office-holder query set

For this claim, the exact generated queries are:
- `site:whitehouse.gov President Donald Trump`
- `site:usa.gov President Donald Trump`
- `President Donald Trump official United States`

### Query execution

Those queries are passed into:
- `retrieveEvidence(retrievalQueries, { category, preferredDomains, currentOfficeHolder: true })`

Inside `retrieveEvidence()`:
- `activeQueries = queries.slice(0, 3)` for current-office-holder claims
- each query is searched through `searchEvidence()`
- `searchEvidence()` first tries the preferred domains, then falls back to an unrestricted search if no preferred results are returned

So the targeted queries are not just generated. They are wired into runtime.

## 2. Exact Queries Actually Executed

For office-holder claims, the executed query strings are the generated targeted queries above.

The runtime behavior is:
- query string goes through `buildTargetedQuery()`
- for office-holder claims, `buildTargetedQuery()` returns the query unchanged
- the provider sees the exact office-holder query string

The relevant issue is not that the raw claim is still being searched.
The issue is that the provider calls are timing out before any results come back.

## 3. Provider Response / Error / Timeout Behavior

Direct live probe against the retrieval helper:
- `retrieveEvidence(['site:whitehouse.gov President Donald Trump'], { category: 'government', preferredDomains: ['whitehouse.gov', 'usa.gov'], currentOfficeHolder: true })`
- result: `evidence = 0`, `retrievalFailed = true`, elapsed `4021ms`

Direct live probe against a control query:
- `retrieveEvidence(['Paris is the capital of France'], { category: 'general', preferredDomains: ['britannica.com'], currentOfficeHolder: false })`
- result: `evidence = 0`, `retrievalFailed = true`, elapsed `4024ms`

This is the key runtime fact:
- the failure is not limited to office-holder queries
- the retrieval path is consistently consuming the full ~4 second budget and returning empty results

The provider errors are effectively swallowed by the current wrapper behavior:
- `searchEvidence()` catches errors and turns them into `[]`
- `retrieveEvidence()` wraps the whole promise in `withTimeout(..., 4000, { evidence: [], retrievalFailed: true })`

So from the caller perspective, the failure is flattened into `[]` with no usable source payload.

## 4. Why Evidence Became `[]`

The empty evidence array comes from the retrieval layer itself, not from response normalization.

Mechanically:
- the provider/search call does not return results in time
- the retrieval wrapper resolves to the timeout fallback or an empty result path
- `dedupeRetrievedEvidence()` then receives an empty list
- `rankEvidence()` has nothing to rank
- the API response therefore contains `evidence: []`

## 5. Why All Claims Cluster Around ~4020ms

The timing cluster matches the hard retrieval budget in `lib/retrieval.ts`:
- `searchEvidence()` uses a `timeout: 4`
- `retrieveEvidence()` wraps the whole operation in `withTimeout(..., 4000, ...)`

That produces a very consistent failure signature:
- around 4 seconds per request
- no returned evidence
- `retrievalFailed: true` in direct helper probes

This is why every claim in the runtime smoke clustered around ~4020ms.

## 6. Why `claimDecomposition.retrievalQueries` Looked Stale

The runtime response is misleading here.

Why:
- `normalizeDecomposition(null, rawClaim)` seeds the decomposition with the raw claim
- the timed-out fallback path (`buildTimedOutAnalysis`) also sets `retrievalQueries: [context.claim]`
- there is no response metadata path that replaces that with the generated office-holder query set before the early return

So `claimDecomposition.retrievalQueries` is stale / misleading in the runtime output.

Important:
- this is a reporting problem
- it is not the cause of the zero-source failure

## 7. Is This Local Env, Provider, Timeout, Query-Format, Or Code-Path?

Classification:
- primary: `timeout`
- secondary: `provider/local env`
- not primary: `claim router`
- not primary: `ranking`
- not primary: `responseNormalizer`
- not primary: `query wiring`

Why:
- the office-holder route is wired correctly
- the retrieval helper is called with the generated query set
- live retrieval still returns no evidence after the full timeout budget
- a control query behaves the same way

Query format is not exonerated, but it is not the leading cause based on the control probe.

## 8. Safest Surgical Fix

Not applied in this pass.

If a code change is allowed later, the smallest safe fix is to address the retrieval budget, not the verdict pipeline:
- increase or specialize the retrieval timeout for live office-holder verification
- or reduce the number of blocking search attempts per request
- and keep the current-office-holder routing and false-positive protections intact

I did not apply that change here because the current pass was diagnosis-only and the failure is already reproducible at the provider/timeout layer.

## 9. What Not To Touch

Do not touch:
- `responseNormalizer`
- prompts
- verdict logic
- ranking logic
- the one-call architecture
- stable-fact safeguards
- civic-rumor protections

## 10. Runtime Smoke Evidence

Focused runtime probe result:
- true office-holder claims returned `evidence: []`
- false office-holder claims also returned `evidence: []`
- all 10 claims clustered at ~4 seconds
- no civic-rumor unsupported wording appeared incorrectly
- retrieval did not return any official/current sources

That means:
- false-positive protection is still working
- retrieval availability is not

## 11. Validation

- `npm run lint`: passed
- `npm run build`: passed

