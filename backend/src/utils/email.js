import nodemailer from "nodemailer"
import { env } from "../config/env.js"
import dns from "dns/promises"
import sg from "@sendgrid/mail"

let mailer
let useSendgrid = false

if (process.env.SENDGRID_API_KEY) {
  try {
    sg.setApiKey(process.env.SENDGRID_API_KEY)
    useSendgrid = true
    console.log("[mail] SendGrid enabled")
  } catch (e) {
    console.warn("[mail] SendGrid init failed:", e?.message || String(e))
  }
}

if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
  // Configure timeouts to avoid long hangs on PaaS when SMTP is unreachable
  const connectionTimeout = Number(
    process.env.MAIL_CONNECTION_TIMEOUT_MS ?? 12000
  )
  const greetingTimeout = Number(process.env.MAIL_GREETING_TIMEOUT_MS ?? 12000)
  const socketTimeout = Number(process.env.MAIL_SOCKET_TIMEOUT_MS ?? 15000)
  const enableLogger = (env.LOG_LEVEL || "").toLowerCase() === "debug"

  mailer = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true = 465, false = STARTTLS on 587
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    logger: enableLogger,
    tls: {
      // Ensure SNI hostname matches
      servername: env.SMTP_HOST,
      // leave rejectUnauthorized default true
    },
  })

  // Non-blocking verify to surface readiness in logs
  mailer
    .verify()
    .then(() => console.log("[mail] app mailer ready"))
    .catch((err) =>
      console.warn(
        "[mail] app mailer verify failed:",
        err?.message || String(err)
      )
    )
} else {
  // Fallback stub – logs instead of sending real email
  mailer = {
    sendMail: async (opts) => {
      console.log(
        "[mail-stub] to=%s subject=%s attachments=%d",
        opts.to,
        opts.subject,
        (opts.attachments || []).length
      )
      return { messageId: "stub" }
    },
  }
  console.warn("[mail] SMTP env vars missing – using stub mailer")
}

// Helper to enforce a soft timeout around sendMail call
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`mail timeout after ${ms}ms`)),
      ms
    )
    promise
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(t)
        reject(e)
      })
  })
}

function guessMimeFromFilename(name = "") {
  const lower = name.toLowerCase()
  if (lower.endsWith(".ics")) return "text/calendar"
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".txt")) return "text/plain"
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html"
  return "application/octet-stream"
}

export const sendMail = async ({
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
}) => {
  const overallTimeout = Number(process.env.MAIL_SEND_TIMEOUT_MS ?? 15000)
  if (useSendgrid) {
    // Send via SendGrid HTTP API (reliable on PaaS)
    const msg = {
      to,
      from: env.MAIL_FROM,
      subject,
      html,
      text,
      reply_to: replyTo ?? env.MAIL_REPLY_TO,
      attachments: Array.isArray(attachments)
        ? attachments.map((att) => ({
            filename: att.filename,
            type:
              att.contentType ||
              att.type ||
              guessMimeFromFilename(att.filename),
            disposition: att.disposition || "attachment",
            content:
              typeof att.content === "string"
                ? Buffer.from(att.content).toString("base64")
                : Buffer.isBuffer(att.content)
                ? att.content.toString("base64")
                : Buffer.from(String(att.content ?? "")).toString("base64"),
          }))
        : undefined,
    }
    return withTimeout(sg.send(msg), overallTimeout)
  }
  // Fallback to SMTP
  return withTimeout(
    mailer.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      html,
      text,
      replyTo: replyTo ?? env.MAIL_REPLY_TO,
      attachments,
    }),
    overallTimeout
  )
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
