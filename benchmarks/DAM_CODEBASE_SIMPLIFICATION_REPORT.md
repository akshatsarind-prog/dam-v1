# DAM V1 Codebase Simplification Report

Scope: analysis only. No production code was modified for this report.

## Executive Summary

DAM V1 is safe in the sense that it has accumulated many guardrails, but those guardrails are now spread across a very large orchestration file and several smaller helper modules. The main risk is not a single bug; it is that the same policy is implemented in multiple places, so future cleanup could easily reintroduce false stable facts, overconfidence, or weak scam handling.

The biggest structural issue is `app/api/analyze/route.ts`: it is doing orchestration, category/routing, scam classification, stable-fact gating, contradiction normalization, confidence calibration, prompt assembly, model calling, parsing, fallback generation, and final response shaping in one file. The runtime is effectively a policy engine plus a transport layer in the same place.

The benchmark history confirms the current weak spots:

- stable-fact decisiveness is still fragile on false facts
- scam labeling is still too easy to collapse into generic caution
- current-news wording is still easy to over-genericize
- contradiction summaries and final verdicts can drift apart

## Current Architecture Map

Current runtime pipeline:

`claim input` -> `routing/category detection` -> `retrieval` -> `source ranking` -> `evidence-strength + contradiction signals` -> `confidence calibration` -> `prompt construction` -> `OpenAI call` -> `JSON parsing / recovery` -> `normalization passes` -> `response JSON`

The concrete flow is:

1. `POST` in `app/api/analyze/route.ts` sets a hard route timeout and calls `analyzeRequest`.
2. `analyzeRequest` parses the claim, detects category, computes stable-fact hints, and builds retrieval queries.
3. `lib/retrieval.ts` performs Tavily retrieval and category-aware query expansion.
4. `lib/sourceRanker.ts` ranks evidence and derives source credibility plus contradiction signals.
5. `route.ts` computes evidence strength, scam signals, health risk, current-news flags, and confidence calibration.
6. `route.ts` sends one OpenAI chat completion with `lib/systemPrompt.ts` plus a long inline user prompt.
7. The model response is parsed or recovered into structured JSON.
8. Multiple normalization layers rewrite verdicts, contradiction summaries, evidence cards, and operational wording.
9. Final fallback paths handle missing evidence, timeouts, missing API keys, and malformed output.

Key files:

- `app/api/analyze/route.ts` is the central orchestrator and policy engine.
- `lib/retrieval.ts` owns retrieval, category detection, and query construction today.
- `lib/sourceRanker.ts` owns source credibility plus contradiction signal detection today.
- `lib/systemPrompt.ts` is instruction text only, but it mirrors a lot of the runtime policy.
- `benchmarks/runBenchmark.ts` is a harness, not a scorer. The actual benchmark interpretation lives in the markdown reports.

## Current Complexity Problems

| Problem | Where it shows up | Why it matters |
|---|---|---|
| Route file is doing too much | `app/api/analyze/route.ts` | The route is roughly 7.8k lines and mixes orchestration with policy logic, so changes are hard to reason about safely. |
| Claim routing is split across files | `lib/retrieval.ts`, `app/api/analyze/route.ts` | Category detection, civic rumor handling, current-news handling, and routing buckets are defined in more than one place. |
| Scam taxonomy is duplicated | `classifyScamPattern`, `detectScamSignals`, `buildExplicitScamLanguage`, `getScamPatternReason`, `getScamVerdictLabel`, `getScamRiskLevel` in `route.ts` | The same cue families are encoded repeatedly, so a future edit can fix one path and silently miss another. |
| Stable-fact logic is layered in many passes | `validateStableFactRelation`, `hasDeterministicStableFactContradiction`, `applyStableFactNormalization`, `applyFinalStableFactSafeguard`, `normalizeVerdictFromEvidence` | This is the most behavior-sensitive area in the codebase and the easiest place to reintroduce false corroboration. |
| Contradiction logic has multiple owners | `lib/sourceRanker.ts` and several normalization functions in `route.ts` | The contradiction signal, contradiction summary, and contradiction normalization are not owned by one module. |
| Confidence control is repeated | `calibrateConfidence`, `adjustCalibrationForEvidence`, `buildConfidenceCapReason`, `applyConfidenceCaps`, `evaluateConfidenceCaps`, `finalizeAnalysis` | Confidence ceilings are safety-critical. Repeating them in different layers makes regressions more likely. |
| Wording normalization is scattered | `normalizeOperationalLanguageText`, `normalizeOperationalLanguage`, `normalizeResponseText`, `normalizeResponseState`, `applyOperationalTrustNormalization` | The same wording policies are applied several times, which is useful for defense in depth but hard to maintain. |
| Benchmark scoring is external | `benchmarks/runBenchmark.ts` plus benchmark reports | The harness extracts response fields, but quality scoring is manual and lives in markdown reports, not in code. |
| Some helpers look unused | `deriveConflictingSignals` in `lib/sourceRanker.ts` | This export appears unused in the current repo search, which suggests dead surface area or an unnecessary alias. |

