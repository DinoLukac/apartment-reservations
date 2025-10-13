import { Router } from "express"
import {
  googleStart,
  googleCallback,
  facebookStart,
  facebookCallback,
  googleToken,
  facebookToken,
} from "../controllers/oauth-controller.js"
import { oauthLinkEmail } from "../controllers/oauth-controller.js"
const r = Router()

r.get("/google/start", googleStart)
r.get("/google/callback", googleCallback)

r.get("/facebook/start", facebookStart)
r.get("/facebook/callback", facebookCallback)
r.post("/google/callback", googleToken)
r.post("/facebook/callback", facebookToken)
r.post("/link-email", oauthLinkEmail)
export default r
