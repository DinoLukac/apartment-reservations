import { Router } from "express"
import {
  postQuote,
  postCreate,
  listGuestReservations,
  getGuestReservationDetail,
  cancelGuestReservation,
} from "../controllers/reservationController.js"
// security.js ne postoji; koristimo postojeće middlewares ako zatreba.
// CSRF middleware imamo kao csrfProtect/csrfIssue u middlewares/csrf.js
import { csrfProtect } from "../middlewares/csrf.js"
// Ako želiš da kreiranje rezervacije traži login, možeš dodati requireAuth:
// import { requireAuth } from "../middlewares/require-auth.js"

const router = Router()

// anonimni korisnik smije zatražiti ponudu; CSRF header obavezan ako koristiš cookie-auth
// Za ponudu (quote) obično nije potreban login; CSRF nije kritičan ako nema side‑effect, ali može se uključiti.
router.post("/quote", /* csrfProtect, */ postQuote)

// kreiranje rezervacije (može i bez login-a); ownerId dolazi iz property-ja server-side
// Kreiranje rezervacije pravi zapis (side-effect); možeš aktivirati csrfProtect ako klijentska aplikacija šalje X-CSRF-Token.
router.post("/", /* csrfProtect, */ postCreate)
router.get("/mine", listGuestReservations)
router.get("/:code", getGuestReservationDetail)
router.patch("/:code/cancel", cancelGuestReservation)

export default router
