import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/auth-context.jsx"

export default function RequireOwner({ children }) {
  const { accessToken, ready, me } = useAuth()
  const loc = useLocation()
  if (!ready) return <div className="boot" id="boot">Učitavanje…</div>
  if (!accessToken) return <Navigate to="/register" state={{ from: loc }} replace />
  const role = me?.role || "owner"
  if (role !== "owner") return <Navigate to="/register" state={{ from: loc }} replace />
  return children
}
