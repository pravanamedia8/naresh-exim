import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = { pass: '#34d399', maybe: '#fbbf24', watch: '#a78bfa', drop: '#f87171', blue: '#60a5fa', cyan: '#22d3ee', orange: '#fb923c' };
const RGB = { pass: 'rgba(52,211,153,0.12)', maybe: 'rgba(251,191,36,0.12)', watch: 'rgba(167,139,250,0.12)', drop: 'rgba(248,113,113,0.12)', blue: 'rgba(96,165,250,0.12)', cyan: 'rgba(34,211,238,0.12)', orange: 'rgba(251,146,60,0.12)' };
const MODEL_COLORS = { REGULAR: '#34d399', SPOT: '#fbbf24', BROKER: '#a78bfa', MIXED: '#22d3ee', UNASSIGNED: '#94a3b8' };
const PHASE_LABELS = {
  phase1_complete: 'P1: DB Screen', phase2_pending: 'P2: Alibaba', phase2_done: 'P2 Done',
  phase2b_pending: 'P2b: Regulatory', phase2b_done: 'P2b Done', phase3_pending: 'P3: IndiaMART',
  phase3_done: 'P3 Done', qa_pending: 'QA Gate', qa_pass: 'QA Pass', phase4_pending: 'P4: Volza',
  phase4_done: 'P4 Done', phase5_pending: 'P5: Scoring', phase5_done: 'Complete',
  complete: 'Complete', COMPLETE: 'Complete', 'N/A': 'Complete',
};

// --- Reusable components ---
const KPI = ({ label, value, variant = 'blue', sub = '' }) => (
  <div style={{ background: 'var(--bg2,#111827)', border: '1px solid var(--border,rgba(148,163,184,0.08))', borderRadius: '12px', padding: '16px 20px' }}>
    <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS[variant] || '#e2e8f0' }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
  </div>
);

const Badge = ({ label, type = '' }) => {
  const t = (type || label || '').toUpperCase();
  const color = t.includes('PASS') || t.includes('STRONG') || t.includes('LOW') || t.includes('PURSUE') || t.includes('FREE') || t.includes('CLEAR') ? 'pass'
    : t.includes('MAYBE') || t.includes('MEDIUM') || t.includes('SPOT') || t.includes('MODERATE') ? 'maybe'
    : t.includes('HIGH') || t.includes('DROP') || t.includes('FAIL') || t.includes('RESTRICTED') ? 'drop'
    : t.includes('MIXED') || t.includes('BROKER') ? 'watch'
    : t.includes('GO') || t.includes('REGULAR') ? 'cyan' : 'blue';
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: RGB[color], color: COLORS[color], border: `1px solid ${COLORS[color]}50` }}>{label}</span>
  );
};

const Card = ({ title, emoji, children, style = {} }) => (
  <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', padding: '20px', ...style }}>
    {title && <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#e2e8f0' }}>{emoji && <span style={{ marginRight: '6px' }}>{emoji}</span>}{title}</h3>}
    {children}
  </div>
);

const MetricGrid = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>{children}</div>
);

const Metric = ({ label, value, sub, color }) => (
  <div style={{ background: '#1a2035', borderRadius: '10px', padding: '12px 16px' }}>
    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
    <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px', color: color || '#e2e8f0' }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
  </div>
);

const ProgressBar = ({ label, value, max, color = '#60a5fa', showLabel = true }) => (
  <div style={{ marginBottom: '10px' }}>
    {showLabel && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
      <span style={{ color: '#e2e8f0' }}>{label}</span>
      <span style={{ color: '#94a3b8' }}>{value}/{max}</span>
    </div>}
    <div style={{ background: '#1e293b', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ background: color, height: '100%', width: `${Math.min((value / (max || 1)) * 100, 100)}%`, borderRadius: '4px', transition: 'width .5s' }} />
    </div>
  </div>
);

const PhaseFlow = ({ phases }) => (
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
    {phases.map((p, i) => (
      <React.Fragment key={i}>
        <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: p.done ? RGB.pass : p.current ? RGB.blue : '#1e293b', color: p.done ? COLORS.pass : p.current ? COLORS.blue : '#64748b', border: p.current ? `1px solid ${COLORS.blue}60` : 'none' }}>{p.label}{p.done ? ' ✓' : ''}</span>
        {i < phases.length - 1 && <span style={{ color: '#64748b', fontSize: '14px' }}>→</span>}
      </React.Fragment>
    ))}
  </div>
);

