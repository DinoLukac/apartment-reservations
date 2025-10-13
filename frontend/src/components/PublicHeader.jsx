import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context.jsx'

export default function PublicHeader(){
  const loc = useLocation()
  const [menuOpen,setMenuOpen] = useState(false)
  const is = (p) => loc.pathname === p
  const { accessToken, me } = useAuth()
  const role = me?.role || 'guest'

  return (
    <header className='hdr' id='public-header'>
      {/* Utility bar */}
      <div className='hdr-util'>
        <div className='hdr-container'>
          <div className='util-left'>
            <a href='tel:+38267524041' aria-label='Pozovi telefonom +382 67 524 041' className='util-link'>
              <span className='icon'>📞</span><span className='txt hide-sm'>+382 67 524 041</span>
            </a>
            <a href='mailto:info00@Apartmani.com' aria-label='Pošalji email info00@Apartmani.com' className='util-link'>
              <span className='icon'>✉️</span><span className='txt hide-sm'>info00@Apartmani.com</span>
            </a>
          </div>
          <div className='util-right'>
            <button type='button' className='util-btn hide-xs' aria-label='Promijeni jezik'>🌐 <span className='txt'>EN</span></button>
            <button type='button' className='util-btn hide-xs' aria-label='Promijeni jezik'>🅱 <span className='txt'>BOS</span></button>
            <button type='button' className='util-btn hide-xs' aria-label='Promijeni valutu'>€ <span className='txt'>EUR</span></button>
            <a href='https://wa.me/38267524041' target='_blank' rel='noreferrer' aria-label='Otvori WhatsApp chat' className='wa-btn'>WhatsApp</a>
          </div>
        </div>
      </div>
      {/* Main nav */}
      <div className='hdr-main'>
        <div className='hdr-container main-flex'>
          <div className='left'>
            <Link to='/' className='brand' aria-label='Početna'>Apartmani</Link>
            <nav className={'main-nav ' + (menuOpen? 'open':'')}>              
              {(accessToken && role === 'owner') ? (
                <Link to='/dashboard' className={is('/dashboard')? 'active':''}>Dashboard</Link>
              ) : (
                <Link to='/register' className={is('/register')? 'active':''}>Dashboard</Link>
              )}
              <Link to='/partner' onClick={(e)=>{e.preventDefault(); if(loc.pathname!== '/register') window.location.href='/register';}}>Postani partner</Link>
              <Link to='/about' className={is('/about')? 'active':''}>O nama</Link>
            </nav>
          </div>
          <div className='right'>
            <button className='icon-btn fav-btn hide-sm' aria-label='Sačuvano'>♡</button>
            <Link to='/reservations' className='btn outline hide-xs' aria-label='Moje rezervacije'>Moje rezervacije</Link>
            {!is('/login') && (
              <Link to='/login' className='btn primary' aria-label='Prijava'>Prijava</Link>
            )}
            {!is('/register') && (
              <Link to='/register' className='btn outline' aria-label='Registracija'>Registracija</Link>
            )}
          </div>
          <button className='hamb' aria-label='Otvori meni' onClick={()=> setMenuOpen(o=>!o)}>
            <span/><span/><span/>
          </button>
        </div>
      </div>
    </header>
  )
}
