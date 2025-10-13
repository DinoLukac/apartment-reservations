import Reservation from "../models/Reservation.js"
import { Property } from "../models/property.js"
import dayjs from "dayjs"

// GET /api/owner/reservations?from=YYYY-MM-DD&to=YYYY-MM-DD&propertyId=&q=
export const listOwnerReservations = async (req, res, next) => {
  try {
    const ownerId = req.user.id
    const { from, to, propertyId, q } = req.query
    const filter = { ownerId }
    if (propertyId) filter.propertyId = propertyId
    let dateFrom = from ? dayjs(from) : null
    let dateTo = to ? dayjs(to) : null
    if (dateFrom && dateFrom.isValid())
      filter.checkIn = { $gte: dateFrom.toDate() }
    if (dateTo && dateTo.isValid()) {
      filter.checkOut = filter.checkOut || {}
      filter.checkOut.$lte = dateTo.toDate()
    }
    if (q) {
      filter.$or = [
        { code: new RegExp(q, "i") },
        { "guest.fullName": new RegExp(q, "i") },
        { "guest.email": new RegExp(q, "i") },
      ]
    }

    const rows = await Reservation.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    // Stats: occupancy (approx over selected window), revenue
    let totalRevenue = 0
    let nightsTotal = 0
    let nightsCapacity = 0
    const byProperty = new Map()
    for (const r of rows) {
      totalRevenue += r.total || 0
      nightsTotal += r.nights || 0
      const key = String(r.propertyId)
      byProperty.set(key, (byProperty.get(key) || 0) + (r.nights || 0))
    }
    if (propertyId) {
      const prop = await Property.findById(propertyId).select("units")
      nightsCapacity =
        (prop?.units?.length || 0) *
        (dateFrom && dateTo ? dateTo.diff(dateFrom, "day") : 30)
    }

    // Repeat guest detection
    const guestCount = rows.reduce((m, r) => {
      const em = r?.guest?.email
      if (em) m.set(em, (m.get(em) || 0) + 1)
      return m
    }, new Map())

    const data = rows.map((r) => ({
      id: r._id,
      code: r.code,
      createdAt: r.createdAt,
      channel: r.channel || "direct",
      guest: {
        fullName: r.guest?.fullName,
        email: r.guest?.email,
        phone: r.guest?.phone,
        repeat: guestCount.get(r.guest?.email) > 1,
      },
      unitId: r.unitId,
      propertyId: r.propertyId,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      guests: r.guests,
      total: r.total,
      currency: r.currency,
      status: r.status,
      updatedAt: r.updatedAt,
      tags: r.tags || [],
    }))

    res.json({
      rows: data,
      stats: {
        totalRevenue,
        nights: nightsTotal,
        occupancyPct:
          nightsCapacity > 0
            ? Math.round((nightsTotal / nightsCapacity) * 100)
            : null,
      },
      count: data.length,
    })
  } catch (e) {
    next(e)
  }
}

// GET /api/owner/reservations/:id
export const getOwnerReservation = async (req, res, next) => {
  try {
    const r = await Reservation.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    }).lean()
    if (!r) return res.status(404).json({ error: "Not found" })
    res.json({
      id: r._id,
      code: r.code,
      createdAt: r.createdAt,
      channel: r.channel || "direct",
      guest: r.guest,
      propertyId: r.propertyId,
      unitId: r.unitId,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      guests: r.guests,
      pricePerNight: r.pricePerNight,
      total: r.total,
      currency: r.currency,
      status: r.status,
      payment: r.payment,
      tags: r.tags || [],
      updatedAt: r.updatedAt,
    })
  } catch (e) {
    next(e)
  }
}
