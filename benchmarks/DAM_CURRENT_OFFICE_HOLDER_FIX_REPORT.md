# DAM Current Office Holder Fix Report

## Files Changed

- `lib/claimRouter.ts`
- `lib/retrieval.ts`
- `lib/sourceRanker.ts`
- `app/api/analyze/route.ts`

## Exact Route Added

Added a narrow routing signal in `lib/claimRouter.ts`:

- `isCurrentOfficeHolder: boolean`
- `detectCurrentOfficeHolderClaim(claim)`

Matched roles:
- `current president of ...`
- `current vice president of ...`
- `current prime minister of ...`
- `current chief minister of ...`
- `current governor of ...`
- `current CEO of ...`
- `current head of ...`
- `current leader of ...`

Behavior:
- office-holder claims now set `isCurrentOfficeHolder = true`
- they no longer inherit `isCivicRumor = true` from `retrievalCategory = government`
- they are treated as stable-fact-eligible in `app/api/analyze/route.ts` via:
  - `claimRoute.isStableFactCandidate || claimRoute.isCurrentOfficeHolder`

Non-matches remain unchanged:
- `A riot is currently happening in Delhi`
- other generic current-event claims

## Retrieval Query Changes

Added claim-aware office-holder retrieval in `lib/retrieval.ts`.

Current office-holder claims now bypass generic government query construction and emit targeted official queries.

Examples:

- `Donald Trump is the current president of the USA`
  - `site:whitehouse.gov President Donald Trump`
  - `site:usa.gov President Donald Trump`
  - `President Donald Trump official United States`

- `JD Vance is the current vice president of the USA`
  - `site:whitehouse.gov Vice President JD Vance`
  - `site:usa.gov Vice President JD Vance`
  - `Vice President JD Vance official United States`

- `Narendra Modi is the current Prime Minister of India`
  - `site:pmindia.gov.in Prime Minister Narendra Modi`
  - `site:india.gov.in Prime Minister Narendra Modi`
  - `Prime Minister Narendra Modi official India`

- `Keir Starmer is the current Prime Minister of the UK`
  - `site:gov.uk Prime Minister Keir Starmer`
  - `site:number10.gov.uk Prime Minister Keir Starmer`
  - `Prime Minister Keir Starmer official United Kingdom`

- `Emmanuel Macron is the current President of France`
  - `site:elysee.fr President Emmanuel Macron`
  - `site:gouvernement.fr President Emmanuel Macron`
  - `President Emmanuel Macron official France`

- `Tim Cook is the current CEO of Apple`
  - `site:apple.com leadership Tim Cook CEO`
  - `Apple leadership Tim Cook CEO`
  - `official Apple ceo Tim Cook`

Retrieval behavior changes:
- office-holder claims now execute up to 3 queries
- office-holder preferred-domain pass uses the matching official domains instead of default `gov.in`
- fallback retrieval still uses the existing one-call Tavily path

## Source Ranking Changes

Added current-office-holder ranking mode in `lib/sourceRanker.ts`.

Changes:
- preferred official domains are treated as `High` credibility for this route
- preferred official domains get a larger ranking bonus
- low-signal office-holder domains are sharply penalized:
  - `polymarket.com`
  - `polymarketanalytics.com`
  - `facebook.com`
  - `x.com`
  - `twitter.com`
  - `reddit.com`
  - `wizedu.com`
  - `coursehero.com`
  - `chegg.com`
  - `quora.com`
  - common blog platforms

Result:
- official pages outrank prediction markets, social posts, and answer-farm pages for this claim family

## Normalization Changes

Added an office-holder-specific bypass in `app/api/analyze/route.ts`.

Changes:
- `classifyRoutingBucket()` no longer leaks office-holder claims into `civic_rumor`
- `normalizeResponseState()` now special-cases current-office-holder claims
- weak or official-source-missing office-holder results now use:
  - `Official current-office source was not found in this retrieval pass.`
  - or `Retrieved current-office sources do not yet provide direct support for the claim.`