## Duplicated / Overlapping Logic

### Claim routing

- `lib/retrieval.ts` detects category and builds category-aware retrieval queries.
- `app/api/analyze/route.ts` also classifies routing buckets with separate heuristics for scam, civic rumor, breaking news, and statistical overreach.
- Result: routing logic is split between retrieval and orchestration.

### Scam detection

- Scam cues appear in `classifyScamPattern`, `detectScamSignals`, `hasDirectScamIndicators`, `buildExplicitScamLanguage`, `getScamPatternReason`, `getScamVerdictLabel`, `getScamRiskLevel`, and `applyScamNormalization`.
- The same families repeat: KYC pressure, OTP/PIN/password requests, payment extraction, reward bait, chain-forward manipulation, impersonation, and suspicious links.
- `lib/systemPrompt.ts` repeats the same policy in instruction form.

### Stable-fact handling

- Direct support and direct contradiction are checked in several ways: `hasClaimSpecificStableFactSupport`, `hasDeterministicStableFactContradiction`, `hasDirectStableFactSupport`, `applyStableFactNormalization`, `applyFinalStableFactSafeguard`, and `normalizeVerdictFromEvidence`.
- The route has both deterministic anchors and evidence-driven safeguards, which is good for safety but very easy to break if simplified casually.

### Contradiction handling

- `lib/sourceRanker.ts` detects contradiction signals.
- `route.ts` then normalizes contradiction summaries, applies contradiction state rewrites, and rewrites contradictions again in response-state normalization.
- This is a classic two-source-of-truth problem.

### Confidence caps

- `calibrateConfidence` produces a base calibration.
- `adjustCalibrationForEvidence` changes it based on evidence quality.
- `evaluateConfidenceCaps` and `applyConfidenceCaps` enforce ceilings.
- `finalizeAnalysis` clamps the final score and may rewrite verdict language.
- This is one safety policy expressed four different ways.

### Wording normalization

- `normalizeOperationalLanguageText`, `chooseOperationalText`, `normalizeOperationalAnalysisPayload`, `normalizeOperationalLanguage`, `normalizeResponseText`, `normalizeResponseState`, `applyOperationalTrustNormalization`, and `applyRoutingSeparationNormalization` all rewrite the same output surface.
- This is intentional defense in depth, but it is also the easiest place to create contradictory phrasing.

## Behavior-Critical Code That Must Not Be Changed Casually

- Confidence caps: `calibrateConfidence`, `adjustCalibrationForEvidence`, `applyConfidenceCaps`, `evaluateConfidenceCaps`, and `finalizeAnalysis` are the main guardrail against overconfidence.
- False stable-fact protection: `applyStableFactNormalization` and `applyFinalStableFactSafeguard` are the main guardrails against false corroboration.
- Hallucination safeguards: `normalizeAnalysis`, `buildAnalysisFromModelText`, `buildFallbackPayload`, `buildTimedOutAnalysis`, `normalizeResponseState`, and the fallback branches in `analyzeRequest` prevent malformed or speculative outputs from surfacing as valid results.
- Scam escalation: `classifyScamPattern`, `detectScamSignals`, `applyScamNormalization`, `getScamRiskLevel`, and `getScamVerdictLabel` are the main scam-specific safety layer.
- Contradiction consistency: `normalizeContradictionSummary`, `applyNormalizedContradictions`, `normalizeOperationalTrustNormalization`, and `normalizeResponseState` keep contradictions aligned with the final verdict.
- Timeout and fallback handling: `withTimeout`, the route timeout wrapper, `buildRouteTimeoutResponse`, `buildTimedOutAnalysis`, and the no-evidence branches in `analyzeRequest` are part of the reliability contract.
- One-call architecture: the model is called once per request, then all safety corrections happen after parsing. That property should be preserved until parity is proven elsewhere.

