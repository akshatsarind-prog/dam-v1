# DAM Real Failure Audit — 2026-05-31

## 1. Summary verdict

Production behavior needs code changes.

Biggest root cause: retrieval is over-constrained to category-default trusted domains before entity/exam grounding is proven, and the pipeline later treats that mismatched evidence as if it were high-quality claim evidence.

In both audited failures, the first bad step is retrieval/query shaping:

- General claims default to `Britannica/Wikipedia` and `britannica.com` (`lib/retrieval.ts:57`, `lib/retrieval.ts:383`, `lib/retrieval.ts:451`).
- Breaking-news person-death claims default to Reuters/AP/BBC without any exact-entity gate (`lib/claimRouter.ts:153`, `lib/retrieval.ts:57`, `lib/retrieval.ts:109`).
- Ranking and normalization trust the source domain too early and do not degrade evidence quality when the retrieved page is about the wrong entity or wrong topic (`lib/sourceRanker.ts:32`, `lib/sourceRanker.ts:225`, `app/api/analyze/route.ts:5102`, `app/api/analyze/route.ts:6360`).

Raw model output was not available in repo logs or persisted artifacts, so this audit can only infer model-stage behavior from final responses and the surrounding code path.

## 2. Failure 1: Andrej Karpathy entity mismatch

### Reproduction status

Exact input `andrej karpathy is dead` did not return evidence in the live run and fell back to:

- Verdict: `Evidence insufficient`
- Evidence: `[]`
- Retrieval queries in output: `["andrej karpathy is dead"]`

Variant inputs reproduced the underlying weakness:

- `andrej karpathy died`
- `andrej karpathy death`

Both returned mixed Reuters evidence including:

- Relevant:
  - `OpenAI researcher Andrej Karpathy departs firm | Reuters`
  - `Former OpenAI, Tesla engineer Andrej Karpathy starts AI education platform | Reuters`
- Irrelevant:
  - `Czech Republic likely to miss NATO defence-spending target, PM tells FT - Reuters`
  - `April shipments of foreign-branded phones in China up 1.8% Y/Y, CAICT data shows - Reuters`

Final normalized verdict for those live variants:

- `Verification incomplete`
- Reasoning centered on missing authoritative confirmation
- But confidence drivers still included `Retrieved evidence directly supports the claim.`

That driver is materially wrong for a death claim when none of the cited sources say he died.

### Route/category selected

`andrej karpathy died` is routed as breaking news because death wording matches `BREAKING_NEWS_CUES` (`lib/claimRouter.ts:153`, `lib/claimRouter.ts:685`, `lib/claimRouter.ts:729`).

### Retrieved queries

Observed on returned evidence objects:

- `andrej karpathy died Reuters`
- `andrej karpathy died Reuters AP BBC`

This comes from:

- breaking-news hinting in `buildRetrievalQueries(...)` (`lib/retrieval.ts:291`)
- then `buildTargetedQuery(...)` appending `Reuters` (`lib/retrieval.ts:109`)

### Source/title/domain inspection

Observed domains were all `reuters.com`, which the system scores as high trust (`lib/sourceRanker.ts:225`).

Problem: trust is awarded purely by domain, not by exact person match.

### Whether sources matched the exact entity

Mixed:

- Reuters pages about Andrej Karpathy matched the exact entity.
- Reuters pages about unrelated topics did not.

The current pipeline has no person-entity grounding stage that says:

- source mentions `Andrej` only -> weak
- source mentions `Andrej Karpathy` or a strong alias cluster (`Karpathy`, `OpenAI`, `Tesla`, `Stanford`, `Eureka Labs`, possibly `Anthropic`) -> usable

### Where the wrong behavior entered

1. Retrieval accepted any Reuters result for the search string because breaking-news preferred-domain retrieval has no entity post-filter (`lib/retrieval.ts:451`).
2. Ranking preserved irrelevant Reuters pages because all Reuters pages are scored as high trust and there is no entity mismatch penalty (`lib/sourceRanker.ts:225`, `lib/sourceRanker.ts:299`).
3. Evidence-strength logic is too loose. It can label evidence as supporting if high-trust pages contain some overlapping terms and generic support cues, even when they do not state the claim relation (`app/api/analyze/route.ts:5102`).
4. Operational normalization can then rewrite the output using evidence-strength summaries that overstate support, which explains the bad driver `Retrieved evidence directly supports the claim.` despite no death confirmation (`app/api/analyze/route.ts:2731`, `app/api/analyze/route.ts:7960`).

### Exact root cause hypothesis

Primary: person-entity grounding failure.

Combination:

- retrieval query weakness
- entity mismatch
- source ranking weakness
- confidence/evidence-strength overreach
- final normalization using over-broad support summaries

