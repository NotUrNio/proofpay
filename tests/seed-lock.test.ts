import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import {
  assertLocalDatabaseOnly,
  acquireSeedLock,
  withTimeoutAndSlowNotice,
} from "../src/lib/seed-guard";

describe("Demo Seed Single-Instance Lock, Hosted DB Guard & Timeout Suite", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "proofpay-seed-lock-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  });

  describe("Hosted DATABASE_URL Guard (assertLocalDatabaseOnly)", () => {
    it("allows PGlite mode when DATABASE_URL is unset or empty", () => {
      expect(assertLocalDatabaseOnly(undefined, undefined)).toEqual({ mode: "pglite" });
      expect(assertLocalDatabaseOnly("", undefined)).toEqual({ mode: "pglite" });
    });

    it("allows PGlite mode when USE_PGLITE=true regardless of DATABASE_URL", () => {
      expect(
        assertLocalDatabaseOnly("postgres://hosted.example.com:5432/db", "true")
      ).toEqual({ mode: "pglite" });
    });

    it("allows localhost and 127.0.0.1 Postgres URLs", () => {
      expect(
        assertLocalDatabaseOnly("postgres://user:pass@localhost:5432/proofpay", "false")
      ).toEqual({ mode: "local-postgres" });
      expect(
        assertLocalDatabaseOnly("postgres://user:pass@127.0.0.1:5432/proofpay", "false")
      ).toEqual({ mode: "local-postgres" });
    });

    it("refuses any hosted or remote DATABASE_URL without leaking URL or credentials in the error", () => {
      const fakeHostedUrl =
        "postgres://test_user:FAKE_SECRET_MARKER_99@dpg-fake.oregon-postgres.render.com/proofpay";
      let caughtError: Error | null = null;
      try {
        assertLocalDatabaseOnly(fakeHostedUrl, "false");
      } catch (err: any) {
        caughtError = err;
      }
      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toContain("Refusing to run demo:seed");
      expect(caughtError?.message).not.toContain("FAKE_SECRET_MARKER_99");
      expect(caughtError?.message).not.toContain("oregon-postgres.render.com");
    });
  });

  describe("Single-Instance Lock & PGlite Holder Detection (acquireSeedLock)", () => {
    it("acquires and releases lock cleanly when no other seed is running", () => {
      const lockFile = path.join(tmpDir, "seed-demo.lock");
      const handle = acquireSeedLock({
        lockFilePath: lockFile,
        checkPgliteHolder: false,
      });

      expect(fs.existsSync(lockFile)).toBe(true);
      const content = JSON.parse(fs.readFileSync(lockFile, "utf-8"));
      expect(content.pid).toBe(process.pid);

      handle.release();
      expect(fs.existsSync(lockFile)).toBe(false);
    });

    it("blocks a second concurrent seed while a live process holds the lock", async () => {
      const lockFile = path.join(tmpDir, "seed-demo.lock");
      // Spawn a short-lived background sleep process to represent another live seed instance
      const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
        stdio: "ignore",
      });

      try {
        expect(child.pid).toBeDefined();
        fs.writeFileSync(
          lockFile,
          JSON.stringify({ pid: child.pid, startedAt: "2026-10-19T00:00:00.000Z" }),
          "utf-8"
        );

        expect(() =>
          acquireSeedLock({
            lockFilePath: lockFile,
            checkPgliteHolder: false,
          })
        ).toThrow(/another demo:seed process \(PID \d+.*\) is already running/);
      } finally {
        child.kill("SIGKILL");
      }
    });

    it("recovers automatically from a stale lock left by a dead PID", () => {
      const lockFile = path.join(tmpDir, "seed-demo.lock");
      fs.writeFileSync(
        lockFile,
        JSON.stringify({ pid: 999999, startedAt: "2026-10-18T00:00:00.000Z" }),
        "utf-8"
      );

      const handle = acquireSeedLock({
        lockFilePath: lockFile,
        checkPgliteHolder: false,
      });
      expect(handle.pid).toBe(process.pid);
      handle.release();
    });

    it("fails with a clear error if another live process holds the PGlite database (.active-holder.lock)", () => {
      const lockFile = path.join(tmpDir, "seed-demo.lock");
      const holderFile = path.join(tmpDir, ".active-holder.lock");
      const pidFile = path.join(tmpDir, "postmaster.pid");

      const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
        stdio: "ignore",
      });

      try {
        fs.writeFileSync(
          holderFile,
          JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }),
          "utf-8"
        );

        expect(() =>
          acquireSeedLock({
            lockFilePath: lockFile,
            pgliteHolderLockPath: holderFile,
            pglitePidPath: pidFile,
            checkPgliteHolder: true,
          })
        ).toThrow(/local PGlite database \(\.data\/pglite\) is currently locked by active process PID/);
      } finally {
        child.kill("SIGKILL");
      }
    });
  });

  describe("Slow Wait Notice & Explicit Timeout (withTimeoutAndSlowNotice)", () => {
    it("emits a waiting notice when an operation exceeds warnAfterMs", async () => {
      const notices: string[] = [];
      const result = await withTimeoutAndSlowNotice(
        "Mock slow database step",
        async () => {
          await new Promise((r) => setTimeout(r, 60));
          return "done";
        },
        {
          warnAfterMs: 20,
          timeoutMs: 500,
          onSlowNotice: (msg) => notices.push(msg),
        }
      );

      expect(result).toBe("done");
      expect(notices.length).toBe(1);
      expect(notices[0]).toContain("Mock slow database step");
    });

    it("aborts with an explicit timeout error when an operation exceeds timeoutMs", async () => {
      await expect(
        withTimeoutAndSlowNotice(
          "Hung network request",
          async () => {
            await new Promise((r) => setTimeout(r, 500));
          },
          {
            warnAfterMs: 10,
            timeoutMs: 40,
            onSlowNotice: () => {},
          }
        )
      ).rejects.toThrow(/Operation timed out after 40ms while waiting for: Hung network request/);
    });
  });
});
