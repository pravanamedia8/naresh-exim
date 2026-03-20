import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis, LineChart, Line
} from 'recharts';
import { supabase } from '../supabaseClient';

/* ─── CONSTANTS ─── */
const COLORS = {
  blue: '#4f8cff', green: '#34d399', red: '#f87171', yellow: '#fbbf24',
  purple: '#a78bfa', orange: '#fb923c', cyan: '#22d3ee', pink: '#f472b6',
  lime: '#a3e635', teal: '#2dd4bf', indigo: '#818cf8', slate: '#94a3b8',
};
const RGB = {
  blue: '79,140,255', green: '52,211,153', red: '248,113,113', yellow: '251,191,36',
  purple: '167,139,250', orange: '251,146,60', cyan: '34,211,238', pink: '244,114,182',
  lime: '163,230,53', teal: '45,212,191', indigo: '129,140,248', slate: '148,163,184',
};
const MODEL_COLORS = { REGULAR: '#34d399', SPOT: '#fbbf24', BROKER: '#a78bfa', MIXED: '#60a5fa' };
const PHASE_LABELS = {
  phase1_complete: 'P1 Ready', phase2b_done: 'P2b Done', phase2_done: 'P2 Done',
  phase3_done: 'P3 Done', qa_pending: 'QA Pending', qa_failed: 'QA Failed',
  COMPLETE: 'Complete', phase4_done: 'P4 Done', phase5_done: 'P5 Done',
};
const VERDICT_COLORS = { PASS: '#34d399', GO: '#34d399', MAYBE: '#fbbf24', WATCH: '#a78bfa', DROP: '#f87171' };
const RISK_COLORS = { LOW: 'green', MEDIUM: 'yellow', HIGH: 'orange', CRITICAL: 'red' };