## Proposed Simplified Architecture

Target structure:

| Module | Responsibility | Current code that should move there |
|---|---|---|
| `app/api/analyze/route.ts` | Orchestration only | Request intake, timeout handling, module calls, response return |
| `lib/retrieval.ts` | Evidence fetching only | Tavily client, search execution, dedupe, retrieval timeout |
| `lib/sourceRanker.ts` | Source credibility only | Domain trust scoring and evidence ranking |
| `lib/claimRouter.ts` | Claim category/risk routing only | Claim category detection, civic rumor detection, current-news detection, routing bucket selection |
| `lib/scamSignals.ts` | Scam/phishing taxonomy only | Scam pattern cues, scam labels, scam risk mapping, explicit scam language |
| `lib/stableFacts.ts` | Deterministic stable-fact guards only | Stable-fact anchors, direct support, direct contradiction, and strict corroboration rules |
| `lib/contradiction.ts` | Contradiction signal + normalization only | Contradiction detection, contradiction item normalization, contradiction summary rules |
| `lib/confidence.ts` | Confidence caps and calibration only | Calibration base, confidence ceilings, confidence-floor rules, cap reasons |
| `lib/wording.ts` | Operational wording normalization only | Phrase normalization, caution phrasing, non-generic wording rewrites |
| `lib/responseNormalizer.ts` | Final response schema and consistency only | Last-pass schema shaping, field defaults, and contract preservation |
| `lib/systemPrompt.ts` | Model instruction text only | Prompt content only, no runtime policy logic |

Design principle:

- Pure classification and policy helpers should be separated from transport and OpenAI call orchestration.
- Any logic that can be expressed as a pure function should move out of `route.ts` first.
- The route should call modules in a fixed order and never re-derive the same signals in-line.

## Safe Refactor Roadmap

| Step | Files touched | Exact purpose | Risk level | Validation required | Benchmark to run afterward |
|---|---|---|---|---|---|
| 1 | `lib/claimRouter.ts`, `app/api/analyze/route.ts`, `lib/retrieval.ts` | Extract claim category and routing bucket logic into one pure module and pass category into retrieval instead of rediscovering it. | Low | `npm run lint`, `npm run build`, spot-check that routed verdict vocabulary stays unchanged | Re-run the 50-claim benchmark harness and compare against `benchmarks/BENCHMARK_50_REPORT.md` |
| 2 | `lib/scamSignals.ts`, `app/api/analyze/route.ts`, `lib/systemPrompt.ts` | Move scam/phishing taxonomy into one module and keep the prompt aligned without changing its intent. | Medium | `npm run lint`, `npm run build`, scam-focused spot checks for KYC, OTP, payment extraction, reward bait, chain-forward, and impersonation claims | Compare against `benchmarks/BENCHMARK_300_V2_REPORT.md` scam rows |
| 3 | `lib/stableFacts.ts`, `app/api/analyze/route.ts`, `lib/retrieval.ts` | Move deterministic stable-fact guards and anchors into one module while preserving false-corroboration protection. | High | `npm run lint`, `npm run build`, relation-validation checks for false stable facts and true stable facts | Re-run `benchmarks/BENCHMARK_RELATION_VALIDATION_REPORT.md` style cases |
| 4 | `lib/contradiction.ts`, `lib/sourceRanker.ts`, `app/api/analyze/route.ts` | Separate contradiction signal detection from source credibility and response normalization. | High | `npm run lint`, `npm run build`, verify contradiction level, summary, and items remain aligned | Re-run the 50-claim benchmark and a contradiction-heavy subset from the 300 V2 set |
| 5 | `lib/confidence.ts`, `app/api/analyze/route.ts` | Centralize calibration, caps, and cap reasons so overconfidence rules are in one place. | High | `npm run lint`, `npm run build`, verify that capped scores, labels, and reasons stay monotonic | Re-run the 300 V2 adversarial benchmark |
| 6 | `lib/wording.ts`, `lib/responseNormalizer.ts`, `app/api/analyze/route.ts` | Move text rewrites and final schema consistency into dedicated post-processing modules. | Medium | `npm run lint`, `npm run build`, frontend smoke test for `app/page.tsx` schema consumption | Re-run the 50-claim benchmark and a few live UI submissions |
| 7 | `app/api/analyze/route.ts` | Reduce the route to a thin orchestrator that only wires modules together. | Medium | `npm run lint`, `npm run build`, full benchmark pass after all prior parity checks | Re-run both the 50-claim benchmark and the 300 V2 adversarial benchmark |

