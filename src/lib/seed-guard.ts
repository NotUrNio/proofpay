import fs from "fs";
import path from "path";

export interface SeedLockHandle {
  lockFilePath: string;
  pid: number;
  release: () => void;
}

/**
 * Checks whether a given OS PID is currently alive.
 */
export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    // EPERM means the process exists but belongs to another user
    return err?.code === "EPERM";
  }
}

/**
 * Ensures demo:seed never runs against a remote/hosted DATABASE_URL.
 * Never prints or includes the URL, hostname, or credentials in error messages.
 */
export function assertLocalDatabaseOnly(
  envDatabaseUrl: string | undefined = process.env.DATABASE_URL,
  usePglite: string | undefined = process.env.USE_PGLITE
): { mode: "pglite" | "local-postgres" } {
  if (usePglite === "true" || !envDatabaseUrl || envDatabaseUrl.trim() === "") {
    return { mode: "pglite" };
  }

  let parsed: URL;
  try {
    parsed = new URL(envDatabaseUrl);
  } catch {
    throw new Error(
      "Refusing to run demo:seed: DATABASE_URL is malformed or non-local. Seeding is restricted to local PGlite or localhost Postgres."
    );
  }

  const host = parsed.hostname.toLowerCase();
  const allowedLocalHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

  if (!allowedLocalHosts.has(host)) {
    throw new Error(
      "Refusing to run demo:seed: DATABASE_URL points to a remote or hosted database. Seeding is strictly restricted to local PGlite or localhost Postgres."
    );
  }

  return { mode: "local-postgres" };
}

/**
 * Acquires an exclusive single-instance lock for demo:seed and verifies no other
 * active process holds the local PGlite database directory.
 */
export function acquireSeedLock(options?: {
  lockFilePath?: string;
  pgliteHolderLockPath?: string;
  pglitePidPath?: string;
  checkPgliteHolder?: boolean;
}): SeedLockHandle {
  const lockFilePath =
    options?.lockFilePath ?? path.resolve(process.cwd(), ".data/seed-demo.lock");
  const pgliteHolderLockPath =
    options?.pgliteHolderLockPath ??
    path.resolve(process.cwd(), ".data/pglite/.active-holder.lock");
  const pglitePidPath =
    options?.pglitePidPath ?? path.resolve(process.cwd(), ".data/pglite/postmaster.pid");
  const checkPgliteHolder = options?.checkPgliteHolder ?? true;

  const lockDir = path.dirname(lockFilePath);
  if (!fs.existsSync(lockDir)) {
    fs.mkdirSync(lockDir, { recursive: true });
  }

  // 1. Check if another demo:seed instance already holds seed-demo.lock
  if (fs.existsSync(lockFilePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(lockFilePath, "utf-8"));
      const holderPid = Number(raw?.pid);
      if (holderPid && holderPid !== process.pid && isPidAlive(holderPid)) {
        throw new Error(
          `Cannot start demo:seed: another demo:seed process (PID ${holderPid}, started ${raw?.startedAt || "unknown"}) is already running.`
        );
      }
      // Stale lock from dead process
      fs.unlinkSync(lockFilePath);
    } catch (err: any) {
      if (err?.message?.includes("Cannot start demo:seed")) {
        throw err;
      }
      try {
        fs.unlinkSync(lockFilePath);
      } catch {
        // ignore if already unlinked
      }
    }
  }

  // 2. Check if another live process (e.g. next start / next dev) holds .data/pglite
  if (checkPgliteHolder && fs.existsSync(pgliteHolderLockPath)) {
    try {
      const holderRaw = JSON.parse(fs.readFileSync(pgliteHolderLockPath, "utf-8"));
      const holderPid = Number(holderRaw?.pid);
      if (holderPid && holderPid !== process.pid && isPidAlive(holderPid)) {
        throw new Error(
          `Cannot start demo:seed: local PGlite database (.data/pglite) is currently locked by active process PID ${holderPid}. Stop the running server before seeding.`
        );
      }
      // Holder is dead; clean up stale holder lock and stale postmaster.pid if present
      try {
        fs.unlinkSync(pgliteHolderLockPath);
      } catch {
        // ignore
      }
      if (fs.existsSync(pglitePidPath)) {
        try {
          fs.unlinkSync(pglitePidPath);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      if (err?.message?.includes("Cannot start demo:seed")) {
        throw err;
      }
    }
  } else if (checkPgliteHolder && fs.existsSync(pglitePidPath)) {
    // If postmaster.pid exists with no active holder lock, remove stale WASM lock
    try {
      fs.unlinkSync(pglitePidPath);
    } catch {
      // ignore
    }
  }

  // 3. Atomically create the seed lock file with 'wx' flag
  const payload = JSON.stringify(
    {
      pid: process.pid,
      startedAt: new Date().toISOString(),
    },
    null,
    2
  );

  let fd: number;
  try {
    fd = fs.openSync(lockFilePath, "wx");
  } catch (err: any) {
    if (err?.code === "EEXIST") {
      throw new Error(
        "Cannot start demo:seed: lock file was concurrently acquired by another process."
      );
    }
    throw err;
  }

  try {
    fs.writeFileSync(fd, payload, "utf-8");
  } finally {
    fs.closeSync(fd);
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      if (fs.existsSync(lockFilePath)) {
        const current = JSON.parse(fs.readFileSync(lockFilePath, "utf-8"));
        if (current?.pid === process.pid) {
          fs.unlinkSync(lockFilePath);
        }
      }
    } catch {
      // ignore cleanup errors on exit
    }
  };

  return {
    lockFilePath,
    pid: process.pid,
    release,
  };
}

