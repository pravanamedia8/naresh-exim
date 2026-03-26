import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const C = { pursue: '#34d399', strong: '#60a5fa', moderate: '#fbbf24', drop: '#f87171', bg2: '#111827', bg3: '#1a2035', tx1: '#e2e8f0', tx2: '#94a3b8', border: 'rgba(148,163,184,0.08)' };
const verdictColor = v => v === 'PURSUE' ? C.pursue : v === 'STRONG' ? C.strong : v === 'MODERATE' ? C.moderate : C.drop;
const modelColor = m => m === 'REGULAR' ? '#34d399' : m === 'SPOT' ? '#fbbf24' : m === 'BROKER' ? '#a78bfa' : m === 'MIXED' ? '#22d3ee' : '#94a3b8';

const fmt = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });
const fmtUSD = n => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtINR = n => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function ProductShortlist() {
  const [scores, setScores] = useState([]);
  const [deepDives, setDeepDives] = useState([]);
  const [volzaQueue, setVolzaQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('ranking');
  const [sortBy, setSortBy] = useState('total_score');
  const [filterVerdict, setFilterVerdict] = useState('ALL');
  const [selectedCode, setSelectedCode] = useState(null);

  useEffect(() => {
    (async () => {
      const [s, d, v] = await Promise.all([
        supabase.from('phase5_scoring').select('*').gte('total_score', 90).order('total_score', { ascending: false }),
        supabase.from('product_deep_dives').select('*').order('total_score', { ascending: false }),
        supabase.from('volza_scrape_queue').select('*').order('priority', { ascending: true }),
      ]);
      setScores(s.data || []);
      setDeepDives(d.data || []);
      setVolzaQueue(v.data || []);
      setLoading(false);
    })();
  }, []);

  const enriched = useMemo(() => {
    return volzaQueue.map(q => {
      const sc = scores.find(s => s.hs4 === q.hs4) || {};
      const dd = deepDives.find(d => d.hs4 === q.hs4);
      return { ...q, ...sc, deepDive: dd };
    }).sort((a, b) => sortBy === 'gross_margin_pct' ? (b.gross_margin_pct || 0) - (a.gross_margin_pct || 0)
      : sortBy === 'val_m' ? (b.val_m || 0) - (a.val_m || 0)
      : sortBy === 'fob_typical_usd' ? (a.fob_typical_usd || 999) - (b.fob_typical_usd || 999)
      : (b.total_score || 0) - (a.total_score || 0));
  }, [scores, volzaQueue, deepDives, sortBy]);

  const filtered = useMemo(() =>
    filterVerdict === 'ALL' ? enriched : enriched.filter(e => e.verdict === filterVerdict)
  , [enriched, filterVerdict]);

  const pursueCount = enriched.filter(e => e.verdict === 'PURSUE').length;
  const strongCount = enriched.filter(e => e.verdict === 'STRONG').length;
  const avgMargin = enriched.length ? (enriched.reduce((s, e) => s + (e.gross_margin_pct || 0), 0) / enriched.length).toFixed(1) : 0;
  const totalMarketB = (enriched.reduce((s, e) => s + (e.val_m || 0), 0) / 1000).toFixed(1);
  const deepDiveCount = deepDives.length;

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.tx2 }}>Loading shortlist data...</div>;

  return (
    <div style={{ padding: '0 8px' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Scored', val: enriched.length, color: C.tx1, sub: 'Products ≥90 pts' },
          { label: 'PURSUE', val: pursueCount, color: C.pursue, sub: '≥120 points' },
          { label: 'STRONG', val: strongCount, color: C.strong, sub: '90-119 points' },
          { label: 'Avg Margin', val: avgMargin + '%', color: '#22d3ee', sub: 'Gross margin' },
          { label: 'Market Size', val: '$' + totalMarketB + 'B', color: '#fb923c', sub: 'Total addressable' },
          { label: 'Deep Dives', val: deepDiveCount, color: '#a78bfa', sub: 'Tier 1 products' },
        ].map(k => (
          <div key={k.label} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: C.tx2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['ranking', 'deepdives', 'radar', 'volza_queue'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '8px 16px', borderRadius: 8, border: `1px solid ${view === v ? '#4f8cff' : C.border}`,
            background: view === v ? 'rgba(79,140,255,0.15)' : C.bg2, color: view === v ? '#4f8cff' : C.tx2,
            cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>
            {v === 'ranking' ? '🏆 Ranked Shortlist' : v === 'deepdives' ? '🔬 Deep Dives' : v === 'radar' ? '📊 Radar Compare' : '🚢 Volza Queue'}
          </button>
        ))}
      </div>

      {view === 'ranking' && <RankingView items={filtered} sortBy={sortBy} setSortBy={setSortBy} filterVerdict={filterVerdict} setFilterVerdict={setFilterVerdict} onSelect={setSelectedCode} selectedCode={selectedCode} />}
      {view === 'deepdives' && <DeepDiveView dives={deepDives} />}
      {view === 'radar' && <RadarView items={enriched.filter(e => e.score_margin != null).slice(0, 10)} />}
      {view === 'volza_queue' && <VolzaQueueView queue={volzaQueue} />}
    </div>
  );
}

