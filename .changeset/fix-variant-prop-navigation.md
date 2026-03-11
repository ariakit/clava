---
"clava": patch
---

Fixed TypeScript Go to Definition and Rename Symbol for variant props on Clava components.

The exported component prop types now preserve the original variant property symbols while still reading their allowed values from the fully merged variant definitions. This keeps editor navigation pointing back to the local `variants` object without regressing inherited variant merging or `null`-based disabling.
