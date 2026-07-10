import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  input: "src/index.ts",
  external: Object.keys(packageJson.dependencies ?? {}),
  platform: "neutral",
  output: {
    cleanDir: true,
    comments: {
      annotation: true,
      jsdoc: false,
      legal: true,
    },
    format: "es",
    sourcemap: true,
  },
  plugins: [dts()],
});
