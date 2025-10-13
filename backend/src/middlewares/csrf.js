import { randomBytes } from "crypto"
import { env } from "../config/env.js"

const unsafe = new Set(["POST", "PUT", "PATCH", "DELETE"])
const exemptPaths = [
  "/api/csrf",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/auth/oauth/google/start",
  "/api/auth/oauth/google/callback",
  "/api/auth/oauth/facebook/start",
  "/api/auth/oauth/facebook/callback",
  "/api/auth/resend-verify",
]

export function csrfIssue(req, res) {
  const token = randomBytes(24).toString("base64url")
  res.cookie("csrf", token, {
    httpOnly: false, // mora biti čitljiv iz JS (double-submit obrazac)
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN,
    path: "/",
    maxAge: 2 * 60 * 60 * 1000,
  })
  res.json({ csrfToken: token })
}

export function csrfProtect(req, res, next) {
  if (!unsafe.has(req.method)) return next()
  if (exemptPaths.some((p) => req.path.startsWith(p))) return next()

  const header = req.get("x-csrf-token")
  const cookie = req.cookies?.csrf
  if (!header || !cookie || header !== cookie) {
    return res.status(403).json({ error: "CSRF token invalid" })
  }
  next()
}
