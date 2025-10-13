import { useEffect, useState } from "react";
import { propertyApi } from "../api/http";

/**
 * Forma za uređivanje marketing meta i flagova objekta.
 * Props:
 *  - propertyId (string, required)
 *  - onUpdated(optional): callback(data)
 */
export default function PropertyFlagsForm({ propertyId, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [data, setData] = useState({
    meta: { city: "", distanceToBeachMeters: "" },
    flags: {
      family: false,
      nearBeach: false,
      petFriendly: false,
      freeCancellation: false,
      instantBooking: false,
      taxesIncluded: false,
    },
    bookingMode: "request",
    cancellationPolicy: "flexible", // fallback
  });

  // Fetch trenutne vrijednosti (koristimo overview endpoint jer dedicated GET možda ne postoji)
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!propertyId) return;
      setLoading(true); setError("");
      try {
        // pokuša prvo dedicated get; ako 404 onda fallback overview
        let meta = null, flags = null, bookingMode = "request", cancellationPolicy = "";
        try {
          const { data: single } = await propertyApi.get(propertyId);
          meta = single.meta || single.property?.meta || single?.data?.meta || single?.propertyMeta || null;
          flags = single.flags || single.property?.flags || null;
          bookingMode = single.bookingMode || single.property?.bookingMode || bookingMode;
          cancellationPolicy = single.cancellationPolicy || single.property?.cancellationPolicy || cancellationPolicy;
        } catch {
          // Fallback overview
          try {
            const { data: ov } = await propertyApi.overview(propertyId, new Date().toISOString().slice(0,7));
            meta = ov.property?.meta || null;
            flags = ov.property?.flags || null;
            bookingMode = ov.property?.bookingMode || bookingMode;
            cancellationPolicy = ov.property?.cancellationPolicy || cancellationPolicy;
          } catch {}
        }
        if (!active) return;
        setData(d => ({
          ...d,
            meta: {
              city: meta?.city || "",
              distanceToBeachMeters: meta?.distanceToBeachMeters ?? "",
            },
            flags: {
              ...d.flags,
              family: !!flags?.family,
              nearBeach: !!flags?.nearBeach,
              petFriendly: !!flags?.petFriendly,
              freeCancellation: !!flags?.freeCancellation,
              instantBooking: !!flags?.instantBooking,
              taxesIncluded: !!flags?.taxesIncluded,
            },
            bookingMode: bookingMode || d.bookingMode,
            cancellationPolicy: cancellationPolicy || d.cancellationPolicy,
        }));
      } catch (e) {
        if (!active) return;
        setError("Ne mogu učitati atribute.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false };
  }, [propertyId]);

  const updateField = (path, value) => {
    setData(d => {
      const copy = { ...d };
      const parts = path.split(".");
      let ref = copy;
      for (let i=0;i<parts.length-1;i++) ref = ref[parts[i]];
      ref[parts.at(-1)] = value;
      return copy;
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!propertyId) return;
    setSaving(true); setError(""); setOkMsg("");
    try {
      const payload = {
        meta: {
          city: data.meta.city.trim(),
          distanceToBeachMeters: data.meta.distanceToBeachMeters === "" ? null : Number(data.meta.distanceToBeachMeters),
        },
        flags: { ...data.flags },
        bookingMode: data.bookingMode,
        cancellationPolicy: data.cancellationPolicy,
      };
      // ako distance < 900 i korisnik nije čekirao nearBeach, ponudi auto-set
      if (payload.meta.distanceToBeachMeters != null && payload.meta.distanceToBeachMeters <= 900 && !payload.flags.nearBeach) {
        payload.flags.nearBeach = true; // auto
      }
      await propertyApi.updateFlags(propertyId, payload);
      setOkMsg("Sačuvano.");
      if (typeof onUpdated === 'function') onUpdated(payload);
      // ako je instantBooking čekiran sinkronizuj bookingMode
      if (payload.flags.instantBooking) updateField('bookingMode', 'instant');
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Greška pri snimanju.');
    } finally {
      setSaving(false);
      setTimeout(()=>setOkMsg(""), 3000);
    }
  };

  return (
    <form className="card" id="prop-flags-form" onSubmit={onSubmit} style={{marginTop:24}}>
      <div className="card-head"><h3 style={{margin:0}}>Istaknuti atributi</h3></div>
      {loading && <p>Učitavanje…</p>}
      {!loading && (
        <>
          <div className="grid" style={{display:'grid', gap:'12px', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))'}}>
            <label className="form-field">
              <span className="form-label">Grad / lokacija</span>
              <input value={data.meta.city} onChange={e=>updateField('meta.city', e.target.value)} className="form-input" placeholder="npr. Ulcinj" />
            </label>
            <label className="form-field">
              <span className="form-label">Udaljenost do plaže (m)</span>
              <input value={data.meta.distanceToBeachMeters} onChange={e=>updateField('meta.distanceToBeachMeters', e.target.value.replace(/[^0-9]/g,''))} className="form-input" placeholder="npr. 600" />
              <small style={{opacity:.6}}>Ako &le; 900m biće označeno kao "Blizu plaže".</small>
            </label>
            <label className="form-field">
              <span className="form-label">Način rezervacije</span>
              <select className="form-input" value={data.bookingMode} onChange={e=>updateField('bookingMode', e.target.value)}>
                <option value="request">Upit (potvrda ručno)</option>
                <option value="instant">Instant</option>
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Otkazivanje</span>
              <select className="form-input" value={data.cancellationPolicy} onChange={e=>updateField('cancellationPolicy', e.target.value)}>
                <option value="flexible">Fleksibilno</option>
                <option value="moderate">Umjereno</option>
                <option value="strict">Strogo</option>
              </select>
            </label>
          </div>
          <fieldset style={{marginTop:16, border:'1px solid #eee', borderRadius:8, padding:'12px'}}>
            <legend style={{padding:'0 6px'}}>Badge oznake</legend>
            <div className="badges-grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))'}}>
              {[
                ['family','Porodično'],
                ['nearBeach','Blizu plaže'],
                ['petFriendly','Pet friendly'],
                ['freeCancellation','Besplatno otkazivanje'],
                ['instantBooking','Instant rezervacija'],
                ['taxesIncluded','Uključene takse i PDV'],
              ].map(([k,label])=> (
                <label key={k} className="check-pill" style={{display:'flex',alignItems:'center',gap:6,fontSize:14}}>
                  <input type="checkbox" checked={!!data.flags[k]} onChange={e=>updateField(`flags.${k}`, e.target.checked)} /> {label}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="form-message" style={{color:'#c00'}}>{error}</p>}
          {okMsg && <p className="form-message" style={{color:'#0a0'}}>{okMsg}</p>}
          <div style={{marginTop:12, display:'flex', gap:12}}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving? 'Spašavanje…':'Sačuvaj'}</button>
            <button type="button" className="btn" onClick={()=>{
              // force reload
              setLoading(true);
              setTimeout(()=>{
                setLoading(false);
              },200);
            }}>Osvježi</button>
          </div>
        </>
      )}
    </form>
  );
}
