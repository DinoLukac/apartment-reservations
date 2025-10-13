import { useState, useCallback, useEffect } from 'react'
import { http } from '../api/http'
import { MapContainer, TileLayer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const pin = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor:[12,41], popupAnchor:[1,-34], shadowSize:[41,41]
})

function ClickCapture({ onSet }) {
  useMapEvents({ click(e){ onSet({ lat:e.latlng.lat, lng:e.latlng.lng }) } })
  return null
}

function EnsureInteractive() {
  const map = useMap()
  useEffect(() => {
    try {
      map.dragging && map.dragging.enable()
      map.scrollWheelZoom && map.scrollWheelZoom.enable()
      map.doubleClickZoom && map.doubleClickZoom.enable()
      map.boxZoom && map.boxZoom.enable()
      map.keyboard && map.keyboard.enable()
    } catch {}
  }, [map])
  return null
}

export default function LocationPicker({ propertyId, initial, onSaved }) {
  // Persisted/saved position
  const [pos, setPos] = useState(initial || null)
  // Working draft while editing (doesn't affect saved until Save)
  const [draft, setDraft] = useState(initial || null)
  const [mode, setMode] = useState('preview') // 'preview' | 'edit'
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { if (initial) { setPos(initial); setDraft(initial) } }, [initial])

  const save = useCallback(async () => {
    if (!draft || !propertyId) return
    setSaving(true); setMsg('')
    try {
      // Prefer axios instance (handles baseURL + credentials) – fallback try direct fetch if it fails
      try {
        await http.patch(`/properties/${propertyId}/location`, { lat: draft.lat, lng: draft.lng })
      } catch(inner){
        // If baseURL misconfigured attempt manual fetch with /api prefix
        try {
          const r2 = await fetch(`/api/properties/${propertyId}/location`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: draft.lat, lng: draft.lng })
          })
          if(!r2.ok){
            const txt = await r2.text().catch(()=> '')
            throw new Error('HTTP ' + r2.status + (txt? (' '+txt):''))
          }
        } catch(chain){
          throw chain
        }
      }
      setPos(draft)
      setMsg('Sačuvano')
      setMode('preview')
      onSaved && onSaved(draft)
    } catch (e) {
      console.error('[LocationPicker] save error', e)
      setMsg('Greška: ' + (e.message || ''))
    } finally { setSaving(false); setTimeout(()=>setMsg(''), 3000) }
  }, [draft, propertyId, onSaved])

  const startEdit = () => { setMode('edit'); setDraft(pos || null) }
  const cancelEdit = () => { setMode('preview'); setDraft(pos || null) }

  return (
    <div className="card" id="location-picker" style={{ marginTop:12, padding:14, display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
        <h3 style={{margin:0, fontSize:16}}>Lokacija</h3>
        {mode === 'preview' && (
          <button className='btn outline small' onClick={startEdit}>Uredi</button>
        )}
      </div>

      {mode === 'preview' ? (
  <div style={{height:160, borderRadius:12, overflow:'hidden', position:'relative', margin:'0 12px'}}>
          <div style={{position:'absolute', inset:0, filter:'grayscale(75%) brightness(1.05) contrast(0.95)'}}>
            <MapContainer
              center={pos ? [pos.lat, pos.lng] : [42.441, 19.26]}
              zoom={pos ? 14 : 9}
              style={{height:'100%', width:'100%'}}
              scrollWheelZoom={false}
              dragging={false}
              doubleClickZoom={false}
              zoomControl={false}
            >
              <TileLayer attribution='&copy; OSM' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
              {pos && <Marker position={[pos.lat, pos.lng]} icon={pin} />}
            </MapContainer>
          </div>
          {!pos && (
            <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#555', fontSize:13}}>
              Nije postavljena lokacija
            </div>
          )}
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{height:260, borderRadius:12, overflow:'hidden', margin:'0 12px'}}>
            <MapContainer
              center={draft ? [draft.lat, draft.lng] : (pos ? [pos.lat, pos.lng] : [42.441, 19.26])}
              zoom={(draft||pos) ? 14 : 9}
              style={{height:'100%', width:'100%'}}
              scrollWheelZoom={true}
              zoomControl={false}
              dragging={true}
              doubleClickZoom={true}
            >
              <EnsureInteractive />
              <TileLayer attribution='&copy; OSM' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
              <ZoomControl position="topright" />
              <ClickCapture onSet={setDraft} />
              {(draft||pos) && <Marker position={[ (draft||pos).lat, (draft||pos).lng ]} icon={pin} />}
            </MapContainer>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <button className='btn btn-primary' disabled={!draft || saving} onClick={save}>{saving ? 'Snima...' : 'Sačuvaj lokaciju'}</button>
            <button className='btn outline small' onClick={cancelEdit} disabled={saving}>Otkaži</button>
            {(draft||pos) && (
              <span style={{fontSize:12, color:'#555'}}>Lat: {(draft||pos).lat.toFixed(5)} Lng: {(draft||pos).lng.toFixed(5)}</span>
            )}
            {msg && <span style={{fontSize:12}}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}