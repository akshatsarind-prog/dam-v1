# DAM Response Normalizer Pass 2 Report

Scope: targeted stable-fact false-contradiction fix only.

## Files Changed

- `app/api/analyze/route.ts`
- `benchmarks/DAM_RESPONSE_NORMALIZER_PASS_2_REPORT.md`

## Exact Guard Added

A narrow final consistency guard was added inside `responseNormalizer()` after the existing stable-fact normalization and safeguard passes.

The guard now:

- looks at the final normalized output
- checks for `Likely incorrect`, `High` contradiction level, or contradiction text that implies direct contradiction
- verifies that there is no deterministic mismatch signal
- verifies that no known false stable-fact anchor matched
- downgrades only when the contradiction still looks like weak or missing support rather than a real factual mismatch

When it triggers, the guard rewrites the output to:

- `verdict: Evidence insufficient`
- `confidence.score` capped at `40`
- `confidence.label` set to `Weak` or `Moderate` based on the capped score
- `reason` and `reasoning`: `Retrieved sources do not provide direct support for the claim.`
- `contradictions.level: Low`
- `contradictions.summary: No direct contradiction was identified in retrieved evidence.`
- `contradictions.label: Insufficient verification`
- `corroborationLevel.label: Insufficient verification`

## Where It Runs

The guard runs at the end of `responseNormalizer()` in `app/api/analyze/route.ts`, immediately after the existing mode-specific normalization chain returns its final `Analysis`.

Location:

- `app/api/analyze/route.ts:6253`
- `app/api/analyze/route.ts:6256`

## Smoke Test Outputs

Smoke was run against the built route module directly via `mod.default.routeModule.userland.POST`, which exercises the real route code without adding any extra OpenAI calls.

### True Common Facts

- `Mount Everest is the tallest mountain above sea level.` -> `Evidence insufficient`, contradiction `Low`
- `Australia is both a country and a continent.` -> `Evidence insufficient`, contradiction `Low`
- `The human body has 206 bones in adulthood.` -> `Evidence insufficient`, contradiction `Low`

### False Stable Facts

- `The Eiffel Tower is located in Berlin.` -> `Likely incorrect`, contradiction `High`
- `Toronto is the capital of Canada.` -> `Likely incorrect`, contradiction `High`
- `The Sun revolves around Earth.` -> `Likely incorrect`, contradiction `High`
- `Water boils at 50°C at sea level.` -> `Likely incorrect`, contradiction `High`

### Scam

- `Your SBI account will be blocked tonight unless KYC is updated immediately.` -> `Fake KYC urgency`, contradiction `Low`

## Validation Results

- `npm run lint`: passed
- `npm run build`: passed

## One-Call Architecture

Confirmed preserved.

- No additional OpenAI call was added.
- The route still uses one model call per request.

## Post-Wrapper Mutations

Confirmed none exist.

After `responseNormalizer()` returns, the route only logs timing and final-response metadata and then returns the JSON response.

## Notes

- The new guard is intentionally narrow.
- Deterministic false stable facts remain high-contradiction.
- True common facts no longer fall into `Likely incorrect` when the final contradiction is only a weak or missing-support artifact.
