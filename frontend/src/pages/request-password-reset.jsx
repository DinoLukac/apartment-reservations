import { useState } from "react";
import { useAuth } from "../context/auth-context.jsx";

export default function RequestResetPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await requestPasswordReset(email);
      setMsg("Ako postoji nalog, poslali smo email sa uputstvima za promjenu lozinke.");
    } catch (err) {
      const status = err?.response?.status;
      setMsg(status === 429 ? "Previše zahtjeva. Pokušaj za minut." : "Pokušaj ponovo kasnije.");
    }
  };

  return (
    <div className="page request-reset-page" id="request-reset-page">
      <h1 className="page-title" id="request-reset-title">Zahtjev za promjenu lozinke</h1>
      <form className="form" id="request-reset-form" onSubmit={onSubmit}>
        <div className="form-field" id="ff-email">
          <label className="form-label" htmlFor="request-reset-email">Email</label>
          <input className="form-input" id="request-reset-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="form-actions" id="request-reset-actions">
          <button className="btn btn-primary" id="btn-request-reset" type="submit">Pošalji</button>
        </div>
      </form>
      {msg && <p className="form-message" id="request-reset-message">{msg}</p>}
    </div>
  );
}
