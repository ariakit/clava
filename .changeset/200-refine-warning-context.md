---
"clava": patch
---

Improved refine iteration warning with debugging context

When the [`refine`](https://clava.style/docs/reference/refine) iteration cap is hit, the development warning now lists the variant keys that did not stabilize and includes the stack trace of the [`cv`](https://clava.style/docs/reference/cv) call that defined the component. This makes it easier to find the offending component without searching through the codebase.

```txt
Clava: Maximum refine iterations exceeded. This can happen when a refine callback calls setVariants or setDefaultVariants, but one of the variants changes on every run.
Variant(s) that did not stabilize: size.
Component created at:
    at toolbarButton (src/components/toolbar.ts:42:18)
    ...
```

The frame is captured at component creation but formatted lazily, so component creation stays cheap unless the warning actually fires, and the capture is skipped entirely for components that cannot enter the refine loop. The whole warning is wrapped in a `process.env.NODE_ENV !== "production"` guard, so bundlers that inline that constant strip the warning machinery from production builds.
