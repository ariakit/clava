---
name: ariakit-testing
description: Test authoring instructions for this repository. Use when adding or updating tests.
---

# Ariakit Testing

- Also write tests for invalid usage using `// @ts-expect-error` and runtime test assertions.
- When adding `// @ts-expect-error`, isolate the offending code as much as possible.
- Keep helpful explanation text on `// @ts-expect-error` comments when possible.
- Both multiline forms are valid; choose based on where the error is reported.
- If the error is on a value, put the value on its own line with `// @ts-expect-error` directly above it.

  ```ts
  const props = component({
    size:
      // @ts-expect-error invalid size
      "sm",
  });
  ```

- If the error is on a property, isolate the property so `// @ts-expect-error` is directly above it, then add `// no error` (or another short non-error value comment) above the value line to keep the value isolated after `oxfmt`.

  ```ts
  const props = component({
    // @ts-expect-error invalid prop
    color:
      // no error
      "red",
  });
  ```

  `oxfmt` will handle the rest of the formatting.
