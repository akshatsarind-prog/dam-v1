# DAM Contradiction Scorer Alignment Report

## Class Counts
- consistent: 27
- acceptable_conservative: 16
- scorer_sensitive: 5
- wording_only: 1
- stale_metadata: 0
- actual_inconsistency: 1

## Actual Backend Inconsistencies
- #37 [manipulated_statistics] 100% of people who drank water eventually died. -> Likely incorrect / {"label": "Context dependent", "summary": "Evidence supports part of the claim, but the framing is broader than the evidence.", "level": "Moderate", "items": []}

## Notes
- Acceptable conservative rows are safe and should not count as contradiction failures.
- Scorer-sensitive rows are broad/contextual claims whose broad wording should not be penalized as high contradiction.
- Wording-only rows reflect thin or stale explanation text, not a backend contradiction bug.
- Stale metadata did not appear in this pass.

## Validation
- Lint: passed
- Build: passed
- One-call architecture preserved: yes
