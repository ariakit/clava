import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export const external = ["clsx", "csstype"];

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
