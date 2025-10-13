import rateLimit from "express-rate-limit"

export const makeLimiter = (windowMs, max) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
