---
name: ariakit-workflow
description: Workflow instructions for this repository. Always use when planning or implementing changes to follow command and testing expectations.
---

# Ariakit Workflow

- Run `pnpm install` to install dependencies.
- Always run `pnpm lint`, `pnpm test`, and `pnpm build` before and after making changes to make sure everything still works.
- Always write tests for the behavior you add or change.
- Whenever you learn something new worth noting about workflow or code standards, make sure to update the agent’s skills.
- If a skill change updates code standards or formatting rules, apply the change across existing files in the repository so the codebase stays in sync with the skills.
- Add changesets in the `.changeset` folder for user-facing updates such as bug fixes, performance improvements, and new features. Refactors and other changes that do not affect shipped code should not require changesets.
- When you have access to CI, always check its output to see if there are any errors that need to be fixed.
