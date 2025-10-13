import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { publicApi } from '../api/http'

const pin = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor:[12,41], shadowSize:[41,41]
})

const pinActive = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [30,50], iconAnchor:[15,50], shadowSize:[50,50]
})

function FitBounds({ items, padding=40 }) {
  const map = useMap()
  useEffect(()=>{
    if(!items.length) return
    const bounds = L.latLngBounds(items.map(i=>[i.lat, i.lng]))
    map.fitBounds(bounds.pad(0.04), { padding: [padding,padding] })
  }, [items, map, padding])
  return null
}

export default function LocationsMap({ height=380, visibleIds=null }){
  const [items,setItems] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [collapsed,setCollapsed] = useState(false)
  const [activeId,setActiveId] = useState(null)

  useEffect(()=>{
    let active = true
    ;(async()=>{
      try {
        const { data } = await publicApi.listingLocations()
        if(!active) return
        setItems(Array.isArray(data)? data.filter(p=>p.lat && p.lng):[])
      } catch(e){
        if(active) setError(e.message||'Greška pri učitavanju lokacija')
      } finally { if(active) setLoading(false) }
    })()
    return ()=>{active=false}
  },[])
  const filtered = useMemo(()=>{
    if(!visibleIds || !(visibleIds instanceof Set)) return items
    return items.filter(it => visibleIds.has(it.id))
  }, [items, visibleIds])
  const center = useMemo(()=> filtered.length? [filtered[0].lat, filtered[0].lng] : [42.441,19.26], [filtered])

  return (
    <div className='locations-block' id='locations-block' style={{margin:'36px 0'}}>
      {!collapsed && (
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <h2 style={{margin:0, fontSize:22}}>Lokacije objekata</h2>
          <button className='btn' style={{fontSize:12, padding:'4px 10px'}} onClick={()=>setCollapsed(true)}>Sakrij</button>
        </div>
      )}
      {collapsed && (
        <div style={{display:'flex', justifyContent:'center', marginBottom:8}}>
          <button className='btn' style={{fontSize:12, padding:'4px 14px'}} onClick={()=>setCollapsed(false)}>Prikaži mapu</button>
        </div>
      )}
      {!collapsed && (
        <div style={{display:'grid', gap:24, gridTemplateColumns:'minmax(0,1fr) 300px'}}>
          <div style={{position:'relative', borderRadius:18, boxShadow:'0 4px 14px -4px rgba(0,0,0,0.18)', overflow:'hidden'}}>
            <MapContainer center={center} zoom={filtered.length? 11:8} style={{height, width:'100%'}}>
              <FitBounds items={filtered} />
              <TileLayer attribution='&copy; OSM' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
              {filtered.map(it => (
                <Marker key={it.id} position={[it.lat, it.lng]} icon={activeId===it.id? pinActive: pin} eventHandlers={{ click:()=> setActiveId(it.id) }} />
              ))}
            </MapContainer>
            {loading && <div style={{position:'absolute',top:10,left:10, background:'rgba(255,255,255,.92)', padding:'4px 10px', borderRadius:8, fontSize:12}}>Učitavanje…</div>}
            {error && !loading && <div style={{position:'absolute',top:10,left:10, background:'#fee', padding:'4px 10px', borderRadius:8, fontSize:12, color:'#900'}}>Greška: {error}</div>}
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:12, maxHeight:height, overflowY:'auto', paddingRight:6}}>
            {filtered.map(it => {
              const active = activeId===it.id
              return (
                <div
                  key={it.id}
                  onMouseEnter={()=> setActiveId(it.id)}
                  onClick={()=> setActiveId(it.id)}
                  style={{
                    padding:'10px 12px',
                    border:'1px solid ' + (active? '#0b57d0':'#d5d5d5'),
                    borderRadius:14,
                    background: active? '#f5f9ff':'#fff',
                    fontSize:14,
                    cursor:'pointer',
                    boxShadow: active? '0 2px 8px -2px rgba(11,87,208,0.35)': '0 2px 6px -2px rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={{fontWeight:600, lineHeight:1.2}}>{it.name}</div>
                  {it.city && <div style={{fontSize:12, opacity:.7, lineHeight:1.2}}>{it.city}</div>}
                  {it.priceMin != null && <div style={{fontSize:12, color:'#444', lineHeight:1.2}}>od {it.priceMin}€</div>}
                </div>
              )
            })}
            {!filtered.length && !loading && !error && <div style={{fontSize:12, opacity:.7}}>Nema lokacija.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
