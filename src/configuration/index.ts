export type AppEnv = "local" | "development" | "staging" | "production";
export const APP_ENV = process.env.APP_ENV as AppEnv;
export const NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV as AppEnv;

export const LOCAL_BASE_API_URL = "http://localhost:8080/api";
export const DEV_BASE_API_URL = "http://localhost:8080/api";
export const STAGING_BASE_API_URL = "https://newgl.serveousercontent.com/api";
export const PRODUCTION_BASE_API_URL = "https://newgl-api.fly.dev/api";

export const APP_ENV_CONFIG: Record<AppEnv, { BASE_API_URL: string }> = {
  local: { BASE_API_URL: LOCAL_BASE_API_URL },
  development: {BASE_API_URL: DEV_BASE_API_URL },
  staging: { BASE_API_URL: STAGING_BASE_API_URL },
  production: { BASE_API_URL: PRODUCTION_BASE_API_URL }
};

export const { BASE_API_URL } = APP_ENV_CONFIG[NEXT_PUBLIC_APP_ENV as AppEnv];
