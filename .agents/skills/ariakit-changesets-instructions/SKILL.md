---
name: ariakit-changesets-instructions
description: Changeset authoring instructions for this repository. Use when creating or editing .changeset files.
---

# Ariakit Changesets Instructions

- Use a `kebab-case.md` filename that clearly relates to the change.
- While the package is in `v0`, mark minor and patch-level changes as `patch`, and mark major changes as `minor`. This only affects the change type in the frontmatter. The description should still accurately explain what changed (do not disguise features as bug fixes). For breaking changes, be sure to call them out and include before-and-after examples.
- Keep each changeset file as a single changelog entry.
- Use the first line as a past-tense summary sentence ending with a period.
- Follow the first line with natural-language present-tense details and examples when needed.
- Prefer TypeScript code examples.
