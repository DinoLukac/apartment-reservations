import { nanoid } from "nanoid"
import dayjs from "dayjs"
import { User } from "../models/user.js"
import { RefreshToken } from "../models/refresh-token.js"
import { hashPassword, verifyPassword } from "../utils/password.js"
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js"
import { sendMail } from "../utils/email.js"
import { env } from "../config/env.js"
import argon2 from "argon2"
import fs from "fs/promises"
import { randomToken, sha256 } from "../utils/crypto.js"
import { audit } from "../utils/audit.js"

const hashRt = (t) => argon2.hash(t, { type: argon2.argon2id })

// Centralized token issuance helper (login/social login)
export const issueTokensForUser = async ({ user, ua, ip }) => {
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role,
  })
  const refreshToken = signRefreshToken({ sub: String(user._id) })
  const rtHash = await hashRt(refreshToken)
  const exp = dayjs().add(env.SESSION_TTL_HOURS, "hour").toDate()
  await RefreshToken.create({
    userId: user._id,
    tokenHash: rtHash,
    expiresAt: exp,
    userAgent: ua,
    ip,
    lastUsedAt: new Date(),
  })
  return { accessToken, refreshToken }
}

export const registerUser = async ({ email, password, name }) => {
  const exists = await User.findOne({ email })
  if (exists) throw Object.assign(new Error("Email je zauzet"), { status: 409 })

  const passwordHash = await hashPassword(password)
  const verifyTokenPlain = randomToken(32)
  const verifyTokenHash = sha256(verifyTokenPlain)
  const verifyTokenExp = dayjs().add(24, "hour").toDate()

  const user = await User.create({
    email,
    passwordHash,
    name,
    verifyTokenHash,
    verifyTokenExp,
  })

  const verifyUrl = `${
    env.BACKEND_URL
  }/api/auth/verify-email?token=${verifyTokenPlain}&email=${encodeURIComponent(
    email
  )}`
  const tpl = await fs.readFile(
    env.MAIL_TEMPLATES_DIR + "/verify-email.html",
    "utf8"
  )
  const html = tpl.replaceAll("{{VERIFY_URL}}", verifyUrl)
  try {
    await sendMail({ to: email, subject: "Potvrda email adrese", html })
  } catch (err) {
    console.warn("[mail] slanje nije uspjelo:", err.code || err.message)
    console.warn(
      "[mail][DEV] Otvori ovaj link ručno za verifikaciju ->",
      verifyUrl
    )
  }

  return { id: user._id, email: user.email }
}

export const verifyEmail = async ({ email, token }) => {
  const user = await User.findOne({ email })
  if (!user) throw Object.assign(new Error("Nevažeći token"), { status: 400 })
  const provided = String(token || "").trim()
  const tokenHash = sha256(provided)
  const matchNew = user.verifyTokenHash && user.verifyTokenHash === tokenHash
  const matchOld = user.verifyToken && user.verifyToken === provided
  if (!matchNew && !matchOld)
    throw Object.assign(new Error("Nevažeći token"), { status: 400 })
  if (user.verifyTokenExp && user.verifyTokenExp < new Date())
    throw Object.assign(new Error("Token istekao"), { status: 400 })

  user.emailVerifiedAt = new Date()
  user.verifyToken = undefined
  user.verifyTokenHash = undefined
  user.verifyTokenExp = undefined
  await user.save()
  await audit({ userId: user._id, action: "verify_email", ip: "", ua: "" })
  return true
}

export const loginUser = async ({ email, password, ua, ip }) => {
  const user = await User.findOne({ email })
  if (!user)
    throw Object.assign(new Error("Pogrešni kredencijali"), { status: 401 })

  const ok = await verifyPassword(user.passwordHash, password)
  if (!ok)
    throw Object.assign(new Error("Pogrešni kredencijali"), { status: 401 })
  if (!user.emailVerifiedAt) {
    const e = new Error("Email nije verifikovan")
    e.status = 403
    throw e
  }
  // (po potrebi: zahtijevaj verified email)
  // if (!user.emailVerifiedAt) throw Object.assign(new Error("Email nije verifikovan"), { status: 403 });

  const { accessToken, refreshToken } = await issueTokensForUser({
    user,
    ua,
    ip,
  })
  return { accessToken, refreshToken, user }
}

