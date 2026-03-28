import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Treemap } from 'recharts';

const C = { pass: '#34d399', strong: '#60a5fa', moderate: '#fbbf24', drop: '#f87171', bg2: '#111827', bg3: '#1a2035', tx1: '#e2e8f0', tx2: '#94a3b8', border: 'rgba(148,163,184,0.08)', cyan: '#22d3ee', orange: '#fb923c', purple: '#a78bfa' };
const VERDICT_C = { PURSUE: C.pass, STRONG: C.strong, MODERATE: C.moderate, DROP: C.drop, MIXED: C.cyan };
const PIE_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#f472b6', '#818cf8', '#38bdf8'];

const fmt = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });
const fmtUSD = (n, d = 0) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const fmtPct = (n) => n == null ? '—' : Number(n).toFixed(1) + '%';

const Badge = ({ label, color }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${color}20`, color, border: `1px solid ${color}50` }}>{label}</span>
);

const verdictBadge = v => {
  const c = VERDICT_C[v] || C.tx2;
  return <Badge label={v || '—'} color={c} />;
};

const priorityBadge = p => {
  const c = p === 'HIGH' ? C.pass : p === 'MEDIUM' ? C.moderate : p === 'LOW' ? C.drop : C.tx2;
  return <Badge label={p || '—'} color={c} />;
};

export default function HS8DeepDive() {
  const [products, setProducts] = useState([]);
  const [countries, setCountries] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('overview');
  const [filterHS4, setFilterHS4] = useState('ALL');
  const [filterVerdict, setFilterVerdict] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState('total_score');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedHS8, setSelectedHS8] = useState(null);
  const [buyerSort, setBuyerSort] = useState('total_cif_usd');

  useEffect(() => {
    (async () => {
      const [p, c, b] = await Promise.all([
        supabase.from('hs8_product_analysis').select('*').order('total_score', { ascending: false }),
        supabase.from('hs8_country_breakdown').select('*').order('total_cif_usd', { ascending: false }),
        supabase.from('hs8_buyer_matrix').select('*').order('total_cif_usd', { ascending: false }),
      ]);
      setProducts(p.data || []);
      setCountries(c.data || []);
      setBuyers(b.data || []);
      setLoading(false);
    })();
  }, []);

  // Derived data
  const hs4List = useMemo(() => [...new Set(products.map(p => p.hs4))].sort(), [products]);
  const verdicts = useMemo(() => [...new Set(products.map(p => p.verdict))].filter(Boolean).sort(), [products]);

  const filtered = useMemo(() => {
    let f = products;
    if (filterHS4 !== 'ALL') f = f.filter(p => p.hs4 === filterHS4);
    if (filterVerdict !== 'ALL') f = f.filter(p => p.verdict === filterVerdict);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      f = f.filter(p => (p.product_desc || '').toLowerCase().includes(s) || (p.hs8_code || '').includes(s));
    }
    return f.sort((a, b) => {
      const av = a[sortCol] ?? -Infinity, bv = b[sortCol] ?? -Infinity;
      return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
    });
  }, [products, filterHS4, filterVerdict, searchTerm, sortCol, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const totalCIF = products.reduce((s, p) => s + (p.total_cif_usd || 0), 0);
    const avgScore = products.length ? (products.reduce((s, p) => s + (p.total_score || 0), 0) / products.length) : 0;
    const pursueCount = products.filter(p => p.verdict === 'PURSUE').length;
    const strongCount = products.filter(p => p.verdict === 'STRONG').length;
    const modCount = products.filter(p => p.verdict === 'MODERATE').length;
    const uniqueHS4 = new Set(products.map(p => p.hs4)).size;
    const uniqueCountries = new Set(countries.map(c => c.country)).size;
    const uniqueBuyers = new Set(buyers.map(b => b.company_name)).size;
    return { totalCIF, avgScore, pursueCount, strongCount, modCount, uniqueHS4, uniqueCountries, uniqueBuyers };
  }, [products, countries, buyers]);

  // Country data for selected HS8
  const selectedCountries = useMemo(() => {
    if (!selectedHS8) return [];
    return countries.filter(c => c.hs8_code === selectedHS8).sort((a, b) => (b.total_cif_usd || 0) - (a.total_cif_usd || 0));
  }, [countries, selectedHS8]);

  const selectedBuyers = useMemo(() => {
    if (!selectedHS8) return [];
    return buyers.filter(b => b.hs8_code === selectedHS8).sort((a, b) => (b[buyerSort] || 0) - (a[buyerSort] || 0));
  }, [buyers, selectedHS8, buyerSort]);

  const selectedProduct = useMemo(() => products.find(p => p.hs8_code === selectedHS8), [products, selectedHS8]);

  // Verdict distribution for pie chart
  const verdictDist = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.verdict || 'UNKNOWN'] = (m[p.verdict || 'UNKNOWN'] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [products]);

  // Top HS4 by product count
  const hs4Dist = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.hs4] = (m[p.hs4] || 0) + 1; });
    return Object.entries(m).map(([hs4, count]) => ({ hs4, count })).sort((a, b) => b.count - a.count).slice(0, 15);
  }, [products]);

  // Top countries across all HS8
  const topCountries = useMemo(() => {
    const m = {};
    countries.forEach(c => {
      if (!m[c.country]) m[c.country] = { country: c.country, totalCIF: 0, shipments: 0, hs8Count: 0 };
      m[c.country].totalCIF += c.total_cif_usd || 0;
      m[c.country].shipments += c.shipment_count || 0;
      m[c.country].hs8Count += 1;
    });
    return Object.values(m).sort((a, b) => b.totalCIF - a.totalCIF).slice(0, 15);
  }, [countries]);

  // Top buyers across all HS8
  const topBuyersAll = useMemo(() => {
    const m = {};
    buyers.forEach(b => {
      const key = b.company_name;
      if (!m[key]) m[key] = { name: key, totalCIF: 0, shipments: 0, hs8Codes: new Set(), city: b.city, state: b.state, priority: b.target_priority };
      m[key].totalCIF += b.total_cif_usd || 0;
      m[key].shipments += b.shipment_count || 0;
      m[key].hs8Codes.add(b.hs8_code);
    });
    return Object.values(m).map(b => ({ ...b, hs8Count: b.hs8Codes.size })).sort((a, b) => b.totalCIF - a.totalCIF).slice(0, 20);
  }, [buyers]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.tx2 }}>Loading HS8 deep dive data...</div>;

  const views = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'products', label: 'Products', icon: '🔬' },
    { id: 'countries', label: 'Countries', icon: '🌍' },
    { id: 'buyers', label: 'Buyers', icon: '🎯' },
  ];

  return (
    <div style={{ padding: '0 8px' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'HS8 Products', val: fmt(products.length), color: C.tx1, sub: `${stats.uniqueHS4} HS4 codes` },
          { label: 'Total CIF', val: fmtUSD(stats.totalCIF, 0), color: C.cyan, sub: '3-month volume' },
          { label: 'PURSUE', val: stats.pursueCount, color: C.pass, sub: 'Top tier' },
          { label: 'STRONG', val: stats.strongCount, color: C.strong, sub: 'Viable' },
          { label: 'MODERATE', val: stats.modCount, color: C.moderate, sub: 'Conditional' },
          { label: 'Avg Score', val: stats.avgScore.toFixed(0) + '/150', color: C.orange, sub: '150-point scale' },
          { label: 'Countries', val: stats.uniqueCountries, color: C.purple, sub: 'Source countries' },
          { label: 'Buyers', val: stats.uniqueBuyers, color: C.pass, sub: 'Unique importers' },
        ].map(k => (
          <div key={k.label} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 10, color: C.tx2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {views.map(v => (
          <button key={v.id} onClick={() => { setView(v.id); setSelectedHS8(null); }}
            style={{ padding: '8px 16px', borderRadius: 8, border: view === v.id ? `1px solid ${C.strong}` : `1px solid ${C.border}`, background: view === v.id ? `${C.strong}20` : C.bg2, color: view === v.id ? C.strong : C.tx2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {/* === OVERVIEW VIEW === */}
      {view === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Verdict Distribution */}
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Verdict Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={verdictDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {verdictDist.map((entry, i) => <Cell key={i} fill={VERDICT_C[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* HS4 Product Count */}
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Top HS4 Codes by HS8 Count</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hs4Dist} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fill: C.tx2, fontSize: 11 }} />
                <YAxis dataKey="hs4" type="category" tick={{ fill: C.tx2, fontSize: 11 }} width={50} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: C.tx1, fontSize: 12 }} />
                <Bar dataKey="count" fill={C.strong} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Countries */}
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Top Source Countries by CIF</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCountries.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fill: C.tx2, fontSize: 11 }} tickFormatter={v => '$' + (v / 1e6).toFixed(1) + 'M'} />
                <YAxis dataKey="country" type="category" tick={{ fill: C.tx2, fontSize: 10 }} width={90} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: C.tx1, fontSize: 12 }} formatter={v => fmtUSD(v)} />
                <Bar dataKey="totalCIF" fill={C.cyan} radius={[0, 4, 4, 0]} name="Total CIF USD" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Buyers */}
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, maxHeight: 360, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Top 20 Buyers Across All HS8</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', color: C.tx2 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', color: C.tx2 }}>Company</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>CIF USD</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>Ship</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>HS8s</th>
                </tr>
              </thead>
              <tbody>
                {topBuyersAll.map((b, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '5px 4px', color: C.tx2 }}>{i + 1}</td>
                    <td style={{ padding: '5px 4px', color: C.tx1, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</td>
                    <td style={{ padding: '5px 4px', color: C.cyan, textAlign: 'right' }}>{fmtUSD(b.totalCIF)}</td>
                    <td style={{ padding: '5px 4px', color: C.tx2, textAlign: 'right' }}>{fmt(b.shipments)}</td>
                    <td style={{ padding: '5px 4px', color: C.purple, textAlign: 'right' }}>{b.hs8Count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === PRODUCTS VIEW === */}
      {view === 'products' && !selectedHS8 && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterHS4} onChange={e => setFilterHS4(e.target.value)} style={{ background: C.bg3, color: C.tx1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
              <option value="ALL">All HS4</option>
              {hs4List.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select value={filterVerdict} onChange={e => setFilterVerdict(e.target.value)} style={{ background: C.bg3, color: C.tx1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
              <option value="ALL">All Verdicts</option>
              {verdicts.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input placeholder="Search HS8 or product..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: C.bg3, color: C.tx1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, minWidth: 200 }} />
            <span style={{ fontSize: 11, color: C.tx2 }}>{filtered.length} products</span>
          </div>

          {/* Products Table */}
          <div style={{ overflowX: 'auto', background: C.bg2, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.bg2 }}>
                  {[
                    { key: 'hs8_code', label: 'HS8', w: 80 },
                    { key: 'product_desc', label: 'Product', w: 200 },
                    { key: 'hs4', label: 'HS4', w: 50 },
                    { key: 'total_score', label: 'Score', w: 55 },
                    { key: 'verdict', label: 'Verdict', w: 75 },
                    { key: 'total_cif_usd', label: 'CIF USD', w: 85 },
                    { key: 'total_shipments', label: 'Ships', w: 50 },
                    { key: 'unique_buyers', label: 'Buyers', w: 55 },
                    { key: 'china_pct', label: 'China%', w: 55 },
                    { key: 'gross_margin_est_pct', label: 'Margin%', w: 60 },
                    { key: 'trading_model', label: 'Model', w: 65 },
                    { key: 'working_capital_tier', label: 'WC Tier', w: 60 },
                  ].map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)} style={{ textAlign: col.key === 'product_desc' ? 'left' : 'right', padding: '8px 6px', color: sortCol === col.key ? C.strong : C.tx2, cursor: 'pointer', minWidth: col.w, whiteSpace: 'nowrap', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                      {col.label} {sortCol === col.key ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((p, i) => (
                  <tr key={p.hs8_code} onClick={() => setSelectedHS8(p.hs8_code)} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}>
                    <td style={{ padding: '7px 6px', color: C.strong, fontFamily: 'monospace' }}>{p.hs8_code}</td>
                    <td style={{ padding: '7px 6px', color: C.tx1, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_desc}</td>
                    <td style={{ padding: '7px 6px', color: C.tx2, textAlign: 'right' }}>{p.hs4}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, color: (p.total_score || 0) >= 100 ? C.pass : (p.total_score || 0) >= 75 ? C.strong : C.moderate }}>{p.total_score || '—'}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right' }}>{verdictBadge(p.verdict)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', color: C.cyan }}>{fmtUSD(p.total_cif_usd)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', color: C.tx2 }}>{fmt(p.total_shipments)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', color: C.tx1 }}>{fmt(p.unique_buyers)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', color: (p.china_pct || 0) > 50 ? C.moderate : C.tx2 }}>{fmtPct(p.china_pct)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', color: (p.gross_margin_est_pct || 0) > 20 ? C.pass : C.tx2 }}>{p.gross_margin_est_pct ? fmtPct(p.gross_margin_est_pct) : '—'}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'right' }}><Badge label={p.trading_model || '—'} color={p.trading_model === 'REGULAR' ? C.pass : p.trading_model === 'SPOT' ? C.moderate : p.trading_model === 'BROKER' ? C.purple : C.cyan} /></td>
                    <td style={{ padding: '7px 6px', textAlign: 'right', color: p.working_capital_tier === 'LOW' ? C.pass : p.working_capital_tier === 'MEDIUM' ? C.moderate : C.drop }}>{p.working_capital_tier || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === PRODUCT DETAIL VIEW === */}
      {view === 'products' && selectedHS8 && selectedProduct && (
        <div>
          <button onClick={() => setSelectedHS8(null)} style={{ marginBottom: 14, padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg3, color: C.strong, fontSize: 12, cursor: 'pointer' }}>← Back to Products</button>

          {/* Product Header */}
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.tx2, fontFamily: 'monospace' }}>HS8: {selectedProduct.hs8_code} | HS4: {selectedProduct.hs4}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.tx1, marginTop: 4 }}>{selectedProduct.product_desc}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {verdictBadge(selectedProduct.verdict)}
                  <Badge label={`Score: ${selectedProduct.total_score}/150`} color={C.strong} />
                  <Badge label={selectedProduct.trading_model || 'UNKNOWN'} color={C.cyan} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.cyan }}>{fmtUSD(selectedProduct.total_cif_usd)}</div>
                <div style={{ fontSize: 11, color: C.tx2 }}>3-month CIF | Annualized: {fmtUSD(selectedProduct.annualized_cif_usd)}</div>
              </div>
            </div>
          </div>

          {/* Score Breakdown + Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Score Breakdown */}
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>150-Point Score Breakdown</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={[
                  { factor: 'Market', pts: selectedProduct.pts_market_size, max: 20 },
                  { factor: 'Orders', pts: selectedProduct.pts_order_economics, max: 15 },
                  { factor: 'Buyers', pts: selectedProduct.pts_buyer_access, max: 15 },
                  { factor: 'Supply', pts: selectedProduct.pts_supply, max: 15 },
                  { factor: 'Comptn', pts: selectedProduct.pts_competition, max: 10 },
                  { factor: 'Margin', pts: selectedProduct.pts_margin, max: 15 },
                  { factor: 'Growth', pts: selectedProduct.pts_growth, max: 10 },
                  { factor: 'Price', pts: selectedProduct.pts_price_stability, max: 10 },
                  { factor: 'Regs', pts: selectedProduct.pts_regulatory, max: 15 },
                  { factor: 'FTA', pts: selectedProduct.pts_fta, max: 10 },
                  { factor: 'WC', pts: selectedProduct.pts_working_capital, max: 5 },
                  { factor: 'Logist', pts: selectedProduct.pts_logistics, max: 5 },
                ]} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" domain={[0, 20]} tick={{ fill: C.tx2, fontSize: 10 }} />
                  <YAxis dataKey="factor" type="category" tick={{ fill: C.tx2, fontSize: 10 }} width={50} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: C.tx1, fontSize: 12 }} />
                  <Bar dataKey="pts" fill={C.strong} radius={[0, 4, 4, 0]} name="Points" />
                </BarChart>
              </ResponsiveContainer>
              {selectedProduct.bonus_points > 0 && <div style={{ fontSize: 11, color: C.pass, marginTop: 4 }}>+ {selectedProduct.bonus_points} bonus points</div>}
            </div>

            {/* Key Metrics Grid */}
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Key Metrics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Shipments', val: fmt(selectedProduct.total_shipments), color: C.tx1 },
                  { label: 'Unique Buyers', val: fmt(selectedProduct.unique_buyers), color: C.tx1 },
                  { label: 'Buyer HHI', val: fmt(selectedProduct.buyer_hhi, 0), color: (selectedProduct.buyer_hhi || 0) < 2500 ? C.pass : C.drop },
                  { label: 'Top5 Buyer Share', val: fmtPct(selectedProduct.top5_buyer_share_pct), color: C.tx2 },
                  { label: 'Avg Unit Rate', val: fmtUSD(selectedProduct.volza_avg_unit_rate, 2), color: C.cyan },
                  { label: 'Median CIF', val: fmtUSD(selectedProduct.median_cif_usd), color: C.cyan },
                  { label: 'China %', val: fmtPct(selectedProduct.china_pct), color: C.moderate },
                  { label: 'Source Countries', val: fmt(selectedProduct.source_countries), color: C.tx2 },
                  { label: 'Shippers', val: fmt(selectedProduct.unique_shippers), color: C.tx1 },
                  { label: 'FTA Usage', val: fmtPct(selectedProduct.fta_usage_pct), color: C.pass },
                  { label: 'MoM Growth', val: fmtPct(selectedProduct.mom_growth_pct), color: (selectedProduct.mom_growth_pct || 0) > 0 ? C.pass : C.drop },
                  { label: 'HS4 1yr Growth', val: fmtPct(selectedProduct.hs4_growth_1yr), color: (selectedProduct.hs4_growth_1yr || 0) > 0 ? C.pass : C.drop },
                  { label: 'Air %', val: fmtPct(selectedProduct.air_pct), color: C.tx2 },
                  { label: 'Sea %', val: fmtPct(selectedProduct.sea_pct), color: C.tx2 },
                  { label: 'Top Ports', val: selectedProduct.top_ports || '—', color: C.tx2, span: true },
                ].map((m, i) => (
                  <div key={i} style={{ background: C.bg3, borderRadius: 8, padding: '8px 10px', ...(m.span ? { gridColumn: 'span 2' } : {}) }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{m.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: m.color, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Country Breakdown for this HS8 */}
          {selectedCountries.length > 0 && (
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Country Breakdown ({selectedCountries.length} countries)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ResponsiveContainer width="100%" height={Math.min(selectedCountries.length * 28 + 40, 300)}>
                  <BarChart data={selectedCountries.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" tick={{ fill: C.tx2, fontSize: 10 }} tickFormatter={v => '$' + (v >= 1e6 ? (v/1e6).toFixed(1)+'M' : (v/1e3).toFixed(0)+'K')} />
                    <YAxis dataKey="country" type="category" tick={{ fill: C.tx2, fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: C.tx1, fontSize: 12 }} formatter={v => fmtUSD(v)} />
                    <Bar dataKey="total_cif_usd" fill={C.orange} radius={[0, 4, 4, 0]} name="CIF USD" />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th style={{ textAlign: 'left', padding: '5px 4px', color: C.tx2 }}>Country</th>
                        <th style={{ textAlign: 'right', padding: '5px 4px', color: C.tx2 }}>CIF USD</th>
                        <th style={{ textAlign: 'right', padding: '5px 4px', color: C.tx2 }}>Share</th>
                        <th style={{ textAlign: 'right', padding: '5px 4px', color: C.tx2 }}>Ships</th>
                        <th style={{ textAlign: 'right', padding: '5px 4px', color: C.tx2 }}>Buyers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCountries.map((c, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '4px', color: C.tx1 }}>{c.country}</td>
                          <td style={{ padding: '4px', color: C.cyan, textAlign: 'right' }}>{fmtUSD(c.total_cif_usd)}</td>
                          <td style={{ padding: '4px', color: C.tx2, textAlign: 'right' }}>{fmtPct(c.share_pct)}</td>
                          <td style={{ padding: '4px', color: C.tx2, textAlign: 'right' }}>{fmt(c.shipment_count)}</td>
                          <td style={{ padding: '4px', color: C.tx2, textAlign: 'right' }}>{fmt(c.unique_buyers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Buyers for this HS8 */}
          {selectedBuyers.length > 0 && (
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>
                Top Buyers ({selectedBuyers.length})
                <select value={buyerSort} onChange={e => setBuyerSort(e.target.value)} style={{ marginLeft: 12, background: C.bg3, color: C.tx2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 6px', fontSize: 11 }}>
                  <option value="total_cif_usd">Sort: CIF Value</option>
                  <option value="shipment_count">Sort: Shipments</option>
                  <option value="avg_unit_rate">Sort: Unit Rate</option>
                </select>
              </h3>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.bg2 }}>
                      <th style={{ textAlign: 'left', padding: '6px 4px', color: C.tx2 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '6px 4px', color: C.tx2 }}>Company</th>
                      <th style={{ textAlign: 'left', padding: '6px 4px', color: C.tx2 }}>City</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>CIF USD</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>Ships</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>Avg Rate</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>China%</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>Suppliers</th>
                      <th style={{ textAlign: 'center', padding: '6px 4px', color: C.tx2 }}>Priority</th>
                      <th style={{ textAlign: 'center', padding: '6px 4px', color: C.tx2 }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBuyers.map((b, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '5px 4px', color: C.tx2 }}>{b.rank_in_hs8 || i + 1}</td>
                        <td style={{ padding: '5px 4px', color: C.tx1, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.company_name}</td>
                        <td style={{ padding: '5px 4px', color: C.tx2, fontSize: 10 }}>{b.city}</td>
                        <td style={{ padding: '5px 4px', color: C.cyan, textAlign: 'right' }}>{fmtUSD(b.total_cif_usd)}</td>
                        <td style={{ padding: '5px 4px', color: C.tx2, textAlign: 'right' }}>{fmt(b.shipment_count)}</td>
                        <td style={{ padding: '5px 4px', color: C.tx2, textAlign: 'right' }}>{fmtUSD(b.avg_unit_rate, 2)}</td>
                        <td style={{ padding: '5px 4px', textAlign: 'right', color: (b.china_pct || 0) > 50 ? C.moderate : C.tx2 }}>{fmtPct(b.china_pct)}</td>
                        <td style={{ padding: '5px 4px', color: C.tx2, textAlign: 'right' }}>{fmt(b.supplier_count)}</td>
                        <td style={{ padding: '5px 4px', textAlign: 'center' }}>{priorityBadge(b.target_priority)}</td>
                        <td style={{ padding: '5px 4px', textAlign: 'center' }}><Badge label={b.buyer_type_est || '—'} color={b.buyer_type_est === 'REGULAR' ? C.pass : C.moderate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === COUNTRIES VIEW === */}
      {view === 'countries' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Top 15 Source Countries by CIF Value</h3>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={topCountries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="country" tick={{ fill: C.tx2, fontSize: 9 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fill: C.tx2, fontSize: 10 }} tickFormatter={v => '$' + (v/1e6).toFixed(0) + 'M'} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: C.tx1, fontSize: 12 }} formatter={v => fmtUSD(v)} />
                  <Bar dataKey="totalCIF" fill={C.cyan} radius={[4, 4, 0, 0]} name="Total CIF USD" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, maxHeight: 460, overflowY: 'auto' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Country Details</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', color: C.tx2 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', color: C.tx2 }}>Country</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>CIF USD</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>Shipments</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', color: C.tx2 }}>HS8 Codes</th>
                  </tr>
                </thead>
                <tbody>
                  {topCountries.map((c, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 4px', color: C.tx2 }}>{i + 1}</td>
                      <td style={{ padding: '5px 4px', color: C.tx1 }}>{c.country}</td>
                      <td style={{ padding: '5px 4px', color: C.cyan, textAlign: 'right' }}>{fmtUSD(c.totalCIF)}</td>
                      <td style={{ padding: '5px 4px', color: C.tx2, textAlign: 'right' }}>{fmt(c.shipments)}</td>
                      <td style={{ padding: '5px 4px', color: C.purple, textAlign: 'right' }}>{fmt(c.hs8Count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* === BUYERS VIEW === */}
      {view === 'buyers' && (
        <div>
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.tx1, marginBottom: 12 }}>Top Buyers Across All HS8 Products ({topBuyersAll.length})</h3>
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.bg2 }}>
                    <th style={{ textAlign: 'left', padding: '7px 4px', color: C.tx2 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '7px 4px', color: C.tx2 }}>Company</th>
                    <th style={{ textAlign: 'left', padding: '7px 4px', color: C.tx2 }}>City</th>
                    <th style={{ textAlign: 'left', padding: '7px 4px', color: C.tx2 }}>State</th>
                    <th style={{ textAlign: 'right', padding: '7px 4px', color: C.tx2 }}>Total CIF</th>
                    <th style={{ textAlign: 'right', padding: '7px 4px', color: C.tx2 }}>Shipments</th>
                    <th style={{ textAlign: 'right', padding: '7px 4px', color: C.tx2 }}>HS8 Codes</th>
                    <th style={{ textAlign: 'center', padding: '7px 4px', color: C.tx2 }}>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {topBuyersAll.map((b, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '6px 4px', color: C.tx2 }}>{i + 1}</td>
                      <td style={{ padding: '6px 4px', color: C.tx1, fontWeight: 500 }}>{b.name}</td>
                      <td style={{ padding: '6px 4px', color: C.tx2 }}>{b.city || '—'}</td>
                      <td style={{ padding: '6px 4px', color: C.tx2 }}>{b.state || '—'}</td>
                      <td style={{ padding: '6px 4px', color: C.cyan, textAlign: 'right', fontWeight: 600 }}>{fmtUSD(b.totalCIF)}</td>
                      <td style={{ padding: '6px 4px', color: C.tx2, textAlign: 'right' }}>{fmt(b.shipments)}</td>
                      <td style={{ padding: '6px 4px', color: C.purple, textAlign: 'right' }}>{b.hs8Count}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>{priorityBadge(b.priority)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
