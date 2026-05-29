# DAM V1 Cleanup Audit

Date: 2026-05-29
Workspace: `C:\Users\AKSHAT\projects\dam-v1`
Scope: inspection only

## Summary

- `npm run lint`: passed
- `npm run build`: passed
- No clear safe runtime-code removals were found in `app/api/analyze/route.ts`, active analyzer components, admin metrics services, retrieval, routing, prompts, source ranking, or benchmark runner logic.
- The safest cleanup opportunities are generated logs, local-only debug artifacts, and comment-only TODOs.
- `scripts/` does not exist in this repository, so there is nothing to audit there.

## 1. Safe-to-remove items

| Item | Exact files involved | Why it is safe | Risk | Runtime behavior could change |
| --- | --- | --- | --- | --- |
| Root startup and smoke logs | `.manual-start.log`, `.manual-start-3001.log`, `.manual-start-3002.log`, `.manual-start-3003.log`, `.next-admin-test.log`, `.public-scam-design-3016.log`, `.public-scam-design-3017.log`, `.public-scam-smoke-3015.log`, `.scam-auth-fix-smoke-3011.log`, `.scam-of-the-day-no-tavily-3010.log`, `.scam-of-the-day-smoke.log`, `.scam-of-the-day-smoke-2.log`, `.scam-supabase-smoke-3012.log`, `.scam-supabase-smoke-3013.log`, `.scam-supabase-smoke-3014.log`, `.start-3005.log`, `.start-3006.log` | Local run artifacts; not imported; not part of Next build or runtime | Low | No |
| Benchmark server log | `benchmarks/server_3000.log` | Captured server output only; not used by benchmark scripts or app runtime | Low | No |
| Benchmark run log | `benchmarks/benchmark_300_run.log` | Generated execution log; not consumed by runtime code | Low | No |
| Comment-only TODOs | `components/this-could-be-you/ThisCouldBeYouPage.tsx`, `components/this-could-be-you/ThisCouldBeYouCarousel.tsx` | Removes comments only; no code path changes | Low | No |

## 2. Needs-review items

These do not affect runtime behavior directly, but they may still carry documentation, benchmark-history, or workflow value.

