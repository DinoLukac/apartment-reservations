import mongoose from "mongoose"

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "user",
      index: true,
      required: true,
    },
    tokenHash: { type: String, required: true }, // hashiramo RT za sigurnost
    expiresAt: { type: Date, required: true },
    rotatedAt: { type: Date }, // za rotaciju
    lastUsedAt: { type: Date }, // posljednje korištenje (refresh)
    revokedAt: { type: Date }, // reuse detect
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true }
)

export const RefreshToken = mongoose.model("refresh_token", refreshTokenSchema)
