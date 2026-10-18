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

// Factory for database connection
function createDbClient() {
  // If explicitly requested or if no postgres server reachable
  if (process.env.USE_PGLITE === "true" || !connectionString || connectionString.includes("localhost:5432")) {
    // For local development when docker might not be running, use persistent pglite
    const dataDir = path.resolve(process.cwd(), ".data/pglite");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const pglite = new PGlite(dataDir);
    return drizzlePglite(pglite, { schema });
  }

  // External PostgreSQL (Render, Docker, Supabase, Neon, etc.)
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export const db = createDbClient();
export * from "./schema";
