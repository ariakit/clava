---
"clava": patch
---

Fixed declaration emit errors (TS4023, TS4058, and TS2883) when a project with `declaration: true` exports the [`cv`](https://clava.style/docs/reference/cv) or [`cx`](https://clava.style/docs/reference/cx) that [`create`](https://clava.style/docs/reference/create) returns, or a recipe's `.jsx`, `.html`, or `.htmlObj` helper. The package now exports the [`ModalRecipe`](https://clava.style/docs/reference/modal-recipe) type.
