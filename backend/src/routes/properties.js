import { Router } from "express"
import { requireAuth } from "../middlewares/require-auth.js"
import {
  createProperty,
  patchBasic,
  patchLocation,
  patchIcal,
  postIcalSync,
  createOrUpdateFull,
  getOverview,
  icalDiagnostics,
  icalSyncNow,
  updatePropertyFlags,
  getNearProperties,
} from "../controllers/properties-controller.js"
import { getOwnerOverview } from "../controllers/properties-controller.js"
import { getOwnerSyncStatus } from "../controllers/properties-controller.js"
import { listMyProperties } from "../controllers/properties-list-controller.js"
import { publishListing } from "../controllers/properties-controller.js"
import { deleteAllOwnerProperties } from "../controllers/properties-controller.js"
import {
  bulkUnpublishOwnerProperties,
  unpublishAllOwnerProperties,
} from "../controllers/properties-controller.js"

const r = Router()
r.use(requireAuth)

r.get("/mine", listMyProperties)
// geo near pretraga (ne zahtijeva auth? ako treba auth ukloni ovu liniju use(requireAuth) iznad) – ostavljamo auth jer r.use(requireAuth) već važi
r.get("/near", getNearProperties)
// onboarding
r.post("/", createProperty)
r.patch("/:id([0-9a-fA-F]{24})/basic", patchBasic)
r.patch("/:id([0-9a-fA-F]{24})/location", patchLocation)
r.patch("/:id([0-9a-fA-F]{24})/ical", patchIcal)
r.post("/:id([0-9a-fA-F]{24})/ical/sync", postIcalSync)
r.put("/:id([0-9a-fA-F]{24})/flags", updatePropertyFlags)

// full upsert i overview
r.post("/full", createOrUpdateFull)
r.get("/:id([0-9a-fA-F]{24})/overview", getOverview)
// owner overview (agregacija preko svih objekata)
r.get("/owner/overview", getOwnerOverview)
// owner sync status (svi uniti i njihovi lastStatus)
r.get("/owner/sync-status", getOwnerSyncStatus)

// iCal dijagnostika i ručni sync
r.get("/:id([0-9a-fA-F]{24})/ical/diagnostics", icalDiagnostics)
r.post("/:id([0-9a-fA-F]{24})/ical/sync-now", icalSyncNow)

// publish listing
r.post("/:id([0-9a-fA-F]{24})/publish", publishListing)

// bulk delete svih vlasnikovih objekata
r.delete("/bulk", deleteAllOwnerProperties)

// bulk unpublish: nova preferirana ruta (/bulk/unpublish) + zadrži staru za kompatibilnost
r.post("/bulk/unpublish", unpublishAllOwnerProperties)
r.post("/bulk-unpublish", bulkUnpublishOwnerProperties) // legacy

export default r