| Item | Exact files involved | Why review is needed | Risk | Runtime behavior could change |
| --- | --- | --- | --- | --- |
| Generated benchmark outputs and reports | `benchmarks/benchmark_results.csv`, `benchmarks/benchmark_50_results.csv`, `benchmarks/benchmark_50_results.json`, `benchmarks/benchmark_50_scored.csv`, `benchmarks/benchmark_300_results.csv`, `benchmarks/benchmark_300_results.json`, `benchmarks/benchmark_300_scored_results.csv`, `benchmarks/benchmark_300_v2_results.csv`, `benchmarks/benchmark_300_v2_results.json`, `benchmarks/benchmark_300_v2_scored_results.csv`, `benchmarks/benchmark_relation_validation_results.csv`, `benchmarks/benchmark_relation_validation_results.json`, `benchmarks/benchmark_relation_validation_scored.csv`, `benchmarks/BENCHMARK_REPORT.md`, `benchmarks/BENCHMARK_50_REPORT.md`, `benchmarks/BENCHMARK_300_REPORT.md`, `benchmarks/BENCHMARK_300_V2_REPORT.md`, `benchmarks/BENCHMARK_RELATION_VALIDATION_REPORT.md` | Manual benchmark history is referenced by other benchmark docs and may still be wanted for comparisons | Medium | No |
| Benchmark analysis writeups | `benchmarks/DAM_300_FAILURE_AUDIT.md`, `benchmarks/DAM_300_SURGICAL_FIX_REPORT.md`, `benchmarks/DAM_CODEBASE_SIMPLIFICATION_REPORT.md`, `benchmarks/DAM_CONTRADICTION_CONSISTENCY_AUDIT.md`, `benchmarks/DAM_CONTRADICTION_SCORER_ALIGNMENT_REPORT.md`, `benchmarks/DAM_CURRENT_OFFICE_HOLDER_FIX_REPORT.md`, `benchmarks/DAM_CURRENT_OFFICE_HOLDER_RETRIEVAL_FAILURE_ANALYSIS.md`, `benchmarks/DAM_CURRENT_OFFICE_HOLDER_RETRIEVAL_VERIFICATION.md`, `benchmarks/DAM_CURRENT_OFFICE_HOLDER_RETRIEVAL_VERIFICATION.json`, `benchmarks/DAM_CURRENT_OFFICE_HOLDER_SUPPORT_FIX_REPORT.md`, `benchmarks/DAM_CURRENT_PRESIDENT_FAILURE_ANALYSIS.md`, `benchmarks/DAM_FINAL_OFFICE_HOLDER_RETRIEVAL_VERIFICATION.md`, `benchmarks/DAM_FINAL_OFFICE_HOLDER_RETRIEVAL_VERIFICATION.json`, `benchmarks/DAM_LIVE_OFFICE_HOLDER_FALSE_CONTRADICTION_FIX_REPORT.md`, `benchmarks/DAM_PIPELINE_REALITY_REPORT.md`, `benchmarks/DAM_RESPONSE_NORMALIZER_PASS_1_REPORT.md`, `benchmarks/DAM_RESPONSE_NORMALIZER_PASS_2_REPORT.md`, `benchmarks/DAM_RESPONSE_NORMALIZER_PASS_3_REPORT.md`, `benchmarks/DAM_RESPONSE_NORMALIZER_PASS_4_REPORT.md`, `benchmarks/DAM_RESPONSE_NORMALIZER_PLAN.md`, `benchmarks/DAM_RETRIEVAL_PROVIDER_FAILURE_FIX_REPORT.md` | Non-runtime, but some files document historical benchmark decisions and protected areas | Medium | No |
| Editorial or local content drafts | `drafts/scam-of-the-day/2026-05-28-bank-kyc-link.md` | Non-runtime, but may still be needed as editorial source material | Low | No |
| Local workspace images and notes | `mobile-beta-diagnose.png`, `DAM_V1_Build_Validation_Sprint.md`, `DAM_V1_Reliability_and_Instrumentation_Sprint.txt`, `DAM_V1_Reliability_and_Instrumentation_Sprint2.txt`, `CLAUDE.md` | Appear non-runtime and unreferenced by app code, but may still be useful project context | Low | No |
| Codex/Claude operating templates | `claude-reviews/*`, `codex-tasks/*`, `current-context/ai-context-pack.md` | Non-runtime, but these look like workflow support files rather than waste | Low | No |
| Duplicate helper implementations in admin surfaces | `app/admin/_components/AdminShell.tsx`, `app/admin/_components/AdminReportSystem.tsx`, `app/admin/_components/LifetimeIntelligence.tsx`, `lib/admin/adminReportModel.ts`, `lib/admin/adminReportExport.ts` | `formatDateTime`, `formatCount`, `formatRate`, `formatLatency`, `formatText`, and similar helpers are duplicated, but removal would require refactoring shared code | Medium | Possibly, if changed incorrectly |
| Repeated session-storage key constants | `app/admin/_components/AdminShell.tsx`, `app/admin/_components/AdminReportSystem.tsx`, `app/admin/ai-hq/page.tsx` | Duplicated constant only; safe consolidation would be a refactor, not pure deletion | Low | Possibly, if changed incorrectly |
| Potentially unused CSS selectors | `app/globals.css` | Text search did not prove any selectors were unused. Needs DOM-aware or JSX-aware confirmation before removal | Medium | Possibly |

## 3. Do-not-touch items

These are explicitly out of scope for cleanup in this pass, or too risky under the stated rules.

