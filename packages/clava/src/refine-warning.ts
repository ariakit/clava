import { hasOwn } from "./utils.ts";

export interface CreationFrame {
  stack?: string;
}

export interface VariantChange {
  from: unknown;
  to: unknown;
}

// Once a refine loop is within this many iterations of the cap, start tracking
// the latest value transition for every variant key that changes between
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
    if (!hasOwn(next, key)) continue;
    if (!Object.is(prev[key], next[key])) {
      setVariantChange(into, key, prev[key], next[key]);
    }
  }
  for (const key in prev) {
    if (!hasOwn(prev, key)) continue;
    if (hasOwn(next, key)) continue;
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
  creationFrame: CreationFrame | undefined;
  unstableChanges: Map<string, VariantChange> | null;
}

export function warnRefineLimit({
  creationFrame,
  unstableChanges,
}: WarnRefineLimitParams): void {
  // Bundlers are expected to replace this branch with a production literal,
  // allowing warning-only code below to be removed from consumer bundles.
  if (process.env.NODE_ENV === "production") return;
  let message =
    "Clava: Maximum refine iterations exceeded. This can happen when a " +
    "computed default variant or refine callback changes one of the " +
    "variants on every run.";
  if (unstableChanges && unstableChanges.size > 0) {
    message += `\nVariant(s) that did not stabilize: ${Array.from(unstableChanges.keys()).join(", ")}.`;
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
