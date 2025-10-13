import nodemailer from "nodemailer"
import { env } from "../config/env.js"
import dns from "dns/promises"

export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE, // true za 465
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
})

export const sendMail = async ({ to, subject, html, replyTo }) => {
  return mailer.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
    replyTo: replyTo ?? env.MAIL_REPLY_TO,
  })
}

// Basic RFC 5322-ish pattern (pragmatic) + length guards
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

export async function validateEmailAddress(email, { mx = true } = {}) {
  if (typeof email !== "string") return { ok: false, reason: "type" }
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > 254) return { ok: false, reason: "length" }
  if (!EMAIL_REGEX.test(trimmed)) return { ok: false, reason: "format" }
  if (!mx) return { ok: true }
  const domain = trimmed.split("@").pop()
  try {
    const recs = await dns.resolveMx(domain)
    if (!recs || !recs.length) return { ok: false, reason: "mx" }
    return { ok: true }
  } catch {
    // Network/DNS failure – treat as soft fail (do not hard block)
    return { ok: true, soft: true }
  }
}
