import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://dayotter:dayotter@localhost:5432/dayotter",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
