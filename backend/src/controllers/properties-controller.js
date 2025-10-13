import { z } from "zod"
import { Property } from "../models/property.js"
import { Booking } from "../models/booking.js"
import Reservation from "../models/Reservation.js"
import {
  calcAvailNextNDays,
  updateListingAvailability,
} from "../utils/availability.js"
import dayjs from "dayjs"
import {
  syncIcalForProperty,
  syncIcalForUnit,
} from "../services/ical-service.js"
import { Types } from "mongoose"

// Availability helper moved to utils/availability.js (bookings + reservations)

// Prost slug helper (bez eksternog paketa)
const makeSlug = (s) =>
  (s || "smjestaj")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "smjestaj"

// ----------------------
// Postojeće šeme (ostaju)
// ----------------------
const basicSchema = z.object({
  name: z.string().min(3).max(120),
  capacity: z.object({
    guests: z.number().int().min(1),
    bedrooms: z.number().int().min(0),
    beds: z.number().int().min(0),
  }),
  amenities: z.array(z.string()).max(50).optional().default([]),
})

const locationSchema = z.object({
  address: z.object({
    country: z.string().min(2),
    municipality: z.string().min(2),
    line1: z.string().min(3),
  }),
  timezone: z.string().min(3),
})

// Prihvati bilo koji HTTPS URL; detaljna validacija će se uraditi tokom sync-a
const icalSchema = z.object({
  importUrl: z
    .string()
    .url()
    .refine((u) => {
      try {
        const url = new URL(u)
        return url.protocol === "https:"
      } catch {
        return false
      }
    }, "URL mora biti https."),
})

// ----------------------
// NOVE šeme za full create/update
// ----------------------
const unitSchema = z.object({
  _id: z.string().optional(), // subdoc id (za update)
  name: z.string().min(1),
  bedrooms: z.number().int().min(0),
  beds: z.number().int().min(0),
  pricePerNight: z.number().min(0),
  // Dozvoli prazno polje; ako je string prazan, tretiramo kao null
  icalUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
})

