import { useEffect, useMemo, useState } from "react";
import { propertyApi } from "../api/http";

/** Prikazuje statistiku po objektu ako postoji propertyId; inače ne radi ništa. */
export default function PropertyOverview({ propertyId, onPublished, onKpiUpdate }) {
  const [state, setState] = useState({ loading: false, error: "", data: null });
  const [diag, setDiag] = useState(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const prevMonth = ()=>{
    const [y,m] = month.split('-').map(n=>parseInt(n,10));
    const d = new Date(y, m-2, 1); // previous month
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  const nextMonth = ()=>{
    const [y,m] = month.split('-').map(n=>parseInt(n,10));
    const d = new Date(y, m, 1); // next month
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  // Local slider state
  const [slideIdx, setSlideIdx] = useState(0)
  // Persisted gallery independent of overview errors
  const [galleryUrls, setGalleryUrls] = useState([])

  useEffect(() => {
    if (!propertyId) return;
    setState(s => ({ ...s, loading: true, error: "" }));
    propertyApi.overview(propertyId, month)
      .then(({ data }) => {
        setState({ loading: false, error: "", data })
        const urls = (data?.property?.photos || [])
          .sort((a,b)=> (a.order||0) - (b.order||0))
          .map(p=> p.url || p.dataUrl)
          .filter(Boolean)
        if (urls.length) setGalleryUrls(urls)
      })
      .catch(err => {
        const msg = err?.response?.data?.error || "Pregled nije dostupan za ovaj objekat.";
        setState({ loading: false, error: msg, data: null });
      });
  }, [propertyId, month]);

  // Fallback: ako je overview pao i nemamo galeriju, pokušaj povući iz /mine
  useEffect(()=>{
    if (!propertyId) return;
    if (galleryUrls.length > 0) return;
    if (!state.error) return;
    propertyApi.mine()
      .then(({data})=>{
        const list = Array.isArray(data) ? data : []
        let p = list.find(x=> String(x.id) === String(propertyId)) || list[0]
        const urls = (p?.photos || [])
          .sort((a,b)=> (a.order||0) - (b.order||0))
          .map(p=> p.url || p.dataUrl)
          .filter(Boolean)
        if (urls.length) setGalleryUrls(urls)
      })
      .catch(()=>{})
  }, [propertyId, state.error, galleryUrls.length])

  const loadDiag = () =>
    propertyApi
      .diag(propertyId)
      .then(({ data }) => setDiag(data))
      .catch(() => setDiag(null))

  useEffect(() => {
    if (propertyId) loadDiag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Emit KPI updates to parent whenever overview data changes
  useEffect(() => {
    if (!state.data) return;
    try {
      const stats = state.data.stats || {};
      const prop = state.data.property || {};
      onKpiUpdate && onKpiUpdate({
        occupancyPct: stats.occupancyPct ?? 0,
        nightsBooked: stats.occupiedNights ?? 0,
        totalCapacityNights: stats.totalCapacityNights ?? 31,
        grossRevenue: Math.round(stats.estGross ?? 0),
        commissionPct: Math.round((prop.commissionPct || 0) * 100),
        commissionAmount: Math.round(stats.myCommission ?? 0),
        bookingsCount: Array.isArray(state.data.bookings) ? state.data.bookings.length : 0,
      });
    } catch {
      // no-op
    }
    // We intentionally exclude onKpiUpdate from deps to avoid re-emitting on stable parent callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data]);

  if (!propertyId) return null;

  const currency = (n)=>Intl.NumberFormat(undefined,{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n||0);

  const flags = state.data?.property?.flags || {};
  const meta = state.data?.property?.meta || {};
  const metaLine = [meta.city || state.data?.property?.address?.municipality, meta.distanceToBeachMeters ? `${meta.distanceToBeachMeters}m do plaže` : null].filter(Boolean).join(' • ');
  const gallery = galleryUrls
  const activeBadges = [];
  if (flags.family) activeBadges.push('Porodično');
  if (flags.nearBeach) activeBadges.push('Blizu plaže');
  if (flags.petFriendly) activeBadges.push('Pet friendly');
  if (flags.freeCancellation) activeBadges.push('Besplatno otkazivanje');
  if (flags.instantBooking) activeBadges.push('Instant rezervacija');
  if (flags.taxesIncluded) activeBadges.push('Uključene takse i PDV');

  return (
    <section className="card" id="prop-overview">
      <div className="card-head">
        <h2 className="card-title" id="prop-title">{state.data?.property?.name ?? "Pregled objekta"}</h2>
      </div>

  {state.loading && <p id="prop-loading">Učitavanje…</p>}

      {/* Slider sekcija – uvijek prikazuj (čak i ako overview vrati grešku), koristi zadnju poznatu galeriju */}
      <div className="hero" id="prop-hero">
        {/* Slider with arrows and dots (centered with side breathing space) */}
        <div className="slider-wrap">
          <div className="slider" id="prop-slider">
            <div className="slides" style={{transform:`translateX(-${slideIdx*100}%)`}}>
              {gallery.slice(0,8).map((src,i)=>(
                <div className="slide" key={i}>
                  <img src={src} alt={`hero-${i}`} loading="lazy" />
                </div>
              ))}
            </div>
            {gallery.length>1 && (
              <div className="nav">
                <button type="button" aria-label="Prethodna" onClick={()=>setSlideIdx((p)=> (p-1+gallery.length)%gallery.length)}>‹</button>
                <button type="button" aria-label="Sljedeća" onClick={()=>setSlideIdx((p)=> (p+1)%gallery.length)}>›</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Dots below slider */}
      {gallery.length>1 && (
        <div className="dots" style={{marginTop:8}}>
          {gallery.slice(0,8).map((_,i)=>(
            <button key={i} className={i===slideIdx? 'active':''} onClick={()=>setSlideIdx(i)} aria-label={`Slajd ${i+1}`} />
          ))}
        </div>
      )}

      {state.error && !state.loading && (
        <p className="form-message" id="prop-error">{state.error}</p>
      )}

      {!state.loading && !state.error && state.data && (
        <>
          {!!state.data && (!state.data.units || state.data.units.length===0 || 
             (diag?.units || []).every(u => !u.importUrl)) && (
            <div className="banner warning" id="ical-missing">
              iCal nije povezan ni za jedan apartman. Zauzetost će uvijek biti 0. Otvori “Dodaj smještaj” i dodaj iCal URL za svaki apartman.
            </div>
          )}

          {diag && (
            <section className="card" id="sync-status">
              <h3>Sync status</h3>
              <ul className="list" id="sync-list">
                {(diag.units || []).map(u => (
                  <li key={u.unitId} className="list-item sync-item" id={`sync-${u.unitId}`}>
                    <div className="sync-left">
                      <div className="sync-title">{u.name}</div>
                      <div className="sync-sub">
                        {u.importUrl ? "Povezan" : "Nije povezan"} ·
                        {" "}Zadnji sync: {u.lastStatus?.syncedAt ? new Date(u.lastStatus.syncedAt).toLocaleString() : "n/a"} ·
                        {" "}HTTP: {u.lastStatus?.httpStatus ?? "n/a"} ·
                        {" "}Ukupno događaja: {u.lastStatus?.eventsTotal ?? 0} ·
                        {" "}Dodato zadnji put: {u.lastStatus?.addedLastRun ?? 0}
                        {u.lastStatus?.error ? <span className="error"> · Greška: {u.lastStatus.error}</span> : null}
                      </div>
                    </div>
                    <div className="sync-actions">
                      {u.importUrl && (() => {
                        const syncedAt = u.lastStatus?.syncedAt ? new Date(u.lastStatus.syncedAt) : null;
                        const fresh = syncedAt && (Date.now() - syncedAt.getTime() < 10*60*1000); // 10 min
                        if (fresh) return <span className="sync-fresh" style={{fontSize:12,opacity:0.7}}>Svježe syncovano</span>;
                        return (
                          <button
                            className="btn btn-small"
                            onClick={async () => {
                              try {
                                const { data } = await propertyApi.syncUnit(propertyId, u.unitId);
                                await Promise.all([
                                  loadDiag(),
                                  propertyApi.overview(propertyId, month).then(({ data }) => setState(s=>({...s,data}))).catch(()=>{}),
                                ]);
                                alert(`Sync OK: http=${data.httpStatus} total=${data.total} added=${data.added}`);
                              } catch (e) {
                                alert("Sync greška: " + (e?.response?.data?.error || e.message));
                              }
                            }}
                          >Sync sada</button>
                        )
                      })()}
                    </div>
                  </li>
                ))}
              </ul>
              {!state.data?.property?.published && (
                <div className="sync-publish" id="sync-publish">
                  <button
                    className="btn btn-small"
                    onClick={async () => {
                      try {
                        const { data } = await propertyApi.publish(propertyId);
                        await propertyApi.overview(propertyId, month).then(({data})=>setState(s=>({...s,data}))).catch(()=>{});
                        if (typeof onPublished === 'function') onPublished(propertyId);
                        alert("Objekat objavljen na javnu stranicu.");
                      } catch (e) {
                        alert("Greška pri objavi: " + (e?.response?.data?.error || e.message));
                      }
                    }}
                  >Objavi na javnu stranicu</button>
                </div>
              )}
            </section>
          )}

          {/* Owner calendar for the selected month: red = zauzeto (sve jedinice), zeleno = slobodno, žuto = djelimično */}
          <section className="card" id="owner-calendar">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
              <h3 style={{margin:0}}>Kalendar zauzeća</h3>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button className="btn outline small" onClick={prevMonth}>◀</button>
                <div style={{minWidth:110,textAlign:'center',fontWeight:700}}>{month}</div>
                <button className="btn outline small" onClick={nextMonth}>▶</button>
              </div>
            </div>
            <OwnerMonthCalendar
              month={month}
              dayStatuses={state.data?.dayStatuses || []}
              units={(state.data?.units||[]).map(u=>({id:u.id,name:u.name}))}
            />
          </section>


          <section className="card" id="prop-bookings">
            <h3>Rezervacije/blokade (mjesec)</h3>
            <ul className="list" id="bookings-list">
              {(state.data.bookings||[]).map((b,i)=>(
                <li key={i} className="list-item booking" id={`booking-${i}`}>
                  <span className="b-dates">{new Date(b.start).toLocaleDateString()} – {new Date(b.end).toLocaleDateString()}</span>
                  <span className="b-kind">{b.kind}</span>
                  <span className="b-source">{b.source}</span>
                </li>
              ))}
              {(!state.data.bookings || state.data.bookings.length===0) && <li className="list-item">Nema događaja.</li>}
            </ul>
          </section>

        </>
      )}
    </section>
  );
}

// Simple month calendar component with busy/partial/free coloring
function OwnerMonthCalendar({ month, dayStatuses, units }){
  const [selectedUnit, setSelectedUnit] = useState('all')
  const [selectedDay, setSelectedDay] = useState(null) // {key, info}
  const first = useMemo(()=> new Date(month + "-01"), [month])
  const firstDay = first.getDay() || 7 // ISO: make Monday=1..Sunday=7
  const daysInMonth = new Date(first.getFullYear(), first.getMonth()+1, 0).getDate()
  const cells = []
  for(let i=1;i<firstDay;i++) cells.push(null) // leading blanks
  for(let d=1; d<=daysInMonth; d++){
    const yyyy = first.getFullYear()
    const mm = String(first.getMonth()+1).padStart(2,'0')
    const dd = String(d).padStart(2,'0')
    const key = `${yyyy}-${mm}-${dd}`
    const base = dayStatuses.find(x=> x.date === key)
    // If a specific unit is selected, derive filtered occupancy info client-side
    let info = base
    if (selectedUnit !== 'all' && base) {
      // Normalize to string keys for safe comparison
      const unitKey = String(selectedUnit)
      const bookedIds = new Set((base.unitIds || []).map(String))
      const occ = bookedIds.has(unitKey) ? 1 : 0
      info = {
        ...base,
        occupiedUnits: occ,
        // When viewing a single unit, treat capacity as 1 so 1/1 => busy (red), 0/1 => free (green)
        totalUnits: 1,
        guests: Array.isArray(base.guestsByUnit)
          ? (base.guestsByUnit.find(g=> String(g.unitId)===unitKey)?.names || [])
          : base.guests
      }
    }
    let cls = 'free'
    if(info){
      if((info.occupiedUnits||0) >= (info.totalUnits||0)) cls = 'busy'
      else if((info.occupiedUnits||0) > 0) cls = 'partial'
    }
    cells.push({ d, key, cls, info })
  }
  while(cells.length % 7 !== 0) cells.push(null)
  const weekNames = ['Pon','Uto','Sri','Čet','Pet','Sub','Ned']
  return (
    <div className="owner-cal">
      {/* Controls */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:4}}>
        <div className="legend" style={{marginTop:0}}>
          <span className="dot free"></span> Slobodno
          <span className="dot" style={{background:'#f59e0b', marginLeft:12}}></span> Djelimično
          <span className="dot busy" style={{marginLeft:12}}></span> Zauzeto
        </div>
        {Array.isArray(units) && units.length>0 && (
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <label style={{fontSize:12,color:'#555'}}>Jedinica:</label>
            <select className="input" value={selectedUnit} onChange={e=>{setSelectedUnit(e.target.value); setSelectedDay(null)}} style={{height:32,padding:'4px 10px'}}>
              <option value="all">Sve jedinice</option>
              {units.map(u=> <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="cal-head">
        {weekNames.map(w=> <div key={w} className="wname">{w}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((c,idx)=> c ? (
          <div
            key={c.key}
            className={`day ${c.cls} ${selectedDay?.key===c.key ? 'selected': ''}`}
            title={c.info ? `${c.info.occupiedUnits}/${c.info.totalUnits} zauzeto` : 'slobodno'}
            onClick={()=> setSelectedDay(c)}
          >
            <span className="num">{c.d}</span>
            {c.info && Array.isArray(c.info.guests) && c.info.guests.length>0 && (
              <span className="guest" title={c.info.guests.join(", ")}>{
                c.info.guests.length===1 ? c.info.guests[0] : `${c.info.guests[0]} +${c.info.guests.length-1}`
              }</span>
            )}
          </div>
        ) : <div key={"b"+idx} className="day blank" />)}
      </div>
      {/* Day details */}
      {selectedDay && (
        <div style={{marginTop:6, fontSize:13, color:'#333', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap'}}>
          <div>
            <strong>{selectedDay.key}</strong> — {selectedDay.info ? `${selectedDay.info.occupiedUnits}/${selectedDay.info.totalUnits} zauzeto` : 'slobodno'}
            {selectedDay.info?.guests?.length ? (
              <>
                {' · '}Gosti: {selectedDay.info.guests.slice(0,3).join(', ')}{selectedDay.info.guests.length>3 ? ` +${selectedDay.info.guests.length-3}`:''}
              </>
            ) : null}
          </div>
          <button className="btn outline small" onClick={()=> setSelectedDay(null)}>Poništi</button>
        </div>
      )}
    </div>
  )
}
