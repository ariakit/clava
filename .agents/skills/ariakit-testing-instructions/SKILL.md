---
name: ariakit-testing-instructions
description: Test authoring instructions for this repository. Use when adding or updating tests.
---

# Ariakit Testing Instructions

- Also write tests for invalid usage using `// @ts-expect-error` and runtime test assertions.
- When adding `// @ts-expect-error`, isolate the offending code as much as possible.
- Keep helpful explanation text on `// @ts-expect-error` comments when possible.
- If the error is on a value, put the value on its own line with the comment directly above it.
- Add `// value` (or another short value-specific comment) above the value line to keep the value isolated after `oxfmt`.

  ```ts
  const props = component({
    // @ts-expect-error invalid size
    size:
      // value
      "sm",
  });
  ```

- If the error is on a property, isolate the property so the comment is directly above it.

  ```ts
  const props = component({
    // @ts-expect-error
    color:
      // value
      "red",
  });
  ```

  `oxfmt` will handle the rest of the formatting.
