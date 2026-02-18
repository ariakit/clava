---
name: ariakit-workflow-instructions
description: Workflow instructions for this repository. Use when planning or implementing changes to follow command and testing expectations.
---

# Ariakit Workflow Instructions

- Use `pnpm` commands for installing dependencies, running scripts, and validating changes.
- Always write tests for the behavior you add or change.
- Also write tests for invalid usage using `// @ts-expect-error` and runtime test assertions.
- When adding a changeset while the package is in `v0`, use `patch` for minor and patch-level changes, and use `minor` for major changes.
- Write changeset summaries in the past tense (for example, "Added", "Removed", "Fixed"), and end each sentence with a period.
- Add a multiline markdown description when needed (for example, for new features), and prefer TypeScript code examples.
