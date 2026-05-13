import { pathToFileURL } from "node:url";

export function isDirectEntry(metaUrl: string) {
  const [entry] = process.argv.slice(1);
  if (!entry) return false;
  return pathToFileURL(entry).href === metaUrl;
}
