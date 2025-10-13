import { useState } from "react";
import { useAuth } from "../context/auth-context.jsx";
import { useLocation, useNavigate, Link } from "react-router-dom";
import SocialOAuthButtons from "../components/SocialOAuthButtons.jsx";

export default function LoginPage() {
  const api = import.meta.env.VITE_API_URL;
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const nav = useNavigate();
  const loc = useLocation();

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await login(email, password);
      nav(loc.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const text = err?.response?.data?.error
        || (status === 429 ? "Previše pokušaja. Pokušaj za minut." : "Greška pri prijavi");
      setMsg(text);
    }
  };

  return (
    <div className="page login-page" id="login-page">
      <h1 className="page-title" id="login-title">Prijava</h1>
      <form className="form" id="login-form" onSubmit={onSubmit}>
        <div className="form-field" id="ff-email">
          <label className="form-label" htmlFor="login-email-input">Email</label>
          <input className="form-input" id="login-email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="form-field" id="ff-password">
          <label className="form-label" htmlFor="login-password-input">Lozinka</label>
          <input className="form-input" id="login-password-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <div className="form-actions" id="login-actions">
          <button className="btn btn-primary" id="btn-login" type="submit">Login</button>
          <Link to="/request-password-reset" id="link-forgot" className="btn btn-link">Zaboravljena lozinka?</Link>
        </div>
      </form>
      <SocialOAuthButtons onSuccess={()=> nav(loc.state?.from?.pathname || "/dashboard", { replace:true })} />
      {msg && <p className="form-message" id="login-message">{msg}</p>}
    </div>
  );
}
