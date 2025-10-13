import mongoose from "mongoose"
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: "user", index: true },
    action: { type: String, index: true }, // login_success, refresh, logout, reset_password, verify_email, oauth_login
    ip: String,
    ua: String,
    meta: Object,
  },
  { timestamps: true }
)

export const AuditLog = mongoose.model("audit_log", schema)
