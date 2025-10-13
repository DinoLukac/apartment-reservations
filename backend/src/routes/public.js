import { Router } from "express"
import {
  listPublic,
  streamPublic,
  getPublicListing,
  getUnitAvailability,
  listListingLocations,
  searchAvailabilityPublic,
} from "../controllers/public-listings-controller.js"
export const publicRouter = Router()

publicRouter.get("/listings", listPublic)
publicRouter.get("/listings/stream", streamPublic)
publicRouter.get("/listings/locations", listListingLocations)
publicRouter.get("/search/availability", searchAvailabilityPublic)
publicRouter.get("/listings/:id", getPublicListing)
publicRouter.get(
  "/listings/:id/units/:unitId/availability",
  getUnitAvailability
)
