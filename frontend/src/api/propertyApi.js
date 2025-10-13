import { http } from "./http"

// BULK DELETE svih vlasnikovih objekata (skida i sa javne strane)
// Backend ruta: DELETE /api/properties/bulk
// Napomena: naš http baseURL je VITE_API_URL (npr. http://localhost:4000/api),
// zato ovdje koristimo samo "/properties/bulk" da se prefiks /api doda iz baseURL-a.
export const deleteAllOwnerProperties = () => http.delete("/properties/bulk")

// BULK UNPUBLISH (skini sa javne, ne briši iz dashboarda)
// Nova preferirana ruta: POST /properties/bulk/unpublish
// Zadržavamo legacy fallback ako backend još uvijek nema novu rutu.
export const bulkUnpublish = async () => {
  try {
    return await http.post("/properties/bulk/unpublish")
  } catch (e) {
    // fallback na staru rutu ako 404
    if (e?.response?.status === 404) {
      return await http.post("/properties/bulk-unpublish")
    }
    throw e
  }
}

// Novi aliasi (čistija imena za upotrebu u komponentama)
export const apiDeleteAll = deleteAllOwnerProperties
export const apiUnpublishAll = bulkUnpublish

// Owner overview & sync status helpers
export const ownerOverview = () => http.get("/properties/owner/overview")
export const ownerSyncStatus = () => http.get("/properties/owner/sync-status")

export default {
  deleteAllOwnerProperties,
  bulkUnpublish,
  apiDeleteAll,
  apiUnpublishAll,
  ownerOverview,
  ownerSyncStatus,
}