This replaces the wrong civic fallback:
- `Unsupported civic claim`
- `No authoritative reporting currently supports this claim.`

Evidence integrity changes:
- `corroborationLevel.sourceCount` is reduced to usable evidence count for this route
- `corroborationLevel.highCredibilityCount` reflects official-source count
- indicators now include:
  - `Official current-office source missing.`
  - `Weak retrieval.`
  - or `Usable current-office evidence count: N.`

## Why False Stable-Fact Protection Is Preserved

The fix does not make all `current` claims stable facts.

Protection preserved by design:
- routing only activates for narrow office-holder/leadership patterns
- generic `current` event claims still stay out of stable-fact handling
- corroboration still requires direct claim support plus official-domain evidence
- false office-holder claims are not auto-corroborated
- civic-rumor protections still apply to non-office-holder government rumors
- no prompt broadening, no extra model call, no schema change

## Smoke Test Results

Deterministic smoke check was run against routing, preferred-domain selection, query generation, and office-holder ranking behavior.

### Should Pass / Corroborate Path Enabled

- `Donald Trump is the current president of the USA`
  - route: `isCurrentOfficeHolder = true`
  - stable-fact eligibility: `true`
  - preferred domains: `whitehouse.gov`, `usa.gov`
  - queries target official US current-office pages

- `JD Vance is the current vice president of the USA`
  - route: `isCurrentOfficeHolder = true`
  - preferred domains: `whitehouse.gov`, `usa.gov`

- `Narendra Modi is the current Prime Minister of India`
  - route: `isCurrentOfficeHolder = true`
  - preferred domains: `pmindia.gov.in`, `india.gov.in`, `pib.gov.in`

- `Keir Starmer is the current Prime Minister of the UK`
  - route: `isCurrentOfficeHolder = true`
  - preferred domains: `gov.uk`, `number10.gov.uk`

- `Emmanuel Macron is the current President of France`
  - route: `isCurrentOfficeHolder = true`
  - preferred domains: `elysee.fr`, `gouvernement.fr`

- `Tim Cook is the current CEO of Apple`
  - route: `isCurrentOfficeHolder = true`
  - preferred domains: `apple.com`

### Should Not Corroborate Automatically

- `Barack Obama is the current president of the USA`
  - route still activates
  - official queries are targeted correctly
  - no auto-corroboration path exists without direct official support

- `Donald Trump is the current Prime Minister of India`
  - route activates
  - official India PM domains are targeted
  - still requires direct official support to corroborate

- `Elon Musk is the current CEO of Apple`
  - route activates
  - `apple.com` leadership queries are targeted
  - still requires direct company leadership support to corroborate

- `JD Vance is the current president of the USA`
  - route activates
  - White House / USA.gov queries are targeted
  - still requires direct official support to corroborate

### False-Positive Guard Check

- `A riot is currently happening in Delhi`
  - `isCurrentOfficeHolder = false`
  - stable-fact eligibility: `false`
  - route remains non-office-holder

### Ranking Smoke Check

Given mixed evidence:
- `whitehouse.gov`
- `polymarketanalytics.com`
- `facebook.com`
- `wizedu.com`

Current-office-holder ranking now orders:
1. `whitehouse.gov`
2. `polymarketanalytics.com`
3. `wizedu.com`
4. `facebook.com`

Important result:
- official source is first
- Facebook is last
- Polymarket no longer beats an official office page

## Remaining Risks

- The route is pattern-based and currently strongest for explicit `current ... of ...` wording.
- Generic wording like `Donald Trump is president of the United States` still depends on the older path.
- Company-domain inference is intentionally conservative; non-mapped multiword organizations may need additional explicit domain mappings later.
- End-to-end corroboration still depends on live retrieval returning matching official pages and snippets.

## Validation

- `npm run lint`: passed
- `npm run build`: passed

## Architecture Guardrails Preserved

- one-call architecture preserved
- no response schema change
- no benchmark scorer change
- no broad prompt rewrite