const fullSchema = z.object({
  name: z.string().min(3).max(120),
  amenities: z.array(z.string()).max(50).optional().default([]),
  address: z.object({
    country: z.string().min(2),
    municipality: z.string().min(2),
    line1: z.string().min(3),
  }),
  timezone: z.string().min(3),
  units: z.array(unitSchema).min(1),
  commissionPct: z.number().min(0).max(1).optional(),
  photos: z
    .array(
      z.object({
        name: z.string(),
        size: z.number(),
        type: z.string(),
        order: z.number().int().min(0),
        source: z.enum(["upload", "url"]).default("upload"),
        url: z.string().url().optional().nullable(),
        dataUrl: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  sync: z.boolean().optional().default(true), // nakon čuvanja pokreni sync
})

// ----------------------
// POSTOJEĆI endpointi (ne mijenjaj)
// ----------------------
export const createProperty = async (req, res, next) => {
  try {
    const basic = basicSchema.parse(req.body.basic)
    const location = locationSchema.parse(req.body.location)
    const doc = await Property.create({
      ownerId: req.user.id,
      status: "draft",
      ...basic,
      ...location,
    })
    res.status(201).json({ id: doc._id })
  } catch (e) {
    next(e)
  }
}

export const patchBasic = async (req, res, next) => {
  try {
    const id = req.params.id
    const basic = basicSchema.parse(req.body)
    const doc = await Property.findOneAndUpdate(
      { _id: id, ownerId: req.user.id },
      { $set: basic },
      { new: true }
    )
    if (!doc) return res.status(404).json({ error: "Not found" })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

export const patchLocation = async (req, res, next) => {
  try {
    const id = req.params.id
    // NOVO: ako body sadrži lat/lng tretiraj kao geo update; inače koristi stari schema flow
    const { lat, lng } = req.body || {}
    if (typeof lat === "number" && typeof lng === "number") {
      const update = {
        location: { type: "Point", coordinates: [lng, lat] },
      }
      if (req.body.tz) update["location.tz"] = req.body.tz
      if (req.body.address && typeof req.body.address === "object") {
        // best-effort merge adrese (ne forsiramo required ovdje)
        for (const k of [
          "country",
          "municipality",
          "line1",
          "city",
          "street",
          "zipcode",
          "formatted",
        ]) {
          if (req.body.address[k] != null)
            update[`address.${k}`] = req.body.address[k]
        }
      }
      const doc = await Property.findOneAndUpdate(
        { _id: id, ownerId: req.user.id },
        { $set: update },
        { new: true }
      )
      if (!doc) return res.status(404).json({ error: "Not found" })

      // Ako je property već objavljen, ažuriraj i Listing snapshot (samo location + updatedAt)
      if (doc.published) {
        try {
          const mod = await import("../models/listing.js")
          const ListingModel = mod.Listing || mod.default || null
          if (ListingModel) {
            const listing = await ListingModel.findOneAndUpdate(
              { propertyId: doc._id },
              { $set: { location: doc.location, updatedAt: new Date() } },
              { new: true }
            )
            if (listing) {
              try {
                const modPub = await import("../lib/pubsub.js")
                const emitListing = modPub.emitListing || modPub.default || null
                if (emitListing) {
                  emitListing({
                    id: listing._id,
                    propertyId: listing.propertyId,
                    slug: listing.slug,
                    name: listing.name,
                    cover: listing.cover,
                    gallery: listing.gallery,
                    address: listing.address,
                    amenities: listing.amenities,
                    priceMin: listing.priceMin,
                    priceMax: listing.priceMax,
                    units: listing.units,
                    meta: listing.meta,
                    flags: listing.flags,
                    bookingMode: listing.bookingMode,
                    availNext30: listing.availNext30,
                    location: listing.location,
                  })
                }
              } catch {}
            }
          }
        } catch {}
      }
      return res.json({ ok: true, location: doc.location })
    }
    // legacy put (address + timezone)
    const locPayload = locationSchema.parse(req.body)
    const doc = await Property.findOneAndUpdate(
      { _id: id, ownerId: req.user.id },
      { $set: locPayload },
      { new: true }
    )
    if (!doc) return res.status(404).json({ error: "Not found" })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

export const patchIcal = async (req, res, next) => {
  try {
    const id = req.params.id
    const { importUrl } = icalSchema.parse(req.body)
    const doc = await Property.findOneAndUpdate(
      { _id: id, ownerId: req.user.id },
      {
        $set: {
          "ical.importUrl": importUrl,
          "ical.etag": null,
          "ical.lastModified": null,
        },
      },
      { new: true }
    )
    if (!doc) return res.status(404).json({ error: "Not found" })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
}

export const postIcalSync = async (req, res, next) => {
  try {
    const id = req.params.id
    // provjeri vlasništvo
    const prop = await Property.findOne({ _id: id, ownerId: req.user.id })
    if (!prop) {
      // Fallback: vrati prazne podatke umjesto 404 da FE može prikazati informativan ekran
      return res.json({
        property: {
          id,
          name: "(nepoznat objekat)",
          address: {},
          timezone: "",
          amenities: [],
          commissionPct: 0.35,
        },
        month: monthStr || "",
        days: 0,
        units: [],
        stats: {
          occupiedNights: 0,
          totalCapacityNights: 0,
          occupancyPct: 0,
          estGross: 0,
          myCommission: 0,
        },
        bookings: [],
      })
    }

    const result = await syncIcalForProperty({
      propertyId: id,
      byUserId: req.user.id,
    })
    res.json(result) // { fetched, added, total }
  } catch (e) {
    next(e)
  }
}

// ----------------------
// NOVI endpoint: createOrUpdateFull
// POST /api/properties/full (create or update — ako proslediš id u query)
// ----------------------
export const createOrUpdateFull = async (req, res, next) => {
  try {
    const data = fullSchema.parse(req.body)
    const id = req.query.id

    let prop
    if (!id) {
      prop = await Property.create({
        ownerId: req.user.id,
        status: "active",
        name: data.name,
        amenities: data.amenities,
        address: data.address,
        timezone: data.timezone,
        commissionPct: data.commissionPct ?? 0.35,
        photos: data.photos || [],
        units: data.units.map((u) => ({
          name: u.name,
          bedrooms: u.bedrooms,
          beds: u.beds,
          pricePerNight: u.pricePerNight,
          ical: {
            importUrl: u.icalUrl && u.icalUrl.trim() ? u.icalUrl.trim() : null,
          },
        })),
      })
    } else {
      prop = await Property.findOne({ _id: id, ownerId: req.user.id })
      if (!prop) return res.status(404).json({ error: "Not found" })

      prop.name = data.name
      prop.amenities = data.amenities
      prop.address = data.address
      prop.timezone = data.timezone
      prop.commissionPct = data.commissionPct ?? prop.commissionPct
      prop.photos = data.photos || prop.photos

      // overwrite units by index (jednostavno)
      prop.units = data.units.map((u) => ({
        _id: u._id || undefined,
        name: u.name,
        bedrooms: u.bedrooms,
        beds: u.beds,
        pricePerNight: u.pricePerNight,
        ical: {
          importUrl: u.icalUrl && u.icalUrl.trim() ? u.icalUrl.trim() : null,
        },
      }))

      await prop.save()
    }

    // Sync po unitu (ako imaju iCal URL)
    let syncSummary = []
    if (data.sync) {
      for (const unit of prop.units) {
        if (unit.ical?.importUrl) {
          const result = await syncIcalForUnit({
            propertyId: prop._id,
            unitId: unit._id,
            byUserId: req.user.id,
          })
          syncSummary.push({
            unitId: String(unit._id),
            name: unit.name,
            ...result,
          })
        }
      }
    }

    res.status(id ? 200 : 201).json({ id: prop._id, sync: syncSummary })
  } catch (e) {
    next(e)
  }
}

// ----------------------
// NOVI endpoint: getOverview
// GET /api/properties/:id/overview?month=YYYY-MM
// ----------------------
export const getOverview = async (req, res, next) => {
  try {
    const id = req.params.id
    const monthStr = req.query.month || dayjs().format("YYYY-MM")
    const start = dayjs(monthStr + "-01")
    const end = start.endOf("month")
    const days = end.diff(start, "day") + 1

    let prop = await Property.findOne({ _id: id, ownerId: req.user.id })
    if (!prop) {
      // fallback: uzmi prvi objekat korisnika (ako postoji) umjesto 404
      prop = await Property.findOne({ ownerId: req.user.id }).sort({
        createdAt: 1,
      })
      if (!prop) return res.status(404).json({ error: "Not found" })
    }

    // Uzmi sve blokade koje se preklapaju sa mjesecom
    const items = await Booking.find({
      propertyId: id,
      start: { $lt: end.toDate() },
      end: { $gt: start.toDate() },
    }).select("unitId source kind start end summary")
    // I sve potvrđene rezervacije koje se preklapaju sa mjesecom
    const reservations = await Reservation.find({
      propertyId: id,
      status: { $ne: "cancelled" },
      checkIn: { $lt: end.toDate() },
      checkOut: { $gt: start.toDate() },
    }).select("unitId checkIn checkOut guest.fullName")

    // Zauzeti noćenja po unitu
    const nightsPerUnit = new Map()
    for (const u of prop.units) nightsPerUnit.set(String(u._id), 0)

    for (const b of items) {
      // Bez dayjs.min/max plugina: ručno ograniči interval
      const sCandidate = dayjs(b.start)
      const eCandidate = dayjs(b.end)
      const s = sCandidate.isAfter(start) ? sCandidate : start
      const e = eCandidate.isBefore(end) ? eCandidate : end
      const nights = Math.max(0, e.diff(s, "day")) // ical end je obično exclusive
      const key = String(b.unitId || "")
      nightsPerUnit.set(key, (nightsPerUnit.get(key) || 0) + nights)
    }
    // uračunaj i rezervacije
    for (const r of reservations) {
      const sCandidate = dayjs(r.checkIn)
      const eCandidate = dayjs(r.checkOut)
      const s = sCandidate.isAfter(start) ? sCandidate : start
      const e = eCandidate.isBefore(end) ? eCandidate : end
      const nights = Math.max(0, e.diff(s, "day"))
      const key = String(r.unitId || "")
      nightsPerUnit.set(key, (nightsPerUnit.get(key) || 0) + nights)
    }

    // Izračun: ukupno kapaciteta (units * days), zauzetost i procijenjeni prihod
    const totalCapacityNights = prop.units.length * days
    const occupiedNights = Array.from(nightsPerUnit.values()).reduce(
      (a, b) => a + b,
      0
    )
    const occupancyPct = totalCapacityNights
      ? Math.round((occupiedNights / totalCapacityNights) * 100)
      : 0

    // Est. prihod: nightsPerUnit * unit.pricePerNight (računamo i external kao procjenu)
    let estGross = 0
    for (const u of prop.units) {
      const n = nightsPerUnit.get(String(u._id)) || 0
      estGross += n * (u.pricePerNight || 0)
    }
    const myCommission = Math.round(estGross * (prop.commissionPct || 0.35))

    // Per-day occupancy for the month (owner calendar)
    const totalUnits = prop.units.length
    const dayStatuses = Array.from({ length: days }, (_, i) => ({
      date: start.add(i, "day").format("YYYY-MM-DD"),
      occupiedUnits: 0,
      totalUnits,
      // extended fields to support unit-specific view on FE
      unitIds: [], // list of occupied unitIds for that day
      guests: [], // aggregated guest names for that day
      _unitSet: new Set(), // internal helper, removed before response
      _guestsSet: new Set(), // internal helper, removed before response
      _guestsByUnit: {}, // { [unitId]: Set<name> }
    }))
    // bookings (ical blocks)
    for (const b of items) {
      // limit to [start, end)
      const sCandidate = dayjs(b.start)
      const eCandidate = dayjs(b.end)
      const s = sCandidate.isAfter(start) ? sCandidate : start
      const e = eCandidate.isBefore(end) ? eCandidate : end
      let idx = Math.max(0, s.diff(start, "day"))
      const last = Math.max(0, e.diff(start, "day")) // exclusive
      const unitKey = String(b.unitId || "")
      for (; idx < last; idx++) {
        const d = dayStatuses[idx]
        if (!d) continue
        if (!d._unitSet.has(unitKey)) {
          d._unitSet.add(unitKey)
          d.unitIds.push(unitKey)
          d.occupiedUnits = Math.min(totalUnits, d._unitSet.size)
        }
      }
    }
    // reservations + guest names per unit
    for (const r of reservations) {
      const sCandidate = dayjs(r.checkIn)
      const eCandidate = dayjs(r.checkOut)
      const s = sCandidate.isAfter(start) ? sCandidate : start
      const e = eCandidate.isBefore(end) ? eCandidate : end
      let idx = Math.max(0, s.diff(start, "day"))
      const last = Math.max(0, e.diff(start, "day"))
      const unitKey = String(r.unitId || "")
      const name = r.guest?.fullName || "Rezervacija"
      for (; idx < last; idx++) {
        const d = dayStatuses[idx]
        if (!d) continue
        if (!d._unitSet.has(unitKey)) {
          d._unitSet.add(unitKey)
          d.unitIds.push(unitKey)
          d.occupiedUnits = Math.min(totalUnits, d._unitSet.size)
        }
        d._guestsSet.add(name)
        if (!d._guestsByUnit[unitKey]) d._guestsByUnit[unitKey] = new Set()
        d._guestsByUnit[unitKey].add(name)
      }
    }
    // finalize: convert sets to arrays and strip internals
    for (const d of dayStatuses) {
      d.guests = Array.from(d._guestsSet)
      const gbu = []
      for (const [uid, set] of Object.entries(d._guestsByUnit)) {
        gbu.push({ unitId: uid, names: Array.from(set) })
      }
      d.guestsByUnit = gbu
      delete d._unitSet
      delete d._guestsSet
      delete d._guestsByUnit
    }

    res.json({
      property: {
        id: prop._id,
        name: prop.name,
        address: prop.address,
        timezone: prop.timezone,
        amenities: prop.amenities,
        commissionPct: prop.commissionPct,
        photos: prop.photos || [],
        published: !!prop.published,
        publishedAt: prop.publishedAt || null,
      },
      month: monthStr,
      days,
      units: prop.units.map((u) => ({
        id: u._id,
        name: u.name,
        pricePerNight: u.pricePerNight,
        importUrl: u.ical?.importUrl || null,
      })),
      stats: {
        occupiedNights,
        totalCapacityNights,
        occupancyPct,
        estGross,
        myCommission,
      },
      bookings: items,
      dayStatuses,
    })
  } catch (e) {
    next(e)
  }
}

// ----------------------
// NOVO: publish listing (upsert + emit)
// ----------------------
export const publishListing = async (req, res, next) => {
  try {
    const prop = await Property.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    })
    if (!prop) return res.status(404).json({ error: "Not found" })

    const photos = (prop.photos || []).sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    )
    const gallery = photos
      .slice(0, 8)
      .map((p) => p.url || p.dataUrl)
      .filter(Boolean)
    const cover = gallery[0] || null

    const units = (prop.units || []).map((u) => ({
      id: u._id,
      name: u.name,
      beds: u.beds,
      bedrooms: u.bedrooms,
      pricePerNight: u.pricePerNight,
    }))

    const prices = units
      .map((u) => u.pricePerNight)
      .filter((n) => Number.isFinite(n))
    const priceMin = prices.length ? Math.min(...prices) : 0
    const priceMax = prices.length ? Math.max(...prices) : 0
    const availNext30 = await calcAvailNextNDays(prop._id, 30)

    const slug = makeSlug(prop.name || "smjestaj")

    const payload = {
      propertyId: prop._id,
      ownerId: prop.ownerId,
      slug,
      name: prop.name,
      address: {
        city: prop.address?.municipality || "",
        country: prop.address?.country || "",
      },
      location: prop.location?.type === "Point" ? prop.location : undefined,
      meta: {
        city: prop.meta?.city || prop.address?.municipality || "",
        distanceToBeachMeters: prop.meta?.distanceToBeachMeters || null,
      },
      flags: {
        family: !!prop.flags?.family,
        nearBeach: !!prop.flags?.nearBeach,
        petFriendly: !!prop.flags?.petFriendly,
        freeCancellation: !!prop.flags?.freeCancellation,
        instantBooking:
          !!prop.flags?.instantBooking || prop.bookingMode === "instant",
        taxesIncluded: !!prop.flags?.taxesIncluded,
      },
      bookingMode: prop.bookingMode || "request",
      cover,
      gallery,
      amenities: prop.amenities || [],
      priceMin,
      priceMax,
      units,
      availNext30,
      publishedAt: new Date(),
      updatedAt: new Date(),
    }

    // Dinamički import da izbjegnemo hard dependency ako model/emit nisu spremni
    let ListingModel = null
    try {
      const mod = await import("../models/listing.js")
      ListingModel = mod.Listing || mod.default || null
    } catch {}

    let doc = null
    if (ListingModel) {
      doc = await ListingModel.findOneAndUpdate(
        { propertyId: prop._id },
        { $set: payload },
        { new: true, upsert: true }
      )
    }

    // mark property as published (best-effort; ignore errors)
    try {
      if (!prop.published) {
        prop.published = true
        prop.publishedAt = payload.publishedAt
        await prop.save()
      } else {
        // update timestamp if already published
        prop.publishedAt = payload.publishedAt
        await prop.save()
      }
    } catch {}

    try {
      const mod = await import("../lib/pubsub.js")
      const emitListing = mod.emitListing || mod.default || null
      if (emitListing) {
        emitListing({
          id: doc?._id,
          propertyId: payload.propertyId,
          slug: payload.slug,
          name: payload.name,
          cover: payload.cover,
          gallery: payload.gallery,
          address: payload.address,
          amenities: payload.amenities,
          priceMin: payload.priceMin,
          priceMax: payload.priceMax,
          units: payload.units,
          meta: payload.meta,
          flags: payload.flags,
          bookingMode: payload.bookingMode,
          availNext30: payload.availNext30,
          location: payload.location,
          meta: payload.meta,
          flags: payload.flags,
          bookingMode: payload.bookingMode,
        })
      }
    } catch {}

    return res.json({ ok: true, id: doc?._id || null })
  } catch (e) {
    next(e)
  }
}

// ----------------------
// NOVO: iCal dijagnostika i ručni sync
// ----------------------
export const icalDiagnostics = async (req, res, next) => {
  try {
    const prop = await Property.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    })
    if (!prop) return res.status(404).json({ error: "Not found" })
    const units = (prop.units || []).map((u) => ({
      unitId: String(u._id),
      name: u.name,
      importUrl: u.ical?.importUrl || null,
      lastFetchedAt: u.ical?.lastFetchedAt || null,
      lastStatus: u.ical?.lastStatus || null,
    }))
    res.json({ propertyId: String(prop._id), units })
  } catch (e) {
    next(e)
  }
}

export const icalSyncNow = async (req, res, next) => {
  try {
    const { unitId } = req.query
    if (!unitId) return res.status(400).json({ error: "unitId je obavezan" })
    // vlasništvo je implicitno provjereno u sync-u kroz property fetch, ali provjeri odmah
    const prop = await Property.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    })
    if (!prop) return res.status(404).json({ error: "Not found" })

    console.log("[ical] sync-now req", {
      pid: req.params.id,
      unitId,
      by: req.user.id,
    })

    // Pokreni sync (ova funkcija treba da upiše unit.ical.lastStatus)
    await syncIcalForUnit({
      propertyId: req.params.id,
      unitId,
      byUserId: req.user.id,
    })

    // Pročitaj status iz baze (svjež dokument nakon sync-a)
    const propAfter = await Property.findOne({
      _id: req.params.id,
      ownerId: req.user.id,
    })
    const unit = propAfter?.units?.id(unitId)
    const st = unit?.ical?.lastStatus || {}

    console.log("[ical] sync-now done", {
      httpStatus: st.httpStatus,
      total: st.eventsTotal,
      added: st.addedLastRun,
    })

    res.json({
      ok: true,
      httpStatus: st.httpStatus ?? null,
      total: st.eventsTotal ?? null,
      added: st.addedLastRun ?? null,
      syncedAt: st.syncedAt ?? null,
    })
    try {
      await updateListingAvailability(req.params.id)
    } catch {}
  } catch (e) {
    console.error("[ical] sync-now error", e)
    next(e)
  }
}

// ----------------------
// NOVO: updatePropertyFlags
// PUT /api/properties/:id/flags
// ----------------------
export const updatePropertyFlags = async (req, res, next) => {
  try {
    const id = req.params.id
    const body = req.body || {}
    const allowedFlags = [
      "family",
      "nearBeach",
      "petFriendly",
      "freeCancellation",
      "instantBooking",
      "taxesIncluded",
    ]
    const set = {}
    if (body.meta) {
      if (typeof body.meta.city === "string") set["meta.city"] = body.meta.city
      if (body.meta.distanceToBeachMeters != null)
        set["meta.distanceToBeachMeters"] = body.meta.distanceToBeachMeters
    }
    if (body.cancellationPolicy !== undefined)
      set.cancellationPolicy = body.cancellationPolicy
    if (body.bookingMode && ["request", "instant"].includes(body.bookingMode))
      set.bookingMode = body.bookingMode
    if (body.flags) {
      for (const k of allowedFlags) {
        if (body.flags[k] !== undefined) set[`flags.${k}`] = !!body.flags[k]
      }
      // sync bookingMode <-> instantBooking ako je zadato
      if (body.flags.instantBooking === true) set.bookingMode = "instant"
      if (body.flags.instantBooking === false && !body.bookingMode)
        set.bookingMode = set.bookingMode || "request"
    }
    const doc = await Property.findOneAndUpdate(
      { _id: id, ownerId: req.user.id },
      { $set: set },
      { new: true }
    )
    if (!doc) return res.status(404).json({ error: "Not found" })

    // Ako je property već objavljen, osvježi i Listing snapshot da javna kartica odmah dobije nove podatke
    if (doc.published) {
      try {
        const mod = await import("../models/listing.js")
        const ListingModel = mod.Listing || mod.default || null
        if (ListingModel) {
          const snapshotSet = {
            meta: {
              city: doc.meta?.city || doc.address?.municipality || "",
              distanceToBeachMeters: doc.meta?.distanceToBeachMeters || null,
            },
            flags: {
              family: !!doc.flags?.family,
              nearBeach: !!doc.flags?.nearBeach,
              petFriendly: !!doc.flags?.petFriendly,
              freeCancellation: !!doc.flags?.freeCancellation,
              instantBooking:
                !!doc.flags?.instantBooking || doc.bookingMode === "instant",
              taxesIncluded: !!doc.flags?.taxesIncluded,
            },
            bookingMode: doc.bookingMode || "request",
            updatedAt: new Date(),
          }
          const listing = await ListingModel.findOneAndUpdate(
            { propertyId: doc._id },
            { $set: snapshotSet },
            { new: true }
          )
          // Emituj SSE/pubsub event da FE ažurira karticu
          try {
            const modPub = await import("../lib/pubsub.js")
            const emitListing = modPub.emitListing || modPub.default || null
            if (emitListing && listing) {
              emitListing({
                id: listing._id,
                propertyId: listing.propertyId,
                slug: listing.slug,
                name: listing.name,
                cover: listing.cover,
                gallery: listing.gallery,
                address: listing.address,
                amenities: listing.amenities,
                priceMin: listing.priceMin,
                priceMax: listing.priceMax,
                units: listing.units,
                meta: listing.meta,
                flags: listing.flags,
                bookingMode: listing.bookingMode,
                availNext30: listing.availNext30,
                location: listing.location,
              })
            }
          } catch {}
        }
      } catch {}
    }
    return res.json({
      ok: true,
      propertyId: doc._id,
      flags: doc.flags,
      meta: doc.meta,
      bookingMode: doc.bookingMode,
      cancellationPolicy: doc.cancellationPolicy,
    })
  } catch (e) {
    next(e)
  }
}

// ----------------------
// NOVO: bulk delete svih vlasnikovih objekata (+ ukloni sa javne strane)
// DELETE /api/properties/bulk
// ----------------------
export const deleteAllOwnerProperties = async (req, res, next) => {
  try {
    const asObjectId = (v) => {
      try {
        return new Types.ObjectId(v)
      } catch {
        return null
      }
    }
    const ownerOid = asObjectId(req.user.id)
    if (!ownerOid)
      return res.status(400).json({ ok: false, message: "Bad owner id" })

    const props = await Property.find({ ownerId: ownerOid })
      .select("_id name")
      .lean()
    if (!props.length) {
      return res.json({ ok: true, removed: 0, names: [], hasProperties: false })
    }
    const propIdsObj = props.map((p) => p._id)
    const propIdsStr = props.map((p) => String(p._id))

    // 1) Skloni sa javne liste (podrži oba tipa propertyId)
    try {
      let removedAny = false
      try {
        const modListing = await import("../models/listing.js")
        const Listing = modListing.Listing || modListing.default || null
        if (Listing) {
          await Listing.deleteMany({
            $or: [
              { propertyId: { $in: propIdsObj } },
              { propertyId: { $in: propIdsStr } },
            ],
          })
          removedAny = true
        }
      } catch {}
      if (!removedAny) {
        try {
          const modPublic = await import("../models/public-listing.js")
          const PublicListing =
            modPublic.PublicListing || modPublic.default || null
          if (PublicListing) {
            await PublicListing.deleteMany({
              $or: [
                { propertyId: { $in: propIdsObj } },
                { propertyId: { $in: propIdsStr } },
              ],
            })
          }
        } catch {}
      }
    } catch {}

    // 2) Obriši (hard delete) sve vlasnikove objekte
    const delRes = await Property.deleteMany({ ownerId: ownerOid })

    // 3) Emit SSE/pubsub događaj da klijenti uklone kartice
    try {
      let emitted = false
      try {
        const modSse = await import("../services/sse.js")
        const sseEmit = modSse.sseEmit || modSse.emit || modSse.default || null
        if (sseEmit) {
          propIdsStr.forEach((id) =>
            sseEmit("listing-removed", { propertyId: id })
          )
          emitted = true
        }
      } catch {}
      if (!emitted) {
        try {
          const modPub = await import("../lib/pubsub.js")
          const emitListingRemoved =
            modPub.emitListingRemoved || modPub.emit || modPub.default || null
          if (emitListingRemoved) {
            propIdsStr.forEach((id) =>
              emitListingRemoved({
                type: "listing-removed",
                propertyId: id,
              })
            )
          }
        } catch {}
      }
    } catch {}

    return res.json({
      ok: true,
      removed: delRes.deletedCount || 0,
      names: props.map((p) => p.name),
      hasProperties: false,
    })
  } catch (e) {
    console.error("[bulk-delete] err", e)
    next(e)
  }
}

// ----------------------
// NOVO: bulk UNPUBLISH (skini sa javne strane, ne briši objekte)
// POST /api/properties/bulk-unpublish
// ----------------------
export const unpublishAllOwnerProperties = async (req, res, next) => {
  try {
    const asObjectId = (v) => {
      try {
        return new Types.ObjectId(v)
      } catch {
        return null
      }
    }
    const ownerOid = asObjectId(req.user.id)
    if (!ownerOid)
      return res.status(400).json({ ok: false, message: "Bad owner id" })

    const props = await Property.find({ ownerId: ownerOid })
      .select("_id name")
      .lean()
    if (!props.length) return res.json({ ok: true, unpublished: 0, names: [] })

    const propIdsObj = props.map((p) => p._id)
    const propIdsStr = props.map((p) => String(p._id))

    // markiraj properties kao unpublished (ako schema ima ta polja; ako ne -> ignorisi)
    try {
      await Property.updateMany(
        { ownerId: ownerOid },
        { $set: { published: false, publishedAt: null } }
      )
    } catch {}

    // skloni javne listinge (oba tipa propertyId)
    try {
      let removedAny = false
      try {
        const modListing = await import("../models/listing.js")
        const Listing = modListing.Listing || modListing.default || null
        if (Listing) {
          await Listing.deleteMany({
            $or: [
              { propertyId: { $in: propIdsObj } },
              { propertyId: { $in: propIdsStr } },
            ],
          })
          removedAny = true
        }
      } catch {}
      if (!removedAny) {
        try {
          const modPublic = await import("../models/public-listing.js")
          const PublicListing =
            modPublic.PublicListing || modPublic.default || null
          if (PublicListing) {
            await PublicListing.deleteMany({
              $or: [
                { propertyId: { $in: propIdsObj } },
                { propertyId: { $in: propIdsStr } },
              ],
            })
          }
        } catch {}
      }
    } catch {}

    // emit SSE/pubsub da FE ukloni kartice
    try {
      let emitted = false
      try {
        const modSse = await import("../services/sse.js")
        const sseEmit = modSse.sseEmit || modSse.emit || modSse.default || null
        if (sseEmit) {
          propIdsStr.forEach((id) =>
            sseEmit("listing-removed", { propertyId: id })
          )
          emitted = true
        }
      } catch {}
      if (!emitted) {
        try {
          const modPub = await import("../lib/pubsub.js")
          const emitListingRemoved =
            modPub.emitListingRemoved || modPub.emit || modPub.default || null
          if (emitListingRemoved) {
            propIdsStr.forEach((id) =>
              emitListingRemoved({
                type: "listing-removed",
                propertyId: id,
              })
            )
          }
        } catch {}
      }
    } catch {}

    return res.json({
      ok: true,
      unpublished: props.length,
      names: props.map((p) => p.name),
    })
  } catch (e) {
    console.error("[bulk-unpublish] err", e)
    next(e)
  }
}

// Backward kompatibilnost (posto FE već koristi staro ime)
export const bulkUnpublishOwnerProperties = unpublishAllOwnerProperties

// ----------------------
// NOVO: Owner overview (agregacija preko svih objekata)
// GET /api/properties/owner/overview
// ----------------------
export const getOwnerOverview = async (req, res, next) => {
  try {
    const asObjectId = (v) => {
      try {
        return new Types.ObjectId(v)
      } catch {
        return null
      }
    }
    const ownerOid = asObjectId(req.user.id)
    if (!ownerOid)
      return res.status(400).json({ ok: false, message: "Bad owner id" })

    const props = await Property.find({ ownerId: ownerOid })
      .select("_id commissionPct units")
      .lean()
    if (!props.length) {
      return res.json({
        ok: true,
        hasProperties: false,
        occupancyPct: 0,
        nightsBooked: 0,
        grossRevenue: 0,
        commissionPct: 35,
        commissionAmount: 0,
        events: [],
      })
    }

    const propertyIds = props.map((p) => p._id)
    // Uzmemo sve booking zapise za narednih 30 dana (ili tekući mjesec); za sada koristimo tekući mjesec
    const monthStr = dayjs().format("YYYY-MM")
    const start = dayjs(monthStr + "-01")
    const end = start.endOf("month")
    const bookings = await Booking.find({
      propertyId: { $in: propertyIds },
      start: { $lt: end.toDate() },
      end: { $gt: start.toDate() },
    }).select("propertyId unitId start end source kind summary")

    // Nights booked
    let nightsBooked = 0
    for (const b of bookings) {
      const sCandidate = dayjs(b.start)
      const eCandidate = dayjs(b.end)
      const s = sCandidate.isAfter(start) ? sCandidate : start
      const e = eCandidate.isBefore(end) ? eCandidate : end
      nightsBooked += Math.max(0, e.diff(s, "day"))
    }

    // Total capacity = (broj unita svih objekata) * broj dana u mjesecu
    const days = end.diff(start, "day") + 1
    const totalUnits = props.reduce((a, p) => a + (p.units?.length || 0), 0)
    const totalCapacityNights = totalUnits * days
    const occupancyPct = totalCapacityNights
      ? Math.round((nightsBooked / totalCapacityNights) * 100)
      : 0

    // Rough revenue = nightsBooked * prosječna cijena (nemamo globalno pa uzimamo prosjek svih pricePerNight)
    // Ako treba preciznije, trebalo bi iterirati po bookings i spajati sa unit cijenama iz propertyja.
    let sumPrices = 0
    let countUnits = 0
    for (const p of props) {
      for (const u of p.units || []) {
        if (typeof u.pricePerNight === "number") {
          sumPrices += u.pricePerNight
          countUnits += 1
        }
      }
    }
    const avgPrice = countUnits ? sumPrices / countUnits : 0
    const grossRevenue = Math.round(nightsBooked * avgPrice)
    const avgCommissionPct = props.length
      ? Math.round(
          (props.reduce((a, p) => a + (p.commissionPct || 0.35), 0) /
            props.length) *
            100
        )
      : 35
    const commissionAmount = Math.round(grossRevenue * (avgCommissionPct / 100))

    return res.json({
      ok: true,
      hasProperties: true,
      month: monthStr,
      occupancyPct,
      nightsBooked,
      grossRevenue,
      commissionPct: avgCommissionPct,
      commissionAmount,
      events: bookings.map((b) => ({
        propertyId: b.propertyId,
        unitId: b.unitId,
        start: b.start,
        end: b.end,
        source: b.source,
        kind: b.kind,
        summary: b.summary,
      })),
    })
  } catch (e) {
    next(e)
  }
}

// ----------------------
// NOVO: Owner sync status (svi uniti i njihovi lastStatus podaci)
// GET /api/properties/owner/sync-status
// ----------------------
export const getOwnerSyncStatus = async (req, res, next) => {
  try {
    const asObjectId = (v) => {
      try {
        return new Types.ObjectId(v)
      } catch {
        return null
      }
    }
    const ownerOid = asObjectId(req.user.id)
    if (!ownerOid)
      return res.status(400).json({ ok: false, message: "Bad owner id" })

    const props = await Property.find({ ownerId: ownerOid })
      .select("_id name units")
      .lean()
    if (!props.length) return res.json([])

    const list = []
    for (const p of props) {
      for (const u of p.units || []) {
        list.push({
          propertyId: String(p._id),
          propertyName: p.name,
          unitId: String(u._id),
          unitName: u.name,
          importUrl: u.ical?.importUrl || null,
          lastStatus: u.ical?.lastStatus || null,
          lastFetchedAt: u.ical?.lastFetchedAt || null,
        })
      }
    }
    return res.json(list)
  } catch (e) {
    next(e)
  }
}

// ----------------------
// NOVO: Geo pretraga "near" (lat,lng,radiusKm)
// GET /api/properties/near?lat=..&lng=..&radiusKm=10
// ----------------------
export const getNearProperties = async (req, res, next) => {
  try {
    const lat = Number(req.query.lat)
    const lng = Number(req.query.lng)
    const radiusKm = Number(req.query.radiusKm || 10)
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return res.status(400).json({ error: "lat/lng required" })
    const max = radiusKm * 1000
    const docs = await Property.find({
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: max,
        },
      },
    })
      .select("name address location flags meta bookingMode commissionPct")
      .limit(100)
    res.json(docs)
  } catch (e) {
    next(e)
  }
}
