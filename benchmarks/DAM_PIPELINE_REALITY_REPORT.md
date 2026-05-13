# DAM Pipeline Reality Report

Scope: architecture inspection only. No production code was modified.

## Executive Verdict

DAM V1 is no longer a single clean pipeline. It still has one top-level request path and one OpenAI call, but the runtime behavior is now a deterministic layered override system with several competing normalization passes.

The system is best described as:

- `partially centralized`
- `layered patchwork`
- `unstable override system` in the final response stage

The strongest control over outputs is the final normalization chain in `app/api/analyze/route.ts`, especially `normalizeResponseState`, `applyRoutingSeparationNormalization`, `applyOperationalTrustNormalization`, and `applyUnsupportedStableFactContradictionSafeguard`.

## 1. Intended Pipeline

The intended design is the ideal pipeline described in the task:

1. Claim intake
2. Retrieval of compact and authoritative evidence
3. Source ranking and credibility weighting
4. Claim routing into scam, stable fact, breaking news, civic rumor, statistics, health, and related buckets
5. Prompt construction with evidence, risk context, and routing context
6. One OpenAI call
7. Safe parsing of structured JSON
8. Contradiction analysis
9. Confidence calibration
10. Final normalization for consistency and wording
11. Final response JSON with verdict, confidence, contradiction, reason, evidence quality, and operational wording

That intent is reinforced by:

- `lib/systemPrompt.ts:1`
- `lib/claimRouter.ts:588`
- `lib/retrieval.ts:144`
- `lib/sourceRanker.ts:283`
- `app/api/analyze/route.ts:7536`

## 2. Actual Runtime Pipeline

### Top-level runtime order

The real request path is:

1. `POST` enters `app/api/analyze/route.ts:8331`
2. Route timeout wrapper starts at `app/api/analyze/route.ts:8331`
3. `analyzeRequest` begins at `app/api/analyze/route.ts:7791`
4. Claim is normalized and routed with `routeClaim`
5. Retrieval queries are built
6. Retrieval runs through Tavily
7. Retrieved evidence is deduped and ranked
8. Source credibility and contradiction signals are computed
9. Stable-fact, scam, health, breaking-news, and confidence context is derived
10. A calibration object is computed
11. A contradiction context object is assembled
12. Special-case early exits may return before the model call
13. Otherwise, exactly one OpenAI chat completion is issued
14. Model text is extracted and parsed or recovered
15. The response is normalized through multiple post-model override layers
16. Final JSON is returned

### Concrete runtime branches

The actual code path in `analyzeRequest` is:

1. Intake and claim normalization
2. `routeClaim(rawClaim)` from `lib/claimRouter.ts:588`
3. `buildRetrievalQueries(...)` from `lib/retrieval.ts:144`
4. `retrieveEvidence(...)` from `lib/retrieval.ts:291`
5. `dedupeRetrievedEvidence(...)`
6. `rankEvidence(...)` from `lib/sourceRanker.ts:283`
7. `summarizeSourceCredibility(...)` from `lib/sourceRanker.ts:327`
8. `detectConflictingSignals(...)` from `lib/sourceRanker.ts:368`
9. `classifyScamPattern`, `detectScamSignals`, `classifyHighRiskHealthClaim`, `isDangerousHealthTreatmentClaim`, and related route-local heuristics
10. `calibrateConfidence(...)`
11. `adjustCalibrationForEvidence(...)`
12. `evaluateConfidenceCaps(...)` and `applyConfidenceCaps(...)`
13. `getCapitalSmokeProfile(...)` can short-circuit before the model
14. Missing API key, retrieval failure, empty evidence, or timeout can short-circuit to fallback payloads
15. One OpenAI call is made if the route gets that far
16. Parsed model JSON goes through `normalizeAnalysis(...)`
17. Fallback model text goes through `buildAnalysisFromModelText(...)`
18. No usable model output goes through `buildFallbackPayload(...)`
19. Post-model mutations can still rewrite verdict, risk, confidence, contradiction state, and wording
20. Final output goes through `applyStableFactNormalization(...)`, `applyFinalStableFactSafeguard(...)`, `applyScamNormalization(...)`, `applyOperationalTrustNormalization(...)`, `applyRoutingSeparationNormalization(...)`, `normalizeResponseState(...)`, and `applyUnsupportedStableFactContradictionSafeguard(...)`

