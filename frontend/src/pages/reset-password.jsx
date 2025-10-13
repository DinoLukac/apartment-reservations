import { useEffect, useState } from "react";
import { useAuth } from "../context/auth-context.jsx";

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    setEmail(qp.get("email") || "");
    setToken(qp.get("token") || "");
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await resetPassword(email, token, newPassword);
      setMsg("Lozinka promijenjena. Sada se možeš prijaviti novom lozinkom.");
    } catch (err) {
      setMsg(err?.response?.data?.error || "Greška pri promjeni lozinke");
    }
  };

  return (
    <div className="page reset-password-page" id="reset-password-page">
      <h1 className="page-title" id="reset-password-title">Nova lozinka</h1>
      <form className="form" id="reset-password-form" onSubmit={onSubmit}>
        <div className="form-field" id="ff-email">
          <label className="form-label" htmlFor="reset-email-input">Email</label>
          <input className="form-input" id="reset-email-input" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="form-field" id="ff-token">
          <label className="form-label" htmlFor="reset-token-input">Token</label>
          <input className="form-input" id="reset-token-input" value={token} onChange={e=>setToken(e.target.value)} required />
        </div>
        <div className="form-field" id="ff-newpass">
          <label className="form-label" htmlFor="reset-password-input">Nova lozinka</label>
          <input className="form-input" id="reset-password-input" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required />
        </div>
        <div className="form-actions" id="reset-password-actions">
          <button className="btn btn-primary" id="btn-reset-password" type="submit">Promijeni lozinku</button>
        </div>
      </form>
      {msg && <p className="form-message" id="reset-password-message">{msg}</p>}
    </div>
  );
}
