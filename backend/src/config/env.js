import dotenv from "dotenv"
dotenv.config()

const bool = (v, d = false) =>
  v === undefined ? d : String(v).toLowerCase() === "true"

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),

  APP_URL: process.env.APP_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  BACKEND_URL:
    process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  BASE_URL:
    process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  TIMEZONE: process.env.TIMEZONE ?? "Europe/Podgorica",

  // Support both legacy MONGO_URL and common MONGODB_URI naming (Render / other hosts)
  MONGO_URL: process.env.MONGODB_URI || process.env.MONGO_URL,
  MONGO_DB_NAME: process.env.MONGO_DB_NAME ?? "apartmani",

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ISSUER: process.env.JWT_ISSUER ?? "apartmani.api",
  JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? "apartmani.web",
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "10m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "30d",
  REFRESH_ROTATION: bool(process.env.REFRESH_ROTATION, true),
  REFRESH_REUSE_DETECT: bool(process.env.REFRESH_REUSE_DETECT, true),

  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  COOKIE_SECURE: bool(process.env.COOKIE_SECURE, false),
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE ?? "Lax",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,

  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 465),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_SECURE: bool(process.env.SMTP_SECURE, true),
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_REPLY_TO: process.env.MAIL_REPLY_TO,
  MAIL_TEMPLATES_DIR: process.env.MAIL_TEMPLATES_DIR ?? "src/templates/email",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT: process.env.GOOGLE_REDIRECT,

  FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID,
  FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET,
  FACEBOOK_REDIRECT: process.env.FACEBOOK_REDIRECT,

  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX ?? 10),
  SESSION_TTL_HOURS: Number(process.env.SESSION_TTL_HOURS ?? 24),

  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  REQUEST_ID_HEADER: process.env.REQUEST_ID_HEADER ?? "x-request-id",

  // OAuth / OIDC security helpers
  OAUTH_STATE_ENFORCE: bool(process.env.OAUTH_STATE_ENFORCE, true),
  OIDC_NONCE_ENFORCE: bool(process.env.OIDC_NONCE_ENFORCE, true),
  OAUTH_REDIRECT_ALLOWLIST: (
    process.env.OAUTH_REDIRECT_ALLOWLIST ||
    process.env.FRONTEND_URL ||
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
}
