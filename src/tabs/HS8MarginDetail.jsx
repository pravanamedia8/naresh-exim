import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis } from 'recharts';

const MV = { EXCELLENT:'#34d399', GOOD:'#60a5fa', MODERATE:'#fbbf24', THIN:'#f59e0b', NEGATIVE:'#f87171', UNIT_MISMATCH:'#a78bfa', NO_DATA:'#64748b' };
const card = { background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20 };
const fmt = (v, prefix='', suffix='') => v != null ? `${prefix}${Number(v).toLocaleString('en-IN')}${suffix}` : '-';
const fmtUSD = v => v != null ? (v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${Number(v).toLocaleString()}`) : '-';
const fmtINR = v => v != null ? `₹${Number(v).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '-';
const PAGE_SIZE = 50;

export default function HS8MarginDetail() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [view, setView] = useState('table');

  // Filters
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [hs4Filter, setHs4Filter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [dispersionFilter, setDispersionFilter] = useState('all');
  const [minMargin, setMinMargin] = useState('');
  const [maxMargin, setMaxMargin] = useState('');
  const [researchFilter, setResearchFilter] = useState('all');
  const [sort, setSort] = useState({ col: 'total_cif_usd', dir: 'desc' });
  const [page, setPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: d } = await supabase.from('hs8_margin_analysis').select('*').order('total_cif_usd', { ascending: false });
      setData(d || []);
      setLoading(false);
    };
    load();
  }, []);

  // Derived data
  const hs4List = useMemo(() => {
    const m = {};
    data.forEach(r => { if (r.hs4) m[r.hs4] = (m[r.hs4] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const unitList = useMemo(() => {
    const m = {};
    data.forEach(r => { if (r.dominant_unit) m[r.dominant_unit] = (m[r.dominant_unit] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filtered = useMemo(() => {
    let f = [...data];
    if (verdictFilter !== 'all') f = f.filter(r => r.margin_verdict === verdictFilter);
    if (hs4Filter !== 'all') f = f.filter(r => r.hs4 === hs4Filter);
    if (unitFilter !== 'all') f = f.filter(r => r.dominant_unit === unitFilter);
    if (dispersionFilter !== 'all') f = f.filter(r => r.rate_dispersion === dispersionFilter);
    if (researchFilter === 'completed') f = f.filter(r => r.selling_price_research_status === 'completed');
    if (researchFilter === 'pending') f = f.filter(r => r.selling_price_research_status !== 'completed');
    if (minMargin !== '') f = f.filter(r => r.real_margin_pct != null && r.real_margin_pct >= Number(minMargin));
    if (maxMargin !== '') f = f.filter(r => r.real_margin_pct != null && r.real_margin_pct <= Number(maxMargin));
    if (search) {
      const s = search.toLowerCase();
      f = f.filter(r => (r.hs8 + ' ' + r.hs4 + ' ' + (r.commodity || '')).toLowerCase().includes(s));
    }
    f.sort((a, b) => {
      let av = a[sort.col], bv = b[sort.col];
      if (av == null) av = sort.dir === 'desc' ? -Infinity : Infinity;
      if (bv == null) bv = sort.dir === 'desc' ? -Infinity : Infinity;
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv || '').toLowerCase(); }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return f;
  }, [data, verdictFilter, hs4Filter, unitFilter, dispersionFilter, researchFilter, minMargin, maxMargin, search, sort]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // KPI calculations
  const stats = useMemo(() => {
    const viableVerdicts = ['EXCELLENT', 'GOOD', 'MODERATE'];
    const viable = data.filter(r => viableVerdicts.includes(r.margin_verdict));
    const withMargin = data.filter(r => r.real_margin_pct != null && r.real_margin_pct > -1000);
    const avgM = withMargin.length ? withMargin.reduce((a, r) => a + r.real_margin_pct, 0) / withMargin.length : 0;
    const totalCIF = data.reduce((a, r) => a + (r.total_cif_usd || 0), 0);
    const viableCIF = viable.reduce((a, r) => a + (r.total_cif_usd || 0), 0);
    const researched = data.filter(r => r.selling_price_research_status === 'completed').length;
    const withLanded = data.filter(r => r.median_landed_cost_inr != null).length;
    return { total: data.length, viable: viable.length, avgM, totalCIF, viableCIF, researched, withLanded, viableVerdicts };
  }, [data]);

  const verdictCounts = useMemo(() => {
    const m = {};
    data.forEach(r => { m[r.margin_verdict || 'UNKNOWN'] = (m[r.margin_verdict || 'UNKNOWN'] || 0) + 1; });
    return m;
  }, [data]);

  const verdictChartData = ['EXCELLENT', 'GOOD', 'MODERATE', 'THIN', 'NEGATIVE', 'UNIT_MISMATCH', 'NO_DATA']
    .filter(v => verdictCounts[v])
    .map(v => ({ name: v, count: verdictCounts[v] || 0, fill: MV[v] || '#64748b' }));

  const top20Margin = useMemo(() =>
    data.filter(r => r.real_margin_pct != null && r.real_margin_pct > 0 && r.real_margin_pct < 200)
      .sort((a, b) => (b.real_margin_pct || 0) - (a.real_margin_pct || 0))
      .slice(0, 20)
      .map(r => ({
        name: r.hs8,
        margin: Number(r.real_margin_pct?.toFixed(1)),
        fill: MV[r.margin_verdict] || '#94a3b8'
      })),
    [data]
  );

  const hs4Summary = useMemo(() => {
    const m = {};
    data.forEach(r => {
      if (!r.hs4) return;
      if (!m[r.hs4]) m[r.hs4] = { hs4: r.hs4, codes: 0, viable: 0, cif: 0, avgMargin: 0, mSum: 0, mCount: 0 };
      m[r.hs4].codes++;
      if (['EXCELLENT', 'GOOD', 'MODERATE'].includes(r.margin_verdict)) m[r.hs4].viable++;
      m[r.hs4].cif += r.total_cif_usd || 0;
      if (r.real_margin_pct != null && r.real_margin_pct > -1000) { m[r.hs4].mSum += r.real_margin_pct; m[r.hs4].mCount++; }
    });
    return Object.values(m).map(v => ({ ...v, avgMargin: v.mCount ? v.mSum / v.mCount : null })).sort((a, b) => b.cif - a.cif);
  }, [data]);

  const toggleSort = col => {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(0);
  };
  const resetFilters = () => {
    setSearch(''); setVerdictFilter('all'); setHs4Filter('all'); setUnitFilter('all');
    setDispersionFilter('all'); setMinMargin(''); setMaxMargin(''); setResearchFilter('all');
    setPage(0);
  };

  if (loading) return <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center' }}>Loading 556 HS8 codes with margin data...</div>;

  const thBase = {
    textAlign: 'left', padding: '8px 8px', color: '#94a3b8', fontSize: 10, borderBottom: '1px solid rgba(148,163,184,0.15)',
    cursor: 'pointer', position: 'sticky', top: 0, background: 'rgba(11,15,25,0.98)', textTransform: 'uppercase', whiteSpace: 'nowrap',
    userSelect: 'none'
  };
  const tdBase = { padding: '6px 8px', fontSize: 11, borderBottom: '1px solid rgba(148,163,184,0.04)' };
  const selStyle = { background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, padding: '5px 8px', fontSize: 11 };
  const inputStyle = { ...selStyle, width: 60 };

  const columns = [
    { key: 'hs8', label: 'HS8 Code', w: 85 },
    { key: 'hs4', label: 'HS4', w: 50 },
    { key: 'commodity', label: 'Product', w: 200 },
    { key: 'dominant_unit', label: 'Unit', w: 50 },
    { key: 'shipment_count', label: 'Ships', w: 55 },
    { key: 'unique_buyers', label: 'Buyers', w: 55 },
    { key: 'total_cif_usd', label: 'CIF Value', w: 85 },
    { key: 'median_unit_rate_usd', label: 'Median Rate $', w: 85 },
    { key: 'median_landed_cost_inr', label: 'Landed INR', w: 90 },
    { key: 'indiamart_sell_price_inr', label: 'IndiaMART', w: 80 },
    { key: 'price_consensus_inr', label: 'Consensus', w: 80 },
    { key: 'real_margin_pct', label: 'Margin %', w: 70 },
    { key: 'real_margin_inr', label: 'Margin INR', w: 80 },
    { key: 'margin_verdict', label: 'Verdict', w: 85 },
    { key: 'total_duty_pct', label: 'Duty %', w: 60 },
    { key: 'rate_dispersion', label: 'Disprsn', w: 60 },
    { key: 'selling_price_research_status', label: 'Research', w: 75 },
  ];

  const renderCell = (r, col) => {
    const v = r[col.key];
    switch (col.key) {
      case 'hs8': return <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>;
      case 'hs4': return <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{v}</span>;
      case 'commodity': return <span style={{ color: '#e2e8f0', maxWidth: col.w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={v}>{v?.replace(/^\s+/, '').substring(0, 50)}</span>;
      case 'dominant_unit': return <span style={{ color: '#94a3b8' }}>{v || '-'}</span>;
      case 'shipment_count':
      case 'unique_buyers': return <span style={{ color: '#94a3b8' }}>{v ? v.toLocaleString() : '-'}</span>;
      case 'total_cif_usd': return <span style={{ color: '#a78bfa', fontWeight: 500 }}>{fmtUSD(v)}</span>;
      case 'median_unit_rate_usd': return <span style={{ color: '#e2e8f0' }}>{v != null ? `$${Number(v).toFixed(2)}` : '-'}</span>;
      case 'median_landed_cost_inr': return <span style={{ color: '#f0abfc' }}>{fmtINR(v)}</span>;
      case 'indiamart_sell_price_inr':
      case 'price_consensus_inr': return <span style={{ color: v ? '#34d399' : '#4b5563' }}>{fmtINR(v)}</span>;
      case 'real_margin_pct': {
        if (v == null) return <span style={{ color: '#4b5563' }}>-</span>;
        const c = v > 25 ? '#34d399' : v > 10 ? '#fbbf24' : '#f87171';
        return <span style={{ color: c, fontWeight: 700 }}>{Number(v).toFixed(1)}%</span>;
      }
      case 'real_margin_inr': return <span style={{ color: v > 0 ? '#34d399' : v < 0 ? '#f87171' : '#4b5563' }}>{fmtINR(v)}</span>;
      case 'margin_verdict': {
        if (!v) return <span style={{ color: '#4b5563' }}>-</span>;
        return <span style={{ background: `${MV[v] || '#64748b'}22`, color: MV[v] || '#64748b', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, border: `1px solid ${MV[v] || '#64748b'}44` }}>{v}</span>;
      }
      case 'total_duty_pct': return <span style={{ color: v > 30 ? '#f87171' : v > 15 ? '#fbbf24' : '#94a3b8' }}>{v ? `${Number(v).toFixed(1)}%` : '-'}</span>;
      case 'rate_dispersion': {
        const c = v === 'LOW' ? '#34d399' : v === 'MODERATE' ? '#fbbf24' : v === 'HIGH' ? '#f87171' : '#4b5563';
        return <span style={{ color: c, fontSize: 9 }}>{v || '-'}</span>;
      }
      case 'selling_price_research_status': {
        const done = v === 'completed';
        return <span style={{ color: done ? '#34d399' : '#fbbf24', fontSize: 9 }}>{done ? 'DONE' : 'PENDING'}</span>;
      }
      default: return <span style={{ color: '#94a3b8' }}>{v ?? '-'}</span>;
    }
  };

  const renderExpandedRow = (r) => {
    const sources = [
      { name: 'IndiaMART', price: r.indiamart_sell_price_inr, low: r.indiamart_price_low_inr, high: r.indiamart_price_high_inr, sellers: r.indiamart_seller_count, unit: r.indiamart_unit, url: r.indiamart_source_url },
      { name: 'TradeIndia', price: r.tradeindia_sell_price_inr, low: r.tradeindia_price_low_inr, high: r.tradeindia_price_high_inr, sellers: r.tradeindia_seller_count, unit: r.tradeindia_unit, url: r.tradeindia_source_url },
      { name: 'Amazon.in', price: r.amazon_sell_price_inr, low: r.amazon_price_low_inr, high: r.amazon_price_high_inr, sellers: r.amazon_seller_count, unit: r.amazon_unit, url: r.amazon_source_url },
      { name: 'Moglix', price: r.moglix_sell_price_inr, low: r.moglix_price_low_inr, high: r.moglix_price_high_inr, sellers: r.moglix_seller_count, unit: r.moglix_unit, url: r.moglix_source_url },
      { name: 'IndustryBuying', price: r.industbuy_sell_price_inr, low: r.industbuy_price_low_inr, high: r.industbuy_price_high_inr, sellers: null, unit: r.industbuy_unit, url: r.industbuy_source_url },
    ];
    const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 };
    const miniCard = { background: 'rgba(30,41,59,0.6)', borderRadius: 8, padding: 12 };
    const label = { color: '#64748b', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 };
    const val = { color: '#e2e8f0', fontSize: 13, fontWeight: 600 };

    return (
      <tr>
        <td colSpan={columns.length} style={{ padding: 0, background: 'rgba(17,24,39,0.95)' }}>
          <div style={{ padding: '16px 20px', borderLeft: `3px solid ${MV[r.margin_verdict] || '#64748b'}` }}>
            <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              {r.hs8} — {r.commodity?.replace(/^\s+/, '').substring(0, 80)}
            </div>

            {/* Cost & Margin Section */}
            <div style={{ ...grid3, marginBottom: 16 }}>
              <div style={miniCard}>
                <div style={label}>Import Cost (Median)</div>
                <div style={val}>{r.median_unit_rate_usd != null ? `$${Number(r.median_unit_rate_usd).toFixed(2)}` : '-'} / {r.dominant_unit || '?'}</div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
                  P25: ${r.p25_unit_rate_usd?.toFixed(2) || '-'} | P75: ${r.p75_unit_rate_usd?.toFixed(2) || '-'}
                </div>
                <div style={{ color: '#64748b', fontSize: 10 }}>IQR Ratio: {r.iqr_ratio?.toFixed(1) || '-'}x | Dispersion: {r.rate_dispersion || '-'}</div>
              </div>
              <div style={miniCard}>
                <div style={label}>Landed Cost INR</div>
                <div style={val}>{fmtINR(r.median_landed_cost_inr)}</div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
                  Duty: {r.total_duty_pct ? `${r.total_duty_pct.toFixed(1)}%` : '-'} (BCD {r.bcd_pct || '-'}% + IGST {r.igst_pct || '-'}%)
                </div>
                <div style={{ color: '#64748b', fontSize: 10 }}>Exchange: ₹{r.exchange_rate || 85}/USD</div>
              </div>
              <div style={miniCard}>
                <div style={label}>Margin Analysis</div>
                <div style={{ ...val, color: MV[r.margin_verdict] || '#64748b' }}>
                  {r.real_margin_pct != null ? `${r.real_margin_pct.toFixed(1)}%` : '-'} — {r.margin_verdict || 'UNKNOWN'}
                </div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
                  Margin INR: {fmtINR(r.real_margin_inr)} | Consensus: {fmtINR(r.price_consensus_inr)}
                </div>
                <div style={{ color: '#64748b', fontSize: 10 }}>Confidence: {r.price_confidence || '-'} | Sources: {r.source_count || 0}</div>
              </div>
            </div>

            {/* Market Info */}
            <div style={{ ...grid3, marginBottom: 16 }}>
              <div style={miniCard}>
                <div style={label}>Market Size</div>
                <div style={val}>{fmtUSD(r.total_cif_usd)}</div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
                  {r.shipment_count?.toLocaleString() || '-'} shipments | {r.unique_buyers?.toLocaleString() || '-'} buyers | {r.unique_shippers?.toLocaleString() || '-'} shippers
                </div>
              </div>
              <div style={miniCard}>
                <div style={label}>China Sourcing</div>
                <div style={{ ...val, color: r.china_pct > 60 ? '#34d399' : '#fbbf24' }}>{r.china_pct ? `${r.china_pct.toFixed(0)}%` : '-'}</div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
                  Regulatory: {r.regulatory_risk || '-'} | BIS: {r.bis_required ? 'Required' : 'No'} | ADD: {r.add_applicable ? 'Yes' : 'No'}
                </div>
              </div>
              <div style={miniCard}>
                <div style={label}>Data Quality</div>
                <div style={{ ...val, fontSize: 11 }}>Rate: {r.rate_data_quality || '-'} | Duty: {r.duty_data_quality || '-'}</div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
                  Filtered: {r.filtered_shipment_count?.toLocaleString() || '-'} | Captive: {r.captive_pct ? `${r.captive_pct.toFixed(1)}%` : '-'}
                </div>
              </div>
            </div>

            {/* Multi-Source Prices */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...label, marginBottom: 8, fontSize: 11, color: '#94a3b8' }}>Selling Price Sources</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {sources.map(s => (
                  <div key={s.name} style={{ ...miniCard, padding: 10, borderLeft: s.price ? '2px solid #34d399' : '2px solid #374151' }}>
                    <div style={{ color: s.price ? '#e2e8f0' : '#4b5563', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ color: s.price ? '#34d399' : '#4b5563', fontSize: 13, fontWeight: 700 }}>{fmtINR(s.price)}</div>
                    {(s.low || s.high) && <div style={{ color: '#64748b', fontSize: 9 }}>{fmtINR(s.low)} — {fmtINR(s.high)}</div>}
                    {s.sellers != null && <div style={{ color: '#64748b', fontSize: 9 }}>{s.sellers.toLocaleString()} sellers</div>}
                    {s.unit && <div style={{ color: '#64748b', fontSize: 9 }}>Per {s.unit}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {r.notes && <div style={{ background: 'rgba(30,41,59,0.4)', borderRadius: 6, padding: 10, marginTop: 8 }}>
              <div style={{ ...label, marginBottom: 4 }}>Notes</div>
              <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.5 }}>{r.notes}</div>
            </div>}
          </div>
        </td>
      </tr>
    );
  };

  // HS4 Summary View
  const renderHS4Summary = () => (
    <div style={card}>
      <h3 style={{ color: '#e2e8f0', fontSize: 14, marginBottom: 16 }}>HS4 Category Summary ({hs4Summary.length} groups)</h3>
      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {[['hs4','HS4'],['codes','HS8 Codes'],['viable','Viable'],['cif','Total CIF'],['avgMargin','Avg Margin %']].map(([k,l]) => (
              <th key={k} style={thBase}>{l}</th>
            ))}
          </tr></thead>
          <tbody>{hs4Summary.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)', cursor: 'pointer' }}
              onClick={() => { setHs4Filter(r.hs4); setView('table'); setPage(0); }}>
              <td style={{ ...tdBase, color: '#60a5fa', fontFamily: 'monospace', fontWeight: 600 }}>{r.hs4}</td>
              <td style={{ ...tdBase, color: '#94a3b8' }}>{r.codes}</td>
              <td style={{ ...tdBase, color: r.viable > 0 ? '#34d399' : '#4b5563', fontWeight: 600 }}>{r.viable}</td>
              <td style={{ ...tdBase, color: '#a78bfa' }}>{fmtUSD(r.cif)}</td>
              <td style={{ ...tdBase, color: r.avgMargin > 25 ? '#34d399' : r.avgMargin > 10 ? '#fbbf24' : r.avgMargin != null ? '#f87171' : '#4b5563', fontWeight: 600 }}>
                {r.avgMargin != null ? `${r.avgMargin.toFixed(1)}%` : '-'}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total HS8 Codes', value: stats.total, color: '#60a5fa' },
          { label: 'Viable (E+G+M)', value: stats.viable, sub: `${(stats.viable / stats.total * 100).toFixed(0)}%`, color: '#34d399' },
          { label: 'EXCELLENT', value: verdictCounts.EXCELLENT || 0, color: MV.EXCELLENT },
          { label: 'GOOD', value: verdictCounts.GOOD || 0, color: MV.GOOD },
          { label: 'NEGATIVE', value: verdictCounts.NEGATIVE || 0, color: MV.NEGATIVE },
          { label: 'Total CIF', value: fmtUSD(stats.totalCIF), color: '#a78bfa' },
          { label: 'Viable CIF', value: fmtUSD(stats.viableCIF), color: '#34d399' },
          { label: 'Price Researched', value: stats.researched, sub: `of ${stats.total}`, color: '#06b6d4' },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding: 14, borderTop: `3px solid ${k.color}` }}>
            <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: 24, fontWeight: 700, marginTop: 2 }}>{k.value}</div>
            {k.sub && <div style={{ color: '#4b5563', fontSize: 10 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['table', '📊 Detail Table'], ['charts', '📈 Charts'], ['hs4', '📦 By HS4']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{ background: view === id ? '#3b82f6' : '#1e293b', color: view === id ? '#fff' : '#94a3b8', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Charts View */}
      {view === 'charts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', fontSize: 13, marginBottom: 12 }}>Verdict Distribution</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={verdictChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, count }) => `${name} (${count})`} labelLine={true} fontSize={10}>
                  {verdictChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', color: '#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', fontSize: 13, marginBottom: 12 }}>Top 20 by Margin %</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top20Margin} layout="vertical">
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} width={70} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', color: '#e2e8f0' }} formatter={v => [`${v}%`, 'Margin']} />
                <Bar dataKey="margin">{top20Margin.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...card, gridColumn: '1 / -1' }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 13, marginBottom: 12 }}>Margin % vs CIF Value (Bubble = Buyers)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <XAxis type="number" dataKey="x" name="CIF $M" tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'CIF $M', fill: '#64748b', fontSize: 10, position: 'bottom' }} />
                <YAxis type="number" dataKey="y" name="Margin %" tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[-50, 100]} label={{ value: 'Margin %', fill: '#64748b', fontSize: 10, angle: -90 }} />
                <ZAxis type="number" dataKey="z" range={[20, 300]} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', color: '#e2e8f0' }}
                  formatter={(v, n) => [n === 'CIF $M' ? `$${Number(v).toFixed(1)}M` : n === 'Margin %' ? `${Number(v).toFixed(1)}%` : v, n]}
                  labelFormatter={l => l} />
                <Scatter data={
                  data.filter(r => r.real_margin_pct != null && r.total_cif_usd && r.real_margin_pct > -100 && r.real_margin_pct < 150)
                    .map(r => ({ x: r.total_cif_usd / 1e6, y: r.real_margin_pct, z: Math.min(r.unique_buyers || 5, 500), name: r.hs8, fill: MV[r.margin_verdict] || '#64748b' }))
                }>
                  {data.filter(r => r.real_margin_pct != null && r.total_cif_usd && r.real_margin_pct > -100 && r.real_margin_pct < 150)
                    .map((r, i) => <Cell key={i} fill={MV[r.margin_verdict] || '#64748b'} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* HS4 Summary View */}
      {view === 'hs4' && renderHS4Summary()}

      {/* Table View */}
      {view === 'table' && (
        <div style={card}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>HS8 Codes ({filtered.length})</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search HS8/HS4/product..."
              style={{ ...selStyle, flex: 1, minWidth: 160 }} />
            <select value={verdictFilter} onChange={e => { setVerdictFilter(e.target.value); setPage(0); }} style={selStyle}>
              <option value="all">All Verdicts</option>
              {['EXCELLENT', 'GOOD', 'MODERATE', 'THIN', 'NEGATIVE', 'UNIT_MISMATCH', 'NO_DATA'].map(v =>
                <option key={v} value={v}>{v} ({verdictCounts[v] || 0})</option>
              )}
            </select>
            <select value={hs4Filter} onChange={e => { setHs4Filter(e.target.value); setPage(0); }} style={selStyle}>
              <option value="all">All HS4</option>
              {hs4List.map(([k, c]) => <option key={k} value={k}>{k} ({c})</option>)}
            </select>
            <select value={unitFilter} onChange={e => { setUnitFilter(e.target.value); setPage(0); }} style={selStyle}>
              <option value="all">All Units</option>
              {unitList.map(([k, c]) => <option key={k} value={k}>{k} ({c})</option>)}
            </select>
            <select value={dispersionFilter} onChange={e => { setDispersionFilter(e.target.value); setPage(0); }} style={selStyle}>
              <option value="all">All Dispersion</option>
              {['LOW', 'MODERATE', 'HIGH'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={researchFilter} onChange={e => { setResearchFilter(e.target.value); setPage(0); }} style={selStyle}>
              <option value="all">All Research</option>
              <option value="completed">Researched</option>
              <option value="pending">Pending</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#64748b', fontSize: 10 }}>Margin</span>
              <input value={minMargin} onChange={e => { setMinMargin(e.target.value); setPage(0); }} placeholder="Min" style={inputStyle} type="number" />
              <span style={{ color: '#64748b' }}>—</span>
              <input value={maxMargin} onChange={e => { setMaxMargin(e.target.value); setPage(0); }} placeholder="Max" style={inputStyle} type="number" />
            </div>
            <button onClick={resetFilters} style={{ ...selStyle, cursor: 'pointer', color: '#f87171', background: 'rgba(248,113,113,0.1)' }}>Reset</button>
          </div>

          {/* Table */}
          <div style={{ maxHeight: 600, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
              <thead><tr>
                <th style={{ ...thBase, width: 30 }}></th>
                {columns.map(c => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} style={{ ...thBase, width: c.w }}>
                    {c.label}{sort.col === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {paged.map((r, i) => (
                  <>
                    <tr key={r.hs8} style={{ borderBottom: '1px solid rgba(148,163,184,0.04)', cursor: 'pointer', background: expanded === r.hs8 ? 'rgba(59,130,246,0.08)' : 'transparent' }}
                      onClick={() => setExpanded(expanded === r.hs8 ? null : r.hs8)}>
                      <td style={{ ...tdBase, color: '#4b5563', textAlign: 'center' }}>{expanded === r.hs8 ? '▼' : '▶'}</td>
                      {columns.map(c => <td key={c.key} style={{ ...tdBase, maxWidth: c.w }}>{renderCell(r, c)}</td>)}
                    </tr>
                    {expanded === r.hs8 && renderExpandedRow(r)}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '8px 0' }}>
              <span style={{ color: '#64748b', fontSize: 11 }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPage(0)} disabled={page === 0} style={{ ...selStyle, cursor: 'pointer', opacity: page === 0 ? 0.3 : 1 }}>First</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ ...selStyle, cursor: 'pointer', opacity: page === 0 ? 0.3 : 1 }}>Prev</button>
                <span style={{ color: '#94a3b8', fontSize: 11, padding: '5px 8px' }}>Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ ...selStyle, cursor: 'pointer', opacity: page >= totalPages - 1 ? 0.3 : 1 }}>Next</button>
                <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} style={{ ...selStyle, cursor: 'pointer', opacity: page >= totalPages - 1 ? 0.3 : 1 }}>Last</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
