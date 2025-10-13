import { createRemoteJWKSet, jwtVerify } from "jose"

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
)

// Verify Google ID Token via JWKS (issuer, audience, signature), and optional nonce
export async function verifyGoogleIdToken(idToken, { aud, nonce } = {}) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: aud,
  })
  if (nonce && payload?.nonce !== nonce) {
    const e = new Error("Nonce mismatch")
    e.status = 400
    throw e
  }
  return payload // {sub, email, email_verified, name, picture, ...}
}
