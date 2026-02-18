---
name: ariakit-testing-instructions
description: Test authoring instructions for this repository. Use when adding or updating tests.
---

# Ariakit Testing Instructions

- Also write tests for invalid usage using `// @ts-expect-error` and runtime test assertions.
- When adding `// @ts-expect-error`, isolate the offending code as much as possible.
- If the error is on a value, put the value on its own line with the comment directly above it.

  ```ts
  const props = component({
    size:
      // @ts-expect-error
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
