import { useParams, useSearchParams } from "react-router-dom"
import { useEffect, useState } from "react"

export default function BookingPage() {
  const { propertyId, unitId } = useParams()
  const [sp] = useSearchParams()
  const from = sp.get("from") || ""
  const to = sp.get("to") || ""
  const guests = sp.get("guests") || "1"
  const [info, setInfo] = useState(null)

  useEffect(() => {
    setInfo({ propertyId, unitId, from, to, guests })
  }, [propertyId, unitId, from, to, guests])

  return (
    <div className="booking-page" id="booking-page">
      <h1>Rezervacija</h1>
      <p className="bk-ids">Property: {propertyId} · Unit: {unitId}</p>
      <p className="bk-dates">Datumi: {from || '—'} → {to || '—'}</p>
      <p className="bk-guests">Gosti: {guests}</p>
      <div className="bk-placeholder" style={{marginTop:24,opacity:.75}}>
        (Stub stranica – dodajemo quote i formu nakon potvrde rute)
      </div>
    </div>
  )
}