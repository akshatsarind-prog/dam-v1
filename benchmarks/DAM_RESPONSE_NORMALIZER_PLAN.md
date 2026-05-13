# DAM Response Normalizer Plan

Scope: planning only. No production code was modified.

## Goal

Centralize all final response decisions behind one gate:

`route.ts` -> collect signals -> retrieve evidence -> rank sources -> classify claim/risk -> build prompt -> one OpenAI call -> parse model output -> `responseNormalizer()` -> final JSON

Everything before `responseNormalizer()` should only produce signals. Only `responseNormalizer()` should be allowed to finalize or rewrite:

- `verdict`
- `confidence`
- `contradiction level`
- `contradiction summary`
- `risk`
- `reason`
- operational wording
- fallback consistency

## Current Problem

DAM V1 currently has multiple late-stage passes that can still rewrite the final payload after parsing. That makes earlier decisions unstable and creates layered, overlapping policy behavior.

The centralization target is not to remove safety logic. The target is to move all final rewriting into one ordered, deterministic post-model gate.

## 1. Existing Final-Normalization / Override Functions

This inventory focuses on functions that currently change or can change one or more of:

- `verdict`
- `confidence`
- `contradiction`
- `reason`
- `risk`
- wording

### 1.1 Functions that already rewrite final output

| Function | Location | Current effect | Classification |
|---|---|---|---|
| `normalizeAnalysis(...)` | `app/api/analyze/route.ts` | Repairs parsed model output, normalizes contradictions, applies operational wording, stable-fact normalization, scam normalization, and final caps. | Move into `responseNormalizer` |
| `buildAnalysisFromModelText(...)` | `app/api/analyze/route.ts` | Builds a full analysis from malformed model text, then normalizes it. | Move into `responseNormalizer` |
| `buildFallbackPayload(...)` | `app/api/analyze/route.ts` | Creates fallback JSON and then applies several normalization passes. | Move into `responseNormalizer` |
| `buildTimedOutAnalysis(...)` | `app/api/analyze/route.ts` | Builds timeout fallback JSON and then applies final normalization. | Move into `responseNormalizer` |
| `getAnalysisUnavailable(...)` | `app/api/analyze/route.ts` | Produces fallback analysis when model output is empty or missing. | Move into `responseNormalizer` |
| `finalizeAnalysis(...)` | `app/api/analyze/route.ts` | Applies final confidence clamp, verdict downgrade, and wording changes. | Move into `responseNormalizer` |
| `applyStableFactNormalization(...)` | `app/api/analyze/route.ts` | Can rewrite verdict, confidence, contradiction state, and reason for stable facts. | Move into `responseNormalizer` |
| `applyFinalStableFactSafeguard(...)` | `app/api/analyze/route.ts` | Can rewrite verdict, confidence, corroboration, contradiction, and risk. | Move into `responseNormalizer` |
| `applyScamNormalization(...)` | `app/api/analyze/route.ts` | Can rewrite verdict, risk, confidence rationale, and operational guidance. | Move into `responseNormalizer` |
| `applyOperationalTrustNormalization(...)` | `app/api/analyze/route.ts` | Can rewrite verdict, reason, confidence rationale, contradictions, and operational wording. | Move into `responseNormalizer` |
| `applyRoutingSeparationNormalization(...)` | `app/api/analyze/route.ts` | Can rewrite verdict, risk, reason, contradiction wording, and guidance based on routing bucket. | Move into `responseNormalizer` |
| `normalizeResponseState(...)` | `app/api/analyze/route.ts` | Final late-stage rewrite of verdict, reason, confidence, contradictions, and guidance. | Move into `responseNormalizer` |
| `applyUnsupportedStableFactContradictionSafeguard(...)` | `app/api/analyze/route.ts` | Downgrades false-positive contradiction states for weak stable facts. | Move into `responseNormalizer` |
| post-model mutation block in `analyzeRequest(...)` | `app/api/analyze/route.ts` | Mutates verdict, confidence, and risk after the analysis object is built. | Move into `responseNormalizer` |

