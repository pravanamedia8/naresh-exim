import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const COLORS = { pass:'#34d399', maybe:'#fbbf24', drop:'#f87171', blue:'#60a5fa', cyan:'#22d3ee', orange:'#fb923c', purple:'#a78bfa' };
const RGB = { pass:'rgba(52,211,153,0.12)', maybe:'rgba(251,191,36,0.12)', drop:'rgba(248,113,113,0.12)', blue:'rgba(96,165,250,0.12)', cyan:'rgba(34,211,238,0.12)', orange:'rgba(251,146,60,0.12)', purple:'rgba(167,139,250,0.12)' };

const fmtINR = v => v >= 1e7 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${(v/1e5).toFixed(1)}L` : `₹${(v||0).toLocaleString('en-IN')}`;
const fmtPct = v => `${(v||0).toFixed(1)}%`;

const Badge = ({ label }) => {
  const t = (label||'').toUpperCase();
  const c = t.includes('OPTIMISTIC') || t.includes('REGULAR') || t.includes('LOW') ? 'pass'
    : t.includes('BASE') || t.includes('MEDIUM') || t.includes('SPOT') ? 'maybe'
    : t.includes('CONSERVATIVE') || t.includes('HIGH') ? 'cyan'
    : t.includes('BROKER') || t.includes('MIXED') ? 'purple' : 'blue';
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:600, background:RGB[c], color:COLORS[c], border:`1px solid ${COLORS[c]}50` }}>{label||'-'}</span>;
};

const KPI = ({ label, value, color='#60a5fa', sub='' }) => (
  <div style={{ background:'#111827', border:'1px solid rgba(148,163,184,0.08)', borderRadius:'10px', padding:'14px 18px', textAlign:'center' }}>
    <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>{label}</div>
    <div style={{ fontSize:'26px', fontWeight:700, color }}>{value}</div>
    {sub && <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'2px' }}>{sub}</div>}
  </div>
);

export default function FinancialProjections() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scenarioFilter, setScenarioFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [minROI, setMinROI] = useState('');
  const [sortCol, setSortCol] = useState('roi_year1_pct');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from('financial_projections').select('*');
      setData(d || []);
      setLoading(false);
    })();
  }, []);

  const agg = useMemo(() => {
    const scenarios = ['conservative','base','optimistic'];
    const result = {};
    scenarios.forEach(s => {
      const rows = data.filter(r => r.scenario === s);
      result[s] = {
        count: rows.length,
        revenue: rows.reduce((a,r) => a + (r.year1_revenue_inr||0), 0),
        profit: rows.reduce((a,r) => a + (r.year1_net_profit_inr||0), 0),
        avgROI: rows.reduce((a,r) => a + (r.roi_year1_pct||0), 0) / Math.max(rows.length,1),
        avgMargin: rows.reduce((a,r) => a + (r.gross_margin_pct||0), 0) / Math.max(rows.length,1),
        avgBE: rows.reduce((a,r) => a + (r.break_even_months||0), 0) / Math.max(rows.length,1),
        totalWC: rows.reduce((a,r) => a + (r.total_working_capital_inr||0), 0),
      };
    });
    return result;
  }, [data]);

  const filtered = useMemo(() => {
    let f = data;
    if (search) f = f.filter(r => (r.hs4||'').includes(search) || (r.product_desc||'').toLowerCase().includes(search.toLowerCase()));
    if (scenarioFilter) f = f.filter(r => r.scenario === scenarioFilter);
    if (modelFilter) f = f.filter(r => r.trading_model === modelFilter);
    if (minROI) f = f.filter(r => (r.roi_year1_pct||0) >= Number(minROI));
    f = [...f].sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return f;
  }, [data, search, scenarioFilter, modelFilter, minROI, sortCol, sortDir]);

  const handleSort = col => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } };

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading financial projections...</div>;

  const scColors = { conservative:'#22d3ee', base:'#60a5fa', optimistic:'#34d399' };

  const columns = [
    {key:'hs4', label:'HS4'},
    {key:'product_desc', label:'Product'},
    {key:'scenario', label:'Scenario', render:v=><Badge label={v} />},
    {key:'trading_model', label:'Model', render:v=><Badge label={v} />},
    {key:'fob_usd', label:'FOB $', fmt:v=>v?`$${Number(v).toFixed(2)}`:'-'},
    {key:'total_duty_pct', label:'Duty%', fmt:v=>v?`${Number(v).toFixed(1)}%`:'-'},
    {key:'landed_cost_inr', label:'Landed INR', fmt:v=>v?fmtINR(v):'-'},
    {key:'selling_price_inr', label:'Sell INR', fmt:v=>v?fmtINR(v):'-'},
    {key:'gross_margin_pct', label:'Margin%', render:v=><span style={{color:v>=25?'#34d399':v>=15?'#fbbf24':v>=10?'#fb923c':'#f87171', fontWeight:700}}>{v?`${Number(v).toFixed(1)}%`:'-'}</span>},
    {key:'month1_units', label:'M1 Units', fmt:v=>v?Number(v).toLocaleString():'-'},
    {key:'month12_units', label:'M12 Units', fmt:v=>v?Number(v).toLocaleString():'-'},
    {key:'year1_revenue_inr', label:'Y1 Revenue', fmt:v=>v?fmtINR(v):'-'},
    {key:'year1_net_profit_inr', label:'Y1 Profit', fmt:v=>v?fmtINR(v):'-'},
    {key:'roi_year1_pct', label:'ROI%', fmt:v=>v?`${Number(v).toFixed(0)}%`:'-'},
    {key:'break_even_months', label:'B/E Mo', fmt:v=>v?Number(v).toFixed(1):'-'},
    {key:'cash_cycle_days', label:'Cash Cycle', fmt:v=>v||'-'},
    {key:'total_working_capital_inr', label:'WC INR', fmt:v=>v?fmtINR(v):'-'},
    {key:'fx_risk_level', label:'FX Risk', render:v=><Badge label={v} />},
    {key:'demand_risk_level', label:'Demand Risk', render:v=><Badge label={v} />},
  ];

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px', marginBottom:'16px' }}>
        <KPI label="Products" value={agg.base?.count||0} color="#60a5fa" sub="×3 scenarios" />
        <KPI label="Base Y1 Revenue" value={fmtINR(agg.base?.revenue||0)} color="#34d399" />
        <KPI label="Base Y1 Profit" value={fmtINR(agg.base?.profit||0)} color="#34d399" />
        <KPI label="Avg ROI (Base)" value={fmtPct(agg.base?.avgROI||0)} color="#22d3ee" />
        <KPI label="Avg Margin" value={fmtPct(agg.base?.avgMargin||0)} color="#fbbf24" />
        <KPI label="Total WC (Base)" value={fmtINR(agg.base?.totalWC||0)} color="#a78bfa" />
      </div>

      {/* Scenario Comparison Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px', marginBottom:'16px' }}>
        {['conservative','base','optimistic'].map(s => (
          <div key={s} style={{ background:'#111827', border:`1px solid ${scColors[s]}40`, borderRadius:'10px', padding:'16px', borderTop:`3px solid ${scColors[s]}` }}>
            <h4 style={{ color:scColors[s], fontSize:'14px', fontWeight:700, marginBottom:'12px', textTransform:'uppercase' }}>{s}</h4>
            {[
              ['Y1 Revenue', fmtINR(agg[s]?.revenue||0)],
              ['Y1 Net Profit', fmtINR(agg[s]?.profit||0)],
              ['Avg ROI', fmtPct(agg[s]?.avgROI||0)],
              ['Avg Margin', fmtPct(agg[s]?.avgMargin||0)],
              ['Avg Break-Even', `${(agg[s]?.avgBE||0).toFixed(1)} mo`],
              ['Working Capital', fmtINR(agg[s]?.totalWC||0)],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:'12px', borderBottom:'1px solid rgba(148,163,184,0.05)' }}>
                <span style={{ color:'#94a3b8' }}>{k}</span>
                <span style={{ color:'#e2e8f0', fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS4, product..." style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px', width:'180px' }} />
        <select value={scenarioFilter} onChange={e=>setScenarioFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Scenarios</option>
          {['conservative','base','optimistic'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={modelFilter} onChange={e=>setModelFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Models</option>
          {['REGULAR','SPOT','BROKER','MIXED'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={minROI} onChange={e=>setMinROI(e.target.value)} placeholder="Min ROI %" type="number" style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px', width:'100px' }} />
        <span style={{ color:'#94a3b8', fontSize:'12px' }}>{filtered.length} rows</span>
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
