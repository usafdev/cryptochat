const DEVELOPMENT_SESSION_SECRET = "dev-only-session-secret-please-change";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error("SESSION_SECRET must be configured with at least 32 characters in production");
    }
    return secret;
  }

  return secret || DEVELOPMENT_SESSION_SECRET;
}

export function getAppOrigin(): string {
  const configuredOrigin = process.env.APP_ORIGIN;

  if (process.env.NODE_ENV === "production" && !configuredOrigin) {
    throw new Error("APP_ORIGIN must be configured in production");
  }

  const origin = configuredOrigin || "http://localhost:3000";
  let parsedOrigin: URL;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error("APP_ORIGIN must be a valid HTTP(S) URL");
  }

  if (
    !["http:", "https:"].includes(parsedOrigin.protocol) ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search ||
    parsedOrigin.hash
  ) {
    throw new Error("APP_ORIGIN must be a valid HTTP(S) origin without a path or credentials");
  }

  return parsedOrigin.origin;
}

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured in production");
  }

  getSessionSecret();
  getAppOrigin();
}