### 1.2 Functions that normalize subfields and are part of final response shaping

| Function | Location | Current effect | Classification |
|---|---|---|---|
| `normalizeContradictionSummary(...)` | `app/api/analyze/route.ts` | Chooses contradiction summary and items. | Move into `responseNormalizer` |
| `applyNormalizedContradictions(...)` | `app/api/analyze/route.ts` | Replaces contradiction payload with normalized contradiction state. | Move into `responseNormalizer` |
| `normalizeOperationalLanguage(...)` | `app/api/analyze/route.ts` | Rewrites reason, reasoning, confidence, corroboration, contradictions, and guidance wording. | Move into `responseNormalizer` |
| `normalizeOperationalAnalysisPayload(...)` | `app/api/analyze/route.ts` | Bulk rewrites operational wording for fallback-shaped payloads. | Move into `responseNormalizer` |
| `normalizeResponseText(...)` | `app/api/analyze/route.ts` | Text-level wording rewrite for the response state. | Move into `responseNormalizer` |
| `getOperationalTrustSummary(...)` | `app/api/analyze/route.ts` | Produces the wording target used by later final rewrites. | Keep as signal producer |
| `summarizeEvidenceStrength(...)` | `app/api/analyze/route.ts` | Produces evidence-summary wording. | Keep as signal producer |
| `buildConfidenceCapReason(...)` | `app/api/analyze/route.ts` | Produces reason text for cap decisions. | Keep as signal producer |
| `getCautiousPrefix(...)` | `app/api/analyze/route.ts` | Produces a prefix used by final wording. | Keep as signal producer |
| `getOperationalCautionPrefix(...)` | `app/api/analyze/route.ts` | Produces a prefix used by final wording. | Keep as signal producer |
| `prefixCautiousLine(...)` | `app/api/analyze/route.ts` | Applies caution wording to strings. | Move into `responseNormalizer` |
| `prefixOperationalLine(...)` | `app/api/analyze/route.ts` | Applies operational prefix wording. | Move into `responseNormalizer` |
| `downgradeLowConfidenceLanguage(...)` | `app/api/analyze/route.ts` | Softens confident wording. | Move into `responseNormalizer` |

### 1.3 Functions that should remain signal producers

| Function | Location | Why it should stay outside final normalization |
|---|---|---|
| `routeClaim(...)` | `lib/claimRouter.ts` | Produces routing signals only. |
| `buildRetrievalQueries(...)` | `lib/retrieval.ts` | Produces retrieval signals only. |
| `retrieveEvidence(...)` | `lib/retrieval.ts` | Retrieval stage only. |
| `rankEvidence(...)` | `lib/sourceRanker.ts` | Produces ranking and evidence metadata only. |
| `summarizeSourceCredibility(...)` | `lib/sourceRanker.ts` | Produces source credibility signals only. |
| `detectConflictingSignals(...)` | `lib/sourceRanker.ts` | Produces contradiction signals only. |
| `systemPrompt` | `lib/systemPrompt.ts` | Prompt instruction text only. |
| `calibrateConfidence(...)` | `app/api/analyze/route.ts` | Should remain a signal producer for caps, not the final writer. |
| `adjustCalibrationForEvidence(...)` | `app/api/analyze/route.ts` | Should remain a signal producer for caps, not the final writer. |
| `evaluateConfidenceCaps(...)` | `app/api/analyze/route.ts` | Should stay a cap decision producer. |
| `classifyScamPattern(...)` | `app/api/analyze/route.ts` | Should remain a scam signal producer. |
| `detectScamSignals(...)` | `app/api/analyze/route.ts` | Should remain a scam signal producer. |
| `evaluateStableFactAnchor(...)` | `app/api/analyze/route.ts` | Should remain a stable-fact signal producer. |
| `validateStableFactRelation(...)` | `app/api/analyze/route.ts` | Should remain a stable-fact signal producer. |
| `hasDeterministicStableFactContradiction(...)` | `app/api/analyze/route.ts` | Should remain a stable-fact signal producer. |
| `classifyRoutingBucket(...)` | `app/api/analyze/route.ts` | Should remain a routing signal producer. |

