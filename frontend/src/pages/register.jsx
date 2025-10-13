import { useState } from "react";
import { useAuth } from "../context/auth-context.jsx";
import SocialOAuthButtons from "../components/SocialOAuthButtons.jsx";

export default function RegisterPage() {
  const api = import.meta.env.VITE_API_URL;
  const { register, resendVerify } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await register({ email, password, name });
      setMsg("Ako postoji nalog, poslat je verifikacioni email. Provjeri inbox.");
    } catch (e) {
      const status = e?.response?.status;
      const text = e?.response?.data?.error
        || (status === 429 ? "Previše pokušaja. Pokušaj za minut." : "Greška pri registraciji");
      setMsg(text);
    }
  };

  const onResend = async () => {
    try {
      await resendVerify(email);
      setMsg("Ako nalog postoji i nije verifikovan, poslali smo novi verifikacioni email.");
    } catch {
      setMsg("Pokušaj ponovo.");
    }
  };

  return (
    <div className="page register-page" id="register-page">
      <h1 className="page-title" id="register-title">Registracija</h1>
      <form className="form" id="register-form" onSubmit={onSubmit}>
        <div className="form-field" id="ff-name">
          <label className="form-label" htmlFor="name-input">Ime</label>
          <input className="form-input" id="name-input" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div className="form-field" id="ff-email">
          <label className="form-label" htmlFor="email-input">Email</label>
          <input className="form-input" id="email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="form-field" id="ff-password">
          <label className="form-label" htmlFor="password-input">Lozinka</label>
          <input className="form-input" id="password-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <div className="form-actions" id="register-actions">
          <button className="btn btn-primary" id="btn-register" type="submit">Registruj</button>
          <button className="btn btn-link" id="btn-resend-verify" type="button" onClick={onResend}>Pošalji verifikaciju ponovo</button>
        </div>
      </form>
      <SocialOAuthButtons />
      {msg && <p className="form-message" id="register-message">{msg}</p>}
    </div>
  );
}
