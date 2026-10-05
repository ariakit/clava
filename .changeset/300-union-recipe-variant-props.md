---
"clava": patch
---

Union recipes accept only shared variants

[`VariantPropsWithRecipe`](https://clava.style/docs/reference/variant-props-with-recipe) now rejects a variant that only some members of a recipe union define. Before, a component could receive `recipe` as a union and a variant that the selected member does not define. That member then ignored the variant at runtime, and `splitProps` forwarded it to the element.

If you pass a union-typed recipe together with a variant that only some members define, narrow the recipe first so the variant belongs to a member that defines it:

```tsx
// Error: `disclosure` does not define `$placement`.
<Disclosure recipe={isNav ? navDisclosure : disclosure} $placement="top" />;

// Narrow the recipe before passing the variant.
const element = isNav ? (
  <Disclosure recipe={navDisclosure} $placement="top" />
) : (
  <Disclosure recipe={disclosure} />
);
```