### 1.4 Functions that should be preserved untouched for now

| Function | Location | Reason to leave untouched in the first pass |
|---|---|---|
| `withTimeout(...)` | `lib/timeout.ts` | Reliability wrapper, not part of final normalization. |
| `extractModelText(...)` | `app/api/analyze/route.ts` | Model parsing helper only. |
| `parseModelJson(...)` | `app/api/analyze/route.ts` | Parsing helper only. |
| `recoverStructuredOutput(...)` | `app/api/analyze/route.ts` | Parsing fallback helper only. |
| `normalizeEvidenceCards(...)` | `app/api/analyze/route.ts` | Schema repair helper; safe to keep until normalization wrapper exists. |
| `normalizeDecomposition(...)` | `app/api/analyze/route.ts` | Schema repair helper. |

### 1.5 Functions that are unsafe to touch now

These should not be simplified in the first implementation pass because they are the primary safety envelope:

- `applyFinalStableFactSafeguard(...)`
- `applyUnsupportedStableFactContradictionSafeguard(...)`
- `applyScamNormalization(...)`
- `evaluateConfidenceCaps(...)`
- `finalizeAnalysis(...)`
- `normalizeVerdictFromEvidence(...)`
- `normalizeHighRiskHealthVerdict(...)`
- `buildTimedOutAnalysis(...)`
- `buildFallbackPayload(...)`
- `buildAnalysisFromModelText(...)`
- `normalizeAnalysis(...)`

The reason is simple: these functions currently hold the exact behavior that prevents false stable facts, under-escalated scam claims, overconfidence, and broken fallback states.

## 2. Proposed `responseNormalizer()` Input Shape

This is the planned input contract. It is signal-oriented, not a finalized output object.

```ts
type ResponseNormalizerInput = {
  rawClaim: string
  modelAnalysis: unknown
  evidence: RankedEvidence[]
  sourceCredibility: SourceCredibility
  claimRoute: ClaimRoute
  scamSignals: ScamSignals
  stableFactSignals: {
    stableFact: boolean
    directStableFactSupport: boolean
    stableFactAnchor: StableFactAnchorEvaluation
    stableFactRelation: StableFactRelationValidation
    deterministicContradiction: boolean
  }
  contradictionSignals: {
    conflictingSignals: ConflictSignal
    modelContradictions?: ContradictionSummary
    contradictionLevel?: ContradictionLevel
    contradictionSummary?: string
  }
  confidenceCaps: {
    calibration: ConfidenceCalibration
    capDecision: ConfidenceCapDecision
    directSupportConfidenceCap?: number
  }
  fallbackState: {
    retrievalFailed: boolean
    modelFailed: boolean
    parseFailed: boolean
    usedTextFallback: boolean
    timedOut: boolean
    missingOpenAIKey: boolean
    missingTavilyKey: boolean
  }
  latencyState: {
    routeStartedAt: number
    retrievalLatencyMs?: number
    openaiLatencyMs?: number
    timedOut?: boolean
  }
  healthSignals: {
    highRiskHealth: HighRiskHealthSignal
    dangerousHealthTreatmentSignal: boolean
    hasAuthoritativeHealthEvidence: boolean
  }
  claimSignals: {
    directClaimSupport: boolean
    evidenceStrength: EvidenceStrength
    breakingNewsVague: boolean
    weirdScienceGuard: boolean
    currentNewsClaim: boolean
  }
}
```

Notes:

- `modelAnalysis` should accept either parsed structured output or a structured fallback seed.
- `claimRoute` should be passed in from routing, not recomputed inside the normalizer unless explicitly needed as a guard.
- `confidenceCaps` should be the already-computed cap decision, not a second recalculation.
- `fallbackState` should describe why the response is not model-driven.
- `latencyState` should be observable only, not a policy input unless a timeout fallback is being produced.

