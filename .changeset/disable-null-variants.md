---
"clava": patch
---

Added support for disabling inherited variants and variant values with `null`.

```ts
const base = cv({
  variants: { size: { sm: "sm", lg: "lg" } },
  defaultVariants: { size: "sm" },
});

const button = cv({
  extend: [base],
  variants: { size: { sm: null } },
});

button({ size: "lg" }); // ✅
button({ size: "sm" }); // ❌ TypeScript error
```

Disabled variants and values are excluded from `defaultVariants`, resolved variant props, and applied classes/styles.
