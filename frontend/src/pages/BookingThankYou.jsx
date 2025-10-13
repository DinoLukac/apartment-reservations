import { useParams, useLocation, Link } from "react-router-dom";
import { useEffect } from 'react';

export default function BookingThankYou() {
  const { code } = useParams();
  const { state } = useLocation();
  // When navigating we stored state with reservation summary directly, fallback to {} if absent.
  const s = state || {};

  useEffect(()=>{
    if(s.guestEmail){
      try { localStorage.setItem('guestEmail', s.guestEmail) } catch {}
    }
  }, [s.guestEmail])

  return (
    <main className="page thanks" id="booking-thanks">
      <div className="thanks-content">
        <h1>Hvala na rezervaciji!</h1>
        <p>Rezervacija je uspješno kreirana.</p>
        <div className="thanks-box">
          <p><b>Šifra rezervacije:</b> {code}</p>
          {s.checkIn && s.checkOut && (
            <p><b>Datumi:</b> {String(s.checkIn).slice(0,10)} → {String(s.checkOut).slice(0,10)} ({s.nights} noći)</p>
          )}
          {s.total && <p><b>Ukupno:</b> {s.currency} {s.total}</p>}
        </div>
        <p>Email sa detaljima i .ics kalendar pozivom je poslat (ako ne vidiš – provjeri spam folder).</p>
        <div className="thanks-actions">
          {/* <button className="btn" disabled>Dodaj u Google kalendar (uskoro)</button> */}
          <Link to="/reservations" className="btn secondary">Moje rezervacije</Link>
          <Link to="/" className="btn">Početna</Link>
        </div>
      </div>
    </main>
  );
}
