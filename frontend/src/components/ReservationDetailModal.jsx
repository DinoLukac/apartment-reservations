import { useEffect, useState } from 'react'
import { reservationsApi } from '../api/http'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'

export default function ReservationDetailModal({ code, email, onClose, onCancelled }){
  const [data,setData] = useState(null)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const [cancelling,setCancelling] = useState(false)

  useEffect(()=>{ if(code && email){
    setLoading(true); setError('')
    reservationsApi.detail(code,email).then(r=> setData(r.data)).catch(e=>{
      setError(e.response?.data?.error || e.message || 'Greška')
    }).finally(()=> setLoading(false))
  } },[code,email])

  function canCancel(){
    if(!data) return false
    if(data.status !== 'confirmed') return false
    try { const ci = new Date(data.checkIn); const today = new Date(); today.setHours(0,0,0,0); return ci > today } catch { return false }
  }

  async function handleCancel(){
    if(!canCancel()) return
    if(!window.confirm('Da li ste sigurni da želite otkazati rezervaciju?')) return
    setCancelling(true)
    try {
      await reservationsApi.cancel(code,email)
      setData(d=> d ? {...d, status:'cancelled'}:d)
      onCancelled?.(code)
    } catch(e){
      alert(e.response?.data?.error || e.message || 'Neuspješno otkazivanje')
    } finally { setCancelling(false) }
  }

  return (
    <div className='modal-overlay'>
      <div className='modal'>
        <div className='modal-header'>
          <h2 style={{margin:0}}>Rezervacija {data?.code || code}</h2>
          <button className='close-btn' onClick={onClose} aria-label='Zatvori'>&times;</button>
        </div>
        <div className='modal-body'>
          {loading && <p>Učitavanje…</p>}
          {error && <p style={{color:'#b00'}}>{error}</p>}
          {data && !loading && !error && (
            <div className='res-detail'>
              <div style={{display:'flex', gap:24, flexWrap:'wrap'}}>
                <div style={{flex:'1 1 280px', minWidth:260}}>
                  <p><b>Status:</b> {data.status==='cancelled'? 'Otkazana':'Potvrđena'}</p>
                  <p><b>Objekat:</b> {data.property?.name}</p>
                  {data.property?.unit && <p><b>Jedinica:</b> {data.property.unit.name}</p>}
                  <p><b>Datumi:</b> {String(data.checkIn).slice(0,10)} → {String(data.checkOut).slice(0,10)} ({data.nights} noći)</p>
                  <p><b>Gosti:</b> {data.guests}</p>
                  <p><b>Ukupno:</b> {data.currency} {data.total} ({data.currency} {data.pricePerNight}/noć)</p>
                  <p><b>Plaćanje:</b> {data.payment?.method === 'card' ? 'Kartica' : 'Plaćanje pri dolasku'}{data.payment?.paid? ' (plaćeno)':''}</p>
                  {data.guest?.note && <p><b>Napomena gosta:</b><br/>{data.guest.note}</p>}
                  {canCancel() && (
                    <button className='btn danger' onClick={handleCancel} disabled={cancelling}>{cancelling? 'Otkazivanje…':'Otkaži rezervaciju'}</button>
                  )}
                </div>
                {data.property?.location?.coordinates && (
                  <div style={{flex:'1 1 300px', minWidth:260}}>
                    <MiniMap location={data.property.location} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .close-btn{background:none; border:none; font-size:26px; line-height:1; cursor:pointer}
        .btn.danger{background:#b00020; color:#fff}
        .btn.danger:disabled{opacity:.6}
        .leaflet-container{border-radius:12px;}
      `}</style>
    </div>
  )
}

function MiniMap({ location }){
  const [center] = useState(()=>{
    const [lng,lat] = location.coordinates
    return [lat,lng]
  })
  return (
    <MapContainer center={center} zoom={13} style={{height:260, width:'100%'}} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} zoomControl={false} attributionControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={center}></Marker>
    </MapContainer>
  )
}
