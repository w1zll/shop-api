type EnvironmentName = "development" | "test" | "production";

export const DEFAULT_DATABASE_URL =
  "postgresql://shop_mfs:change-me-local-password@localhost:5432/shop_mfs?schema=public";

export interface EnvironmentConfig {
  NODE_ENV: EnvironmentName;
  PORT: number;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  ACCESS_TOKEN_SECRET?: string;
  REFRESH_TOKEN_SECRET?: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL: string;
  CSRF_SECRET?: string;
  FRONTEND_ORIGIN: string;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readPort(value: unknown) {
  const parsed = Number(value ?? 4000);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return parsed;
}

function readNodeEnv(value: unknown): EnvironmentName {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  return "development";
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentConfig {
  return {
    NODE_ENV: readNodeEnv(config.NODE_ENV),
    PORT: readPort(config.PORT),
    DATABASE_URL: optionalString(config.DATABASE_URL) ?? DEFAULT_DATABASE_URL,
    DIRECT_URL:
      optionalString(config.DIRECT_URL) ??
      optionalString(config.DATABASE_URL) ??
      DEFAULT_DATABASE_URL,
    ACCESS_TOKEN_SECRET: optionalString(config.ACCESS_TOKEN_SECRET),
    REFRESH_TOKEN_SECRET: optionalString(config.REFRESH_TOKEN_SECRET),
    ACCESS_TOKEN_TTL: optionalString(config.ACCESS_TOKEN_TTL) ?? "15m",
    REFRESH_TOKEN_TTL: optionalString(config.REFRESH_TOKEN_TTL) ?? "30d",
    CSRF_SECRET: optionalString(config.CSRF_SECRET),
    FRONTEND_ORIGIN: optionalString(config.FRONTEND_ORIGIN) ?? "http://localhost:3000",
  };
}
