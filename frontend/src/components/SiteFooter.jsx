import { Link } from 'react-router-dom'

export default function SiteFooter(){
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer" id="public-footer" role="contentinfo">
      <div className="ft-wrap">
        <div className="ft-col brand">
          <div className="ft-logo">Apartmani</div>
          <p className="ft-tag">Smještaj na Jadranu — pouzdano i brzo.</p>
          <div className="ft-social">
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook" title="Facebook">𝔽</a>
            <a href="https://www.instagram.com/apartmani_donji_stoj/" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram">🅸</a>
            <a href="https://wa.me/38267524041" target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp">🟢</a>
          </div>
        </div>
        <div className="ft-col links">
          <h4>Linkovi</h4>
          <ul>
            <li><Link to="/about">O nama</Link></li>
            <li><Link to="/search">Pretraga</Link></li>
            <li><Link to="/register">Postani partner</Link></li>
            <li><Link to="/reservations">Moje rezervacije</Link></li>
          </ul>
        </div>
        <div className="ft-col contact">
          <h4>Kontakt</h4>
          <ul>
            <li>📞 +382 67 524 041</li>
            <li>✉️ info00@Apartmani.com</li>
            <li>📍 Ulcinj, Crna Gora</li>
          </ul>
        </div>
        <div className="ft-col legal">
          <h4>Pravne informacije</h4>
          <ul>
            <li><Link to="/terms" onClick={(e)=>e.preventDefault()}>Uslovi korišćenja</Link></li>
            <li><Link to="/privacy" onClick={(e)=>e.preventDefault()}>Privatnost</Link></li>
            <li><Link to="/cookies" onClick={(e)=>e.preventDefault()}>Kolačići</Link></li>
          </ul>
        </div>
      </div>
      <div className="ft-bottom">© {year} Apartmani — Sva prava zadržana.</div>
    </footer>
  )
}