| Area | Exact files involved | Why it should not be touched |
| --- | --- | --- |
| Analyzer route and embedded normalizer | `app/api/analyze/route.ts` | Contains analyzer behavior, response normalization, retrieval/routing interactions, and Supabase logging. Even apparently redundant helpers or logs are not safe to remove in this task. |
| Retrieval, routing, prompt, ranking core | `lib/retrieval.ts`, `lib/claimRouter.ts`, `lib/systemPrompt.ts`, `lib/sourceRanker.ts` | Protected by task constraints. |
| Admin metric calculations | `lib/admin/adminMetricsService.ts`, `lib/admin/adminMetricsTypes.ts`, `lib/admin/adminReportModel.ts` | Protected by task constraints; behavior and calculations must remain unchanged. |
| Supabase logging behavior | `app/api/analyze/route.ts`, `lib/server/supabaseAdmin.ts`, `app/api/track/route.ts`, `app/api/beta-signup/route.ts` | Protected by task constraints. |
| Benchmark runner code | `benchmarks/runBenchmark.ts`, `benchmarks/dam_300_real_use_cases.ts`, `benchmarks/dam_300_v2_real_use_cases.ts`, `benchmarks/rescore_benchmark_50.py`, `benchmarks/rescore_contradiction_50.py` | Manual-only tooling, but still active benchmark logic and explicitly protected from behavioral changes. |
| Frontend UX surfaces | `components/analyzer/*`, `components/campaign/*`, `components/navigation/*`, `components/this-could-be-you/*`, `app/globals.css`, `app/admin/*` | UX changes are out of scope. Only comment-only cleanup is clearly safe. |

## 4. Additional inspection notes

### Unused imports and variables

- No clear unused imports or unused variables were surfaced by the current lint/build setup in active runtime code.
- `npm run lint` completed successfully with the current ESLint configuration.
- This repository does not enable a stricter dead-code pass such as unused-export analysis, so absence of lint errors is not proof that every export is used.

### Temporary console logs and debug-only code

- `benchmarks/runBenchmark.ts`, `benchmarks/dam_300_real_use_cases.ts`, and `benchmarks/dam_300_v2_real_use_cases.ts` contain `console.log` and `console.error`, but those are normal CLI output for manual benchmark scripts, not safe cleanup targets in this pass.
- `lib/retrieval.ts` contains `console.warn('[retrieval] search failed', ...)`; this is operational logging, not obviously temporary.
- `app/api/analyze/route.ts` contains route and Supabase error logging; do not touch under current constraints.

### Dead components

- No clearly dead component file was found under `components/` or `app/admin/_components/`.
- Spot checks confirmed active references for `CampaignLandingPage`, `ThisCouldBeYouPage`, `ThisCouldBeYouCarousel`, `DamMarketingHeader`, `DamUseCasesDropdown`, `DamAttributionTracker`, `BetaSignupCard`, `AdminReportSystem`, and `LifetimeIntelligence`.

### Duplicate files

- No true duplicate code files were confirmed.
- What does exist is duplicated helper logic across admin UI/report files; that is a refactor opportunity, not a safe delete-only opportunity.

## 5. Recommended cleanup order

1. Delete local root log files listed in the safe-to-remove section.
2. Delete `benchmarks/server_3000.log`.
3. Delete `benchmarks/benchmark_300_run.log`.
4. Remove the three comment-only TODOs in `components/this-could-be-you/*`.
5. Decide whether benchmark result files are archival records or disposable generated outputs.
6. Decide whether local workspace files like `mobile-beta-diagnose.png` and sprint notes should stay in-repo.
7. If desired later, plan a separate refactor-only pass for duplicated admin helpers.

## 6. Top 10 safest cleanup actions

1. Remove `.start-3005.log`
2. Remove `.start-3006.log`
3. Remove `.manual-start.log`
4. Remove `.manual-start-3001.log`
5. Remove `.manual-start-3002.log`
6. Remove `.manual-start-3003.log`
7. Remove `benchmarks/server_3000.log`
8. Remove `benchmarks/benchmark_300_run.log`
9. Remove the TODO comment in `components/this-could-be-you/ThisCouldBeYouPage.tsx`
10. Remove the two TODO comments in `components/this-could-be-you/ThisCouldBeYouCarousel.tsx`
