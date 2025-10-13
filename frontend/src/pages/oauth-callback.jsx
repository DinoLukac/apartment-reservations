import { useEffect, useState } from "react";
import { useAuth } from "../context/auth-context.jsx";
import { useNavigate } from "react-router-dom";

export default function OAuthCallbackPage() {
  const { refresh } = useAuth();
  const [msg, setMsg] = useState("Dovršavam prijavu…");
  const nav = useNavigate();

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    if (qp.get("link_email") === "1") {
      // preusmjeri na formu za unos emaila
      const state = qp.get("state") || "";
      window.location.replace(`/link-email?state=${encodeURIComponent(state)}`);
      return;
    }

    (async () => {
      try {
        await refresh(); // uzmi AT putem RT cookie
        setMsg("Prijava uspjela. Prebacujem na dashboard…");
        nav("/dashboard", { replace: true });
      } catch (e) {
        setMsg("Neuspjelo dovršavanje prijave. Pokušaj klasičan login.");
      }
    })();
  }, []);

  return (
    <div className="page oauth-callback" id="oauth-callback">
      <h1 className="page-title">Prijava</h1>
      <p className="status" id="oauth-status">{msg}</p>
    </div>
  );
}
