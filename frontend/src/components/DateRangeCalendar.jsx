import { useState, useMemo } from 'react';

// Helper: generate days for a month
function buildMonth(year, month){ // month: 0-11
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const days = [];
  for(let d=1; d<=last.getDate(); d++){
    days.push(new Date(year, month, d));
  }
  return { first, last, days };
}

function fmt(d){ return d.toISOString().slice(0,10); }
function sameDay(a,b){ return a && b && a.getTime() === b.getTime(); }
function inRange(d, a, b){ return a && b && d >= a && d <= b; }

export default function DateRangeCalendar({
  from,
  to,
  onChange,
  minNights = 1,
  maxNights = 30,
  disabledDates = new Set(), // set of ISO yyyy-mm-dd strings not selectable
  months = 2,
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const selFrom = from ? new Date(from) : null;
  const selTo   = to ? new Date(to) : null;

  const monthModels = useMemo(() => {
    return Array.from({length: months}).map((_,i)=>{
      const m = new Date(cursor.getFullYear(), cursor.getMonth()+i, 1);
      return buildMonth(m.getFullYear(), m.getMonth());
    });
  }, [cursor, months]);

  function handleDayClick(day){
    const dIso = fmt(day);
    if(disabledDates.has(dIso)) return;
    if(selFrom && !selTo){
      // choose end
      if(day < selFrom){
        onChange(dIso, selFrom ? fmt(selFrom) : '');
        return;
      }
      const nights = Math.ceil((day - selFrom)/86400000);
      if(nights < minNights || nights > maxNights){
        // reject, keep only start
        onChange(fmt(selFrom), '');
        return;
      }
      onChange(fmt(selFrom), dIso);
    } else {
      // start or restart
      onChange(dIso, '');
    }
  }

  return (
    <div className="dr-calendar" style={{display:'flex', gap:24, flexWrap:'wrap'}}>
      <div className="dr-nav" style={{width:'100%', display:'flex', justifyContent:'space-between', marginBottom:8}}>
        <button type="button" onClick={()=> setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))}>‹</button>
        <div style={{fontWeight:600}}>{cursor.toLocaleString('default',{month:'long', year:'numeric'})}</div>
        <button type="button" onClick={()=> setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))}>›</button>
      </div>
      {monthModels.map((m,i)=>{
        const firstWeekday = m.first.getDay(); // 0-6
        const blanks = Array.from({length:firstWeekday});
        return (
          <div key={i} className="dr-month" style={{minWidth:230}}>
            <div style={{textAlign:'center', fontWeight:600, marginBottom:4}}>
              {m.first.toLocaleString('default',{month:'long'})} {m.first.getFullYear()}
            </div>
            <div className="dr-grid" style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, fontSize:12}}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=> <div key={d} style={{textAlign:'center', opacity:.6}}>{d}</div>)}
              {blanks.map((_,b)=><div key={b} />)}
              {m.days.map(d=>{
                const iso = fmt(d);
                const booked = disabledDates.has(iso); // treat disabledDates as booked for visual
                const past = d < today;
                const disabled = booked || past;
                const selectedStart = sameDay(d, selFrom);
                const selectedEnd = sameDay(d, selTo);
                const inSelRange = !selectedStart && !selectedEnd && inRange(d, selFrom, selTo);
                let bg = '#fff';
                let color = '#111';
                if (booked) { bg = '#dc2626'; color = '#fff'; }
                if (inSelRange) bg = '#BFDBFE';
                if (selectedStart || selectedEnd) { bg = '#2563eb'; color = '#fff'; }
                if (past && !booked) { color = '#999'; }
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={()=> !disabled && handleDayClick(d)}
                    style={{
                      padding:'6px 0',
                      border:'1px solid ' + (selectedStart || selectedEnd ? '#1d4ed8' : booked ? '#b91c1c' : '#ddd'),
                      background: bg,
                      color,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      borderRadius:4,
                      minWidth:0,
                      position:'relative'
                    }}
                    disabled={disabled}
                    aria-label={iso + (booked ? ' zauzeto' : '')}
                  >
                    {d.getDate()}
                    {iso === fmt(today) && <span style={{position:'absolute',top:2,right:4,fontSize:8,opacity:.7}}>danas</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )
      })}
      <div style={{fontSize:11, opacity:.75, display:'flex', flexDirection:'column', gap:2}}>
        <div><span style={{display:'inline-block',width:14,height:14,background:'#2563eb',marginRight:4,border:'1px solid #1d4ed8',verticalAlign:'middle'}} /> start / kraj</div>
        <div><span style={{display:'inline-block',width:14,height:14,background:'#BFDBFE',marginRight:4,border:'1px solid #93C5FD',verticalAlign:'middle'}} /> u rasponu</div>
        <div><span style={{display:'inline-block',width:14,height:14,background:'#dc2626',marginRight:4,border:'1px solid #b91c1c',verticalAlign:'middle'}} /> zauzeto</div>
        <div><span style={{display:'inline-block',width:14,height:14,background:'#fff',border:'1px solid #ddd',marginRight:4,verticalAlign:'middle'}} /> dostupno</div>
      </div>
    </div>
  )
}