---
"clava": patch
---

Variant props with a configurable recipe prop

Use [`VariantPropsWithRecipe`](https://clava.style/docs/reference/variant-props-with-recipe) to combine a recipe's variant props with a recipe prop. The prop is optional when the selected recipe type is assignable to the base type and required when it adds variants. The third type argument selects the prop name and defaults to `"recipe"`.

```ts
type DisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = VariantPropsWithRecipe<typeof disclosure, R>;

type StyledDisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = VariantPropsWithRecipe<typeof disclosure, R, "styles">;
```

Pass the selected recipe at runtime to apply its classes and styles. Choosing its type alone does not provide the recipe to the component.
