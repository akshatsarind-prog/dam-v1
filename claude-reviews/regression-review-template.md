# Regression Review Template

## Original task

## Related failure cases

## Implementation summary

## Files changed

## Review objectives
- Check whether previous DAM failures could return through this change.
- Verify that failure-case coverage and regression tests are adequate.
- Flag any behavior that weakens trust, evidence quality, or verdict stability.

## Check for
- reintroduction of old DAM failures
- incomplete regression coverage
- fragile source handling
- verdict inconsistency
- hidden edge cases
- missing monitoring signals

## Required output
- approval status
- blocking regression issues
- non-blocking regression risks
- recommended fixes
- final verdict
