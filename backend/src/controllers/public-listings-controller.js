import { Listing } from "../models/listing.js"
import { pubsub } from "../lib/pubsub.js"
import { calcUnitAvailNextNDays } from "../utils/availability.js"
import Reservation from "../models/Reservation.js"
import { Booking } from "../models/booking.js"

export const listPublic = async (req, res, next) => {
  try {
    const rows = await Listing.find({}).sort({ updatedAt: -1 }).limit(200)
    res.json(
      rows.map((x) => ({
        id: x._id,
        propertyId: x.propertyId,
        slug: x.slug,
        name: x.name,
        cover: x.cover,
        gallery: x.gallery,
        address: x.address,
        meta: x.meta,
        flags: x.flags,
        bookingMode: x.bookingMode,
        location: x.location,
        amenities: x.amenities,
        priceMin: x.priceMin,
        priceMax: x.priceMax,
        units: x.units,
        availNext30: x.availNext30,
      }))
    )
  } catch (e) {
    next(e)
  }
}

export const streamPublic = async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.flushHeaders()

  const onUpdate = (payload) => {
    res.write(`event: listing\n`)
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }
  pubsub.on("listing.updated", onUpdate)
  req.on("close", () => pubsub.off("listing.updated", onUpdate))
}

// Single public listing/property detail for booking (units with beds)
export const getPublicListing = async (req, res, next) => {
  try {
    const { id } = req.params
    const row = await Listing.findOne({ propertyId: id })
    if (!row) return res.status(404).json({ error: "Not found" })
    res.json({
      id: row._id,
      propertyId: row.propertyId,
      name: row.name,
      address: row.address,
      meta: row.meta,
      flags: row.flags,
      bookingMode: row.bookingMode,
      location: row.location,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      units: (row.units || []).map((u) => ({
        id: u.id,
        name: u.name,
        beds: u.beds ?? u.bedrooms ?? 0,
        bedrooms: u.bedrooms,
        pricePerNight: u.pricePerNight,
      })),
      availNext30: row.availNext30,
    })
  } catch (e) {
    next(e)
  }
}

// Per-unit availability (fresh, not snapshot) – does not mutate listing
export const getUnitAvailability = async (req, res, next) => {
  try {
    const { id, unitId } = req.params // id = propertyId
    const days = Math.min(
      180,
      Math.max(1, parseInt(req.query.days || "30", 10))
    )
    // Optionally verify listing exists (property published) first
    const listing = await Listing.findOne({ propertyId: id }).select(
      "propertyId"
    )
    if (!listing) return res.status(404).json({ error: "Not found" })
    const mask = await calcUnitAvailNextNDays(id, unitId, days)
    res.json({ propertyId: id, unitId, days, avail: mask })
  } catch (e) {
    next(e)
  }
}

// Locations only (for /map page) – returns lightweight list
export const listListingLocations = async (req, res, next) => {
  try {
    const rows = await Listing.find({ location: { $exists: true } })
      .select(
        "propertyId slug name location meta flags priceMin priceMax cover updatedAt"
      )
      .limit(500)
      .lean()
    res.json(
      rows
        .filter((r) => r.location?.coordinates?.length === 2)
        .map((r) => ({
          id: r.propertyId,
          slug: r.slug,
          name: r.name,
          lat: r.location.coordinates[1],
          lng: r.location.coordinates[0],
          city: r.meta?.city || "",
          distanceToBeachMeters: r.meta?.distanceToBeachMeters || null,
          flags: r.flags || {},
          priceMin: r.priceMin,
          priceMax: r.priceMax,
          cover: r.cover || null,
          updatedAt: r.updatedAt,
        }))
    )
  } catch (e) {
    next(e)
  }
}

// Precise per-unit availability search for a given date range
// GET /public/search/availability?from=YYYY-MM-DD&to=YYYY-MM-DD&guests=2
export const searchAvailabilityPublic = async (req, res, next) => {
  try {
    const { from, to, guests } = req.query
    if (!from || !to) return res.status(400).json({ error: "from/to required" })
    const ci = new Date(from)
    const co = new Date(to)
    if (!(ci < co)) return res.status(400).json({ error: "Invalid date range" })
    const rangeDays = Math.ceil((co - ci) / 86400000)
    if (rangeDays > 365)
      return res.status(400).json({ error: "Range too large" })

    // Load published listings snapshot (assumed already filtered to public)
    const listings = await Listing.find({})
      .select(
        "propertyId slug name cover gallery address meta flags bookingMode location amenities priceMin priceMax units"
      )
      .lean()
    if (!listings.length) return res.json({ rows: [], count: 0 })

    const propertyIds = listings.map((l) => l.propertyId)

    // Build property -> units map with simple capacity heuristic
    const propUnits = new Map()
    for (const l of listings) {
      const units = (l.units || []).map((u) => ({
        id: u.id || u._id || String(u._id || u.id),
        beds: u.beds ?? u.bedrooms ?? 1,
      }))
      propUnits.set(String(l.propertyId), units)
    }

    // Fetch overlapping reservations and external blocks for the period
    const [reservations, blocks] = await Promise.all([
      Reservation.find({
        propertyId: { $in: propertyIds },
        status: { $ne: "cancelled" },
        checkIn: { $lt: co },
        checkOut: { $gt: ci },
      })
        .select("propertyId unitId")
        .lean(),
      Booking.find({
        propertyId: { $in: propertyIds },
        start: { $lt: co },
        end: { $gt: ci },
      })
        .select("propertyId unitId")
        .lean(),
    ])

    // Build blocked units map per property
    const blocked = new Map() // propId => Set(unitId)
    const markBlocked = (arr) => {
      for (const r of arr) {
        const p = String(r.propertyId)
        const u = String(r.unitId)
        if (!blocked.has(p)) blocked.set(p, new Set())
        if (u) blocked.get(p).add(u)
      }
    }
    markBlocked(reservations)
    markBlocked(blocks)

    // Filter listings where there exists at least one eligible unit not blocked
    const minGuests = Math.max(parseInt(guests || "1", 10) || 1, 1)
    const result = []
    for (const l of listings) {
      const pId = String(l.propertyId)
      const units = propUnits.get(pId) || []
      const blockedSet = blocked.get(pId) || new Set()
      const hasFree = units.some((u) => {
        const capacity = Number(u.beds || 1)
        if (Number.isFinite(minGuests) && capacity < minGuests) return false
        return !blockedSet.has(String(u.id))
      })
      if (hasFree) {
        result.push({
          id: l._id,
          propertyId: l.propertyId,
          slug: l.slug,
          name: l.name,
          cover: l.cover,
          gallery: l.gallery,
          address: l.address,
          meta: l.meta,
          flags: l.flags,
          bookingMode: l.bookingMode,
          location: l.location,
          amenities: l.amenities,
          priceMin: l.priceMin,
          priceMax: l.priceMax,
          units: l.units,
        })
      }
    }

    res.json({ rows: result, count: result.length })
  } catch (e) {
    next(e)
  }
}
