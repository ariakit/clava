---
"clava": minor
---

Removed the `defaultMode` option from `create()` and changed the default callable Clava component result to return normalized `{ class, style }` props.

Calling a component directly now always returns Clava's definition-compatible shape, with camelCase style keys and stringified values. Use `.jsx`, `.html`, or `.htmlObj` when a framework- or renderer-specific prop shape is needed.

Before:

```ts
const { cv } = create({ defaultMode: "htmlObj" });
const button = cv({ style: { fontSize: "16px" } });

button();
// { class: "", style: { "font-size": "16px" } }
```

After:

```ts
const { cv } = create();
const button = cv({ style: { fontSize: "16px" } });

button();
// { class: "", style: { fontSize: "16px" } }

button.htmlObj();
// { class: "", style: { "font-size": "16px" } }
```
