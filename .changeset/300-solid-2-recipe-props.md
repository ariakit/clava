---
"clava": patch
---

Fixed [`RecipeProps`](https://clava.style/docs/reference/recipe-props) to accept Solid 2 `class` values (including class objects and arrays) and `style: false`, and exported [`ClassPropValue`](https://clava.style/docs/reference/class-prop-value), so props returned by [`splitProps`](https://clava.style/docs/reference/split-props) from `@solidjs/web` component props can be passed back into recipes.