## 3. Proposed `responseNormalizer()` Output Shape

The output must preserve the existing frontend schema exactly.

```ts
type ResponseNormalizerOutput = {
  verdict: string
  confidence: {
    score: number
    label: 'Weak' | 'Moderate' | 'Strong'
    rationale: string
    drivers: string[]
  }
  confidenceLabel: 'High' | 'Moderate' | 'Low' | 'Insufficient'
  uncertaintyReason: string
  confidenceCapApplied?: boolean
  confidenceCapReason?: string
  risk: string
  reasoning: string
  corroborationLevel: {
    label: string
    agreement: string
    sourceCount: number
    highCredibilityCount: number
    indicators: string[]
  }
  sourceCredibility: {
    label: string
    weightedScore: number
    highTrustSources: number
    moderateTrustSources: number
    lowTrustSources: number
    unknownTrustSources: number
    rationale: string
  }
  contradictions: {
    label?: string
    level: 'None' | 'Low' | 'Moderate' | 'High' | 'Unknown'
    summary: string
    items: Array<{
      summary: string
      severity: 'None' | 'Low' | 'Moderate' | 'High' | 'Unknown'
      sources: string[]
    }>
  }
  contradictionSummary?: string
  evidence: Array<{
    id: string
    title: string
    url: string
    domain: string
    publishedDate: string | null
    credibility: 'High' | 'Moderate' | 'Low' | 'Unknown'
    credibilityScore: number
    credibilityRationale: string
    retrievalScore: number
    query: string
    stance: 'Supports' | 'Contradicts' | 'Contextualizes' | 'Unclear'
    excerpt: string
    assessment: string
  }>
  evidenceStatus?: string
  operationalGuidance: {
    action: string
    distribution: string
    escalation: string
    nextSteps: string[]
  }
  claimDecomposition: {
    entities: string[]
    dates: string[]
    locations: string[]
    organizations: string[]
    numericalClaims: string[]
    factualAssertions: string[]
    retrievalQueries: string[]
  }
  retrievedAt: string
}
```

This preserves the current UI-facing contract exactly.

## 4. Proposed Final Decision Order Inside `responseNormalizer()`

The first implementation should keep the same order of safety intent, but make it explicit and single-owned.

1. Schema repair
2. Hard safety blocks
3. Hallucination guard
4. Stable-fact false-positive guard
5. Scam/risk escalation
6. Contradiction consistency
7. Confidence caps
8. Wording normalization
9. Final schema validation

### Practical interpretation

- Schema repair: ensure required fields exist and invalid shapes are repaired.
- Hard safety blocks: timeout, retrieval failure, missing model output, and empty evidence paths.
- Hallucination guard: prevent unsupported confident wording when model output is weak or malformed.
- Stable-fact false-positive guard: preserve deterministic support/contradiction handling.
- Scam/risk escalation: retain explicit scam labels and do not collapse them into generic uncertainty.
- Contradiction consistency: keep contradiction level, summary, and items aligned with verdict.
- Confidence caps: apply the cap once, with evidence-weighted adjustments already computed.
- Wording normalization: clean phrasing without changing policy meaning.
- Final schema validation: guarantee frontend contract consistency.

## 5. What Must Not Change in the First Implementation Pass

Do not change these behaviors in the first step:

- False stable-fact protection
- Scam explicitness
- Confidence caps
- Timeout fallback behavior
- One-call architecture
- Frontend schema
- Parse recovery behavior
- Evidence ranking behavior
- Claim routing behavior
- Prompt wording

The first pass should only wrap and sequence the existing logic, not re-decide policy.

## 6. Safe Implementation Roadmap

### Step 1: Create `responseNormalizer()` wrapper without behavior change

Goal:

