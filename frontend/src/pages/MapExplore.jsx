import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { publicApi } from '../api/http'

const pin = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor:[12,41], shadowSize:[41,41]
})

export default function MapExplore(){
  const [items,setItems] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

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

  const center = items.length? [items[0].lat, items[0].lng] : [42.441,19.26]

  return (
    <div className='page map-page' id='map-page' style={{height:'calc(100vh - 70px)', width:'100%', position:'relative'}}>
      <MapContainer center={center} zoom={items.length?11:8} style={{height:'100%',width:'100%'}}>
        <TileLayer attribution='&copy; OSM' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
        {items.map(it => (
          <Marker key={it.id} position={[it.lat, it.lng]} icon={pin}>
            <Popup>
              <strong>{it.name}</strong><br/>
              {it.city && <span>{it.city}<br/></span>}
              {it.priceMin != null && <span>od {it.priceMin}€<br/></span>}
              <a href={`/listing/${it.slug}`} style={{color:'#0b57d0'}}>Detalji</a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {loading && <div style={{position:'absolute',top:10,left:10, background:'rgba(255,255,255,.9)', padding:'6px 10px', borderRadius:8, fontSize:12}}>Učitavanje…</div>}
      {error && !loading && <div style={{position:'absolute',top:10,left:10, background:'#fee', padding:'6px 10px', borderRadius:8, fontSize:12, color:'#900'}}>Greška: {error}</div>}
      {!loading && !error && items.length===0 && <div style={{position:'absolute',top:10,left:10, background:'rgba(255,255,255,.9)', padding:'6px 10px', borderRadius:8, fontSize:12}}>Nema lokacija.</div>}
    </div>
  )
}