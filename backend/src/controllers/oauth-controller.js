import { env } from "../config/env.js"
import { makeState, verifyState, randomToken } from "../utils/crypto.js"
import jwt from "jsonwebtoken"
import { verifyGoogleIdToken } from "../utils/jwks.js"
import { socialLogin } from "../services/auth-service.js"

const isAllowedRedirect = (u) => {
  try {
    const url = new URL(u)
    return env.OAUTH_REDIRECT_ALLOWLIST.some((allowed) =>
      url.href.startsWith(allowed)
    )
  } catch {
    return false
  }
}

const setRtCookie = (res, token) => {
  const maxAge = (env.SESSION_TTL_HOURS || 24) * 60 * 60 * 1000
  res.cookie("rt", token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN,
    path: "/",
    maxAge,
  })
}

/** -------- GOOGLE -------- */
export const googleStart = async (req, res) => {
  const dest = String(
    req.query.redirect || `${env.FRONTEND_URL}/oauth/callback`
  )
  if (!isAllowedRedirect(dest)) return res.status(400).send("Bad redirect")

  const nonce = randomToken(16)
  const st = makeState(env.JWT_SECRET, {
    p: "google",
    ts: Date.now(),
    nonce,
    dest,
  })

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT,
    response_type: "code",
    scope: "openid email profile",
    state: st,
    nonce, // OIDC nonce
    include_granted_scopes: "true",
    prompt: "consent", // osiguraj ekran (dev)
    access_type: "offline", // nije neophodno, ali ok
  })

  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}

export const googleCallback = async (req, res) => {
  const { code, state } = req.query
  const sv = verifyState(env.JWT_SECRET, state)
  if (env.OAUTH_STATE_ENFORCE && !sv)
    return res.status(400).send("Invalid state")
  if (sv?.p !== "google") return res.status(400).send("Bad provider state")
  if (sv?.ts && Date.now() - sv.ts > 10 * 60 * 1000)
    return res.status(400).send("State expired")

  // Exchange code -> tokens
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT,
    grant_type: "authorization_code",
  })

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const tok = await tokenResp.json()
  if (!tok.id_token) return res.status(400).send("No id_token")

  // JOSE + JWKS verifikacija (iss, aud, potpis, a zatim i nonce)
  await verifyGoogleIdToken(tok.id_token, {
    aud: env.GOOGLE_CLIENT_ID,
    nonce: sv.nonce,
  })

  // Userinfo (sigurnije iz userinfo endpointa)
  const uiResp = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    }
  )
  const ui = await uiResp.json()

  const email = ui.email
  const name = ui.name || ui.given_name || ""
  const providerId = ui.sub

  const ua = req.headers["user-agent"] || ""
  const ip = req.ip

  const { refreshToken } = await socialLogin({
    provider: "google",
    providerId,
    email,
    name,
    ua,
    ip,
  })
  setRtCookie(res, refreshToken)

  res.redirect(sv.dest || `${env.FRONTEND_URL}/oauth/callback?ok=1`)
}

/** -------- FACEBOOK -------- */
export const facebookStart = async (req, res) => {
  const dest = String(
    req.query.redirect || `${env.FRONTEND_URL}/oauth/callback`
  )
  if (!isAllowedRedirect(dest)) return res.status(400).send("Bad redirect")

  const st = makeState(env.JWT_SECRET, {
    p: "facebook",
    ts: Date.now(),
    dest,
  })

  const params = new URLSearchParams({
    client_id: env.FACEBOOK_CLIENT_ID,
    redirect_uri: env.FACEBOOK_REDIRECT,
    response_type: "code",
    state: st,
    scope: "email,public_profile",
  })

  res.redirect(
    `https://www.facebook.com/v17.0/dialog/oauth?${params.toString()}`
  )
}