export const rotateRefresh = async ({ refreshToken, ua, ip }) => {
  let payload
  try {
    payload = verifyToken(refreshToken)
  } catch {
    throw Object.assign(new Error("Nevažeći RT"), { status: 401 })
  }
  // Sekvencijalno traženje: zaustavi se kad nađeš podudaran hash
  const cursor = RefreshToken.find({ userId: payload.sub })
    .sort({ createdAt: -1 })
    .cursor()
  let found = null
  for await (const doc of cursor) {
    const ok = await argon2
      .verify(doc.tokenHash, refreshToken)
      .catch(() => false)
    if (ok) {
      found = doc
      break
    }
  }
  if (!found) {
    const e = new Error("Nevažeći RT")
    e.status = 401
    throw e
  }
  // Ako je već opozvan -> tretiraj kao race (tihi fallback) umjesto reuse
  if (found.revokedAt) {
    const e = new Error("Race – ponovi originalni zahtjev")
    e.status = 409
    throw e
  }

  const active = found

  active.rotatedAt = new Date()
  active.lastUsedAt = new Date()
  active.revokedAt = new Date()
  await active.save()
  await audit({ userId: payload.sub, action: "refresh", ip, ua })

  const newAccess = signAccessToken({ sub: payload.sub })
  const newRefresh = signRefreshToken({ sub: payload.sub })
  const rtHash = await hashRt(newRefresh)
  const exp = dayjs().add(env.SESSION_TTL_HOURS, "hour").toDate()
  await RefreshToken.create({
    userId: payload.sub,
    tokenHash: rtHash,
    expiresAt: exp,
    userAgent: ua,
    ip,
  })

  // Prune starih opozvanih tokena (starijih od 2 dana) – non-blocking best-effort
  RefreshToken.deleteMany({
    userId: payload.sub,
    revokedAt: { $ne: null },
    createdAt: { $lt: dayjs().subtract(2, "day").toDate() },
  }).catch(() => {})

  return { accessToken: newAccess, refreshToken: newRefresh }
}

export const logoutUser = async ({ refreshToken }) => {
  const all = await RefreshToken.find({})
  // opozovi konkretni RT (ili sve korisnikove, po potrebi)
  for (const t of all) {
    if (await argon2.verify(t.tokenHash, refreshToken)) {
      t.revokedAt = new Date()
      await t.save()
      await audit({ userId: t.userId, action: "logout", ip: "", ua: "" })
      return true
    }
  }
  return true
}

export const listSessions = async (userId) => {
  const docs = await RefreshToken.find({ userId, revokedAt: null })
    .sort({ createdAt: -1 })
    .select("_id userAgent ip createdAt lastUsedAt expiresAt rotatedAt")
  return docs.map((d) => ({
    id: String(d._id),
    ua: d.userAgent,
    ip: d.ip,
    createdAt: d.createdAt,
    lastUsedAt: d.lastUsedAt || d.createdAt,
    expiresAt: d.expiresAt,
    rotatedAt: d.rotatedAt || null,
  }))
}

export const revokeSession = async ({ userId, sessionId }) => {
  const doc = await RefreshToken.findOne({ _id: sessionId, userId })
  if (!doc) return false
  doc.revokedAt = new Date()
  await doc.save()
  return true
}

export const revokeAllSessions = async ({ userId }) => {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  )
  return true
}

