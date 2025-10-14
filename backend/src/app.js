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

// Behind Render's proxy so that req.secure is set and Secure cookies work
app.set("trust proxy", 1)

app.use(morgan("dev"))
app.use(cors(corsOptions))
// preflight za sve rute
app.options("*", cors(corsOptions))
// Increase JSON limit to tolerate compressed dataUrls in /properties/full (images are compressed server-side first)
app.use(express.json({ limit: "10mb" }))
app.use(cookieParser())
app.use(express.urlencoded({ extended: true, limit: "2mb" }))

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }))

// Friendly root handler for backend root URL (Render opens this by default)
app.get("/", (_req, res) => {
  if (env.FRONTEND_URL) return res.redirect(env.FRONTEND_URL)
  return res.status(200).send("API is running. See /api/health")
})

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

// Catch-all for non-API GET routes: place BEFORE error handler
app.get(/^\/(?!api(\/|$)).*$/, (_req, res) => {
  if (env.FRONTEND_URL) return res.redirect(env.FRONTEND_URL)
  return res.status(404).send("Not Found. Frontend not configured.")
})

app.use(errorHandler)

export default app
