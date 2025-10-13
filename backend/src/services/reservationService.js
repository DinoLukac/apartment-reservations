import Reservation from "../models/Reservation.js"
import { Booking } from "../models/booking.js" // unified booking (reservation + external blocks)
import { Property } from "../models/property.js"

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd // poluotvoren [start, end)
}

export async function isRangeAvailable({
  propertyId,
  unitId,
  checkIn,
  checkOut,
}) {
  // 1) External/internal blocks stored in Booking collection (start/end)
  const block = await Booking.findOne({
    propertyId,
    unitId,
    start: { $lt: checkOut },
    end: { $gt: checkIn },
  }).lean()
  if (block) return false
  // 2) Confirmed reservations (separate collection) overlap
  const resv = await Reservation.findOne({
    unitId,
    status: { $ne: "cancelled" },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  }).lean()
  return !resv
}

export async function quotePrice({
  propertyId,
  unitId,
  checkIn,
  checkOut,
  guests,
}) {
  const prop = await Property.findById(propertyId).lean()
  if (!prop) return { nights: 0, pricePerNight: 0, total: 0, currency: "EUR" }
  const unit =
    (prop.units || []).find((u) => String(u._id) === String(unitId)) || null
  const pricePerNight = unit?.pricePerNight ?? 0
  const nights = Math.max(1, Math.ceil((checkOut - checkIn) / 86400000))
  const total = pricePerNight * nights
  return { nights, pricePerNight, total, currency: "EUR" }
}
