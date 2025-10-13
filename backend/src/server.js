import { createServer } from "http"
import app from "./app.js"
import { env } from "./config/env.js"
import { connectDb } from "./config/db.js"
import { startCron } from "./jobs/cron.js"
import { fileURLToPath } from "url"
import { publicRouter } from "./routes/public.js"
import reservationRoutes from "./routes/reservations.js"
const server = createServer(app)

app.use("/api/public", publicRouter)
app.use("/api/reservations", reservationRoutes)
// Ensure we don't schedule cron jobs multiple times (e.g., on hot reload)
let cronStarted = false
function safeStartCron() {
  if (cronStarted) return
  try {
    startCron()
    cronStarted = true
    console.log("[cron] started")
  } catch (err) {
    console.error("[cron] failed to start", err)
  }
}

const start = async () => {
  try {
    await connectDb()
    server.listen(env.PORT, () => {
      console.log(`[server] listening on ${env.PORT} (${env.NODE_ENV})`)
      // Start cron only after the server is up and DB is connected
      safeStartCron()
    })
  } catch (err) {
    console.error("[server] failed to start", err)
    process.exit(1)
  }
}

// Only autostart when this file is the entry point (useful for tests/tools)
const isMainEntry = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainEntry) start()

export { server, start }
