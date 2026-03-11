import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import packageJson from "./package.json" with { type: "json" };

export const external = Object.keys(packageJson.dependencies ?? {});

export default defineConfig({
  input: "src/index.ts",
  external,
  output: {
    cleanDir: true,
    format: "es",
    sourcemap: true,
  },
  plugins: [dts()],
});
