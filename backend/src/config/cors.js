import { env } from "./env.js"

export const corsOptions = {
  origin: env.CORS_ORIGIN.split(","),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  exposedHeaders: ["Content-Length", env.REQUEST_ID_HEADER || "x-request-id"],
  optionsSuccessStatus: 204,
}
