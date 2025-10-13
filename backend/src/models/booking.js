import mongoose from "mongoose"
const bookingSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Types.ObjectId,
      ref: "property",
      index: true,
      required: true,
    },
    unitId: { type: mongoose.Types.ObjectId, index: true }, // _id subdok. iz property.units
    source: { type: String, enum: ["internal", "external"], required: true },
    kind: {
      type: String,
      enum: ["reservation", "external_block"],
      default: "external_block",
    },

    externalUid: { type: String, index: true }, // UID ili hash
    summary: { type: String },

    start: { type: Date, index: true, required: true },
    end: { type: Date, index: true, required: true },
  },
  { timestamps: true }
)

bookingSchema.index(
  { propertyId: 1, unitId: 1, externalUid: 1 },
  {
    unique: true,
    partialFilterExpression: { externalUid: { $type: "string" } },
  }
)

export const Booking = mongoose.model("booking", bookingSchema)
