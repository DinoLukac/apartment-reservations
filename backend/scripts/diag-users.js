import { connectDb } from "../src/config/db.js"
import { User } from "../src/models/user.js"

async function main() {
  const emailArg = process.argv[2]
  if (!emailArg) {
    console.error("Usage: node scripts/diag-users.js <email>")
    process.exit(1)
  }
  const email = String(emailArg).trim().toLowerCase()
  await connectDb()
  const docs = await User.find({ email })
  console.log(`Found ${docs.length} user(s) with email='${email}':`)
  for (const d of docs) {
    console.log({
      id: d._id.toString(),
      email: d.email,
      verified: !!d.emailVerifiedAt,
      createdAt: d.createdAt,
    })
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
