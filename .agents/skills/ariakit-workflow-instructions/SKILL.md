---
name: ariakit-workflow-instructions
description: Workflow instructions for this repository. Always use when planning or implementing changes to follow command and testing expectations.
---

# Ariakit Workflow Instructions

## Commands

- Run `pnpm install` to install dependencies.
- Always run `pnpm lint`, `pnpm test`, and `pnpm build` before and after making changes to make sure everything still works.

## Tests

- Always write tests for the behavior you add or change.
- Also write tests for invalid usage using `// @ts-expect-error` and runtime test assertions.

## Changesets

- Add changesets in the `.changeset` folder for user-facing updates such as bug fixes, performance improvements, and new features.
- Refactors and other changes that do not affect shipped code should not require changesets.
- Use a `kebab-case.md` filename that clearly relates to the change.
- While the package is in `v0`, mark minor and patch-level changes as `patch`, and mark major changes as `minor`. This only affects the change type in the frontmatter. The description should still accurately explain what changed (do not disguise features as bug fixes). For breaking changes, be sure to call them out and include before-and-after examples.
- Write changeset summaries in the past tense (for example, "Added", "Removed", "Fixed"), and end each sentence with a period.
- Add a multiline markdown description when needed (for example, for new features), and prefer TypeScript code examples.

## CI

- When you have access to CI, always check its output to see if there are any errors that need to be fixed.
