import mongoose from "mongoose"

const GuestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
    note: { type: String, trim: true },
    invoice: {
      need: { type: Boolean, default: false },
      company: { type: String, trim: true },
      pib: { type: String, trim: true },
      address: { type: String, trim: true },
    },
  },
  { _id: false }
)

const ReservationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // npr. APX-8F2K7
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },

    ownerId: { type: mongoose.Types.ObjectId, required: true, index: true },
    propertyId: { type: mongoose.Types.ObjectId, required: true, index: true },
    unitId: { type: mongoose.Types.ObjectId, required: true, index: true },

    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    nights: { type: Number, required: true, min: 1 },
    guests: { type: Number, required: true, min: 1 },

    currency: { type: String, default: "EUR" },
    pricePerNight: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    channel: { type: String, default: "direct", index: true }, // direct / ota / manual
    tags: [{ type: String, trim: true }],

    payment: {
      method: {
        type: String,
        enum: ["pay_on_arrival", "card"],
        default: "pay_on_arrival",
      },
      paid: { type: Boolean, default: false },
    },

    guest: { type: GuestSchema, required: true },
  },
  { timestamps: true }
)

export default mongoose.model("Reservation", ReservationSchema)
