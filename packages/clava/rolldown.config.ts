import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  input: {
    index: "src/index.ts",
    warn: "src/warn.ts",
    "warn.noop": "src/warn.noop.ts",
  },
  external: [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.imports ?? {}),
  ],
  platform: "neutral",
  output: {
    cleanDir: true,
    format: "es",
    sourcemap: true,
  },
  plugins: [dts()],
});