const RegItem = ({ icon, label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#1a2035', borderRadius: '8px', fontSize: '12px' }}>
    <span style={{ fontSize: '16px' }}>{icon}</span> {label}: <strong style={{ color: color || '#e2e8f0' }}>{value}</strong>
  </div>
);

// Sort/filter hook
function useSortFilter(data, defaultSort = 'drill_score', defaultDir = 'desc') {
  const [sortField, setSortField] = useState(defaultSort);
  const [sortDir, setSortDir] = useState(defaultDir);
  const [search, setSearch] = useState('');
  const onSort = useCallback((field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }, [sortField]);
  const sorted = useMemo(() => {
    let filtered = [...data];
    if (search) { const s = search.toLowerCase(); filtered = filtered.filter(r => Object.values(r).some(v => v != null && String(v).toLowerCase().includes(s))); }
    filtered.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return filtered;
  }, [data, sortField, sortDir, search]);
  return { sorted, sortField, sortDir, onSort, search, setSearch };
}

const SortHeader = ({ label, field, sortField, sortDir, onSort, style = {} }) => (
  <th onClick={() => onSort(field)} style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', background: '#1a2035', borderBottom: '1px solid rgba(148,163,184,0.08)', position: 'sticky', top: 0, zIndex: 2, fontSize: '12px', ...style }}>
    {label} {sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
  </th>
);

const thStyle = { padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', background: '#1a2035', borderBottom: '1px solid rgba(148,163,184,0.08)', position: 'sticky', top: 0, zIndex: 2, fontSize: '12px' };
const tdStyle = { padding: '8px 12px', borderBottom: '1px solid rgba(148,163,184,0.05)', color: '#e2e8f0', verticalAlign: 'top', fontSize: '13px' };
const tooltipStyle = { background: '#111827', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#e2e8f0' };

// ===== MAIN COMPONENT =====
export default function ElectronicsResearch() {
  const [activeTab, setActiveTab] = useState('overview');
  const [deepDiveCode, setDeepDiveCode] = useState(null);
  const [codes, setCodes] = useState([]);
  const [regulatory, setRegulatory] = useState([]);
  const [supply, setSupply] = useState([]);
  const [demand, setDemand] = useState([]);
  const [scoring, setScoring] = useState([]);
  const [phase4, setPhase4] = useState([]);
  const [volzaShipments, setVolzaShipments] = useState([]);
  const [volzaBuyers, setVolzaBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [volzaHS4Filter, setVolzaHS4Filter] = useState('');
  const [volzaView, setVolzaView] = useState('overview');
  const PAGE_SIZE = 50;

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [codesRes, regRes, supRes, demRes, scorRes, p4Res, vsRes, vbRes] = await Promise.all([
          supabase.from('research_codes').select('*').order('drill_score', { ascending: false }),
          supabase.from('phase2b_regulatory').select('*'),
          supabase.from('phase2_alibaba_summary').select('*'),
          supabase.from('phase3_indiamart_summary').select('*'),
          supabase.from('phase5_scoring').select('*'),
          supabase.from('phase4_volza').select('*'),
          supabase.from('volza_shipments').select('*').limit(5000),
          supabase.from('volza_buyers').select('*'),
        ]);
        setCodes(codesRes.data || []);
        setRegulatory(regRes.data || []);
        setSupply(supRes.data || []);
        setDemand(demRes.data || []);
        setScoring(scorRes.data || []);
        setPhase4(p4Res.data || []);
        setVolzaShipments(vsRes.data || []);
        setVolzaBuyers(vbRes.data || []);
      } catch (err) { console.error('Fetch error:', err); }
      finally { setLoading(false); }
    };
    fetchData();
    const sub = supabase.channel('electronics_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'research_codes' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phase2b_regulatory' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phase2_alibaba_summary' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phase3_indiamart_summary' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phase5_scoring' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phase4_volza' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_shipments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_buyers' }, () => fetchData())
      .subscribe();
    return () => sub.unsubscribe();
  }, []);

  // Computed stats
  const stats = useMemo(() => {
    const byPhase = {}, byQA = { PASS: 0, FAILED: 0, PENDING: 0 }, byModel = {}, byVerdict = {};
    let totalValM = 0, completedVal = 0;
    codes.forEach(c => {
      const phase = c.current_phase || 'phase1_complete';
      byPhase[phase] = (byPhase[phase] || 0) + 1;
      if (c.qa_status === 'PASS') byQA.PASS++; else if (c.qa_status === 'FAILED') byQA.FAILED++; else byQA.PENDING++;
      const m = c.trading_model || 'UNASSIGNED'; byModel[m] = (byModel[m] || 0) + 1;
      const v = c.verdict_scoring || 'N/A'; byVerdict[v] = (byVerdict[v] || 0) + 1;
      totalValM += c.val_m || 0;
    });
    const completed = codes.filter(c => c.current_phase === 'complete' || c.current_phase === 'COMPLETE' || c.current_phase === 'phase5_done' || c.current_phase === 'N/A');
    completed.forEach(c => completedVal += c.val_m || 0);
    const p2bDone = regulatory.filter(r => r.completed_at).length;
    const p2Done = supply.length;
    const p3Done = demand.length;
    const p4Done = phase4.filter(p => p.completed_at).length;
    const p5Done = scoring.length;
    const avgScore = scoring.length > 0 ? (scoring.reduce((a, s) => a + (s.total_score || 0), 0) / scoring.length).toFixed(1) : 'N/A';
    return { byPhase, byQA, byModel, byVerdict, totalValM, completedVal, completed, p2bDone, p2Done, p3Done, p4Done, p5Done, avgScore };
  }, [codes, regulatory, supply, demand, scoring, phase4]);

  // Merged data
  const mergedCodes = useMemo(() => {
    const regMap = Object.fromEntries(regulatory.map(r => [r.hs4, r]));
    const supMap = Object.fromEntries(supply.map(s => [s.hs4, s]));
    const demMap = Object.fromEntries(demand.map(d => [d.hs4, d]));
    const scorMap = Object.fromEntries(scoring.map(s => [s.hs4, s]));
    const p4Map = Object.fromEntries(phase4.map(p => [p.hs4, p]));
    return codes.map(c => ({ ...c, _reg: regMap[c.hs4], _sup: supMap[c.hs4], _dem: demMap[c.hs4], _scor: scorMap[c.hs4], _p4: p4Map[c.hs4],
      total_duty_pct: regMap[c.hs4]?.total_duty_pct, regulatory_risk: regMap[c.hs4]?.regulatory_risk_score,
      total_suppliers: supMap[c.hs4]?.total_suppliers, fob_low: supMap[c.hs4]?.fob_lowest_usd, fob_typical: supMap[c.hs4]?.fob_typical_usd,
      total_sellers: demMap[c.hs4]?.total_sellers, margin_pct: demMap[c.hs4]?.gross_margin_pct,
      total_score: scorMap[c.hs4]?.total_score, verdict_score: scorMap[c.hs4]?.verdict,
    }));
  }, [codes, regulatory, supply, demand, scoring]);

  const completedCodes = useMemo(() => mergedCodes.filter(c => c._scor), [mergedCodes]);

  // Deep dive data
  const deepDive = useMemo(() => {
    if (!deepDiveCode && completedCodes.length > 0) return completedCodes[0];
    return mergedCodes.find(c => c.hs4 === deepDiveCode) || completedCodes[0] || null;
  }, [deepDiveCode, mergedCodes, completedCodes]);

  // Sort/filter hooks
  const allSF = useSortFilter(mergedCodes, 'drill_score', 'desc');
  const [qaFilter, setQaFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('');
  const allFiltered = useMemo(() => {
    let d = allSF.sorted;
    if (qaFilter) d = d.filter(c => (c.qa_status || 'PENDING') === qaFilter);
    if (modelFilter) d = d.filter(c => (c.trading_model || 'UNASSIGNED') === modelFilter);
    if (verdictFilter) d = d.filter(c => (c.verdict_scoring || '') === verdictFilter);
    return d;
  }, [allSF.sorted, qaFilter, modelFilter, verdictFilter]);

  const regSF = useSortFilter(regulatory, 'total_duty_pct', 'desc');
  const [regRiskFilter, setRegRiskFilter] = useState('');
  const regFiltered = useMemo(() => {
    let d = regSF.sorted; if (regRiskFilter) d = d.filter(r => r.regulatory_risk_score === regRiskFilter); return d;
  }, [regSF.sorted, regRiskFilter]);

  // Supply+demand merge
  const supplyDemand = useMemo(() => {
    const demMap = Object.fromEntries(demand.map(d => [d.hs4, d]));
    return supply.map(s => ({ ...s, ...(demMap[s.hs4] || {}) }));
  }, [supply, demand]);
  const sdSF = useSortFilter(supplyDemand, 'total_suppliers', 'desc');

  const scorSF = useSortFilter(scoring, 'total_score', 'desc');

  // Tab definitions matching HTML dashboard
  const tabs = [
    { id: 'overview', label: '📊 Executive Overview' },
    { id: 'pipeline', label: '🚀 Pipeline Funnel' },
    { id: 'completed', label: `✅ Completed (${completedCodes.length})` },
    { id: 'deepdive', label: '🔬 Deep Dive' },
    { id: 'scoring', label: '⚡ 150-Point Scoring' },
    { id: 'regulatory', label: '🛡️ Regulatory Matrix' },
    { id: 'supply', label: '🏭 Supply vs Demand' },
    { id: 'volza', label: `🚢 Volza Deep Dive (${volzaShipments.length})` },
    { id: 'allcodes', label: '📋 All 180 Codes' },
    { id: 'queue', label: '📑 Research Queue' },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '16px' }}>Loading research data...</div>;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, background: 'linear-gradient(135deg, #60a5fa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Product Research Command Center</h1>
          <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '2px' }}>Electronics HS4 Research Pipeline v3 | {codes.length} Codes | 6-Phase Viability Funnel</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b' }}>
          <div style={{ color: '#34d399', fontWeight: 600 }}>● LIVE — AUTO-UPDATING</div>
          <div>Source: Supabase PostgreSQL</div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'nowrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setPage(1); }} style={{
            background: activeTab === t.id ? RGB.blue : 'transparent', border: `1px solid ${activeTab === t.id ? COLORS.blue + '50' : 'rgba(148,163,184,0.08)'}`,
            color: activeTab === t.id ? COLORS.blue : '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap',
            fontWeight: activeTab === t.id ? 600 : 400, transition: 'all .2s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ==================== TAB: EXECUTIVE OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <KPI label="Total HS4 Codes" value={codes.length} variant="blue" sub="Electronics group (Ch 84-91)" />
            <KPI label="Scored (P5 Done)" value={completedCodes.length} variant="pass" sub={completedCodes.map(c => c.hs4).join(', ') || 'None yet'} />
            <KPI label="Awaiting Research" value={codes.length - completedCodes.length} variant="maybe" sub="Phase 1 complete, pending P2b+" />
            <KPI label="QA Pass Rate" value={stats.byQA.PASS > 0 ? `${((stats.byQA.PASS / (stats.byQA.PASS + stats.byQA.FAILED)) * 100 || 0).toFixed(0)}%` : 'N/A'} variant="cyan" sub={`${stats.byQA.PASS}/${stats.byQA.PASS + stats.byQA.FAILED} passed`} />
            <KPI label="Total Trade Value" value={`$${(stats.completedVal / 1000).toFixed(1)}B`} variant="pass" sub={`${completedCodes.length} completed codes`} />
            <KPI label="Avg Score" value={stats.avgScore} variant="orange" sub="of 150 pts" />
            <KPI label="Trading Models" value={Object.keys(stats.byModel).filter(k => k !== 'UNASSIGNED' && stats.byModel[k] > 0).length > 0 ? Object.entries(stats.byModel).filter(([k, v]) => k !== 'UNASSIGNED' && v > 0).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A' : 'N/A'} variant="watch" sub="Most common model" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <Card title="Verdict Distribution" emoji="📊">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={Object.entries(stats.byVerdict).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {Object.entries(stats.byVerdict).filter(([, v]) => v > 0).map(([k], i) => (
                      <Cell key={i} fill={k === 'PASS' ? COLORS.pass : k === 'GO' ? COLORS.cyan : k === 'MAYBE' ? COLORS.maybe : k === 'WATCH' ? COLORS.watch : k === 'DROP' ? COLORS.drop : '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Pipeline Phase Progress" emoji="🚀">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={[
                  { phase: 'P1 DB', done: codes.length, total: codes.length },
                  { phase: 'P2b Reg', done: stats.p2bDone, total: codes.length },
                  { phase: 'P2 Alibaba', done: stats.p2Done, total: codes.length },
                  { phase: 'P3 IndiaMART', done: stats.p3Done, total: codes.length },
                  { phase: 'QA Gate', done: stats.byQA.PASS, total: codes.length },
                  { phase: 'P4 Volza', done: stats.p4Done, total: stats.byQA.PASS || codes.length },
                  { phase: 'P5 Score', done: stats.p5Done, total: codes.length },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="phase" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="done" fill={COLORS.blue} name="Completed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {completedCodes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <Card title="Trade Value — Completed Codes ($M)" emoji="💰">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={completedCodes.map(c => ({ name: `${c.hs4}`, val: c.val_m || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="val" fill={COLORS.cyan} name="Trade $M" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="150-Point Score Comparison" emoji="🎯">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={completedCodes.map(c => ({ name: `${c.hs4}`, score: c._scor?.total_score || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis domain={[0, 150]} stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="score" fill={COLORS.pass} name="Score/150" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {/* Full Pipeline Progress */}
          <Card title="Full Research Pipeline (6 Phases)" emoji="🗺️">
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
              {[
                { label: 'P1: DB Screen', done: codes.length, total: codes.length, color: COLORS.pass },
                { label: 'P2b: Regulatory', done: stats.p2bDone, total: codes.length, color: COLORS.blue },
                { label: 'P2: Alibaba', done: stats.p2Done, total: codes.length, color: COLORS.blue },
                { label: 'P3: IndiaMART', done: stats.p3Done, total: codes.length, color: COLORS.blue },
                { label: 'P4: Volza Scrape', done: stats.p4Done, total: stats.byQA.PASS || 130, color: stats.p4Done > 0 ? COLORS.watch : '#64748b' },
                { label: 'P5: 150-pt Score', done: stats.p5Done, total: codes.length, color: stats.p5Done > 0 ? COLORS.blue : '#64748b' },
              ].map((p, i) => (
                <div key={i} style={{ flex: 1, minWidth: '140px' }}>
                  <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                    background: p.done >= p.total ? RGB.pass : p.done > 0 ? RGB.blue : '#1e293b',
                    color: p.done >= p.total ? COLORS.pass : p.done > 0 ? COLORS.blue : '#64748b' }}>{p.label}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{p.done}/{p.total} done</div>
                  <ProgressBar value={p.done} max={p.total} color={p.color} showLabel={false} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ==================== TAB: PIPELINE FUNNEL ==================== */}
      {activeTab === 'pipeline' && (
        <div>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', color: '#e2e8f0' }}>🚀 Research Pipeline Funnel</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <KPI label="Phase 1 Done" value={codes.length} variant="blue" sub="DB Screen — all pass" />
            <KPI label="Phase 2b Done" value={stats.p2bDone} variant="cyan" sub="Regulatory verified" />
            <KPI label="Phase 2 Done" value={stats.p2Done} variant="pass" sub="Alibaba supply checked" />
            <KPI label="Phase 3 Done" value={stats.p3Done} variant="pass" sub="IndiaMART demand mapped" />
            <KPI label="Phase 4 Done" value={stats.p4Done} variant="orange" sub="Volza deep scrape" />
            <KPI label="Phase 5 Done" value={stats.p5Done} variant="watch" sub="150-pt scored" />
            <KPI label="Killed" value={stats.byQA.FAILED} variant="drop" sub={stats.byQA.FAILED === 0 ? 'Zero hard kills so far' : `${stats.byQA.FAILED} failed QA`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <Card title="Funnel Visualization" emoji="🔄">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={[
                  { stage: 'P1 DB', count: codes.length },
                  { stage: 'P2b Reg', count: stats.p2bDone },
                  { stage: 'P2 Supply', count: stats.p2Done },
                  { stage: 'P3 Demand', count: stats.p3Done },
                  { stage: 'QA Pass', count: stats.byQA.PASS },
                  { stage: 'P4 Volza', count: stats.p4Done },
                  { stage: 'P5 Score', count: stats.p5Done },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="stage" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill={COLORS.cyan} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Phase Completion Matrix" emoji="📋">
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead><tr><th style={thStyle}>Phase</th><th style={thStyle}>Done</th><th style={thStyle}>Remaining</th><th style={thStyle}>% Complete</th></tr></thead>
                  <tbody>
                    {[
                      { name: 'P1: DB Screen', done: codes.length, total: codes.length },
                      { name: 'P2b: Regulatory', done: stats.p2bDone, total: codes.length },
                      { name: 'P2: Alibaba Supply', done: stats.p2Done, total: codes.length },
                      { name: 'P3: IndiaMART Demand', done: stats.p3Done, total: codes.length },
                      { name: 'QA Gate', done: stats.byQA.PASS, total: codes.length },
                      { name: 'P4: Volza Deep Scrape', done: stats.p4Done, total: stats.byQA.PASS || codes.length },
                      { name: 'P5: 150-pt Score', done: stats.p5Done, total: codes.length },
                    ].map((r, i) => (
                      <tr key={i}><td style={tdStyle}>{r.name}</td>
                        <td style={{ ...tdStyle, color: r.done > 0 ? COLORS.pass : '#64748b' }}>{r.done}</td>
                        <td style={tdStyle}>{r.total - r.done}</td>
                        <td style={tdStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '100px', background: '#1e293b', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${(r.done / r.total) * 100}%`, height: '100%', background: r.done >= r.total ? COLORS.pass : COLORS.blue, borderRadius: '3px' }} />
                          </div> {((r.done / r.total) * 100).toFixed(1)}%
                        </div></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card title="Estimated Timeline" emoji="⏱️">
            <MetricGrid>
              <Metric label="Phase 2b (Regulatory)" value="1-2 days" color={COLORS.blue} sub="WebSearch agents, parallel, all 180" />
              <Metric label="Phase 2+3 (Chrome)" value="6-7 days" color={COLORS.blue} sub="8-10 codes/session, sequential" />
              <Metric label="Phase 4 (Volza)" value="7-10 days" color={COLORS.watch} sub="~130 codes, anti-detection" />
              <Metric label="Phase 5 (Scoring)" value="3-5 days" color={COLORS.pass} sub="Auto-score all survivors" />
              <Metric label="TOTAL ESTIMATED" value="~25 days" color={COLORS.cyan} sub="From now to final winners" />
              <Metric label="Expected Output" value="25-45" color={COLORS.pass} sub="Final winners from 180" />
            </MetricGrid>
          </Card>
        </div>
      )}

      {/* ==================== TAB: COMPLETED CODES ==================== */}
      {activeTab === 'completed' && (
        <div>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', color: '#e2e8f0' }}>✅ Completed Research — {completedCodes.length} Codes (Fresh v3 Data Only)</h2>
          {completedCodes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No codes have completed all 5 phases yet. Research data will appear here as codes pass through the pipeline.</div>
          ) : (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <KPI label={`All ${completedCodes.length} Verdicts`} value={completedCodes.length > 0 ? completedCodes[0]._scor?.verdict || 'N/A' : 'N/A'} variant="pass" sub={`Score range: ${Math.min(...completedCodes.map(c => c._scor?.total_score || 0))}-${Math.max(...completedCodes.map(c => c._scor?.total_score || 0))}/150`} />
              <KPI label="Trading Model" value={(() => { const models = [...new Set(completedCodes.map(c => c.trading_model).filter(Boolean))]; return models.length === 1 ? models[0] : 'MIXED'; })()} variant="orange" />
              <KPI label="Combined Market" value={`$${(completedCodes.reduce((a, c) => a + (c.val_m || 0), 0) / 1000).toFixed(1)}B`} variant="cyan" sub="Annual India imports" />
              <KPI label="QA Completeness" value="100%" variant="pass" sub="All fields verified" />
            </div>
            <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr>
                  <th style={thStyle}>HS4</th><th style={thStyle}>Product</th><th style={thStyle}>Trade $M</th><th style={thStyle}>Score/150</th>
                  <th style={thStyle}>Verdict</th><th style={thStyle}>Model</th><th style={thStyle}>Margin %</th><th style={thStyle}>Suppliers</th>
                  <th style={thStyle}>Sellers</th><th style={thStyle}>Total Duty %</th><th style={thStyle}>Reg Risk</th><th style={thStyle}>Shortage</th>
                </tr></thead>
                <tbody>{completedCodes.sort((a, b) => (b._scor?.total_score || 0) - (a._scor?.total_score || 0)).map(c => {
                  const m = c.margin_pct || c._dem?.gross_margin_pct || 0;
                  return (
                    <tr key={c.hs4} style={{ cursor: 'pointer' }} onClick={() => { setDeepDiveCode(c.hs4); setActiveTab('deepdive'); }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{c.hs4}</td>
                      <td style={tdStyle}>{c.commodity}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>${(c.val_m || 0).toLocaleString()}</td>
                      <td style={tdStyle}><span style={{ fontWeight: 700, color: COLORS.pass }}>{c._scor?.total_score || 0}</span>/150</td>
                      <td style={tdStyle}><Badge label={c._scor?.verdict || 'N/A'} /></td>
                      <td style={tdStyle}><Badge label={c.trading_model || 'N/A'} /></td>
                      <td style={{ ...tdStyle, color: m > 20 ? COLORS.pass : m > 10 ? COLORS.maybe : COLORS.drop, fontWeight: 600 }}>{m.toFixed(1)}%</td>
                      <td style={tdStyle}>{c.total_suppliers || c._sup?.total_suppliers || 0}</td>
                      <td style={tdStyle}>{c.total_sellers || c._dem?.total_sellers || 0}</td>
                      <td style={tdStyle}>{c.total_duty_pct?.toFixed(2) || c._reg?.total_duty_pct?.toFixed(2) || '—'}%</td>
                      <td style={tdStyle}><Badge label={c.regulatory_risk || c._reg?.regulatory_risk_score || 'N/A'} /></td>
                      <td style={tdStyle}>{c.shortage_prone ? '⚡ Yes' : '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>)}
        </div>
      )}

      {/* ==================== TAB: DEEP DIVE ==================== */}
      {activeTab === 'deepdive' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '20px', color: '#e2e8f0', margin: 0 }}>🔬 Product Deep Dive</h2>
            {completedCodes.length > 0 ? (
              <select value={deepDive?.hs4 || ''} onChange={e => setDeepDiveCode(e.target.value)} style={{ background: '#1a2035', border: '1px solid rgba(96,165,250,0.3)', color: COLORS.blue, padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', outline: 'none', minWidth: '320px' }}>
                {completedCodes.map(c => (
                  <option key={c.hs4} value={c.hs4}>HS4 {c.hs4} — {c.commodity} ({c._scor?.total_score || 0}/150)</option>
                ))}
              </select>
            ) : (
              <select disabled style={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', color: '#64748b', padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}>
                <option>No completed codes yet</option>
              </select>
            )}
            {completedCodes.length > 1 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button onClick={() => { const idx = completedCodes.findIndex(c => c.hs4 === deepDive?.hs4); setDeepDiveCode(completedCodes[(idx - 1 + completedCodes.length) % completedCodes.length].hs4); }} style={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.08)', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>← Prev</button>
                <button onClick={() => { const idx = completedCodes.findIndex(c => c.hs4 === deepDive?.hs4); setDeepDiveCode(completedCodes[(idx + 1) % completedCodes.length].hs4); }} style={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.08)', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Next →</button>
              </div>
            )}
          </div>

          {deepDive ? (
            <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.08)', borderRadius: '16px', padding: '24px' }}>
              {/* Title + Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#e2e8f0' }}>HS4 {deepDive.hs4} — {deepDive.commodity}</h2>
                  <PhaseFlow phases={[
                    { label: 'P1', done: true }, { label: 'P2b', done: !!deepDive._reg?.completed_at },
                    { label: 'P2', done: !!deepDive._sup }, { label: 'P3', done: !!deepDive._dem },
                    { label: 'QA', done: deepDive.qa_status === 'PASS' },
                    { label: 'P4', done: !!deepDive._p4?.completed_at, current: deepDive.qa_status === 'PASS' && !deepDive._p4?.completed_at && !deepDive._scor },
                    { label: 'P5', done: !!deepDive._scor },
                  ]} />
                </div>
                {deepDive._scor && <div style={{ fontSize: '28px', fontWeight: 800, color: COLORS.pass }}>{deepDive._scor.total_score}<span style={{ fontSize: '16px', color: '#94a3b8' }}>/150</span></div>}
              </div>

              {/* Key Metrics */}
              <MetricGrid>
                <Metric label="Trade Value" value={`$${(deepDive.val_m || 0).toLocaleString()}M`} color={COLORS.blue} sub="Annual India imports" />
                <Metric label="Drill Score" value={(deepDive.drill_score || 0).toFixed(2)} />
                <Metric label="Verdict" value={deepDive._scor?.verdict || deepDive.verdict_scoring || 'N/A'} color={COLORS.pass} />
                <Metric label="Trading Model" value={deepDive.trading_model || 'N/A'} color={COLORS.orange} sub={deepDive.trading_model_reason || ''} />
                <Metric label="Shortage Prone" value={deepDive.shortage_prone ? 'YES' : 'NO'} color={deepDive.shortage_prone ? COLORS.maybe : '#94a3b8'} />
                <Metric label="Entry Tier" value={deepDive.entry_tier || 'N/A'} />
              </MetricGrid>

              {/* Supply Side */}
              {deepDive._sup && (<>
                <h3 style={{ margin: '16px 0 12px', color: '#e2e8f0' }}>🏭 Supply Side (Alibaba)</h3>
                <MetricGrid>
                  <Metric label="Total Suppliers" value={deepDive._sup.total_suppliers || 0} color={COLORS.blue} sub="Alibaba.com" />
                  <Metric label="Gold Supplier %" value={`${(deepDive._sup.gold_supplier_pct || 0).toFixed(1)}%`} color={COLORS.maybe} sub={`${deepDive._sup.verified_suppliers || 0} verified`} />
                  <Metric label="FOB Range" value={`$${(deepDive._sup.fob_lowest_usd || 0).toFixed(2)} – $${(deepDive._sup.fob_highest_usd || 0).toFixed(2)}`} sub={deepDive._sup.fob_typical_usd ? `Typical: $${deepDive._sup.fob_typical_usd.toFixed(2)}` : ''} />
                  <Metric label="MOQ" value={deepDive._sup.typical_moq || 'N/A'} />
                  {deepDive._sup.top_suppliers && <Metric label="Top Suppliers" value={deepDive._sup.top_suppliers} />}
                  <Metric label="Keywords Searched" value={deepDive._sup.keywords_searched || 0} />
                </MetricGrid>
                {deepDive._sup.mic_supplier_count > 0 && <div style={{ padding: '10px 12px', background: 'rgba(6,182,212,0.08)', borderRadius: '8px', marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}><strong style={{ color: '#22d3ee' }}>Made-in-China:</strong> {deepDive._sup.mic_supplier_count} suppliers | FOB: ${deepDive._sup.mic_fob_low_usd?.toFixed(2)} - ${deepDive._sup.mic_fob_high_usd?.toFixed(2)}</div>}
                {deepDive._sup.dhgate_supplier_count > 0 && <div style={{ padding: '10px 12px', background: 'rgba(167,139,250,0.08)', borderRadius: '8px', marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}><strong style={{ color: '#a78bfa' }}>DHgate:</strong> {deepDive._sup.dhgate_supplier_count} suppliers | FOB: ${deepDive._sup.dhgate_fob_low_usd?.toFixed(2)} - ${deepDive._sup.dhgate_fob_high_usd?.toFixed(2)}</div>}
              </>)}

              {/* Demand Side */}
              {deepDive._dem && (<>
                <h3 style={{ margin: '16px 0 12px', color: '#e2e8f0' }}>🛒 Demand Side (IndiaMART)</h3>
                <MetricGrid>
                  <Metric label="Total Sellers" value={(deepDive._dem.total_sellers || 0).toLocaleString()} color={COLORS.blue} sub="IndiaMART" />
                  <Metric label="Mfr / Trader Split" value={`${(deepDive._dem.manufacturer_pct || 0).toFixed(0)}% / ${(deepDive._dem.trader_pct || 0).toFixed(0)}%`} />
                  <Metric label="INR Price Range" value={`₹${(deepDive._dem.price_low_inr || 0).toLocaleString()} – ₹${(deepDive._dem.price_high_inr || 0).toLocaleString()}`} sub={deepDive._dem.sell_price_inr ? `Typical: ₹${deepDive._dem.sell_price_inr.toLocaleString()}` : ''} />
                  {deepDive._dem.top_cities && <Metric label="Top Cities" value={deepDive._dem.top_cities} />}
                  <Metric label="Google Trends" value={deepDive._dem.google_trends_direction || 'N/A'} />
                  <Metric label="Demand Score" value={deepDive._dem.demand_score ? `${deepDive._dem.demand_score.toFixed(1)} / 100` : 'N/A'} />
                </MetricGrid>
              </>)}

              {/* Margin Analysis */}
              {deepDive._dem && deepDive._sup && (<>
                <h3 style={{ margin: '16px 0 12px', color: '#e2e8f0' }}>💰 Margin Analysis</h3>
                <MetricGrid>
                  <Metric label="FOB (Typical)" value={deepDive._sup.fob_typical_usd ? `$${deepDive._sup.fob_typical_usd.toFixed(2)}` : 'N/A'} />
                  <Metric label="Landed Cost (INR)" value={deepDive._dem.landed_cost_inr ? `₹${deepDive._dem.landed_cost_inr.toLocaleString()}` : 'N/A'} />
                  <Metric label="Sell Price (INR)" value={deepDive._dem.sell_price_inr ? `₹${deepDive._dem.sell_price_inr.toLocaleString()}` : 'N/A'} />
                  <Metric label="Gross Margin %" value={`${(deepDive._dem.gross_margin_pct || 0).toFixed(1)}%`} color={(deepDive._dem.gross_margin_pct || 0) > 20 ? COLORS.pass : (deepDive._dem.gross_margin_pct || 0) > 10 ? COLORS.maybe : COLORS.drop} sub={deepDive._dem.gross_margin_inr ? `₹${deepDive._dem.gross_margin_inr.toLocaleString()} per unit` : ''} />
                  <Metric label="Total Duty" value={deepDive._reg?.total_duty_pct ? `${deepDive._reg.total_duty_pct.toFixed(2)}%` : 'N/A'} sub={deepDive._reg ? `BCD ${deepDive._reg.bcd_pct || 0}% + IGST ${deepDive._reg.igst_pct || 0}% + SWS ${deepDive._reg.sws_pct || 0}%` : ''} />
                  {deepDive._reg?.check_fta ? <Metric label="FTA Opportunity" value={`${deepDive._reg.fta_duty_reduction_pct || 0}% saving`} color={COLORS.pass} sub={deepDive._reg.fta_benefit_notes || ''} /> : null}
                </MetricGrid>
              </>)}

              {/* Regulatory Checks */}
              {deepDive._reg && (<>
                <h3 style={{ margin: '16px 0 12px', color: '#e2e8f0' }}>🛡️ Regulatory Checks (13)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                  <RegItem icon={deepDive._reg.check_anti_dumping ? '⚠️' : '✅'} label="Anti-Dumping" value={deepDive._reg.check_anti_dumping ? `${deepDive._reg.add_rate_pct || 0}%` : 'CLEAR'} color={deepDive._reg.check_anti_dumping ? COLORS.drop : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_safeguard ? '⚠️' : '✅'} label="Safeguard" value={deepDive._reg.check_safeguard ? `${deepDive._reg.safeguard_pct || 0}%` : 'NONE'} color={deepDive._reg.check_safeguard ? COLORS.drop : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_aidc ? '⚠️' : '✅'} label="AIDC" value={deepDive._reg.check_aidc ? `${deepDive._reg.aidc_pct || 0}%` : 'N/A'} color={deepDive._reg.check_aidc ? COLORS.maybe : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_dgft_restriction ? '⚠️' : '✅'} label="DGFT" value={deepDive._reg.check_dgft_restriction ? 'RESTRICTED' : 'FREE'} color={deepDive._reg.check_dgft_restriction ? COLORS.drop : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_wpc ? '⚠️' : '✅'} label="WPC" value={deepDive._reg.check_wpc ? `REQUIRED — ₹${(deepDive._reg.wpc_cost_inr || 0).toLocaleString()} + ${deepDive._reg.wpc_weeks || 0} wks` : 'NOT REQUIRED'} color={deepDive._reg.check_wpc ? COLORS.maybe : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_tec ? '⚠️' : '✅'} label="TEC" value={deepDive._reg.check_tec ? `REQUIRED — ₹${(deepDive._reg.tec_cost_inr || 0).toLocaleString()} + ${deepDive._reg.tec_weeks || 0} wks` : 'NOT REQUIRED'} color={deepDive._reg.check_tec ? COLORS.maybe : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_bis_qco ? '⚠️' : '✅'} label="BIS QCO" value={deepDive._reg.check_bis_qco ? `REQUIRED — ₹${(deepDive._reg.bis_cost_inr || 0).toLocaleString()} + ${deepDive._reg.bis_weeks || 0} wks` : 'NOT REQUIRED'} color={deepDive._reg.check_bis_qco ? COLORS.maybe : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_pmp ? '⚠️' : '✅'} label="PMP" value={deepDive._reg.check_pmp ? (deepDive._reg.pmp_notes || 'WATCH') : 'N/A'} color={deepDive._reg.check_pmp ? COLORS.maybe : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_epr ? '⚠️' : '✅'} label="EPR E-Waste" value={deepDive._reg.check_epr ? `₹${(deepDive._reg.epr_cost_inr || 0).toLocaleString()}` : 'NOT REQUIRED'} color={deepDive._reg.check_epr ? COLORS.maybe : COLORS.pass} />
                  <RegItem icon={deepDive._reg.check_fta ? '💡' : '✅'} label="FTA" value={deepDive._reg.fta_benefit_notes || 'N/A'} color={COLORS.pass} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                  Total compliance: ₹{(deepDive._reg.total_compliance_cost_inr || 0).toLocaleString()} | {deepDive._reg.total_compliance_weeks || 0} weeks | Risk: {deepDive._reg.regulatory_risk_score || 'N/A'}
                </div>
              </>)}

              {/* Go/No-Go Notes */}
              {deepDive._scor?.go_nogo_notes && (
                <div style={{ background: '#1a2035', borderRadius: '10px', padding: '16px', marginTop: '16px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                  <strong style={{ color: '#e2e8f0' }}>Go/No-Go Notes:</strong> {deepDive._scor.go_nogo_notes}
                </div>
              )}
              {deepDive.trading_model_reason && !deepDive._scor?.go_nogo_notes && (
                <div style={{ background: '#1a2035', borderRadius: '10px', padding: '16px', marginTop: '16px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                  <strong style={{ color: '#e2e8f0' }}>Trading Model Rationale:</strong> {deepDive.trading_model_reason}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No completed codes available for deep dive yet.</div>
          )}
        </div>
      )}

      {/* ==================== TAB: 150-POINT SCORING ==================== */}
      {activeTab === 'scoring' && (
        <div>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', color: '#e2e8f0' }}>⚡ 150-Point Viability Scoring — 12 Dimensions</h2>
          {scoring.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No scoring data yet. Codes need to pass through all phases first.</div>
          ) : (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <Card title="Score Radar" emoji="📊">
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={[
                    { dim: 'Margin', max: 25, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_margin || 0])) },
                    { dim: 'Buyers', max: 20, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_buyer_access || 0])) },
                    { dim: 'Supply', max: 15, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_supply || 0])) },
                    { dim: 'Market', max: 15, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_market_size || 0])) },
                    { dim: 'Reg Risk', max: 15, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_regulatory || 0])) },
                    { dim: 'Comp', max: 10, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_competition || 0])) },
                    { dim: 'Growth', max: 10, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_growth || 0])) },
                    { dim: 'WC', max: 10, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_working_capital || 0])) },
                    { dim: 'Logistics', max: 10, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_logistics || 0])) },
                    { dim: 'Obsol', max: 10, ...Object.fromEntries(scoring.map(s => [s.hs4, s.score_obsolescence || 0])) },
                  ]}>
                    <PolarGrid stroke="rgba(148,163,184,0.15)" />
                    <PolarAngleAxis dataKey="dim" stroke="#94a3b8" fontSize={10} />
                    <PolarRadiusAxis domain={[0, 25]} stroke="rgba(148,163,184,0.15)" />
                    {scoring.map((s, i) => (
                      <Radar key={s.hs4} name={s.hs4} dataKey={s.hs4} stroke={[COLORS.blue, COLORS.cyan, COLORS.watch, COLORS.pass][i % 4]} fill={[COLORS.blue, COLORS.cyan, COLORS.watch, COLORS.pass][i % 4]} fillOpacity={0.15} />
                    ))}
                    <Legend />
                    <Tooltip contentStyle={tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Dimension Breakdown" emoji="📊">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={scoring.map(s => ({ hs4: s.hs4, score: s.total_score || 0 }))} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis type="number" domain={[0, 150]} stroke="#94a3b8" />
                    <YAxis type="category" dataKey="hs4" stroke="#94a3b8" width={40} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="score" fill={COLORS.pass} radius={[0, 4, 4, 0]} name="Score/150" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Scoring Matrix Table */}
            <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr>
                  <th style={thStyle}>Dimension</th><th style={thStyle}>Max</th>
                  {scoring.map(s => <th key={s.hs4} style={{ ...thStyle, color: COLORS.blue }}>{s.hs4}</th>)}
                  <th style={thStyle}>Scoring Criteria</th>
                </tr></thead>
                <tbody>
                  {[
                    { label: 'Gross Margin %', max: 25, key: 'score_margin', criteria: '>30%=25, 20-30%=15, 10-20%=8, <10%=2' },
                    { label: 'Buyer Accessibility', max: 20, key: 'score_buyer_access', criteria: '>30 buyers=20, 10-30=10' },
                    { label: 'Supply Reliability', max: 15, key: 'score_supply', criteria: '>20 Gold=15, 10-20=8' },
                    { label: 'Market Size', max: 15, key: 'score_market_size', criteria: '$50M+=15, $20-50M=10' },
                    { label: 'Regulatory Risk', max: 15, key: 'score_regulatory', criteria: 'LOW=15, MED=10, HIGH=5, CRIT=0' },
                    { label: 'Competition', max: 10, key: 'score_competition', criteria: 'Low=10, Med=6, High=2' },
                    { label: 'Growth Trend', max: 10, key: 'score_growth', criteria: '>10%=10, 5-10%=6' },
                    { label: 'Working Capital', max: 10, key: 'score_working_capital', criteria: '<15L=10, 15-30L=6, >50L=2' },
                    { label: 'Logistics', max: 10, key: 'score_logistics', criteria: '<12%=10, 12-18%=6, >18%=2' },
                    { label: 'Obsolescence', max: 10, key: 'score_obsolescence', criteria: 'Stable=10, Mod=5, Fast=0' },
                    { label: 'Capital Required', max: 5, key: 'score_capital', criteria: 'Low=5, Med=3, High=1' },
                    { label: 'FTA Opportunity', max: 5, key: 'score_fta', criteria: 'Available=5, Partial=3' },
                  ].map(d => (
                    <tr key={d.label}><td style={tdStyle}>{d.label}</td><td style={tdStyle}>{d.max}</td>
                      {scoring.map(s => { const v = s[d.key] || 0; const c = v >= d.max * 0.7 ? COLORS.pass : v >= d.max * 0.4 ? '#94a3b8' : COLORS.drop;
                        return <td key={s.hs4} style={{ ...tdStyle, color: c }}>{v}</td>; })}
                      <td style={{ ...tdStyle, fontSize: '11px', color: '#64748b' }}>{d.criteria}</td></tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: '#1a2035' }}>
                    <td style={tdStyle}>TOTAL</td><td style={tdStyle}>150</td>
                    {scoring.map(s => <td key={s.hs4} style={{ ...tdStyle, color: COLORS.pass, fontSize: '16px' }}>{s.total_score || 0}</td>)}
                    <td style={tdStyle}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>)}
        </div>
      )}

      {/* ==================== TAB: REGULATORY MATRIX ==================== */}
      {activeTab === 'regulatory' && (
        <div>
          <h2 style={{ marginBottom: '16px', fontSize: '20px', color: '#e2e8f0' }}>🛡️ Regulatory Matrix — {regFiltered.length} Codes</h2>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Search HS4..." value={regSF.search} onChange={e => regSF.setSearch(e.target.value)}
              style={{ padding: '8px 14px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', outline: 'none', minWidth: '200px' }} />
            <select value={regRiskFilter} onChange={e => setRegRiskFilter(e.target.value)}
              style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', outline: 'none' }}>
              <option value="">All Risk Levels</option>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{regFiltered.length} of {regulatory.length}</span>
          </div>
          <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '650px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr>
                <SortHeader label="HS4" field="hs4" {...regSF} />
                <SortHeader label="BCD %" field="bcd_pct" {...regSF} />
                <SortHeader label="IGST %" field="igst_pct" {...regSF} />
                <SortHeader label="SWS %" field="sws_pct" {...regSF} />
                <SortHeader label="Total %" field="total_duty_pct" {...regSF} />
                <SortHeader label="Risk" field="regulatory_risk_score" {...regSF} />
                <th style={thStyle}>ADD</th><th style={thStyle}>DGFT</th><th style={thStyle}>BIS</th><th style={thStyle}>WPC</th><th style={thStyle}>TEC</th><th style={thStyle}>EPR</th><th style={thStyle}>FTA</th>
                <SortHeader label="Cost ₹" field="total_compliance_cost_inr" {...regSF} />
                <SortHeader label="Wks" field="total_compliance_weeks" {...regSF} />
              </tr></thead>
              <tbody>{regFiltered.map(r => {
                const dutyColor = (r.total_duty_pct || 0) < 30 ? COLORS.pass : (r.total_duty_pct || 0) < 40 ? COLORS.maybe : COLORS.drop;
                const riskColor = r.regulatory_risk_score === 'HIGH' || r.regulatory_risk_score === 'CRITICAL' ? COLORS.drop : r.regulatory_risk_score === 'MEDIUM' ? COLORS.maybe : COLORS.pass;
                return (
                  <tr key={r.hs4} onClick={() => { setDeepDiveCode(r.hs4); setActiveTab('deepdive'); }} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{r.hs4}</td>
                    <td style={tdStyle}>{r.bcd_pct?.toFixed(1) || '—'}</td>
                    <td style={tdStyle}>{r.igst_pct?.toFixed(1) || '—'}</td>
                    <td style={tdStyle}>{r.sws_pct?.toFixed(1) || '—'}</td>
                    <td style={{ ...tdStyle, color: dutyColor, fontWeight: 600 }}>{r.total_duty_pct?.toFixed(2) || '—'}%</td>
                    <td style={{ ...tdStyle, color: riskColor, fontWeight: 600 }}>{r.regulatory_risk_score || '—'}</td>
                    <td style={tdStyle}>{r.check_anti_dumping ? <span style={{ color: COLORS.drop }}>⚠ {r.add_rate_pct || ''}%</span> : '—'}</td>
                    <td style={tdStyle}>{r.check_dgft_restriction ? <span style={{ color: COLORS.drop }}>⚠</span> : '✓'}</td>
                    <td style={tdStyle}>{r.check_bis_qco ? <span style={{ color: COLORS.maybe }}>Req</span> : '—'}</td>
                    <td style={tdStyle}>{r.check_wpc ? <span style={{ color: COLORS.maybe }}>Req</span> : '—'}</td>
                    <td style={tdStyle}>{r.check_tec ? <span style={{ color: COLORS.maybe }}>Req</span> : '—'}</td>
                    <td style={tdStyle}>{r.check_epr ? <span style={{ color: COLORS.maybe }}>Req</span> : '—'}</td>
                    <td style={tdStyle}>{r.check_fta ? <span style={{ color: COLORS.pass }}>{r.fta_duty_reduction_pct || ''}%↓</span> : '—'}</td>
                    <td style={tdStyle}>{r.total_compliance_cost_inr ? `₹${(r.total_compliance_cost_inr / 1000).toFixed(0)}K` : '—'}</td>
                    <td style={tdStyle}>{r.total_compliance_weeks || '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB: SUPPLY VS DEMAND ==================== */}
      {activeTab === 'supply' && (
        <div>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', color: '#e2e8f0' }}>🏭 Supply vs Demand Analysis</h2>
          {supply.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No supply/demand data yet. Data will appear as codes complete Phase 2 and Phase 3.</div>
          ) : (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <Card title="Supplier Count by Code" emoji="🏭">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={supply.map(s => ({ hs4: s.hs4, suppliers: s.total_suppliers || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="suppliers" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Indian Seller Count" emoji="🛒">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={demand.map(d => ({ hs4: d.hs4, sellers: d.total_sellers || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="sellers" fill={COLORS.pass} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <Card title="Margin Comparison" emoji="💰">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={demand.map(d => ({ hs4: d.hs4, margin: d.gross_margin_pct || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="margin" fill={COLORS.maybe} radius={[4, 4, 0, 0]} name="Margin %" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="FOB vs Landed vs Sell" emoji="📦">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={supplyDemand.map(s => ({ hs4: s.hs4, fob: (s.fob_typical_usd || 0) * 85, landed: s.landed_cost_inr || 0, sell: s.sell_price_inr || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="fob" fill={COLORS.blue} name="FOB ₹" />
                    <Bar dataKey="landed" fill={COLORS.maybe} name="Landed ₹" />
                    <Bar dataKey="sell" fill={COLORS.pass} name="Sell ₹" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Manufacturer vs Trader %" emoji="🏢">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={demand.map(d => ({ hs4: d.hs4, mfr: d.manufacturer_pct || 0, trader: d.trader_pct || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="mfr" fill={COLORS.cyan} name="Mfr %" stackId="a" />
                    <Bar dataKey="trader" fill={COLORS.orange} name="Trader %" stackId="a" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Supply+Demand Table */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
              <input type="text" placeholder="Search HS4..." value={sdSF.search} onChange={e => sdSF.setSearch(e.target.value)}
                style={{ padding: '8px 14px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', outline: 'none', minWidth: '200px' }} />
              <span style={{ fontSize: '12px', color: '#64748b' }}>{sdSF.sorted.length} codes with data</span>
            </div>
            <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead><tr>
                  <SortHeader label="HS4" field="hs4" {...sdSF} />
                  <SortHeader label="Suppliers" field="total_suppliers" {...sdSF} />
                  <SortHeader label="Gold %" field="gold_supplier_pct" {...sdSF} />
                  <SortHeader label="FOB $" field="fob_typical_usd" {...sdSF} />
                  <SortHeader label="Sellers" field="total_sellers" {...sdSF} />
                  <SortHeader label="Mfr %" field="manufacturer_pct" {...sdSF} />
                  <SortHeader label="Landed ₹" field="landed_cost_inr" {...sdSF} />
                  <SortHeader label="Sell ₹" field="sell_price_inr" {...sdSF} />
                  <SortHeader label="Margin %" field="gross_margin_pct" {...sdSF} />
                </tr></thead>
                <tbody>{sdSF.sorted.map(r => {
                  const m = r.gross_margin_pct || 0;
                  return (
                    <tr key={r.hs4} onClick={() => { setDeepDiveCode(r.hs4); setActiveTab('deepdive'); }} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{r.hs4}</td>
                      <td style={{ ...tdStyle, color: COLORS.blue, fontWeight: 600 }}>{r.total_suppliers || 0}</td>
                      <td style={tdStyle}>{r.gold_supplier_pct?.toFixed(1) || '—'}%</td>
                      <td style={tdStyle}>{r.fob_typical_usd ? `$${r.fob_typical_usd.toFixed(2)}` : '—'}</td>
                      <td style={{ ...tdStyle, color: COLORS.pass, fontWeight: 600 }}>{r.total_sellers || '—'}</td>
                      <td style={tdStyle}>{r.manufacturer_pct?.toFixed(0) || '—'}%</td>
                      <td style={tdStyle}>{r.landed_cost_inr ? `₹${r.landed_cost_inr.toLocaleString()}` : '—'}</td>
                      <td style={tdStyle}>{r.sell_price_inr ? `₹${r.sell_price_inr.toLocaleString()}` : '—'}</td>
                      <td style={{ ...tdStyle, color: m > 20 ? COLORS.pass : m > 10 ? COLORS.maybe : COLORS.drop, fontWeight: 700 }}>{m.toFixed(1)}%</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>)}
        </div>
      )}

      {/* ==================== TAB: VOLZA DEEP DIVE ==================== */}
      {activeTab === 'volza' && (() => {
        const shipments = volzaShipments;
        const buyers = volzaBuyers;
        const p4Data = phase4;
        const hs4List = [...new Set(shipments.map(s => s.hs4).filter(Boolean))].sort();
        const filteredShipments = volzaHS4Filter ? shipments.filter(s => s.hs4 === volzaHS4Filter) : shipments;
        const filteredBuyers = volzaHS4Filter ? buyers.filter(b => (b.hs_codes || '').includes(volzaHS4Filter)) : buyers;
        const totalCIF = filteredShipments.reduce((a, s) => a + (Number(s.cif_value_usd) || 0), 0);
        const uniqueConsignees = [...new Set(filteredShipments.map(s => s.consignee_name).filter(Boolean))].length;
        const uniqueShippers = [...new Set(filteredShipments.map(s => s.shipper_name).filter(Boolean))].length;
        const countries = {};
        filteredShipments.forEach(s => { if (s.country_origin) countries[s.country_origin] = (countries[s.country_origin] || 0) + 1; });
        const topCountries = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const byHS4 = {};
        shipments.forEach(s => { if (s.hs4) { if (!byHS4[s.hs4]) byHS4[s.hs4] = { count: 0, cif: 0 }; byHS4[s.hs4].count++; byHS4[s.hs4].cif += Number(s.cif_value_usd) || 0; } });
        const hs4Chart = Object.entries(byHS4).sort((a, b) => b[1].count - a[1].count).slice(0, 20).map(([k, v]) => ({ hs4: k, shipments: v.count, cif: v.cif }));
        const byMonth = {};
        filteredShipments.forEach(s => { if (s.date) { const m = String(s.date).substring(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; } });
        const monthChart = Object.entries(byMonth).sort().map(([k, v]) => ({ month: k, count: v }));
        const topConsignees = {};
        filteredShipments.forEach(s => { if (s.consignee_name) { if (!topConsignees[s.consignee_name]) topConsignees[s.consignee_name] = { count: 0, cif: 0 }; topConsignees[s.consignee_name].count++; topConsignees[s.consignee_name].cif += Number(s.cif_value_usd) || 0; } });
        const topCons = Object.entries(topConsignees).sort((a, b) => b[1].cif - a[1].cif).slice(0, 15);
        const topShippers = {};
        filteredShipments.forEach(s => { if (s.shipper_name) { if (!topShippers[s.shipper_name]) topShippers[s.shipper_name] = { count: 0, cif: 0 }; topShippers[s.shipper_name].count++; topShippers[s.shipper_name].cif += Number(s.cif_value_usd) || 0; } });
        const topShip = Object.entries(topShippers).sort((a, b) => b[1].cif - a[1].cif).slice(0, 15);

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', color: '#e2e8f0', margin: 0 }}>🚢 Volza Deep Dive — Import Shipment Intelligence</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={volzaHS4Filter} onChange={e => setVolzaHS4Filter(e.target.value)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px' }}>
                  <option value="">All HS4 Codes ({hs4List.length})</option>
                  {hs4List.map(h => <option key={h} value={h}>HS4 {h} ({byHS4[h]?.count || 0} shipments)</option>)}
                </select>
                {['overview', 'shipments', 'buyers', 'phase4'].map(v => (
                  <button key={v} onClick={() => setVolzaView(v)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: volzaView === v ? 600 : 400, background: volzaView === v ? RGB.blue : 'transparent', color: volzaView === v ? COLORS.blue : '#94a3b8', border: `1px solid ${volzaView === v ? COLORS.blue + '50' : 'rgba(148,163,184,0.08)'}`, cursor: 'pointer' }}>
                    {v === 'overview' ? '📊 Overview' : v === 'shipments' ? '🚢 Shipments' : v === 'buyers' ? '🎯 Buyers' : '📋 Phase 4 Results'}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <KPI label="Total Shipments" value={filteredShipments.length.toLocaleString()} variant="blue" sub={hs4List.length + ' HS4 codes'} />
              <KPI label="Total CIF Value" value={`$${(totalCIF / 1e6).toFixed(2)}M`} variant="pass" />
              <KPI label="Unique Buyers" value={uniqueConsignees} variant="cyan" />
              <KPI label="Unique Shippers" value={uniqueShippers} variant="orange" />
              <KPI label="P4 Completed" value={p4Data.filter(p => p.completed_at).length} variant="watch" sub={`of ${p4Data.length} started`} />
              <KPI label="Buyer Records" value={filteredBuyers.length} variant="pass" sub="Aggregated from shipments" />
            </div>

            {/* VOLZA OVERVIEW SUB-TAB */}
            {volzaView === 'overview' && (<>
              {shipments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                  No Volza shipment data yet. Data will appear here as Phase 4 Volza scraping progresses for QA-passed codes.
                  <br /><br /><span style={{ fontSize: '13px' }}>Volza shipments are scraped using the KS4 v10 stealth scraper and imported via volza_importer.py</span>
                </div>
              ) : (<>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <Card title="Shipments by HS4 Code" emoji="📊">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={hs4Chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="shipments" fill={COLORS.blue} radius={[4, 4, 0, 0]} name="Shipments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card title="Country of Origin" emoji="🌍">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={topCountries.map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={50} outerRadius={110} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {topCountries.map((_, i) => <Cell key={i} fill={[COLORS.blue, COLORS.cyan, COLORS.pass, COLORS.maybe, COLORS.watch, COLORS.orange, COLORS.drop, '#94a3b8', '#64748b', '#475569'][i % 10]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <Card title="Monthly Shipment Trend" emoji="📈">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" fill={COLORS.cyan} radius={[4, 4, 0, 0]} name="Shipments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card title="CIF Value by HS4" emoji="💰">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={hs4Chart.map(h => ({ ...h, cifK: h.cif / 1000 }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={tooltipStyle} formatter={v => `$${Number(v).toFixed(1)}K`} />
                        <Bar dataKey="cifK" fill={COLORS.pass} radius={[4, 4, 0, 0]} name="CIF $K" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <Card title="Top 15 Buyers (by CIF)" emoji="🎯">
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Company</th><th style={thStyle}>Shipments</th><th style={thStyle}>Total CIF</th></tr></thead>
                        <tbody>{topCons.map(([name, d], i) => (
                          <tr key={name}><td style={tdStyle}>{i + 1}</td><td style={{ ...tdStyle, fontWeight: 600, color: COLORS.blue, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</td>
                            <td style={tdStyle}>{d.count}</td><td style={{ ...tdStyle, fontWeight: 600 }}>${(d.cif / 1000).toFixed(1)}K</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Card>
                  <Card title="Top 15 Shippers (by CIF)" emoji="🏭">
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Company</th><th style={thStyle}>Shipments</th><th style={thStyle}>Total CIF</th></tr></thead>
                        <tbody>{topShip.map(([name, d], i) => (
                          <tr key={name}><td style={tdStyle}>{i + 1}</td><td style={{ ...tdStyle, fontWeight: 600, color: COLORS.orange, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</td>
                            <td style={tdStyle}>{d.count}</td><td style={{ ...tdStyle, fontWeight: 600 }}>${(d.cif / 1000).toFixed(1)}K</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </>)}
            </>)}

            {/* VOLZA SHIPMENTS SUB-TAB */}
            {volzaView === 'shipments' && (
              <div>
                {filteredShipments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No shipment records{volzaHS4Filter ? ` for HS4 ${volzaHS4Filter}` : ''}. Data populates as Volza scraping progresses.</div>
                ) : (
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '700px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead><tr>
                        <th style={thStyle}>Date</th><th style={thStyle}>HS4</th><th style={thStyle}>HS Code</th><th style={thStyle}>Product</th>
                        <th style={thStyle}>Consignee</th><th style={thStyle}>Shipper</th><th style={thStyle}>CIF $</th><th style={thStyle}>Unit Rate $</th>
                        <th style={thStyle}>Qty</th><th style={thStyle}>Origin</th><th style={thStyle}>City</th><th style={thStyle}>Duty %</th>
                      </tr></thead>
                      <tbody>{filteredShipments.slice(0, 200).map((s, i) => (
                        <tr key={i}>
                          <td style={tdStyle}>{s.date ? String(s.date).substring(0, 10) : '—'}</td>
                          <td style={{ ...tdStyle, color: COLORS.blue, fontWeight: 600 }}>{s.hs4}</td>
                          <td style={tdStyle}>{s.hs_code}</td>
                          <td style={{ ...tdStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.product_desc}>{s.product_desc}</td>
                          <td style={{ ...tdStyle, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.cyan }} title={s.consignee_name}>{s.consignee_name}</td>
                          <td style={{ ...tdStyle, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.orange }} title={s.shipper_name}>{s.shipper_name}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{s.cif_value_usd ? `$${Number(s.cif_value_usd).toLocaleString()}` : '—'}</td>
                          <td style={tdStyle}>{s.unit_rate_usd ? `$${Number(s.unit_rate_usd).toFixed(2)}` : '—'}</td>
                          <td style={tdStyle}>{s.std_qty ? Number(s.std_qty).toLocaleString() : '—'} {s.std_unit || ''}</td>
                          <td style={tdStyle}>{s.country_origin || '—'}</td>
                          <td style={tdStyle}>{s.consignee_city || '—'}</td>
                          <td style={tdStyle}>{s.tax_pct ? `${Number(s.tax_pct).toFixed(1)}%` : '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    {filteredShipments.length > 200 && <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>Showing 200 of {filteredShipments.length.toLocaleString()} records. Use HS4 filter to narrow down.</div>}
                  </div>
                )}
              </div>
            )}

            {/* VOLZA BUYERS SUB-TAB */}
            {volzaView === 'buyers' && (
              <div>
                {filteredBuyers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No buyer records{volzaHS4Filter ? ` for HS4 ${volzaHS4Filter}` : ''}. Buyer data is aggregated from shipment records.</div>
                ) : (
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '700px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <th style={thStyle}>Company</th><th style={thStyle}>IEC</th><th style={thStyle}>Shipments</th><th style={thStyle}>Total CIF</th>
                        <th style={thStyle}>Avg Rate</th><th style={thStyle}>HS Codes</th><th style={thStyle}>City</th><th style={thStyle}>State</th>
                        <th style={thStyle}>China %</th><th style={thStyle}>Classification</th><th style={thStyle}>Shippers</th>
                      </tr></thead>
                      <tbody>{filteredBuyers.sort((a, b) => (b.total_cif_usd || 0) - (a.total_cif_usd || 0)).slice(0, 200).map((b, i) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.blue, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.company_name}>{b.company_name}</td>
                          <td style={tdStyle}>{b.iec || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{b.shipment_count || 0}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.pass }}>{b.total_cif_usd ? `$${(Number(b.total_cif_usd) / 1000).toFixed(1)}K` : '—'}</td>
                          <td style={tdStyle}>{b.avg_unit_rate ? `$${Number(b.avg_unit_rate).toFixed(2)}` : '—'}</td>
                          <td style={{ ...tdStyle, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.hs_codes}>{b.hs_codes || '—'}</td>
                          <td style={tdStyle}>{b.city || '—'}</td>
                          <td style={tdStyle}>{b.state || '—'}</td>
                          <td style={{ ...tdStyle, color: (b.china_pct || 0) > 50 ? COLORS.drop : (b.china_pct || 0) > 20 ? COLORS.maybe : COLORS.pass }}>{b.china_pct ? `${Number(b.china_pct).toFixed(0)}%` : '—'}</td>
                          <td style={tdStyle}><Badge label={b.classification || 'UNKNOWN'} /></td>
                          <td style={tdStyle}>{b.shipper_count || 0}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    {filteredBuyers.length > 200 && <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>Showing 200 of {filteredBuyers.length} buyer records.</div>}
                  </div>
                )}
              </div>
            )}

            {/* PHASE 4 RESULTS SUB-TAB */}
            {volzaView === 'phase4' && (
              <div>
                {p4Data.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                    No Phase 4 validation results yet. Phase 4 runs after QA Gate passes — it scrapes Volza shipment data and validates buyer distribution, CIF ranges, and sourcing patterns.
                  </div>
                ) : (
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <th style={thStyle}>HS4</th><th style={thStyle}>Scrape Date</th><th style={thStyle}>Shipments</th><th style={thStyle}>Pages</th>
                        <th style={thStyle}>Buyers</th><th style={thStyle}>HHI</th><th style={thStyle}>Median CIF</th><th style={thStyle}>Avg CIF</th>
                        <th style={thStyle}>Shippers</th><th style={thStyle}>China %</th><th style={thStyle}>Unit Rate</th><th style={thStyle}>Kill?</th>
                      </tr></thead>
                      <tbody>{p4Data.sort((a, b) => (b.total_shipments || 0) - (a.total_shipments || 0)).map(p => (
                        <tr key={p.hs4}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{p.hs4}</td>
                          <td style={tdStyle}>{p.scrape_date || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{(p.total_shipments || 0).toLocaleString()}</td>
                          <td style={tdStyle}>{p.total_pages || '—'}</td>
                          <td style={{ ...tdStyle, color: (p.unique_buyers || 0) > 20 ? COLORS.pass : COLORS.maybe }}>{p.unique_buyers || 0}</td>
                          <td style={{ ...tdStyle, color: (p.buyer_hhi || 0) < 2500 ? COLORS.pass : COLORS.drop }}>{p.buyer_hhi?.toFixed(0) || '—'}</td>
                          <td style={tdStyle}>{p.median_cif_usd ? `$${p.median_cif_usd.toFixed(0)}` : '—'}</td>
                          <td style={tdStyle}>{p.avg_cif_usd ? `$${p.avg_cif_usd.toFixed(0)}` : '—'}</td>
                          <td style={tdStyle}>{p.unique_shippers || 0}</td>
                          <td style={{ ...tdStyle, color: (p.china_sourcing_pct || 0) > 40 ? COLORS.pass : COLORS.maybe }}>{p.china_sourcing_pct ? `${p.china_sourcing_pct.toFixed(0)}%` : '—'}</td>
                          <td style={tdStyle}>{p.volza_avg_unit_rate ? `$${p.volza_avg_unit_rate.toFixed(2)}` : '—'}</td>
                          <td style={tdStyle}>{p.kill_signal ? <span style={{ color: COLORS.drop }}>KILL: {p.kill_reason}</span> : <span style={{ color: COLORS.pass }}>PASS</span>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                <Card title="Phase 4 Validation Thresholds" emoji="📋" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <Metric label="Buyer HHI" value="< 2,500" color={COLORS.pass} sub="Distributed market = GOOD" />
                    <Metric label="Unique Buyers" value="> 20" color={COLORS.pass} sub="Sufficient buyer pool" />
                    <Metric label="Median CIF" value="$5K-$100K" color={COLORS.pass} sub="Trader-friendly range" />
                    <Metric label="China Sourcing" value="> 40%" color={COLORS.pass} sub="Alibaba supply validated" />
                  </div>
                </Card>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== TAB: ALL 180 CODES ==================== */}
      {activeTab === 'allcodes' && (
        <div>
          <h2 style={{ marginBottom: '16px', fontSize: '20px', color: '#e2e8f0' }}>📋 All {codes.length} Electronics HS4 Codes</h2>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Search HS4, commodity..." value={allSF.search} onChange={e => allSF.setSearch(e.target.value)}
              style={{ padding: '8px 14px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', outline: 'none', minWidth: '250px' }} />
            <select value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', outline: 'none' }}>
              <option value="">All Verdicts</option>
              {['PASS', 'GO', 'MAYBE', 'WATCH', 'DROP'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={qaFilter} onChange={e => setQaFilter(e.target.value)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', outline: 'none' }}>
              <option value="">All QA Status</option>
              {['PASS', 'FAILED', 'PENDING'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', outline: 'none' }}>
              <option value="">All Models</option>
              {['REGULAR', 'SPOT', 'BROKER', 'MIXED', 'UNASSIGNED'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Showing {Math.min(allFiltered.length, PAGE_SIZE)} of {allFiltered.length}</span>
          </div>
          <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '650px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr>
                <SortHeader label="HS4" field="hs4" {...allSF} />
                <th style={{ ...thStyle, minWidth: '200px' }}>Commodity</th>
                <SortHeader label="Trade $M" field="val_m" {...allSF} />
                <SortHeader label="Drill Score" field="drill_score" {...allSF} />
                <th style={thStyle}>Verdict</th>
                <th style={thStyle}>Phase</th>
                <th style={thStyle}>Model</th>
              </tr></thead>
              <tbody>{allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(c => (
                <tr key={c.hs4} onClick={() => { setDeepDiveCode(c.hs4); setActiveTab('deepdive'); }} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{c.hs4}</td>
                  <td style={{ ...tdStyle, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.commodity}>{c.commodity}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>${(c.val_m || 0).toFixed(1)}</td>
                  <td style={{ ...tdStyle, color: COLORS.blue, fontWeight: 600 }}>{c.drill_score?.toFixed(1) || '—'}</td>
                  <td style={tdStyle}><Badge label={c.verdict_scoring || 'N/A'} /></td>
                  <td style={tdStyle}><span style={{ fontSize: '11px' }}>{PHASE_LABELS[c.current_phase] || c.current_phase || '—'}</span></td>
                  <td style={tdStyle}>{c.trading_model ? <span style={{ color: MODEL_COLORS[c.trading_model] || '#94a3b8', fontWeight: 600, fontSize: '11px' }}>{c.trading_model}</span> : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {allFiltered.length > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', background: RGB.blue, color: page === 1 ? '#64748b' : COLORS.blue, border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', cursor: page === 1 ? 'default' : 'pointer' }}>← Prev</button>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Page {page} of {Math.ceil(allFiltered.length / PAGE_SIZE)}</span>
              <button onClick={() => setPage(p => Math.min(Math.ceil(allFiltered.length / PAGE_SIZE), p + 1))} disabled={page >= Math.ceil(allFiltered.length / PAGE_SIZE)} style={{ padding: '8px 16px', background: RGB.blue, color: page >= Math.ceil(allFiltered.length / PAGE_SIZE) ? '#64748b' : COLORS.blue, border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', cursor: page >= Math.ceil(allFiltered.length / PAGE_SIZE) ? 'default' : 'pointer' }}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: RESEARCH QUEUE ==================== */}
      {activeTab === 'queue' && (
        <div>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', color: '#e2e8f0' }}>📑 Research Queue — Next Up</h2>
          <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '14px' }}>
            This dashboard covers the <strong style={{ color: '#e2e8f0' }}>Electronics group ({codes.length} HS4 codes)</strong>.
            After completion, research expands to <strong style={{ color: '#e2e8f0' }}>ALL remaining HS4 codes</strong> from the full 1,123-code scored universe.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <KPI label="Completed" value={completedCodes.length} variant="pass" />
            {Object.entries(stats.byVerdict).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => (
              <KPI key={k} label={`${k} (Pending)`} value={v - (k === (completedCodes[0]?.verdict_scoring) ? completedCodes.length : 0)} variant={k === 'PASS' ? 'blue' : k === 'GO' ? 'cyan' : k === 'MAYBE' ? 'maybe' : k === 'WATCH' ? 'watch' : 'drop'} />
            ))}
          </div>

          <Card title="Priority Queue — Next 20 Codes (by Drill Score)" emoji="📊">
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr><th style={thStyle}>#</th><th style={thStyle}>HS4</th><th style={thStyle}>Commodity</th><th style={thStyle}>Trade $M</th><th style={thStyle}>Drill Score</th><th style={thStyle}>Verdict</th><th style={thStyle}>Status</th></tr></thead>
                <tbody>
                  {codes.filter(c => !completedCodes.find(cc => cc.hs4 === c.hs4)).slice(0, 20).map((c, i) => (
                    <tr key={c.hs4}><td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{c.hs4}</td>
                      <td style={tdStyle}>{c.commodity}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>${(c.val_m || 0).toFixed(1)}</td>
                      <td style={{ ...tdStyle, color: COLORS.blue }}>{c.drill_score?.toFixed(1) || '—'}</td>
                      <td style={tdStyle}><Badge label={c.verdict_scoring || 'N/A'} /></td>
                      <td style={tdStyle}><span style={{ fontSize: '11px', color: '#64748b' }}>{PHASE_LABELS[c.current_phase] || 'Pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Future Expansion Plan" emoji="🔮" style={{ marginTop: '20px' }}>
            <div style={{ background: '#1a2035', borderRadius: '10px', padding: '16px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.8 }}>
              <strong style={{ color: '#e2e8f0' }}>Phase 1 (Current):</strong> Electronics group — {codes.length} HS4 codes (Chapters 84-91). {completedCodes.length} completed, {codes.length - completedCodes.length} remaining. ~25 days to finish.<br /><br />
              <strong style={{ color: '#e2e8f0' }}>Phase 2 (Next):</strong> Full HS4 universe — remaining ~943 codes from hs4_scored table (Chemicals, Machinery, Textiles, etc.). Same 6-phase pipeline applies. Estimated 2-3 months.<br /><br />
              <strong style={{ color: '#e2e8f0' }}>Total Pipeline:</strong> 1,123 HS4 codes → expected 100-200 final winners across all product categories. Each winner gets full 42-field research card + trading model classification.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
