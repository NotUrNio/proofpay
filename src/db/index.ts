import { drizzle } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

let pgliteInstance: PGlite | null = null;
let postgresClient: ReturnType<typeof postgres> | null = null;

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === "EPERM";
  }
}

// Factory for database connection
function createDbClient() {
  // If explicitly requested or if no postgres server reachable
  if (process.env.USE_PGLITE === "true" || !connectionString || connectionString.includes("localhost:5432")) {
    // For local development when docker might not be running, use persistent pglite
    const dataDir = path.resolve(process.cwd(), ".data/pglite");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const holderLockPath = path.join(dataDir, ".active-holder.lock");
    const postmasterPidPath = path.join(dataDir, "postmaster.pid");

    if (fs.existsSync(holderLockPath)) {
      try {
        const holder = JSON.parse(fs.readFileSync(holderLockPath, "utf-8"));
        const holderPid = Number(holder?.pid);
        if (holderPid && holderPid !== process.pid && !isProcessAlive(holderPid)) {
          try {
            fs.unlinkSync(holderLockPath);
          } catch {}
          if (fs.existsSync(postmasterPidPath)) {
            try {
              fs.unlinkSync(postmasterPidPath);
            } catch {}
          }
        }
      } catch {
        // ignore malformed lock file
      }
    } else if (fs.existsSync(postmasterPidPath)) {
      // Clean up orphaned postmaster.pid when no active holder lock exists
      try {
        fs.unlinkSync(postmasterPidPath);
      } catch {}
    }

    pgliteInstance = new PGlite(dataDir);

    try {
      fs.writeFileSync(
        holderLockPath,
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
        "utf-8"
      );
    } catch {}

    const cleanupHolder = () => {
      try {
        if (fs.existsSync(holderLockPath)) {
          const current = JSON.parse(fs.readFileSync(holderLockPath, "utf-8"));
          if (Number(current?.pid) === process.pid) {
            fs.unlinkSync(holderLockPath);
          }
        }
      } catch {}
    };
    process.once("exit", cleanupHolder);

    return drizzlePglite(pgliteInstance, { schema });
  }

  // External PostgreSQL (Render, Docker, Supabase, Neon, etc.)
  postgresClient = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(postgresClient, { schema });
}

export async function closeDbClient(): Promise<void> {
  if (pgliteInstance) {
    try {
      await pgliteInstance.close();
    } catch {}
    pgliteInstance = null;
    const holderLockPath = path.resolve(process.cwd(), ".data/pglite/.active-holder.lock");
    try {
      if (fs.existsSync(holderLockPath)) {
        const current = JSON.parse(fs.readFileSync(holderLockPath, "utf-8"));
        if (Number(current?.pid) === process.pid) {
          fs.unlinkSync(holderLockPath);
        }
      }
    } catch {}
  }
  if (postgresClient) {
    try {
      await postgresClient.end({ timeout: 5 });
    } catch {}
    postgresClient = null;
  }
}

export const db = createDbClient();
export * from "./schema";

