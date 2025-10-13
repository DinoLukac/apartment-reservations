export default function AboutPage(){
  return (
    <div className='page about'>
      <section className='about-hero'>
        <h1 style={{marginTop:0}}>O nama</h1>
        <p className='lead'>Apartmani je moderna platforma za privatni smještaj koja spaja domaćine i goste na jednostavan, siguran i transparentan način. Naš fokus je da rezervacije budu brze i pouzdane, a komunikacija jasna i prijateljska.</p>
      </section>

      <section className='section about-grid'>
        <div>
          <h2 className='section-title'>Naša misija</h2>
          <p>Vjerujemo da tehnologija treba da služi ljudima. Želimo da unaprijedimo iskustvo rezervacije smještaja tako što domaćinima dajemo potpunu kontrolu nad ponudom, a gostima pouzdano mjesto za rezervaciju — bez skrivenih troškova i komplikacija.</p>
        </div>
        <div>
          <h2 className='section-title'>Naša vizija</h2>
          <p>Da postanemo prvi izbor za privatni smještaj u Crnoj Gori i regionu — platforma sa povjerenjem, poštenim pravilima i realnom dostupnošću. Jednostavno, jasno i uvijek u službi korisnika.</p>
        </div>
      </section>

      <section className='section'>
        <h2 className='section-title'>Vrijednosti koje nas vode</h2>
        <div className='values-grid'>
          <div className='card icon'>
            <div className='icon'>✓</div>
            <div>
              <h3 style={{margin:"2px 0 4px",fontSize:18}}>Povjerenje i transparentnost</h3>
              <p className='muted'>Jasna pravila, realna dostupnost i vidljive cijene. Bez sitnih slova.</p>
            </div>
          </div>
          <div className='card icon'>
            <div className='icon'>⚡</div>
            <div>
              <h3 style={{margin:"2px 0 4px",fontSize:18}}>Jednostavnost</h3>
              <p className='muted'>Brzo pretraživanje, laka rezervacija, razumljiv interfejs — bez suvišnih koraka.</p>
            </div>
          </div>
          <div className='card icon'>
            <div className='icon'>🤝</div>
            <div>
              <h3 style={{margin:"2px 0 4px",fontSize:18}}>Podrška zajednici</h3>
              <p className='muted'>Lokalni fokus i fer odnos prema domaćinima i gostima — svi dobijaju.</p>
            </div>
          </div>
        </div>
      </section>

      <section className='section'>
        <h2 className='section-title'>Za goste</h2>
        <div className='feature-grid'>
          <div className='card'>
            <h3 style={{margin:"0 0 6px",fontSize:18}}>Pretraga i dostupnost u realnom vremenu</h3>
            <p className='muted'>Filtrirajte po lokaciji, datumima, cijenama i sadržajima. Prikazujemo samo ono što je zaista dostupno.</p>
          </div>
          <div className='card'>
            <h3 style={{margin:"0 0 6px",fontSize:18}}>Transparentne cijene</h3>
            <p className='muted'>Bez iznenađenja — cijene, takse i pravila su jasno prikazani prije potvrde.</p>
          </div>
          <div className='card'>
            <h3 style={{margin:"0 0 6px",fontSize:18}}>Sigurna rezervacija</h3>
            <p className='muted'>Siguran proces rezervacije i potvrda emailom uz .ics poziv za kalendar.</p>
          </div>
          <div className='card'>
            <h3 style={{margin:"0 0 6px",fontSize:18}}>Karta i lokacija</h3>
            <p className='muted'>Intuitivna mapa pomaže da lako pronađete smještaj na željenoj lokaciji.</p>
          </div>
        </div>
      </section>

      <section className='section'>
        <h2 className='section-title'>Za domaćine</h2>
        <div className='feature-grid'>
          <div className='card'>
            <h3 style={{margin:"0 0 6px",fontSize:18}}>Potpuna kontrola nad ponudom</h3>
            <p className='muted'>Dodajte objekte, uređujte cijene, pravila i dostupnost — sve u par klikova.</p>
          </div>
          <div className='card'>
            <h3 style={{margin:"0 0 6px",fontSize:18}}>Ažuriranje u realnom vremenu</h3>
            <p className='muted'>Promjene se odmah odražavaju na javnoj stranici — bez kašnjenja.</p>
          </div>
          <div className='card'>
            <h3 style={{margin:"0 0 6px",fontSize:18}}>Statistika i uvidi</h3>
            <p className='muted'>Pregled zauzetosti, prihoda i kanala rezervacije na jednom mjestu.</p>
          </div>
          <div className='card'>
            <h3 style={{margin:"0 0 6px",fontSize:18}}>Profesionalna podrška</h3>
            <p className='muted'>Tehnička i operativna pomoć — od objave do rezervacije.</p>
          </div>
        </div>
      </section>

      <section className='section'>
        <h2 className='section-title'>Kako funkcioniše</h2>
        <ul className='step-list'>
          <li className='step'><span className='num'>1</span><div><b>Pronađite smještaj</b><br/><span className='muted'>Pretražite po lokaciji i datumima, koristite kartu i filtere.</span></div></li>
          <li className='step'><span className='num'>2</span><div><b>Provjerite dostupnost</b><br/><span className='muted'>Vidite stvarnu dostupnost po jedinicama i cijene u realnom vremenu.</span></div></li>
          <li className='step'><span className='num'>3</span><div><b>Rezervišite sigurno</b><br/><span className='muted'>Unesite podatke, potvrdite pravila i primite potvrdu emailom.</span></div></li>
        </ul>
      </section>

      <section className='section cta-section'>
        <h2 className='section-title' style={{marginBottom:8}}>Imate pitanje ili prijedlog?</h2>
        <p className='muted' style={{marginTop:0}}>Pišite nam i rado ćemo pomoći oko rezervacija ili objave vašeg smještaja.</p>
        <a href='mailto:info@apartmani.example' className='btn primary'>Kontaktiraj nas</a>
      </section>

      <section className='section'>
        <p className='muted' style={{fontSize:12}}>Napomena: Ova stranica je informativna i biće dodatno nadograđena zvaničnim tekstom i fotografijama po potrebi.</p>
      </section>
    </div>
  )
}
