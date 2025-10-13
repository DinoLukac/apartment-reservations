import ical from "node-ical"
import { createHash } from "crypto"
import dayjs from "dayjs"
import { Property } from "../models/property.js"
import { Booking } from "../models/booking.js"
import { audit } from "../utils/audit.js"

const hash = (s) => createHash("sha256").update(s).digest("hex")

export async function syncIcalForProperty({
  propertyId,
  byUserId,
  fetchHeaders = {},
}) {
  const prop = await Property.findById(propertyId)
  if (!prop || !prop.ical?.importUrl)
    throw Object.assign(new Error("Nema iCal URL"), { status: 400 })

  const url = prop.ical.importUrl
  const headers = { ...fetchHeaders }
  if (prop.ical.etag) headers["If-None-Match"] = prop.ical.etag
  if (prop.ical.lastModified)
    headers["If-Modified-Since"] = prop.ical.lastModified

  // --- FETCH sa timeoutom i Accept headerom
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  let resp
  try {
    resp = await fetch(url, {
      headers: { ...headers, Accept: "text/calendar, text/plain, */*" },
      redirect: "follow",
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    await audit({
      userId: byUserId,
      action: "ical_sync_error",
      ua: "",
      ip: "",
      meta: { propertyId, msg: String(e) },
    })
    throw Object.assign(
      new Error(
        e.name === "AbortError"
          ? "iCal je sporo odgovorio (timeout)"
          : "Greška pri povezivanju"
      ),
      { status: 502 }
    )
  } finally {
    clearTimeout(timer)
  }

  if (resp.status === 304) {
    await Property.updateOne(
      { _id: propertyId },
      { $set: { "ical.lastFetchedAt": new Date() } }
    )
    return { fetched: false, added: 0, total: 0 }
  }
  if (!resp.ok) {
    throw Object.assign(new Error(`iCal HTTP ${resp.status}`), { status: 502 })
  }

  const ctype = (resp.headers.get("content-type") || "").toLowerCase()
  const body = await resp.text()

  // Ako header nije text/calendar, svejedno pokušaj parse – neki provajderi ne šalju ispravan header
  let events
  try {
    events = ical.sync.parseICS(body)
  } catch (e) {
    await audit({
      userId: byUserId,
      action: "ical_sync_error",
      ua: "",
      ip: "",
      meta: { propertyId, msg: "Parse error: " + String(e) },
    })
    const hint =
      ctype && !ctype.includes("text/calendar")
        ? " (Content-Type nije text/calendar)"
        : ""
    throw Object.assign(
      new Error("Primljeni sadržaj nije validan ICS" + hint),
      {
        status: 422,
      }
    )
  }

  const etag = resp.headers.get("etag") || undefined
  const lastModified = resp.headers.get("last-modified") || undefined

  // Parse OK -> nastavljamo
  const items = Object.values(events).filter((e) => e.type === "VEVENT")

  let added = 0
  for (const ev of items) {
    const start = ev.start instanceof Date ? ev.start : new Date(ev.start)
    const end = ev.end instanceof Date ? ev.end : new Date(ev.end)
    if (!start || !end) continue

    const uid = String(
      ev.uid ||
        hash(`${start.toISOString()}|${end.toISOString()}|${ev.summary || ""}`)
    )

    // Dedup po (propertyId, externalUid) – unique index će spriječiti dupliranje
    try {
      await Booking.create({
        propertyId,
        source: "external",
        kind: "external_block",
        externalUid: uid,
        summary: ev.summary || "",
        start,
        end,
      })
      added++
    } catch (e) {
      // duplicate key -> ignore
      if (String(e.code) !== "11000") {
        // future: ako hoćeš logovati druge greške
      }
    }
  }

  await Property.updateOne(
    { _id: propertyId },
    {
      $set: {
        "ical.etag": etag,
        "ical.lastModified": lastModified,
        "ical.lastFetchedAt": new Date(),
      },
    }
  )
  await audit({
    userId: byUserId,
    action: "ical_sync_success",
    ua: "",
    ip: "",
    meta: { propertyId, added, total: items.length },
  })
  return { fetched: true, added, total: items.length }
}

export async function syncIcalForUnit({
  propertyId,
  unitId,
  byUserId,
  fetchHeaders = {},
}) {
  const prop = await Property.findById(propertyId)
  if (!prop)
    throw Object.assign(new Error("Objekat ne postoji"), { status: 404 })
  const unit = prop.units.id(unitId)
  if (!unit || !unit.ical?.importUrl)
    throw Object.assign(new Error("Nema iCal URL za ovaj apartman"), {
      status: 400,
    })

  const url = unit.ical.importUrl
  const headers = { ...fetchHeaders }
  if (unit.ical.etag) headers["If-None-Match"] = unit.ical.etag
  if (unit.ical.lastModified)
    headers["If-Modified-Since"] = unit.ical.lastModified

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  let resp
  try {
    resp = await fetch(url, {
      headers: { ...headers, Accept: "text/calendar, */*" },
      redirect: "follow",
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    await audit({
      userId: byUserId,
      action: "ical_sync_error",
      meta: { propertyId, unitId, msg: String(e) },
    })
    // upiši status greške
    try {
      unit.ical.lastStatus = {
        httpStatus: 0,
        error: String(e),
        syncedAt: new Date(),
      }
      await prop.save()
    } catch {}
    throw Object.assign(
      new Error(
        e.name === "AbortError" ? "iCal timeout" : "Greška pri povezivanju"
      ),
      { status: 502 }
    )
  } finally {
    clearTimeout(timer)
  }

  if (resp.status === 304) {
    unit.ical.lastFetchedAt = new Date()
    // upiši status 304 (nema promjena)
    unit.ical.lastStatus = {
      httpStatus: 304,
      error: null,
      addedLastRun: 0,
      eventsTotal: 0,
      syncedAt: new Date(),
    }
    await prop.save()
    return { fetched: false, added: 0, total: 0 }
  }
  if (!resp.ok) {
    // upiši HTTP grešku
    try {
      unit.ical.lastStatus = {
        httpStatus: resp.status,
        error: `HTTP ${resp.status}`,
        syncedAt: new Date(),
      }
      await prop.save()
    } catch {}
    throw Object.assign(new Error(`iCal HTTP ${resp.status}`), { status: 502 })
  }

  // uspješan odgovor
  unit.ical.lastStatus = { httpStatus: resp.status, error: null }

  const body = await resp.text()

  let events
  try {
    events = ical.sync.parseICS(body)
  } catch (e) {
    await audit({
      userId: byUserId,
      action: "ical_sync_error",
      meta: { propertyId, unitId, msg: "Parse: " + String(e) },
    })
    // status parse greške
    try {
      unit.ical.lastStatus = {
        httpStatus: resp?.status || 0,
        error: String(e),
        syncedAt: new Date(),
      }
      await prop.save()
    } catch {}
    throw Object.assign(new Error("Nevalidan ICS sadržaj"), { status: 422 })
  }

  const items = Object.values(events).filter((e) => e.type === "VEVENT")
  // ukupno događaja
  unit.ical.lastStatus = {
    ...(unit.ical.lastStatus || {}),
    eventsTotal: items.length,
  }
  let added = 0
  for (const ev of items) {
    const start = ev.start instanceof Date ? ev.start : new Date(ev.start)
    const end = ev.end instanceof Date ? ev.end : new Date(ev.end)
    if (!start || !end) continue

    const uid = String(
      ev.uid ||
        hash(`${start.toISOString()}|${end.toISOString()}|${ev.summary || ""}`)
    )
    try {
      await Booking.create({
        propertyId,
        unitId,
        source: "external",
        kind: "external_block",
        externalUid: uid,
        summary: ev.summary || "",
        start,
        end,
      })
      added++
    } catch (e) {
      if (String(e.code) !== "11000") {
        // ignore others for now
      }
    }
  }

  unit.ical.etag = resp.headers.get("etag") || unit.ical.etag
  unit.ical.lastModified =
    resp.headers.get("last-modified") || unit.ical.lastModified
  unit.ical.lastFetchedAt = new Date()
  // završni status
  unit.ical.lastStatus = {
    ...(unit.ical.lastStatus || {}),
    addedLastRun: added,
    syncedAt: new Date(),
  }
  await prop.save()

  await audit({
    userId: byUserId,
    action: "ical_sync_success",
    meta: { propertyId, unitId, added, total: items.length },
  })
  return { fetched: true, added, total: items.length }
}
