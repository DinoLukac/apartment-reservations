import { Link } from "react-router-dom";
import { useAuth } from "../context/auth-context.jsx";

function Avatar({ name, email }) {
  const txt = (name || email || "?").trim();
  const initial = txt[0]?.toUpperCase() || "?";
  return <div className="avatar" id="avatar">{initial}</div>;
}

export default function Navbar() {
  const { accessToken, me, logout } = useAuth();
  return (
    <header className="navbar" id="navbar">
      <nav className="nav-inner" id="nav-inner">
        <Link to="/" className="nav-brand" id="nav-brand">Apartmani</Link>
        <div className="nav-links" id="nav-links">
          <Link to="/map" className="btn" id="btn-nav-map">Mapa</Link>
          {!accessToken ? (
            <>
              <Link to="/register" className="btn" id="btn-nav-register">Register</Link>
              <Link to="/login" className="btn" id="btn-nav-login">Login</Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="btn" id="btn-nav-dashboard">Dashboard</Link>
              <Link to="/onboarding" className="btn" id="btn-nav-onboarding">Dodaj smještaj</Link>
              <div className="user-box" id="user-box">
                <Avatar name={me?.name} email={me?.email} />
                <span className="user-name" id="user-name">{me?.name || me?.email}</span>
              </div>
              <button className="btn" id="btn-nav-logout" onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
