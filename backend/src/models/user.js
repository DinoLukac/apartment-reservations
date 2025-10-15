import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    passwordHash: { type: String, required: true },
    name: { type: String },
    role: { type: String, enum: ["owner", "admin"], default: "owner" },
    provider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },
    providerId: { type: String }, // za OAuth
    verifyToken: { type: String }, // e-mail verify token
    verifyTokenExp: { type: Date },
    verifyTokenHash: { type: String }, // NOVO (ostavljamo verifyToken zbog kompatibilnosti)
    resetToken: { type: String },
    resetTokenExp: { type: Date },
    resetTokenHash: { type: String }, // NOVO (ostavljamo resetToken zbog kompatibilnosti)
  },
  { timestamps: true }
)

export const User = mongoose.model("user", userSchema)
