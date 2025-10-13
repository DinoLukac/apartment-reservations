import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth-context.jsx";
import PropertyOverview from "../components/property-overview.jsx";
import PropertyFlagsForm from "../components/PropertyFlagsForm.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import { propertyApi } from "../api/http";
import { apiDeleteAll, apiUnpublishAll, ownerOverview, ownerSyncStatus } from "../api/propertyApi";

export default function DashboardPage() {
  const { me, loadMe } = useAuth();
  const location = useLocation();
  const [sp] = useSearchParams();
  const postSave = location.state?.postSave || null;
  const [showPostSave, setShowPostSave] = useState(!!postSave);
  const [autoProp, setAutoProp] = useState(null); // auto-izabrani prvi objekat
  const queryProp = sp.get("property");
  const propertyId = (postSave && postSave.propertyId) || queryProp || autoProp || ""; // fallback ostaje prazan
  const [properties, setProperties] = useState([]);
  const [overview, setOverview] = useState(null); // null => ne prikazuj
  const [syncStatuses, setSyncStatuses] = useState([]);
  const [syncing, setSyncing] = useState({}); // per-unit syncing state
  const [publishedAny, setPublishedAny] = useState(false); // new flag
  const hasProps = properties.length > 0;
  const hasAnyIcal = (overview?.units || []).some(u => u?.importUrl || u?.ical?.importUrl);
  // KPI state driven by PropertyOverview child (realtime updates via sync)
  const [kpi, setKpi] = useState({
    occupancyPct: 0,
    nightsBooked: 0,
    totalCapacityNights: 31,
    grossRevenue: 0,
    commissionPct: 0,
    commissionAmount: 0,
    bookingsCount: 0,
  })
  // Simple slideshow state (for hero slides in dashboard)
  const [slideIdx, setSlideIdx] = useState(0);
  const slides = (postSave?.photos || []).slice(0, 8);
  const go = (dir)=>{ if(!slides.length) return; setSlideIdx(i=> (i + dir + slides.length) % slides.length) }

  useEffect(() => {
    (async () => {
      await loadMe();
    })();
  }, []);

  // Boot: properties + owner overview + sync status
  useEffect(() => {
    const boot = async () => {
      try {
        const { data: props } = await propertyApi.mine();
        setProperties(Array.isArray(props) ? props : []);
        if (props?.length) {
          try {
            const { data: ov } = await ownerOverview();
            setOverview(ov);
          } catch { setOverview(null); }
          try {
            const { data: sync } = await ownerSyncStatus();
            setSyncStatuses(Array.isArray(sync) ? sync : []);
          } catch { setSyncStatuses([]); }
        } else {
          setOverview(null);
          setSyncStatuses([]);
        }
      } catch {
        setProperties([]);
        setOverview(null);
        setSyncStatuses([]);
      }
    };
    boot();
  }, []);

  // Ako nemamo propertyId (niti preko postSave niti query), pokušaj povući listu i uzmi prvi
  useEffect(() => {
    if (postSave?.propertyId || queryProp || autoProp) return; // postoji već
    propertyApi.mine()
      .then(({ data }) => {
        const first = data?.[0];
        if (first?.id) {
          setAutoProp(first.id);
          const url = `/dashboard?property=${encodeURIComponent(first.id)}`;
          window.history.replaceState({}, "", url);
          window.dispatchEvent(new Event("popstate"));
        }
      })
      .catch(() => { /* nema objekata – ostaju samo sesije */ });
  }, [postSave, queryProp, autoProp]);

  // Sesije su uklonjene iz UI-ja; backend ostaje nepromijenjen

  const onRemoveAll = async () => {
  const names = (properties || []).map((p) => p.name).filter(Boolean);
  if (!names.length) return; // safety
    const human = names.length ? names.join(", ") : "sve objekte";

    const ok = window.confirm(
      names.length === 1
        ? `Hoćete li zaista da sklonite "${human}"?`
        : `Hoćete li zaista da sklonite: ${human}?`
    );
    if (!ok) return;

    try {
  const { data } = await apiDeleteAll();
      console.log("[bulk-delete] res", data);

      // isprazni lokalno stanje i makni selection
      setProperties([]);
      setAutoProp("");
      if (queryProp) {
        window.history.replaceState({}, "", "/dashboard");
        window.dispatchEvent(new Event("popstate"));
      }
      setShowPostSave(false);

      alert(`Uklonjeno: ${data.removed} objekata`);
    } catch (e) {
      console.error("[bulk-delete] err", e?.response?.data || e.message);
      alert("Greška pri uklanjanju objekata.");
    }
  };

  const onUnpublishAll = async () => {
  const names = (properties || []).map((p) => p.name).filter(Boolean);
  if (!names.length) return; // safety
    const human = names.length ? names.join(", ") : "sve objekte";

    const ok = window.confirm(
      names.length === 1
        ? `Samo skloni sa javne strane: "${human}"?`
        : `Samo skloni sa javne strane: ${human}?`
    );
    if (!ok) return;

    try {
  const { data } = await apiUnpublishAll();
      console.log("[bulk-unpublish] res", data);
      alert(`Skinuto sa javne strane: ${data.unpublished} objekata`);
    } catch (e) {
      console.error("[bulk-unpublish] err", e?.response?.data || e.message);
      alert("Greška pri skidanju sa javne strane.");
    }
  };

  // Placeholderi (ako kasnije dodas implementaciju sync/publish all)
  const onSyncAll = () => { /* intentionally empty per spec */ }
  const onPublishAll = () => { /* intentionally empty per spec */ }

  const onSyncUnitNow = async (propId, unitId) => {
    if (!propId || !unitId) return;
    setSyncing((s) => ({ ...s, [unitId]: true }));
    try {
      await propertyApi.syncUnit(propId, unitId);
      // refresh owner sync statuses after a run
      try {
        const { data: sync } = await ownerSyncStatus();
        setSyncStatuses(Array.isArray(sync) ? sync : []);
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error("[sync-unit] err", e?.response?.data || e.message);
      alert("Greška pri sinhronizaciji.");
    } finally {
      setSyncing((s) => ({ ...s, [unitId]: false }));
    }
  };

  // After selecting property attempt to read its overview once to see if published
  useEffect(() => {
    const checkPublished = async () => {
      if (!propertyId) return;
      try {
        const { data } = await propertyApi.overview(propertyId, new Date().toISOString().slice(0,7));
        if (data?.property?.published) setPublishedAny(true);
      } catch {/* ignore */}
    };
    checkPublished();
  }, [propertyId]);

  return (
    <div className="page dashboard" id="dashboard">
  <div className="page-title" style={{marginBottom:8}}><h1 style={{margin:0}}>Dashboard</h1></div>
      {/* Uklonjen mjesec filter ispod naslova po zahtjevu */}

      {/* KPI row aligned in one line, equal width, right-aligned */}
  <div className="cards" id="prop-cards" style={{marginTop:6, marginBottom:10}}>
        <div className="card kpi" id="kpi-occupancy">
          <h3 className="title"><span className="ico" aria-hidden>📈</span>Zauzetost</h3>
          <div className="value">{kpi.occupancyPct ?? 0}%</div>
          <div className="sub">{kpi.nightsBooked ?? 0}/{kpi.totalCapacityNights ?? 31} noćenja</div>
        </div>
        <div className="card kpi" id="kpi-revenue">
          <h3 className="title"><span className="ico" aria-hidden>💶</span>Prihod (procjena)</h3>
          <div className="value">{kpi.grossRevenue ?? 0} €</div>
          <div className="sub">Provizija ({kpi.commissionPct ?? 0}%): {kpi.commissionAmount ?? 0} €</div>
        </div>
        <div className="card kpi" id="kpi-units">
          <h3 className="title"><span className="ico" aria-hidden>🏨</span>Apartmani</h3>
          <div className="value">{kpi.bookingsCount ?? 0}</div>
          <div className="sub">Ukupan broj rezervacija (mjesec)</div>
        </div>
      </div>

      {/* Uklonjeni placeholder grafovi radi kompaktnijeg layouta */}
      {/* Uklonjene debug info linije (User/Role) */}

      {/* Info o iCal-u: prikazati samo ako postoji makar jedan iCal URL */}
      {hasProps && hasAnyIcal && (
        <section className="card" id="sync-info" style={{marginTop:12,padding:14}}>
          <details>
            <summary style={{cursor:'pointer',fontWeight:800}}>Povezivanje kalendara (iCal) i sinhronizacija</summary>
            <div style={{marginTop:10,fontSize:14,color:'#333'}}>
              Da bi rezervacije bile precizne i da bi se objekat prikazivao kao zauzet/slobodan, poveži i sinhronizuj iCal linkove za apartmane. Nakon dodavanja iCal linka za svaki apartman, pokreni sinhronizaciju ispod.
            </div>
          </details>
        </section>
      )}

      {/* Sync status lista – samo za korisnike koji su postavili iCal URL */}
      {hasProps && hasAnyIcal && (syncStatuses?.length > 0) && (
        <section className="card" id="sync-status" style={{marginTop:12,padding:16}}>
          <h2 style={{margin:'0 0 8px'}}>Sync status</h2>
          <ul style={{listStyle:'disc', paddingLeft:18, margin:0}}>
            {syncStatuses.map((s, idx) => {
              const propId = s?.propertyId || s?.property?.id || propertyId;
              const unitId = s?.unitId || s?.unit?.id || s?.unit?._id || s?.id;
              const unitName = s?.unitName || s?.unit?.name || s?.name || `Apartman ${idx+1}`;
              const lastSync = s?.lastSyncAt || s?.lastSync || s?.syncedAt || s?.lastRun || null;
              const lastSyncFmt = lastSync ? new Date(lastSync).toLocaleString() : 'nikad';
              const http = (s?.httpStatus ?? s?.status ?? s?.statusCode ?? '-');
              const total = (s?.totalEvents ?? s?.total ?? 0);
              const added = (s?.lastAdded ?? s?.added ?? s?.addedLastRun ?? 0);
              const connected = (s?.connected ?? s?.ok ?? !!(s?.importUrl || s?.unit?.importUrl));
              const key = unitId || `${unitName}-${idx}`;
              return (
                <li key={key} style={{marginBottom:16}}>
                  <div style={{fontWeight:600, marginBottom:2}}>{unitName}</div>
                  <div style={{color:'#333',fontSize:14, marginBottom:8}}>
                    {connected ? 'Povezan' : 'Nije povezan'} · Zadnji sync: {lastSyncFmt} · HTTP: {http} · Ukupno događaja: {total} · Dodato zadnji put: {added}
                  </div>
                  <button
                    className="btn outline"
                    onClick={() => onSyncUnitNow(propId, unitId)}
                    disabled={!!syncing[unitId]}
                    title="Pokreni sinhronizaciju sada"
                  >
                    {syncing[unitId] ? 'Sync…' : 'Sync sada'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Akcije za objave – uvijek dostupne bez obzira na iCal */}
      {hasProps && (
        <section className="card" id="manage-actions" style={{marginTop:12,padding:14}}>
          <h2 style={{margin:'0 0 8px'}}>Upravljanje oglasima</h2>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {!publishedAny && (
              <button className="btn primary" onClick={onPublishAll} title="Objavi na javnu stranicu">Objavi na javnu stranicu</button>
            )}
            <button className="btn outline" onClick={onUnpublishAll} title="Skloni sa javne strane">Skloni sa javne strane</button>
            <button className="btn outline" onClick={onRemoveAll} title="Ukloni sve objekte">Ukloni sve objekte</button>
          </div>
        </section>
      )}

      {/* Vlasnički paneli */}
      {hasProps && (
  <div className="cards" id="owner-panels" style={{marginTop:12}}>
          <section className="card mini-panel" id="panel-reservations">
            <div className="panel-head">
              <h3 className="panel-title">Rezervacije</h3>
              <span className="panel-sub">Pregled, promjene i kontakti gostiju.</span>
            </div>
            <div className="panel-actions">
              <a className="btn primary" href="/dashboard/reservations">Otvori pregled</a>
            </div>
          </section>
        </div>
      )}

      {/* Overview sekcija */}
      {hasProps && overview && overview.hasProperties && (
  <div className="owner-overview" id="owner-overview" style={{marginTop:6}}>
          <h2 style={{marginTop:0}}>Rezervacije/blokade (mjesec)</h2>
          {overview.events?.length ? (
            <ul>
              {overview.events.map(ev => (
                <li key={ev.start + '-' + ev.unitId}>{ev.summary || '(bez opisa)'}</li>
              ))}
            </ul>
          ) : <p>Nema događaja.</p>}
        </div>
      )}

      {/* Empty state kad nema objekata */}
      {!hasProps && (
  <div className="empty-state" id="dash-empty" style={{marginTop:22}}>
          <p>Nema dodanih smještaja.</p>
          <a className="btn" href="/onboarding">+ Dodaj smještaj</a>
        </div>
      )}

      {/* PropertyOverview prikaz samo ako ima objekata i izabran property */}
  {hasProps && propertyId && <PropertyOverview propertyId={propertyId} onPublished={() => setPublishedAny(true)} onKpiUpdate={setKpi} />}
      {hasProps && propertyId && <PropertyFlagsForm propertyId={propertyId} />}
      {hasProps && propertyId && <LocationPicker propertyId={propertyId} />}

      {/* Post-save modal (ostavljen) */}
      {showPostSave && postSave && (
        <div className="modal" id="post-save-modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3 className="modal-title">Objekat spremljen</h3>
            <div className="modal-body">
              <div className="slideshow" id="preview-slideshow">
                {slides.length > 0 ? (
                  <div>
                    <div className="slider">
                      <div className="slides" style={{transform:`translateX(-${slideIdx*100}%)`}}>
                        {slides.map((src, i)=>(
                          <div className="slide" key={i}><img src={src} alt={`hero-${i}`} loading="lazy" /></div>
                        ))}
                      </div>
                      <div className="nav">
                        <button type="button" onClick={()=>go(-1)} aria-label="Prethodna">‹</button>
                        <button type="button" onClick={()=>go(1)} aria-label="Sljedeća">›</button>
                      </div>
                    </div>
                    <div className="dots">
                      {slides.map((_,i)=>(
                        <button key={i} className={i===slideIdx? 'active':''} onClick={()=>setSlideIdx(i)} aria-label={`Slajd ${i+1}`} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{color:'#666'}}>Nema fotografija.</p>
                )}
              </div>
              <div className="summary" id="preview-summary">
                <p className="sum-name">{postSave.name}</p>
                <ul className="sum-units">
                  {(postSave.units || []).map((u, i) => (
                    <li key={i}>{u.name} — {u.bedrooms} sobe, {u.beds} kreveta, {u.pricePerNight} €/noć</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn"
                id="btn-sync-public"
                onClick={async () => {
                  try {
                    await propertyApi.publish(postSave.propertyId);
                    alert("Objekat je sinhronizovan na javnu stranicu.");
                  } catch (e) {
                    alert("Greška pri sinhronizaciji.");
                  }
                  setShowPostSave(false);
                  window.history.replaceState({}, "", window.location.pathname + window.location.search);
                }}
              >
                Sinhronizuj na rezervacije gostiju
              </button>
              <button
                className="btn"
                id="btn-close-modal"
                onClick={() => {
                  setShowPostSave(false);
                  window.history.replaceState({}, "", window.location.pathname + window.location.search);
                }}
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
