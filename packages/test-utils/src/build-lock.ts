import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { clearInterval, setInterval } from "node:timers";
import { setTimeout } from "node:timers/promises";

const lockDir = path.join(tmpdir(), "clava-package-build.lock");
const heartbeatFile = path.join(lockDir, "heartbeat");
const staleLockAgeMs = 10_000;

export async function withPackageBuildLock<T>(callback: () => Promise<T>) {
  for (;;) {
    try {
      await mkdir(lockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      const { mtimeMs } = await stat(heartbeatFile).catch(
        (statError: NodeJS.ErrnoException) => {
          if (statError.code !== "ENOENT") {
            throw statError;
          }
          return stat(lockDir).catch((lockError: NodeJS.ErrnoException) => {
            if (lockError.code !== "ENOENT") {
              throw lockError;
            }
            return { mtimeMs: Date.now() };
          });
        },
      );
      if (Date.now() - mtimeMs > staleLockAgeMs) {
        throw new Error(
          `Timed out waiting for stale package build lock at ${lockDir}. If no test process is running, remove this directory and retry.`,
          { cause: error },
        );
      }
      await setTimeout(50);
    }
  }

  let heartbeat: NodeJS.Timeout | undefined;
  try {
    await writeFile(heartbeatFile, `${Date.now()}\n`);
    heartbeat = setInterval(() => {
      void writeFile(heartbeatFile, `${Date.now()}\n`).catch(() => {});
    }, 1000);
    return await callback();
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat);
    }
    await rm(lockDir, { force: true, recursive: true });
  }
}
