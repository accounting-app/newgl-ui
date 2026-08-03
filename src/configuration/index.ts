export type AppEnv = "local" | "development" | "staging" | "production";

export const APP_ENV = (process.env.APP_ENV as AppEnv) || "local";
export const NEXT_PUBLIC_APP_ENV = (process.env.NEXT_PUBLIC_APP_ENV as AppEnv) || "local";

export const LOCAL_BASE_API_URL = "http://localhost:3001/api";
export const DEV_BASE_API_URL = "http://localhost:3001/api";
export const STAGING_BASE_API_URL = "https://newgl.serveousercontent.com/api";
export const PRODUCTION_BASE_API_URL = "https://newgl-api.fly.dev/api";

export const APP_ENV_CONFIG: Record<AppEnv, { BASE_API_URL: string }> = {
  local: { BASE_API_URL: LOCAL_BASE_API_URL },
  development: { BASE_API_URL: DEV_BASE_API_URL },
  staging: { BASE_API_URL: STAGING_BASE_API_URL },
  production: { BASE_API_URL: PRODUCTION_BASE_API_URL }
};

// NEXT_PUBLIC_API_URL, when set, overrides the per-environment default.
export const BASE_API_URL =
  process.env.NEXT_PUBLIC_API_URL || APP_ENV_CONFIG[NEXT_PUBLIC_APP_ENV].BASE_API_URL;

// Every tenant has exactly one ledger today, created at bootstrap with this
// name (mirrors newgl-api's LEDGER_NAME default -- see configuration/index.ts
// there). Revisit once multiple ledgers per tenant are exposed in the UI.
export const PRIMARY_LEDGER_NAME = "company";
