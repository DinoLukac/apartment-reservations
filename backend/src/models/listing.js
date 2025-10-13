import mongoose from "mongoose"
const ListingSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
      unique: true,
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, index: true },
    slug: { type: String, index: true },
    name: String,
    address: {
      city: String,
      country: String,
    },
    cover: String, // url ili dataUrl
    gallery: [String], // najviše 8 za javnu karticu
    amenities: [String],
    priceMin: Number,
    priceMax: Number,
    units: [
      {
        id: mongoose.Schema.Types.ObjectId,
        name: String,
        beds: Number,
        bedrooms: Number,
        pricePerNight: Number,
      },
    ],
    // snapshot meta & flags for public cards
    meta: {
      city: String,
      distanceToBeachMeters: Number,
    },
    flags: {
      family: Boolean,
      nearBeach: Boolean,
      petFriendly: Boolean,
      freeCancellation: Boolean,
      instantBooking: Boolean,
      taxesIncluded: Boolean,
    },
    bookingMode: String,
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: undefined,
      },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
      tz: { type: String },
    },
    // snapshot za 30 dana (true = slobodno, false = zauzeto)
    availNext30: [Boolean],
    publishedAt: Date,
    updatedAt: Date,
  },
  { timestamps: true }
)

export const Listing = mongoose.model("Listing", ListingSchema)
