import mongoose from "mongoose"

const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // npr. "Apartman 1"
    bedrooms: { type: Number, min: 0, default: 0 },
    beds: { type: Number, min: 0, default: 0 },
    pricePerNight: { type: Number, min: 0, default: 0 }, // EUR
    ical: {
      importUrl: { type: String },
      etag: { type: String },
      lastModified: { type: String },
      lastFetchedAt: { type: Date },
      lastStatus: {
        httpStatus: { type: Number }, // 200/304/…
        addedLastRun: { type: Number }, // koliko je novo dodato u zadnjem sync-u
        eventsTotal: { type: Number }, // ukupno VEVENT u feedu u zadnjem sync-u
        error: { type: String }, // poruka ako je bilo greške
        syncedAt: { type: Date }, // timestamp zadnjeg završetka sync-a
      },
    },
  },
  { _id: true }
)

const propSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Types.ObjectId,
      ref: "user",
      index: true,
      required: true,
    },
    status: { type: String, enum: ["draft", "active"], default: "draft" },

    name: { type: String, required: true },
    amenities: [{ type: String }],

    // Proširena adresa (zadržavamo postojeća polja zbog kompatibilnosti)
    address: {
      country: { type: String, required: true },
      municipality: { type: String, required: true }, // fallback za "city"
      line1: { type: String, required: true }, // fallback za "street"
      // Nova neobavezna granularnost (ako se doda kroz novu formu)
      city: { type: String },
      street: { type: String },
      zipcode: { type: String },
      formatted: { type: String }, // npr. "Bregvija, Ulcinj, Crna Gora"
    },
    timezone: { type: String, required: true },

    units: { type: [unitSchema], default: [] }, // ⇦ više apartmana
    commissionPct: { type: Number, min: 0, max: 1, default: 0.35 }, // tvoja provizija (35%)
    photos: [
      {
        name: { type: String }, // originalni naziv fajla
        size: { type: Number }, // bajtovi
        type: { type: String }, // MIME tip
        order: { type: Number }, // pozicija
        source: { type: String, enum: ["upload", "url"], default: "upload" }, // porijeklo
        url: { type: String }, // ako je importovana eksterno (URL izvor)
        dataUrl: { type: String }, // privremeni base64 (MVP) – kasnije zamjena S3 linkom
      },
    ],
    // publish status – dodano bez uticaja na postojeći kod (default=false)
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date },

    // Dodatna meta & flagovi za istaknute opcije na karticama
    meta: {
      city: { type: String, trim: true },
      distanceToBeachMeters: { type: Number, min: 0 },
    },
    flags: {
      family: { type: Boolean, default: false }, // Porodično (4+)
      nearBeach: { type: Boolean, default: false },
      petFriendly: { type: Boolean, default: false },
      freeCancellation: { type: Boolean, default: false },
      instantBooking: { type: Boolean, default: false },
      taxesIncluded: { type: Boolean, default: false },
    },
    cancellationPolicy: { type: String, default: "" },
    bookingMode: {
      type: String,
      enum: ["request", "instant"],
      default: "request",
    },
    // Neobavezna Geo lokacija (GeoJSON Point) — čuvamo samo ako je setovana
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: undefined,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
        validate: {
          validator: function (arr) {
            if (!arr || arr.length === 0) return true // not set => OK
            return arr.length === 2 && arr.every((n) => typeof n === "number")
          },
          message: "coordinates must be [lng, lat]",
        },
      },
      tz: { type: String }, // opcionalno: timezone iz geokoda
    },
  },
  { timestamps: true }
)

// Geo indeks samo ako polje postoji (Mongo će ga napraviti; upsert safe)
propSchema.index({ location: "2dsphere" })

export const Property = mongoose.model("property", propSchema)