/* ─── UTILITY ─── */
const fmt = (v, d = 1) => v != null ? Number(v).toFixed(d) : '—';
const fmtM = (v) => v != null ? `$${(v / 1000).toFixed(1)}B` : '—';
const fmtUSD = (v) => v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fmtINR = (v) => v != null ? `₹${Number(v).toLocaleString()}` : '—';
const fmtPct = (v) => v != null ? `${Number(v).toFixed(1)}%` : '—';
const fmtK = (v) => v != null ? (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Number(v).toLocaleString()}`) : '—';
const check = (v) => v === 1 ? '⚠️' : v === 0 ? '✅' : '—';

/* ─── MINI COMPONENTS ─── */
const KPI = ({ label, value, color = 'blue', sub }) => (
  <div style={{
    padding: '14px 18px', borderRadius: 10,
    background: `rgba(${RGB[color] || RGB.blue},0.1)`,
    border: `1px solid rgba(${RGB[color] || RGB.blue},0.25)`,
    textAlign: 'center', minWidth: 120,
  }}>
    <div style={{ fontSize: 26, fontWeight: 700, color: COLORS[color] || COLORS.blue, lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{sub}</div>}
  </div>
);

const Badge = ({ text, color }) => {
  const c = color || 'slate';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600,
      background: `rgba(${RGB[c] || RGB.slate},0.15)`,
      color: COLORS[c] || '#94a3b8',
      border: `1px solid rgba(${RGB[c] || RGB.slate},0.3)`,
      whiteSpace: 'nowrap',
    }}>{text}</span>
  );
};

const Section = ({ title, children, emoji = '📊', collapsible, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(148,163,184,0.08)',
      borderRadius: 12, padding: open ? '20px 22px' : '14px 22px', marginBottom: 16, backdropFilter: 'blur(10px)',
      transition: 'padding 0.2s',
    }}>
      <h3
        style={{ fontSize: 15, fontWeight: 600, marginBottom: open ? 14 : 0, color: '#e2e8f0', cursor: collapsible ? 'pointer' : 'default', userSelect: 'none' }}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        {emoji} {title} {collapsible && <span style={{ fontSize: 11, color: '#64748b' }}>{open ? '▾' : '▸'}</span>}
      </h3>
      {open && children}
    </div>
  );
};

const Pill = ({ text, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '5px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
    background: active ? 'rgba(79,140,255,0.2)' : 'rgba(17,24,39,0.5)',
    color: active ? COLORS.blue : '#94a3b8',
    border: active ? '1px solid rgba(79,140,255,0.3)' : '1px solid rgba(148,163,184,0.08)',
    fontWeight: active ? 600 : 400, transition: 'all 0.15s',
  }}>{text}</button>
);

/* ─── TABLE STYLES ─── */
const thStyle = { padding: '7px 10px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle = { padding: '6px 10px', color: '#e2e5ea', fontSize: 12 };
const thSort = { ...thStyle, cursor: 'pointer' };

/* ─── OVERVIEW TAB ─── */
const PipelineOverview = ({ codes, p2Data, p2bData, p3Data }) => {
  const totalVal = useMemo(() => codes.reduce((s, c) => s + (c.val_m || 0), 0), [codes]);
  const totalHS8 = useMemo(() => codes.reduce((s, c) => s + (c.hs8_count || 0), 0), [codes]);
  const avgScore = useMemo(() => codes.length ? (codes.reduce((s, c) => s + (c.drill_score || 0), 0) / codes.length) : 0, [codes]);
  const avgBCD = useMemo(() => codes.length ? (codes.reduce((s, c) => s + (c.bcd_rate || 0), 0) / codes.length) : 0, [codes]);

  const phases = useMemo(() => {
    const counts = {};
    codes.forEach(c => { const p = c.current_phase || 'unknown'; counts[p] = (counts[p] || 0) + 1; });
    return Object.entries(counts).map(([phase, count]) => ({ phase, label: PHASE_LABELS[phase] || phase, count })).sort((a, b) => b.count - a.count);
  }, [codes]);

  const verdicts = useMemo(() => {
    const order = ['PASS', 'GO', 'MAYBE', 'WATCH', 'DROP'];
    const counts = {};
    codes.forEach(c => { const v = c.verdict_scoring || 'UNKNOWN'; counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }, [codes]);

  const entryTiers = useMemo(() => {
    const counts = {};
    codes.forEach(c => { const t = c.entry_tier || 'UNKNOWN'; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [codes]);

  const regRisk = useMemo(() => {
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    codes.forEach(c => { const r = c.regulatory_risk || 'LOW'; if (counts[r] !== undefined) counts[r]++; else counts.LOW++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [codes]);

  const models = useMemo(() => {
    const counts = { REGULAR: 0, SPOT: 0, BROKER: 0, MIXED: 0, Pending: 0 };
    codes.forEach(c => { if (c.trading_model && counts[c.trading_model] !== undefined) counts[c.trading_model]++; else counts.Pending++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [codes]);

  const qaStats = useMemo(() => {
    let passed = 0, failed = 0, pending = 0;
    codes.forEach(c => { if (c.qa_status === 'PASSED') passed++; else if (c.qa_status === 'FAILED') failed++; else pending++; });
    return { passed, failed, pending };
  }, [codes]);

  // Top 15 by trade value
  const topByValue = useMemo(() =>
    [...codes].sort((a, b) => (b.val_m || 0) - (a.val_m || 0)).slice(0, 15)
      .map(c => ({ hs4: c.hs4, val: +(c.val_m || 0).toFixed(0), name: (c.commodity || '').slice(0, 30) })),
    [codes]
  );

  return (
    <>
      {/* KPI Row 1 — Core Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
        <KPI label="Total Codes" value={codes.length} color="blue" sub="Electronics HS4" />
        <KPI label="Trade Value" value={fmtM(totalVal)} color="cyan" sub="Annual imports" />
        <KPI label="HS8 Depth" value={totalHS8.toLocaleString()} color="indigo" sub="Sub-product codes" />
        <KPI label="Avg Score" value={avgScore.toFixed(1)} color="purple" sub={`of ~120 max`} />
        <KPI label="Avg BCD" value={`${avgBCD.toFixed(1)}%`} color="orange" sub="Basic Customs Duty" />
        <KPI label="Shortage Prone" value={codes.filter(c => c.shortage_prone).length} color="red" sub="Supply-volatile" />
      </div>
      {/* KPI Row 2 — Pipeline Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
        <KPI label="P2b Regulatory" value={p2bData.filter(r => r.completed_at).length} color="teal" sub={`of ${p2bData.length} baseline`} />
        <KPI label="P2 Supply" value={p2Data.length} color="orange" sub="Alibaba researched" />
        <KPI label="P3 Demand" value={p3Data.length} color="yellow" sub="IndiaMART researched" />
        <KPI label="QA Passed" value={qaStats.passed} color="green" sub={`${qaStats.failed} failed · ${qaStats.pending} pending`} />
        <KPI label="PASS/GO" value={codes.filter(c => c.verdict_scoring === 'PASS' || c.verdict_scoring === 'GO').length} color="green" sub="Top-tier codes" />
        <KPI label="Models Set" value={codes.filter(c => c.trading_model).length} color="lime" sub="Trading model assigned" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Verdict + Entry Tier */}
        <Section title="Scoring Verdicts" emoji="⚡">
          <div style={{ display: 'flex', gap: 20 }}>
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={verdicts} cx="50%" cy="50%" outerRadius={72} dataKey="value" label={({ name, value }) => `${name} ${value}`} labelLine={false}>
                  {verdicts.map(e => <Cell key={e.name} fill={VERDICT_COLORS[e.name] || '#5c6070'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>Entry Tier Breakdown</div>
              {entryTiers.map(t => (
                <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                  <span style={{ fontSize: 12, color: '#e2e5ea' }}>{t.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.name === 'HIGH_CONFIDENCE' ? COLORS.green : t.name === 'MODERATE' ? COLORS.yellow : COLORS.slate }}>{t.value}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, fontWeight: 600 }}>Regulatory Risk</div>
              {regRisk.map(r => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                  <Badge text={r.name} color={RISK_COLORS[r.name]} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e5ea' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Trading Model + Pipeline Phase */}
        <Section title="Pipeline & Trading Models" emoji="🔄">
          <div style={{ display: 'flex', gap: 20 }}>
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={models} cx="50%" cy="50%" outerRadius={72} dataKey="value" label={({ name, value }) => `${name} ${value}`} labelLine={false}>
                  {models.map(e => <Cell key={e.name} fill={MODEL_COLORS[e.name] || '#5c6070'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>Phase Distribution</div>
              {phases.map(p => (
                <div key={p.phase} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                  <Badge text={p.label} color="blue" />
                  <div style={{ flex: 1, margin: '0 10px', height: 4, background: 'rgba(148,163,184,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(p.count / codes.length * 100)}%`, height: '100%', background: COLORS.blue, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e5ea', minWidth: 28, textAlign: 'right' }}>{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Top 15 by Trade Value */}
      <Section title="Top 15 by Trade Value" emoji="💎">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topByValue} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
            <XAxis dataKey="hs4" tick={{ fill: '#8b90a0', fontSize: 10 }} />
            <YAxis tick={{ fill: '#8b90a0', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, n, p) => [`$${v}M`, p.payload.name]} />
            <Bar dataKey="val" fill={COLORS.cyan} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>
    </>
  );
};

