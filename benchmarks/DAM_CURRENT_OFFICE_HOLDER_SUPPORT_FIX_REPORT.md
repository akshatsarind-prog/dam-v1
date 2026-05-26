# DAM Current-Office-Holder Support Fix Report

## Root Cause

The current-office-holder support path was still too permissive after the false-contradiction fix. It used title/snippet matching, but the phrase logic allowed indirect page references to count as direct support:

- `Vice President JD Vance` could be misread as `President JD Vance` because `president` appeared inside `vice president`.
- CEO support could fire on `Elon Musk is the CEO...` without requiring the claimed company target.
- Broad page text was previously part of the support signal, which let unrelated official mentions contaminate the result.

## Files Changed

- `app/api/analyze/route.ts`
- `benchmarks/DAM_CURRENT_OFFICE_HOLDER_SUPPORT_FIX_REPORT.md`

## Exact Support Guard Added

The support detector for `isCurrentOfficeHolder=true` now:

- looks only at `title` and `excerpt`
- requires an official/high-authority source domain
- requires a direct office-name phrase match, not broad page proximity
- uses a negative lookbehind for `president` so `vice president` cannot satisfy a `president` claim
- requires the target organization for CEO support
- keeps false-office-holder protection intact by refusing support when the title/snippet only mentions the person historically or in a different office

In practice:

- `President Donald J. Trump` can support the Trump president claim
- `Vice President JD Vance` can support the Vance vice-president claim
- `Prime Minister Narendra Modi` can support the Modi PM claim
- `Tim Cook is the CEO of Apple` can support the Apple CEO claim
- `Vice President JD Vance` does not satisfy a president claim
- `Elon Musk is the CEO...` does not satisfy `CEO of Apple`

## True Claim Results

Focused runtime smoke against `/api/analyze`:

| Claim | Result | Confidence | Evidence count | Official source | Notes |
| --- | --- | --- | --- | --- | --- |
| Donald Trump is the current president of the USA | Corroborated | Strong / 82 | 5 | Yes | Official White House support present |
| JD Vance is the current vice president of the USA | Corroborated | Strong / 82 | 5 | Yes | Official White House support present |
| Narendra Modi is the current Prime Minister of India | Corroborated | Strong / 82 | 4 | Yes | Official PM India support present |
| Keir Starmer is the current Prime Minister of the UK | Corroborated | Strong / 82 | 0 | No parsed top-level evidence in probe | Corroboration still returned; this looks like a response-shape quirk worth separate follow-up |
| Emmanuel Macron is the current President of France | Corroborated | Strong / 82 | 0 | No parsed top-level evidence in probe | Corroboration still returned; this looks like a response-shape quirk worth separate follow-up |
| Tim Cook is the current CEO of Apple | Corroborated | Strong / 82 | 5 | Yes | Apple support present |

## False Claim Protection Results

All false office-holder claims stayed uncorroborated:

- `Barack Obama is the current president of the USA` -> Evidence insufficient
- `JD Vance is the current president of the USA` -> Evidence insufficient
- `Donald Trump is the current Prime Minister of India` -> Evidence insufficient
- `Elon Musk is the current CEO of Apple` -> Evidence insufficient

No false office-holder claim was marked `Direct contradiction detected` or incorrectly corroborated in the final smoke run.

## Remaining Conservative Cases

- `Barack Obama is the current president of the USA` remained conservative, as expected.
- The UK and France probes corroborated, but the probe did not surface top-level evidence items in the parsed response, so that part of the response shape should be checked separately if needed.
- Generic current-event claims were not broadened by this fix.

## Validation

- `npm run lint` passed
- `npm run build` passed

## Constraints Preserved

- Response schema unchanged
- One-call architecture preserved
- Retrieval timeout unchanged
- Retrieval/provider logic unchanged
- Broad stable-fact behavior unchanged
- False-office-holder protection preserved
- Frontend/UI untouched
