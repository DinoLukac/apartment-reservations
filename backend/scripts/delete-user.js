import { connectDb } from "../src/config/db.js"
import { User } from "../src/models/user.js"
import { RefreshToken } from "../src/models/refresh-token.js"

async function main() {
  const emailArg = process.argv[2]
  if (!emailArg) {
    console.error("Usage: node scripts/delete-user.js <email>")
    process.exit(1)
  }
  const email = String(emailArg).trim().toLowerCase()
  await connectDb()
  const user = await User.findOne({ email })
  if (!user) {
    console.log("No user for email:", email)
    process.exit(0)
  }
  await RefreshToken.deleteMany({ userId: user._id })
  await User.deleteOne({ _id: user._id })
  console.log("Deleted user", { id: user._id.toString(), email: user.email })
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
