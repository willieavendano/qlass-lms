# Agent Orchestration Plan

Qlass should use agents in two ways: to build the product faster and, later, as a product feature for teacher-reviewed course building.

## Development agents

Use a PR conveyor with clear roles:

- Triage agent: converts roadmap items and feedback into small GitHub issues.
- Spec agent: writes acceptance criteria and test plans.
- Code agent: opens focused PRs with one behavior change.
- Review agent: checks security, privacy, tests, and classroom UX.
- QA agent: runs smoke checks and records screenshots or logs.

Claude should handle larger architecture and implementation PRs. Hermes/Mac mini agents should handle smaller parallel work: issue grooming, docs, fixtures, competitor notes, test cases, and QA checklists.

## Product agents

For Qlass users, agents must remain teacher-reviewed. The near-term product path is:

1. Plan a unit from teacher input and course memory.
2. Draft classwork and materials.
3. Run an AI reviewer pass for clarity, grade level, source safety, and standards alignment.
4. Present editable drafts.
5. Publish only after teacher approval.

No student-facing autonomous AI should ship in alpha.
