import { Booking } from "../models/booking.js"
import Reservation from "../models/Reservation.js"

// Calculate availability mask (true = free) for next N days starting today
export const calcAvailNextNDays = async (propertyId, days = 30) => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + days)

  const [blocks, reservations] = await Promise.all([
    Booking.find({
      propertyId,
      start: { $lt: end },
      end: { $gt: start },
    })
      .select("start end")
      .lean(),
    Reservation.find({
      propertyId,
      status: { $ne: "cancelled" },
      checkIn: { $lt: end },
      checkOut: { $gt: start },
    })
      .select("checkIn checkOut")
      .lean(),
  ])

  const mask = Array.from({ length: days }, () => true)
  const markRange = (sDate, eDate) => {
    const s = Math.max(0, Math.floor((sDate - start) / 86400000))
    const e = Math.min(days, Math.ceil((eDate - start) / 86400000))
    for (let i = s; i < e; i++) mask[i] = false
  }
  for (const b of blocks) markRange(b.start, b.end)
  for (const r of reservations) markRange(r.checkIn, r.checkOut)
  return mask
}

// Update listing snapshot availability if listing model exists
export const updateListingAvailability = async (propertyId, days = 30) => {
  let Listing = null
  try {
    const mod = await import("../models/listing.js")
    Listing = mod.Listing || mod.default || null
  } catch {
    return false
  }
  if (!Listing) return false
  try {
    const avail = await calcAvailNextNDays(propertyId, days)
    await Listing.updateOne(
      { propertyId },
      { $set: { availNext30: avail, updatedAt: new Date() } }
    )
    return true
  } catch {
    return false
  }
}

// Unit-level availability (true = free) for next N days
export const calcUnitAvailNextNDays = async (propertyId, unitId, days = 30) => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + days)

  const [blocks, reservations] = await Promise.all([
    Booking.find({
      propertyId,
      unitId,
      start: { $lt: end },
      end: { $gt: start },
    })
      .select("start end")
      .lean(),
    Reservation.find({
      propertyId,
      unitId,
      status: { $ne: "cancelled" },
      checkIn: { $lt: end },
      checkOut: { $gt: start },
    })
      .select("checkIn checkOut")
      .lean(),
  ])

  const mask = Array.from({ length: days }, () => true)
  const markRange = (sDate, eDate) => {
    const s = Math.max(0, Math.floor((sDate - start) / 86400000))
    const e = Math.min(days, Math.ceil((eDate - start) / 86400000))
    for (let i = s; i < e; i++) mask[i] = false
  }
  for (const b of blocks) markRange(b.start, b.end)
  for (const r of reservations) markRange(r.checkIn, r.checkOut)
  return mask
}
