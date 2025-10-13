import { Outlet, Link } from "react-router-dom"
import { useAuth } from "../context/auth-context.jsx"
import { useEffect, useRef, useState } from "react"

export default function DashboardLayout() {
  const { me, logout } = useAuth()
  const displayName = me?.name || me?.email || "Korisnik"
  const initial = (displayName).trim()[0]?.toUpperCase() || "?"
  const isGoogle = (me?.provider === 'google')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(()=>{
    const onDocClick = (e)=>{
      if(!menuRef.current) return
      if(!menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return ()=> document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <div className="layout dashboard-layout" id="dashboard-layout">
      <header className="site-header dash-header" id="dashboard-header">
        <div className="dash-container">
          <div className="dash-left">
            <Link className="nav-logo" to="/">Apartmani</Link>
            <nav className="dash-links">
              <Link className="dash-link" to="/dashboard">Dashboard</Link>
              <Link className="dash-link" to="/onboarding">Dodaj smještaj</Link>
            </nav>
          </div>
          <div className="dash-right" ref={menuRef}>
            <button className="avatar-btn" aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=> setMenuOpen(v=>!v)}>
              <div className={`avatar ${isGoogle ? 'google' : 'local'}`} aria-label="Korisnički avatar">
              {isGoogle ? (
                // Google 'G' svg unutar kruga
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24" aria-hidden="true">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.149,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24 s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.818C14.39,16.108,18.83,12,24,12c3.059,0,5.842,1.149,7.961,3.039l5.657-5.657 C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.197l-6.191-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.616-3.317-11.278-7.946l-6.5,5.012C8.027,39.556,15.477,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-3.994,5.565 c0.001-0.001,0.002-0.001,0.003-0.002l6.191,5.238C36.876,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
              ) : (
                <span className="initial" aria-hidden="true">{initial}</span>
              )}
              </div>
            </button>
            <span className="user-name" id="user-name">{displayName}</span>
            <div className={`user-menu ${menuOpen ? 'open' : ''}`} role="menu">
              <button className="menu-item" onClick={()=> setMenuOpen(false)} role="menuitem">Profil (uskoro)</button>
              <button className="menu-item danger" onClick={logout} role="menuitem">Odjava</button>
            </div>
          </div>
        </div>
      </header>
      <main className="site-main" id="dashboard-main">
        <Outlet />
      </main>
    </div>
  )
}
