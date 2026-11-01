---
"clava": patch
---

Fixed declaration emit errors (TS4023, TS4058, and TS2883) when a project with `declaration: true` exports the [`cv`](https://clava.style/docs/reference/cv) or [`cx`](https://clava.style/docs/reference/cx) that [`create`](https://clava.style/docs/reference/create) returns, [`splitProps`](https://clava.style/docs/reference/split-props), a recipe's `.jsx`, `.html`, `.htmlObj`, `.class`, or `.style` helper, or the result of `.jsx.style()` or `.htmlObj.style()`. The package now exports the [`ModalRecipe`](https://clava.style/docs/reference/modal-recipe), [`RecipeProps`](https://clava.style/docs/reference/recipe-props), [`SplitPropsFunction`](https://clava.style/docs/reference/split-props-function), [`JSXCSSProperties`](https://clava.style/docs/reference/jsx-css-properties), and [`HTMLCSSProperties`](https://clava.style/docs/reference/html-css-properties) types.