## What Should Not Be Simplified Yet

- Do not collapse the final safety passes into a single helper until each extracted module has parity coverage.
- Do not remove the current one-call architecture.
- Do not change `lib/systemPrompt.ts` wording in this task. The prompt is already part of the safety envelope and should only be adjusted after module extraction is stable.
- Do not alter benchmark files or benchmark labels.
- Do not weaken the deterministic stable-fact guards, even if they look repetitive.
- Do not remove fallback branches that preserve a structured response when retrieval or model output fails.
- Do not change the response contract fields used by the UI: `verdict`, `confidence`, `sourceCredibility`, `corroborationLevel`, `contradictions`, `evidence`, `operationalGuidance`, `claimDecomposition`, and `retrievedAt`.

## Top 5 Highest-Risk Areas

| Risk area | What could regress | Why it is dangerous |
|---|---|---|
| False stable facts marked `Corroborated` | A false relation could regain decisive support | This is the most visible correctness failure and the hardest to catch after the fact |
| Overconfidence | Confidence ceilings could drift upward or stop applying | That would make weak evidence look safer than it is |
| Hallucinations | The system could start inventing specifics when evidence is weak or missing | This is especially dangerous for breaking-news and health claims |
| Weak scam detection | Scam messages could fall back to generic uncertainty instead of explicit risk labels | That would reduce the operational usefulness of the system |
| Broken frontend schema | Missing or renamed fields could break `app/page.tsx` rendering or make results hard to consume | The UI expects a stable structured response |

## Benchmark Signals That Justify the Cleanup

- `benchmarks/BENCHMARK_REPORT.md` says the system is safe enough for limited private beta, but still too generic on scam and current-news claims.
- `benchmarks/BENCHMARK_300_REPORT.md` shows generic caution, weak retrieval on stable facts, and scam handling that is not explicit enough.
- `benchmarks/BENCHMARK_300_V2_REPORT.md` shows the most important failures: false stable facts marked corroborated, weak scam labeling, and occasional bad verdicts on scam rows.
- `benchmarks/BENCHMARK_RELATION_VALIDATION_REPORT.md` shows that the false-stable-fact set can be held at zero while still leaving some contradiction subtypes weaker than ideal.

## Recommended First Refactor Task

Start with `lib/claimRouter.ts`.

Move the pure routing logic first:

- category detection
- current-news detection
- civic-rumor detection
- routing bucket selection
- routing bucket summary text

Why this first:

- it is the cleanest extraction boundary
- it reduces duplicate claim classification between `route.ts` and `lib/retrieval.ts`
- it does not touch the most brittle stable-fact or confidence code yet
- it gives later refactors a single source of truth for routing inputs

## Validation Plan

For each extraction step:

1. Run `npm run lint`.
2. Run `npm run build`.
3. Re-run the benchmark or slice named in the roadmap for that step.
4. Compare verdict distribution, confidence caps, contradiction summaries, and scam labels against the existing benchmark reports.

For the final cleanup pass:

- run the 50-claim benchmark harness
- run the 300 V2 adversarial benchmark
- manually inspect a small set of false-stable-fact, scam, and breaking-news rows
- confirm the UI still renders the same structured fields

## Notes

- `app/api/analyze/route.ts` currently owns too many heuristics, but that does not mean the heuristics are wrong. Most of them are safety-critical and should be moved, not removed.
- `lib/sourceRanker.ts` is not a bad module. It is just doing two jobs today: source credibility and contradiction detection.
- `lib/retrieval.ts` is not just retrieval. It also owns category logic that belongs in routing.
- The benchmark reports are the strongest evidence for what must stay conservative.
