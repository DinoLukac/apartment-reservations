import { Router } from "express"
import {
  postRegister,
  getVerifyEmail,
  postLogin,
  postRefresh,
  postLogout,
} from "../controllers/auth-controller.js"
import {
  postRequestPasswordReset,
  postResetPassword,
} from "../controllers/auth-controller.js"
import { makeLimiter } from "../middlewares/rate-limit.js"
import { postResendVerify } from "../controllers/auth-controller.js"
import { oauthLinkEmail } from "../controllers/oauth-controller.js"
import {
  getMe,
  getSessions,
  deleteSession,
  deleteSessionsAll,
} from "../controllers/auth-controller.js"
const r = Router()

const loginLimiter = makeLimiter(60_000, 5)
const resetLimiter = makeLimiter(60_000, 5)

r.post("/register", postRegister)
r.get("/verify-email", getVerifyEmail)
r.post("/login", loginLimiter, postLogin)
r.post("/refresh", postRefresh)
r.post("/logout", postLogout)

r.post("/request-password-reset", resetLimiter, postRequestPasswordReset)
r.post("/reset-password", postResetPassword)
r.post("/resend-verify", postResendVerify)
// Sessions & Me
r.get("/me", getMe)
r.get("/sessions", getSessions)
r.delete("/sessions/:id", deleteSession)
r.delete("/sessions", deleteSessionsAll)
// OAuth link email (Facebook when email missing)
r.post("/oauth/link-email", oauthLinkEmail)
export default r
