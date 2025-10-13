import { randomBytes, createHash, createHmac } from "crypto"

export const randomToken = (bytes = 32) =>
  randomBytes(bytes).toString("base64url") // Node 18+: 'base64url'

export const sha256 = (str) => createHash("sha256").update(str).digest("hex")

export const hmacSign = (secret, payloadB64) =>
  createHmac("sha256", secret).update(payloadB64).digest("base64url")

export const makeState = (secret, obj) => {
  const b64 = Buffer.from(JSON.stringify(obj)).toString("base64url")
  const sig = hmacSign(secret, b64)
  return `${b64}.${sig}`
}

export const verifyState = (secret, state) => {
  const [b64, sig] = String(state || "").split(".")
  if (!b64 || !sig) return null
  const expect = hmacSign(secret, b64)
  if (expect !== sig) return null
  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8"))
  } catch {
    return null
  }
}
