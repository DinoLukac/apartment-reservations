import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { publicApi } from "../api/http";
import ListingCard from "../components/public/ListingCard.jsx";
import LocationsMap from "../components/LocationsMap.jsx";

export default function HomePage() {
  const [rows, setRows] = useState([]);
  // Filters
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [guests, setGuests] = useState("")
  const listRef = useRef(null)
  const [openCI, setOpenCI] = useState(false)
  const [openCO, setOpenCO] = useState(false)

  useEffect(() => {
    publicApi.listings().then(({data}) => setRows(data || []));
    const es = new EventSource(publicApi.streamUrl());
    es.addEventListener("listing", (ev) => {
      const payload = JSON.parse(ev.data);
      setRows(prev => {
        const i = prev.findIndex(x => x.propertyId === payload.propertyId);
        if (i >= 0) { const next = [...prev]; next[i] = { ...prev[i], ...payload }; return next; }
        return [payload, ...prev];
      });
    });
    es.addEventListener("listing-removed", (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        setRows(prev => prev.filter(x => String(x.propertyId) !== String(payload.propertyId)));
      } catch {}
    });
    return () => es.close();
  }, []);

  // Privremeno sakrij user-box na javnoj početnoj; vrati nazad pri izlasku
  useEffect(() => {
    const el = document.getElementById("user-box");
    if (el) {
      const prev = el.style.display;
      el.style.display = "none";
      return () => { el.style.display = prev || ""; };
    }
  }, []);

  function scrollToList(){
    const el = listRef.current || document.getElementById('home-list')
    if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function onApplyFilters(e){
    e?.preventDefault?.()
    if(checkIn && checkOut){
      try{
        const { data } = await publicApi.searchAvailability({ from: checkIn, to: checkOut, guests: guests || 1 })
        if(Array.isArray(data?.rows)) setRows(data.rows)
      }catch(err){ /* ignore and keep current rows */ }
    } else {
      // reload full list if no dates
      try{ const { data } = await publicApi.listings(); setRows(data||[]) }catch{}
    }
    scrollToList()
  }

  // Basic client-side filter (approx). If dates are within next 30 days and item has availNext30, check contiguous availability.
  const visibleRows = rows

  return (
    <div className="public-wrapper" id="public-home">
      {/* HERO */}
      <section className="hero" id="home-hero" aria-label="Hero Ulcinj">
        <div className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-title">Nađi idealan smještaj u Ulcinju</h1>
          <p className="hero-sub">Udobni apartmani na odličnim lokacijama – blizu plaže, sa pogodnostima za bezbrižan odmor.</p>
          <div className="trust-row" aria-label="Traka povjerenja">
            <span>⭐ Prosječna ocjena 4.8/5</span>
            <span>🏖️ Blizu plaže</span>
            <span>💬 Podrška na WhatsApp</span>
          </div>
          <button className="btn primary hero-cta" onClick={scrollToList}>Pogledaj ponudu</button>
        </div>
      </section>

      {/* FILTER BAR */}
      <form className="filter-bar" onSubmit={onApplyFilters} role="search" aria-label="Filter smještaja">
        {/* Dolazak */}
        <div className="filter-field" style={{position:'relative'}}>
          <label htmlFor="f-ci-btn">Dolazak</label>
          <button id="f-ci-btn" type="button" className="date-input" onClick={()=> { setOpenCI(v=>!v); setOpenCO(false) }} aria-expanded={openCI}>
            {checkIn ? checkIn : 'Odaberite datum'}
          </button>
          {checkIn && <button type="button" aria-label="Očisti dolazak" className="date-clear" onClick={()=> setCheckIn('')}>×</button>}
          {openCI && (
            <div className="popover" role="dialog" aria-label="Kalendar dolaska">
              <DayPicker
                mode="single"
                selected={checkIn ? new Date(checkIn) : undefined}
                onSelect={(day)=>{
                  if(day){
                    const toISO = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10)
                    const v = toISO(day)
                    setCheckIn(v)
                    if(checkOut){
                      const co = new Date(checkOut)
                      if(day >= co) setCheckOut('')
                    }
                    setOpenCI(false)
                  }
                }}
                disabled={[ (d)=> isBeforeToday(d), ...getGloballyDisabledDays(rows) ]}
                numberOfMonths={2}
                pagedNavigation
                showOutsideDays
                weekStartsOn={1}
                styles={{ caption:{ fontSize:'14px' }, day:{ fontSize:'14px', width:'40px', height:'40px' } }}
              />
              <div className="popover-actions">
                {checkIn && <button type="button" className="btn outline" onClick={()=> setCheckIn('')}>Očisti</button>}
                <button type="button" className="btn" onClick={()=> setOpenCI(false)}>Zatvori</button>
              </div>
            </div>
          )}
        </div>
        {/* Odlazak */}
        <div className="filter-field" style={{position:'relative'}}>
          <label htmlFor="f-co-btn">Odlazak</label>
          <button id="f-co-btn" type="button" className="date-input" onClick={()=> { setOpenCO(v=>!v); setOpenCI(false) }} aria-expanded={openCO}>
            {checkOut ? checkOut : 'Odaberite datum'}
          </button>
          {checkOut && <button type="button" aria-label="Očisti odlazak" className="date-clear" onClick={()=> setCheckOut('')}>×</button>}
          {openCO && (
            <div className="popover" role="dialog" aria-label="Kalendar odlaska">
              <DayPicker
                mode="single"
                selected={checkOut ? new Date(checkOut) : undefined}
                onSelect={(day)=>{
                  if(day){
                    const toISO = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10)
                    const v = toISO(day)
                    // enforce > checkIn if set
                    if(checkIn && new Date(v) <= new Date(checkIn)) return
                    setCheckOut(v)
                    setOpenCO(false)
                  }
                }}
                disabled={[ (d)=> checkIn && d <= new Date(checkIn), ...getGloballyDisabledDays(rows) ]}
                numberOfMonths={2}
                pagedNavigation
                showOutsideDays
                weekStartsOn={1}
                styles={{ caption:{ fontSize:'14px' }, day:{ fontSize:'14px', width:'40px', height:'40px' } }}
              />
              <div className="popover-actions">
                {checkOut && <button type="button" className="btn outline" onClick={()=> setCheckOut('')}>Očisti</button>}
                <button type="button" className="btn" onClick={()=> setOpenCO(false)}>Zatvori</button>
              </div>
            </div>
          )}
        </div>
        <div className="filter-field">
          <label htmlFor="f-g">Gosti</label>
          <input id="f-g" type="number" min={1} placeholder="2" value={guests} onChange={e=> setGuests(e.target.value)} />
        </div>
        <div className="filter-actions">
          <button className="btn" type="submit">Primijeni</button>
          {(checkIn||checkOut||guests) && (
            <button type="button" className="btn outline" aria-label="Reset filtera" onClick={()=>{ setCheckIn(""); setCheckOut(""); setGuests(""); scrollToList(); }}>Reset</button>
          )}
        </div>
      </form>

      {/* CONTENT WRAPPER */}
      <div style={{maxWidth:'1152px', margin:'0 auto', padding:'0 16px'}}>
        <LocationsMap visibleIds={new Set(visibleRows.map(r=> r.propertyId))} />

        <main id="home-list" ref={listRef} className="listing-grid">
          {visibleRows.map(item => <ListingCard key={item.id || item.propertyId} item={item} />)}
          {visibleRows.length === 0 && <p style={{fontSize:'14px', color:'#555'}}>Nema objava za izabrane kriterijume.</p>}
        </main>
      </div>
    </div>
  );
}

// Disable day callback: returns an array of matcher objects for DayPicker disabled prop.
// Global logic (MVP): dan je onemogućen SAMO ako su SVI listinzi zauzeti tog dana (prema availNext30 maski).
function getGloballyDisabledDays(rows){
  const start = new Date(); start.setHours(0,0,0,0)
  const dayMs = 86400000
  const masks = rows.map(r => Array.isArray(r.availNext30)? r.availNext30 : [])
  // Prebacimo u skup indeksa dana (0..29) koji su globalno zatvoreni
  const len = Math.max(...masks.map(m=> m.length), 0)
  const disabledIdx = new Set()
  for(let i=0; i<len; i++){
    let allBlocked = true
    for(const m of masks){ if(m[i] !== false){ allBlocked = false; break } }
    if(allBlocked) disabledIdx.add(i)
  }
  if(disabledIdx.size===0) return []
  // Vratimo funkciju koja disable-uje te datume
  return [
    (date)=>{
      const idx = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - start)/dayMs)
      return disabledIdx.has(idx)
    }
  ]
}

function isBeforeToday(d){
  const today = new Date(); today.setHours(0,0,0,0)
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return dd < today
}
