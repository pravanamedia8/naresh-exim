import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { fetchApi } from '../api';

const COLORS = ['#4f8cff','#34d399','#fbbf24','#f87171','#a78bfa'];

function VerdictBadge({ verdict }) {
  if (!verdict) return '-';
  const v = verdict.toUpperCase();
  if (v === 'PASS') return <span className="badge b-pass">PASS</span>;
  if (v === 'MAYBE') return <span className="badge b-maybe">MAYBE</span>;
  if (v === 'WATCH') return <span className="badge b-watch">WATCH</span>;
  if (v === 'DROP') return <span className="badge b-drop">DROP</span>;
  return <span className="badge">{verdict}</span>;
}

export default function HSAnalysis() {
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState([]);
  const [allHS4, setAllHS4] = useState([]);
  const [hs2Filter, setHs2Filter] = useState('all');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    Promise.all([fetchApi('hs2_analysis'), fetchApi('hs4_top')])
      .then(([h2, h4]) => { setChapters(h2.chapters || []); setAllHS4(h4.top || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredHS4 = useMemo(() => {
    return allHS4.filter(p => {
      const matchHs2 = hs2Filter === 'all' || p.hs2 === hs2Filter;
      const matchVerdict = verdictFilter === 'all' || (p.verdict||'').toUpperCase() === verdictFilter;
      const matchSearch = !search || (p.commodity||'').toLowerCase().includes(search.toLowerCase()) || (p.hs4+'').includes(search);
      return matchHs2 && matchVerdict && matchSearch;
    });
  }, [allHS4, hs2Filter, verdictFilter, search]);

  const totalPages = Math.ceil(filteredHS4.length / PAGE_SIZE);
  const displayHS4 = filteredHS4.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  const hs2ChartData = useMemo(() => chapters.slice(0, 20).map(ch => ({
    name: `HS${ch.hs2}`, score: ch.chapter_score || 0
  })), [chapters]);

  const scoringBreakdown = useMemo(() => chapters.slice(0, 15).map(ch => ({
    name: `HS${ch.hs2}`,
    Value: ch.pts_value || 0,
    Combined: ch.pts_combined || 0,
    Middleman: ch.pts_middleman || 0,
    Pipeline: ch.pts_pipeline || 0,
    Dominance: ch.pts_dominance || 0,
    Depth: ch.pts_depth || 0,
  })), [chapters]);

  if (loading) return <div className="loading">Loading HS Analysis...</div>;

  return (
    <div>
      <div className="kpis">
        <div className="kpi hl"><div className="kpi-lbl">HS2 Chapters</div><div className="kpi-val">{chapters.length}</div></div>
        <div className="kpi gn"><div className="kpi-lbl">HS2 PASS</div><div className="kpi-val">{chapters.filter(c=>c.verdict==='PASS').length}</div></div>
        <div className="kpi yw"><div className="kpi-lbl">HS2 MAYBE</div><div className="kpi-val">{chapters.filter(c=>c.verdict==='MAYBE').length}</div></div>
        <div className="kpi hl"><div className="kpi-lbl">All HS4</div><div className="kpi-val">{allHS4.length}</div></div>
        <div className="kpi gn"><div className="kpi-lbl">HS4 PASS</div><div className="kpi-val">{allHS4.filter(p=>(p.verdict||'').toUpperCase()==='PASS').length}</div></div>
      </div>

      <div className="g2">
        <div className="chart-container">
          <div className="chart-title">Top 20 HS2 Chapter Scores</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hs2ChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--tx2)" fontSize={10} />
              <YAxis stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Bar dataKey="score" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">HS2 Scoring Breakdown (Top 15)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scoringBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--tx2)" fontSize={10} />
              <YAxis stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Legend />
              <Bar dataKey="Value" stackId="a" fill="#4f8cff" />
              <Bar dataKey="Combined" stackId="a" fill="#34d399" />
              <Bar dataKey="Middleman" stackId="a" fill="#fbbf24" />
              <Bar dataKey="Pipeline" stackId="a" fill="#a78bfa" />
              <Bar dataKey="Dominance" stackId="a" fill="#fb923c" />
              <Bar dataKey="Depth" stackId="a" fill="#22d3ee" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">All HS2 Chapters ({chapters.length})</div>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead>
            <tr><th>HS2</th><th>Description</th><th>Type</th><th>HS4s</th><th>HS8s</th><th>Total Val $M</th><th>Avg Growth</th><th>Score</th><th>Verdict</th><th>Value</th><th>Combined</th><th>Middleman</th><th>Pipeline</th><th>Dominance</th><th>Depth</th></tr>
          </thead>
          <tbody>
            {chapters.map((ch, idx) => (
              <tr key={idx}>
                <td>{ch.hs2}</td>
                <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ch.description}</td>
                <td><span style={{fontSize:10}}>{ch.goods_type}</span></td>
                <td>{ch.hs4_count}</td>
                <td>{ch.hs8_count}</td>
                <td>${(ch.total_val||0).toFixed(1)}M</td>
                <td style={{color:(ch.avg_growth||0)>0?'#34d399':'#f87171'}}>{(ch.avg_growth||0).toFixed(1)}%</td>
                <td style={{fontWeight:700}}>{(ch.chapter_score||0).toFixed(1)}</td>
                <td><VerdictBadge verdict={ch.verdict} /></td>
                <td>{(ch.pts_value||0).toFixed(1)}</td>
                <td>{(ch.pts_combined||0).toFixed(1)}</td>
                <td>{(ch.pts_middleman||0).toFixed(1)}</td>
                <td>{(ch.pts_pipeline||0).toFixed(1)}</td>
                <td>{(ch.pts_dominance||0).toFixed(1)}</td>
                <td>{(ch.pts_depth||0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">All HS4 Products ({filteredHS4.length} of {allHS4.length})</div>
        <div className="filters">
          <input type="text" className="filter-input" placeholder="Search HS4, commodity..." value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} />
          <select className="filter-select" value={hs2Filter} onChange={e=>{setHs2Filter(e.target.value);setPage(0);}}>
            <option value="all">All HS2</option>
            {[...new Set(allHS4.map(p=>p.hs2))].sort().map(h=><option key={h} value={h}>HS {h}</option>)}
          </select>
          <select className="filter-select" value={verdictFilter} onChange={e=>{setVerdictFilter(e.target.value);setPage(0);}}>
            <option value="all">All Verdicts</option>
            <option value="PASS">PASS</option><option value="MAYBE">MAYBE</option><option value="WATCH">WATCH</option><option value="DROP">DROP</option>
          </select>
        </div>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead>
            <tr><th>HS4</th><th>HS2</th><th>Commodity</th><th>Category</th><th>Score</th><th>Verdict</th><th>Tier</th><th>Value $M</th><th>Growth</th><th>HS8s</th><th>BCD</th><th>China %</th><th>HS2 Score</th></tr>
          </thead>
          <tbody>
            {displayHS4.map((p, idx) => (
              <tr key={idx}>
                <td>{p.hs4}</td><td>{p.hs2}</td>
                <td style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.commodity}</td>
                <td><span style={{fontSize:10}}>{p.category}</span></td>
                <td style={{fontWeight:700}}>{(p.score||0).toFixed(1)}</td>
                <td><VerdictBadge verdict={p.verdict} /></td>
                <td><span style={{fontSize:10}}>{p.entry_tier}</span></td>
                <td>${(p.value_m||0).toFixed(1)}M</td>
                <td style={{color:(p.growth||0)>0?'#34d399':'#f87171'}}>{(p.growth||0).toFixed(1)}%</td>
                <td>{p.hs8_count||0}</td>
                <td>{(p.bcd||0).toFixed(1)}%</td>
                <td>{(p.china_pct||0).toFixed(1)}%</td>
                <td>{(p.hs2_score||0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {totalPages > 1 && (
          <div style={{display:'flex',gap:6,marginTop:12,flexWrap:'wrap'}}>
            <button onClick={()=>setPage(Math.max(0,page-1))} disabled={page===0} style={{padding:'5px 12px',background:'var(--bg3)',color:'var(--tx)',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer'}}>Prev</button>
            <span style={{padding:'5px 8px',color:'var(--tx2)'}}>Page {page+1}/{totalPages}</span>
            <button onClick={()=>setPage(Math.min(totalPages-1,page+1))} disabled={page>=totalPages-1} style={{padding:'5px 12px',background:'var(--bg3)',color:'var(--tx)',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer'}}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
