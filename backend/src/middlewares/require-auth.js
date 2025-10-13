import { verifyToken } from "../utils/jwt.js"

export const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: "Unauthenticated" })
  try {
    const payload = verifyToken(token)
    req.user = { id: payload.sub, role: payload.role || "owner" }
    next()
  } catch {
    return res.status(401).json({ error: "Unauthenticated" })
  }
}