export const requestPasswordReset = async ({ email }) => {
  const user = await User.findOne({ email })
  // uvijek vraćamo ok (bez otkrivanja da li email postoji)
  if (!user) return true

  const resetTokenPlain = randomToken(32)
  const resetTokenHash = sha256(resetTokenPlain)
  const resetTokenExp = dayjs().add(1, "hour").toDate()

  user.resetTokenHash = resetTokenHash
  user.resetTokenExp = resetTokenExp
  await user.save()

  const resetUrl = `${
    env.FRONTEND_URL
  }/reset-password?token=${resetTokenPlain}&email=${encodeURIComponent(email)}`

  try {
    let htmlTpl
    try {
      htmlTpl = await fs.readFile(
        env.MAIL_TEMPLATES_DIR + "/reset-password.html",
        "utf8"
      )
    } catch (tplErr) {
      console.warn(
        "[mail][tpl] reset-password.html nedostaje ili nije čitljiv:",
        tplErr.code || tplErr.message
      )
      htmlTpl = `Za promjenu lozinke klikni na link: <a href="${resetUrl}">${resetUrl}</a>`
    }

    const html = htmlTpl.replaceAll("{{RESET_URL}}", resetUrl)
    await sendMail({ to: email, subject: "Promjena lozinke", html })
  } catch (err) {
    console.warn("[mail] slanje reset nije uspjelo:", err.code || err.message)
    console.warn("[mail][DEV] Reset link ->", resetUrl)
  }

  return true
}

export const resetPassword = async ({ email, token, newPassword }) => {
  const user = await User.findOne({ email })
  const provided = String(token || "").trim()
  const tokenHash = sha256(provided)
  const legacyStored = String(user?.resetToken || "").trim()
  const matchNew = user?.resetTokenHash && user.resetTokenHash === tokenHash
  const matchOld = legacyStored && legacyStored === provided
  if (!user || (!matchNew && !matchOld)) {
    const e = new Error("Nevažeći token")
    e.status = 400
    throw e
  }
  if (!user.resetTokenExp || user.resetTokenExp < new Date()) {
    const e = new Error("Token istekao")
    e.status = 400
    throw e
  }

  user.passwordHash = await hashPassword(newPassword)
  user.resetToken = undefined
  user.resetTokenHash = undefined
  user.resetTokenExp = undefined
  await user.save()

  // opozovi sve aktivne RT (sigurnost nakon promjene lozinke)
  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  )

  await audit({ userId: user._id, action: "reset_password", ip: "", ua: "" })
  return true
}

export const resendVerifyEmail = async ({ email }) => {
  const user = await User.findOne({ email })
  // uvijek ok odgovor (ne otkrivamo postojanje), ali šaljemo samo ako je potrebna verifikacija
  if (!user || user.emailVerifiedAt) return true

  const tokenPlain = randomToken(32)
  user.verifyTokenHash = sha256(tokenPlain)
  user.verifyTokenExp = dayjs().add(24, "hour").toDate()
  await user.save()

  const verifyUrl = `${
    env.BACKEND_URL
  }/api/auth/verify-email?token=${tokenPlain}&email=${encodeURIComponent(
    email
  )}`
  const tpl = await fs.readFile(
    env.MAIL_TEMPLATES_DIR + "/verify-email.html",
    "utf8"
  )
  const html = tpl.replaceAll("{{VERIFY_URL}}", verifyUrl)
  try {
    await sendMail({
      to: email,
      subject: "Potvrda email adrese (ponovno slanje)",
      html,
    })
  } catch (err) {
    console.warn("[mail] resend verify fail:", err.code || err.message)
    console.warn("[mail][DEV] Verify link ->", verifyUrl)
  }
  return true
}

// Social login upsert + tokens
export const socialLogin = async ({
  provider,
  providerId,
  email,
  name,
  ua,
  ip,
}) => {
  // 1) Try by providerId
  let user = await User.findOne({ provider, providerId })

  // 2) If not found, try link by email
  if (!user && email) {
    user = await User.findOne({ email })
    if (user) {
      user.provider = provider
      user.providerId = providerId
      user.emailVerifiedAt = user.emailVerifiedAt || new Date()
      if (name && !user.name) user.name = name
      await user.save()
    }
  }

  // 3) If still not found, create new verified user
  if (!user) {
    user = await User.create({
      email,
      name,
      role: "owner",
      provider,
      providerId,
      passwordHash: await hashPassword(randomToken(16)), // dummy for social
      emailVerifiedAt: new Date(),
    })
  }

  // 4) Issue our tokens
  const { accessToken, refreshToken } = await issueTokensForUser({
    user,
    ua,
    ip,
  })
  return { accessToken, refreshToken, user }
}
