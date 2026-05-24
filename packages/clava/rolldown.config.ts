import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import packageJson from "./package.json" with { type: "json" };

const packageConfig: { name: string; dependencies?: Record<string, string> } =
  packageJson;

export default defineConfig({
  input: "src/index.ts",
  external: Object.keys(packageConfig.dependencies ?? {}),
  platform: "neutral",
  output: {
    cleanDir: true,
    format: "es",
    sourcemap: true,
  },
  plugins: [dts()],
});
