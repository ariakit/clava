export interface RefineRunState {
  remaining: number;
  warned?: boolean;
}

export interface CreationFrame {
  stack?: string;
}

export interface VariantChange {
  from: unknown;
  to: unknown;
}

// Once a refine loop is within this many iterations of the cap, start tracking
// every variant key and latest value transition that changes between
// iterations so the warning can report every key that contributed to the
// oscillation, not just the keys that happened to flip on the final step.
// Convergent loops (the common case) exit well before this threshold and pay no
// per-iteration tracking cost.
export const REFINE_UNSTABLE_TRACKING_WINDOW = 10;

// Captures the call site of the function passed in `skipFn` so refine-limit
// warnings can point developers at the originating `cv()` call. Returns
// `undefined` in production so bundlers that replace `process.env.NODE_ENV` at
// build time can drop the entire warning machinery. The underlying `.stack`
// string is formatted lazily on first access in every major engine (V8,
// SpiderMonkey, JavaScriptCore), so holding the captured frame for the
// lifetime of the component is cheap when no warning fires.
export function captureCreationFrame(
  skipFn: Function,
): CreationFrame | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  if (typeof Error.captureStackTrace === "function") {
    const holder: CreationFrame = {};
    Error.captureStackTrace(holder, skipFn);
    return holder;
  }
  // Engines without `Error.captureStackTrace` (SpiderMonkey, JavaScriptCore)
  // can't strip internal frames, but their `Error.stack` getter is still
  // lazy, so returning the Error instance defers the format cost. The
  // resulting trace includes 1–2 extra frames at the top from this helper and
  // `cv` itself.
  return new Error();
}

export function formatCreationStack(frame: CreationFrame): string | undefined {
  let stack = frame.stack;
  if (!stack) return undefined;
  // V8 prefixes the stack with a leading "Error" / "Error: message" line that
  // isn't meaningful for a captured location — drop it.
  const newlineIdx = stack.indexOf("\n");
  if (newlineIdx > 0) {
    const firstLine = stack.slice(0, newlineIdx);
    if (firstLine === "Error" || firstLine.startsWith("Error:")) {
      stack = stack.slice(newlineIdx + 1);
    }
  }
  const frames = stack.split("\n");
  for (let i = 0; i < frames.length; i++) {
    const line = frames[i]?.trim();
    if (!line) continue;
    if (isInternalCreationFrame(line)) continue;
    if (line.includes("/node_modules/")) continue;
    if (line.includes("\\node_modules\\")) continue;
    if (line.includes("node:internal")) continue;
    return `    ${line}`;
  }
  return undefined;
}

function isInternalCreationFrame(line: string): boolean {
  if (line.includes("captureCreationFrame")) return true;
  if (line.startsWith("at cv ")) return true;
  if (line.startsWith("at cv(")) return true;
  if (line.startsWith("cv@")) return true;
  return false;
}

// Accumulates the union of variant keys that differ between `prev` and `next`
// into `into`. Called on every non-converging iteration of the refine loop so
// the refine-limit warning can report any key that ever changed across runs,
// not just the keys that changed on the final iteration (two keys flipping at
// different cadences could otherwise hide each other on the last step).
export function accumulateUnstableVariantKeys(
  into: Set<string>,
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): void {
  for (const key in next) {
    if (!Object.hasOwn(next, key)) continue;
    if (!Object.is(prev[key], next[key])) {
      into.add(key);
    }
  }
  for (const key in prev) {
    if (!Object.hasOwn(prev, key)) continue;
    if (Object.hasOwn(next, key)) continue;
    into.add(key);
  }
}

function formatVariantValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    return String(value);
  }
  if (typeof value === "bigint") return `${value}n`;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "symbol") return String(value);
  if (typeof value === "function") return "[function]";
  return "[object]";
}

function setVariantChange(
  into: Map<string, VariantChange>,
  key: string,
  from: unknown,
  to: unknown,
): void {
  into.set(key, { from, to });
}

export function accumulateUnstableVariantChanges(
  into: Map<string, VariantChange>,
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): void {
  for (const key in next) {
    if (!Object.hasOwn(next, key)) continue;
    if (!Object.is(prev[key], next[key])) {
      setVariantChange(into, key, prev[key], next[key]);
    }
  }
  for (const key in prev) {
    if (!Object.hasOwn(prev, key)) continue;
    if (Object.hasOwn(next, key)) continue;
    setVariantChange(into, key, prev[key], undefined);
  }
}

function formatVariantChanges(changes: Map<string, VariantChange>): string {
  return Array.from(changes)
    .map(([key, { from, to }]) => {
      return `${key}: ${formatVariantValue(from)} -> ${formatVariantValue(to)}`;
    })
    .join(", ");
}

interface WarnRefineLimitParams {
  runState: RefineRunState;
  creationFrame: CreationFrame | undefined;
  unstableKeys: Set<string> | null;
  unstableChanges: Map<string, VariantChange> | null;
}

export function warnRefineLimit({
  runState,
  creationFrame,
  unstableKeys,
  unstableChanges,
}: WarnRefineLimitParams): void {
  // Bundlers are expected to replace this branch with a production literal,
  // allowing warning-only code below to be removed from consumer bundles.
  if (process.env.NODE_ENV === "production") return;
  if (runState.warned) return;
  runState.warned = true;
  let message =
    "Clava: Maximum refine iterations exceeded. This can happen when a " +
    "refine callback calls setVariants or setDefaultVariants, but one " +
    "of the variants changes on every run.";
  if (unstableKeys && unstableKeys.size > 0) {
    message += `\nVariant(s) that did not stabilize: ${Array.from(unstableKeys).join(", ")}.`;
  }
  if (unstableChanges && unstableChanges.size > 0) {
    message += `\nLatest variant changes before warning: ${formatVariantChanges(unstableChanges)}.`;
  }
  if (creationFrame) {
    const creationStack = formatCreationStack(creationFrame);
    if (creationStack) {
      message += `\nComponent created at:\n${creationStack}`;
    }
  }
  console.warn(message);
}
