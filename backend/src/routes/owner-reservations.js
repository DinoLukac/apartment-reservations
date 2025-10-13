import { Router } from "express"
import { requireAuth } from "../middlewares/require-auth.js"
import {
  listOwnerReservations,
  getOwnerReservation,
} from "../controllers/owner-reservations-controller.js"

const r = Router()
r.use(requireAuth)
r.get("/", listOwnerReservations)
r.get("/:id", getOwnerReservation)

export default r