/* ─── REGULATORY TAB ─── */
const RegulatoryView = ({ codes, p2bData }) => {
  const [filter, setFilter] = useState('all');
  const merged = useMemo(() => {
    const regMap = {};
    p2bData.forEach(r => { regMap[r.hs4] = r; });
    return codes.map(c => ({ ...c, reg: regMap[c.hs4] || null })).sort((a, b) => (b.drill_score || 0) - (a.drill_score || 0));
  }, [codes, p2bData]);

  const riskCounts = useMemo(() => {
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    p2bData.forEach(r => { const s = r.regulatory_risk_score || 'LOW'; counts[s] = (counts[s] || 0) + 1; });
    return counts;
  }, [p2bData]);

  const certCounts = useMemo(() => {
    let bis = 0, wpc = 0, tec = 0, epr = 0, pmp = 0, fta = 0, add = 0, dgft = 0, aidc = 0;
    p2bData.forEach(r => {
      if (r.check_bis_qco === 1) bis++;
      if (r.check_wpc === 1) wpc++;
      if (r.check_tec === 1) tec++;
      if (r.check_epr === 1) epr++;
      if (r.check_pmp === 1) pmp++;
      if (r.check_fta === 1) fta++;
      if (r.check_anti_dumping === 1 || r.add_rate_pct > 0) add++;
      if (r.check_dgft_restriction === 1) dgft++;
      if (r.check_aidc === 1) aidc++;
    });
    return { bis, wpc, tec, epr, pmp, fta, add, dgft, aidc };
  }, [p2bData]);

  const avgDuty = useMemo(() => {
    const vals = p2bData.filter(r => r.total_duty_pct > 0);
    return vals.length ? (vals.reduce((s, r) => s + r.total_duty_pct, 0) / vals.length) : 0;
  }, [p2bData]);

  const filtered = useMemo(() => {
    if (filter === 'all') return merged;
    if (filter === 'add') return merged.filter(c => c.reg && (c.reg.check_anti_dumping === 1 || c.reg.add_rate_pct > 0));
    if (filter === 'bis') return merged.filter(c => c.reg && c.reg.check_bis_qco === 1);
    if (filter === 'dgft') return merged.filter(c => c.reg && c.reg.check_dgft_restriction === 1);
    if (filter === 'fta') return merged.filter(c => c.reg && c.reg.check_fta === 1);
    if (filter === 'epr') return merged.filter(c => c.reg && c.reg.check_epr === 1);
    if (filter === 'high') return merged.filter(c => c.reg && (c.reg.regulatory_risk_score === 'HIGH' || c.reg.regulatory_risk_score === 'CRITICAL'));
    return merged;
  }, [merged, filter]);

  // Duty distribution chart
  const dutyBuckets = useMemo(() => {
    const buckets = { '0-20%': 0, '20-30%': 0, '30-40%': 0, '40-50%': 0, '50%+': 0 };
    p2bData.forEach(r => {
      const d = r.total_duty_pct || 0;
      if (d <= 20) buckets['0-20%']++;
      else if (d <= 30) buckets['20-30%']++;
      else if (d <= 40) buckets['30-40%']++;
      else if (d <= 50) buckets['40-50%']++;
      else buckets['50%+']++;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [p2bData]);

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: 8, marginBottom: 14 }}>
        <KPI label="LOW Risk" value={riskCounts.LOW} color="green" />
        <KPI label="MEDIUM" value={riskCounts.MEDIUM} color="yellow" />
        <KPI label="HIGH" value={riskCounts.HIGH} color="orange" />
        <KPI label="CRITICAL" value={riskCounts.CRITICAL} color="red" />
        <KPI label="Avg Duty" value={`${avgDuty.toFixed(1)}%`} color="blue" sub="BCD+IGST+SWS" />
        <KPI label="Anti-Dump" value={certCounts.add} color="red" sub="ADD flagged" />
        <KPI label="DGFT Restricted" value={certCounts.dgft} color="purple" />
        <KPI label="BIS QCO" value={certCounts.bis} color="yellow" sub="Certification req" />
        <KPI label="WPC" value={certCounts.wpc} color="cyan" />
        <KPI label="TEC" value={certCounts.tec} color="indigo" />
        <KPI label="EPR E-Waste" value={certCounts.epr} color="pink" />
        <KPI label="FTA Benefit" value={certCounts.fta} color="lime" sub="Duty reduction" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Duty Distribution */}
        <Section title="Total Duty Distribution" emoji="📊">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dutyBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
              <XAxis dataKey="range" tick={{ fill: '#8b90a0', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8b90a0', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill={COLORS.orange} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Certification Requirements Heatmap */}
        <Section title="13-Check Compliance Summary" emoji="🛡️">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { label: 'Anti-Dumping', val: certCounts.add, color: certCounts.add > 0 ? 'red' : 'green' },
              { label: 'Safeguard Duty', val: p2bData.filter(r => r.check_safeguard === 1).length, color: 'yellow' },
              { label: 'AIDC (Agri Cess)', val: certCounts.aidc, color: certCounts.aidc > 0 ? 'orange' : 'green' },
              { label: 'DGFT Restriction', val: certCounts.dgft, color: certCounts.dgft > 0 ? 'red' : 'green' },
              { label: 'ADD Investigation', val: p2bData.filter(r => r.check_add_investigation === 1).length, color: 'yellow' },
              { label: 'WPC Cert', val: certCounts.wpc, color: certCounts.wpc > 0 ? 'cyan' : 'green' },
              { label: 'TEC Cert', val: certCounts.tec, color: certCounts.tec > 0 ? 'indigo' : 'green' },
              { label: 'BIS QCO', val: certCounts.bis, color: certCounts.bis > 0 ? 'yellow' : 'green' },
              { label: 'PMP Impact', val: certCounts.pmp, color: certCounts.pmp > 0 ? 'orange' : 'green' },
              { label: 'Input ADD', val: p2bData.filter(r => r.check_input_add === 1).length, color: 'yellow' },
              { label: 'EPR E-Waste', val: certCounts.epr, color: certCounts.epr > 0 ? 'pink' : 'green' },
              { label: 'SWS (10% BCD)', val: p2bData.length, color: 'slate' },
              { label: 'FTA Opportunity', val: certCounts.fta, color: certCounts.fta > 0 ? 'lime' : 'slate' },
            ].map(c => (
              <div key={c.label} style={{
                padding: '8px 10px', borderRadius: 8,
                background: `rgba(${RGB[c.color] || RGB.slate},0.08)`,
                border: `1px solid rgba(${RGB[c.color] || RGB.slate},0.2)`,
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS[c.color] || COLORS.slate }}>{c.val}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{c.label}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['all', 'All Codes'], ['high', 'HIGH/CRITICAL'], ['add', 'Anti-Dumping'], ['dgft', 'DGFT Restricted'], ['bis', 'BIS QCO'], ['fta', 'FTA Benefit'], ['epr', 'EPR E-Waste']].map(([id, label]) => (
          <Pill key={id} text={label} active={filter === id} onClick={() => setFilter(id)} />
        ))}
      </div>

      {/* Full Regulatory Table */}
      <Section title={`Regulatory Detail — ${filtered.length} codes`} emoji="📋">
        <div style={{ overflowX: 'auto', maxHeight: 500 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#111827', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                <th style={thStyle}>HS4</th><th style={thStyle}>Product</th><th style={thStyle}>Risk</th>
                <th style={thStyle}>BCD%</th><th style={thStyle}>IGST%</th><th style={thStyle}>SWS%</th><th style={thStyle}>Total%</th>
                <th style={thStyle}>ADD</th><th style={thStyle}>DGFT</th><th style={thStyle}>BIS</th>
                <th style={thStyle}>WPC</th><th style={thStyle}>TEC</th><th style={thStyle}>EPR</th>
                <th style={thStyle}>PMP</th><th style={thStyle}>FTA</th><th style={thStyle}>AIDC</th>
                <th style={thStyle}>Cost ₹</th><th style={thStyle}>Weeks</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const r = c.reg;
                return (
                  <tr key={c.hs4} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                    <td style={tdStyle}><span style={{ color: COLORS.blue, fontWeight: 600 }}>{c.hs4}</span></td>
                    <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.commodity}</td>
                    <td style={tdStyle}><Badge text={r?.regulatory_risk_score || c.regulatory_risk || '—'} color={RISK_COLORS[r?.regulatory_risk_score || c.regulatory_risk] || 'slate'} /></td>
                    <td style={tdStyle}>{fmt(r?.bcd_pct)}</td>
                    <td style={tdStyle}>{fmt(r?.igst_pct)}</td>
                    <td style={tdStyle}>{fmt(r?.sws_pct)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: (r?.total_duty_pct || 0) > 40 ? COLORS.red : (r?.total_duty_pct || 0) > 30 ? COLORS.yellow : COLORS.green }}>{fmt(r?.total_duty_pct)}</td>
                    <td style={tdStyle}>{check(r?.check_anti_dumping)}{r?.add_rate_pct > 0 ? ` ${fmt(r.add_rate_pct)}%` : ''}</td>
                    <td style={tdStyle}>{check(r?.check_dgft_restriction)}</td>
                    <td style={tdStyle}>{check(r?.check_bis_qco)}</td>
                    <td style={tdStyle}>{check(r?.check_wpc)}</td>
                    <td style={tdStyle}>{check(r?.check_tec)}</td>
                    <td style={tdStyle}>{check(r?.check_epr)}</td>
                    <td style={tdStyle}>{check(r?.check_pmp)}</td>
                    <td style={tdStyle}>{r?.check_fta === 1 ? <span style={{ color: COLORS.lime }}>✓ {r.fta_duty_reduction_pct ? `−${fmt(r.fta_duty_reduction_pct)}%` : ''}</span> : '—'}</td>
                    <td style={tdStyle}>{check(r?.check_aidc)}{r?.aidc_pct > 0 ? ` ${fmt(r.aidc_pct)}%` : ''}</td>
                    <td style={tdStyle}>{fmtK(r?.total_compliance_cost_inr)}</td>
                    <td style={tdStyle}>{r?.total_compliance_weeks || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
};

/* ─── SUPPLY & DEMAND TAB ─── */
const SupplyDemandView = ({ codes, p2Data, p3Data, p2bData }) => {
  const merged = useMemo(() => {
    const p2Map = {}, p3Map = {}, regMap = {};
    p2Data.forEach(r => { p2Map[r.hs4] = r; });
    p3Data.forEach(r => { p3Map[r.hs4] = r; });
    p2bData.forEach(r => { regMap[r.hs4] = r; });
    return codes.map(c => ({ ...c, supply: p2Map[c.hs4] || null, demand: p3Map[c.hs4] || null, reg: regMap[c.hs4] || null }))
      .sort((a, b) => (b.drill_score || 0) - (a.drill_score || 0));
  }, [codes, p2Data, p3Data, p2bData]);

  const withSupply = merged.filter(c => c.supply);
  const withDemand = merged.filter(c => c.demand);
  const withMargin = merged.filter(c => c.demand?.gross_margin_pct != null);

  const marginChart = useMemo(() =>
    withMargin.filter(c => c.demand.gross_margin_pct > 0)
      .sort((a, b) => b.demand.gross_margin_pct - a.demand.gross_margin_pct).slice(0, 20)
      .map(c => ({ hs4: c.hs4, margin: +(c.demand.gross_margin_pct).toFixed(1), name: (c.commodity || '').slice(0, 30) })),
    [withMargin]
  );

  const supplyChart = useMemo(() =>
    withSupply.filter(c => c.supply.total_suppliers > 0)
      .sort((a, b) => b.supply.total_suppliers - a.supply.total_suppliers).slice(0, 20)
      .map(c => ({ hs4: c.hs4, suppliers: c.supply.total_suppliers, gold: c.supply.gold_supplier_pct || 0, name: (c.commodity || '').slice(0, 25) })),
    [withSupply]
  );

  // Multi-source stats
  const multiSourceStats = useMemo(() => {
    let alibaba = 0, mic = 0, dhgate = 0, ali1688 = 0, importyeti = 0;
    p2Data.forEach(r => {
      if (r.total_suppliers > 0) alibaba++;
      if (r.mic_supplier_count > 0) mic++;
      if (r.dhgate_supplier_count > 0) dhgate++;
      if (r.ali1688_factory_count > 0) ali1688++;
      if (r.importyeti_shipper_count > 0) importyeti++;
    });
    return { alibaba, mic, dhgate, ali1688, importyeti };
  }, [p2Data]);

  const demandSourceStats = useMemo(() => {
    let indiamart = 0, tradeindia = 0, gmaps = 0, gtrends = 0, justdial = 0;
    p3Data.forEach(r => {
      if (r.total_sellers > 0) indiamart++;
      if (r.tradeindia_seller_count > 0) tradeindia++;
      if (r.google_maps_cluster_count > 0) gmaps++;
      if (r.google_trends_interest > 0) gtrends++;
      if (r.justdial_count > 0) justdial++;
    });
    return { indiamart, tradeindia, gmaps, gtrends, justdial };
  }, [p3Data]);

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        <KPI label="Supply Researched" value={withSupply.length} color="blue" sub={`of ${codes.length}`} />
        <KPI label="Demand Researched" value={withDemand.length} color="green" sub={`of ${codes.length}`} />
        <KPI label="Margin Calculated" value={withMargin.length} color="yellow" />
        <KPI label="Avg Margin" value={withMargin.length > 0 ? `${(withMargin.reduce((s, c) => s + c.demand.gross_margin_pct, 0) / withMargin.length).toFixed(1)}%` : '—'} color="green" sub="Gross margin" />
        <KPI label="Avg Suppliers" value={withSupply.length > 0 ? Math.round(withSupply.reduce((s, c) => s + (c.supply.total_suppliers || 0), 0) / withSupply.length) : '—'} color="cyan" />
        <KPI label="Avg Sellers" value={withDemand.length > 0 ? Math.round(withDemand.reduce((s, c) => s + (c.demand.total_sellers || 0), 0) / withDemand.length) : '—'} color="orange" />
      </div>

      {/* Multi-source coverage */}
      {(p2Data.length > 0 || p3Data.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Section title="Supply Sources Coverage" emoji="🏭">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { label: 'Alibaba', val: multiSourceStats.alibaba, color: 'orange' },
                { label: 'Made-in-China', val: multiSourceStats.mic, color: 'blue' },
                { label: 'DHgate', val: multiSourceStats.dhgate, color: 'cyan' },
                { label: '1688.com', val: multiSourceStats.ali1688, color: 'red' },
                { label: 'ImportYeti', val: multiSourceStats.importyeti, color: 'purple' },
                { label: 'Sources/Code', val: p2Data.length > 0 ? (p2Data.reduce((s, r) => s + (r.source_count || 0), 0) / p2Data.length).toFixed(1) : '—', color: 'green' },
              ].map(c => (
                <div key={c.label} style={{ padding: '8px', borderRadius: 8, background: `rgba(${RGB[c.color]},0.08)`, border: `1px solid rgba(${RGB[c.color]},0.2)`, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS[c.color] }}>{c.val}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{c.label}</div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Demand Sources Coverage" emoji="🎯">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { label: 'IndiaMART', val: demandSourceStats.indiamart, color: 'green' },
                { label: 'TradeIndia', val: demandSourceStats.tradeindia, color: 'yellow' },
                { label: 'Google Maps', val: demandSourceStats.gmaps, color: 'blue' },
                { label: 'Google Trends', val: demandSourceStats.gtrends, color: 'red' },
                { label: 'JustDial', val: demandSourceStats.justdial, color: 'orange' },
                { label: 'Sources/Code', val: p3Data.length > 0 ? (p3Data.reduce((s, r) => s + (r.source_count || 0), 0) / p3Data.length).toFixed(1) : '—', color: 'teal' },
              ].map(c => (
                <div key={c.label} style={{ padding: '8px', borderRadius: 8, background: `rgba(${RGB[c.color]},0.08)`, border: `1px solid rgba(${RGB[c.color]},0.2)`, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS[c.color] }}>{c.val}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{c.label}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {marginChart.length > 0 && (
          <Section title="Top 20 by Gross Margin %" emoji="💰">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={marginChart} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis type="number" tick={{ fill: '#8b90a0', fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="hs4" tick={{ fill: '#e2e5ea', fontSize: 10 }} width={40} />
                <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n, p) => [`${v}%`, p.payload.name]} />
                <Bar dataKey="margin" fill={COLORS.green} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
        {supplyChart.length > 0 && (
          <Section title="Top 20 by Supplier Count" emoji="🏭">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={supplyChart} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis type="number" tick={{ fill: '#8b90a0', fontSize: 10 }} />
                <YAxis type="category" dataKey="hs4" tick={{ fill: '#e2e5ea', fontSize: 10 }} width={40} />
                <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n, p) => [v, p.payload.name]} />
                <Bar dataKey="suppliers" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
      </div>

      {/* Full data table */}
      {(withSupply.length > 0 || withDemand.length > 0) ? (
        <Section title="Supply & Demand Detail Table" emoji="📋">
          <div style={{ overflowX: 'auto', maxHeight: 500 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#111827', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                  <th style={thStyle}>HS4</th><th style={thStyle}>Product</th>
                  <th style={thStyle}>Suppliers</th><th style={thStyle}>Gold%</th><th style={thStyle}>FOB Low</th><th style={thStyle}>FOB High</th><th style={thStyle}>MOQ</th>
                  <th style={thStyle}>MIC</th><th style={thStyle}>DHgate</th>
                  <th style={thStyle}>Sellers</th><th style={thStyle}>Mfr%</th><th style={thStyle}>₹ Low</th><th style={thStyle}>₹ High</th>
                  <th style={thStyle}>Landed ₹</th><th style={thStyle}>Margin%</th>
                  <th style={thStyle}>TradeIndia</th><th style={thStyle}>Model</th>
                </tr>
              </thead>
              <tbody>
                {merged.filter(c => c.supply || c.demand).map(c => (
                  <tr key={c.hs4} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                    <td style={tdStyle}><span style={{ color: COLORS.blue, fontWeight: 600 }}>{c.hs4}</span></td>
                    <td style={{ ...tdStyle, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.commodity}</td>
                    <td style={tdStyle}>{c.supply?.total_suppliers ?? '—'}</td>
                    <td style={tdStyle}>{c.supply?.gold_supplier_pct != null ? `${c.supply.gold_supplier_pct.toFixed(0)}%` : '—'}</td>
                    <td style={tdStyle}>{fmtUSD(c.supply?.fob_lowest_usd)}</td>
                    <td style={tdStyle}>{fmtUSD(c.supply?.fob_highest_usd)}</td>
                    <td style={{ ...tdStyle, fontSize: 10 }}>{c.supply?.typical_moq || '—'}</td>
                    <td style={tdStyle}>{c.supply?.mic_supplier_count ?? '—'}</td>
                    <td style={tdStyle}>{c.supply?.dhgate_supplier_count ?? '—'}</td>
                    <td style={tdStyle}>{c.demand?.total_sellers ?? '—'}</td>
                    <td style={tdStyle}>{c.demand?.manufacturer_pct != null ? `${c.demand.manufacturer_pct.toFixed(0)}%` : '—'}</td>
                    <td style={tdStyle}>{fmtINR(c.demand?.price_low_inr)}</td>
                    <td style={tdStyle}>{fmtINR(c.demand?.price_high_inr)}</td>
                    <td style={tdStyle}>{fmtINR(c.demand?.landed_cost_inr)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: (c.demand?.gross_margin_pct || 0) > 20 ? COLORS.green : (c.demand?.gross_margin_pct || 0) > 10 ? COLORS.yellow : c.demand?.gross_margin_pct != null ? COLORS.red : '#64748b' }}>
                      {fmtPct(c.demand?.gross_margin_pct)}
                    </td>
                    <td style={tdStyle}>{c.demand?.tradeindia_seller_count ?? '—'}</td>
                    <td style={tdStyle}><Badge text={c.trading_model || '—'} color={c.trading_model === 'REGULAR' ? 'green' : c.trading_model === 'SPOT' ? 'yellow' : c.trading_model === 'BROKER' ? 'purple' : c.trading_model === 'MIXED' ? 'blue' : 'slate'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Section title="Awaiting Supply & Demand Data" emoji="⏳">
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Phase 2 (Alibaba) and Phase 3 (IndiaMART) research has not started yet. Data will appear here as codes are processed.</p>
        </Section>
      )}
    </>
  );
};

/* ─── SCORING TAB (Phase 5) ─── */
const ScoringView = ({ codes, p5Data }) => {
  const merged = useMemo(() => {
    const p5Map = {};
    p5Data.forEach(r => { p5Map[r.hs4] = r; });
    return codes.map(c => ({ ...c, score: p5Map[c.hs4] || null }))
      .filter(c => c.score)
      .sort((a, b) => (b.score?.total_score || 0) - (a.score?.total_score || 0));
  }, [codes, p5Data]);

  if (merged.length === 0) {
    return (
      <Section title="150-Point Scoring" emoji="🏆">
        <p style={{ color: '#94a3b8', fontSize: 13 }}>No Phase 5 scoring data yet. Codes must pass through Phases 2-4 before final scoring.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
          {[
            { factor: 'Gross Margin', max: 25 }, { factor: 'Buyer Access', max: 20 },
            { factor: 'Supply Reliability', max: 15 }, { factor: 'Market Size', max: 15 },
            { factor: 'Regulatory Risk', max: 15 }, { factor: 'Competition', max: 10 },
            { factor: 'Growth Trend', max: 10 }, { factor: 'Working Capital', max: 10 },
            { factor: 'Logistics', max: 10 }, { factor: 'Obsolescence', max: 10 },
            { factor: 'Capital Required', max: 5 }, { factor: 'FTA Opportunity', max: 5 },
          ].map(f => (
            <div key={f.factor} style={{ padding: '10px', borderRadius: 8, background: 'rgba(79,140,255,0.06)', border: '1px solid rgba(79,140,255,0.12)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.blue }}>{f.max} pts</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{f.factor}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <div style={{ fontSize: 12, color: '#e2e5ea' }}>Verdict Thresholds: <span style={{ color: COLORS.green, fontWeight: 600 }}>PURSUE 120+</span> · <span style={{ color: COLORS.cyan, fontWeight: 600 }}>STRONG 90-119</span> · <span style={{ color: COLORS.yellow, fontWeight: 600 }}>MODERATE 60-89</span> · <span style={{ color: COLORS.red, fontWeight: 600 }}>DROP &lt;60</span></div>
        </div>
      </Section>
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        <KPI label="Scored" value={merged.length} color="blue" sub="Phase 5 complete" />
        <KPI label="PURSUE" value={merged.filter(c => c.score.total_score >= 120).length} color="green" sub="120+ pts" />
        <KPI label="STRONG" value={merged.filter(c => c.score.total_score >= 90 && c.score.total_score < 120).length} color="cyan" sub="90-119 pts" />
        <KPI label="MODERATE" value={merged.filter(c => c.score.total_score >= 60 && c.score.total_score < 90).length} color="yellow" sub="60-89 pts" />
        <KPI label="DROP" value={merged.filter(c => c.score.total_score < 60).length} color="red" sub="<60 pts" />
        <KPI label="Avg Score" value={fmt(merged.reduce((s, c) => s + c.score.total_score, 0) / merged.length)} color="purple" sub="of 150 max" />
      </div>

      <Section title="Scoring Breakdown Table" emoji="📊">
        <div style={{ overflowX: 'auto', maxHeight: 500 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#111827', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                <th style={thStyle}>HS4</th><th style={thStyle}>Total</th><th style={thStyle}>Verdict</th>
                <th style={thStyle}>Margin /25</th><th style={thStyle}>Buyers /20</th><th style={thStyle}>Supply /15</th>
                <th style={thStyle}>Market /15</th><th style={thStyle}>Reg /15</th><th style={thStyle}>Comp /10</th>
                <th style={thStyle}>Growth /10</th><th style={thStyle}>WC /10</th><th style={thStyle}>Logistics /10</th>
                <th style={thStyle}>Obsol /10</th><th style={thStyle}>Capital /5</th><th style={thStyle}>FTA /5</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {merged.map(c => {
                const s = c.score;
                const verdict = s.total_score >= 120 ? 'PURSUE' : s.total_score >= 90 ? 'STRONG' : s.total_score >= 60 ? 'MODERATE' : 'DROP';
                const vColor = s.total_score >= 120 ? 'green' : s.total_score >= 90 ? 'cyan' : s.total_score >= 60 ? 'yellow' : 'red';
                return (
                  <tr key={c.hs4} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                    <td style={tdStyle}><span style={{ color: COLORS.blue, fontWeight: 600 }}>{c.hs4}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: COLORS[vColor] }}>{s.total_score}</td>
                    <td style={tdStyle}><Badge text={verdict} color={vColor} /></td>
                    <td style={tdStyle}>{s.pts_gross_margin ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_buyer_accessibility ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_supply_reliability ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_market_size ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_regulatory_risk ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_competition ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_growth ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_working_capital ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_logistics ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_obsolescence ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_capital_required ?? '—'}</td>
                    <td style={tdStyle}>{s.pts_fta ?? '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>{s.go_nogo_notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
};

/* ─── ALL CODES TABLE ─── */
const FullCodeTable = ({ codes, p2bData, p2Data, p3Data, p5Data, sortField, setSortField, sortDir, setSortDir, search, setSearch }) => {
  const regMap = useMemo(() => { const m = {}; p2bData.forEach(r => m[r.hs4] = r); return m; }, [p2bData]);
  const p2Map = useMemo(() => { const m = {}; p2Data.forEach(r => m[r.hs4] = r); return m; }, [p2Data]);
  const p3Map = useMemo(() => { const m = {}; p3Data.forEach(r => m[r.hs4] = r); return m; }, [p3Data]);
  const p5Map = useMemo(() => { const m = {}; p5Data.forEach(r => m[r.hs4] = r); return m; }, [p5Data]);
  const [expanded, setExpanded] = useState(null);

  const sorted = useMemo(() => {
    let data = codes.map(c => ({ ...c, reg: regMap[c.hs4], supply: p2Map[c.hs4], demand: p3Map[c.hs4], score: p5Map[c.hs4] }));
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(c => c.hs4.includes(s) || (c.commodity || '').toLowerCase().includes(s) || (c.trading_model || '').toLowerCase().includes(s) || (c.entry_tier || '').toLowerCase().includes(s));
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
        case 'hs8': av = a.hs8_count || 0; bv = b.hs8_count || 0; break;
        case 'risk': av = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[a.reg?.regulatory_risk_score || a.regulatory_risk] || 0; bv = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[b.reg?.regulatory_risk_score || b.regulatory_risk] || 0; break;
        default: av = a.drill_score || 0; bv = b.drill_score || 0;
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return data;
  }, [codes, regMap, p2Map, p3Map, p5Map, sortField, sortDir, search]);

  const clickSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };
  const arrow = (field) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <Section title={`All ${codes.length} Codes — ${sorted.length} shown`} emoji="📊">
      <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="text" placeholder="Search HS4, product, model, tier..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '7px 14px', color: '#e2e5ea', fontSize: 12, width: 300, outline: 'none' }}
        />
        <span style={{ fontSize: 11, color: '#64748b' }}>Click column headers to sort · Click row to expand details</span>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 600 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#111827', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
              <th style={thSort} onClick={() => clickSort('hs4')}>HS4{arrow('hs4')}</th>
              <th style={thStyle}>Product</th>
              <th style={thSort} onClick={() => clickSort('val_m')}>Val $M{arrow('val_m')}</th>
              <th style={thSort} onClick={() => clickSort('drill_score')}>Score{arrow('drill_score')}</th>
              <th style={thStyle}>Verdict</th>
              <th style={thStyle}>Tier</th>
              <th style={thSort} onClick={() => clickSort('hs8')}>HS8s{arrow('hs8')}</th>
              <th style={thSort} onClick={() => clickSort('duty')}>Duty%{arrow('duty')}</th>
              <th style={thSort} onClick={() => clickSort('risk')}>Risk{arrow('risk')}</th>
              <th style={thSort} onClick={() => clickSort('suppliers')}>Suppliers{arrow('suppliers')}</th>
              <th style={thSort} onClick={() => clickSort('margin')}>Margin%{arrow('margin')}</th>
              <th style={thStyle}>Phase</th>
              <th style={thStyle}>QA</th>
              <th style={thStyle}>Model</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => {
              const riskLevel = c.reg?.regulatory_risk_score || c.regulatory_risk || '—';
              return (
                <React.Fragment key={c.hs4}>
                  <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', cursor: 'pointer', background: expanded === c.hs4 ? 'rgba(79,140,255,0.05)' : 'transparent' }}
                    onClick={() => setExpanded(expanded === c.hs4 ? null : c.hs4)}>
                    <td style={tdStyle}><span style={{ color: COLORS.blue, fontWeight: 600 }}>{c.hs4}</span></td>
                    <td style={{ ...tdStyle, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.commodity}</td>
                    <td style={tdStyle}>{c.val_m != null ? `$${c.val_m.toFixed(0)}M` : '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{c.drill_score?.toFixed(1) || '—'}</td>
                    <td style={tdStyle}><Badge text={c.verdict_scoring || '—'} color={VERDICT_COLORS[c.verdict_scoring] ? (c.verdict_scoring === 'PASS' || c.verdict_scoring === 'GO' ? 'green' : c.verdict_scoring === 'MAYBE' ? 'yellow' : c.verdict_scoring === 'WATCH' ? 'purple' : 'red') : 'slate'} /></td>
                    <td style={tdStyle}><Badge text={c.entry_tier || '—'} color={c.entry_tier === 'HIGH_CONFIDENCE' ? 'green' : c.entry_tier === 'MODERATE' ? 'yellow' : 'slate'} /></td>
                    <td style={tdStyle}>{c.hs8_count || '—'}</td>
                    <td style={{ ...tdStyle, color: (c.reg?.total_duty_pct || 0) > 40 ? COLORS.red : (c.reg?.total_duty_pct || 0) > 30 ? COLORS.yellow : COLORS.green }}>
                      {c.reg?.total_duty_pct != null ? fmtPct(c.reg.total_duty_pct) : c.bcd_rate != null ? `${c.bcd_rate}%` : '—'}
                    </td>
                    <td style={tdStyle}><Badge text={riskLevel} color={RISK_COLORS[riskLevel] || 'slate'} /></td>
                    <td style={tdStyle}>{c.supply?.total_suppliers ?? '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: (c.demand?.gross_margin_pct || 0) > 20 ? COLORS.green : (c.demand?.gross_margin_pct || 0) > 10 ? COLORS.yellow : c.demand?.gross_margin_pct != null ? COLORS.red : '#64748b' }}>
                      {fmtPct(c.demand?.gross_margin_pct)}
                    </td>
                    <td style={tdStyle}><Badge text={PHASE_LABELS[c.current_phase] || c.current_phase || '—'} color="blue" /></td>
                    <td style={tdStyle}>
                      {c.qa_status === 'PASSED' ? <Badge text="PASS" color="green" /> : c.qa_status === 'FAILED' ? <Badge text="FAIL" color="red" /> : <span style={{ color: '#64748b' }}>—</span>}
                    </td>
                    <td style={tdStyle}><Badge text={c.trading_model || '—'} color={c.trading_model === 'REGULAR' ? 'green' : c.trading_model === 'SPOT' ? 'yellow' : c.trading_model === 'BROKER' ? 'purple' : c.trading_model === 'MIXED' ? 'blue' : 'slate'} /></td>
                  </tr>
                  {expanded === c.hs4 && (
                    <tr><td colSpan={14} style={{ padding: '12px 16px', background: 'rgba(17,24,39,0.8)', borderBottom: '2px solid rgba(79,140,255,0.15)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, fontSize: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: COLORS.blue, marginBottom: 6 }}>Regulatory</div>
                          <div>BCD: {fmt(c.reg?.bcd_pct)}% · IGST: {fmt(c.reg?.igst_pct)}% · SWS: {fmt(c.reg?.sws_pct)}%</div>
                          <div>Anti-Dumping: {check(c.reg?.check_anti_dumping)} {c.reg?.add_rate_pct > 0 ? `(${fmt(c.reg.add_rate_pct)}%)` : ''}</div>
                          <div>BIS QCO: {check(c.reg?.check_bis_qco)} · WPC: {check(c.reg?.check_wpc)} · TEC: {check(c.reg?.check_tec)}</div>
                          <div>DGFT: {check(c.reg?.check_dgft_restriction)} · EPR: {check(c.reg?.check_epr)} · PMP: {check(c.reg?.check_pmp)}</div>
                          {c.reg?.check_fta === 1 && <div style={{ color: COLORS.lime }}>FTA Benefit: {c.reg.fta_benefit_notes || `−${fmt(c.reg.fta_duty_reduction_pct)}%`}</div>}
                          {c.reg?.total_compliance_cost_inr && <div>Compliance Cost: {fmtK(c.reg.total_compliance_cost_inr)} · {c.reg.total_compliance_weeks}w</div>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: COLORS.orange, marginBottom: 6 }}>Supply (Alibaba)</div>
                          {c.supply ? <>
                            <div>Total Suppliers: {c.supply.total_suppliers} · Gold: {c.supply.gold_supplier_pct?.toFixed(0) || '—'}%</div>
                            <div>FOB: {fmtUSD(c.supply.fob_lowest_usd)} — {fmtUSD(c.supply.fob_highest_usd)}</div>
                            <div>MOQ: {c.supply.typical_moq || '—'}</div>
                            {c.supply.mic_supplier_count > 0 && <div>Made-in-China: {c.supply.mic_supplier_count} suppliers</div>}
                            {c.supply.dhgate_supplier_count > 0 && <div>DHgate: {c.supply.dhgate_supplier_count} suppliers</div>}
                            {c.supply.ali1688_factory_count > 0 && <div>1688.com: {c.supply.ali1688_factory_count} factories</div>}
                            <div style={{ color: '#64748b', fontSize: 10 }}>Sources: {c.supply.source_count || '—'} · {c.supply.data_sources_used || ''}</div>
                          </> : <div style={{ color: '#64748b' }}>Not yet researched</div>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: COLORS.green, marginBottom: 6 }}>Demand (IndiaMART)</div>
                          {c.demand ? <>
                            <div>Sellers: {c.demand.total_sellers} · Mfr: {c.demand.manufacturer_pct?.toFixed(0) || '—'}% · Trader: {c.demand.trader_pct?.toFixed(0) || '—'}%</div>
                            <div>Price: {fmtINR(c.demand.price_low_inr)} — {fmtINR(c.demand.price_high_inr)}</div>
                            <div>Landed Cost: {fmtINR(c.demand.landed_cost_inr)} · Sell: {fmtINR(c.demand.sell_price_inr)}</div>
                            <div style={{ fontWeight: 600, color: (c.demand.gross_margin_pct || 0) > 20 ? COLORS.green : COLORS.yellow }}>
                              Gross Margin: {fmtPct(c.demand.gross_margin_pct)} ({fmtINR(c.demand.gross_margin_inr)})
                            </div>
                            {c.demand.tradeindia_seller_count > 0 && <div>TradeIndia: {c.demand.tradeindia_seller_count} sellers</div>}
                            {c.demand.top_cities && <div>Cities: {c.demand.top_cities}</div>}
                            <div style={{ color: '#64748b', fontSize: 10 }}>Sources: {c.demand.source_count || '—'} · {c.demand.data_sources_used || ''}</div>
                          </> : <div style={{ color: '#64748b' }}>Not yet researched</div>}
                        </div>
                      </div>
                      {c.qa_warnings && <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(251,191,36,0.08)', borderRadius: 6, fontSize: 11, color: COLORS.yellow }}>QA Warnings: {c.qa_warnings}</div>}
                      {c.trading_model_reason && <div style={{ marginTop: 4, padding: '6px 10px', background: 'rgba(79,140,255,0.06)', borderRadius: 6, fontSize: 11, color: '#94a3b8' }}>Model Reason: {c.trading_model_reason}</div>}
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

/* ─── MAIN TAB ─── */
const VIEW_TABS = [
  { id: 'overview', label: '📊 Overview', desc: 'Pipeline KPIs & charts' },
  { id: 'regulatory', label: '⚖️ Regulatory', desc: '13-check compliance detail' },
  { id: 'supply_demand', label: '📦 Supply & Demand', desc: 'Multi-source Alibaba + IndiaMART' },
  { id: 'scoring', label: '🏆 Scoring', desc: '150-point final viability' },
  { id: 'all_codes', label: '📋 All Codes', desc: 'Full sortable table with expandable rows' },
];

export default function ElectronicsResearch() {
  const [view, setView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [codes, setCodes] = useState([]);
  const [p2Data, setP2Data] = useState([]);
  const [p2bData, setP2bData] = useState([]);
  const [p3Data, setP3Data] = useState([]);
  const [p5Data, setP5Data] = useState([]);

  const [sortField, setSortField] = useState('drill_score');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [resC, resP2, resP2b, resP3, resP5] = await Promise.all([
        supabase.from('research_codes').select('*').order('drill_score', { ascending: false }),
        supabase.from('phase2_alibaba_summary').select('*'),
        supabase.from('phase2b_regulatory').select('*'),
        supabase.from('phase3_indiamart_summary').select('*'),
        supabase.from('phase5_scoring').select('*'),
      ]);
      if (resC.error) throw resC.error;
      setCodes(resC.data || []);
      setP2Data(resP2.data || []);
      setP2bData(resP2b.data || []);
      setP3Data(resP3.data || []);
      setP5Data(resP5.data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Supabase fetch error:', err);
      setError(`Failed to load: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const i = setInterval(fetchAll, 60000); return () => clearInterval(i); }, [fetchAll]);

  if (loading && codes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading Electronics Research from Supabase...</div>
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
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
        padding: '10px 16px', background: 'rgba(17,24,39,0.6)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.08)',
      }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e5ea' }}>⚡ Electronics Research Pipeline v3</span>
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 12 }}>
            180 codes · {p2bData.length} regulatory · {p2Data.length} supply · {p3Data.length} demand · {p5Data.length} scored
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastRefresh && <span style={{ fontSize: 10, color: '#64748b' }}>Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} style={{
            padding: '4px 10px', background: 'rgba(79,140,255,0.15)', color: COLORS.blue,
            border: '1px solid rgba(79,140,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 11,
          }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {VIEW_TABS.map(t => (
          <Pill key={t.id} text={t.label} active={view === t.id} onClick={() => setView(t.id)} />
        ))}
      </div>

      {/* View Router */}
      {view === 'overview' && <PipelineOverview codes={codes} p2Data={p2Data} p2bData={p2bData} p3Data={p3Data} />}
      {view === 'regulatory' && <RegulatoryView codes={codes} p2bData={p2bData} />}
      {view === 'supply_demand' && <SupplyDemandView codes={codes} p2Data={p2Data} p3Data={p3Data} p2bData={p2bData} />}
      {view === 'scoring' && <ScoringView codes={codes} p5Data={p5Data} />}
      {view === 'all_codes' && (
        <FullCodeTable codes={codes} p2bData={p2bData} p2Data={p2Data} p3Data={p3Data} p5Data={p5Data}
          sortField={sortField} setSortField={setSortField} sortDir={sortDir} setSortDir={setSortDir}
          search={search} setSearch={setSearch} />
      )}
    </div>
  );
}
