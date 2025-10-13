import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { http, initCSRF } from "../api/http";
import { jwtDecode } from "jwt-decode";


const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const refreshTimer = useRef(null);
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);

  const scheduleRefresh = (token) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (!token) return;
    try {
      const { exp } = jwtDecode(token); // seconds
      const msUntilExp = exp * 1000 - Date.now();
      const when = Math.max(msUntilExp - 60_000, 5_000); // 60s prije isteka
      refreshTimer.current = setTimeout(refresh, when);
    } catch { /* ignore */ }
  };

  async function login(email, password) {
    const { data } = await http.post("/auth/login", { email, password });
    setAccessToken(data.accessToken);
    scheduleRefresh(data.accessToken);
    try { await loadMe(data.accessToken); } catch {}
    return data.user;
  }

  async function refresh() {
    const { data } = await http.post("/auth/refresh");
    setAccessToken(data.accessToken);
    scheduleRefresh(data.accessToken);
    try { await loadMe(data.accessToken); } catch {}
    return true;
  }

  async function logout() {
    try { await http.post("/auth/logout"); } catch {}
    setAccessToken(null);
  setMe(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }

  async function register(payload) {
    await http.post("/auth/register", payload);
    // UX: poruka na UI da provjeri mail
  }

  async function requestPasswordReset(email) {
    await http.post("/auth/request-password-reset", { email });
  }

  async function resetPassword(email, token, newPassword) {
    await http.post("/auth/reset-password", { email, token, newPassword });
  }

  async function resendVerify(email) {
    await http.post("/auth/resend-verify", { email });
  }

  // Load current user when we have AT
  async function loadMe(tokenOverride) {
    const token = tokenOverride || accessToken;
    if (!token) { setMe(null); return null; }
    try {
      const { data } = await http.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMe(data);
      return data;
    } catch {
      setMe(null);
      return null;
    }
  }

  // CSRF token init on mount and try to refresh session
  useEffect(() => {
    (async () => {
      await initCSRF();
      try { await refresh(); } catch (_) { /* nema RT cookie-ja ili istekao */ }
  setReady(true); // signal Protected-u da može odlučivati
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Authorization header za sve pozive koji traže AT:
  useEffect(() => {
    const id = http.interceptors.request.use((config) => {
      if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
      return config;
    });
    return () => http.interceptors.request.eject(id);
  }, [accessToken]);

  const value = useMemo(() => ({
    accessToken, me, ready,
    login, refresh, logout, loadMe,
    register, requestPasswordReset, resetPassword, resendVerify
  }), [accessToken, me, ready]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
