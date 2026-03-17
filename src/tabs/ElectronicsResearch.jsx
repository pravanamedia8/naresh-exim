import React, { useEffect, useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Treemap
} from 'recharts';
import { supabase } from '../supabaseClient';

const COLORS = {
  blue: '#4f8cff', green: '#34d399', red: '#f87171', yellow: '#fbbf24',
  purple: '#a78bfa', orange: '#fb923c', cyan: '#22d3ee', pink: '#f472b6',
};

const MODEL_COLORS = {
  REGULAR: '#34d399', SPOT: '#fbbf24', BROKER: '#a78bfa', MIXED: '#60a5fa', null: '#5c6070',
};

const PHASE_LABELS = {
  phase1_complete: 'P1 Ready', phase2b_done: 'P2b Done', phase2_done: 'P2 Done',
  phase3_done: 'P3 Done', qa_pending: 'QA Pending', qa_failed: 'QA Failed',
  COMPLETE: 'Complete', phase4_done: 'P4 Done', phase5_done: 'P5 Done',
};

const VERDICT_COLORS = {
  PASS: '#34d399', MAYBE: '#fbbf24', WATCH: '#a78bfa', DROP: '#f87171',
};

/* ─── MINI COMPONENTS ─── */

const KPI = ({ label, value, color = 'blue', sub }) => (
  <div style={{
    padding: '16px 20px', borderRadius: 10,
    background: `rgba(${color === 'blue' ? '79,140,255' : color === 'green' ? '52,211,153' : color === 'yellow' ? '251,191,36' : color === 'purple' ? '167,139,250' : color === 'red' ? '248,113,113' : color === 'cyan' ? '34,211,238' : '251,146,60'},0.1)`,
    border: `1px solid rgba(${color === 'blue' ? '79,140,255' : color === 'green' ? '52,211,153' : color === 'yellow' ? '251,191,36' : color === 'purple' ? '167,139,250' : color === 'red' ? '248,113,113' : color === 'cyan' ? '34,211,238' : '251,146,60'},0.3)`,
    textAlign: 'center', minWidth: 130,
  }}>
    <div style={{ fontSize: 28, fontWeight: 700, color: COLORS[color] }}>{value}</div>
    <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 2 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const Badge = ({ text, color }) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    background: `rgba(${color === 'green' ? '52,211,153' : color === 'yellow' ? '251,191,36' : color === 'purple' ? '167,139,250' : color === 'red' ? '248,113,113' : color === 'blue' ? '79,140,255' : '148,163,184'},0.15)`,
    color: COLORS[color] || '#94a3b8',
    border: `1px solid rgba(${color === 'green' ? '52,211,153' : color === 'yellow' ? '251,191,36' : color === 'purple' ? '167,139,250' : color === 'red' ? '248,113,113' : color === 'blue' ? '79,140,255' : '148,163,184'},0.3)`,
  }}>{text}</span>
);

const Section = ({ title, children, emoji = '📊' }) => (
  <div style={{
    background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(148,163,184,0.08)',
    borderRadius: 12, padding: '24px', marginBottom: 20, backdropFilter: 'blur(10px)',
  }}>
    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>
      {emoji} {title}
    </h3>
    {children}
  </div>
);

/* ─── SUB-VIEWS ─── */

