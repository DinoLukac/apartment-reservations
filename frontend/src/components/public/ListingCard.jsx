import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

export default function ListingCard({ item }) {
  const images = useMemo(() => {
    const g = Array.isArray(item.gallery) ? item.gallery.filter(Boolean) : [];
    const cover = item.cover && !g.includes(item.cover) ? [item.cover] : [];
    const arr = [...cover, ...g];
    return arr.length ? arr : [""];
  }, [item.cover, item.gallery]);

  const [idx, setIdx] = useState(0);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const city = item.address?.city || "";
  const id = item.id || item.propertyId || item.slug || "x";

  const activeBadges = [];
  if (item.flags?.family) activeBadges.push(['Porodično','default']);
  if (item.flags?.nearBeach) activeBadges.push(['Blizu plaže','default']);
  if (item.flags?.petFriendly) activeBadges.push(['Pet friendly','default']);
  if (item.flags?.freeCancellation) activeBadges.push(['Besplatno otkazivanje','accent']);
  if (item.flags?.instantBooking) activeBadges.push(['Instant rezervacija','primary']);
  if (item.flags?.taxesIncluded) activeBadges.push(['Uključene takse i PDV','default']);
  const metaLine = [item.meta?.city || city, item.meta?.distanceToBeachMeters ? `${item.meta.distanceToBeachMeters}m do plaže` : ''].filter(Boolean).join(' • ');

  return (
    <article className="card listing-card" id={`listing-${id}`}>
      {/* IMAGE / SLIDER */}
      <div className="listing-media" id={`slider-${id}`}>
        {images.map((src, i) => (
          <img
            key={i}
            className={`listing-img ${i === idx ? 'is-active' : ''}`}
            id={`slide-${id}-${i}`}
            src={src}
            alt={item.name}
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
        {images.length > 1 && (
          <>
            <button className="slide-arrow prev" id={`prev-${id}`} onClick={prev} aria-label="Prethodna slika">‹</button>
            <button className="slide-arrow next" id={`next-${id}`} onClick={next} aria-label="Sljedeća slika">›</button>
          </>
        )}
        <button className="slide-label" id={`label-${id}`} type="button" onClick={() => console.log("open details:", item)}>{item.name}</button>
      </div>

      {/* BODY */}
      <div className="listing-body">
        <div className="listing-main">
          <h3 className="listing-title">{item.name}</h3>
          <div className="listing-meta">{metaLine || city}</div>
          {activeBadges.length > 0 && (
            <div className="listing-badges">
              {activeBadges.map(([b, kind]) => (
                <span key={b} className={`pill pill-${kind}`}>{b}</span>
              ))}
            </div>
          )}
          <div className="listing-availability" aria-label="Dostupnost narednih dana">
            {(item.availNext30 || []).slice(0, 14).map((ok, i) => (
              <span key={i} className={`dot ${ok ? 'free' : 'busy'}`} id={`dot-${item.id || item.propertyId}-${i}`}></span>
            ))}
          </div>
        </div>
        <div className="listing-footer">
          <p className="listing-price"><span className="price-from">od {item.priceMin}€</span><span className="price-unit"> / noć</span></p>
          {(() => {
            const unitId = item.units?.[0]?.id || item.units?.[0]?._id
            if (!unitId) {
              return (
                <button className="btn btn-primary" id={`btn-reserve-${item.id || item.propertyId}`} disabled title="Nema dostupnih apartmana">Rezerviši</button>
              )
            }
            return (
              <Link className="btn btn-primary" id={`btn-reserve-${item.id || item.propertyId}`} to={`/book/${item.propertyId || item.id}/${unitId}`}>
                Rezerviši
              </Link>
            )
          })()}
        </div>
      </div>
    </article>
  );
}
