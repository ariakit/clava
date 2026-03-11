import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  input: "src/index.ts",
  external: Object.keys(packageJson.dependencies ?? {}),
  output: {
    cleanDir: true,
    format: "es",
    sourcemap: true,
  },
  plugins: [dts()],
});