### Important consequence

There is one OpenAI call, but not one decision point. The final response is the result of several layered rewrites after the model returns.

## 3. Major Divergence Points

| Intended behavior | Actual behavior | Divergence |
|---|---|---|
| One coherent pipeline | One orchestrator with many policy rewrites | The pipeline is not unified; it is layered |
| Claim routing happens once | Routing is recomputed in multiple places | Routing logic is duplicated across `claimRouter`, `retrieval`, and `route.ts` |
| Contradiction is derived once | Contradiction is derived, normalized, rewritten, and re-rewritten | Contradiction state has multiple owners |
| Stable-fact handling is centralized | Stable-fact handling is spread across anchors, relation validation, normalization, and final safeties | Same claim can be reclassified several times |
| Confidence is capped once | Confidence is calibrated, adjusted, capped, then clamped again | Confidence is controlled by several layers |
| Wording is normalized once | Wording is rewritten in many passes | Operational text is not single-source |
| Model output is final after parsing | Model output is provisional until the final response-state pass | Later passes can still override it |

## 4. Override Layers

### Verdict override points

Verdict can change at these points:

- `buildTimedOutAnalysis(...)` at `app/api/analyze/route.ts:7418`
- `getAnalysisUnavailable(...)` at `app/api/analyze/route.ts:6855`
- `normalizeAnalysis(...)` at `app/api/analyze/route.ts:7536`
- `normalizeVerdictFromEvidence(...)` at `app/api/analyze/route.ts:5106`
- `normalizeHighRiskHealthVerdict(...)` at `app/api/analyze/route.ts:5168`
- `applyStableFactNormalization(...)` at `app/api/analyze/route.ts:5221`
- `applyFinalStableFactSafeguard(...)` at `app/api/analyze/route.ts:5331`
- `applyScamNormalization(...)` at `app/api/analyze/route.ts:2445`
- `finalizeAnalysis(...)` at `app/api/analyze/route.ts:2901`
- `applyOperationalTrustNormalization(...)` at `app/api/analyze/route.ts:6510`
- `applyRoutingSeparationNormalization(...)` at `app/api/analyze/route.ts:6643`
- `normalizeResponseState(...)` at `app/api/analyze/route.ts:7536`
- the post-model mutation block in `analyzeRequest(...)` at `app/api/analyze/route.ts:8200`

### Contradiction override points

Contradiction state can change at these points:

- `detectConflictingSignals(...)` in `lib/sourceRanker.ts:368`
- `normalizeAnalysis(...)` in `app/api/analyze/route.ts:7536`
- `normalizeContradictionSummary(...)` at `app/api/analyze/route.ts:1508`
- `applyNormalizedContradictions(...)` at `app/api/analyze/route.ts:1536`
- `applyStableFactNormalization(...)` at `app/api/analyze/route.ts:5221`
- `applyFinalStableFactSafeguard(...)` at `app/api/analyze/route.ts:5331`
- `normalizeOperationalLanguage(...)` at `app/api/analyze/route.ts:5662`
- `applyOperationalTrustNormalization(...)` at `app/api/analyze/route.ts:6510`
- `applyRoutingSeparationNormalization(...)` at `app/api/analyze/route.ts:6643`
- `normalizeResponseState(...)` at `app/api/analyze/route.ts:7536`
- `buildFallbackPayload(...)` at `app/api/analyze/route.ts:7229`
- `buildTimedOutAnalysis(...)` at `app/api/analyze/route.ts:7418`

### Confidence override points

Confidence can change at these points:

- `calibrateConfidence(...)` at `app/api/analyze/route.ts:2752`
- `adjustCalibrationForEvidence(...)` at `app/api/analyze/route.ts:1633`
- `applyConfidenceCaps(...)` at `app/api/analyze/route.ts:2740`
- `evaluateConfidenceCaps(...)` at `app/api/analyze/route.ts:2752`
- `finalizeAnalysis(...)` at `app/api/analyze/route.ts:2901`
- `applyStableFactNormalization(...)` at `app/api/analyze/route.ts:5221`
- `applyFinalStableFactSafeguard(...)` at `app/api/analyze/route.ts:5331`
- `normalizeAnalysis(...)` at `app/api/analyze/route.ts:7536`
- `buildAnalysisFromModelText(...)` at `app/api/analyze/route.ts:7070`
- `buildFallbackPayload(...)` at `app/api/analyze/route.ts:7229`
- `buildTimedOutAnalysis(...)` at `app/api/analyze/route.ts:7418`
- post-model mutation block in `analyzeRequest(...)` at `app/api/analyze/route.ts:8200`

