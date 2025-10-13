import { useState } from "react";
import { http, propertyApi } from "../api/http";
import { useNavigate } from "react-router-dom";

export default function OnboardingPage() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("");

  // Objekt
  const [name, setName] = useState("");
  const [amenities, setAmenities] = useState([]);
  const [country, setCountry] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [line1, setLine1] = useState("");
  const [timezone, setTimezone] = useState("Europe/Podgorica");

  // Units
  const [unitsCount, setUnitsCount] = useState(1);
  const [units, setUnits] = useState([
    { name: "Apartman 1", bedrooms: 0, beds: 0, pricePerNight: 0, icalUrl: "" },
  ]);

  // Photos (lokalno + URL import) – metadata + base64 (MVP)
  const [files, setFiles] = useState([]); // [{file?, name, size, type, order, previewUrl, dataUrl?, url?, source}]
  const [remoteUrl, setRemoteUrl] = useState("");

  // Prefer server-side compression: upload binaries to /uploads/images and receive dataUrl webp
  const uploadToServer = async (files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("photos", f, f.name));
    const { data } = await http.post("/uploads/images", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      maxBodyLength: Infinity,
    });
    if (data?.images) return data.images;
    return [];
  };

  const addLocalFiles = async (list) => {
    const accepted = list
      .filter(f => /image\/(jpeg|png|webp)/.test(f.type))
      .slice(0, 24 - files.length);
    // Send to backend for compression and return compact dataUrls (webp)
    const processed = await uploadToServer(accepted).catch(() => []);
    const withData = processed.map((img, i) => ({
      file: null,
      name: img.name || accepted[i]?.name || `photo-${i}`,
      size: img.size || accepted[i]?.size || 0,
      type: img.type || "image/webp",
      order: files.length + i,
      previewUrl: img.dataUrl,
      dataUrl: img.dataUrl,
      source: "upload"
    }))
    setFiles(prev => [...prev, ...withData]);
  };

  const onDrop = async (ev) => {
    ev.preventDefault();
    await addLocalFiles(Array.from(ev.dataTransfer.files || []));
  };
  const onPick = async (e) => {
    await addLocalFiles(Array.from(e.target.files || []));
    e.target.value = ""; // allow picking same file again
  };
  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const addRemoteUrl = () => {
    const u = (remoteUrl || "").trim();
    if (!u) return;
    setFiles(prev => [...prev, {
      file: null,
      name: u.split("/").pop() || "remote",
      size: 0,
      type: "image/remote",
      order: prev.length,
      previewUrl: u,
      dataUrl: null,
      url: u,
      source: "url"
    }]);
    setRemoteUrl("");
  };

  // Prepare photos meta for backend (respect schema: name,size,type,order,source,url?,dataUrl?)
  const photosMeta = files.map((x, i) => {
    const meta = {
      name: x.name || x.file?.name || `photo-${i}`,
      size: x.size || x.file?.size || 0,
      type: x.type || x.file?.type || "image/unknown",
      order: i,
      source: x.source || (x.file ? "local" : (x.url ? "url" : "unknown"))
    };
    if (x.url) meta.url = x.url;
    if (x.dataUrl) meta.dataUrl = x.dataUrl;
    return meta;
  });

  // Modal info nakon snimanja
  const [savedInfo, setSavedInfo] = useState(null); // retained but no longer used for modal here

  const resizeUnits = (n) => {
    const x = parseInt(n || 0, 10);
    if (x < 1) return;
    setUnitsCount(x);
    setUnits((prev) => {
      const next = [...prev];
      while (next.length < x)
        next.push({ name: `Apartman ${next.length + 1}`, bedrooms: 0, beds: 0, pricePerNight: 0, icalUrl: "" });
      while (next.length > x) next.pop();
      return next;
    });
  };

  const updateUnit = (i, patch) => {
    setUnits((u) => u.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const canSave =
    name.trim().length >= 3 && country && municipality && line1 && timezone && units.length >= 1;

  const onSave = async () => {
    setMsg("");
    if (!canSave) {
      setMsg("Popuni obavezna polja.");
      return;
    }
    try {
      const photosPayload = files.slice(0,24).map((x,i)=>({
        name: x.name || `photo-${i}`,
        size: x.size || 0,
        type: x.type || "image/webp",
        order: i,
        source: x.url ? "url" : "upload",
        url: x.url || null,
        dataUrl: x.dataUrl || null
      }));

      const payload = {
        name, amenities,
        address: { country, municipality, line1 },
        timezone,
        units,
        photos: photosPayload,
        sync: true
      };
      const { data } = await propertyApi.saveFull(payload);
      // Vizuelni feedback + redirect
      setMsg("✔️ Sačuvano")
      nav(`/dashboard?property=${data.id}`, {
        replace: true,
        state: {
          postSave: {
            propertyId: data.id,
            name,
            photos: files.map(f => f.previewUrl),
            units
          }
        }
      });
    } catch (e) {
      const emsg = e?.response?.data?.error || e?.message || "Greška pri čuvanju smještaja";
      setMsg(emsg);
    }
  };

  return (
    <div className="page onboarding" id="onboarding">
  <h1 className="page-title">Dodaj smještaj (nacrt)</h1>

      <section className="card" id="ob-object">
        <h2>Osnovno</h2>
        <div className="form-grid">
          <label>
            Naziv
            <input
              id="prop-name"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Pogodnosti (zarez)
            <input
              id="prop-amenities"
              className="form-input"
              value={amenities.join(",")}
              onChange={(e) =>
                setAmenities(
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
            />
          </label>
        </div>
      </section>

      <section className="card" id="ob-location">
        <h2>Lokacija</h2>
        <div className="form-grid">
          <label>
            Država
            <input
              id="addr-country"
              className="form-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </label>
          <label>
            Opština
            <input
              id="addr-muni"
              className="form-input"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
            />
          </label>
          <label>
            Adresa
            <input
              id="addr-line1"
              className="form-input"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
            />
          </label>
          <label>
            Vremenska zona
            <input
              id="addr-tz"
              className="form-input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card" id="ob-units">
        <h2>Apartmani</h2>
        <div className="form-grid">
          <label>
            Broj apartmana
            <input
              id="units-count"
              className="form-input"
              type="number"
              min="1"
              value={unitsCount}
              onChange={(e) => resizeUnits(e.target.value)}
            />
          </label>
        </div>

        <div className="units-list" id="units-list">
          {units.map((u, i) => (
            <div key={i} className="unit-row" id={`unit-${i}`}>
              <h3 className="unit-title">{u.name}</h3>
              <div className="form-grid">
                <label>
                  Naziv
                  <input
                    className="form-input"
                    value={u.name}
                    onChange={(e) => updateUnit(i, { name: e.target.value })}
                  />
                </label>
                <label>
                  Sobe
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={u.bedrooms}
                    onChange={(e) =>
                      updateUnit(i, { bedrooms: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Kreveta
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={u.beds}
                    onChange={(e) =>
                      updateUnit(i, { beds: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Cijena/noć (EUR)
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={u.pricePerNight}
                    onChange={(e) =>
                      updateUnit(i, {
                        pricePerNight: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  iCal URL
                  <input
                    className="form-input"
                    placeholder="https://..."
                    value={u.icalUrl}
                    onChange={(e) => updateUnit(i, { icalUrl: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="ob-photos">
        <h2>Fotografije</h2>

        <div className="uploader" id="photo-uploader">
          <div className="dropzone" id="photo-drop"
               onDragOver={(e)=>e.preventDefault()}
               onDrop={onDrop}>
            <p>Prevuci slike ovdje ili <label className="link">
              <input id="photo-input" type="file"
                     accept="image/jpeg,image/png,image/webp"
                     multiple onChange={onPick} hidden/>
              odaberi sa računara
            </label></p>
            <p className="hint">Do 24 fotografije. Tip: jpg/png/webp.</p>
          </div>

          <div className="cloud-import" id="photo-cloud">
            <label>Uvezi iz URL-a (Drive/Dropbox/OneDrive)
              <input className="form-input" id="photo-url" placeholder="https://…"
                     value={remoteUrl} onChange={e=>setRemoteUrl(e.target.value)} />
            </label>
            <button className="btn" id="btn-add-url" type="button" onClick={addRemoteUrl}>Dodaj URL</button>
          </div>
        </div>

        <div className="thumbs" id="photo-thumbs">
          {files.map((x,i)=>(
            <div key={i} className="thumb" id={`thumb-${i}`}>
              <img
                src={x.previewUrl || x.url}
                alt={x.name}
                width="140" height="100" loading="lazy" />
              <div className="thumb-meta">
                <span className="thumb-name">{x.name}</span>
                <button className="btn btn-small" id={`btn-del-${i}`} type="button" onClick={()=>removeFile(i)}>Ukloni</button>
              </div>
            </div>
          ))}
          {files.length === 0 && <p className="hint">Još nema fotografija.</p>}
        </div>
      </section>

      <div className="form-actions" id="ob-actions">
        <button
          className="btn btn-primary"
          id="btn-save-all"
          disabled={!canSave}
          onClick={onSave}
        >
          Sačuvaj
        </button>
      </div>

      {msg && (
        <p className="form-message" id="onboarding-message">
          {msg}
        </p>
      )}
    </div>
  )
}
