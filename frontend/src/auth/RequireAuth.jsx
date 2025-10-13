import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/auth-context.jsx"

export default function RequireAuth({ children }) {
  const { accessToken, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <div className="boot" id="boot">Učitavanje…</div>
  if (!accessToken) return <Navigate to="/login" state={{ from: loc }} replace />
  return children
}