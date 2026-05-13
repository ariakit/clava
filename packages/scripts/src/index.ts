#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program.name("scripts");

program
  .command("bundle-size")
  .allowUnknownOption()
  .argument("[args...]", "arguments passed to bundle-size")
  .action(async (args: string[]) => {
    const { runBundleSize } = await import("./bundle-size.ts");
    const { stdout } = await runBundleSize(args);
    console.log(stdout);
  });

program
  .command("perf-compare")
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async () => {
    const { runPerfCompare } = await import("./perf-compare.ts");
    const { markdown } = runPerfCompare();
    console.log(markdown);
  });

await program.parseAsync();
