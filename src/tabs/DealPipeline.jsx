import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const COLORS = { pass:'#34d399', maybe:'#fbbf24', watch:'#a78bfa', drop:'#f87171', blue:'#60a5fa', cyan:'#22d3ee', orange:'#fb923c', purple:'#a78bfa' };
const RGB = { pass:'rgba(52,211,153,0.12)', maybe:'rgba(251,191,36,0.12)', watch:'rgba(167,139,250,0.12)', drop:'rgba(248,113,113,0.12)', blue:'rgba(96,165,250,0.12)', cyan:'rgba(34,211,238,0.12)', orange:'rgba(251,146,60,0.12)', purple:'rgba(167,139,250,0.12)' };

const STAGE_COLORS = {
  lead:'#a78bfa', contacted:'#22d3ee', sample_ordered:'#60a5fa', negotiating:'#fbbf24',
  po_approved:'#fb923c', shipped:'#22d3ee', delivered:'#34d399', completed:'#34d399',
  recurring:'#34d399', lost:'#f87171', on_hold:'#f87171'
};
const STAGES = ['lead','contacted','sample_ordered','negotiating','po_approved','shipped','delivered','completed','recurring','lost','on_hold'];

const fmtUSD = v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${(v||0).toFixed(0)}`;
const fmtPct = v => `${(v||0).toFixed(1)}%`;

const Badge = ({ label }) => {
  const t = (label||'').toUpperCase();
  const c = t.includes('HIGH') || t.includes('LOST') || t.includes('DROP') ? 'drop'
    : t.includes('COMPLETED') || t.includes('RECURRING') || t.includes('DELIVERED') || t.includes('REGULAR') || t.includes('APPROVED') ? 'pass'
    : t.includes('MEDIUM') || t.includes('NEGOTIAT') || t.includes('SPOT') || t.includes('SAMPLE') ? 'maybe'
    : t.includes('BROKER') || t.includes('MIXED') || t.includes('HOLD') ? 'watch'
    : t.includes('SHIPPED') || t.includes('CONTACTED') || t.includes('LOW') ? 'cyan' : 'blue';
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:600, background:RGB[c], color:COLORS[c], border:`1px solid ${COLORS[c]}50` }}>{label||'-'}</span>;
};

const KPI = ({ label, value, color='#60a5fa', sub='' }) => (
  <div style={{ background:'#111827', border:'1px solid rgba(148,163,184,0.08)', borderRadius:'10px', padding:'14px 18px', textAlign:'center' }}>
    <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>{label}</div>
    <div style={{ fontSize:'26px', fontWeight:700, color }}>{value}</div>
    {sub && <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'2px' }}>{sub}</div>}
  </div>
);

export default function DealPipeline() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [sortCol, setSortCol] = useState('total_value_usd');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from('deal_pipeline').select('*');
      setData(d || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let f = data;
    if (search) f = f.filter(r => (r.buyer_name||'').toLowerCase().includes(search.toLowerCase()) || (r.product_desc||'').toLowerCase().includes(search.toLowerCase()) || (r.hs4||'').includes(search));
    if (stageFilter) f = f.filter(r => r.stage === stageFilter);
    if (priorityFilter) f = f.filter(r => r.priority === priorityFilter);
    if (modelFilter) f = f.filter(r => r.trading_model === modelFilter);
    f = [...f].sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return f;
  }, [data, search, stageFilter, priorityFilter, modelFilter, sortCol, sortDir]);

  const active = useMemo(() => data.filter(r => !['lost','on_hold','completed','recurring'].includes(r.stage)), [data]);

  const stageCounts = useMemo(() => {
    const c = {}; STAGES.forEach(s => c[s]=0);
    data.forEach(r => { if (c[r.stage] !== undefined) c[r.stage]++; });
    return c;
  }, [data]);

  const stageValues = useMemo(() => {
    const v = {}; STAGES.forEach(s => v[s]=0);
    data.forEach(r => { if (v[r.stage] !== undefined) v[r.stage] += (r.total_value_usd||0); });
    return v;
  }, [data]);

  const handleSort = col => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } };

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading deal pipeline...</div>;

  const columns = [
    {key:'hs4', label:'HS4'},
    {key:'product_desc', label:'Product'},
    {key:'buyer_name', label:'Buyer'},
    {key:'buyer_city', label:'City'},
    {key:'stage', label:'Stage', render:v=><Badge label={v?.replace(/_/g,' ')} />},
    {key:'priority', label:'Priority', render:v=><Badge label={v} />},
    {key:'trading_model', label:'Model', render:v=><Badge label={v} />},
    {key:'fob_price_usd', label:'FOB $', fmt:v=>v?`$${Number(v).toFixed(2)}`:'-'},
    {key:'landed_cost_inr', label:'Landed INR', fmt:v=>v?`₹${Number(v).toLocaleString('en-IN')}`:'-'},
    {key:'selling_price_inr', label:'Sell INR', fmt:v=>v?`₹${Number(v).toLocaleString('en-IN')}`:'-'},
    {key:'expected_margin_pct', label:'Margin%', render:v=><span style={{color:v>=25?'#34d399':v>=15?'#fbbf24':v>=10?'#fb923c':'#f87171', fontWeight:700}}>{v?`${Number(v).toFixed(1)}%`:'-'}</span>},
    {key:'total_value_usd', label:'Value $', fmt:v=>fmtUSD(v||0)},
    {key:'payment_terms', label:'Payment'},
    {key:'next_action', label:'Next Action'},
    {key:'next_action_date', label:'Due'},
    {key:'supplier_name', label:'Supplier'},
  ];

  return (
    <div>
      {/* Stage Pipeline Visual */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
        {STAGES.filter(s => stageCounts[s] > 0).map(s => (
          <div key={s} style={{ background:'#111827', border:'1px solid rgba(148,163,184,0.08)', borderRadius:'10px', padding:'10px 16px', textAlign:'center', minWidth:'90px', borderTop:`3px solid ${STAGE_COLORS[s]}` }}>
            <div style={{ fontSize:'10px', color:'#94a3b8', textTransform:'capitalize', marginBottom:'2px' }}>{s.replace(/_/g,' ')}</div>
            <div style={{ fontSize:'22px', fontWeight:700, color:STAGE_COLORS[s] }}>{stageCounts[s]}</div>
            <div style={{ fontSize:'10px', color:'#64748b' }}>{fmtUSD(stageValues[s])}</div>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px', marginBottom:'16px' }}>
        <KPI label="Total Deals" value={data.length} color="#60a5fa" />
        <KPI label="Active" value={active.length} color="#34d399" />
        <KPI label="Pipeline Value" value={fmtUSD(active.reduce((s,r)=>s+(r.total_value_usd||0),0))} color="#a78bfa" />
        <KPI label="Avg Margin" value={fmtPct(active.reduce((s,r)=>s+(r.expected_margin_pct||0),0)/Math.max(active.length,1))} color="#22d3ee" />
        <KPI label="High Priority" value={data.filter(r=>r.priority==='high').length} color="#34d399" />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search buyer, product, HS4..." style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px', width:'200px' }} />
        <select value={stageFilter} onChange={e=>setStageFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Priorities</option>
          {['high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={modelFilter} onChange={e=>setModelFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Models</option>
          {['REGULAR','SPOT','BROKER','MIXED'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{ color:'#94a3b8', fontSize:'12px' }}>{filtered.length} deals</span>
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
        {filtered.length > 200 && <div style={{ padding:'10px', textAlign:'center', color:'#94a3b8', fontSize:'12px' }}>Showing 200 of {filtered.length}</div>}
      </div>
    </div>
  );
}