function RankingView({ items, sortBy, setSortBy, filterVerdict, setFilterVerdict, onSelect, selectedCode }) {
  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ color: '#94a3b8', fontSize: 12 }}>Sort:</label>
        {[['total_score', 'Score'], ['gross_margin_pct', 'Margin %'], ['val_m', 'Market $'], ['fob_typical_usd', 'FOB (low first)']].map(([k, l]) => (
          <button key={k} onClick={() => setSortBy(k)} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            background: sortBy === k ? 'rgba(79,140,255,0.15)' : 'transparent', color: sortBy === k ? '#4f8cff' : '#94a3b8',
            border: `1px solid ${sortBy === k ? '#4f8cff50' : 'transparent'}`
          }}>{l}</button>
        ))}
        <span style={{ margin: '0 8px', color: '#334155' }}>|</span>
        <label style={{ color: '#94a3b8', fontSize: 12 }}>Filter:</label>
        {['ALL', 'PURSUE', 'STRONG'].map(v => (
          <button key={v} onClick={() => setFilterVerdict(v)} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            background: filterVerdict === v ? 'rgba(52,211,153,0.15)' : 'transparent',
            color: filterVerdict === v ? '#34d399' : '#94a3b8', border: `1px solid ${filterVerdict === v ? '#34d39950' : 'transparent'}`
          }}>{v}</button>
        ))}
      </div>

      {/* Score Bar Chart */}
      <div style={{ background: '#111827', borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid rgba(148,163,184,0.08)` }}>
        <h3 style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 12 }}>150-Point Scores — {items.length} Products</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, items.length * 28)}>
          <BarChart data={items} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" domain={[0, 150]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="hs4" tick={{ fill: '#94a3b8', fontSize: 11 }} width={70} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              formatter={(v, n, p) => [v + ' pts', p.payload.commodity?.substring(0, 40)]} />
            <Bar dataKey="total_score" radius={[0, 4, 4, 0]}>
              {items.map((e, i) => <rect key={i} fill={verdictColor(e.verdict)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['#', 'HS4', 'Product', 'Score', 'Verdict', 'Margin%', 'FOB $', 'Market $M', 'Model', 'Duty%', 'Sellers', 'Suppliers', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((e, i) => (
              <tr key={e.hs4} onClick={() => onSelect(e.hs4 === selectedCode ? null : e.hs4)}
                style={{ borderBottom: '1px solid #0f172a', cursor: 'pointer', background: selectedCode === e.hs4 ? 'rgba(79,140,255,0.08)' : 'transparent' }}>
                <td style={{ padding: '10px 8px', color: '#64748b' }}>{i + 1}</td>
                <td style={{ padding: '10px 8px', color: '#60a5fa', fontWeight: 700, fontFamily: 'monospace' }}>{e.hs4}</td>
                <td style={{ padding: '10px 8px', color: '#e2e8f0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.commodity}</td>
                <td style={{ padding: '10px 8px', fontWeight: 700, color: verdictColor(e.verdict) }}>{e.total_score}/150</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: verdictColor(e.verdict) + '20', color: verdictColor(e.verdict), border: `1px solid ${verdictColor(e.verdict)}40` }}>{e.verdict}</span>
                </td>
                <td style={{ padding: '10px 8px', color: e.gross_margin_pct > 80 ? '#34d399' : e.gross_margin_pct > 50 ? '#60a5fa' : '#fbbf24', fontWeight: 600 }}>{fmt(e.gross_margin_pct, 1)}%</td>
                <td style={{ padding: '10px 8px', color: '#e2e8f0' }}>{fmtUSD(e.fob_typical_usd)}</td>
                <td style={{ padding: '10px 8px', color: '#e2e8f0' }}>${fmt(e.val_m, 1)}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: modelColor(e.trading_model) + '20', color: modelColor(e.trading_model) }}>{e.trading_model}</span>
                </td>
                <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{fmt(e.total_duty_pct || 31.8, 1)}%</td>
                <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{fmt(e.indiamart_sellers || e.total_sellers)}</td>
                <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{fmt(e.alibaba_suppliers || e.total_suppliers)}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: e.deepDive ? 'rgba(167,139,250,0.15)' : 'rgba(148,163,184,0.1)', color: e.deepDive ? '#a78bfa' : '#64748b' }}>
                    {e.deepDive ? 'DEEP DIVE' : e.scrape_status === 'queued' ? 'P4 QUEUED' : e.scrape_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Code Detail */}
      {selectedCode && (() => {
        const e = items.find(x => x.hs4 === selectedCode);
        if (!e) return null;
        const dims = [
          { name: 'Margin', pts: e.score_margin, max: 25 }, { name: 'Buyer Access', pts: e.score_buyer_access, max: 20 },
          { name: 'Supply', pts: e.score_supply, max: 15 }, { name: 'Market Size', pts: e.score_market_size, max: 15 },
          { name: 'Regulatory', pts: e.score_regulatory, max: 15 }, { name: 'Competition', pts: e.score_competition, max: 10 },
          { name: 'Growth', pts: e.score_growth, max: 10 }, { name: 'Working Cap', pts: e.score_working_capital, max: 10 },
          { name: 'Logistics', pts: e.score_logistics, max: 10 }, { name: 'Obsolescence', pts: e.score_obsolescence, max: 10 },
          { name: 'Capital Req', pts: e.score_capital, max: 5 }, { name: 'FTA', pts: e.score_fta, max: 5 },
        ];
        return (
          <div style={{ marginTop: 16, background: '#111827', borderRadius: 12, padding: 20, border: '1px solid rgba(79,140,255,0.2)' }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 16, marginBottom: 12 }}>HS {e.hs4} — {e.commodity?.substring(0, 60)} — <span style={{ color: verdictColor(e.verdict) }}>{e.total_score}/150 {e.verdict}</span></h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {dims.map(d => (
                <div key={d.name} style={{ background: '#1a2035', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{d.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: d.pts >= d.max * 0.7 ? '#34d399' : d.pts >= d.max * 0.4 ? '#fbbf24' : '#f87171' }}>{d.pts ?? '—'}<span style={{ fontSize: 11, color: '#475569' }}>/{d.max}</span></div>
                  <div style={{ height: 3, borderRadius: 2, background: '#0f172a', marginTop: 4 }}>
                    <div style={{ height: 3, borderRadius: 2, width: `${(d.pts / d.max) * 100}%`, background: d.pts >= d.max * 0.7 ? '#34d399' : d.pts >= d.max * 0.4 ? '#fbbf24' : '#f87171' }} />
                  </div>
                </div>
              ))}
            </div>
            {e.go_nogo_notes && <div style={{ marginTop: 12, padding: 12, background: '#1a2035', borderRadius: 8, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{e.go_nogo_notes}</div>}
          </div>
        );
      })()}
    </div>
  );
}

function DeepDiveView({ dives }) {
  if (!dives.length) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No deep dives yet</div>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {dives.map(d => (
        <div key={d.hs4} style={{ background: '#111827', borderRadius: 12, padding: 24, border: '1px solid rgba(148,163,184,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>HS {d.hs4}</span>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: verdictColor(d.verdict) + '20', color: verdictColor(d.verdict), border: `1px solid ${verdictColor(d.verdict)}40` }}>{d.verdict} — {d.total_score}/150</span>
                <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{d.tier}</span>
              </div>
              <div style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 600 }}>{d.commodity}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Target HS8: {d.hs8} — {d.hs8_commodity}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#34d399' }}>{fmt(d.gross_margin_pct, 0)}%</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Gross Margin</div>
            </div>
          </div>

          {/* Financial Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { l: 'FOB Price', v: fmtUSD(d.fob_usd), c: '#e2e8f0' },
              { l: 'Total Duty', v: fmt(d.total_duty_pct, 1) + '%', c: '#fbbf24' },
              { l: 'Landed Cost', v: fmtINR(d.landed_cost_inr), c: '#fb923c' },
              { l: 'Sell Price', v: fmtINR(d.sell_price_inr), c: '#34d399' },
              { l: 'Margin/Unit', v: fmtINR(d.margin_per_unit_inr), c: '#22d3ee' },
              { l: 'Market Size', v: '$' + fmt(d.trade_val_m, 1) + 'M', c: '#60a5fa' },
              { l: 'Min Order', v: fmtUSD(d.min_order_usd), c: '#a78bfa' },
              { l: 'Working Cap', v: fmtINR(d.working_capital_inr), c: '#f472b6' },
            ].map(m => (
              <div key={m.l} style={{ background: '#1a2035', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{m.l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Suppliers & Strategy */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#1a2035', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, marginBottom: 8 }}>Top Alibaba Suppliers ({d.alibaba_suppliers} total)</div>
              {[d.supplier_1, d.supplier_2, d.supplier_3].filter(Boolean).map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: '#e2e8f0', padding: '3px 0' }}>{i + 1}. {s}</div>
              ))}
            </div>
            <div style={{ background: '#1a2035', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#34d399', fontWeight: 600, marginBottom: 8 }}>Entry Strategy</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{d.entry_strategy}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div style={{ background: '#1a2035', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, marginBottom: 8 }}>First Order Plan</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{d.first_order_plan}</div>
            </div>
            <div style={{ background: '#1a2035', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, marginBottom: 8 }}>Competitive Moat</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{d.moat_notes}</div>
            </div>
          </div>
          {d.risk_factors && (
            <div style={{ marginTop: 12, background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: 14, border: '1px solid rgba(248,113,113,0.15)' }}>
              <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginBottom: 4 }}>Risk Factors</div>
              <div style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>{d.risk_factors}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RadarView({ items }) {
  const radarData = [
    { dim: 'Margin', max: 25 }, { dim: 'Buyers', max: 20 }, { dim: 'Supply', max: 15 },
    { dim: 'Market', max: 15 }, { dim: 'Regulatory', max: 15 }, { dim: 'Competition', max: 10 },
    { dim: 'Growth', max: 10 }, { dim: 'Work Cap', max: 10 }, { dim: 'Logistics', max: 10 },
    { dim: 'Obsol.', max: 10 },
  ].map(d => {
    const row = { dim: d.dim };
    items.forEach(it => {
      const key = d.dim === 'Margin' ? 'score_margin' : d.dim === 'Buyers' ? 'score_buyer_access'
        : d.dim === 'Supply' ? 'score_supply' : d.dim === 'Market' ? 'score_market_size'
        : d.dim === 'Regulatory' ? 'score_regulatory' : d.dim === 'Competition' ? 'score_competition'
        : d.dim === 'Growth' ? 'score_growth' : d.dim === 'Work Cap' ? 'score_working_capital'
        : d.dim === 'Logistics' ? 'score_logistics' : 'score_obsolescence';
      row[it.hs4] = ((it[key] || 0) / d.max) * 100;
    });
    return row;
  });
  const colors = ['#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#22d3ee', '#fb923c', '#f472b6', '#4ade80', '#38bdf8', '#e879f9'];
  return (
    <div style={{ background: '#111827', borderRadius: 12, padding: 20, border: '1px solid rgba(148,163,184,0.08)' }}>
      <h3 style={{ color: '#e2e8f0', fontSize: 14, marginBottom: 12 }}>Radar Comparison — Top 10 Products (% of max per dimension)</h3>
      <ResponsiveContainer width="100%" height={500}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#1e293b" />
          <PolarAngleAxis dataKey="dim" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
          {items.map((it, i) => (
            <Radar key={it.hs4} name={`HS ${it.hs4}`} dataKey={it.hs4} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.08} strokeWidth={2} />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function VolzaQueueView({ queue }) {
  const queued = queue.filter(q => q.scrape_status === 'queued').length;
  const done = queue.filter(q => q.scrape_status === 'done').length;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#111827', borderRadius: 10, padding: '12px 20px', border: '1px solid rgba(148,163,184,0.08)' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>QUEUED</div><div style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24' }}>{queued}</div>
        </div>
        <div style={{ background: '#111827', borderRadius: 10, padding: '12px 20px', border: '1px solid rgba(148,163,184,0.08)' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>DONE</div><div style={{ fontSize: 24, fontWeight: 700, color: '#34d399' }}>{done}</div>
        </div>
        <div style={{ background: '#111827', borderRadius: 10, padding: '12px 20px', border: '1px solid rgba(148,163,184,0.08)' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>TOTAL</div><div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>{queue.length}</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Priority', 'HS4', 'Product', 'Score', 'Margin%', 'FOB $', 'Market $M', 'Model', 'Status', 'Shipments', 'Buyers'].map(h => (
                <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.map(q => (
              <tr key={q.hs4} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '8px', color: '#64748b' }}>#{q.priority}</td>
                <td style={{ padding: '8px', color: '#60a5fa', fontWeight: 700, fontFamily: 'monospace' }}>{q.hs4}</td>
                <td style={{ padding: '8px', color: '#e2e8f0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.commodity}</td>
                <td style={{ padding: '8px', fontWeight: 700, color: verdictColor(q.verdict) }}>{q.total_score}</td>
                <td style={{ padding: '8px', color: q.gross_margin_pct > 80 ? '#34d399' : '#60a5fa' }}>{fmt(q.gross_margin_pct, 1)}%</td>
                <td style={{ padding: '8px', color: '#e2e8f0' }}>{fmtUSD(q.fob_typical_usd)}</td>
                <td style={{ padding: '8px', color: '#e2e8f0' }}>${fmt(q.val_m, 1)}</td>
                <td style={{ padding: '8px' }}><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: modelColor(q.trading_model) + '20', color: modelColor(q.trading_model) }}>{q.trading_model}</span></td>
                <td style={{ padding: '8px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: q.scrape_status === 'done' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)', color: q.scrape_status === 'done' ? '#34d399' : '#fbbf24' }}>{q.scrape_status?.toUpperCase()}</span>
                </td>
                <td style={{ padding: '8px', color: '#94a3b8' }}>{q.shipment_count || '—'}</td>
                <td style={{ padding: '8px', color: '#94a3b8' }}>{q.buyer_count || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
