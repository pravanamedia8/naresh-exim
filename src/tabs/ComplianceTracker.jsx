import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const COLORS = { pass:'#34d399', maybe:'#fbbf24', drop:'#f87171', blue:'#60a5fa', cyan:'#22d3ee', orange:'#fb923c', purple:'#a78bfa' };
const RGB = { pass:'rgba(52,211,153,0.12)', maybe:'rgba(251,191,36,0.12)', drop:'rgba(248,113,113,0.12)', blue:'rgba(96,165,250,0.12)', cyan:'rgba(34,211,238,0.12)', orange:'rgba(251,146,60,0.12)', purple:'rgba(167,139,250,0.12)' };

const fmtINR = v => v >= 1e5 ? `₹${(v/1e5).toFixed(1)}L` : `₹${(v||0).toLocaleString('en-IN')}`;

const Badge = ({ label }) => {
  const t = (label||'').toUpperCase();
  const c = t.includes('APPROVED') || t.includes('VALID') ? 'pass'
    : t.includes('PROGRESS') || t.includes('PENDING') || t.includes('BIS') ? 'maybe'
    : t.includes('EXPIRED') || t.includes('REJECT') || t.includes('FAIL') ? 'drop'
    : t.includes('NOT_START') ? 'purple'
    : t.includes('EPR') || t.includes('WPC') || t.includes('TEC') ? 'cyan' : 'blue';
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:600, background:RGB[c], color:COLORS[c], border:`1px solid ${COLORS[c]}50` }}>{label||'-'}</span>;
};

const KPI = ({ label, value, color='#60a5fa' }) => (
  <div style={{ background:'#111827', border:'1px solid rgba(148,163,184,0.08)', borderRadius:'10px', padding:'14px 18px', textAlign:'center' }}>
    <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>{label}</div>
    <div style={{ fontSize:'26px', fontWeight:700, color }}>{value}</div>
  </div>
);

export default function ComplianceTracker() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortCol, setSortCol] = useState('hs4');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from('compliance_tracker').select('*');
      setData(d || []);
      setLoading(false);
    })();
  }, []);

  const types = useMemo(() => [...new Set(data.map(r=>r.cert_type).filter(Boolean))].sort(), [data]);
  const statusCounts = useMemo(() => {
    const c = {};
    data.forEach(r => { c[r.status] = (c[r.status]||0)+1; });
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    let f = data;
    if (search) f = f.filter(r => (r.hs4||'').includes(search) || (r.product_desc||'').toLowerCase().includes(search.toLowerCase()) || (r.cert_type||'').toLowerCase().includes(search.toLowerCase()));
    if (typeFilter) f = f.filter(r => r.cert_type === typeFilter);
    if (statusFilter) f = f.filter(r => r.status === statusFilter);
    f = [...f].sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1; if (bv == null) return -1;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return f;
  }, [data, search, typeFilter, statusFilter, sortCol, sortDir]);

  const handleSort = col => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } };

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading compliance data...</div>;

  const columns = [
    {key:'hs4', label:'HS4'},
    {key:'hs8_code', label:'HS8'},
    {key:'product_desc', label:'Product'},
    {key:'cert_type', label:'Cert Type', render:v=><Badge label={v} />},
    {key:'status', label:'Status', render:v=><Badge label={v?.replace(/_/g,' ')} />},
    {key:'estimated_cost_inr', label:'Est Cost', fmt:v=>v?fmtINR(v):'-'},
    {key:'actual_cost_inr', label:'Actual', fmt:v=>v?fmtINR(v):'-'},
    {key:'estimated_weeks', label:'Est Wk', fmt:v=>v||'-'},
    {key:'actual_weeks', label:'Act Wk', fmt:v=>v||'-'},
    {key:'certifying_body', label:'Body'},
    {key:'testing_lab', label:'Lab'},
    {key:'application_date', label:'Applied'},
    {key:'cert_received_date', label:'Received'},
    {key:'cert_expiry_date', label:'Expiry'},
    {key:'blocking_issue', label:'Blocker'},
    {key:'notes', label:'Notes'},
  ];

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'10px', marginBottom:'16px' }}>
        <KPI label="Total Certs" value={data.length} color="#60a5fa" />
        <KPI label="Approved" value={statusCounts['approved']||0} color="#34d399" />
        <KPI label="In Progress" value={statusCounts['in_progress']||0} color="#fbbf24" />
        <KPI label="Not Started" value={statusCounts['not_started']||0} color="#a78bfa" />
        <KPI label="Est Total Cost" value={fmtINR(data.reduce((s,r)=>s+(r.estimated_cost_inr||0),0))} color="#22d3ee" />
        <KPI label="Unique Types" value={types.length} color="#fb923c" />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS4, product, cert..." style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px', width:'200px' }} />
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid rgba(148,163,184,0.15)', background:'#1a2035', color:'#e2e8f0', fontSize:'12px' }}>
          <option value="">All Status</option>
          {['approved','in_progress','not_started','pending','expired','rejected'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <span style={{ color:'#94a3b8', fontSize:'12px' }}>{filtered.length} certs</span>
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