### Response normalizer impact

Yes, it can make this failure worse.

`hasDirectClaimSupport(...)` is relatively strict for death claims because it requires death terms (`app/api/analyze/route.ts:4992`), but `classifyEvidenceStrength(...)` is looser and `getOperationalTrustSummary(...)` can emit `Retrieved evidence directly supports the claim.` from broad keyword overlap plus source trust (`app/api/analyze/route.ts:5102`, `app/api/analyze/route.ts:2731`).

That creates an internal contradiction:

- direct claim support is effectively false
- narrative layer still says direct support exists

## 3. Failure 2: NET paper leak retrieval/calibration failure

### Reproduction status

This failure is fully reproducible live.

#### Input: `net paper was leaked`

Observed final output:

- Verdict: `Likely incorrect`
- Confidence: `35`
- Source credibility: `High`
- Contradiction summary: `Retrieved evidence conflicts with established factual records.`

Observed retrieved evidence:

- `Video of What is net neutrality? | Britannica`
- `paper Facts | Britannica`
- `Wikipedia | Britannica`

Observed query on evidence:

- `net paper was leaked Britannica/Wikipedia`

This is junk evidence, not exam-leak evidence.

#### Input: `UGC NET 2024 paper was leaked`

Observed final output:

- Verdict: `Evidence insufficient`

Observed retrieved evidence:

- `Wikipedia | Britannica`
- `net-winged beetle Facts | Britannica`
- `paper chromatography | Britannica`

Observed query on evidence:

- `UGC NET 2024 paper was leaked Britannica/Wikipedia`

#### Input: `UGC NET June 2024 paper was leaked`

Observed final output:

- Verdict: `Evidence insufficient`

Observed retrieved evidence:

- `Wikipedia | Britannica`
- `June | Britannica`
- `June | Britannica`

Observed query on evidence:

- `UGC NET June 2024 paper was leaked Britannica/Wikipedia`

### Route/category selected

Two separate bad paths exist:

- `net paper was leaked`
  - retrieval category falls to `general` because there are no exam-specific cues (`lib/claimRouter.ts:625`)
  - general retrieval then injects `Britannica/Wikipedia` (`lib/retrieval.ts:57`, `lib/retrieval.ts:109`)

- `UGC NET 2024 paper was leaked`
  - the presence of `2024` makes `isStableFactCandidate(...)` true because any 18/19/20xx year counts as stable-fact evidence (`lib/claimRouter.ts:526`)
  - but retrieval category still falls to `general`
  - result: an unresolved current-affairs exam leak gets treated with general encyclopedia/stable-fact assumptions

### Retrieved queries

From outputs and code path:

- Output decomposition only shows the raw claim because decomposition is not doing real entity/query analysis in this route path (`app/api/analyze/route.ts:8291`)
- Actual search query seen on evidence objects is transformed to `... Britannica/Wikipedia` by `buildTargetedQuery(...)` (`lib/retrieval.ts:109`)

### Why the wrong evidence was accepted

This is the clearest pipeline defect in the audit.

1. `getPreferredDomains('general')` returns `britannica.com` (`lib/retrieval.ts:383`).
2. `retrieveEvidence(...)` takes only the first preferred domain for non-office-holder claims (`lib/retrieval.ts:451`).
3. It searches that preferred domain first.
4. If `preferredResults.length` is non-zero, it returns those results and never broadens to the web (`lib/retrieval.ts:451`).

For `net paper was leaked`, Britannica happily returns pages for:

- `net`
- `paper`
- `Wikipedia`

Those are not exam evidence, but the retrieval layer treats them as successful.

### Source ranker behavior

`britannica.com` is treated as high trust via `HIGH_TRUST_REFERENCE_DOMAINS` (`lib/sourceRanker.ts:32`, `lib/sourceRanker.ts:225`).

That is reasonable for settled encyclopedia facts, but disastrous for:

- unresolved exam leaks
- acronym-heavy Indian exam claims
- token-splitting errors like `net` -> `net neutrality` or `net-winged beetle`

There is no downranking for:

- acronym ambiguity
- wrong domain/topic class
- exact exam mismatch
- entity mismatch between claim and source

### Where the wrong behavior entered

For vague NET:

1. routing failed to recognize exam/news semantics and defaulted to `general` (`lib/claimRouter.ts:625`)
2. general retrieval forced `Britannica/Wikipedia` (`lib/retrieval.ts:57`, `lib/retrieval.ts:109`)
3. preferred-domain short-circuit locked in Britannica junk (`lib/retrieval.ts:451`)
4. ranker upgraded that junk to high-credibility evidence (`lib/sourceRanker.ts:225`, `lib/sourceRanker.ts:299`)
5. downstream model/normalizer converted weak mismatched evidence into `Likely incorrect`