const PipelineOverview = ({ codes, p2Data, p2bData, p3Data }) => {
  const phases = useMemo(() => {
    const counts = {};
    codes.forEach(c => {
      const p = c.current_phase || 'unknown';
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([phase, count]) => ({ phase, label: PHASE_LABELS[phase] || phase, count }))
      .sort((a, b) => b.count - a.count);
  }, [codes]);

  const models = useMemo(() => {
    const counts = { REGULAR: 0, SPOT: 0, BROKER: 0, MIXED: 0, Pending: 0 };
    codes.forEach(c => {
      if (c.trading_model && counts[c.trading_model] !== undefined) counts[c.trading_model]++;
      else counts.Pending++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [codes]);

  const verdicts = useMemo(() => {
    const counts = {};
    codes.forEach(c => {
      const v = c.verdict_scoring || 'UNKNOWN';
      counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [codes]);

  const qaStats = useMemo(() => {
    let passed = 0, failed = 0, pending = 0;
    codes.forEach(c => {
      if (c.qa_status === 'PASSED') passed++;
      else if (c.qa_status === 'FAILED') failed++;
      else pending++;
    });
    return { passed, failed, pending };
  }, [codes]);

  const totalVal = useMemo(() => codes.reduce((s, c) => s + (c.val_m || 0), 0), [codes]);

  return (
    <>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPI label="Total Codes" value={codes.length} color="blue" sub="Electronics HS4" />
        <KPI label="Trade Value" value={`$${(totalVal / 1000).toFixed(1)}B`} color="cyan" sub="Annual imports" />
        <KPI label="P2b Done" value={p2bData.length} color="purple" sub="Regulatory checked" />
        <KPI label="P2 Done" value={p2Data.length} color="orange" sub="Alibaba supply" />
        <KPI label="P3 Done" value={p3Data.length} color="yellow" sub="IndiaMART demand" />
        <KPI label="QA Passed" value={qaStats.passed} color="green" sub={`${qaStats.failed} failed`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Phase Distribution */}
        <Section title="Pipeline Phase Distribution" emoji="🔄">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={phases} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis type="number" tick={{ fill: '#8b90a0', fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fill: '#e2e5ea', fontSize: 11 }} width={75} />
              <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Trading Model Split */}
        <Section title="Trading Model Assignment" emoji="💼">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={models} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {models.map((entry) => (
                  <Cell key={entry.name} fill={MODEL_COLORS[entry.name] || '#5c6070'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            {Object.entries(MODEL_COLORS).filter(([k]) => k !== 'null').map(([name, color]) => (
              <span key={name} style={{ fontSize: 11, color }}>{name}</span>
            ))}
          </div>
        </Section>

        {/* Verdict Distribution */}
        <Section title="Scoring Verdict (from HS4)" emoji="⚡">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={verdicts} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {verdicts.map((entry) => (
                  <Cell key={entry.name} fill={VERDICT_COLORS[entry.name] || '#5c6070'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      </div>
    </>
  );
};

const RegulatoryView = ({ codes, p2bData }) => {
  const merged = useMemo(() => {
    const regMap = {};
    p2bData.forEach(r => { regMap[r.hs4] = r; });
    return codes.map(c => ({ ...c, reg: regMap[c.hs4] || null }))
      .sort((a, b) => (b.drill_score || 0) - (a.drill_score || 0));
  }, [codes, p2bData]);

  const riskCounts = useMemo(() => {
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, UNCHECKED: 0 };
    merged.forEach(c => {
      const risk = c.reg?.regulatory_risk_score || c.regulatory_risk || 'UNCHECKED';
      if (counts[risk] !== undefined) counts[risk]++;
      else counts.UNCHECKED++;
    });
    return counts;
  }, [merged]);

  const addCodes = useMemo(() => merged.filter(c => c.reg && c.reg.add_rate_pct > 0), [merged]);
  const dgftRestricted = useMemo(() => merged.filter(c => c.reg && c.reg.check_dgft_restriction === 1), [merged]);
  const bisCodes = useMemo(() => merged.filter(c => c.reg && c.reg.check_bis_qco === 1), [merged]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPI label="LOW Risk" value={riskCounts.LOW} color="green" />
        <KPI label="MEDIUM Risk" value={riskCounts.MEDIUM} color="yellow" />
        <KPI label="HIGH Risk" value={riskCounts.HIGH} color="orange" />
        <KPI label="CRITICAL" value={riskCounts.CRITICAL} color="red" />
        <KPI label="Unchecked" value={riskCounts.UNCHECKED} color="blue" sub="Awaiting P2b" />
        <KPI label="Anti-Dumping" value={addCodes.length} color="red" sub="ADD > 0%" />
        <KPI label="DGFT Restricted" value={dgftRestricted.length} color="purple" />
        <KPI label="BIS QCO Required" value={bisCodes.length} color="yellow" />
      </div>

      {addCodes.length > 0 && (
        <Section title={`Anti-Dumping Codes (${addCodes.length}) — BROKER/SPOT Model`} emoji="⚠️">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                  <th style={thStyle}>HS4</th><th style={thStyle}>Product</th><th style={thStyle}>ADD %</th>
                  <th style={thStyle}>Total Duty</th><th style={thStyle}>Model</th><th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {addCodes.slice(0, 20).map(c => (
                  <tr key={c.hs4} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                    <td style={tdStyle}><span style={{ color: COLORS.blue, fontWeight: 600 }}>{c.hs4}</span></td>
                    <td style={tdStyle}>{(c.commodity || '').slice(0, 50)}</td>
                    <td style={{ ...tdStyle, color: COLORS.red, fontWeight: 600 }}>{c.reg?.add_rate_pct?.toFixed(1)}%</td>
                    <td style={tdStyle}>{c.reg?.total_duty_pct?.toFixed(1)}%</td>
                    <td style={tdStyle}><Badge text={c.trading_model || 'Pending'} color={c.trading_model === 'BROKER' ? 'purple' : c.trading_model === 'SPOT' ? 'yellow' : 'blue'} /></td>
                    <td style={{ ...tdStyle, color: 'var(--tx2)' }}>{c.reg?.add_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
};

const SupplyDemandView = ({ codes, p2Data, p3Data }) => {
  const merged = useMemo(() => {
    const p2Map = {}, p3Map = {};
    p2Data.forEach(r => { p2Map[r.hs4] = r; });
    p3Data.forEach(r => { p3Map[r.hs4] = r; });
    return codes.map(c => ({
      ...c,
      supply: p2Map[c.hs4] || null,
      demand: p3Map[c.hs4] || null,
    })).sort((a, b) => (b.drill_score || 0) - (a.drill_score || 0));
  }, [codes, p2Data, p3Data]);

  const withSupply = merged.filter(c => c.supply);
  const withDemand = merged.filter(c => c.demand);
  const withMargin = merged.filter(c => c.demand?.gross_margin_pct != null);

  // Top margin chart data
  const marginChart = useMemo(() => {
    return withMargin
      .filter(c => c.demand.gross_margin_pct > 0)
      .sort((a, b) => b.demand.gross_margin_pct - a.demand.gross_margin_pct)
      .slice(0, 20)
      .map(c => ({
        hs4: c.hs4,
        margin: +(c.demand.gross_margin_pct).toFixed(1),
        name: (c.commodity || '').slice(0, 25),
      }));
  }, [withMargin]);

  // FOB price scatter data
  const supplyChart = useMemo(() => {
    return withSupply
      .filter(c => c.supply.total_suppliers > 0)
      .sort((a, b) => b.supply.total_suppliers - a.supply.total_suppliers)
      .slice(0, 20)
      .map(c => ({
        hs4: c.hs4,
        suppliers: c.supply.total_suppliers,
        name: (c.commodity || '').slice(0, 25),
      }));
  }, [withSupply]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPI label="Supply Researched" value={withSupply.length} color="blue" sub={`of ${codes.length}`} />
        <KPI label="Demand Researched" value={withDemand.length} color="green" sub={`of ${codes.length}`} />
        <KPI label="Margin Calculated" value={withMargin.length} color="yellow" sub="Have gross margin %" />
        <KPI label="Avg Margin" value={withMargin.length > 0 ? `${(withMargin.reduce((s, c) => s + c.demand.gross_margin_pct, 0) / withMargin.length).toFixed(1)}%` : '—'} color="green" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {marginChart.length > 0 && (
          <Section title="Top 20 by Gross Margin %" emoji="💰">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={marginChart} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis type="number" tick={{ fill: '#8b90a0', fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="hs4" tick={{ fill: '#e2e5ea', fontSize: 11 }} width={45} />
                <Tooltip
                  contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n, p) => [`${v}%`, `${p.payload.name}`]}
                />
                <Bar dataKey="margin" fill={COLORS.green} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
        {supplyChart.length > 0 && (
          <Section title="Top 20 by China Supplier Count" emoji="🏭">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={supplyChart} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis type="number" tick={{ fill: '#8b90a0', fontSize: 11 }} />
                <YAxis type="category" dataKey="hs4" tick={{ fill: '#e2e5ea', fontSize: 11 }} width={45} />
                <Tooltip
                  contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n, p) => [v, `${p.payload.name}`]}
                />
                <Bar dataKey="suppliers" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
      </div>

      {/* Full data table */}
      {withSupply.length > 0 || withDemand.length > 0 ? (
        <Section title="Supply & Demand Data Table" emoji="📋">
          <div style={{ overflowX: 'auto', maxHeight: 500 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#111827', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                  <th style={thStyle}>HS4</th><th style={thStyle}>Product</th>
                  <th style={thStyle}>Suppliers</th><th style={thStyle}>FOB Low</th><th style={thStyle}>FOB High</th><th style={thStyle}>Gold%</th>
                  <th style={thStyle}>Sellers</th><th style={thStyle}>INR Low</th><th style={thStyle}>INR High</th><th style={thStyle}>Margin%</th>
                  <th style={thStyle}>Model</th>
                </tr>
              </thead>
              <tbody>
                {merged.filter(c => c.supply || c.demand).map(c => (
                  <tr key={c.hs4} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                    <td style={tdStyle}><span style={{ color: COLORS.blue, fontWeight: 600 }}>{c.hs4}</span></td>
                    <td style={{ ...tdStyle, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.commodity}</td>
                    <td style={tdStyle}>{c.supply?.total_suppliers ?? '—'}</td>
                    <td style={tdStyle}>{c.supply?.fob_lowest_usd != null ? `$${c.supply.fob_lowest_usd.toFixed(2)}` : '—'}</td>
                    <td style={tdStyle}>{c.supply?.fob_highest_usd != null ? `$${c.supply.fob_highest_usd.toFixed(2)}` : '—'}</td>
                    <td style={tdStyle}>{c.supply?.gold_supplier_pct != null ? `${c.supply.gold_supplier_pct.toFixed(0)}%` : '—'}</td>
                    <td style={tdStyle}>{c.demand?.total_sellers ?? '—'}</td>
                    <td style={tdStyle}>{c.demand?.price_low_inr != null ? `₹${c.demand.price_low_inr.toLocaleString()}` : '—'}</td>
                    <td style={tdStyle}>{c.demand?.price_high_inr != null ? `₹${c.demand.price_high_inr.toLocaleString()}` : '—'}</td>
                    <td style={{
                      ...tdStyle,
                      color: c.demand?.gross_margin_pct > 20 ? COLORS.green : c.demand?.gross_margin_pct > 10 ? COLORS.yellow : c.demand?.gross_margin_pct != null ? COLORS.red : 'var(--tx2)',
                      fontWeight: 600,
                    }}>{c.demand?.gross_margin_pct != null ? `${c.demand.gross_margin_pct.toFixed(1)}%` : '—'}</td>
                    <td style={tdStyle}><Badge text={c.trading_model || '—'} color={c.trading_model === 'REGULAR' ? 'green' : c.trading_model === 'SPOT' ? 'yellow' : c.trading_model === 'BROKER' ? 'purple' : c.trading_model === 'MIXED' ? 'blue' : undefined} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Section title="No Supply/Demand Data Yet" emoji="⏳">
          <p style={{ color: 'var(--tx2)', fontSize: 13 }}>
            Phase 2 (Alibaba) and Phase 3 (IndiaMART) research has not started yet. Data will appear here as codes are processed through Chrome browser visits.
          </p>
        </Section>
      )}
    </>
  );
};

const FullCodeTable = ({ codes, p2bData, p2Data, p3Data, sortField, setSortField, sortDir, setSortDir, search, setSearch }) => {
  const regMap = useMemo(() => { const m = {}; p2bData.forEach(r => m[r.hs4] = r); return m; }, [p2bData]);
  const p2Map = useMemo(() => { const m = {}; p2Data.forEach(r => m[r.hs4] = r); return m; }, [p2Data]);
  const p3Map = useMemo(() => { const m = {}; p3Data.forEach(r => m[r.hs4] = r); return m; }, [p3Data]);

  const sorted = useMemo(() => {
    let data = codes.map(c => ({
      ...c,
      reg: regMap[c.hs4],
      supply: p2Map[c.hs4],
      demand: p3Map[c.hs4],
    }));

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(c => c.hs4.includes(s) || (c.commodity || '').toLowerCase().includes(s) || (c.trading_model || '').toLowerCase().includes(s));
    }

    data.sort((a, b) => {
      let av, bv;
      switch (sortField) {
        case 'hs4': av = a.hs4; bv = b.hs4; break;
        case 'val_m': av = a.val_m || 0; bv = b.val_m || 0; break;
        case 'drill_score': av = a.drill_score || 0; bv = b.drill_score || 0; break;
        case 'margin': av = a.demand?.gross_margin_pct || -999; bv = b.demand?.gross_margin_pct || -999; break;
        case 'suppliers': av = a.supply?.total_suppliers || 0; bv = b.supply?.total_suppliers || 0; break;
        case 'duty': av = a.reg?.total_duty_pct || 0; bv = b.reg?.total_duty_pct || 0; break;
        default: av = a.drill_score || 0; bv = b.drill_score || 0;
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return data;
  }, [codes, regMap, p2Map, p3Map, sortField, sortDir, search]);

  const clickSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };
  const arrow = (field) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <Section title={`All 180 Codes — Sortable & Searchable (${sorted.length} shown)`} emoji="📊">
      <div style={{ marginBottom: 12 }}>
        <input
          type="text" placeholder="Search HS4, product, or model..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8,
            padding: '8px 14px', color: '#e2e5ea', fontSize: 13, width: 320, outline: 'none',
          }}
        />
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 600 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#111827', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => clickSort('hs4')}>HS4{arrow('hs4')}</th>
              <th style={thStyle}>Product</th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => clickSort('val_m')}>Val $M{arrow('val_m')}</th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => clickSort('drill_score')}>Score{arrow('drill_score')}</th>
              <th style={thStyle}>Verdict</th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => clickSort('duty')}>Duty%{arrow('duty')}</th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => clickSort('suppliers')}>Suppliers{arrow('suppliers')}</th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => clickSort('margin')}>Margin%{arrow('margin')}</th>
              <th style={thStyle}>Phase</th>
              <th style={thStyle}>QA</th>
              <th style={thStyle}>Model</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <tr key={c.hs4} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                <td style={tdStyle}><span style={{ color: COLORS.blue, fontWeight: 600 }}>{c.hs4}</span></td>
                <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.commodity}</td>
                <td style={tdStyle}>{c.val_m != null ? `$${c.val_m.toFixed(1)}M` : '—'}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{c.drill_score?.toFixed(0) || '—'}</td>
                <td style={tdStyle}><Badge text={c.verdict_scoring || '—'} color={c.verdict_scoring === 'PASS' ? 'green' : c.verdict_scoring === 'MAYBE' ? 'yellow' : c.verdict_scoring === 'WATCH' ? 'purple' : 'red'} /></td>
                <td style={tdStyle}>{c.reg?.total_duty_pct != null ? `${c.reg.total_duty_pct.toFixed(1)}%` : c.bcd_rate != null ? `${c.bcd_rate}%` : '—'}</td>
                <td style={tdStyle}>{c.supply?.total_suppliers ?? '—'}</td>
                <td style={{
                  ...tdStyle, fontWeight: 600,
                  color: c.demand?.gross_margin_pct > 20 ? COLORS.green : c.demand?.gross_margin_pct > 10 ? COLORS.yellow : c.demand?.gross_margin_pct != null ? COLORS.red : 'var(--tx2)',
                }}>{c.demand?.gross_margin_pct != null ? `${c.demand.gross_margin_pct.toFixed(1)}%` : '—'}</td>
                <td style={tdStyle}><Badge text={PHASE_LABELS[c.current_phase] || c.current_phase || '—'} color="blue" /></td>
                <td style={tdStyle}>
                  {c.qa_status === 'PASSED' ? <Badge text="PASS" color="green" /> :
                   c.qa_status === 'FAILED' ? <Badge text="FAIL" color="red" /> :
                   <span style={{ color: 'var(--tx3)', fontSize: 11 }}>—</span>}
                </td>
                <td style={tdStyle}><Badge text={c.trading_model || '—'} color={c.trading_model === 'REGULAR' ? 'green' : c.trading_model === 'SPOT' ? 'yellow' : c.trading_model === 'BROKER' ? 'purple' : c.trading_model === 'MIXED' ? 'blue' : undefined} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

/* ─── TABLE STYLES ─── */
const thStyle = { padding: '8px 10px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' };
const tdStyle = { padding: '7px 10px', color: '#e2e5ea', fontSize: 12 };

/* ─── MAIN TAB ─── */

const VIEW_TABS = [
  { id: 'overview', label: '📊 Overview', desc: 'Pipeline KPIs & charts' },
  { id: 'regulatory', label: '⚖️ Regulatory', desc: 'Duty rates & compliance' },
  { id: 'supply_demand', label: '📦 Supply & Demand', desc: 'Alibaba + IndiaMART data' },
  { id: 'all_codes', label: '📋 All Codes', desc: 'Full sortable table' },
];

export default function ElectronicsResearch() {
  const [view, setView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Data state
  const [codes, setCodes] = useState([]);
  const [p2Data, setP2Data] = useState([]);
  const [p2bData, setP2bData] = useState([]);
  const [p3Data, setP3Data] = useState([]);

  // Table state
  const [sortField, setSortField] = useState('drill_score');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const [resC, resP2, resP2b, resP3] = await Promise.all([
        supabase.from('research_codes').select('*').order('drill_score', { ascending: false }),
        supabase.from('phase2_alibaba_summary').select('*'),
        supabase.from('phase2b_regulatory').select('*'),
        supabase.from('phase3_indiamart_summary').select('*'),
      ]);

      if (resC.error) throw resC.error;
      setCodes(resC.data || []);
      setP2Data(resP2.data || []);
      setP2bData(resP2b.data || []);
      setP3Data(resP3.data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Supabase fetch error:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && codes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
        <div style={{ color: 'var(--tx2)', fontSize: 14 }}>Loading Electronics Research from Supabase...</div>
      </div>
    );
  }

  if (error && codes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>❌</div>
        <div style={{ color: COLORS.red, fontSize: 14 }}>{error}</div>
        <button onClick={fetchAll} style={{ marginTop: 12, padding: '8px 16px', background: COLORS.blue, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, padding: '12px 16px',
        background: 'rgba(17,24,39,0.6)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.08)',
      }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e5ea' }}>⚡ Electronics Research Pipeline v3</span>
          <span style={{ fontSize: 12, color: 'var(--tx2)', marginLeft: 12 }}>
            Hybrid Chrome + WebSearch | Model-Aware QA | Live from Supabase
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'var(--tx3)' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchAll} style={{
            padding: '5px 12px', background: 'rgba(79,140,255,0.15)', color: COLORS.blue,
            border: '1px solid rgba(79,140,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12,
          }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {VIEW_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            title={t.desc}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
              background: view === t.id ? 'rgba(79,140,255,0.2)' : 'rgba(17,24,39,0.5)',
              color: view === t.id ? COLORS.blue : 'var(--tx2)',
              border: view === t.id ? '1px solid rgba(79,140,255,0.3)' : '1px solid rgba(148,163,184,0.08)',
              fontWeight: view === t.id ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* View Router */}
      {view === 'overview' && <PipelineOverview codes={codes} p2Data={p2Data} p2bData={p2bData} p3Data={p3Data} />}
      {view === 'regulatory' && <RegulatoryView codes={codes} p2bData={p2bData} />}
      {view === 'supply_demand' && <SupplyDemandView codes={codes} p2Data={p2Data} p3Data={p3Data} />}
      {view === 'all_codes' && (
        <FullCodeTable
          codes={codes} p2bData={p2bData} p2Data={p2Data} p3Data={p3Data}
          sortField={sortField} setSortField={setSortField}
          sortDir={sortDir} setSortDir={setSortDir}
          search={search} setSearch={setSearch}
        />
      )}
    </div>
  );
}
