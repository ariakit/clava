import { hasOwn } from "./utils.ts";

/**
 * The attribute that recipes add in development to show the resolved variants
 * that produced an element.
 */
export const DEBUG_ATTRIBUTE = "data-clava-debug";

/**
 * Returns whether recipes created by a factory outside production add the
 * debug attribute. The `debug` option wins. The default adds it only in
 * development, so test snapshots don't change.
 */
export function isDebugEnabled(option: boolean | undefined): boolean {
  return option ?? process.env.NODE_ENV === "development";
}

function formatDebugValue(value: unknown): string {
  if (typeof value === "string") {
    // Single quotes keep the value readable in HTML, where attribute values
    // are shown in double quotes.
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  }
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "function") return "{...}";
  if (typeof value === "object" && value != null) return "{...}";
  return String(value);
}

interface FormatDebugAttributeParams {
  variantKeys: readonly string[];
  variants: Record<string, unknown>;
  incoming: unknown;
}

/**
 * Formats a recipe's resolved variants as space-separated `key=value` pairs in
 * the recipe's variant key order. A debug value that another recipe passed as
 * a prop is appended, so the variants of the recipe that renders the element
 * come first.
 *
 * The value has no source location. Server stacks can be source-mapped or
 * name other files than browser stacks, such as Turbopack chunks, and a
 * different value would cause hydration mismatches.
 */
export function formatDebugAttribute({
  variantKeys,
  variants,
  incoming,
}: FormatDebugAttributeParams): string {
  const parts: string[] = [];
  for (let i = 0; i < variantKeys.length; i++) {
    const key = variantKeys[i];
    if (key === undefined) continue;
    if (!hasOwn(variants, key)) continue;
    const value = variants[key];
    if (value === undefined) continue;
    parts.push(`${key}=${formatDebugValue(value)}`);
  }
  if (typeof incoming === "string" && incoming) {
    parts.push(incoming);
  }
  return parts.join(" ");
}
