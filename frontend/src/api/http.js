import axios from "axios"

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // VAŽNO zbog RT cookie-a
})

// Single-flight refresh (sprječava lavinu paralelnih refresh poziva)
let refreshingPromise = null

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error.config || {}
    if (error.response && error.response.status === 401 && !cfg._retry) {
      cfg._retry = true
      try {
        if (!refreshingPromise) {
          refreshingPromise = http.post("/auth/refresh").finally(() => {
            refreshingPromise = null
          })
        }
        await refreshingPromise
        return http(cfg)
      } catch (_) {
        // fallback: UI treba da triggeruje logout
      }
    }
    return Promise.reject(error)
  }
)

export async function initCSRF() {
  try {
    const { data } = await http.get("/csrf")
    // setuj default header
    http.defaults.headers.common["X-CSRF-Token"] = data.csrfToken
  } catch {
    /* ignore */
  }
}

export const api = {
  createProperty: (payload) => http.post("/properties", payload),
  updateBasic: (id, payload) => http.patch(`/properties/${id}/basic`, payload),
  updateLocation: (id, payload) =>
    http.patch(`/properties/${id}/location`, payload),
  setIcal: (id, payload) => http.patch(`/properties/${id}/ical`, payload),
  syncIcal: (id) => http.post(`/properties/${id}/ical/sync`),
}

export const propertyApi = {
  saveFull: (payload, id) =>
    http.post(`/properties/full${id ? `?id=${id}` : ""}`, payload),
  overview: (id, month) =>
    http.get(`/properties/${id}/overview`, { params: { month } }),
  mine: () => http.get("/properties/mine"),
  updateFlags: (id, payload) => http.put(`/properties/${id}/flags`, payload),
  get: (id) => http.get(`/properties/${id}`), // (ako postoji pojedinačni endpoint; fallback kasnije)
  diag: (id) => http.get(`/properties/${id}/ical/diagnostics`),
  syncUnit: (id, unitId) =>
    http.post(`/properties/${id}/ical/sync-now`, null, { params: { unitId } }),
  publish: (id) => http.post(`/properties/${id}/publish`),
}

export const publicApi = {
  listings: () => http.get("/public/listings"),
  streamUrl: () =>
    `${import.meta.env.VITE_API_URL || "/api"}/public/listings/stream`,
  listingLocations: () => http.get("/public/listings/locations"),
  searchAvailability: (params) =>
    http.get("/public/search/availability", { params }),
}

export const reservationsApi = {
  mine: (email, params = {}) =>
    http.get("/reservations/mine", { params: { email, ...params } }),
  detail: (code, email) =>
    http.get(`/reservations/${encodeURIComponent(code)}`, {
      params: { email },
    }),
  cancel: (code, email) =>
    http.patch(`/reservations/${encodeURIComponent(code)}/cancel`, null, {
      params: { email },
    }),
}
