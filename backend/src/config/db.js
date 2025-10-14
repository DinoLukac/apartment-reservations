import mongoose from "mongoose"
import { env } from "./env.js"

// Build a Mongo URI that works whether MONGO_URL already contains a DB name
// or query params (e.g., Atlas SRV strings). If a DB path is present, leave it;
// otherwise, insert MONGO_DB_NAME before any query string.
function buildMongoUri(baseUrl, dbName) {
  if (!baseUrl) throw new Error("MONGO_URL missing")
  const [baseNoQuery, query = ""] = String(baseUrl).split("?")
  const hasDbPath = /^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^/?#]+)/i.test(
    baseNoQuery
  )
  if (hasDbPath) {
    return query ? `${baseNoQuery}?${query}` : baseNoQuery
  }
  const cleanedBase = baseNoQuery.replace(/\/+$/, "")
  return query
    ? `${cleanedBase}/${dbName}?${query}`
    : `${cleanedBase}/${dbName}`
}

export const connectDb = async () => {
  const uri = buildMongoUri(env.MONGO_URL, env.MONGO_DB_NAME)
  await mongoose.connect(uri)
  console.log("[db] connected")
}