### Wording override points

Wording can change at these points:

- `normalizeOperationalLanguageText(...)`
- `chooseOperationalText(...)`
- `normalizeOperationalAnalysisPayload(...)`
- `summarizeEvidenceStrength(...)`
- `getCautiousPrefix(...)`
- `getOperationalCautionPrefix(...)`
- `prefixCautiousLine(...)`
- `prefixOperationalLine(...)`
- `downgradeLowConfidenceLanguage(...)`
- `getOperationalTrustSummary(...)`
- `normalizeOperationalLanguage(...)` at `app/api/analyze/route.ts:5662`
- `applyScamNormalization(...)` at `app/api/analyze/route.ts:2445`
- `applyOperationalTrustNormalization(...)` at `app/api/analyze/route.ts:6510`
- `applyRoutingSeparationNormalization(...)` at `app/api/analyze/route.ts:6643`
- `applyStableFactNormalization(...)` at `app/api/analyze/route.ts:5221`
- `applyFinalStableFactSafeguard(...)` at `app/api/analyze/route.ts:5331`
- `normalizeResponseText(...)`
- `normalizeResponseState(...)` at `app/api/analyze/route.ts:7536`

## 5. Duplicated Logic Clusters

### 5.1 Claim routing

Routing is split across:

- `lib/claimRouter.ts:488`
- `lib/claimRouter.ts:548`
- `lib/claimRouter.ts:588`
- `lib/retrieval.ts:117`
- `lib/retrieval.ts:144`
- `app/api/analyze/route.ts:627` through the route-local bucket logic
- `app/api/analyze/route.ts:6643`
- `app/api/analyze/route.ts:7536`

This means scam, breaking-news, civic-rumor, statistics, and stable-fact logic are not owned by one module.

### 5.2 Scam detection

Scam logic appears in many forms:

- `classifyScamPattern(...)`
- `detectScamSignals(...)`
- `hasDirectScamIndicators(...)`
- `getScamVerdictLabel(...)`
- `getScamRiskLevel(...)`
- `buildExplicitScamLanguage(...)`
- `strengthenScamLanguage(...)`
- `applyScamNormalization(...)`
- `normalizeResponseState(...)`
- `lib/systemPrompt.ts:123`

The cue families are repeated instead of centralized.

### 5.3 Stable-fact handling

Stable-fact logic is spread across:

- `evaluateStableFactAnchor(...)`
- `getIndiaDelhiCapitalAliasContext(...)`
- `getStableFactHardContradictionReason(...)`
- `hasStableFactRelationSupport(...)`
- `validateStableFactRelation(...)`
- `hasDeterministicStableFactContradiction(...)`
- `hasDirectStableFactSupport(...)`
- `normalizeVerdictFromEvidence(...)`
- `applyStableFactNormalization(...)`
- `applyFinalStableFactSafeguard(...)`
- `applyUnsupportedStableFactContradictionSafeguard(...)`
- `normalizeResponseState(...)`

This is the densest and most conflict-prone part of the system.

### 5.4 Contradiction handling

Contradiction handling is duplicated across:

- `lib/sourceRanker.ts:368`
- `normalizeContradictionSummary(...)`
- `applyNormalizedContradictions(...)`
- `applyStableFactNormalization(...)`
- `applyFinalStableFactSafeguard(...)`
- `getOperationalTrustSummary(...)`
- `normalizeResponseState(...)`

The contradiction signal, contradiction summary, and contradiction label are not controlled by one layer.

### 5.5 Confidence control

Confidence is managed by:

- `calibrateConfidence(...)`
- `adjustCalibrationForEvidence(...)`
- `applyConfidenceCaps(...)`
- `evaluateConfidenceCaps(...)`
- `finalizeAnalysis(...)`
- `applyStableFactNormalization(...)`
- `applyFinalStableFactSafeguard(...)`
- `normalizeAnalysis(...)`
- `buildTimedOutAnalysis(...)`
- `buildFallbackPayload(...)`
- the post-model mutation block in `analyzeRequest(...)`

