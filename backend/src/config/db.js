import mongoose from "mongoose"
import { env } from "./env.js"

export const connectDb = async () => {
  const uri = `${env.MONGO_URL}/${env.MONGO_DB_NAME}`
  await mongoose.connect(uri)
  console.log("[db] connected")
}
