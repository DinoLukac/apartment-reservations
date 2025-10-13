import { useEffect } from "react";
import { useAuth } from "../context/auth-context.jsx";
import { useNavigate } from "react-router-dom";

export default function VerifiedPage() {
  const { refresh } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try { await refresh(); } catch {}
      nav("/dashboard", { replace: true });
    })();
  }, []);

  return (
    <div className="page verified-page" id="verified-page">
      <h1 className="page-title" id="verified-title">Email je verifikovan</h1>
      <p className="text" id="verified-text">Prijavljujem te i prebacujem na kontrolnu tablu…</p>
    </div>
  );
}
