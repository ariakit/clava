---
"clava": patch
---

Debug attribute in development

In development, recipe results now include a `data-clava-debug` attribute. It lists the resolved variants, so you can inspect them in the browser's developer tools:

```html
<button data-clava-debug="size='lg' intent='primary'"></button>
```

When one recipe's output feeds another, for example through [`splitProps`](https://clava.style/docs/reference/split-props) in a wrapper component, the attribute lists the variants of every recipe. Those of the recipe that renders the element come first.

The attribute is added only when `NODE_ENV` is `"development"`, so test snapshots don't change. Use the new `debug` option of [`create`](https://clava.style/docs/reference/create) to change this. The attribute is never added in production.

```ts
const { cv } = create({ debug: true });
```

Clava now reads `process.env.NODE_ENV` when it's imported, not only when a recipe uses `refine` or computed defaults. Bundlers replace this expression. If you load Clava without a bundler, define `process.env.NODE_ENV` first.
