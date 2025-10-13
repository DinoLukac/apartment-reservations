import nodemailer from "nodemailer"
import { env } from "../config/env.js"

let transporter

if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true = 465
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  })
  // optional verify (non-blocking)
  transporter
    .verify()
    .then(() => {
      console.log("[mail] transporter ready")
    })
    .catch((err) => {
      console.warn("[mail] transporter verify failed", err.message)
    })
} else {
  // Fallback stub – logs instead of sending real email
  transporter = {
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
  console.warn("[mail] SMTP env vars missing – using stub transporter")
}

export default transporter