For contextual UGC NET 2024:

1. year-based stable-fact detection incorrectly treated an unresolved exam leak as stable-fact-like (`lib/claimRouter.ts:526`)
2. retrieval still defaulted to general/Britannica
3. stable-fact language then polluted the confidence drivers with `Direct stable-fact support is absent.`

### Exact root cause hypothesis

Primary: retrieval domain/query weakness.

Combination:

- retrieval query weakness
- acronym/entity mismatch
- source ranking weakness
- routing leakage (`general` and `stable_fact` heuristics are both wrong for exam-leak claims)
- confidence calibration weakness
- final contradiction language overreach on mismatched evidence

### Response normalizer impact

Yes, especially for the vague `net paper was leaked` case.

The final `Likely incorrect` framing is too strong relative to the evidence quality. The system should have recognized:

- evidence is topic-mismatched
- exam/year/entity is unresolved
- `NET` could refer to multiple things

Instead, the normalized response surfaced:

- `High` source credibility
- `Direct contradiction detected`
- `Retrieved evidence conflicts with established factual records.`

That is not supported by the retrieved pages.

### Whether paper-leak claims are being treated as simple false rumors

Yes.

The codebase has no exam-specific handling for:

- `NET`
- `UGC-NET`
- `NEET`
- `CSIR-NET`
- `NTA`
- `CBI`
- cancellation/investigation/closure-report states

So the pipeline cannot distinguish:

- proven false rumor
- investigated allegation
- official cancellation due to integrity concerns
- unresolved or contested case

## 4. Raw model output / prompt evidence injection

### Evidence injected into the model

The model sees only short source titles and snippets from top 3 evidence items via `buildEvidenceContext(...)` (`app/api/analyze/route.ts:3165`).

For the NET failure, that means the model was given Britannica snippets about:

- net neutrality
- paper facts
- Wikipedia

For the Andrej variants, the model was given a mixture of:

- Reuters pages about Karpathy
- unrelated Reuters pages

### Prompt ambiguity

The system prompt does contain good language about direct support and not inferring from trusted-source presence (`lib/systemPrompt.ts`), but the prompt is not the primary failure.

The model is being asked to reason over bad evidence packs.

### Raw model output availability

Unavailable.

The route extracts `modelText` in-memory (`app/api/analyze/route.ts:9511`) but does not persist it. No repo artifact captured the raw model output for these runs.

## 5. Where in the pipeline the failure begins

### Failure 1

Begins in retrieval and ranking.

- breaking-news search is preferred-domain-first
- no exact-person/entity guard
- no alias-aware person validation

### Failure 2

Begins in retrieval even earlier than normalization.

- `general` -> `Britannica/Wikipedia`
- preferred-domain short-circuit on `britannica.com`
- no exam acronym disambiguation
- year-driven `stable_fact` leak for unresolved 2024 exam claims

## 6. Whether responseNormalizer made it worse

Yes, but it is secondary.

Most important cases:

- It can harden weak evidence into contradiction wording.
- It can emit support-flavored rationale from broad evidence-strength conditions even when `hasDirectClaimSupport(...)` is false.
- It does not have a guard that says “if entity/exam match is weak, cap verdict at uncertain/contested rather than contradiction.”

## 7. Whether sourceRanker allowed bad evidence through

Yes.

`sourceRanker` currently scores domain trust, not claim-source fit:

- Reuters gets high trust even if the article is about a different Andrej or an unrelated Reuters article.
- Britannica gets high trust even if the page is about `net neutrality`, `net-winged beetle`, `June`, or `paper chromatography`.

This is acceptable only if retrieval already guaranteed claim-source fit. It did not.

## 8. Whether retrieval queries need entity constraints

Yes.

This is mandatory for both failures.

### Person-death claims

Retrieval should require exact-entity or strong-alias evidence before trusting a source:

- `andrej karpathy`
- `karpathy`
- `openai`
- `tesla`
- `stanford`
- `eureka labs`
- `anthropic` only if currently relevant

A page matching only `Andrej` should be treated as weak/mismatched, not as trusted evidence.

### Exam leak claims

Retrieval should constrain the exam identity and dispute frame:

- `UGC NET`
- `UGC-NET`
- `NEET`
- `CSIR NET`
- `NTA`
- `CBI`
- `paper leak`
- `cancelled`
- `investigation`

And it must avoid expanding `NET` into generic dictionary/encyclopedia senses.

## 9. Whether final verdict calibration needs an uncertain/contested guard

Yes.

There should be a guard for:

- weak entity match
- exam acronym ambiguity
- unresolved official-investigation states
- cancellation-with-integrity-concerns states
- conflicting official vs reported evidence

For those cases, the system should prefer:

- `Unverified`
- `Evidence insufficient`
- `Missing context`
- or a contested/disputed evidence state

It should not jump to `Likely incorrect` unless strong reliable sources clearly deny the specific claim.

## 10. Minimal surgical fix options

Do not implement in this task. These are the smallest defensible follow-ups.

1. Add entity-fit gating before ranking/credibility promotion.
   - For person claims, require exact full-name or validated alias cluster match.
   - For exam claims, require exact exam-token family match.

2. Stop defaulting `general` retrieval to `Britannica/Wikipedia` for unresolved current-affairs claims.
   - Especially claims containing `leak`, `cancelled`, `investigation`, `paper`, `exam`, `NTA`, `CBI`, `NET`, `NEET`, `UGC`.

3. Remove preferred-domain short-circuit when the preferred-domain results are only token-overlap matches.
   - If `britannica.com` returns `net neutrality` for an exam leak claim, force broader retrieval.

4. Add topic/entity mismatch penalties in `sourceRanker`.
   - High-trust domain should not stay high-value evidence if claim-source fit is weak.

5. Tighten `classifyEvidenceStrength(...)` so “supporting” cannot come from trust + keyword overlap alone for person-death and rumor/news claims.

6. Add a final calibration guard:
   - if exact entity/exam match is weak, block `Likely incorrect`
   - downgrade to uncertain/contested output

7. Prevent year-only stable-fact routing for unresolved news/rumor topics.
   - `2024` alone should not make an exam-leak claim behave like a stable fact.

## 11. Files likely needing changes later

- `lib/retrieval.ts`
- `lib/sourceRanker.ts`
- `lib/claimRouter.ts`
- `app/api/analyze/route.ts`

Possible later prompt-only review after code fixes:

- `lib/systemPrompt.ts`

## 12. Files that must NOT be touched

Per current task constraints, not in this turn:

- production prompt text
- production retrieval behavior
- production source ranking
- production `responseNormalizer`
- architecture/model-call count

For the follow-up implementation pass, the user explicitly asked for surgical fixes. That means:

- do not add a new architecture
- do not add extra model calls
- do not patch unrelated benchmark flows first

## 13. Recommended next Codex implementation prompt

Use this prompt next:

> Implement a surgical fix for DAM retrieval/entity grounding only. Do not add new architecture or extra model calls. Fix two audited failures:
> 1. Person death claims must reject evidence that does not match the exact person or a validated alias cluster.
> 2. Exam leak claims must distinguish `NET`, `UGC-NET`, `NEET`, and `CSIR-NET`, avoid encyclopedia/topic drift, and prefer uncertain/contested outputs over `Likely incorrect` unless direct denial is retrieved.
> Scope changes to `lib/retrieval.ts`, `lib/sourceRanker.ts`, `lib/claimRouter.ts`, and only the smallest required guard code in `app/api/analyze/route.ts`.
> Do not change prompts. Do not add model calls. Do not run broad benchmarks. After changes, run only the agreed smoke set and report retrieved queries, top evidence, and final verdicts.

## 14. Validation plan after fix

Run only this smoke set first:

- `andrej karpathy is dead`
- `andrej karpathy died`
- `UGC NET 2024 paper was leaked`
- `NET paper was leaked in 2024`
- `NEET paper was leaked`
- `CSIR NET was postponed due to paper leak`
- one unrelated person death claim
- one unrelated exam rumor claim

For each smoke test, inspect:

- route category
- retrieval queries
- top 5 sources with title/domain/query
- exact entity/exam match quality
- whether preferred-domain short-circuit happened
- final verdict
- contradiction summary
- whether uncertainty/contested guard activated

Expected post-fix behavior:

- no Britannica generic-topic pages for exam leak claims
- no wrong-person evidence accepted for Karpathy claims
- no `Likely incorrect` on exam leak claims unless exact denial evidence exists
- ambiguous or contested exam leak claims land in uncertain/insufficient territory

## 15. Final assessment

### Biggest root cause

Preferred-domain-first retrieval without entity/topic grounding, especially:

- `general` -> `britannica.com`
- breaking-news person claims -> trusted wires without exact-person validation

### Whether production code change is needed

Yes.

### Safest first patch

Add an entity/topic-fit guard before ranking normalization:

- if person exact match is weak, mark evidence weak/mismatched
- if exam-token family does not match exactly, do not trust the source
- if preferred-domain results are mismatched, fall through to broader retrieval instead of returning them

### Lint/build status

Not run in this inspection task.
