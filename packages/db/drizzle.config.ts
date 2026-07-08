import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://calsync:calsync@localhost:5432/calsync",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
