import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Keep column/table names snake_case to match the existing pg_dump schema.
  casing: "snake_case",
  // The legacy 001_init.sql already created the schema; treat it as baseline.
  migrations: { table: "drizzle_migrations", schema: "public" },
});
