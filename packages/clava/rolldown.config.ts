import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export default defineConfig({
  input: "src/index.ts",
  output: {
    cleanDir: true,
    format: "es",
    sourcemap: true,
  },
  plugins: [dts()],
});
