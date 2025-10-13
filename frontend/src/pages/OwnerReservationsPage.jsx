import { useEffect, useState, useMemo } from 'react'
import { http } from '../api/http'

export default function OwnerReservationsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [stats, setStats] = useState(null)

  useEffect(()=>{
    let abort = false
    async function load(){
      setLoading(true); setError('')
      try {
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        const { data } = await http.get(`/owner/reservations?${params.toString()}`)
        if(!abort){
          setRows(data.rows||[])
          setStats(data.stats||null)
        }
      } catch(e){
        if(!abort) setError('Ne mogu učitati rezervacije')
      } finally { if(!abort) setLoading(false) }
    }
    load()
    return ()=>{ abort = true }
  }, [q, from, to])

  useEffect(()=>{
    if(!selectedId){ setDetail(null); return }
    let abort=false
    ;(async()=>{
      try {
        const { data } = await http.get(`/owner/reservations/${selectedId}`)
        if(!abort) setDetail(data)
      } catch(e){ if(!abort) setDetail(null) }
    })()
    return ()=>{ abort=true }
  }, [selectedId])

  const repeatBadge = (r)=> r.guest?.repeat ? <span className="badge vip">VIP</span> : null

  return (
    <div className="owner-reservations" style={{display:'flex', gap:'1.5rem'}}>
      <div style={{flex:2}}>
        <h1>Rezervacije</h1>
        <div className="filters" style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
          <input placeholder="Pretraga (kod, ime, email)" value={q} onChange={e=>setQ(e.target.value)} />
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        {stats && (
          <div className="stats-bar" style={{margin:'0.75rem 0', fontSize:14, display:'flex', gap:'1.5rem'}}>
            <div><b>Prihod:</b> EUR {stats.totalRevenue}</div>
            {stats.occupancyPct !== null && <div><b>Ocupanost:</b> {stats.occupancyPct}%</div>}
            <div><b>Noćenja:</b> {stats.nights}</div>
            <div><b>Ukupno:</b> {rows.length}</div>
          </div>
        )}
        {loading && <div>Učitavanje...</div>}
        {error && <div style={{color:'#b00'}}>{error}</div>}
        <table className="table res-table" style={{width:'100%', fontSize:13}}>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Kreirano</th>
              <th>Gost</th>
              <th>Jedinica</th>
              <th>Dolazak → Odlazak (noći)</th>
              <th>Iznos</th>
              <th>Status</th>
              <th>Zadnja aktivnost</th>
              <th>Tagovi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} onClick={()=>setSelectedId(r.id)} style={{cursor:'pointer', background: r.id===selectedId?'#eef':'transparent'}}>
                <td>{r.code}</td>
                <td>{new Date(r.createdAt).toLocaleDateString()}<br/><small>{r.channel}</small></td>
                <td>{r.guest?.fullName}{' '}{repeatBadge(r)}<br/><small>{r.guest?.email}</small></td>
                <td>{r.unitId?.slice(-4)}</td>
                <td>{new Date(r.checkIn).toLocaleDateString()} → {new Date(r.checkOut).toLocaleDateString()}<br/><small>{r.nights} noći / {r.guests} gost(i)</small></td>
                <td>{r.currency} {r.total}</td>
                <td>{r.status}</td>
                <td><small>{new Date(r.updatedAt).toLocaleString()}</small></td>
                <td>{(r.tags||[]).join(', ')}</td>
              </tr>
            ))}
            {!loading && rows.length===0 && <tr><td colSpan={9} style={{textAlign:'center', padding:'1rem'}}>Nema rezultata</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{flex:1}}>
        {detail ? (
          <div className="reservation-detail card" style={{padding:'1rem'}}>
            <h2 style={{marginTop:0}}>Gost: {detail.guest?.fullName} {detail.guest?.repeat && <span className="badge vip">VIP</span>}</h2>
            <p style={{margin:'0 0 .5rem'}}><b>Datumi:</b> {new Date(detail.checkIn).toLocaleDateString()} → {new Date(detail.checkOut).toLocaleDateString()} ({detail.nights} noći, {detail.guests} gost(i))</p>
            <p style={{margin:'0 0 .5rem'}}><b>Jedinica:</b> {detail.unitId}</p>
            <p style={{margin:'0 0 .5rem'}}><b>Iznos:</b> {detail.currency} {detail.total}</p>
            <p style={{margin:'0 0 .5rem'}}><b>Status:</b> {detail.status}</p>
            <p style={{margin:'0 0 .5rem'}}><b>Kreirano:</b> {new Date(detail.createdAt).toLocaleString()} ({detail.channel})</p>
            <p style={{margin:'0 0 .5rem'}}><b>Zadnja aktivnost:</b> {new Date(detail.updatedAt).toLocaleString()}</p>
            <hr/>
            <h3>Kontakt</h3>
            <p style={{margin:'0 0 .25rem'}}>{detail.guest?.email}</p>
            {detail.guest?.phone && <p style={{margin:'0 0 .25rem'}}>{detail.guest.phone}</p>}
            {detail.guest?.note && <p style={{margin:'0 0 .25rem'}}><b>Napomena:</b> {detail.guest.note}</p>}
            {detail.guest?.invoice?.need && (
              <p style={{margin:'0 0 .25rem'}}><b>Faktura:</b> {detail.guest.invoice.company} / {detail.guest.invoice.pib}</p>
            )}
            <hr/>
            <div style={{opacity:.6, fontSize:12}}>Promjena jedinice – uskoro</div>
          </div>
        ) : (
          <div style={{padding:'1rem', fontSize:14, color:'#666'}}>Odaberite rezervaciju za detalje.</div>
        )}
      </div>
    </div>
  )
}