import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import cors from "cors"
import cookieParser from "cookie-parser"
import { env } from "./config/env.js"
import { corsOptions } from "./config/cors.js"
import authRoutes from "./routes/auth.js"
import { errorHandler } from "./middlewares/error.js"
import oauthRoutes from "./routes/oauth.js"
import { csrfIssue, csrfProtect } from "./middlewares/csrf.js"
import propertyRoutes from "./routes/properties.js"
import { publicRouter } from "./routes/public.js"
import reservationRoutes from "./routes/reservations.js"
import ownerReservationsRoutes from "./routes/owner-reservations.js"
import uploadsRoutes from "./routes/uploads.js"
const app = express()

if (env.SECURITY_HEADERS === "enabled") {
  app.use(helmet())
}

app.use(morgan("dev"))
app.use(cors(corsOptions))
// preflight za sve rute
app.options("*", cors(corsOptions))
// Increase JSON limit to tolerate compressed dataUrls in /properties/full (images are compressed server-side first)
app.use(express.json({ limit: "10mb" }))
app.use(cookieParser())
app.use(express.urlencoded({ extended: true, limit: "2mb" }))

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }))

app.use("/api/auth", authRoutes)
app.use("/api/auth/oauth", oauthRoutes)
// Public, no CSRF required
app.use("/api/public", publicRouter)
app.use("/api/reservations", reservationRoutes)
// CSRF endpoints: issue token and protect subsequent routes (non-auth)
app.get("/api/csrf", csrfIssue)
app.use(csrfProtect)
app.use("/api/properties", propertyRoutes)
app.use("/api/uploads", uploadsRoutes)
app.use("/api/owner/reservations", ownerReservationsRoutes)
app.use(errorHandler)

export default app
