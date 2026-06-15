import "dotenv/config";
import { defineConfig } from "prisma/config";

const defaultDatabaseUrl =
  "postgresql://shop_mfs:change-me-local-password@localhost:5432/shop_mfs?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
});
