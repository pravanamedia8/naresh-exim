import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const COLORS = { pass:'#34d399', maybe:'#fbbf24', drop:'#f87171', blue:'#60a5fa', cyan:'#22d3ee', orange:'#fb923c', purple:'#a78bfa' };
const RGB = { pass:'rgba(52,211,153,0.12)', maybe:'rgba(251,191,36,0.12)', drop:'rgba(248,113,113,0.12)', blue:'rgba(96,165,250,0.12)', cyan:'rgba(34,211,238,0.12)', orange:'rgba(251,146,60,0.12)', purple:'rgba(167,139,250,0.12)' };

const Badge = ({ label }) => {
  const t = (label||'').toUpperCase();
  const c = t.includes('APPROVED') || t.includes('YES') || t.includes('HIGH') ? 'pass'
    : t.includes('SAMPLING') || t.includes('NEGOTIAT') || t.includes('MEDIUM') ? 'maybe'
    : t.includes('REJECTED') || t.includes('FAIL') || t.includes('LOW') ? 'drop'
    : t.includes('SHORTLISTED') || t.includes('CONTACTED') ? 'cyan' : 'blue';
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:600, background:RGB[c], color:COLORS[c], border:`1px solid ${COLORS[c]}50` }}>{label||'-'}</span>;
};

const KPI = ({ label, value, color='#60a5fa', sub='' }) => (
  <div style={{ background:'#111827', border:'1px solid rgba(148,163,184,0.08)', borderRadius:'10px', padding:'14px 18px', textAlign:'center' }}>
    <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>{label}</div>
    <div style={{ fontSize:'26px', fontWeight:700, color }}>{value}</div>
    {sub && <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'2px' }}>{sub}</div>}
  </div>
);

export default function SupplierNegotiations() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortCol, setSortCol] = useState('overall_rating');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from('supplier_negotiations').select('*');
      setData(d || []);
      setLoading(false);
    })();
  }, []);

  const avgRating = useMemo(() => data.reduce((s,r) => s+(r.overall_rating||0),0)/Math.max(data.length,1), [data]);
  const avgDiscount = useMemo(() => {
    const valid = data.filter(r => r.initial_quote_usd > 0);
    return valid.reduce((s,r) => {
      const init = r.initial_quote_usd||0;
      const fin = r.final_fob_usd || r.negotiated_price_usd || init;
      return init > 0 ? s + ((init - fin)/init*100) : s;
    }, 0) / Math.max(valid.length, 1);
  }, [data]);

  const filtered = useMemo(() => {
    let f = data;
    if (search) f = f.filter(r => (r.supplier_name||'').toLowerCase().includes(search.toLowerCase()) || (r.hs4||'').includes(search) || (r.supplier_platform||'').toLowerCase().includes(search.toLowerCase()));
    if (stageFilter) f = f.filter(r => r.stage === stageFilter);
    if (priorityFilter) f = f.filter(r => r.priority === priorityFilter);
    f = [...f].sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return f;
  }, [data, search, stageFilter, priorityFilter, sortCol, sortDir]);

  const handleSort = col => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } };

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading supplier negotiations...</div>;

  const stages = [...new Set(data.map(r=>r.stage).filter(Boolean))].sort();

  const columns = [
    {key:'hs4', label:'HS4'},
    {key:'product_desc', label:'Product'},
    {key:'supplier_name', label:'Supplier'},
    {key:'supplier_platform', label:'Platform'},
    {key:'supplier_location', label:'Location'},
    {key:'stage', label:'Stage', render:v=><Badge label={v} />},
    {key:'priority', label:'Priority', render:v=><Badge label={v} />},
    {key:'initial_quote_usd', label:'Quote $', fmt:v=>v?`$${Number(v).toFixed(2)}`:'-'},
    {key:'negotiated_price_usd', label:'Negotiated $', fmt:v=>v?`$${Number(v).toFixed(2)}`:'-'},
    {key:'final_fob_usd', label:'Final FOB $', fmt:v=>v?`$${Number(v).toFixed(2)}`:'-'},
    {key:'moq', label:'MOQ', fmt:v=>v?Number(v).toLocaleString():'-'},
    {key:'lead_time_days', label:'Lead Days', fmt:v=>v||'-'},
    {key:'payment_terms', label:'Payment'},
    {key:'is_gold_supplier', label:'Gold', render:v=>v?<span style={{color:'#34d399'}}>Yes</span>:<span style={{color:'#64748b'}}>-</span>},
    {key:'overall_rating', label:'Rating', fmt:v=>v?Number(v).toFixed(1):'-'},
    {key:'sample_quality_rating', label:'Sample Q', fmt:v=>v?Number(v).toFixed(1):'-'},
    {key:'next_action', label:'Next Action'},
    {key:'next_action_date', label:'Due'},
  ];

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px', marginBottom:'16px' }}>
        <KPI label="Suppliers" value={data.length} color="#60a5fa" />
        <KPI label="Approved" value={data.filter(r=>r.stage==='approved').length} color="#34d399" />
        <KPI label="Avg Rating" value={`${avgRating.toFixed(1)}/5`} color="#22d3ee" />
        <KPI label="Sampling" value={data.filter(r=>r.stage==='sampling').length} color="#fbbf24" />
        <KPI label="Avg Discount" value={`${avgDiscount.toFixed(1)}%`} color="#a78bfa" sub="vs initial quote" />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search supplier, HS4, platform..." style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px', width:'220px' }} />
        <select value={stageFilter} onChange={e=>setStageFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Stages</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Priorities</option>
          {['high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ color:'#94a3b8', fontSize:'12px' }}>{filtered.length} suppliers</span>
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
                  <td key={c.key} style={{ padding:'6px', color:'#e2e8f0', whiteSpace:'nowrap' }}>
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