- create a single function that receives the current signal set and runs the existing final passes in the same order
- do not remove any existing code yet
- do not change semantics yet

Outcome:

- no observable behavior change
- one centralized gate exists conceptually

### Step 2: Route existing final passes through `responseNormalizer()` in the same order

Goal:

- the route still calls the same internal helpers
- but the final assembly goes through one wrapper

Outcome:

- identical behavior, but explicit ownership is established

### Step 3: Add smoke tests before moving logic

Goal:

- verify the wrapper preserves current outputs for representative claims

Outcome:

- confidence to move clusters without changing behavior

### Step 4: Move one normalization cluster at a time

Suggested move order:

1. wording normalization
2. contradiction consistency
3. confidence cap finalization
4. scam/risk wording
5. stable-fact safe rewrites
6. fallback consistency

Outcome:

- each move is small and measurable

### Step 5: Remove duplicated late overrides only after benchmark stability

Goal:

- remove the older direct late overrides only after smoke tests and benchmark comparisons stay stable

Outcome:

- the response normalizer becomes the true single final gate

## 7. Risk Register

| Risk | What could break | Detection | Smoke test |
|---|---|---|---|
| False stable-fact regression | A false stable fact could become corroborated or a true one could become insufficient | Compare verdict + contradiction output on stable-fact claims | Stable fact false/true pair |
| Scam dilution | Explicit scam labels could collapse into generic verification language | Inspect verdict/risk/reason on KYC, OTP, payment extraction, and reward bait claims | Scam claim set |
| Confidence drift | Final score could stop matching the cap decision | Compare pre-cap and post-cap scores, labels, and reasons | Mixed-evidence claim set |
| Timeout fallback mismatch | Timeout responses could stop matching the current structured fallback contract | Trigger timeout path and compare schema | Timeout smoke case |
| Contradiction drift | Contradiction summary and verdict could diverge | Check label, level, summary, and items together | Contradiction-heavy claim set |
| Schema breakage | Frontend could fail if a field changes or disappears | Validate output shape against current UI schema | All smoke cases |
| One-call regression | More than one model call or an early bypass could appear | Trace request path | Standard happy-path claim |

## 8. Validation Plan

Use the following validation sequence after each meaningful step:

1. `npm run lint`
2. `npm run build`
3. 10-claim smoke test
4. 50-claim benchmark
5. 300-claim benchmark only if the 50-claim benchmark remains stable

### 10-claim smoke test should include

- one obvious stable fact
- one false stable fact
- one breaking-news claim
- one civic rumor
- one scam KYC claim
- one payment extraction claim
- one reward bait claim
- one health claim
- one statistics claim
- one adversarial or quote-style claim

### 50-claim benchmark gating rule

Do not move to the 300-claim benchmark unless:

- verdict distribution stays stable
- confidence caps stay stable
- contradiction wording stays stable
- scam explicitness stays stable
- false stable-fact protection stays intact

## 9. First Centralization Slice

The safest first slice is:

- create `responseNormalizer()` as a wrapper
- feed it the already computed signal bundle
- keep the current final-pass order unchanged
- have `route.ts` call only that wrapper for final assembly

Why this slice first:

- zero intended behavior change
- minimal blast radius
- immediately establishes single-owner final normalization
- makes later extraction safe

## 10. Highest-Risk Area

The highest-risk area is stable-fact normalization.

Reason:

- it currently has the most overlapping guardrails
- it can produce both decisive corroboration and decisive contradiction
- it interacts with scam, breaking-news, and health branches
- it is the easiest place to introduce regressions while centralizing

## 11. Recommendation

Recommended strategy:

1. Centralize normalization first
2. Keep all current guards intact in the wrapper initially
3. Move logic into the wrapper one cluster at a time
4. Remove duplicate late overrides only after smoke and benchmark stability is confirmed

## 12. Summary

The response normalizer should become the only place where final user-visible meaning is decided.

Before that point, the pipeline should only emit signals, caps, and evidence-derived metadata.

