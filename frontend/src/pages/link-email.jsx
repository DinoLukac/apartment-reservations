import { useEffect, useState } from "react";
import { http } from "../api/http";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context.jsx";

export default function LinkEmailPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setState(qs.get("state") || "");
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await http.post("/auth/oauth/link-email", { state, email });
      await refresh(); // povuci AT
      nav("/dashboard", { replace: true });
    } catch (err) {
      setMsg(err?.response?.data?.error || "Neuspješno linkovanje emaila");
    }
  };

  return (
    <div className="page link-email" id="link-email">
      <h1 className="page-title">Poveži email</h1>
      <p>Facebook nije vratio email. Unesi email da dovršiš prijavu.</p>
      <form className="form" id="link-email-form" onSubmit={onSubmit}>
        <div className="form-field" id="ff-email">
          <label className="form-label" htmlFor="link-email-input">Email</label>
          <input className="form-input" id="link-email-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="form-actions" id="link-email-actions">
          <button className="btn btn-primary" id="btn-link-email" type="submit">Poveži</button>
        </div>
      </form>
      {msg && <p className="form-message" id="link-email-message">{msg}</p>}
    </div>
  );
}
