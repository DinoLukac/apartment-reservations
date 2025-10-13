import cron from "node-cron"
import { Property } from "../models/property.js"
import { syncIcalForProperty } from "../services/ical-service.js"

// Svakih 20 min – minimalni MVP
export function startCron() {
  cron.schedule("*/20 * * * *", async () => {
    const props = await Property.find({
      "ical.importUrl": { $exists: true, $ne: null },
    }).select("_id ownerId")
    for (const p of props) {
      try {
        await syncIcalForProperty({ propertyId: p._id, byUserId: p.ownerId })
      } catch {
        /* best effort */
      }
    }
  })
}
