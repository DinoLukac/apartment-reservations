import { z } from "zod"
import {
  registerUser,
  verifyEmail,
  loginUser,
  rotateRefresh,
  logoutUser,
} from "../services/auth-service.js"
import { env } from "../config/env.js"
import {
  requestPasswordReset,
  resetPassword as doResetPassword,
} from "../services/auth-service.js"
import { resendVerifyEmail } from "../services/auth-service.js"
import {
  listSessions,
  revokeSession,
  revokeAllSessions,
} from "../services/auth-service.js"
import { verifyToken } from "../utils/jwt.js"
import { issueTokensForUser } from "../services/auth-service.js"
import { User } from "../models/user.js"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
})

export const postRegister = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body)
    const user = await registerUser(data)
    res.status(201).json({ ok: true, user })
  } catch (e) {
    next(e)
  }
}

export const getVerifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.query
    await verifyEmail({ token, email })

    const emailNorm = String(email || "")
      .trim()
      .toLowerCase()
    const user = await User.findOne({ email: emailNorm })
    if (!user) return res.status(400).send("User not found")
    const ua = req.headers["user-agent"] || ""
    const ip = req.ip

    const { refreshToken } = await issueTokensForUser({ user, ua, ip })

    // postavi RT cookie sa 24h
    const maxAge = (env.SESSION_TTL_HOURS || 24) * 60 * 60 * 1000
    res.cookie("rt", refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
      domain: env.COOKIE_DOMAIN,
      path: "/",
      maxAge,
    })

    return res.redirect(`${env.FRONTEND_URL}/dashboard`)
  } catch (e) {
    next(e)
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const setRefreshCookie = (res, refreshToken) => {
  const maxAge = (env.SESSION_TTL_HOURS || 24) * 60 * 60 * 1000
  res.cookie("rt", refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN,
    path: "/",
    maxAge,
  })
}

export const postLogin = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body)
    const ua = req.headers["user-agent"] || ""
    const ip = req.ip
    const { accessToken, refreshToken, user } = await loginUser({
      ...data,
      ua,
      ip,
    })
    setRefreshCookie(res, refreshToken)
    res.json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    })
  } catch (e) {
    next(e)
  }
}

export const postRefresh = async (req, res, next) => {
  try {
    const rt = req.cookies?.rt || req.body?.refreshToken
    if (!rt)
      throw Object.assign(new Error("Nedostaje refresh token"), { status: 400 })
    const ua = req.headers["user-agent"] || ""
    const ip = req.ip
    const { accessToken, refreshToken } = await rotateRefresh({
      refreshToken: rt,
      ua,
      ip,
    })
    setRefreshCookie(res, refreshToken)
    res.json({ accessToken })
  } catch (e) {
    next(e)
  }
}

export const postLogout = async (req, res, next) => {
  try {
    const rt = req.cookies?.rt || req.body?.refreshToken
    if (rt) await logoutUser({ refreshToken: rt })
    res.clearCookie("rt", { path: "/" })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

const requestResetSchema = z.object({
  email: z.string().email(),
})

export const postRequestPasswordReset = async (req, res, next) => {
  try {
    const { email } = requestResetSchema.parse(req.body)
    await requestPasswordReset({ email })
    // uvijek vraćamo ok, bez obzira postoji li email (anti-enumeration)
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

const resetSchema = z.object({
  email: z.string().email(),
  token: z.string().min(10),
  newPassword: z.string().min(8),
})

export const postResetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = resetSchema.parse(req.body)
    await doResetPassword({ email, token, newPassword })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

export const postResendVerify = async (req, res, next) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase()
    if (!email)
      throw Object.assign(new Error("Email je obavezan"), { status: 400 })
    await resendVerifyEmail({ email })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

// --- Sessions & Me ---
export const getMe = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: "Unauthenticated" })
    const payload = verifyToken(token)
    const user = await User.findById(payload.sub)
      .select("email name role")
      .lean()
    if (!user) return res.status(404).json({ error: "User not found" })
    res.json({
      id: payload.sub,
      role: user.role || payload.role || "owner",
      email: user.email || null,
      name: user.name || null,
    })
  } catch (e) {
    next(e)
  }
}

export const getSessions = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: "Unauthenticated" })
    const payload = verifyToken(token)
    const items = await listSessions(payload.sub)
    res.json({ items })
  } catch (e) {
    next(e)
  }
}

export const deleteSession = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: "Unauthenticated" })
    const payload = verifyToken(token)
    await revokeSession({ userId: payload.sub, sessionId: req.params.id })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

export const deleteSessionsAll = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: "Unauthenticated" })
    const payload = verifyToken(token)
    await revokeAllSessions({ userId: payload.sub })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}