/**
 * Executes an async step or network call with:
 * - A slow-wait log message if it takes longer than warnAfterMs (default 10,000ms)
 * - An explicit hard timeout after timeoutMs (default 15,000ms)
 */
export async function withTimeoutAndSlowNotice<T>(
  stepDescription: string,
  fn: (signal: AbortSignal) => Promise<T>,
  options?: {
    warnAfterMs?: number;
    timeoutMs?: number;
    onSlowNotice?: (message: string) => void;
  }
): Promise<T> {
  const warnAfterMs = options?.warnAfterMs ?? 10_000;
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const onSlowNotice =
    options?.onSlowNotice ?? ((msg: string) => console.warn(msg));

  const controller = new AbortController();
  let warnTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const warningPromise = new Promise<void>((resolve) => {
    warnTimer = setTimeout(() => {
      onSlowNotice(
        `[seed-demo] Waiting (> ${Math.round(warnAfterMs / 1000)}s) for: ${stepDescription}...`
      );
      resolve();
    }, warnAfterMs);
    if (typeof warnTimer.unref === "function") {
      warnTimer.unref();
    }
  });
  void warningPromise;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      controller.abort();
      reject(
        new Error(
          `Operation timed out after ${timeoutMs}ms while waiting for: ${stepDescription}`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (warnTimer) clearTimeout(warnTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}

/**
 * Wraps global fetch with an explicit per-request timeout so no accidental network call
 * in a seed script can hang indefinitely.
 */
export function installBoundedFetchTimeout(timeoutMs = 10_000, warnAfterMs = 10_000): () => void {
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch !== "function") {
    return () => {};
  }

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlObj =
      typeof input === "string"
        ? new URL(input, "http://localhost")
        : input instanceof URL
        ? input
        : new URL(input.url, "http://localhost");
    const safeTarget = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

    return withTimeoutAndSlowNotice(
      `network request to ${safeTarget}`,
      async (signal) => {
        return originalFetch(input, {
          ...init,
          signal: init?.signal ?? signal,
        });
      },
      { warnAfterMs, timeoutMs }
    );
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}
