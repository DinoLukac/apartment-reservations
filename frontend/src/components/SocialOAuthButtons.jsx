import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/auth-context.jsx'

export default function SocialOAuthButtons({ onSuccess, onError }){
  const api = import.meta.env.VITE_API_URL
  const FLOW_ENV = import.meta.env.VITE_OAUTH_FLOW // 'redirect' | 'sdk'
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID
  const GOOGLE_CALLBACK = import.meta.env.VITE_GOOGLE_OAUTH_CALLBACK || `${api}/auth/oauth/google/callback`
  const FACEBOOK_CALLBACK = import.meta.env.VITE_FACEBOOK_OAUTH_CALLBACK || `${api}/auth/oauth/facebook/callback`

  const gContainerRef = useRef(null)
  const fbContainerRef = useRef(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState({ g:false, f:false })
  const csrfRef = useRef('')
  const { refresh } = useAuth()

  // Helper to load external script once
  function loadScript(src, id){
    return new Promise((resolve, reject)=>{
      if(document.getElementById(id)) return resolve()
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.defer = true
      s.id = id
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }

  // POST helper with credentials
  async function ensureCsrf(){
    if (csrfRef.current) return csrfRef.current
    try{
      const r = await fetch(`${api}/csrf`, { credentials:'include' })
      const data = await r.json().catch(()=> ({}))
      if (data && data.csrfToken) csrfRef.current = data.csrfToken
    }catch{}
    return csrfRef.current
  }

  async function postJSON(url, body){
    const token = await ensureCsrf()
    const headers = { 'Content-Type':'application/json' }
    if (token) headers['X-CSRF-Token'] = token
    const res = await fetch(url, { method:'POST', headers, credentials:'include', body: JSON.stringify(body) })
    if(!res.ok){
      const t = await res.text().catch(()=> '')
      throw new Error(t || `HTTP ${res.status}`)
    }
    return res.json().catch(()=> ({}))
  }

  const useSdk = (FLOW_ENV ? FLOW_ENV === 'sdk' : (GOOGLE_CLIENT_ID || FB_APP_ID))

  useEffect(()=>{
    if(!useSdk) return // Skip SDK path when using redirect/default without IDs
    let unsubFB
    // GOOGLE
    if(GOOGLE_CLIENT_ID){
      loadScript('https://accounts.google.com/gsi/client', 'google-gis')
        .then(()=>{
          if(!window.google || !window.google.accounts || !gContainerRef.current) return
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (response)=>{
              try{
                setLoading(s=>({...s,g:true}))
                await postJSON(GOOGLE_CALLBACK, { credential: response.credential })
                // nakon server callback-a uzmi AT putem refresh-a pa tek onda nav
                try{ await refresh() } catch {}
                setLoading(s=>({...s,g:false}))
                onSuccess?.('google')
              }catch(e){ setLoading(s=>({...s,g:false})); setErr('Google prijava nije uspjela'); onError?.(e) }
            },
          })
          window.google.accounts.id.renderButton(gContainerRef.current, {
            type:'standard', theme:'outline', size:'large', shape:'rectangular', text:'continue_with', logo_alignment:'left', width: 380
          })
        })
        .catch(()=> setErr('Ne može se učitati Google SDK'))
    }

    // FACEBOOK
    if(FB_APP_ID){
      // Inject FB root once
      if(!document.getElementById('fb-root')){
        const fbRoot = document.createElement('div'); fbRoot.id = 'fb-root'; document.body.appendChild(fbRoot)
      }
      loadScript('https://connect.facebook.net/en_US/sdk.js', 'facebook-jssdk')
        .then(()=>{
          window.FB?.init({ appId: FB_APP_ID, cookie: true, xfbml: true, version: 'v19.0' })
          // Render official button via XFBML
          if(fbContainerRef.current){
            fbContainerRef.current.innerHTML = '<div class="fb-login-button" data-size="large" data-button-type="continue_with" data-layout="default" data-auto-logout-link="false" data-use-continue-as="false"></div>'
            window.FB && window.FB.XFBML && window.FB.XFBML.parse(fbContainerRef.current)
          }
          const handler = async (resp)=>{
            if(resp.status === 'connected'){
              try{
                setLoading(s=>({...s,f:true}))
                const r = await postJSON(FACEBOOK_CALLBACK, { accessToken: resp.authResponse.accessToken, userID: resp.authResponse.userID })
                if(r && r.linkEmail && r.state){
                  const dest = `/link-email?state=${encodeURIComponent(r.state)}`
                  window.location.assign(dest)
                } else {
                  try{ await refresh() } catch {}
                  setLoading(s=>({...s,f:false}))
                  onSuccess?.('facebook')
                }
              }catch(e){ setLoading(s=>({...s,f:false})); setErr('Facebook prijava nije uspjela'); onError?.(e) }
            }
          }
          window.FB?.Event?.subscribe('auth.statusChange', handler)
          unsubFB = ()=> window.FB?.Event?.unsubscribe('auth.statusChange', handler)
        })
        .catch(()=> setErr('Ne može se učitati Facebook SDK'))
    }
    return ()=>{ if(unsubFB) unsubFB() }
  }, [])

  if(useSdk){
    return (
      <div className="social-login">
        {err && <div className="form-message" role="alert">{err}</div>}
        {GOOGLE_CLIENT_ID ? <div ref={gContainerRef} aria-label="Google Sign-In" /> : (
          <a className="btn btn-google" href={`${api}/auth/oauth/google/start?redirect=${encodeURIComponent(window.location.origin + '/oauth/callback')}`}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" width="18" height="18" focusable="false">
                <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.6-37-4.9-54.8H272v103.9h147c-6.3 34.1-25.4 63-54.2 82.3l87.5 67.9c51.1-47.1 80.2-116.6 80.2-199.3z"/>
                <path fill="#34A853" d="M272 544.3c73 0 134.2-24.2 178.9-65.6l-87.5-67.9c-24.3 16.3-55.4 25.9-91.4 25.9-70 0-129.4-47.1-150.6-110.5l-91 70.1c39.4 78.1 120 148 241.6 148z"/>
                <path fill="#FBBC05" d="M121.4 326.2c-10.1-29.7-10.1-61.7 0-91.4l-91-70.1c-39.7 79.4-39.7 172.2 0 251.5l91-70z"/>
                <path fill="#EA4335" d="M272 107.3c39.6-.6 77.7 14.1 106.6 41.4l79.7-79.7C414.7 25.4 345.6 0 272 0 150.4 0 69.8 69.9 30.3 164.7l91 70.1C142.4 171.3 202 107.3 272 107.3z"/>
              </svg>
            </span>
            <span className="label">Prijava preko Google</span>
          </a>
        )}
        {FB_APP_ID ? <div ref={fbContainerRef} aria-label="Facebook Login" /> : (
          <a className="btn btn-facebook" href={`${api}/auth/oauth/facebook/start?redirect=${encodeURIComponent(window.location.origin + '/oauth/callback')}`}>
            <span className="label">Prijava preko Facebook</span>
          </a>
        )}
      </div>
    )
  }

  // Redirect flow (default): use backend start endpoints directly
  return (
    <div className="social-login">
      <a className="btn btn-google" href={`${api}/auth/oauth/google/start?redirect=${encodeURIComponent(window.location.origin + '/oauth/callback')}`}>
        <span className="icon" aria-hidden="true">
          <svg viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" width="18" height="18" focusable="false">
            <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.6-37-4.9-54.8H272v103.9h147c-6.3 34.1-25.4 63-54.2 82.3l87.5 67.9c51.1-47.1 80.2-116.6 80.2-199.3z"/>
            <path fill="#34A853" d="M272 544.3c73 0 134.2-24.2 178.9-65.6l-87.5-67.9c-24.3 16.3-55.4 25.9-91.4 25.9-70 0-129.4-47.1-150.6-110.5l-91 70.1c39.4 78.1 120 148 241.6 148z"/>
            <path fill="#FBBC05" d="M121.4 326.2c-10.1-29.7-10.1-61.7 0-91.4l-91-70.1c-39.7 79.4-39.7 172.2 0 251.5l91-70z"/>
            <path fill="#EA4335" d="M272 107.3c39.6-.6 77.7 14.1 106.6 41.4l79.7-79.7C414.7 25.4 345.6 0 272 0 150.4 0 69.8 69.9 30.3 164.7l91 70.1C142.4 171.3 202 107.3 272 107.3z"/>
          </svg>
        </span>
        <span className="label">Prijava preko Google</span>
      </a>
      <a className="btn btn-facebook" href={`${api}/auth/oauth/facebook/start?redirect=${encodeURIComponent(window.location.origin + '/oauth/callback')}`}>
        <span className="label">Prijava preko Facebook</span>
      </a>
    </div>
  )
}
