import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const COLORS = { pass:'#34d399', maybe:'#fbbf24', drop:'#f87171', blue:'#60a5fa', cyan:'#22d3ee', orange:'#fb923c', purple:'#a78bfa' };
const RGB = { pass:'rgba(52,211,153,0.12)', maybe:'rgba(251,191,36,0.12)', drop:'rgba(248,113,113,0.12)', blue:'rgba(96,165,250,0.12)', cyan:'rgba(34,211,238,0.12)', orange:'rgba(251,146,60,0.12)', purple:'rgba(167,139,250,0.12)' };

const fmtINR = v => v >= 1e7 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v/1e5).toFixed(1)}L` : `₹${(v||0).toLocaleString('en-IN')}`;
const fmtPct = v => `${(v||0).toFixed(1)}%`;

const Badge = ({ label }) => {
  const t = (label||'').toUpperCase();
  const c = t.includes('PURSUE') || t.includes('REGULAR') || t.includes('LOW') || t.includes('GO') ? 'pass'
    : t.includes('STRONG') || t.includes('MEDIUM') || t.includes('SPOT') || t.includes('MODERATE') ? 'maybe'
    : t.includes('DROP') || t.includes('HIGH') || t.includes('FAIL') || t.includes('CRITICAL') ? 'drop'
    : t.includes('BROKER') || t.includes('MIXED') ? 'purple' : 'blue';
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:600, background:RGB[c], color:COLORS[c], border:`1px solid ${COLORS[c]}50` }}>{label||'-'}</span>;
};

const KPI = ({ label, value, color='#60a5fa' }) => (
  <div style={{ background:'#111827', border:'1px solid rgba(148,163,184,0.08)', borderRadius:'10px', padding:'14px 18px', textAlign:'center' }}>
    <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>{label}</div>
    <div style={{ fontSize:'26px', fontWeight:700, color }}>{value}</div>
  </div>
);

export default function SupplyChainPlan() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [sortCol, setSortCol] = useState('final_score');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from('supply_chain_plan').select('*');
      setData(d || []);
      setLoading(false);
    })();
  }, []);

  const avgMargin = useMemo(() => data.reduce((s,r)=>s+(r.gross_margin_pct||0),0)/Math.max(data.length,1), [data]);
  const avgROI = useMemo(() => data.reduce((s,r)=>s+(r.roi_year1_pct||0),0)/Math.max(data.length,1), [data]);

  const filtered = useMemo(() => {
    let f = data;
    if (search) f = f.filter(r => (r.hs4||'').includes(search) || (r.commodity||'').toLowerCase().includes(search.toLowerCase()));
    if (modelFilter) f = f.filter(r => r.trading_model === modelFilter);
    if (verdictFilter) f = f.filter(r => (r.final_verdict||'').includes(verdictFilter));
    if (riskFilter) f = f.filter(r => r.risk_level === riskFilter);
    f = [...f].sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return f;
  }, [data, search, modelFilter, verdictFilter, riskFilter, sortCol, sortDir]);

  const handleSort = col => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } };

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading supply chain plan...</div>;

  const columns = [
    {key:'hs4', label:'HS4'},
    {key:'commodity', label:'Commodity'},
    {key:'final_score', label:'Score', fmt:v=>v||'-'},
    {key:'final_verdict', label:'Verdict', render:v=><Badge label={v} />},
    {key:'trading_model', label:'Model', render:v=><Badge label={v} />},
    {key:'market_size_usd_m', label:'Market $M', fmt:v=>v?Number(v).toFixed(1):'-'},
    {key:'gross_margin_pct', label:'Margin%', render:v=><span style={{color:v>=25?'#34d399':v>=15?'#fbbf24':v>=10?'#fb923c':'#f87171', fontWeight:700}}>{v?`${Number(v).toFixed(1)}%`:'-'}</span>},
    {key:'roi_year1_pct', label:'ROI%', fmt:v=>v?`${Number(v).toFixed(0)}%`:'-'},
    {key:'break_even_months', label:'B/E Mo', fmt:v=>v?Number(v).toFixed(1):'-'},
    {key:'working_capital_required_inr', label:'WC INR', fmt:v=>v?fmtINR(v):'-'},
    {key:'primary_source_country', label:'Source'},
    {key:'primary_source_platform', label:'Platform'},
    {key:'certifications_needed', label:'Certs'},
    {key:'target_buyer_count', label:'Buyers', fmt:v=>v||'-'},
    {key:'sales_channel', label:'Channel'},
    {key:'risk_level', label:'Risk', render:v=><Badge label={v} />},
    {key:'competitive_advantage', label:'Advantage'},
    {key:'phase1_action', label:'Phase 1 Action'},
  ];

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px', marginBottom:'16px' }}>
        <KPI label="Products" value={data.length} color="#60a5fa" />
        <KPI label="PURSUE" value={data.filter(r=>(r.final_verdict||'').includes('PURSUE')).length} color="#34d399" />
        <KPI label="Avg Margin" value={fmtPct(avgMargin)} color="#22d3ee" />
        <KPI label="Avg ROI Y1" value={fmtPct(avgROI)} color="#a78bfa" />
        <KPI label="Total WC" value={fmtINR(data.reduce((s,r)=>s+(r.working_capital_required_inr||0),0))} color="#fbbf24" />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS4, commodity..." style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px', width:'200px' }} />
        <select value={modelFilter} onChange={e=>setModelFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Models</option>
          {['REGULAR','SPOT','BROKER','MIXED'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={verdictFilter} onChange={e=>setVerdictFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Verdicts</option>
          {['PURSUE','STRONG','MODERATE','DROP'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Risk</option>
          {['LOW','MEDIUM','HIGH','CRITICAL'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span style={{ color:'#94a3b8', fontSize:'12px' }}>{filtered.length} products</span>
      </div>

      {/* Table */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr>{columns.map(c => (
              <th key={c.key} onClick={()=>handleSort(c.key)} style={{ padding:'8px 6px', textAlign:'left', color:'#94a3b8', borderBottom:'1px solid rgba(148,163,184,0.15)', cursor:'pointer', whiteSpace:'nowrap', fontSize:'11px' }}>
                {c.label} {sortCol===c.key ? (sortDir==='asc'?'↑':'↓') : ''}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.slice(0,200).map((r,i) => (
              <tr key={i} style={{ borderBottom:'1px solid rgba(148,163,184,0.05)' }}>
                {columns.map(c => (
                  <td key={c.key} style={{ padding:'6px', color:'#e2e8f0', whiteSpace:'nowrap', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {c.render ? c.render(r[c.key]) : c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