export const facebookCallback = async (req, res) => {
  const { code, state } = req.query
  const sv = verifyState(env.JWT_SECRET, state)
  if (env.OAUTH_STATE_ENFORCE && !sv)
    return res.status(400).send("Invalid state")
  if (sv?.p !== "facebook") return res.status(400).send("Bad provider state")
  if (sv?.ts && Date.now() - sv.ts > 10 * 60 * 1000)
    return res.status(400).send("State expired")

  // Exchange code -> token
  const tokenParams = new URLSearchParams({
    client_id: env.FACEBOOK_CLIENT_ID,
    client_secret: env.FACEBOOK_CLIENT_SECRET,
    redirect_uri: env.FACEBOOK_REDIRECT,
    code,
  })

  const tokenResp = await fetch(
    `https://graph.facebook.com/v17.0/oauth/access_token?${tokenParams}`
  )
  const tok = await tokenResp.json()
  if (!tok.access_token) return res.status(400).send("No access token")

  // Userinfo
  const uiResp = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tok.access_token}`
  )
  const ui = await uiResp.json()

  const email = ui.email || "" // FB ponekad ne vrati email
  const name = ui.name || ""
  const providerId = ui.id

  const ua = req.headers["user-agent"] || ""
  const ip = req.ip

  // Ako Facebook ne vrati email, pošalji na FE da unese email (link tok)
  if (!email) {
    const linkState = makeState(env.JWT_SECRET, {
      p: "facebook",
      pid: providerId,
      ts: Date.now(),
    })
    const base = sv.dest || env.FRONTEND_URL + "/oauth/callback"
    const dest = `${base}?link_email=1&state=${encodeURIComponent(linkState)}`
    return res.redirect(dest)
  }

  const { refreshToken } = await socialLogin({
    provider: "facebook",
    providerId,
    email,
    name,
    ua,
    ip,
  })
  setRtCookie(res, refreshToken)

  res.redirect(sv.dest || `${env.FRONTEND_URL}/oauth/callback?ok=1`)
}

// Link email after Facebook (no email case)
export const oauthLinkEmail = async (req, res) => {
  const { state, email } = req.body || {}
  if (!email || !state) return res.status(400).json({ error: "Missing data" })

  const st = verifyState(env.JWT_SECRET, state)
  if (!st || st.p !== "facebook" || !st.pid)
    return res.status(400).json({ error: "Invalid state" })
  if (st.ts && Date.now() - st.ts > 10 * 60 * 1000)
    return res.status(400).json({ error: "State expired" })

  const ua = req.headers["user-agent"] || ""
  const ip = req.ip

  const { refreshToken } = await socialLogin({
    provider: "facebook",
    providerId: st.pid,
    email,
    name: "",
    ua,
    ip,
  })

  setRtCookie(res, refreshToken)
  return res.json({ ok: true })
}

// ---- SDK/token-post variants ----
export const googleToken = async (req, res) => {
  try {
    const cred = String(req.body?.credential || "")
    if (!cred) return res.status(400).json({ error: "Missing credential" })
    const claims = await verifyGoogleIdToken(cred, {
      aud: env.GOOGLE_CLIENT_ID,
    })
    const email = claims.email
    const name = claims.name || claims.given_name || ""
    const providerId = claims.sub
    if (!email || !providerId)
      return res.status(400).json({ error: "Invalid id token" })
    const ua = req.headers["user-agent"] || ""
    const ip = req.ip
    const { refreshToken } = await socialLogin({
      provider: "google",
      providerId,
      email,
      name,
      ua,
      ip,
    })
    const maxAge = (env.SESSION_TTL_HOURS || 24) * 60 * 60 * 1000
    res.cookie("rt", refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
      domain: env.COOKIE_DOMAIN,
      path: "/",
      maxAge,
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: "Invalid Google token" })
  }
}

export const facebookToken = async (req, res) => {
  try {
    const accessToken = String(req.body?.accessToken || "")
    const userID = String(req.body?.userID || "")
    if (!accessToken || !userID)
      return res.status(400).json({ error: "Missing token" })
    // Validate token via debug_token
    const params = new URLSearchParams({
      input_token: accessToken,
      access_token: `${env.FACEBOOK_CLIENT_ID}|${
        env.FACEBOOK_SECRET || env.FACEBOOK_CLIENT_SECRET
      }`,
    })
    const dbg = await fetch(`https://graph.facebook.com/debug_token?${params}`)
    const dj = await dbg.json()
    if (!dj?.data?.is_valid || dj?.data?.app_id !== env.FACEBOOK_CLIENT_ID)
      return res.status(400).json({ error: "Invalid Facebook token" })
    // Fetch user profile (email may be missing)
    const uiResp = await fetch(
      `https://graph.facebook.com/${userID}?fields=id,name,email&access_token=${accessToken}`
    )
    const ui = await uiResp.json()
    const email = ui.email || ""
    const name = ui.name || ""
    const providerId = ui.id || userID
    const ua = req.headers["user-agent"] || ""
    const ip = req.ip
    if (!email) {
      // Return a state token to FE to link email next
      const linkState = makeState(env.JWT_SECRET, {
        p: "facebook",
        pid: providerId,
        ts: Date.now(),
      })
      return res.status(200).json({ linkEmail: true, state: linkState })
    }
    const { refreshToken } = await socialLogin({
      provider: "facebook",
      providerId,
      email,
      name,
      ua,
      ip,
    })
    const maxAge = (env.SESSION_TTL_HOURS || 24) * 60 * 60 * 1000
    res.cookie("rt", refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
      domain: env.COOKIE_DOMAIN,
      path: "/",
      maxAge,
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: "Invalid Facebook token" })
  }
}
