---
"clava": patch
---

Fixed the prop types of a [`cv`](https://clava.style/docs/reference/cv) recipe rejecting all values of a variant, or all its variants, when recipes in `extend` declare the same variant and one of them disables the variant or one of its values with `null`, or sets a conflicting boolean value.
