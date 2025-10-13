import { Outlet, useLocation } from "react-router-dom"
import PublicHeader from "../components/PublicHeader.jsx"
import SiteFooter from "../components/SiteFooter.jsx"

export default function PublicLayout() {
  const loc = useLocation()
  const showFooter = loc.pathname === '/'
  return (
    <div className="layout" id="public-layout">
      <PublicHeader />
      <main id="public-main" style={{flex:1, paddingTop: 'var(--header-h)'}}>
        <Outlet />
      </main>
      {showFooter ? <SiteFooter /> : null}
    </div>
  )
}
