---
"clava": minor
---

Removed `keys`

**BREAKING** if you're reading `keys` from [`cv`](https://clava.style/docs/reference/cv) components.

Use `propKeys` instead. `propKeys` is now the only API for style props plus variant props and has accurate HTML and HTML object types for libraries such as Solid's `splitProps`.

Before:

```ts
button.keys;
```

After:

```ts
button.propKeys;
```