This is safe in intent, but heavily layered.

### 5.6 Wording normalization

Operational wording is rewritten by:

- `normalizeOperationalLanguageText(...)`
- `normalizeOperationalAnalysisPayload(...)`
- `normalizeOperationalLanguage(...)`
- `normalizeResponseText(...)`
- `normalizeResponseState(...)`
- `applyOperationalTrustNormalization(...)`
- `applyRoutingSeparationNormalization(...)`

This is a defense-in-depth pattern, but it is also where inconsistencies are easiest to introduce.

## 6. Most Dangerous Architectural Conflicts

1. Stable-fact support and contradiction can both be derived, then overwritten later by unrelated routing logic.
2. Scam routing can override general factual evaluation, but later stable-fact or response-state logic can still rewrite the verdict.
3. Breaking-news and civic-rumor routing can force wording and verdicts even when evidence quality is the real issue.
4. Confidence ceilings are computed more than once, so the final score is the product of multiple safety policies rather than one source of truth.
5. Contradiction summaries can be replaced after they are generated, which makes the final verdict and contradiction text drift apart if a later pass is not aligned.

## 7. What DAM Actually Behaves Like

DAM currently behaves like a:

- `layered patchwork`
- `partially centralized` system
- `deterministic override stack`

It is not a free-form mess. The order is deterministic. But the behavior is no longer a single coherent pipeline because several subsystems can still override earlier subsystems.

## 8. Top 5 Architecture Risks

1. False stable facts can still be handled by multiple competing paths, making regressions easy to reintroduce.
2. Final verdicts can be rewritten after the model returns, so the meaning of the model output is not stable until the last normalization pass.
3. Contradiction text and verdict can diverge because they are normalized separately.
4. Confidence caps are duplicated, so a future change can accidentally weaken or over-tighten a safety ceiling.
5. Routing leakage means claim classification, retrieval selection, and final wording are not fully separated, which makes behavior hard to reason about.

## 9. Single Highest-Priority Simplification Target

The highest-priority simplification target is the final response normalization chain in `app/api/analyze/route.ts`.

Specifically, this chain should eventually become one ordered post-model normalizer instead of several overlapping passes:

- `applyStableFactNormalization(...)`
- `applyFinalStableFactSafeguard(...)`
- `applyScamNormalization(...)`
- `applyOperationalTrustNormalization(...)`
- `applyRoutingSeparationNormalization(...)`
- `normalizeResponseState(...)`
- `applyUnsupportedStableFactContradictionSafeguard(...)`

That is the single place where the most output mutations currently happen.

## 10. Recommendation

Recommended next action: `centralize normalization first`

Why:

- it addresses the highest concentration of override conflicts
- it reduces the chance of verdict drift after model parsing
- it gives clearer ownership of verdict, contradiction, confidence, and wording changes
- it is the narrowest change that would materially improve coherence without refactoring the rest of the system at once

## 11. Subsystem Ownership Summary

### Strongest control

`app/api/analyze/route.ts` final normalization and safeguard chain currently has the strongest control over the final output.

### Most unstable

`app/api/analyze/route.ts` is the most unstable subsystem because it contains the most overlapping override logic.

### Most unexpected override source

`normalizeResponseState(...)` and `applyUnsupportedStableFactContradictionSafeguard(...)` are the most likely to override earlier decisions unexpectedly because they run late and can still rewrite verdict, contradiction state, and wording.

## 12. File-Level Notes

- `app/api/analyze/route.ts:7791` owns orchestration, model calling, parsing, normalization, fallbacks, and final response shaping.
- `lib/claimRouter.ts:588` is the cleanest single routing entry, but it is not the only place where routing logic effectively happens.
- `lib/retrieval.ts:144` and `lib/retrieval.ts:291` mix retrieval with routing-aware query bias.
- `lib/sourceRanker.ts:283` and `lib/sourceRanker.ts:368` are coherent inside the module, but the route reinterprets their output later.
- `lib/systemPrompt.ts:1` mirrors much of the runtime policy, which is useful for alignment but also proves policy duplication.

## 13. Bottom Line

DAM V1 is still deterministic and still one-call-per-request, but it does not behave like a single coherent pipeline anymore.

It behaves like a centralized orchestrator wrapped around a stack of overlapping policy rewriters.
