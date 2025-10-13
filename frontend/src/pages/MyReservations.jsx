import { useEffect, useState } from 'react'
import { reservationsApi } from '../api/http'
import ReservationDetailModal from '../components/ReservationDetailModal'

function formatRange(ci, co){
  try {
    const inD = new Date(ci), outD = new Date(co)
    const opts = { day:'2-digit', month:'short', year:'numeric' }
    return inD.toLocaleDateString('sr-RS', opts) + ' – ' + outD.toLocaleDateString('sr-RS', opts)
  } catch { return '' }
}

export default function MyReservationsPage(){
  const [email,setEmail] = useState(()=> localStorage.getItem('guestEmail') || '')
  const [list,setList] = useState([])
  const [meta,setMeta] = useState({page:1,pages:1,total:0,limit:50})
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const [status,setStatus] = useState('') // '' all, confirmed, cancelled
  const [codeQuery,setCodeQuery] = useState('')
  const [showCodeSearch,setShowCodeSearch] = useState(false)
  const [page,setPage] = useState(1)
  const [activeCode,setActiveCode] = useState(null)

  async function load(){
    if(!email) return
    setLoading(true); setError('')
    try {
      const params = { page }
      if(status) params.status = status
      if(codeQuery) params.q = codeQuery.trim()
      const { data } = await reservationsApi.mine(email, params)
      setList(data.rows || [])
      setMeta({page:data.page,pages:data.pages,total:data.total,limit:data.limit})
    } catch(e){
      setError(e.response?.data?.error || e.message || 'Greška')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() // initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e){ e.preventDefault(); localStorage.setItem('guestEmail', email); setPage(1); load() }

  function handleCancelled(code){
    setList(lst => lst.map(r => r.code===code? {...r, status:'cancelled'}:r))
  }

  return (
    <div className='page my-reservations' style={{maxWidth:960, margin:'40px auto', padding:'0 16px'}}>
      <h1 style={{marginTop:0}}>Moje rezervacije</h1>
      <form onSubmit={handleSubmit} style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:16}}>
        <input style={{flex:'1 1 240px'}} type='email' placeholder='Vaš email' value={email} onChange={e=>setEmail(e.target.value)} required />
        <button className='btn primary' disabled={!email || loading}>{loading? 'Učitavanje…':'Prikaži'}</button>
      </form>
      {email && (
        <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:20}}>
          <div className='status-tabs' style={{display:'flex', gap:6}}>
            {['','confirmed','cancelled'].map(st => (
              <button key={st||'all'} type='button' onClick={()=>{setStatus(st); setPage(1); load()}} className={'tab-btn'+(status===st? ' active':'')}>
                {st===''? 'Sve': st==='confirmed'? 'Aktivne':'Otkazane'}
              </button>
            ))}
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {showCodeSearch && <input style={{width:140}} value={codeQuery} onChange={e=>setCodeQuery(e.target.value)} placeholder='Kod' />}
            <button type='button' className='btn outline' onClick={()=>{ if(showCodeSearch && codeQuery){ setPage(1); load(); } setShowCodeSearch(s=> !s) }}>
              {showCodeSearch? 'Traži':'Pretraži kod'}</button>
            {showCodeSearch && codeQuery && <button type='button' onClick={()=>{setCodeQuery(''); setPage(1); load()}} style={{background:'none', border:'none', color:'#444', textDecoration:'underline'}}>Reset</button>}
          </div>
        </div>
      )}
      {error && <div style={{color:'#b00', marginBottom:16}}>{error}</div>}
      {!loading && !error && list.length===0 && email && (
        <p style={{fontSize:14, color:'#555'}}>Trenutno nemate aktivnih rezervacija. Pogledajte ponudu naših apartmana.</p>
      )}
      <div style={{display:'grid', gap:16}}>
        {list.map(r => (
          <div key={r.code} style={{border:'1px solid #e1e1e1', borderRadius:14, padding:'14px 18px', background:'#fff', display:'flex', flexDirection:'column', gap:6}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12, flexWrap:'wrap'}}>
              <h3 style={{margin:'0', fontSize:18}}>{r.property?.name || 'Smještaj'} <span style={{fontSize:12, fontWeight:400, color:'#666'}}>({r.code})</span></h3>
              <span style={{fontSize:14, color:'#444'}}>{r.nights} noći · {r.guests} gost(i)</span>
            </div>
            <div style={{fontSize:14, color:'#222'}}>{formatRange(r.checkIn, r.checkOut)}</div>
            {r.property?.address?.municipality && <div style={{fontSize:12, color:'#666'}}>{r.property.address.municipality}</div>}
            <div style={{fontSize:14}}><b>{r.currency} {r.total}</b> <span style={{fontSize:12, color:'#666'}}>({r.currency} {r.pricePerNight}/noć)</span></div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
              <div style={{fontSize:12, color: r.status==='cancelled'? '#b00':'#0a7a30'}}>{r.status==='cancelled'? 'Otkazana':'Potvrđena'}</div>
              <button type='button' onClick={()=> setActiveCode(r.code)} className='btn small'>Prikaži detalje</button>
            </div>
          </div>
        ))}
      </div>
      {meta.pages>1 && (
        <div style={{marginTop:24, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          <button disabled={page<=1} onClick={()=>{setPage(p=> p-1); load()}} className='btn small'>←</button>
            <span style={{fontSize:12}}>Strana {page}/{meta.pages}</span>
          <button disabled={page>=meta.pages} onClick={()=>{setPage(p=> p+1); load()}} className='btn small'>→</button>
        </div>
      )}
      {activeCode && (
        <ReservationDetailModal code={activeCode} email={email} onClose={()=> setActiveCode(null)} onCancelled={handleCancelled} />
      )}
      <style>{`
        .tab-btn{background:#f3f3f3; border:1px solid #ddd; padding:6px 14px; border-radius:40px; cursor:pointer; font-size:13px}
        .tab-btn.active{background:#0a7a30; color:#fff; border-color:#0a7a30}
        .btn.small{padding:6px 12px; font-size:12px}
      `}</style>
    </div>
  )
}
