import { connectDb } from "../src/config/db.js"
import mongoose from "mongoose"

// Usage:
//  node scripts/wipe-db.js --dry-run
//  node scripts/wipe-db.js --yes
//  node scripts/wipe-db.js --force --yes   (allow in non-development NODE_ENV)

function hasFlag(name) {
  return process.argv.includes(name)
}

async function main() {
  const dryRun = hasFlag("--dry-run")
  const force = hasFlag("--force")
  const yes = hasFlag("--yes")

  await connectDb()
  const db = mongoose.connection.db
  const dbName = db.databaseName

  console.log(`[wipe-db] connected to database: ${dbName}`)

  if (dryRun) {
    const colls = await db.listCollections().toArray()
    console.log(
      `[wipe-db] dry-run: would drop database '${dbName}'. Collections:`,
      colls.map((c) => c.name)
    )
    process.exit(0)
  }

  if (process.env.NODE_ENV !== "development" && !force) {
    console.error(
      "[wipe-db] Refusing to drop DB in NODE_ENV != development without --force"
    )
    process.exit(2)
  }

  if (!yes) {
    console.error(
      "[wipe-db] This will DROP the entire database '%s'. Re-run with --yes to proceed.",
      dbName
    )
    process.exit(3)
  }

  await db.dropDatabase()
  console.log(`[wipe-db] dropped database '${dbName}' successfully.`)
  process.exit(0)
}

main().catch((e) => {
  console.error("[wipe-db] error:", e.message)
  process.exit(1)
})
