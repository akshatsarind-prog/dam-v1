# DAM AI HQ Operating System

## Purpose
DAM AI HQ is the personal operating system for building, improving, researching, and scaling DAM.

## Core rule
`dam-v1` is the product codebase.
`dam-ai-hq` is the command center.
Do not mix product code and operating documents unless explicitly needed.

## Standard workflow
1. Capture task.
2. Check current context.
3. Route task.
4. Run relevant agents.
5. Generate Codex task.
6. Run implementation.
7. Run Claude review.
8. Record result.
9. Update context.
10. Human approves high-risk actions.

## Automation levels
Safe automation:
- research
- summaries
- plans
- prompts
- reports
- drafts

Controlled automation:
- issue creation
- branch creation
- code changes on branch
- pull request drafts
- test runs

Approval-only:
- production deploy
- merge to main
- public posts
- emails to users
- database deletion
- legal/privacy changes

## Default agents
- Router Agent
- Strategy Agent
- Research Agent
- UX Agent
- Engineering Agent
- Risk Agent
- Codex Builder
- Claude Reviewer
- Final Synthesizer

## Output standard
Every major task should produce:
- verdict
- why it matters
- implementation plan
- Codex prompt
- Claude review prompt
- risks
- metrics to track
- next action
