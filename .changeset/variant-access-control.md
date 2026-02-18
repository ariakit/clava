---
"clava": patch
---

Added access control for variants and variant values with `public`,
`protected`, and `private` levels.

This change supported `access` on variant definitions and on
`{ class, style }` variant values, and treated `access` as a special key on
object variants.

It enforced access restrictions for external variant props while still applying
protected/private variants when they are set internally through
`defaultVariants`, `setVariants`, and `setDefaultVariants`.

```ts
const base = cv({
  variants: {
    size: { access: "protected", sm: "text-sm", lg: "text-lg" },
  },
});

const button = cv({ extend: [base] });
button({ size: "lg" }); // type error + ignored at runtime
```
