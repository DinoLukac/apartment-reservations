import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { http } from "../api/http";
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import DateRangeCalendar from "../components/DateRangeCalendar.jsx";

// Konstante pravila boravka (lako kasnije povući sa servera)
const MIN_NIGHTS = 2;
const MAX_NIGHTS = 30; // primjer upper bound

// pomoćne
const iso = d => (d ? new Date(d).toISOString().slice(0,10) : "");
const parseIntOr = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
const diffNights = (a, b) => {
  if (!a || !b) return 0;
  const ms = (new Date(b) - new Date(a));
  return ms > 0 ? Math.ceil(ms / (1000*60*60*24)) : 0;
};

const pin = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor:[12,41], shadowSize:[41,41]
});

export default function BookingPage() {
  // Could come with or without unitId (two route patterns)
  const params = useParams();
  const propertyId = params.propertyId;
  const routeUnitId = params.unitId; // optional
  const [sp] = useSearchParams();

  // prefill iz query
  const [from, setFrom] = useState(sp.get("from") || "");
  const [to, setTo] = useState(sp.get("to") || "");
  const [guests, setGuests] = useState(parseIntOr(sp.get("guests"), 1));

  // korisnik
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const [company, setCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyVat, setCompanyVat] = useState("");

  // Property units state
  const [units, setUnits] = useState([]); // [{id,name,beds,bedrooms,pricePerNight}]
  const [propertyName, setPropertyName] = useState("");
  const [propertyLocation, setPropertyLocation] = useState(null); // {type:'Point', coordinates:[lng,lat]}
  const [availability, setAvailability] = useState([]); // unit-level boolean array (fresh)
  const [unitId, setUnitId] = useState(routeUnitId || "");
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState("");

  // QUOTE state
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quote, setQuote] = useState(null); // {available, nights, pricePerNight, total, currency}
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nights = useMemo(() => diffNights(from, to), [from, to]);
  const pricePerNight = quote?.pricePerNight || 0;
  const total = quote?.total || 0;
  const currency = quote?.currency || "EUR";

  const navigate = useNavigate();
  const dateOrderInvalid = !!from && !!to && new Date(to) <= new Date(from);
  const belowMin = nights > 0 && nights < MIN_NIGHTS;
  const aboveMax = nights > 0 && nights > MAX_NIGHTS;
  const nightsInvalid = belowMin || aboveMax;

  const canQuote = propertyId && unitId && from && to && nights > 0 && !dateOrderInvalid && !nightsInvalid;
  // Validation
  const emailValid = useMemo(()=> /.+@.+\..+/.test(email.trim()), [email]);
  const phoneValid = useMemo(()=> {
    const v = phone.trim();
    if(!v) return false; // tražimo obavezno
    // Crna Gora: +382 i 6-9 cifara (fleksibilno, bez stroge formate po mrežama)
    return /^\+382[\s\d]{6,12}$/.test(v);
  }, [phone]);
  const fullNameValid = fullName.trim().length >= 3;
  const contactValid = fullNameValid && emailValid && phoneValid;
  const canSubmit = canQuote && quote?.available && contactValid;

  // fetch quote when inputs change (basic debounce)
  useEffect(() => {
    setQuoteError("");
  if (!canQuote) { setQuote(null); return; }
    let abort = false;
    const t = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const { data } = await http.post("/reservations/quote", {
          propertyId, unitId, checkIn: from, checkOut: to, guests
        });
        if (!abort) setQuote(data);
      } catch (e) {
        if (!abort) setQuoteError("Greška pri dohvatu cijene");
      } finally {
        if (!abort) setQuoteLoading(false);
      }
    }, 350); // debounce
    return () => { abort = true; clearTimeout(t); };
  }, [propertyId, unitId, from, to, guests]);

  // Fetch property units (MVP: attempt owner overview or property endpoint - assuming a public GET /api/properties/:id/overview not protected; if protected this will fail gracefully)
  useEffect(() => {
    if (!propertyId) return;
    let abort = false;
    (async () => {
      setUnitsLoading(true); setUnitsError("");
      try {
        const { data } = await http.get(`/public/listings/${propertyId}`);
        setPropertyName(data?.name || "");
        if (data?.location && Array.isArray(data.location.coordinates)) {
          setPropertyLocation(data.location);
        } else {
          setPropertyLocation(null);
        }
        const raw = data?.units || [];
        const normalized = raw.map(u => ({
          id: u.id || u._id,
          name: u.name || 'Apartman',
          beds: u.beds ?? u.bedrooms ?? 0,
          bedrooms: u.bedrooms ?? null,
          pricePerNight: u.pricePerNight ?? 0
        }));
        if (!abort) {
          setUnits(normalized);
          // Default select first if not in route
          if (!routeUnitId && normalized.length) setUnitId(String(normalized[0].id));
        }
      } catch (e) {
        if (!abort) setUnitsError("Ne mogu učitati apartmane");
      } finally { if (!abort) setUnitsLoading(false); }
    })();
    return () => { abort = true; };
  }, [propertyId, routeUnitId]);

  // Fetch per-unit availability every time selected unit changes (and property ready)
  useEffect(() => {
    if (!propertyId || !unitId) return;
    let abort = false;
    (async () => {
      try {
        // Tražimo 90 dana unaprijed da pokrijemo i idući mjesec
        const { data } = await http.get(`/public/listings/${propertyId}/units/${unitId}/availability?days=90`);
        if (!abort) setAvailability(data?.avail || data?.availNext30 || []);
      } catch (e) {
        if (!abort) setAvailability([]);
      }
    })();
    return () => { abort = true; };
  }, [propertyId, unitId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setSubmitError("");
      setSubmitting(true);
      const payload = {
        propertyId,
        unitId,
        checkIn: from,
        checkOut: to,
        guests,
        guest: {
          fullName: fullName,
          email,
          phone,
          note,
          company: company ? { name: companyName, vat: companyVat } : undefined
        },
        paymentMethod: "pay_on_arrival"
      };
      const { data } = await http.post("/reservations", payload);
      if (data?.code) {
        navigate(`/booking/thank-you/${data.code}`, {
          state: { code: data.code, total: data.total, currency: data.currency, checkIn: data.checkIn, checkOut: data.checkOut, nights: data.nights }
        });
      }
    } catch (e) {
      // Pokušaj izvući server error poruku
      const msg = e?.response?.data?.error || "Rezervacija nije uspjela";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page booking" id="booking-page">
      <h1 className="page-title">Rezervacija</h1>

      <section className="booking-grid">
        {/* Forma */}
        <form className="card booking-form" onSubmit={handleSubmit} noValidate>
          <h2 className="card-title">Detalji boravka</h2>

          <div className="row">
            <label>Apartman / jedinica</label>
            <select value={unitId} onChange={e => setUnitId(e.target.value)} required>
              <option value="" disabled>Odaberite...</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.beds} kreveta · €{u.pricePerNight}/noć
                </option>
              ))}
            </select>
            {unitsLoading && <div style={{fontSize:12}}>Učitavam jedinice...</div>}
            {unitsError && <div style={{fontSize:12,color:'#b00'}}>{unitsError}</div>}
          </div>

          <div className="row">
            <label>Datumi boravka</label>
            <DateRangeCalendar
              from={from}
              to={to}
              onChange={(f,t)=>{ setFrom(f); setTo(t); }}
              minNights={MIN_NIGHTS}
              maxNights={MAX_NIGHTS}
              disabledDates={useMemo(()=>{
                // Map availNext30: index 0 = danas. false => zauzeto
                const set = new Set();
                const today = new Date();
                availability.forEach((free, idx) => {
                  if(!free){
                    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()+idx);
                    set.add(d.toISOString().slice(0,10));
                  }
                });
                return set;
              }, [availability])}
            />
          </div>

          {dateOrderInvalid && (
            <div className="msg warn" style={{color:'#b00', fontSize:12}}>Datum odlaska mora biti poslije datuma dolaska.</div>
          )}
          {belowMin && !dateOrderInvalid && (
            <div className="msg warn" style={{color:'#b00', fontSize:12}}>Minimalan boravak je {MIN_NIGHTS} noći.</div>
          )}
          {aboveMax && !dateOrderInvalid && (
            <div className="msg warn" style={{color:'#b00', fontSize:12}}>Maksimalan boravak je {MAX_NIGHTS} noći.</div>
          )}

          <div className="row">
            <label>Gosti</label>
            <input type="number" min="1" value={guests} onChange={e => setGuests(parseIntOr(e.target.value, 1))} />
          </div>

          <hr />

          <h3>Podaci gosta</h3>
          <div className="row">
            <label>Ime i prezime</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required aria-invalid={!fullNameValid}
              className={!fullNameValid && fullName ? 'input-error':''} />
            {!fullNameValid && fullName && (<div className="err">Unesite ime i prezime (min 3 znaka).</div>)}
          </div>

          <div className="row">
            <label>E-pošta</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required aria-invalid={!emailValid}
              className={!emailValid && email ? 'input-error':''} />
            {!emailValid && email && (<div className="err">Unesite ispravan e-mail.</div>)}
          </div>

          <div className="row">
            <label>Telefon</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+382 67 123 456" aria-invalid={!phoneValid}
              className={!phoneValid && phone ? 'input-error':''} />
            {!phoneValid && phone && (<div className="err">Format telefona: +382 …</div>)}
          </div>

          <div className="row">
            <label className="inline">
              <input type="checkbox" checked={company} onChange={e => setCompany(e.target.checked)} />
              Treba račun na firmu
            </label>
          </div>

          {company && (
            <>
              <div className="row">
                <label>Naziv firme</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
              <div className="row">
                <label>PIB / VAT</label>
                <input value={companyVat} onChange={e => setCompanyVat(e.target.value)} />
              </div>
            </>
          )}

          <div className="row">
            <label>Napomena</label>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {/* Trust bedževi */}
          <div className="trust-row small">
            <span className="pill">🔒 Sigurna rezervacija</span>
            <span className="pill">🆓 Bez provizije</span>
            <a className="pill" href="https://wa.me/38267524041" target="_blank" rel="noreferrer">💬 Podrška WhatsApp</a>
          </div>

          <button className="btn primary cta" disabled={!canSubmit || submitting}>
            {submitting ? 'Slanje…' : 'Potvrdi rezervaciju'}
          </button>
          {submitError && !submitError.toLowerCase().includes('email') && (
            <div style={{color:'#b00', marginTop:8, fontSize:12}}>{submitError}</div>
          )}

          {/* Politike ukratko */}
          <div className="policy-brief">
            <div><b>Otkazivanje:</b> Besplatno do 7 dana prije dolaska</div>
            <div><b>Check-in/Check-out:</b> 14:00 / 10:00</div>
            <div><b>Kućna pravila:</b> Bez žurki, mir poslije 22h — <a href="#" onClick={(e)=>e.preventDefault()}>više</a></div>
          </div>
        </form>

        {/* Rezime */}
        <aside className="card booking-summary">
          <h2 className="card-title">Rezime</h2>
          <ul className="summary-list">
            <li><b>Smještaj:</b> {propertyName || '—'}</li>
            <li><b>Jedinica:</b> {units.find(u => String(u.id) === String(unitId))?.name || '—'}</li>
            <li><b>Datumi:</b> {from || "—"} → {to || "—"} ({nights} noći)</li>
            {belowMin && <li style={{color:'#b00'}}>Potrebno ≥ {MIN_NIGHTS} noći</li>}
            {aboveMax && <li style={{color:'#b00'}}>Potrebno ≤ {MAX_NIGHTS} noći</li>}
            {dateOrderInvalid && <li style={{color:'#b00'}}>Pogrešan redoslijed datuma</li>}
            <li><b>Gosti:</b> {guests}</li>
          </ul>

          <div className="price">
            {(!from || !to) && <div style={{fontSize:12}}>Unesite datume za cijenu.</div>}
            {dateOrderInvalid && <div style={{color:'#b00'}}>Ispravite datume.</div>}
            {nightsInvalid && !dateOrderInvalid && <div style={{color:'#b00'}}>Ne zadovoljava uslove boravka.</div>}
            {quoteLoading && <div>Proračun cijene...</div>}
            {quoteError && <div className="err" style={{color:"#b00"}}>{quoteError}</div>}
            {quote && !quote.available && <div style={{color:"#b00"}}>Nema dostupnosti za odabrane datume.</div>}
            {quote && quote.available && (
              <>
                <div>{currency} {pricePerNight} / noć</div>
                <div className="total"><b>Ukupno:</b> {currency} {total}</div>
                <div className="mini">{nights} noći · {guests} gost(i)</div>
              </>
            )}
            {!quote && !quoteLoading && canQuote && <div>—</div>}
          </div>

          {propertyLocation && (
            <div className="mini-map-wrapper" style={{marginTop:16}}>
              <div style={{fontSize:12, marginBottom:4}}>Lokacija</div>
              <div className="mini-map" style={{height:180, borderRadius:8, overflow:'hidden'}}>
                <MapContainer
                  center={[propertyLocation.coordinates[1], propertyLocation.coordinates[0]]}
                  zoom={13}
                  scrollWheelZoom={false}
                  dragging={false}
                  doubleClickZoom={false}
                  boxZoom={false}
                  keyboard={false}
                  style={{height:'100%', width:'100%'}}
                >
                  <TileLayer attribution='&copy; OSM' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
                  <Marker position={[propertyLocation.coordinates[1], propertyLocation.coordinates[0]]} icon={pin} />
                </MapContainer>
              </div>
              <div style={{marginTop:6}}>
                <a href="/map" style={{fontSize:12, textDecoration:'none', color:'#0b57d0'}}>Otvori veću mapu →</a>
              </div>
            </div>
          )}

          <p className="policy" style={{marginTop:16}}>Cijena uključuje smještaj. Boravišna taksa nije uračunata ako nije drugačije navedeno.</p>
        </aside>
      </section>
    </div>
  );
}
