import jwt from "jsonwebtoken"
import { env } from "../config/env.js"

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL,
  })

export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.REFRESH_TOKEN_TTL,
  })

export const verifyToken = (token) =>
  jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  })
