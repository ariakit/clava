import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

const lockDir = path.join(tmpdir(), "clava-package-build.lock");

export async function withPackageBuildLock<T>(callback: () => Promise<T>) {
  for (;;) {
    try {
      await mkdir(lockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await setTimeout(50);
    }
  }

  try {
    return await callback();
  } finally {
    await rm(lockDir, { force: true, recursive: true });
  }
}
