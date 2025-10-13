import crypto from "crypto"
import Reservation from "../models/Reservation.js"
import { isRangeAvailable, quotePrice } from "../services/reservationService.js"
import { updateListingAvailability } from "../utils/availability.js"
import { sendReservationConfirmation } from "../mailers/reservationMailer.js"
import { Property } from "../models/property.js"
import { validateEmailAddress } from "../utils/email.js"

function genCode() {
  // npr. APX-8F2K7
  return `APX-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
}

export const postQuote = async (req, res, next) => {
  try {
    const { propertyId, unitId, checkIn, checkOut, guests } = req.body
    const ci = new Date(checkIn),
      co = new Date(checkOut)
    if (!(ci < co)) return res.status(400).json({ error: "Bad dates" })

    const available = await isRangeAvailable({
      propertyId,
      unitId,
      checkIn: ci,
      checkOut: co,
    })
    if (!available) return res.json({ available: false })

    const price = await quotePrice({
      propertyId,
      unitId,
      checkIn: ci,
      checkOut: co,
      guests,
    })
    res.json({ available: true, ...price })
  } catch (e) {
    next(e)
  }
}

export const postCreate = async (req, res, next) => {
  try {
    const {
      propertyId,
      unitId,
      checkIn,
      checkOut,
      guests,
      guest = {},
      paymentMethod,
    } = req.body

    const ci = new Date(checkIn),
      co = new Date(checkOut)
    if (!(ci < co)) return res.status(400).json({ error: "Bad dates" })

    const available = await isRangeAvailable({
      propertyId,
      unitId,
      checkIn: ci,
      checkOut: co,
    })
    if (!available)
      return res.status(409).json({ error: "Dates not available" })

    const { nights, pricePerNight, total, currency } = await quotePrice({
      propertyId,
      unitId,
      checkIn: ci,
      checkOut: co,
      guests,
    })

    const code = genCode()

    // Normalize guest structure (accept guest.name or guest.fullName)
    const normalizedGuest = {
      fullName: guest.fullName || guest.name || "",
      email: guest.email || "",
      phone: guest.phone || "",
      country: guest.country || "",
      note: guest.note || "",
      invoice: guest.company
        ? {
            need: true,
            company: guest.company.name || "",
            pib: guest.company.vat || guest.company.pib || "",
            address: guest.company.address || "",
          }
        : { need: false },
    }

    if (!normalizedGuest.fullName || !normalizedGuest.email) {
      return res
        .status(400)
        .json({ error: "Guest fullName i email su obavezni" })
    }

    // Email format + MX (soft) validation
    const emailCheck = await validateEmailAddress(normalizedGuest.email, {
      mx: true,
    })
    if (!emailCheck.ok) {
      return res
        .status(400)
        .json({ error: "Neispravan email (" + emailCheck.reason + ")" })
    }

    const payMethod = ["pay_on_arrival", "card"].includes(paymentMethod)
      ? paymentMethod
      : "pay_on_arrival"

    // Fetch property & derive ownerId (and ensure unit exists)
    const prop = await Property.findById(propertyId).select("ownerId units")
    if (!prop) return res.status(404).json({ error: "Property not found" })
    const unitExists = prop.units.id(unitId)
    if (!unitExists) return res.status(404).json({ error: "Unit not found" })
    const r = await Reservation.create({
      code,
      status: "confirmed",
      ownerId: prop.ownerId,
      propertyId,
      unitId,
      checkIn: ci,
      checkOut: co,
      nights,
      guests,
      pricePerNight,
      total,
      currency,
      payment: {
        method: payMethod,
        paid: payMethod === "card" ? false : false,
      },
      guest: normalizedGuest,
    })

    // e-mail potvrda (+ .ics u attachmentu)
    await sendReservationConfirmation(r)

    try {
      await updateListingAvailability(propertyId)
    } catch {}

    res.json({
      ok: true,
      code: r.code,
      total: r.total,
      currency: r.currency,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
    })
  } catch (e) {
    next(e)
  }
}

// GET /api/reservations/mine?email=
// Public guest-facing list by guest email (simple key). Later can secure via magic link / token.
export const listGuestReservations = async (req, res, next) => {
  try {
    const email = String(req.query.email || "")
      .trim()
      .toLowerCase()
    if (!email) return res.status(400).json({ error: "Email required" })
    // basic validation reuse (no MX to keep fast)
    const valid = /.+@.+\..+/.test(email)
    if (!valid) return res.status(400).json({ error: "Bad email format" })
    const {
      status, // confirmed / cancelled
      q, // code search
      from, // ISO date start
      to, // ISO date end
      page = 1,
      limit = 50,
    } = req.query
    const lim = Math.min(parseInt(limit) || 50, 200)
    const pg = Math.max(parseInt(page) || 1, 1)
    const filter = { "guest.email": email }
    if (status && ["confirmed", "cancelled"].includes(status))
      filter.status = status
    if (q) filter.code = q.toString().trim().toUpperCase()
    // Date filtering inclusive of overlap if either CI/CO inside range
    if (from || to) {
      const fDate = from ? new Date(from) : null
      const tDate = to ? new Date(to) : null
      const dateCond = {}
      if (fDate && !isNaN(fDate)) dateCond.$gte = fDate
      if (tDate && !isNaN(tDate)) dateCond.$lte = tDate
      if (Object.keys(dateCond).length) {
        // Filter by checkIn within range (simpler MVP); could expand to overlap logic
        filter.checkIn = dateCond
      }
    }
    const [rows, totalCount] = await Promise.all([
      Reservation.find(filter)
        .sort({ createdAt: -1 })
        .skip((pg - 1) * lim)
        .limit(lim)
        .lean(),
      Reservation.countDocuments(filter),
    ])
    // Map property names (batch fetch unique ids)
    const propIds = [...new Set(rows.map((r) => String(r.propertyId)))]
    const props = await Property.find({ _id: { $in: propIds } })
      .select("name address location")
      .lean()
    const propMap = new Map(props.map((p) => [String(p._id), p]))
    const data = rows.map((r) => ({
      code: r.code,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      guests: r.guests,
      total: r.total,
      currency: r.currency,
      pricePerNight: r.pricePerNight,
      propertyId: r.propertyId,
      property: propMap.get(String(r.propertyId))
        ? {
            name: propMap.get(String(r.propertyId)).name,
            address: propMap.get(String(r.propertyId)).address,
            location: propMap.get(String(r.propertyId)).location || null,
          }
        : null,
      createdAt: r.createdAt,
    }))
    res.json({
      rows: data,
      count: data.length,
      total: totalCount,
      page: pg,
      pages: Math.ceil(totalCount / lim) || 1,
      limit: lim,
    })
  } catch (e) {
    next(e)
  }
}

// GET /api/reservations/:code (guest detail) requires ?email= query param for simple auth
export const getGuestReservationDetail = async (req, res, next) => {
  try {
    const code = (req.params.code || "").trim().toUpperCase()
    const email = String(req.query.email || "")
      .trim()
      .toLowerCase()
    if (!code) return res.status(400).json({ error: "Code required" })
    if (!email) return res.status(400).json({ error: "Email required" })
    const valid = /.+@.+\..+/.test(email)
    if (!valid) return res.status(400).json({ error: "Bad email format" })
    const r = await Reservation.findOne({ code, "guest.email": email }).lean()
    if (!r) return res.status(404).json({ error: "Not found" })
    const prop = await Property.findById(r.propertyId)
      .select("name address location units")
      .lean()
    const unit = prop?.units?.find((u) => String(u._id) === String(r.unitId))
    res.json({
      code: r.code,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      guests: r.guests,
      currency: r.currency,
      pricePerNight: r.pricePerNight,
      total: r.total,
      payment: r.payment,
      guest: r.guest,
      property: prop
        ? {
            name: prop.name,
            address: prop.address,
            location: prop.location || null,
            unit: unit
              ? { _id: unit._id, name: unit.name, bedrooms: unit.bedrooms }
              : null,
          }
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })
  } catch (e) {
    next(e)
  }
}

// PATCH /api/reservations/:code/cancel?email=
// Simple guest-driven cancellation (MVP). Rules:
// - must match code + guest email
// - reservation status must be confirmed
// - checkIn date must be in the future (>= today 00:00)
export const cancelGuestReservation = async (req, res, next) => {
  try {
    const code = (req.params.code || "").trim().toUpperCase()
    const email = String(req.query.email || req.body.email || "")
      .trim()
      .toLowerCase()
    if (!code) return res.status(400).json({ error: "Code required" })
    if (!email) return res.status(400).json({ error: "Email required" })
    const r = await Reservation.findOne({ code, "guest.email": email })
    if (!r) return res.status(404).json({ error: "Not found" })
    if (r.status === "cancelled")
      return res.status(400).json({ error: "Already cancelled" })
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (r.checkIn <= today)
      return res.status(400).json({ error: "Cannot cancel after check-in" })
    r.status = "cancelled"
    await r.save()
    try {
      await updateListingAvailability(r.propertyId)
    } catch {}
    res.json({ ok: true, status: r.status })
  } catch (e) {
    next(e)
  }
}
