import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from 'recharts';

const COLORS = { pass: '#34d399', maybe: '#fbbf24', watch: '#a78bfa', drop: '#f87171', blue: '#60a5fa', cyan: '#22d3ee', orange: '#fb923c' };
const RGB = { pass: 'rgba(52,211,153,0.12)', maybe: 'rgba(251,191,36,0.12)', watch: 'rgba(167,139,250,0.12)', drop: 'rgba(248,113,113,0.12)', blue: 'rgba(96,165,250,0.12)', cyan: 'rgba(34,211,238,0.12)', orange: 'rgba(251,146,60,0.12)' };
const MODEL_COLORS = { REGULAR: '#34d399', SPOT: '#fbbf24', BROKER: '#a78bfa', MIXED: '#22d3ee', UNASSIGNED: '#94a3b8' };
const PHASE_LABELS = {
  phase1_complete: 'P1: DB Screen', phase2_pending: 'P2: Alibaba', phase2_done: 'P2 Done',
  phase2b_pending: 'P2b: Regulatory', phase2b_done: 'P2b Done', phase3_pending: 'P3: IndiaMART',
  phase3_done: 'P3 Done', qa_pending: 'QA Gate', qa_pass: 'QA Pass', phase4_pending: 'P4: Volza',
  phase4_queued: 'P4: Queued', phase4_complete: 'P4 Complete', phase4_done: 'P4 Done',
  phase5_pending: 'P5: Scoring', phase5_done: 'Complete',
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
  const [activeTab, setActiveTab] = useState('analytics');
  const [deepDiveCode, setDeepDiveCode] = useState(null);
  const [codes, setCodes] = useState([]);
  const [regulatory, setRegulatory] = useState([]);
  const [supply, setSupply] = useState([]);
  const [demand, setDemand] = useState([]);
  const [scoring, setScoring] = useState([]);
  const [phase4, setPhase4] = useState([]);
  const [volzaShipments, setVolzaShipments] = useState([]);
  const [volzaBuyers, setVolzaBuyers] = useState([]);
  const [volzaHS8Detail, setVolzaHS8Detail] = useState([]);
  const [volzaTopBuyers, setVolzaTopBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [volzaHS4Filter, setVolzaHS4Filter] = useState('');
  const [volzaView, setVolzaView] = useState('overview');
  const [selectedVolzaHS4, setSelectedVolzaHS4] = useState(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({ marginTier: '', marketSize: '', regRisk: '', tradingModel: '', bisReq: '', certCount: '' });
  const [volzaQueue, setVolzaQueue] = useState([]);
  // New deep-dive analytics tables (7 tables)
  const [hs8Breakdown, setHs8Breakdown] = useState([]);
  const [countryMix, setCountryMix] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [buyerSegments, setBuyerSegments] = useState([]);
  const [topShippers, setTopShippers] = useState([]);
  const [portAnalysis, setPortAnalysis] = useState([]);
  const [priceStats, setPriceStats] = useState([]);
  // Shipments sort/filter
  const [shipmentSort, setShipmentSort] = useState('date');
  const [shipmentSortDir, setShipmentSortDir] = useState('desc');
  const [shipmentCountryFilter, setShipmentCountryFilter] = useState('');
  const [shipmentDateFrom, setShipmentDateFrom] = useState('');
  const [shipmentDateTo, setShipmentDateTo] = useState('');
  const [shipmentCifMin, setShipmentCifMin] = useState('');
  const [shipmentCifMax, setShipmentCifMax] = useState('');
  const [shipmentConsigneeSearch, setShipmentConsigneeSearch] = useState('');
  // Buyers sort/filter
  const [buyerSort, setBuyerSort] = useState('total_cif_usd');
  const [buyerSortDir, setBuyerSortDir] = useState('desc');
  const [buyerClassFilter, setBuyerClassFilter] = useState('');
  const [buyerNameSearch, setBuyerNameSearch] = useState('');
  const [buyerChinaMin, setBuyerChinaMin] = useState('');
  const [buyerChinaMax, setBuyerChinaMax] = useState('');
  // Phase4 sort
  const [phase4Sort, setPhase4Sort] = useState('total_shipments');
  const [phase4SortDir, setPhase4SortDir] = useState('desc');
  // Scrape queue sort/filter
  const [queueSort, setQueueSort] = useState('priority');
  const [queueSortDir, setQueueSortDir] = useState('asc');
  const [queueStatusFilter, setQueueStatusFilter] = useState('');
  // Business Blueprint state
  const [hs8Margins, setHs8Margins] = useState([]);
  const [buyerTargets, setBuyerTargets] = useState([]);
  const [chinaSuppliers, setChinaSuppliers] = useState([]);
  const [supplyChainPlan, setSupplyChainPlan] = useState([]);
  const [blueprintView, setBlueprintView] = useState('overview');
  const [blueprintHS4, setBlueprintHS4] = useState('');
  const PAGE_SIZE = 50;

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [codesRes, regRes, supRes, demRes, scorRes, p4Res, vsRes, vbRes, vh8Res, vtbRes, queueRes,
               hs8bRes, cmRes, mtRes, bsRes, tsRes, paRes, psRes,
               h8mRes, btRes, csRes, scpRes] = await Promise.all([
          supabase.from('research_codes').select('*').order('drill_score', { ascending: false }),
          supabase.from('phase2b_regulatory').select('*'),
          supabase.from('phase2_alibaba_summary').select('*'),
          supabase.from('phase3_indiamart_summary').select('*'),
          supabase.from('phase5_scoring').select('*'),
          supabase.from('phase4_volza').select('*'),
          supabase.from('volza_shipments').select('*').limit(5000),
          supabase.from('volza_buyers').select('*'),
          supabase.from('volza_hs8_detail').select('*'),
          supabase.from('volza_top_buyers').select('*'),
          supabase.from('volza_scrape_queue').select('*'),
          supabase.from('volza_hs8_breakdown').select('*'),
          supabase.from('volza_country_mix').select('*'),
          supabase.from('volza_monthly_trend').select('*'),
          supabase.from('volza_buyer_segments').select('*'),
          supabase.from('volza_top_shippers').select('*'),
          supabase.from('volza_port_analysis').select('*'),
          supabase.from('volza_price_stats').select('*'),
          supabase.from('hs8_margin_analysis').select('*').order('gross_margin_pct', { ascending: false }),
          supabase.from('buyer_targets').select('*').order('total_cif_usd', { ascending: false }),
          supabase.from('china_suppliers').select('*'),
          supabase.from('supply_chain_plan').select('*').order('final_score', { ascending: false }),
        ]);
        setCodes(codesRes.data || []);
        setRegulatory(regRes.data || []);
        setSupply(supRes.data || []);
        setDemand(demRes.data || []);
        setScoring(scorRes.data || []);
        setPhase4(p4Res.data || []);
        setVolzaShipments(vsRes.data || []);
        setVolzaBuyers(vbRes.data || []);
        setVolzaHS8Detail(vh8Res.data || []);
        setVolzaTopBuyers(vtbRes.data || []);
        setVolzaQueue(queueRes.data || []);
        setHs8Breakdown(hs8bRes.data || []);
        setCountryMix(cmRes.data || []);
        setMonthlyTrend(mtRes.data || []);
        setBuyerSegments(bsRes.data || []);
        setTopShippers(tsRes.data || []);
        setPortAnalysis(paRes.data || []);
        setPriceStats(psRes.data || []);
        setHs8Margins(h8mRes.data || []);
        setBuyerTargets(btRes.data || []);
        setChinaSuppliers(csRes.data || []);
        setSupplyChainPlan(scpRes.data || []);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_hs8_detail' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_top_buyers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_scrape_queue' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_hs8_breakdown' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_country_mix' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_monthly_trend' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_buyer_segments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_top_shippers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_port_analysis' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volza_price_stats' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hs8_margin_analysis' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyer_targets' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'china_suppliers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_chain_plan' }, () => fetchData())
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
    const completed = codes.filter(c => ['complete', 'COMPLETE', 'phase5_done', 'N/A', 'phase4_done', 'phase4_complete', 'phase4_queued'].includes(c.current_phase));
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

  const completedCodes = useMemo(() => mergedCodes.filter(c => c.qa_status === 'PASS' || c._scor || c.current_phase === 'complete' || c.current_phase === 'phase4_done' || c.current_phase === 'phase4_complete' || c.current_phase === 'phase4_queued'), [mergedCodes]);
  const scoredCodes = useMemo(() => mergedCodes.filter(c => c._scor), [mergedCodes]);

  // Analytics Deep Dive: Build full analysis from merged data (codes that have both supply + demand data)
  const fullAnalysis = useMemo(() => {
    return mergedCodes.filter(c => c._sup || c._dem).map(c => {
      const reg = c._reg || {};
      const sup = c._sup || {};
      const dem = c._dem || {};
      const scr = c._scor || {};
      const p4 = c._p4 || {};
      const grossMargin = dem.gross_margin_pct ?? null;
      const valM = c.val_m || 0;
      const oppScore = grossMargin != null && grossMargin > 0 ? Math.round(grossMargin * valM / 10) : 0;
      const certCount = (reg.check_bis_qco ? 1 : 0) + (reg.check_wpc ? 1 : 0) + (reg.check_tec ? 1 : 0);
      const marginTier = grossMargin == null ? 'UNKNOWN' : grossMargin > 50 ? '50%+' : grossMargin > 30 ? '30-50%' : grossMargin > 15 ? '15-30%' : grossMargin > 0 ? '0-15%' : 'Negative';
      const marketTier = valM >= 500 ? '$500M+' : valM >= 100 ? '$100-500M' : valM >= 50 ? '$50-100M' : valM >= 10 ? '$10-50M' : '<$10M';
      return {
        hs4: c.hs4, commodity: c.commodity, val_m: valM, drill_score: c.drill_score,
        trading_model: c.trading_model, qa_status: c.qa_status, current_phase: c.current_phase,
        total_suppliers: sup.total_suppliers || 0, fob_lowest_usd: sup.fob_lowest_usd, fob_highest_usd: sup.fob_highest_usd, fob_typical_usd: sup.fob_typical_usd,
        gold_supplier_pct: sup.gold_supplier_pct || 0,
        total_sellers: dem.total_sellers || 0, manufacturer_pct: dem.manufacturer_pct, trader_pct: dem.trader_pct,
        price_low_inr: dem.price_low_inr, price_high_inr: dem.price_high_inr, price_typical_inr: dem.price_typical_inr,
        landed_cost_inr: dem.landed_cost_inr, sell_price_inr: dem.sell_price_inr,
        gross_margin_pct: grossMargin, gross_margin_inr: dem.gross_margin_inr,
        total_duty_pct: reg.total_duty_pct || 0, regulatory_risk_score: reg.regulatory_risk_score || 'UNKNOWN',
        bis_required: reg.check_bis_qco, wpc_required: reg.check_wpc, tec_required: reg.check_tec,
        add_rate_pct: reg.add_rate_pct || 0, dgft_notes: reg.dgft_notes,
        total_score: scr.total_score || null, verdict: scr.verdict || null,
        v_shipments: p4.total_shipments || null, v_buyers: p4.unique_buyers || null, hhi: p4.buyer_hhi || null, china_pct: p4.china_sourcing_pct || null,
        opportunity_score: oppScore, margin_tier: marginTier, market_size_tier: marketTier, cert_count: certCount,
      };
    });
  }, [mergedCodes]);

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
  // --- Analytics computed data ---
  const analyticsSF = useSortFilter(fullAnalysis, 'opportunity_score', 'desc');
  const analyticsFiltered = useMemo(() => {
    let d = analyticsSF.sorted;
    const f = analyticsFilters;
    if (f.marginTier) d = d.filter(r => r.margin_tier === f.marginTier);
    if (f.marketSize) d = d.filter(r => r.market_size_tier === f.marketSize);
    if (f.regRisk) d = d.filter(r => r.regulatory_risk_score === f.regRisk);
    if (f.tradingModel) d = d.filter(r => r.trading_model === f.tradingModel);
    if (f.bisReq === '1') d = d.filter(r => r.bis_required === 1);
    if (f.bisReq === '0') d = d.filter(r => r.bis_required !== 1);
    if (f.certCount) d = d.filter(r => r.cert_count === parseInt(f.certCount));
    return d;
  }, [analyticsSF.sorted, analyticsFilters]);

  const analyticsStats = useMemo(() => {
    if (!fullAnalysis.length) return {};
    const withMargin = fullAnalysis.filter(r => r.gross_margin_pct != null);
    const positive = withMargin.filter(r => r.gross_margin_pct > 0);
    const excellent = withMargin.filter(r => r.gross_margin_pct > 50);
    const good = withMargin.filter(r => r.gross_margin_pct > 30 && r.gross_margin_pct <= 50);
    const moderate = withMargin.filter(r => r.gross_margin_pct > 15 && r.gross_margin_pct <= 30);
    const thin = withMargin.filter(r => r.gross_margin_pct > 0 && r.gross_margin_pct <= 15);
    const negative = withMargin.filter(r => r.gross_margin_pct <= 0);
    const totalOppScore = fullAnalysis.reduce((a, r) => a + (r.opportunity_score || 0), 0);
    const avgMargin = positive.length > 0 ? positive.reduce((a, r) => a + r.gross_margin_pct, 0) / positive.length : 0;
    const totalValM = fullAnalysis.reduce((a, r) => a + (r.val_m || 0), 0);
    const noBIS = fullAnalysis.filter(r => !r.bis_required);
    const noWPC = fullAnalysis.filter(r => !r.wpc_required);
    const noTEC = fullAnalysis.filter(r => !r.tec_required);
    const noCert = fullAnalysis.filter(r => r.cert_count === 0);
    const marginBuckets = [
      { name: '50%+', count: excellent.length, color: '#34d399' },
      { name: '30-50%', count: good.length, color: '#22d3ee' },
      { name: '15-30%', count: moderate.length, color: '#60a5fa' },
      { name: '0-15%', count: thin.length, color: '#fbbf24' },
      { name: 'Negative', count: negative.length, color: '#f87171' },
    ];
    const modelDist = {};
    fullAnalysis.forEach(r => { const m = r.trading_model || 'UNASSIGNED'; modelDist[m] = (modelDist[m] || 0) + 1; });
    const marketBuckets = {};
    fullAnalysis.forEach(r => { const t = r.market_size_tier || 'UNKNOWN'; marketBuckets[t] = (marketBuckets[t] || 0) + 1; });
    // Top 30 opportunity scatter data
    const scatterData = fullAnalysis.filter(r => r.gross_margin_pct != null && r.val_m > 0).map(r => ({
      x: r.val_m, y: r.gross_margin_pct || 0, z: r.opportunity_score || 0, hs4: r.hs4, name: r.commodity, model: r.trading_model
    }));
    return { withMargin, positive, excellent, good, moderate, thin, negative, totalOppScore, avgMargin, totalValM, noBIS, noWPC, noTEC, noCert, marginBuckets, modelDist, marketBuckets, scatterData };
  }, [fullAnalysis]);

  const [analyticsPage, setAnalyticsPage] = useState(1);
  const ANALYTICS_PAGE_SIZE = 30;

  // === Volza Deep Dive: Pre-compute all data + hooks at top level (Rules of Hooks) ===
  const volzaComputed = useMemo(() => {
    const p4Data = phase4;
    const byHS4Agg = {};
    volzaHS8Detail.forEach(h => { if (h.hs4) { if (!byHS4Agg[h.hs4]) byHS4Agg[h.hs4] = { shipments: 0, cif: 0, buyers: 0, shippers: 0, hs8Count: 0 }; byHS4Agg[h.hs4].shipments += (h.shipment_count || 0); byHS4Agg[h.hs4].cif += Number(h.total_cif_usd) || 0; byHS4Agg[h.hs4].buyers += (h.unique_buyers || 0); byHS4Agg[h.hs4].shippers += (h.unique_shippers || 0); byHS4Agg[h.hs4].hs8Count++; } });
    const hs4List = Object.keys(byHS4Agg).sort();
    const totalCIF = Object.values(byHS4Agg).reduce((a, v) => a + v.cif, 0);
    const totalShipmentCount = Object.values(byHS4Agg).reduce((a, v) => a + v.shipments, 0);
    const totalBuyerCount = Object.values(byHS4Agg).reduce((a, v) => a + v.buyers, 0);
    const totalShipperCount = Object.values(byHS4Agg).reduce((a, v) => a + v.shippers, 0);
    const countriesAgg = {};
    volzaHS8Detail.forEach(h => {
      if (h.countries) {
        try {
          const parsed = typeof h.countries === 'string' ? JSON.parse(h.countries) : h.countries;
          if (Array.isArray(parsed)) parsed.forEach(item => { const name = item.c || item.country || ''; const count = item.n || item.count || 1; if (name) countriesAgg[name] = (countriesAgg[name] || 0) + count; });
        } catch(e) { String(h.countries).split(',').forEach(c => { c = c.trim(); if (c) countriesAgg[c] = (countriesAgg[c] || 0) + (h.shipment_count || 1); }); }
      }
    });
    const topCountries = Object.entries(countriesAgg).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const hs4ChartData = Object.entries(byHS4Agg).sort((a, b) => b[1].shipments - a[1].shipments).slice(0, 20).map(([k, v]) => ({ hs4: k, shipments: v.shipments, cif: v.cif, cifM: v.cif / 1e6 }));
    const unifiedCodes = hs4List.map(h4 => {
      const code = codes.find(c => c.hs4 === h4) || {};
      const sup = supply.find(s => s.hs4 === h4) || {};
      const reg = regulatory.find(r => r.hs4 === h4) || {};
      const dem = demand.find(d => d.hs4 === h4) || {};
      const scr = scoring.find(s => s.hs4 === h4) || {};
      const p4 = p4Data.find(p => p.hs4 === h4) || {};
      const agg = byHS4Agg[h4] || {};
      const buyerCount = volzaTopBuyers.filter(b => b.hs4 === h4).length;
      return {
        hs4: h4, commodity: code.commodity || '—', val_m: code.val_m || 0, drill_score: code.drill_score || 0,
        trading_model: code.trading_model || 'UNASSIGNED', qa_status: code.qa_status || '—',
        total_suppliers: sup.total_suppliers || 0, fob_low: sup.fob_lowest_usd, fob_high: sup.fob_highest_usd, fob_typical: sup.fob_typical_usd, gold_pct: sup.gold_supplier_pct || 0,
        total_duty_pct: reg.total_duty_pct || 0, reg_risk: reg.regulatory_risk_score || '—', bis_qco: reg.check_bis_qco || 0, add_rate: reg.add_rate_pct || 0,
        total_sellers: dem.total_sellers || 0, gross_margin_pct: dem.gross_margin_pct || 0, price_inr: dem.price_typical_inr, landed_cost: dem.landed_cost_inr,
        v_shipments: agg.shipments || 0, v_cif: agg.cif || 0, v_buyers: buyerCount || agg.buyers || 0, v_shippers: agg.shippers || 0, v_hs8: agg.hs8Count || 0,
        hhi: p4.buyer_hhi || null, china_pct: p4.china_sourcing_pct || null,
        p5_score: scr.total_score || null, p5_verdict: scr.verdict || '—',
      };
    });
    const queueDataForView = volzaQueue.map(q => { const cd = codes.find(c => c.hs4 === q.hs4); return { ...q, commodity: cd?.commodity, drill_score: cd?.drill_score }; });
    return { p4Data, byHS4Agg, hs4List, totalCIF, totalShipmentCount, totalBuyerCount, totalShipperCount, topCountries, hs4ChartData, unifiedCodes, queueDataForView };
  }, [volzaHS8Detail, volzaTopBuyers, volzaQueue, phase4, codes, supply, regulatory, demand, scoring]);

  const matrixSF = useSortFilter(volzaComputed.unifiedCodes, 'v_shipments', 'desc');
  const hs8ForView = selectedVolzaHS4 ? volzaHS8Detail.filter(h => h.hs4 === selectedVolzaHS4) : volzaHS8Detail;
  const volzaHS8SF = useSortFilter(hs8ForView, 'shipment_count', 'desc');
  const buyerDataForView = selectedVolzaHS4 ? volzaTopBuyers.filter(b => b.hs4 === selectedVolzaHS4) : volzaTopBuyers;
  const volzaBuyersSF = useSortFilter(buyerDataForView, 'total_cif_usd', 'desc');
  const volzaP4SF = useSortFilter(volzaComputed.p4Data, 'total_shipments', 'desc');
  const volzaQSF = useSortFilter(volzaComputed.queueDataForView, 'priority', 'asc');
  // New deep-dive sort/filter hooks
  const hs8BreakdownForView = selectedVolzaHS4 ? hs8Breakdown.filter(h => h.hs4 === selectedVolzaHS4) : hs8Breakdown;
  const hs8bSF = useSortFilter(hs8BreakdownForView, 'total_cif_usd', 'desc');
  const countryForView = selectedVolzaHS4 ? countryMix.filter(c => c.hs4 === selectedVolzaHS4) : countryMix;
  const countrySF = useSortFilter(countryForView, 'total_cif_usd', 'desc');
  const shipperForView = selectedVolzaHS4 ? topShippers.filter(s => s.hs4 === selectedVolzaHS4) : topShippers;
  const shipperSF = useSortFilter(shipperForView, 'total_cif_usd', 'desc');
  const portForView = selectedVolzaHS4 ? portAnalysis.filter(p => p.hs4 === selectedVolzaHS4) : portAnalysis;
  const portSF = useSortFilter(portForView, 'shipment_count', 'desc');

  const tabs = [
    { id: 'analytics', label: '🔍 Analytics Deep Dive' },
    { id: 'overview', label: '📊 Executive Overview' },
    { id: 'pipeline', label: '🚀 Pipeline Funnel' },
    { id: 'completed', label: `✅ Completed (${completedCodes.length})` },
    { id: 'deepdive', label: '🔬 Deep Dive' },
    { id: 'scoring', label: '⚡ 150-Point Scoring' },
    { id: 'regulatory', label: '🛡️ Regulatory Matrix' },
    { id: 'supply', label: '🏭 Supply vs Demand' },
    { id: 'volza', label: `🚢 Volza Deep Dive (${volzaHS8Detail.reduce((a, h) => a + (h.shipment_count || 0), 0).toLocaleString()})` },
    { id: 'blueprint', label: `🗺️ Business Blueprint (${supplyChainPlan.length})` },
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

      {/* ==================== TAB: ANALYTICS DEEP DIVE ==================== */}
      {activeTab === 'analytics' && fullAnalysis.length > 0 && (
        <div>
          {/* Data Coverage Notice */}
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#fbbf24' }}>
            <strong>Data Coverage Note:</strong> Each HS4 code contains dozens to hundreds of HS8 sub-products. Research covered the <strong>top 3 keywords by trade value</strong> per code — representing the highest-value segment. Actual product variety within each HS4 is much wider. Margins and prices shown are for the researched segment only. Phase 4 (Volza) will provide shipment-level granularity.
          </div>

          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <KPI label="Total Codes" value={fullAnalysis.length} variant="blue" sub={`$${(analyticsStats.totalValM / 1000).toFixed(1)}B total trade`} />
            <KPI label="Positive Margin" value={analyticsStats.positive?.length || 0} variant="pass" sub={`Avg ${analyticsStats.avgMargin?.toFixed(1)}% margin`} />
            <KPI label="50%+ Margin" value={analyticsStats.excellent?.length || 0} variant="cyan" sub="Excellent tier" />
            <KPI label="Negative Margin" value={analyticsStats.negative?.length || 0} variant="drop" sub="SPOT/BROKER model" />
            <KPI label="No Certifications" value={analyticsStats.noCert?.length || 0} variant="pass" sub="Easy entry" />
            <KPI label="BIS Required" value={fullAnalysis.filter(r => r.bis_required).length} variant="maybe" sub={`${fullAnalysis.filter(r => !r.bis_required).length} without BIS`} />
            <KPI label="Opp Score Total" value={Math.round(analyticsStats.totalOppScore || 0).toLocaleString()} variant="orange" sub="Margin × Market $M" />
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <Card title="Margin Distribution" emoji="📊">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analyticsStats.marginBuckets || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#e2e8f0' }} />
                  <Bar dataKey="count" name="Codes" radius={[4, 4, 0, 0]}>
                    {(analyticsStats.marginBuckets || []).map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Trading Model Split" emoji="🏷️">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={Object.entries(analyticsStats.modelDist || {}).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {Object.keys(analyticsStats.modelDist || {}).map((k, i) => <Cell key={i} fill={MODEL_COLORS[k] || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Opportunity Matrix" emoji="🎯" style={{}}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>X: Trade Value ($M) | Y: Margin % | Size: Opportunity Score</div>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="x" name="Trade $M" stroke="#94a3b8" fontSize={10} />
                  <YAxis dataKey="y" name="Margin %" stroke="#94a3b8" fontSize={10} />
                  <ZAxis dataKey="z" range={[20, 400]} name="Opportunity" />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v, name) => [typeof v === 'number' ? v.toFixed(1) : v, name]} labelFormatter={() => ''} content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload;
                    return <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', padding: '8px 12px', color: '#e2e8f0', fontSize: '12px' }}>
                      <div style={{ fontWeight: 700, color: '#60a5fa' }}>HS4 {d.hs4}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>{d.name?.slice(0, 40)}</div>
                      <div>Trade: ${d.x?.toFixed(1)}M | Margin: {d.y?.toFixed(1)}%</div>
                      <div>Opp Score: {d.z?.toFixed(0)} | Model: {d.model}</div>
                    </div>;
                  }} />
                  <Scatter data={(analyticsStats.scatterData || []).filter(d => d.y > -50).slice(0, 100)} fill="#60a5fa" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', background: '#111827', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.08)' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>FILTERS:</span>
            <input type="text" placeholder="Search HS4, product..." value={analyticsSF.search} onChange={e => { analyticsSF.setSearch(e.target.value); setAnalyticsPage(1); }}
              style={{ padding: '6px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', outline: 'none', minWidth: '180px' }} />
            <select value={analyticsFilters.marginTier} onChange={e => { setAnalyticsFilters(f => ({...f, marginTier: e.target.value})); setAnalyticsPage(1); }}
              style={{ padding: '6px 10px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}>
              <option value="">All Margins</option>
              <option value="EXCELLENT">50%+ (Excellent)</option>
              <option value="GOOD">30-50% (Good)</option>
              <option value="MODERATE">15-30% (Moderate)</option>
              <option value="THIN">0-15% (Thin)</option>
              <option value="NEGATIVE">Negative</option>
            </select>
            <select value={analyticsFilters.marketSize} onChange={e => { setAnalyticsFilters(f => ({...f, marketSize: e.target.value})); setAnalyticsPage(1); }}
              style={{ padding: '6px 10px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}>
              <option value="">All Markets</option>
              <option value="MEGA">MEGA ($1B+)</option>
              <option value="LARGE">LARGE ($500M-1B)</option>
              <option value="MEDIUM">MEDIUM ($100-500M)</option>
              <option value="SMALL">SMALL ($20-100M)</option>
              <option value="MICRO">MICRO (&lt;$20M)</option>
            </select>
            <select value={analyticsFilters.tradingModel} onChange={e => { setAnalyticsFilters(f => ({...f, tradingModel: e.target.value})); setAnalyticsPage(1); }}
              style={{ padding: '6px 10px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}>
              <option value="">All Models</option>
              <option value="REGULAR">REGULAR</option>
              <option value="SPOT">SPOT</option>
              <option value="BROKER">BROKER</option>
              <option value="MIXED">MIXED</option>
            </select>
            <select value={analyticsFilters.regRisk} onChange={e => { setAnalyticsFilters(f => ({...f, regRisk: e.target.value})); setAnalyticsPage(1); }}
              style={{ padding: '6px 10px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}>
              <option value="">All Risk</option>
              <option value="LOW">LOW Risk</option>
              <option value="MEDIUM">MEDIUM Risk</option>
              <option value="HIGH">HIGH Risk</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <select value={analyticsFilters.bisReq} onChange={e => { setAnalyticsFilters(f => ({...f, bisReq: e.target.value})); setAnalyticsPage(1); }}
              style={{ padding: '6px 10px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}>
              <option value="">BIS: Any</option>
              <option value="0">No BIS Needed</option>
              <option value="1">BIS Required</option>
            </select>
            <button onClick={() => { setAnalyticsFilters({ marginTier: '', marketSize: '', regRisk: '', tradingModel: '', bisReq: '', certCount: '' }); analyticsSF.setSearch(''); setAnalyticsPage(1); }}
              style={{ padding: '6px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '6px', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}>Clear All</button>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8' }}>{analyticsFiltered.length} of {fullAnalysis.length} codes</span>
          </div>

          {/* Master Data Table */}
          <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '1400px' }}>
                <thead><tr>
                  <SortHeader label="HS4" field="hs4" {...analyticsSF} />
                  <SortHeader label="Product" field="commodity" {...analyticsSF} style={{ minWidth: '180px' }} />
                  <SortHeader label="Trade $M" field="val_m" {...analyticsSF} />
                  <SortHeader label="Market" field="market_size_tier" {...analyticsSF} />
                  <SortHeader label="Margin %" field="gross_margin_pct" {...analyticsSF} />
                  <SortHeader label="Margin Tier" field="margin_tier" {...analyticsSF} />
                  <SortHeader label="Opp Score" field="opportunity_score" {...analyticsSF} />
                  <SortHeader label="Model" field="trading_model" {...analyticsSF} />
                  <SortHeader label="Suppliers" field="alibaba_suppliers" {...analyticsSF} />
                  <SortHeader label="Sellers" field="indiamart_sellers" {...analyticsSF} />
                  <SortHeader label="FOB $" field="fob_typical_usd" {...analyticsSF} />
                  <SortHeader label="Landed ₹" field="landed_cost_inr" {...analyticsSF} />
                  <SortHeader label="Sell ₹" field="sell_price_inr" {...analyticsSF} />
                  <SortHeader label="Total Duty %" field="total_duty_pct" {...analyticsSF} />
                  <SortHeader label="Reg Risk" field="regulatory_risk_score" {...analyticsSF} />
                  <SortHeader label="BIS" field="bis_required" {...analyticsSF} />
                  <SortHeader label="Certs" field="cert_count" {...analyticsSF} />
                  <SortHeader label="Entry Ease" field="ease_of_entry_score" {...analyticsSF} />
                  <SortHeader label="Drill Score" field="drill_score" {...analyticsSF} />
                </tr></thead>
                <tbody>
                  {analyticsFiltered.slice((analyticsPage - 1) * ANALYTICS_PAGE_SIZE, analyticsPage * ANALYTICS_PAGE_SIZE).map(r => {
                    const m = r.gross_margin_pct || 0;
                    const mColor = m > 50 ? '#34d399' : m > 30 ? '#22d3ee' : m > 15 ? '#60a5fa' : m > 0 ? '#fbbf24' : '#f87171';
                    return (
                      <tr key={r.hs4} onClick={() => { setDeepDiveCode(r.hs4); setActiveTab('deepdive'); }} style={{ cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: '#60a5fa' }}>{r.hs4}</td>
                        <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.commodity}>{r.commodity}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>${(r.val_m || 0).toFixed(1)}</td>
                        <td style={tdStyle}><Badge label={r.market_size_tier || '—'} /></td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: mColor }}>{m.toFixed(1)}%</td>
                        <td style={tdStyle}><Badge label={r.margin_tier || '—'} /></td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: '#fb923c' }}>{(r.opportunity_score || 0).toFixed(0)}</td>
                        <td style={tdStyle}><Badge label={r.trading_model || '—'} /></td>
                        <td style={{ ...tdStyle, color: '#60a5fa' }}>{r.alibaba_suppliers || 0}</td>
                        <td style={{ ...tdStyle, color: '#34d399' }}>{(r.indiamart_sellers || 0).toLocaleString()}</td>
                        <td style={tdStyle}>{r.fob_typical_usd ? `$${r.fob_typical_usd.toFixed(2)}` : '—'}</td>
                        <td style={tdStyle}>{r.landed_cost_inr ? `₹${r.landed_cost_inr.toLocaleString()}` : '—'}</td>
                        <td style={tdStyle}>{r.sell_price_inr ? `₹${r.sell_price_inr.toLocaleString()}` : '—'}</td>
                        <td style={{ ...tdStyle, color: (r.total_duty_pct || 0) > 35 ? '#f87171' : '#94a3b8' }}>{r.total_duty_pct?.toFixed(1) || '—'}%</td>
                        <td style={tdStyle}><Badge label={r.regulatory_risk_score || '—'} /></td>
                        <td style={{ ...tdStyle, color: r.bis_required ? '#fbbf24' : '#34d399' }}>{r.bis_required ? 'Yes' : 'No'}</td>
                        <td style={tdStyle}>{r.cert_count || 0}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: (r.ease_of_entry_score || 0) >= 70 ? '#34d399' : (r.ease_of_entry_score || 0) >= 40 ? '#fbbf24' : '#f87171' }}>{r.ease_of_entry_score || 0}</td>
                        <td style={{ ...tdStyle, color: '#94a3b8' }}>{r.drill_score?.toFixed(1) || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {analyticsFiltered.length > ANALYTICS_PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
              <button onClick={() => setAnalyticsPage(p => Math.max(1, p - 1))} disabled={analyticsPage === 1} style={{ padding: '6px 14px', background: 'rgba(96,165,250,0.1)', color: analyticsPage === 1 ? '#64748b' : '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', cursor: analyticsPage === 1 ? 'default' : 'pointer', fontSize: '12px' }}>← Prev</button>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Page {analyticsPage} of {Math.ceil(analyticsFiltered.length / ANALYTICS_PAGE_SIZE)}</span>
              <button onClick={() => setAnalyticsPage(p => Math.min(Math.ceil(analyticsFiltered.length / ANALYTICS_PAGE_SIZE), p + 1))} disabled={analyticsPage >= Math.ceil(analyticsFiltered.length / ANALYTICS_PAGE_SIZE)} style={{ padding: '6px 14px', background: 'rgba(96,165,250,0.1)', color: analyticsPage >= Math.ceil(analyticsFiltered.length / ANALYTICS_PAGE_SIZE) ? '#64748b' : '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', cursor: analyticsPage >= Math.ceil(analyticsFiltered.length / ANALYTICS_PAGE_SIZE) ? 'default' : 'pointer', fontSize: '12px' }}>Next →</button>
            </div>
          )}

          {/* Top 15 Opportunities Table */}
          <Card title="Top 15 Opportunities — Highest Opportunity Score (Margin × Market Size)" emoji="🏆" style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>Opportunity Score = Gross Margin % × Trade Value ($M) / 100. Higher = larger addressable margin pool. Click any row for full deep dive.</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr>
                <th style={thStyle}>#</th><th style={thStyle}>HS4</th><th style={thStyle}>Product</th><th style={thStyle}>Trade $M</th>
                <th style={thStyle}>Margin %</th><th style={thStyle}>Opp Score</th><th style={thStyle}>Model</th>
                <th style={thStyle}>Suppliers</th><th style={thStyle}>Duty %</th><th style={thStyle}>Risk</th><th style={thStyle}>BIS</th><th style={thStyle}>Entry Ease</th>
              </tr></thead>
              <tbody>
                {[...fullAnalysis].sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0)).slice(0, 15).map((r, i) => (
                  <tr key={r.hs4} onClick={() => { setDeepDiveCode(r.hs4); setActiveTab('deepdive'); }} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...tdStyle, color: i < 3 ? '#fbbf24' : '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#60a5fa' }}>{r.hs4}</td>
                    <td style={{ ...tdStyle, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.commodity}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>${(r.val_m || 0).toLocaleString()}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: (r.gross_margin_pct || 0) > 30 ? '#34d399' : (r.gross_margin_pct || 0) > 15 ? '#60a5fa' : '#fbbf24' }}>{(r.gross_margin_pct || 0).toFixed(1)}%</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#fb923c', fontSize: '14px' }}>{(r.opportunity_score || 0).toFixed(0)}</td>
                    <td style={tdStyle}><Badge label={r.trading_model || '—'} /></td>
                    <td style={tdStyle}>{r.alibaba_suppliers || 0}</td>
                    <td style={tdStyle}>{r.total_duty_pct?.toFixed(1) || '—'}%</td>
                    <td style={tdStyle}><Badge label={r.regulatory_risk_score || '—'} /></td>
                    <td style={{ ...tdStyle, color: r.bis_required ? '#fbbf24' : '#34d399' }}>{r.bis_required ? 'Yes' : 'No'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: (r.ease_of_entry_score || 0) >= 70 ? '#34d399' : '#fbbf24' }}>{r.ease_of_entry_score}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Quick-Win: High margin + No certification + Low risk */}
          <Card title="Quick Wins — High Margin, No Certifications, Low Regulatory Risk" emoji="⚡" style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>Codes with margin &gt;30%, zero BIS/WPC/TEC requirements, and LOW regulatory risk. Easiest to start importing immediately.</div>
            {(() => {
              const quickWins = fullAnalysis.filter(r => (r.gross_margin_pct || 0) > 30 && r.cert_count === 0 && r.regulatory_risk_score === 'LOW')
                .sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0));
              return quickWins.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead><tr><th style={thStyle}>HS4</th><th style={thStyle}>Product</th><th style={thStyle}>Trade $M</th><th style={thStyle}>Margin %</th><th style={thStyle}>Opp Score</th><th style={thStyle}>Model</th><th style={thStyle}>FOB $</th><th style={thStyle}>Sell ₹</th></tr></thead>
                  <tbody>{quickWins.slice(0, 20).map(r => (
                    <tr key={r.hs4} onClick={() => { setDeepDiveCode(r.hs4); setActiveTab('deepdive'); }} style={{ cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(52,211,153,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#60a5fa' }}>{r.hs4}</td>
                      <td style={{ ...tdStyle, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.commodity}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>${(r.val_m || 0).toFixed(1)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#34d399' }}>{(r.gross_margin_pct || 0).toFixed(1)}%</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#fb923c' }}>{(r.opportunity_score || 0).toFixed(0)}</td>
                      <td style={tdStyle}><Badge label={r.trading_model || '—'} /></td>
                      <td style={tdStyle}>{r.fob_typical_usd ? `$${r.fob_typical_usd.toFixed(2)}` : '—'}</td>
                      <td style={tdStyle}>{r.sell_price_inr ? `₹${r.sell_price_inr.toLocaleString()}` : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>No quick wins found with current criteria</div>;
            })()}
          </Card>
        </div>
      )}

      {/* ==================== TAB: EXECUTIVE OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <KPI label="Total HS4 Codes" value={codes.length} variant="blue" sub="Electronics group (Ch 84-91)" />
            <KPI label="QA Passed" value={completedCodes.length} variant="pass" sub={completedCodes.map(c => c.hs4).join(', ') || 'None yet'} />
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
                  <BarChart data={scoredCodes.length > 0 ? scoredCodes.map(c => ({ name: `${c.hs4}`, score: c._scor?.total_score || 0 })) : completedCodes.map(c => ({ name: `${c.hs4}`, score: c._scor?.total_score || 0 }))}>
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
              <KPI label="QA Status" value={`${completedCodes.length} PASSED`} variant="pass" sub={scoredCodes.length > 0 ? `${scoredCodes.length} scored (P5), score range: ${Math.min(...scoredCodes.map(c => c._scor?.total_score || 0))}-${Math.max(...scoredCodes.map(c => c._scor?.total_score || 0))}/150` : 'Awaiting Phase 5 scoring'} />
              <KPI label="Trading Model" value={(() => { const models = [...new Set(completedCodes.map(c => c.trading_model).filter(Boolean))]; return models.length === 1 ? models[0] : models.length > 1 ? 'MIXED' : 'N/A'; })()} variant="orange" sub={completedCodes.map(c => c.trading_model).filter(Boolean).join(', ') || 'Not yet assigned'} />
              <KPI label="Combined Market" value={`$${(completedCodes.reduce((a, c) => a + (c.val_m || 0), 0) / 1000).toFixed(1)}B`} variant="cyan" sub="Annual India imports" />
              <KPI label="QA Completeness" value={`${Math.round(completedCodes.reduce((a, c) => a + (c.qa_completeness_score || 0), 0) / completedCodes.length)}%`} variant="pass" sub="Avg completeness score" />
            </div>
            <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr>
                  <th style={thStyle}>HS4</th><th style={thStyle}>Product</th><th style={thStyle}>Trade $M</th><th style={thStyle}>Score/150</th>
                  <th style={thStyle}>Verdict</th><th style={thStyle}>Model</th><th style={thStyle}>Margin %</th><th style={thStyle}>Suppliers</th>
                  <th style={thStyle}>Sellers</th><th style={thStyle}>Total Duty %</th><th style={thStyle}>Reg Risk</th><th style={thStyle}>Shortage</th>
                </tr></thead>
                <tbody>{[...completedCodes].sort((a, b) => (b._scor?.total_score || b.val_m || 0) - (a._scor?.total_score || a.val_m || 0)).map(c => {
                  const m = c.margin_pct || c._dem?.gross_margin_pct || 0;
                  return (
                    <tr key={c.hs4} style={{ cursor: 'pointer' }} onClick={() => { setDeepDiveCode(c.hs4); setActiveTab('deepdive'); }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{c.hs4}</td>
                      <td style={tdStyle}>{c.commodity}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>${(c.val_m || 0).toLocaleString()}</td>
                      <td style={tdStyle}>{c._scor ? <><span style={{ fontWeight: 700, color: COLORS.pass }}>{c._scor.total_score}</span>/150</> : <span style={{ color: '#64748b' }}>Awaiting P5</span>}</td>
                      <td style={tdStyle}><Badge label={c._scor?.verdict || c.qa_status || 'N/A'} /></td>
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
                  <option key={c.hs4} value={c.hs4}>HS4 {c.hs4} — {c.commodity} ({c._scor ? `${c._scor.total_score}/150` : `QA: ${c.qa_status || 'PASS'}`})</option>
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

      {/* ==================== TAB: VOLZA DEEP DIVE (v2 — Full Research Architecture) ==================== */}
      {activeTab === 'volza' && (() => {
        const { p4Data, byHS4Agg, hs4List, totalCIF, totalShipmentCount, totalBuyerCount, totalShipperCount, topCountries, hs4ChartData, unifiedCodes, queueDataForView } = volzaComputed;
        const hs8SF = volzaHS8SF;
        const buyersSF = volzaBuyersSF;
        const p4SF = volzaP4SF;
        const qSF = volzaQSF;

        // Matrix filter state (reuse analyticsFilters for margin/model)
        const [matrixModelFilter, matrixRegFilter] = [analyticsFilters.tradingModel, analyticsFilters.regRisk];
        let matrixFiltered = matrixSF.sorted;
        if (matrixModelFilter) matrixFiltered = matrixFiltered.filter(r => r.trading_model === matrixModelFilter);
        if (matrixRegFilter) matrixFiltered = matrixFiltered.filter(r => r.reg_risk === matrixRegFilter);

        // HS4 selected for cross-ref
        const xrefCode = selectedVolzaHS4;
        const xrefData = xrefCode ? {
          code: codes.find(c => c.hs4 === xrefCode) || {},
          sup: supply.find(s => s.hs4 === xrefCode) || {},
          reg: regulatory.find(r => r.hs4 === xrefCode) || {},
          dem: demand.find(d => d.hs4 === xrefCode) || {},
          scr: scoring.find(s => s.hs4 === xrefCode) || {},
          p4: p4Data.find(p => p.hs4 === xrefCode) || {},
          hs8: volzaHS8Detail.filter(h => h.hs4 === xrefCode),
          buyers: volzaTopBuyers.filter(b => b.hs4 === xrefCode),
        } : null;

        const VOLZA_VIEWS = [
          { key: 'dashboard', icon: '📊', label: 'Overview' },
          { key: 'matrix', icon: '📋', label: 'Code Matrix' },
          { key: 'hs8deep', icon: '🔬', label: 'HS8 Products' },
          { key: 'countries', icon: '🌍', label: 'Countries' },
          { key: 'buyers', icon: '👥', label: 'Buyers' },
          { key: 'shippers', icon: '🚢', label: 'Shippers' },
          { key: 'ports', icon: '🏗️', label: 'Ports' },
          { key: 'prices', icon: '💰', label: 'Pricing' },
          { key: 'trends', icon: '📈', label: 'Trends' },
          { key: 'xref', icon: '🔍', label: 'X-Ref' },
          { key: 'queue', icon: '📑', label: 'Queue' },
        ];

        return (
          <div>
            {/* HEADER + NAV */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', color: '#e2e8f0', margin: 0 }}>🚢 Volza Deep Dive — Full Research Intelligence</h2>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {VOLZA_VIEWS.map(v => (
                  <button key={v.key} onClick={() => setVolzaView(v.key)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: volzaView === v.key ? 600 : 400, background: volzaView === v.key ? RGB.blue : 'transparent', color: volzaView === v.key ? COLORS.blue : '#94a3b8', border: `1px solid ${volzaView === v.key ? COLORS.blue + '50' : 'rgba(148,163,184,0.08)'}`, cursor: 'pointer' }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* GLOBAL KPI ROW */}
            {(() => {
              const allP4 = p4Data.filter(p => p.completed_at);
              const totalShip = allP4.reduce((a, p) => a + (p.total_shipments || 0), 0);
              const totalBuy = allP4.reduce((a, p) => a + (p.unique_buyers || 0), 0);
              const totalShip2 = allP4.reduce((a, p) => a + (p.unique_shippers || 0), 0);
              const totalCIF2 = volzaTopBuyers.reduce((a, b) => a + (b.total_cif_usd || 0), 0);
              const hs8Count = hs8Breakdown.length;
              const countryCount = [...new Set(countryMix.map(c => c.country))].length;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <KPI label="HS4 Codes Scraped" value={allP4.length} variant="blue" sub={`of ${volzaQueue.length} queued`} />
                  <KPI label="Total Shipments" value={totalShip.toLocaleString()} variant="cyan" />
                  <KPI label="Total CIF" value={`$${(totalCIF2 / 1e6).toFixed(1)}M`} variant="pass" />
                  <KPI label="Unique Buyers" value={totalBuy.toLocaleString()} variant="blue" />
                  <KPI label="HS8 Sub-codes" value={hs8Count} variant="watch" sub={`${countryCount} countries`} />
                  <KPI label="Source Countries" value={countryCount} variant="orange" />
                  <KPI label="Avg Margin" value={`${(unifiedCodes.reduce((a, c) => a + (c.gross_margin_pct || 0), 0) / (unifiedCodes.length || 1)).toFixed(1)}%`} variant="pass" />
                </div>
              );
            })()}

            {/* ===== DASHBOARD VIEW ===== */}
            {volzaView === 'dashboard' && (
              volzaHS8Detail.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No Volza data yet. Data appears as Phase 4 scraping progresses.</div>
              ) : (<>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <Card title="Shipments by HS4 Code" emoji="📊">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={hs4ChartData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" /><XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="shipments" fill={COLORS.blue} radius={[4, 4, 0, 0]} name="Shipments" /></BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card title="Country of Origin Distribution" emoji="🌍">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart><Pie data={topCountries.map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={50} outerRadius={110} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{topCountries.map((_, i) => <Cell key={i} fill={[COLORS.blue, COLORS.cyan, COLORS.pass, COLORS.maybe, COLORS.watch, COLORS.orange, COLORS.drop, '#94a3b8', '#64748b', '#475569'][i % 10]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <Card title="CIF Value by HS4 ($M)" emoji="💰">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={hs4ChartData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" /><XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} formatter={v => `$${Number(v).toFixed(2)}M`} /><Bar dataKey="cifM" fill={COLORS.pass} radius={[4, 4, 0, 0]} name="CIF $M" /></BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card title="Trading Model Distribution" emoji="🏷️">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart><Pie data={Object.entries(unifiedCodes.reduce((a, c) => { const m = c.trading_model || 'UNASSIGNED'; a[m] = (a[m] || 0) + 1; return a; }, {})).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={40} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{Object.keys(MODEL_COLORS).map((k, i) => <Cell key={i} fill={MODEL_COLORS[k]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <Card title="Top 15 Buyers (by CIF, all codes)" emoji="🎯">
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Company</th><th style={thStyle}>HS4</th><th style={thStyle}>Shipments</th><th style={thStyle}>Total CIF</th></tr></thead>
                        <tbody>{[...volzaTopBuyers].sort((a, b) => (b.total_cif_usd || 0) - (a.total_cif_usd || 0)).slice(0, 15).map((b, i) => (
                          <tr key={i}><td style={tdStyle}>{i + 1}</td><td style={{ ...tdStyle, fontWeight: 600, color: COLORS.cyan, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.company_name}>{b.company_name}</td>
                            <td style={{ ...tdStyle, color: COLORS.blue, fontWeight: 600 }}>{b.hs4}</td><td style={tdStyle}>{b.shipment_count}</td><td style={{ ...tdStyle, fontWeight: 600 }}>${((b.total_cif_usd || 0) / 1000).toFixed(1)}K</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Card>
                  <Card title="Margin vs Score Overview" emoji="📈">
                    <ResponsiveContainer width="100%" height={350}>
                      <ScatterChart><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                        <XAxis type="number" dataKey="gross_margin_pct" name="Margin %" stroke="#94a3b8" fontSize={11} label={{ value: 'Gross Margin %', position: 'bottom', fill: '#64748b', fontSize: 11 }} />
                        <YAxis type="number" dataKey="v_shipments" name="Shipments" stroke="#94a3b8" fontSize={11} label={{ value: 'Shipments', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                        <ZAxis type="number" dataKey="v_cif" range={[40, 400]} name="CIF $" />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => name === 'CIF $' ? `$${(Number(v)/1e6).toFixed(2)}M` : v} labelFormatter={() => ''} />
                        <Scatter data={unifiedCodes.filter(c => c.gross_margin_pct > 0 && c.v_shipments > 0)} fill={COLORS.blue} name="Codes">
                          {unifiedCodes.filter(c => c.gross_margin_pct > 0 && c.v_shipments > 0).map((c, i) => <Cell key={i} fill={MODEL_COLORS[c.trading_model] || COLORS.blue} />)}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              </>)
            )}

            {/* ===== CODE MATRIX VIEW — Unified table merging ALL research phases ===== */}
            {volzaView === 'matrix' && (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" placeholder="Search HS4, commodity..." value={matrixSF.search} onChange={e => matrixSF.setSearch(e.target.value)}
                    style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', outline: 'none', minWidth: '200px' }} />
                  <select value={analyticsFilters.tradingModel} onChange={e => setAnalyticsFilters(f => ({ ...f, tradingModel: e.target.value }))} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}>
                    <option value="">All Models</option>
                    {['REGULAR', 'SPOT', 'BROKER', 'MIXED'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={analyticsFilters.regRisk} onChange={e => setAnalyticsFilters(f => ({ ...f, regRisk: e.target.value }))} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}>
                    <option value="">All Reg Risk</option>
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{matrixFiltered.length} codes with Volza data</span>
                </div>
                <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '750px', overflowY: 'auto', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '1400px' }}>
                    <thead><tr>
                      <SortHeader label="HS4" field="hs4" {...matrixSF} />
                      <th style={{ ...thStyle, minWidth: '140px' }}>Commodity</th>
                      <SortHeader label="Trade $M" field="val_m" {...matrixSF} />
                      <th style={thStyle}>Model</th>
                      <SortHeader label="P5 Score" field="p5_score" {...matrixSF} />
                      <SortHeader label="Margin %" field="gross_margin_pct" {...matrixSF} />
                      <SortHeader label="Duty %" field="total_duty_pct" {...matrixSF} />
                      <th style={thStyle}>Reg Risk</th>
                      <SortHeader label="Suppliers" field="total_suppliers" {...matrixSF} />
                      <SortHeader label="FOB $" field="fob_typical" {...matrixSF} />
                      <SortHeader label="Sellers" field="total_sellers" {...matrixSF} />
                      <SortHeader label="Shipments" field="v_shipments" {...matrixSF} />
                      <SortHeader label="CIF $M" field="v_cif" {...matrixSF} />
                      <SortHeader label="Buyers" field="v_buyers" {...matrixSF} />
                      <SortHeader label="HHI" field="hhi" {...matrixSF} />
                      <SortHeader label="China %" field="china_pct" {...matrixSF} />
                      <SortHeader label="HS8s" field="v_hs8" {...matrixSF} />
                    </tr></thead>
                    <tbody>{matrixFiltered.map((r, i) => {
                      const m = r.gross_margin_pct || 0;
                      return (
                        <tr key={r.hs4} onClick={() => { setSelectedVolzaHS4(r.hs4); setVolzaView('xref'); }} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)'}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{r.hs4}</td>
                          <td style={{ ...tdStyle, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.commodity}>{r.commodity}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>${(r.val_m || 0).toFixed(1)}</td>
                          <td style={tdStyle}><span style={{ color: MODEL_COLORS[r.trading_model] || '#94a3b8', fontWeight: 600, fontSize: '10px' }}>{r.trading_model}</span></td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: r.p5_score >= 120 ? COLORS.pass : r.p5_score >= 90 ? COLORS.maybe : r.p5_score ? COLORS.drop : '#64748b' }}>{r.p5_score || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: m > 20 ? COLORS.pass : m > 10 ? COLORS.maybe : COLORS.drop }}>{m > 0 ? `${m.toFixed(1)}%` : '—'}</td>
                          <td style={tdStyle}>{r.total_duty_pct ? `${r.total_duty_pct.toFixed(1)}%` : '—'}</td>
                          <td style={tdStyle}><Badge label={r.reg_risk || '—'} /></td>
                          <td style={{ ...tdStyle, color: COLORS.blue }}>{r.total_suppliers || '—'}</td>
                          <td style={tdStyle}>{r.fob_typical ? `$${r.fob_typical.toFixed(1)}` : '—'}</td>
                          <td style={{ ...tdStyle, color: COLORS.pass }}>{r.total_sellers || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{r.v_shipments.toLocaleString()}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>${(r.v_cif / 1e6).toFixed(2)}</td>
                          <td style={tdStyle}>{r.v_buyers}</td>
                          <td style={{ ...tdStyle, color: r.hhi && r.hhi < 2500 ? COLORS.pass : r.hhi ? COLORS.drop : '#64748b' }}>{r.hhi ? r.hhi.toFixed(0) : '—'}</td>
                          <td style={{ ...tdStyle, color: r.china_pct && r.china_pct > 40 ? COLORS.pass : r.china_pct ? COLORS.maybe : '#64748b' }}>{r.china_pct ? `${r.china_pct.toFixed(0)}%` : '—'}</td>
                          <td style={tdStyle}>{r.v_hs8}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>Click any row to open Research Cross-Reference view for that code</div>
              </div>
            )}

            {/* ===== HS8 ANALYSIS VIEW ===== */}
            {volzaView === 'hs8deep' && (() => {
              const hs8Data = hs8SF.sorted;
              const hs8Total = hs8Data.reduce((a, h) => a + (h.shipment_count || 0), 0);
              const hs8CIF = hs8Data.reduce((a, h) => a + (Number(h.total_cif_usd) || 0), 0);

              return (
                <div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={selectedVolzaHS4 || ''} onChange={e => setSelectedVolzaHS4(e.target.value || null)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', minWidth: '250px' }}>
                      <option value="">All HS4 Codes ({hs4List.length})</option>
                      {hs4List.map(h4 => { const info = codes.find(c => c.hs4 === h4); return <option key={h4} value={h4}>HS4 {h4} — {info?.commodity || ''} ({(byHS4Agg[h4]?.shipments || 0).toLocaleString()})</option>; })}
                    </select>
                    <input type="text" placeholder="Search HS8, product..." value={hs8SF.search} onChange={e => hs8SF.setSearch(e.target.value)}
                      style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', flex: 1, minWidth: '200px' }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{hs8Data.length} HS8 codes | {hs8Total.toLocaleString()} shipments | ${(hs8CIF / 1e6).toFixed(2)}M CIF</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <Metric label="HS8 Sub-codes" value={hs8Data.length} color={COLORS.blue} />
                    <Metric label="Total Shipments" value={hs8Total.toLocaleString()} color={COLORS.cyan} />
                    <Metric label="Total CIF" value={`$${(hs8CIF / 1e6).toFixed(2)}M`} color={COLORS.pass} />
                    <Metric label="Avg Unit Rate" value={hs8Data.length > 0 ? `$${(hs8Data.reduce((a, h) => a + (h.avg_unit_rate_usd || 0), 0) / hs8Data.length).toFixed(2)}` : '—'} color={COLORS.watch} />
                    <Metric label="Avg China %" value={hs8Data.length > 0 ? `${(hs8Data.reduce((a, h) => a + (h.china_pct || 0), 0) / hs8Data.length).toFixed(1)}%` : '—'} color={COLORS.maybe} />
                  </div>
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '700px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <SortHeader label="HS4" field="hs4" {...hs8SF} />
                        <SortHeader label="HS8" field="hs8_code" {...hs8SF} />
                        <th style={{ ...thStyle, maxWidth: '220px' }}>Product</th>
                        <SortHeader label="Shipments" field="shipment_count" {...hs8SF} />
                        <SortHeader label="Buyers" field="unique_buyers" {...hs8SF} />
                        <SortHeader label="Shippers" field="unique_shippers" {...hs8SF} />
                        <SortHeader label="Total CIF $" field="total_cif_usd" {...hs8SF} />
                        <SortHeader label="Avg CIF $" field="avg_cif_usd" {...hs8SF} />
                        <SortHeader label="Unit Rate $" field="avg_unit_rate_usd" {...hs8SF} />
                        <SortHeader label="Min Rate $" field="min_unit_rate" {...hs8SF} />
                        <SortHeader label="Max Rate $" field="max_unit_rate" {...hs8SF} />
                        <SortHeader label="China %" field="china_pct" {...hs8SF} />
                        <th style={thStyle}>Date Range</th>
                      </tr></thead>
                      <tbody>{hs8Data.map((h, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)'}>
                          <td style={{ ...tdStyle, color: COLORS.blue, fontWeight: 600 }}>{h.hs4}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.cyan }}>{h.hs8_code}</td>
                          <td style={{ ...tdStyle, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.product_desc}>{h.product_desc}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{h.shipment_count?.toLocaleString() || '—'}</td>
                          <td style={tdStyle}>{h.unique_buyers || '—'}</td>
                          <td style={tdStyle}>{h.unique_shippers || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>${((h.total_cif_usd || 0) / 1000).toFixed(1)}K</td>
                          <td style={tdStyle}>${(h.avg_cif_usd || 0).toFixed(0)}</td>
                          <td style={tdStyle}>${(h.avg_unit_rate_usd || 0).toFixed(2)}</td>
                          <td style={tdStyle}>{h.min_unit_rate ? `$${h.min_unit_rate.toFixed(2)}` : '—'}</td>
                          <td style={tdStyle}>{h.max_unit_rate ? `$${h.max_unit_rate.toFixed(2)}` : '—'}</td>
                          <td style={{ ...tdStyle, color: (h.china_pct || 0) > 70 ? COLORS.maybe : (h.china_pct || 0) > 40 ? COLORS.pass : COLORS.watch, fontWeight: 600 }}>{(h.china_pct || 0).toFixed(0)}%</td>
                          <td style={{ ...tdStyle, fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>{h.first_date ? String(h.first_date).substring(0, 10) : '—'} → {h.last_date ? String(h.last_date).substring(0, 10) : '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* ===== BUYER INTELLIGENCE VIEW ===== */}
            {volzaView === 'buyers' && (() => {
              return (
                <div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={selectedVolzaHS4 || ''} onChange={e => setSelectedVolzaHS4(e.target.value || null)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', minWidth: '250px' }}>
                      <option value="">All HS4 Codes</option>
                      {hs4List.map(h4 => { const ct = volzaTopBuyers.filter(b => b.hs4 === h4).length; return <option key={h4} value={h4}>HS4 {h4} ({ct} buyers)</option>; })}
                    </select>
                    <input type="text" placeholder="Search company, IEC, city..." value={buyersSF.search} onChange={e => buyersSF.setSearch(e.target.value)}
                      style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', flex: 1, minWidth: '200px' }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{buyersSF.sorted.length} buyers</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <Metric label="Total Buyers" value={buyersSF.sorted.length} color={COLORS.blue} />
                    <Metric label="Total CIF" value={`$${(buyersSF.sorted.reduce((a, b) => a + (b.total_cif_usd || 0), 0) / 1e6).toFixed(2)}M`} color={COLORS.pass} />
                    <Metric label="Avg Shipments/Buyer" value={(buyersSF.sorted.reduce((a, b) => a + (b.shipment_count || 0), 0) / (buyersSF.sorted.length || 1)).toFixed(1)} color={COLORS.cyan} />
                    <Metric label="Avg China %" value={`${(buyersSF.sorted.reduce((a, b) => a + (b.china_pct || 0), 0) / (buyersSF.sorted.length || 1)).toFixed(0)}%`} color={COLORS.maybe} />
                  </div>
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '700px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <SortHeader label="Rank" field="rank_in_hs4" {...buyersSF} />
                        <SortHeader label="Company" field="company_name" {...buyersSF} style={{ minWidth: '180px' }} />
                        <th style={thStyle}>HS4</th>
                        <th style={thStyle}>IEC</th>
                        <th style={thStyle}>City</th>
                        <th style={thStyle}>State</th>
                        <SortHeader label="Shipments" field="shipment_count" {...buyersSF} />
                        <SortHeader label="Total CIF $" field="total_cif_usd" {...buyersSF} />
                        <SortHeader label="Avg Rate $" field="avg_unit_rate_usd" {...buyersSF} />
                        <SortHeader label="Suppliers" field="supplier_count" {...buyersSF} />
                        <SortHeader label="HS8 Codes" field="hs8_codes_count" {...buyersSF} />
                        <SortHeader label="China %" field="china_pct" {...buyersSF} />
                      </tr></thead>
                      <tbody>{buyersSF.sorted.slice(0, 200).map((b, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)'}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue, textAlign: 'center' }}>{b.rank_in_hs4 || i + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.cyan, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.company_name}>{b.company_name}</td>
                          <td style={{ ...tdStyle, color: COLORS.blue, fontWeight: 600 }}>{b.hs4}</td>
                          <td style={{ ...tdStyle, fontSize: '11px', color: '#94a3b8' }}>{b.iec || '—'}</td>
                          <td style={tdStyle}>{b.city || '—'}</td>
                          <td style={tdStyle}>{b.state || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{b.shipment_count || 0}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>${((b.total_cif_usd || 0) / 1000).toFixed(1)}K</td>
                          <td style={tdStyle}>${(b.avg_unit_rate_usd || 0).toFixed(2)}</td>
                          <td style={tdStyle}>{b.supplier_count || '—'}</td>
                          <td style={tdStyle}>{b.hs8_codes_count || 0}</td>
                          <td style={{ ...tdStyle, color: (b.china_pct || 0) > 70 ? COLORS.maybe : (b.china_pct || 0) > 40 ? COLORS.pass : COLORS.watch, fontWeight: 600 }}>{(b.china_pct || 0).toFixed(0)}%</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    {buyersSF.sorted.length > 200 && <div style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>Showing 200 of {buyersSF.sorted.length}</div>}
                  </div>
                </div>
              );
            })()}

            {/* ===== COUNTRIES VIEW — Source country analysis ===== */}
            {volzaView === 'countries' && (() => {
              const cData = countrySF.sorted;
              const totalCIF3 = cData.reduce((a, c) => a + (Number(c.total_cif_usd) || 0), 0);
              const totalShipC = cData.reduce((a, c) => a + (c.shipment_count || 0), 0);
              const top10 = [...cData].sort((a, b) => (Number(b.total_cif_usd) || 0) - (Number(a.total_cif_usd) || 0)).slice(0, 10);
              return (<div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={selectedVolzaHS4 || ''} onChange={e => setSelectedVolzaHS4(e.target.value || null)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', minWidth: '250px' }}>
                    <option value="">All HS4 Codes</option>
                    {[...new Set(countryMix.map(c => c.hs4))].sort().map(h4 => <option key={h4} value={h4}>HS4 {h4}</option>)}
                  </select>
                  <input type="text" placeholder="Search country..." value={countrySF.search} onChange={e => countrySF.setSearch(e.target.value)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', minWidth: '200px' }} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{cData.length} entries | {totalShipC.toLocaleString()} shipments | ${(totalCIF3 / 1e6).toFixed(2)}M CIF</span>
                </div>
                {top10.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <Card title="Top Countries by CIF" emoji="🌍">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={top10.map(c => ({ name: c.country, cif: (Number(c.total_cif_usd) || 0) / 1e6, shipments: c.shipment_count }))} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" /><XAxis type="number" stroke="#94a3b8" fontSize={11} /><YAxis type="category" dataKey="name" width={100} stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={tooltipStyle} formatter={v => `$${Number(v).toFixed(2)}M`} /><Bar dataKey="cif" fill={COLORS.blue} radius={[0, 4, 4, 0]} name="CIF $M" /></BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card title="Shipments by Country" emoji="📦">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart><Pie data={top10.map(c => ({ name: c.country, value: c.shipment_count || 0 }))} cx="50%" cy="50%" innerRadius={50} outerRadius={110} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{top10.map((_, i) => <Cell key={i} fill={[COLORS.blue, COLORS.cyan, COLORS.pass, COLORS.maybe, COLORS.watch, COLORS.orange, COLORS.drop, '#94a3b8', '#64748b', '#475569'][i % 10]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>}
                <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '600px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr>
                      <SortHeader label="HS4" field="hs4" {...countrySF} />
                      <SortHeader label="Country" field="country" {...countrySF} />
                      <SortHeader label="Shipments" field="shipment_count" {...countrySF} />
                      <SortHeader label="Buyers" field="buyer_count" {...countrySF} />
                      <SortHeader label="CIF $" field="total_cif_usd" {...countrySF} />
                      <SortHeader label="CIF %" field="cif_share_pct" {...countrySF} />
                      <SortHeader label="Avg Rate $" field="avg_unit_rate_usd" {...countrySF} />
                      <SortHeader label="Shippers" field="shipper_count" {...countrySF} />
                      <SortHeader label="Rank" field="rank_in_hs4" {...countrySF} />
                    </tr></thead>
                    <tbody>{cData.map((c, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)'}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.blue }}>{c.hs4}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.cyan }}>{c.country}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{(c.shipment_count || 0).toLocaleString()}</td>
                        <td style={tdStyle}>{c.buyer_count || 0}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>${((Number(c.total_cif_usd) || 0) / 1000).toFixed(1)}K</td>
                        <td style={{ ...tdStyle, color: (c.cif_share_pct || 0) > 30 ? COLORS.pass : COLORS.maybe }}>{(c.cif_share_pct || 0).toFixed(1)}%</td>
                        <td style={tdStyle}>${(c.avg_unit_rate_usd || 0).toFixed(2)}</td>
                        <td style={tdStyle}>{c.shipper_count || 0}</td>
                        <td style={tdStyle}>{c.rank_in_hs4 || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>);
            })()}

            {/* ===== SHIPPERS VIEW ===== */}
            {volzaView === 'shippers' && (() => {
              const sData = shipperSF.sorted;
              return (<div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={selectedVolzaHS4 || ''} onChange={e => setSelectedVolzaHS4(e.target.value || null)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', minWidth: '250px' }}>
                    <option value="">All HS4 Codes</option>
                    {[...new Set(topShippers.map(s => s.hs4))].sort().map(h4 => <option key={h4} value={h4}>HS4 {h4}</option>)}
                  </select>
                  <input type="text" placeholder="Search shipper..." value={shipperSF.search} onChange={e => shipperSF.setSearch(e.target.value)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', minWidth: '200px' }} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{sData.length} shippers</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <Metric label="Total Shippers" value={sData.length} color={COLORS.blue} />
                  <Metric label="Total CIF" value={`$${(sData.reduce((a, s) => a + (Number(s.total_cif_usd) || 0), 0) / 1e6).toFixed(2)}M`} color={COLORS.pass} />
                  <Metric label="Unique Countries" value={[...new Set(sData.map(s => s.primary_country).filter(Boolean))].length} color={COLORS.cyan} />
                  <Metric label="Avg Buyers/Shipper" value={(sData.reduce((a, s) => a + (s.buyer_count || 0), 0) / (sData.length || 1)).toFixed(1)} color={COLORS.maybe} />
                </div>
                <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '700px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr>
                      <SortHeader label="Rank" field="rank_in_hs4" {...shipperSF} />
                      <SortHeader label="Shipper" field="shipper_name" {...shipperSF} />
                      <SortHeader label="HS4" field="hs4" {...shipperSF} />
                      <SortHeader label="Shipments" field="shipment_count" {...shipperSF} />
                      <SortHeader label="CIF $" field="total_cif_usd" {...shipperSF} />
                      <SortHeader label="Buyers" field="buyer_count" {...shipperSF} />
                      <SortHeader label="Country" field="primary_country" {...shipperSF} />
                    </tr></thead>
                    <tbody>{sData.map((s, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)'}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{s.rank_in_hs4 || i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.cyan, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.shipper_name}>{s.shipper_name}</td>
                        <td style={{ ...tdStyle, color: COLORS.blue, fontWeight: 600 }}>{s.hs4}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{(s.shipment_count || 0).toLocaleString()}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>${((Number(s.total_cif_usd) || 0) / 1000).toFixed(1)}K</td>
                        <td style={tdStyle}>{s.buyer_count || 0}</td>
                        <td style={tdStyle}>{s.primary_country || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>);
            })()}

            {/* ===== PORTS VIEW ===== */}
            {volzaView === 'ports' && (() => {
              const pData = portSF.sorted;
              const totalShipP = pData.reduce((a, p) => a + (p.shipment_count || 0), 0);
              const top10p = [...pData].sort((a, b) => (b.shipment_count || 0) - (a.shipment_count || 0)).slice(0, 10);
              return (<div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={selectedVolzaHS4 || ''} onChange={e => setSelectedVolzaHS4(e.target.value || null)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', minWidth: '250px' }}>
                    <option value="">All HS4 Codes</option>
                    {[...new Set(portAnalysis.map(p => p.hs4))].sort().map(h4 => <option key={h4} value={h4}>HS4 {h4}</option>)}
                  </select>
                  <input type="text" placeholder="Search port..." value={portSF.search} onChange={e => portSF.setSearch(e.target.value)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', minWidth: '200px' }} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{pData.length} port entries | {totalShipP.toLocaleString()} shipments</span>
                </div>
                {top10p.length > 0 && <Card title="Top Ports by Shipment Volume" emoji="🏗️" style={{ marginBottom: '20px' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={top10p.map(p => ({ name: p.port_name, shipments: p.shipment_count, cif: (Number(p.total_cif_usd) || 0) / 1e6 }))} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" /><XAxis type="number" stroke="#94a3b8" fontSize={11} /><YAxis type="category" dataKey="name" width={120} stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="shipments" fill={COLORS.cyan} radius={[0, 4, 4, 0]} name="Shipments" /></BarChart>
                  </ResponsiveContainer>
                </Card>}
                <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '600px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr>
                      <SortHeader label="HS4" field="hs4" {...portSF} />
                      <SortHeader label="Port" field="port_name" {...portSF} />
                      <SortHeader label="Shipments" field="shipment_count" {...portSF} />
                      <SortHeader label="CIF $" field="total_cif_usd" {...portSF} />
                      <SortHeader label="Share %" field="shipment_share_pct" {...portSF} />
                      <SortHeader label="Rank" field="rank_in_hs4" {...portSF} />
                    </tr></thead>
                    <tbody>{pData.map((p, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)'}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.blue }}>{p.hs4}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.cyan }}>{p.port_name}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{(p.shipment_count || 0).toLocaleString()}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>${((Number(p.total_cif_usd) || 0) / 1000).toFixed(1)}K</td>
                        <td style={{ ...tdStyle, color: (p.shipment_share_pct || 0) > 20 ? COLORS.pass : COLORS.maybe }}>{(p.shipment_share_pct || 0).toFixed(1)}%</td>
                        <td style={tdStyle}>{p.rank_in_hs4 || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>);
            })()}

            {/* ===== PRICING VIEW ===== */}
            {volzaView === 'prices' && (() => {
              const psData = priceStats;
              const psSorted = [...psData].sort((a, b) => (b.avg_unit_rate_usd || 0) - (a.avg_unit_rate_usd || 0));
              return (<div>
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{psData.length} codes with price data</span>
                </div>
                {psSorted.length > 0 && <Card title="Unit Rate Distribution by HS4" emoji="💰" style={{ marginBottom: '20px' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={psSorted.map(p => ({ hs4: p.hs4, min: p.min_unit_rate_usd || 0, avg: p.avg_unit_rate_usd || 0, max: p.max_unit_rate_usd || 0, median: p.median_unit_rate_usd || 0 }))}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" /><XAxis dataKey="hs4" stroke="#94a3b8" fontSize={11} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} formatter={v => `$${Number(v).toFixed(2)}`} /><Bar dataKey="min" fill={COLORS.drop} name="Min" stackId="a" /><Bar dataKey="median" fill={COLORS.blue} name="Median" /><Bar dataKey="avg" fill={COLORS.pass} name="Avg" /><Bar dataKey="max" fill={COLORS.maybe} name="Max" /></BarChart>
                  </ResponsiveContainer>
                </Card>}
                <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr>
                      <th style={thStyle}>HS4</th><th style={thStyle}>Min $</th><th style={thStyle}>P25 $</th><th style={thStyle}>Median $</th><th style={thStyle}>Avg $</th><th style={thStyle}>P75 $</th><th style={thStyle}>Max $</th><th style={thStyle}>Std Dev</th><th style={thStyle}>With Price</th>
                    </tr></thead>
                    <tbody>{psSorted.map((p, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{p.hs4}</td>
                        <td style={tdStyle}>${(p.min_unit_rate_usd || 0).toFixed(2)}</td>
                        <td style={tdStyle}>${(p.p25_unit_rate_usd || 0).toFixed(2)}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.cyan }}>${(p.median_unit_rate_usd || 0).toFixed(2)}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.pass }}>${(p.avg_unit_rate_usd || 0).toFixed(2)}</td>
                        <td style={tdStyle}>${(p.p75_unit_rate_usd || 0).toFixed(2)}</td>
                        <td style={tdStyle}>${(p.max_unit_rate_usd || 0).toFixed(2)}</td>
                        <td style={tdStyle}>{(p.std_dev || 0).toFixed(2)}</td>
                        <td style={tdStyle}>{(p.total_with_price || 0).toLocaleString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {/* Buyer Segments */}
                {buyerSegments.length > 0 && <Card title="Buyer Concentration Analysis (HHI)" emoji="📊" style={{ marginTop: '20px' }}>
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <th style={thStyle}>HS4</th><th style={thStyle}>Buyers</th><th style={thStyle}>HHI</th><th style={thStyle}>Market</th>
                        <th style={thStyle}>Large</th><th style={thStyle}>Medium</th><th style={thStyle}>Small</th>
                        <th style={thStyle}>Top5 %</th><th style={thStyle}>Top10 %</th><th style={thStyle}>Top20 %</th>
                      </tr></thead>
                      <tbody>{[...buyerSegments].sort((a, b) => (a.hhi || 0) - (b.hhi || 0)).map((b, i) => {
                        const mkt = (b.hhi || 0) < 1500 ? 'Competitive' : (b.hhi || 0) < 2500 ? 'Moderate' : 'Concentrated';
                        const mktColor = mkt === 'Competitive' ? COLORS.pass : mkt === 'Moderate' ? COLORS.maybe : COLORS.drop;
                        return (<tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{b.hs4}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{b.total_buyers}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: mktColor }}>{(b.hhi || 0).toFixed(0)}</td>
                          <td style={tdStyle}><span style={{ color: mktColor, fontWeight: 600, fontSize: '11px' }}>{mkt}</span></td>
                          <td style={tdStyle}>{b.large_buyers || 0} ({(b.large_pct || 0).toFixed(0)}%)</td>
                          <td style={tdStyle}>{b.medium_buyers || 0} ({(b.medium_pct || 0).toFixed(0)}%)</td>
                          <td style={tdStyle}>{b.small_buyers || 0} ({(b.small_pct || 0).toFixed(0)}%)</td>
                          <td style={{ ...tdStyle, color: (b.top5_concentration_pct || 0) > 60 ? COLORS.drop : COLORS.pass }}>{(b.top5_concentration_pct || 0).toFixed(1)}%</td>
                          <td style={tdStyle}>{(b.top10_concentration_pct || 0).toFixed(1)}%</td>
                          <td style={tdStyle}>{(b.top20_concentration_pct || 0).toFixed(1)}%</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                </Card>}
              </div>);
            })()}

            {/* ===== TRENDS VIEW — Monthly analysis ===== */}
            {volzaView === 'trends' && (() => {
              const mtData = selectedVolzaHS4 ? monthlyTrend.filter(m => m.hs4 === selectedVolzaHS4) : monthlyTrend;
              const mtSorted = [...mtData].sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));
              // Aggregate by month across all HS4s
              const byMonth = {};
              mtSorted.forEach(m => {
                const mo = m.month || 'Unknown';
                if (!byMonth[mo]) byMonth[mo] = { month: mo, shipments: 0, cif: 0, buyers: 0 };
                byMonth[mo].shipments += (m.shipment_count || 0);
                byMonth[mo].cif += (Number(m.total_cif_usd) || 0);
                byMonth[mo].buyers += (m.buyer_count || 0);
              });
              const monthlyAgg = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
              return (<div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={selectedVolzaHS4 || ''} onChange={e => setSelectedVolzaHS4(e.target.value || null)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', minWidth: '250px' }}>
                    <option value="">All HS4 Codes (Aggregated)</option>
                    {[...new Set(monthlyTrend.map(m => m.hs4))].sort().map(h4 => <option key={h4} value={h4}>HS4 {h4}</option>)}
                  </select>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{monthlyAgg.length} months | {mtData.length} entries</span>
                </div>
                {monthlyAgg.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <Card title="Monthly Shipment Volume" emoji="📈">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={monthlyAgg}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" /><XAxis dataKey="month" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="shipments" fill={COLORS.blue} radius={[4, 4, 0, 0]} name="Shipments" /></BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card title="Monthly CIF Value ($M)" emoji="💰">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={monthlyAgg.map(m => ({ ...m, cifM: m.cif / 1e6 }))}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" /><XAxis dataKey="month" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={tooltipStyle} formatter={v => `$${Number(v).toFixed(2)}M`} /><Bar dataKey="cifM" fill={COLORS.pass} radius={[4, 4, 0, 0]} name="CIF $M" /></BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>}
                <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr><th style={thStyle}>HS4</th><th style={thStyle}>Month</th><th style={thStyle}>Shipments</th><th style={thStyle}>CIF $</th><th style={thStyle}>Buyers</th><th style={thStyle}>Avg Rate $</th></tr></thead>
                    <tbody>{mtSorted.map((m, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.blue }}>{m.hs4}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{m.month}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{(m.shipment_count || 0).toLocaleString()}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>${((Number(m.total_cif_usd) || 0) / 1000).toFixed(1)}K</td>
                        <td style={tdStyle}>{m.buyer_count || 0}</td>
                        <td style={tdStyle}>${(m.avg_unit_rate_usd || 0).toFixed(2)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>);
            })()}

            {/* ===== RESEARCH CROSS-REFERENCE VIEW — All phases for one code ===== */}
            {volzaView === 'xref' && (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={selectedVolzaHS4 || ''} onChange={e => setSelectedVolzaHS4(e.target.value || null)} style={{ padding: '8px 14px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', minWidth: '300px' }}>
                    <option value="">-- Select HS4 Code for Cross-Reference --</option>
                    {hs4List.map(h4 => { const info = codes.find(c => c.hs4 === h4); return <option key={h4} value={h4}>HS4 {h4} — {info?.commodity || ''} (${((byHS4Agg[h4]?.cif || 0) / 1e6).toFixed(2)}M CIF)</option>; })}
                  </select>
                </div>

                {!xrefData ? (
                  <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>Select an HS4 code above to view its complete research profile across all phases.</div>
                ) : (
                  <>
                    {/* Summary Header */}
                    <div style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(52,211,153,0.06))', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '24px', fontWeight: 700, color: COLORS.blue }}>HS4 {xrefCode}</span>
                          <span style={{ fontSize: '16px', color: '#e2e8f0', marginLeft: '12px' }}>{xrefData.code.commodity || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Badge label={xrefData.code.trading_model || 'UNASSIGNED'} />
                          <Badge label={xrefData.scr.verdict || xrefData.code.qa_status || '—'} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                        <Metric label="Trade Value" value={`$${(xrefData.code.val_m || 0).toFixed(1)}M`} color={COLORS.blue} />
                        <Metric label="P5 Score" value={xrefData.scr.total_score || '—'} color={xrefData.scr.total_score >= 120 ? COLORS.pass : xrefData.scr.total_score >= 90 ? COLORS.maybe : COLORS.drop} />
                        <Metric label="Gross Margin" value={xrefData.dem.gross_margin_pct ? `${xrefData.dem.gross_margin_pct.toFixed(1)}%` : '—'} color={COLORS.pass} />
                        <Metric label="Total Duty" value={xrefData.reg.total_duty_pct ? `${xrefData.reg.total_duty_pct.toFixed(1)}%` : '—'} color={COLORS.maybe} />
                        <Metric label="Volza Shipments" value={(byHS4Agg[xrefCode]?.shipments || 0).toLocaleString()} color={COLORS.cyan} />
                        <Metric label="Volza CIF" value={`$${((byHS4Agg[xrefCode]?.cif || 0) / 1e6).toFixed(2)}M`} color={COLORS.pass} />
                      </div>
                    </div>

                    {/* P2: Supply + P3: Demand side-by-side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      <Card title="P2: China Supply (Alibaba)" emoji="🏭">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <Metric label="Total Suppliers" value={xrefData.sup.total_suppliers || '—'} color={COLORS.blue} />
                          <Metric label="Gold Supplier %" value={xrefData.sup.gold_supplier_pct ? `${xrefData.sup.gold_supplier_pct.toFixed(1)}%` : '—'} color={COLORS.maybe} />
                          <Metric label="FOB Low" value={xrefData.sup.fob_lowest_usd ? `$${xrefData.sup.fob_lowest_usd.toFixed(2)}` : '—'} color={COLORS.pass} />
                          <Metric label="FOB High" value={xrefData.sup.fob_highest_usd ? `$${xrefData.sup.fob_highest_usd.toFixed(2)}` : '—'} color={COLORS.drop} />
                          <Metric label="FOB Typical" value={xrefData.sup.fob_typical_usd ? `$${xrefData.sup.fob_typical_usd.toFixed(2)}` : '—'} color={COLORS.cyan} />
                          <Metric label="MOQ" value={xrefData.sup.typical_moq || '—'} />
                        </div>
                      </Card>
                      <Card title="P3: India Demand (IndiaMART)" emoji="🇮🇳">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <Metric label="Total Sellers" value={xrefData.dem.total_sellers || '—'} color={COLORS.pass} />
                          <Metric label="Manufacturer %" value={xrefData.dem.manufacturer_pct ? `${xrefData.dem.manufacturer_pct.toFixed(0)}%` : '—'} color={COLORS.blue} />
                          <Metric label="Price Low" value={xrefData.dem.price_low_inr ? `₹${Number(xrefData.dem.price_low_inr).toLocaleString()}` : '—'} color={COLORS.pass} />
                          <Metric label="Price High" value={xrefData.dem.price_high_inr ? `₹${Number(xrefData.dem.price_high_inr).toLocaleString()}` : '—'} color={COLORS.drop} />
                          <Metric label="Landed Cost" value={xrefData.dem.landed_cost_inr ? `₹${Number(xrefData.dem.landed_cost_inr).toLocaleString()}` : '—'} color={COLORS.maybe} />
                          <Metric label="Gross Margin" value={xrefData.dem.gross_margin_pct ? `${xrefData.dem.gross_margin_pct.toFixed(1)}%` : '—'} color={COLORS.pass} />
                        </div>
                      </Card>
                    </div>

                    {/* P2b: Regulatory */}
                    <Card title="P2b: Regulatory Profile" emoji="📜" style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <RegItem icon="💰" label="BCD" value={xrefData.reg.bcd_pct ? `${xrefData.reg.bcd_pct}%` : '—'} />
                        <RegItem icon="📊" label="IGST" value={xrefData.reg.igst_pct ? `${xrefData.reg.igst_pct}%` : '—'} />
                        <RegItem icon="📋" label="SWS" value={xrefData.reg.sws_pct ? `${xrefData.reg.sws_pct}%` : '—'} />
                        <RegItem icon="🔢" label="Total Duty" value={xrefData.reg.total_duty_pct ? `${xrefData.reg.total_duty_pct.toFixed(1)}%` : '—'} color={COLORS.maybe} />
                        <RegItem icon={xrefData.reg.check_anti_dumping ? '🚫' : '✅'} label="Anti-Dumping" value={xrefData.reg.add_rate_pct ? `${xrefData.reg.add_rate_pct}%` : 'None'} color={xrefData.reg.check_anti_dumping ? COLORS.drop : COLORS.pass} />
                        <RegItem icon={xrefData.reg.check_bis_qco ? '⚠️' : '✅'} label="BIS QCO" value={xrefData.reg.check_bis_qco ? 'Required' : 'Not Req'} color={xrefData.reg.check_bis_qco ? COLORS.maybe : COLORS.pass} />
                        <RegItem icon={xrefData.reg.check_wpc ? '⚠️' : '✅'} label="WPC" value={xrefData.reg.check_wpc ? 'Required' : 'Not Req'} color={xrefData.reg.check_wpc ? COLORS.maybe : COLORS.pass} />
                        <RegItem icon={xrefData.reg.check_tec ? '⚠️' : '✅'} label="TEC" value={xrefData.reg.check_tec ? 'Required' : 'Not Req'} color={xrefData.reg.check_tec ? COLORS.maybe : COLORS.pass} />
                        <RegItem icon="🏷️" label="Risk Score" value={xrefData.reg.regulatory_risk_score || '—'} color={String(xrefData.reg.regulatory_risk_score).includes('LOW') ? COLORS.pass : String(xrefData.reg.regulatory_risk_score).includes('HIGH') ? COLORS.drop : COLORS.maybe} />
                        {xrefData.reg.fta_benefit_notes && <RegItem icon="🤝" label="FTA" value={xrefData.reg.fta_benefit_notes} color={COLORS.cyan} />}
                      </div>
                    </Card>

                    {/* P4: Volza Validation */}
                    {xrefData.p4.hs4 && (
                      <Card title="P4: Volza Validation" emoji="🚢" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                          <Metric label="Shipments" value={(xrefData.p4.total_shipments || 0).toLocaleString()} color={COLORS.blue} />
                          <Metric label="Unique Buyers" value={xrefData.p4.unique_buyers || 0} color={(xrefData.p4.unique_buyers || 0) > 20 ? COLORS.pass : COLORS.maybe} />
                          <Metric label="Buyer HHI" value={xrefData.p4.buyer_hhi?.toFixed(0) || '—'} color={(xrefData.p4.buyer_hhi || 0) < 2500 ? COLORS.pass : COLORS.drop} />
                          <Metric label="Median CIF" value={xrefData.p4.median_cif_usd ? `$${xrefData.p4.median_cif_usd.toFixed(0)}` : '—'} color={COLORS.cyan} />
                          <Metric label="China %" value={xrefData.p4.china_sourcing_pct ? `${xrefData.p4.china_sourcing_pct.toFixed(0)}%` : '—'} color={(xrefData.p4.china_sourcing_pct || 0) > 40 ? COLORS.pass : COLORS.maybe} />
                          <Metric label="Unique Shippers" value={xrefData.p4.unique_shippers || 0} color={COLORS.orange} />
                        </div>
                      </Card>
                    )}

                    {/* HS8 Breakdown for this code */}
                    {xrefData.hs8.length > 0 && (
                      <Card title={`HS8 Breakdown (${xrefData.hs8.length} sub-codes)`} emoji="🔬" style={{ marginBottom: '20px' }}>
                        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead><tr><th style={thStyle}>HS8</th><th style={thStyle}>Product</th><th style={thStyle}>Shipments</th><th style={thStyle}>Buyers</th><th style={thStyle}>CIF $</th><th style={thStyle}>Avg Rate $</th><th style={thStyle}>China %</th></tr></thead>
                            <tbody>{[...xrefData.hs8].sort((a, b) => (b.shipment_count || 0) - (a.shipment_count || 0)).map((h, i) => (
                              <tr key={i}><td style={{ ...tdStyle, fontWeight: 700, color: COLORS.cyan }}>{h.hs8_code}</td>
                                <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.product_desc}>{h.product_desc}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>{(h.shipment_count || 0).toLocaleString()}</td>
                                <td style={tdStyle}>{h.unique_buyers || 0}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>${((h.total_cif_usd || 0) / 1000).toFixed(1)}K</td>
                                <td style={tdStyle}>${(h.avg_unit_rate_usd || 0).toFixed(2)}</td>
                                <td style={{ ...tdStyle, color: (h.china_pct || 0) > 40 ? COLORS.pass : COLORS.watch }}>{(h.china_pct || 0).toFixed(0)}%</td></tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </Card>
                    )}

                    {/* Top Buyers for this code */}
                    {xrefData.buyers.length > 0 && (
                      <Card title={`Top Buyers (${xrefData.buyers.length})`} emoji="🎯">
                        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Company</th><th style={thStyle}>IEC</th><th style={thStyle}>City</th><th style={thStyle}>Shipments</th><th style={thStyle}>CIF $</th><th style={thStyle}>Avg Rate $</th><th style={thStyle}>Suppliers</th><th style={thStyle}>China %</th></tr></thead>
                            <tbody>{[...xrefData.buyers].sort((a, b) => (b.total_cif_usd || 0) - (a.total_cif_usd || 0)).map((b, i) => (
                              <tr key={i}><td style={tdStyle}>{i + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600, color: COLORS.cyan, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.company_name}>{b.company_name}</td>
                                <td style={{ ...tdStyle, fontSize: '11px' }}>{b.iec || '—'}</td>
                                <td style={tdStyle}>{b.city || '—'}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>{b.shipment_count || 0}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>${((b.total_cif_usd || 0) / 1000).toFixed(1)}K</td>
                                <td style={tdStyle}>${(b.avg_unit_rate_usd || 0).toFixed(2)}</td>
                                <td style={tdStyle}>{b.supplier_count || '—'}</td>
                                <td style={{ ...tdStyle, color: (b.china_pct || 0) > 40 ? COLORS.pass : COLORS.watch }}>{(b.china_pct || 0).toFixed(0)}%</td></tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ===== PHASE 4 RESULTS VIEW ===== */}
            {volzaView === 'phase4' && (() => {
              return (
                <div>
                  {p4Data.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No Phase 4 validation results yet. Phase 4 runs after QA Gate passes.</div>
                  ) : (<>
                    <Card title="Validation Thresholds" emoji="📋" style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <Metric label="Buyer HHI" value="< 2,500" color={COLORS.pass} sub="Distributed market" />
                        <Metric label="Unique Buyers" value="> 20" color={COLORS.pass} sub="Sufficient pool" />
                        <Metric label="Median CIF" value="$5K-$100K" color={COLORS.pass} sub="Trader range" />
                        <Metric label="China Sourcing" value="> 40%" color={COLORS.pass} sub="Supply validated" />
                      </div>
                    </Card>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                      <input type="text" placeholder="Search..." value={p4SF.search} onChange={e => p4SF.setSearch(e.target.value)}
                        style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', minWidth: '200px' }} />
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{p4SF.sorted.length} codes validated</span>
                    </div>
                    <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '700px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead><tr>
                          <SortHeader label="HS4" field="hs4" {...p4SF} />
                          <th style={thStyle}>Date</th>
                          <SortHeader label="Shipments" field="total_shipments" {...p4SF} />
                          <SortHeader label="Buyers" field="unique_buyers" {...p4SF} />
                          <SortHeader label="HHI" field="buyer_hhi" {...p4SF} />
                          <th style={thStyle}>Median CIF</th><th style={thStyle}>Avg CIF</th>
                          <SortHeader label="Shippers" field="unique_shippers" {...p4SF} />
                          <SortHeader label="China %" field="china_sourcing_pct" {...p4SF} />
                          <th style={thStyle}>Unit Rate</th><th style={thStyle}>Result</th>
                        </tr></thead>
                        <tbody>{p4SF.sorted.map(p => (
                          <tr key={p.hs4} onClick={() => { setSelectedVolzaHS4(p.hs4); setVolzaView('xref'); }} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{p.hs4}</td>
                            <td style={tdStyle}>{p.scrape_date || '—'}</td>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>{(p.total_shipments || 0).toLocaleString()}</td>
                            <td style={{ ...tdStyle, color: (p.unique_buyers || 0) > 20 ? COLORS.pass : COLORS.maybe }}>{p.unique_buyers || 0}</td>
                            <td style={{ ...tdStyle, color: (p.buyer_hhi || 0) < 2500 ? COLORS.pass : COLORS.drop }}>{p.buyer_hhi?.toFixed(0) || '—'}</td>
                            <td style={tdStyle}>{p.median_cif_usd ? `$${p.median_cif_usd.toFixed(0)}` : '—'}</td>
                            <td style={tdStyle}>{p.avg_cif_usd ? `$${p.avg_cif_usd.toFixed(0)}` : '—'}</td>
                            <td style={tdStyle}>{p.unique_shippers || 0}</td>
                            <td style={{ ...tdStyle, color: (p.china_sourcing_pct || 0) > 40 ? COLORS.pass : COLORS.maybe }}>{p.china_sourcing_pct ? `${p.china_sourcing_pct.toFixed(0)}%` : '—'}</td>
                            <td style={tdStyle}>{p.volza_avg_unit_rate ? `$${p.volza_avg_unit_rate.toFixed(2)}` : '—'}</td>
                            <td style={tdStyle}>{p.kill_signal ? <span style={{ color: COLORS.drop }}>KILL</span> : <span style={{ color: COLORS.pass }}>PASS</span>}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </>)}
                </div>
              );
            })()}

            {/* ===== SCRAPE QUEUE VIEW ===== */}
            {volzaView === 'queue' && (() => {
              const queueData = queueDataForView;
              let qFiltered = qSF.sorted;
              if (queueStatusFilter) qFiltered = qFiltered.filter(q => (q.scrape_status || 'queued') === queueStatusFilter);
              const qStats = { total: queueData.length, completed: queueData.filter(q => q.scrape_status === 'completed').length, inProgress: queueData.filter(q => q.scrape_status === 'in_progress').length, queued: queueData.filter(q => q.scrape_status === 'queued').length };

              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <KPI label="Total Codes" value={qStats.total} variant="blue" />
                    <KPI label="Completed" value={qStats.completed} variant="pass" sub={`${((qStats.completed / (qStats.total || 1)) * 100).toFixed(0)}%`} />
                    <KPI label="In Progress" value={qStats.inProgress} variant="maybe" />
                    <KPI label="Queued" value={qStats.queued} variant="orange" sub="Pending scrape" />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={queueStatusFilter} onChange={e => setQueueStatusFilter(e.target.value)} style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}>
                      <option value="">All Statuses</option>
                      <option value="completed">Completed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="queued">Queued</option>
                    </select>
                    <input type="text" placeholder="Search..." value={qSF.search} onChange={e => qSF.setSearch(e.target.value)}
                      style={{ padding: '8px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', minWidth: '200px' }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Showing {qFiltered.length} of {queueData.length}</span>
                    <ProgressBar label="Scrape Progress" value={qStats.completed} max={qStats.total} color={COLORS.pass} />
                  </div>
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '700px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <SortHeader label="Priority" field="priority" {...qSF} />
                        <SortHeader label="HS4" field="hs4" {...qSF} />
                        <th style={{ ...thStyle, minWidth: '200px' }}>Commodity</th>
                        <SortHeader label="Score" field="drill_score" {...qSF} />
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Completed</th>
                      </tr></thead>
                      <tbody>{qFiltered.map(q => {
                        const st = q.scrape_status || 'queued';
                        const stColor = st === 'completed' ? COLORS.pass : st === 'in_progress' ? COLORS.maybe : '#94a3b8';
                        return (
                          <tr key={q.hs4} onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={tdStyle}>{q.priority || '—'}</td>
                            <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{q.hs4}</td>
                            <td style={{ ...tdStyle, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.commodity}>{q.commodity || '—'}</td>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>{q.drill_score?.toFixed(0) || '—'}</td>
                            <td style={tdStyle}><span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: st === 'completed' ? RGB.pass : st === 'in_progress' ? RGB.maybe : '#1e293b', color: stColor, border: `1px solid ${stColor}50`, textTransform: 'capitalize' }}>{st}</span></td>
                            <td style={tdStyle}>{q.completed_at ? String(q.completed_at).substring(0, 10) : '—'}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ==================== TAB: BUSINESS BLUEPRINT ==================== */}
      {activeTab === 'blueprint' && (() => {
        const BLUEPRINT_VIEWS = [
          { key: 'overview', icon: '🗺️', label: 'Overview' },
          { key: 'margins', icon: '💰', label: `HS8 Margins (${hs8Margins.length})` },
          { key: 'buyers', icon: '🎯', label: `Buyer Targets (${buyerTargets.length})` },
          { key: 'suppliers', icon: '🏭', label: `China Suppliers (${chinaSuppliers.length})` },
          { key: 'plan', icon: '📋', label: `Supply Chain (${supplyChainPlan.length})` },
        ];
        const bpHS4s = [...new Set(supplyChainPlan.map(s => s.hs4))];
        const filteredMargins = blueprintHS4 ? hs8Margins.filter(m => m.hs4 === blueprintHS4) : hs8Margins;
        const filteredBuyers = blueprintHS4 ? buyerTargets.filter(b => b.hs4 === blueprintHS4) : buyerTargets;
        const filteredSuppliers = blueprintHS4 ? chinaSuppliers.filter(s => s.hs4 === blueprintHS4) : chinaSuppliers;
        const filteredPlans = blueprintHS4 ? supplyChainPlan.filter(p => p.hs4 === blueprintHS4) : supplyChainPlan;
        const pursueCount = supplyChainPlan.filter(p => p.final_verdict === 'PURSUE').length;
        const strongCount = supplyChainPlan.filter(p => p.final_verdict === 'STRONG').length;
        const totalRevenue = supplyChainPlan.reduce((a, p) => a + (p.expected_monthly_revenue_usd || 0), 0);
        const totalProfit = supplyChainPlan.reduce((a, p) => a + (p.expected_monthly_profit_usd || 0), 0);
        const avgMargin = hs8Margins.length > 0 ? hs8Margins.reduce((a, m) => a + (m.gross_margin_pct || 0), 0) / hs8Margins.length : 0;
        const totalWC = supplyChainPlan.reduce((a, p) => a + (p.working_capital_required_inr || 0), 0);
        const marginByTier = { HIGH: 0, MEDIUM: 0, LOW: 0, NEGATIVE: 0 };
        hs8Margins.forEach(m => { marginByTier[m.margin_tier || 'LOW'] = (marginByTier[m.margin_tier || 'LOW'] || 0) + 1; });

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', color: '#e2e8f0', margin: 0 }}>🗺️ Business Blueprint — Complete Entry Strategy</h2>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={blueprintHS4} onChange={e => setBlueprintHS4(e.target.value)} style={{ padding: '6px 12px', background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}>
                  <option value="">All HS4 Codes</option>
                  {bpHS4s.map(h => <option key={h} value={h}>{h} — {(supplyChainPlan.find(p => p.hs4 === h) || {}).commodity || ''}</option>)}
                </select>
                {BLUEPRINT_VIEWS.map(v => (
                  <button key={v.key} onClick={() => setBlueprintView(v.key)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: blueprintView === v.key ? 600 : 400, background: blueprintView === v.key ? RGB.blue : 'transparent', color: blueprintView === v.key ? COLORS.blue : '#94a3b8', border: `1px solid ${blueprintView === v.key ? COLORS.blue + '50' : 'rgba(148,163,184,0.08)'}`, cursor: 'pointer' }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* BLUEPRINT KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <KPI label="Products Analyzed" value={supplyChainPlan.length} variant="blue" sub={`${[...new Set(hs8Margins.map(m => m.hs4))].length} with HS8 margins`} />
              <KPI label="PURSUE" value={pursueCount} variant="pass" sub={`${strongCount} STRONG`} />
              <KPI label="HS8 Sub-Codes" value={hs8Margins.length} variant="cyan" sub={`${marginByTier.HIGH || 0} high margin`} />
              <KPI label="Avg Gross Margin" value={`${avgMargin.toFixed(1)}%`} variant="pass" />
              <KPI label="Target Buyers" value={buyerTargets.length} variant="blue" sub={`${buyerTargets.filter(b => b.priority === 'A').length} Priority-A`} />
              <KPI label="Est. Monthly Revenue" value={`$${(totalRevenue / 1000).toFixed(0)}K`} variant="cyan" sub={`$${(totalProfit / 1000).toFixed(0)}K profit`} />
              <KPI label="Working Capital" value={`₹${(totalWC / 100000).toFixed(1)}L`} variant="maybe" />
            </div>

            {/* OVERVIEW SUB-VIEW */}
            {blueprintView === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Margin Distribution Chart */}
                <Card title="Margin Distribution by HS8" emoji="📊">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={[
                      { tier: 'HIGH (>30%)', count: marginByTier.HIGH || 0, fill: COLORS.pass },
                      { tier: 'MEDIUM (15-30%)', count: marginByTier.MEDIUM || 0, fill: COLORS.blue },
                      { tier: 'LOW (5-15%)', count: marginByTier.LOW || 0, fill: COLORS.maybe },
                      { tier: 'NEGATIVE', count: marginByTier.NEGATIVE || 0, fill: COLORS.drop },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="tier" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="count" name="HS8 Codes" radius={[6, 6, 0, 0]}>
                        {[COLORS.pass, COLORS.blue, COLORS.maybe, COLORS.drop].map((c, i) => <Cell key={i} fill={c} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Verdict Pie */}
                <Card title="Product Verdicts" emoji="🎯">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={[
                        { name: 'PURSUE', value: pursueCount, fill: COLORS.pass },
                        { name: 'STRONG', value: strongCount, fill: COLORS.blue },
                        { name: 'MODERATE', value: supplyChainPlan.filter(p => p.final_verdict === 'MODERATE').length, fill: COLORS.maybe },
                        { name: 'DROP', value: supplyChainPlan.filter(p => p.final_verdict === 'DROP').length, fill: COLORS.drop },
                      ].filter(d => d.value > 0)} dataKey="value" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                {/* Top Products by Margin */}
                <Card title="Top HS4 by Average Margin" emoji="💰" style={{ gridColumn: '1 / -1' }}>
                  {(() => {
                    const byHS4 = {};
                    hs8Margins.forEach(m => {
                      if (!byHS4[m.hs4]) byHS4[m.hs4] = { hs4: m.hs4, margins: [], totalVal: 0 };
                      byHS4[m.hs4].margins.push(m.gross_margin_pct || 0);
                      byHS4[m.hs4].totalVal += m.trade_val_m || 0;
                    });
                    const ranked = Object.values(byHS4).map(g => ({
                      hs4: g.hs4,
                      avgMargin: g.margins.reduce((a, b) => a + b, 0) / g.margins.length,
                      hs8Count: g.margins.length,
                      totalVal: g.totalVal,
                      commodity: (supplyChainPlan.find(p => p.hs4 === g.hs4) || {}).commodity || '',
                    })).sort((a, b) => b.avgMargin - a.avgMargin);
                    return (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={ranked} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                          <YAxis dataKey="hs4" type="category" width={60} tick={{ fontSize: 12, fill: '#e2e8f0', fontWeight: 600 }} />
                          <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={v => `${v.toFixed(1)}%`} />
                          <Bar dataKey="avgMargin" name="Avg Gross Margin %" fill={COLORS.pass} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </Card>

                {/* Supply Chain Summary Cards */}
                <Card title="Entry Strategy Summary" emoji="🚀" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                    {supplyChainPlan.filter(p => p.final_verdict === 'PURSUE').slice(0, 6).map(p => (
                      <div key={p.hs4} style={{ background: '#1a2035', borderRadius: '10px', padding: '16px', border: '1px solid rgba(52,211,153,0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '15px' }}>{p.hs4}</span>
                          <Badge label={p.final_verdict} />
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{p.commodity}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                          <div><span style={{ color: '#64748b' }}>Score:</span> <span style={{ color: COLORS.pass, fontWeight: 600 }}>{p.final_score}/150</span></div>
                          <div><span style={{ color: '#64748b' }}>Model:</span> <span style={{ color: MODEL_COLORS[p.trading_model] || '#94a3b8', fontWeight: 600 }}>{p.trading_model}</span></div>
                          <div><span style={{ color: '#64748b' }}>Margin:</span> <span style={{ color: COLORS.pass, fontWeight: 600 }}>{(p.gross_margin_pct || 0).toFixed(1)}%</span></div>
                          <div><span style={{ color: '#64748b' }}>Market:</span> <span style={{ color: '#e2e8f0' }}>${(p.market_size_usd_m || 0).toFixed(0)}M</span></div>
                          <div><span style={{ color: '#64748b' }}>WC:</span> <span style={{ color: '#e2e8f0' }}>₹{((p.working_capital_required_inr || 0) / 100000).toFixed(1)}L</span></div>
                          <div><span style={{ color: '#64748b' }}>Risk:</span> <Badge label={p.risk_level || 'N/A'} /></div>
                        </div>
                        {p.phase1_action && <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8', background: 'rgba(96,165,250,0.06)', borderRadius: '6px', padding: '8px' }}><strong style={{ color: '#60a5fa' }}>Phase 1:</strong> {p.phase1_action}</div>}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* MARGINS SUB-VIEW */}
            {blueprintView === 'margins' && (
              <div>
                <Card title="HS8-Level Margin Analysis — China FOB vs India Sell Price" emoji="💰">
                  <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {['', 'HIGH', 'MEDIUM', 'LOW', 'NEGATIVE'].map(t => (
                      <button key={t} onClick={() => setBlueprintHS4('')} style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer' }}>
                        {t || 'All Tiers'} ({t ? hs8Margins.filter(m => m.margin_tier === t).length : hs8Margins.length})
                      </button>
                    ))}
                  </div>
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '600px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <th style={thStyle}>HS4</th><th style={thStyle}>HS8</th><th style={{ ...thStyle, minWidth: '160px' }}>Description</th>
                        <th style={thStyle}>Trade $M</th><th style={thStyle}>China FOB $</th><th style={thStyle}>India Price ₹</th>
                        <th style={thStyle}>Total Duty %</th><th style={thStyle}>Landed ₹</th><th style={thStyle}>Gross Margin %</th><th style={thStyle}>Tier</th>
                        <th style={thStyle}>Sourcing</th><th style={thStyle}>Demand</th>
                      </tr></thead>
                      <tbody>{filteredMargins.map((m, i) => (
                        <tr key={m.id || i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue, cursor: 'pointer' }} onClick={() => { setBlueprintHS4(m.hs4); }}>{m.hs4}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px' }}>{m.hs8}</td>
                          <td style={{ ...tdStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.hs8_description}>{m.hs8_description}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>${(m.trade_val_m || 0).toFixed(1)}</td>
                          <td style={tdStyle}>${(m.china_fob_typical_usd || 0).toFixed(2)}</td>
                          <td style={tdStyle}>₹{(m.india_price_typical_inr || 0).toLocaleString()}</td>
                          <td style={tdStyle}>{(m.total_duty_pct || 0).toFixed(1)}%</td>
                          <td style={tdStyle}>₹{(m.landed_cost_inr || 0).toLocaleString()}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: (m.gross_margin_pct || 0) > 30 ? COLORS.pass : (m.gross_margin_pct || 0) > 15 ? COLORS.blue : (m.gross_margin_pct || 0) > 0 ? COLORS.maybe : COLORS.drop }}>{(m.gross_margin_pct || 0).toFixed(1)}%</td>
                          <td style={tdStyle}><Badge label={m.margin_tier || 'N/A'} /></td>
                          <td style={tdStyle}><Badge label={m.sourcing_difficulty || 'N/A'} /></td>
                          <td style={tdStyle}><Badge label={m.demand_strength || 'N/A'} /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </Card>

                {/* Margin Scatter: FOB vs India Price */}
                <Card title="Margin Landscape — FOB vs Sell Price" emoji="📊" style={{ marginTop: '20px' }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis dataKey="china_fob_typical_usd" name="China FOB $" tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'China FOB (USD)', position: 'bottom', fill: '#64748b', fontSize: 11 }} />
                      <YAxis dataKey="gross_margin_pct" name="Gross Margin %" tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Gross Margin %', angle: -90, position: 'left', fill: '#64748b', fontSize: 11 }} />
                      <ZAxis dataKey="trade_val_m" range={[40, 400]} name="Trade $M" />
                      <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={(v, name) => [typeof v === 'number' ? v.toFixed(2) : v, name]} />
                      <Scatter data={filteredMargins} fill={COLORS.pass}>
                        {filteredMargins.map((m, i) => <Cell key={i} fill={m.margin_tier === 'HIGH' ? COLORS.pass : m.margin_tier === 'MEDIUM' ? COLORS.blue : m.margin_tier === 'LOW' ? COLORS.maybe : COLORS.drop} />)}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* BUYERS SUB-VIEW */}
            {blueprintView === 'buyers' && (
              <div>
                <Card title="Indian Buyer Targets — Who to Approach First" emoji="🎯">
                  <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {['', 'A', 'B', 'C'].map(p => (
                      <button key={p} onClick={() => {}} style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', background: p === '' ? RGB.blue : 'transparent', color: p === '' ? COLORS.blue : '#94a3b8', border: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer' }}>
                        {p || 'All'} Priority ({p ? filteredBuyers.filter(b => b.priority === p).length : filteredBuyers.length})
                      </button>
                    ))}
                  </div>
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '600px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <th style={thStyle}>HS4</th><th style={{ ...thStyle, minWidth: '180px' }}>Company</th><th style={thStyle}>IEC</th>
                        <th style={thStyle}>City</th><th style={thStyle}>State</th><th style={thStyle}>Shipments</th>
                        <th style={thStyle}>Total CIF $</th><th style={thStyle}>Avg Order $</th><th style={thStyle}>Type</th>
                        <th style={thStyle}>Priority</th><th style={thStyle}>China %</th><th style={thStyle}>Status</th>
                      </tr></thead>
                      <tbody>{filteredBuyers.map((b, i) => (
                        <tr key={b.id || i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue, cursor: 'pointer' }} onClick={() => setBlueprintHS4(b.hs4)}>{b.hs4}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: '#e2e8f0', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.company_name}>{b.company_name}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '10px' }}>{b.iec || '—'}</td>
                          <td style={tdStyle}>{b.city || '—'}</td>
                          <td style={tdStyle}>{b.state || '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{b.shipment_count || 0}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>${(b.total_cif_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={tdStyle}>${(b.avg_order_value_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={tdStyle}><Badge label={b.company_type || 'N/A'} /></td>
                          <td style={tdStyle}><span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: b.priority === 'A' ? RGB.pass : b.priority === 'B' ? RGB.blue : RGB.maybe, color: b.priority === 'A' ? COLORS.pass : b.priority === 'B' ? COLORS.blue : COLORS.maybe }}>{b.priority}</span></td>
                          <td style={{ ...tdStyle, color: (b.china_pct || 0) > 60 ? COLORS.pass : '#94a3b8' }}>{(b.china_pct || 0).toFixed(0)}%</td>
                          <td style={tdStyle}><Badge label={b.contact_status || 'NEW'} /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </Card>

                {/* Buyer City Distribution */}
                <Card title="Buyer Concentration by City" emoji="🏙️" style={{ marginTop: '20px' }}>
                  {(() => {
                    const cityMap = {};
                    filteredBuyers.forEach(b => { const c = b.city || 'Unknown'; cityMap[c] = (cityMap[c] || 0) + 1; });
                    const cityData = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([city, count]) => ({ city, count }));
                    return (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={cityData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                          <XAxis dataKey="city" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" height={80} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                          <Bar dataKey="count" name="Buyers" fill={COLORS.blue} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </Card>
              </div>
            )}

            {/* SUPPLIERS SUB-VIEW */}
            {blueprintView === 'suppliers' && (
              <div>
                <Card title="China Supplier Database — Sourcing Partners" emoji="🏭">
                  {chinaSuppliers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏗️</div>
                      <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '8px' }}>China Supplier Database — Coming Soon</div>
                      <div style={{ fontSize: '13px', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
                        This table will be populated with verified suppliers from Alibaba, Made-in-China, and DHgate as we research each HS8 sub-code.
                        Each supplier gets: FOB pricing, MOQ, lead time, Gold Supplier status, Trade Assurance availability, and factory verification details.
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px', maxWidth: '600px', margin: '24px auto 0' }}>
                        <div style={{ background: '#1a2035', borderRadius: '10px', padding: '16px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '4px' }}>🔍</div>
                          <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>Research Phase</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Browser visits to Alibaba, MIC, DHgate for each HS8 keyword</div>
                        </div>
                        <div style={{ background: '#1a2035', borderRadius: '10px', padding: '16px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '4px' }}>✅</div>
                          <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>Verification</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Gold Supplier, Trade Assurance, factory inspection reports</div>
                        </div>
                        <div style={{ background: '#1a2035', borderRadius: '10px', padding: '16px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📋</div>
                          <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>27 Fields</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>FOB, MOQ, lead time, payment terms, delivery rate, priority</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '600px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead><tr>
                          <th style={thStyle}>HS4</th><th style={{ ...thStyle, minWidth: '180px' }}>Supplier</th><th style={thStyle}>Platform</th>
                          <th style={thStyle}>Location</th><th style={thStyle}>Gold</th><th style={thStyle}>FOB Range $</th>
                          <th style={thStyle}>MOQ</th><th style={thStyle}>Lead Time</th><th style={thStyle}>Priority</th>
                        </tr></thead>
                        <tbody>{filteredSuppliers.map((s, i) => (
                          <tr key={s.id || i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }}>
                            <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue }}>{s.hs4}</td>
                            <td style={{ ...tdStyle, fontWeight: 600, color: '#e2e8f0' }}>{s.supplier_name}</td>
                            <td style={tdStyle}><Badge label={s.platform || 'N/A'} /></td>
                            <td style={tdStyle}>{s.location || '—'}</td>
                            <td style={tdStyle}>{s.is_gold_supplier ? <span style={{ color: COLORS.pass }}>✓ Gold</span> : '—'}</td>
                            <td style={tdStyle}>${s.fob_low_usd || '?'} - ${s.fob_high_usd || '?'}</td>
                            <td style={tdStyle}>{s.moq || '—'}</td>
                            <td style={tdStyle}>{s.lead_time || '—'}</td>
                            <td style={tdStyle}><Badge label={s.priority || 'N/A'} /></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* SUPPLY CHAIN PLAN SUB-VIEW */}
            {blueprintView === 'plan' && (
              <div>
                <Card title="Supply Chain Entry Plan — Full Execution Roadmap" emoji="📋">
                  <div style={{ border: '1px solid rgba(148,163,184,0.08)', borderRadius: '12px', overflow: 'hidden', maxHeight: '500px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead><tr>
                        <th style={thStyle}>HS4</th><th style={{ ...thStyle, minWidth: '140px' }}>Commodity</th><th style={thStyle}>Score</th>
                        <th style={thStyle}>Verdict</th><th style={thStyle}>Model</th><th style={thStyle}>Market $M</th>
                        <th style={thStyle}>Margin %</th><th style={thStyle}>WC ₹L</th><th style={thStyle}>ROI Y1</th>
                        <th style={thStyle}>Risk</th><th style={thStyle}>Buyers</th><th style={thStyle}>Source</th>
                      </tr></thead>
                      <tbody>{filteredPlans.map((p, i) => (
                        <tr key={p.id || i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(96,165,250,0.02)' }}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: COLORS.blue, cursor: 'pointer' }} onClick={() => { setBlueprintHS4(p.hs4); setBlueprintView('margins'); }}>{p.hs4}</td>
                          <td style={{ ...tdStyle, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.commodity}>{p.commodity}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: (p.final_score || 0) >= 120 ? COLORS.pass : (p.final_score || 0) >= 90 ? COLORS.blue : COLORS.maybe }}>{p.final_score}/150</td>
                          <td style={tdStyle}><Badge label={p.final_verdict || 'N/A'} /></td>
                          <td style={tdStyle}><span style={{ color: MODEL_COLORS[p.trading_model] || '#94a3b8', fontWeight: 600, fontSize: '11px' }}>{p.trading_model || '—'}</span></td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>${(p.market_size_usd_m || 0).toFixed(0)}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: (p.gross_margin_pct || 0) > 30 ? COLORS.pass : (p.gross_margin_pct || 0) > 15 ? COLORS.blue : COLORS.maybe }}>{(p.gross_margin_pct || 0).toFixed(1)}%</td>
                          <td style={tdStyle}>₹{((p.working_capital_required_inr || 0) / 100000).toFixed(1)}</td>
                          <td style={{ ...tdStyle, color: (p.roi_year1_pct || 0) > 100 ? COLORS.pass : COLORS.blue }}>{(p.roi_year1_pct || 0).toFixed(0)}%</td>
                          <td style={tdStyle}><Badge label={p.risk_level || 'N/A'} /></td>
                          <td style={tdStyle}>{p.target_buyer_count || 0}</td>
                          <td style={{ ...tdStyle, fontSize: '10px' }}>{p.primary_source_country || '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </Card>

                {/* Detailed Plan Cards for PURSUE products */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  {filteredPlans.filter(p => p.final_verdict === 'PURSUE' || p.final_verdict === 'STRONG').slice(0, 8).map(p => (
                    <Card key={p.hs4} title={`${p.hs4} — ${p.commodity}`} emoji="🎯">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '12px' }}>
                        <div><span style={{ color: '#64748b' }}>Score:</span> <span style={{ color: COLORS.pass, fontWeight: 700 }}>{p.final_score}/150</span></div>
                        <div><span style={{ color: '#64748b' }}>Verdict:</span> <Badge label={p.final_verdict} /></div>
                        <div><span style={{ color: '#64748b' }}>Model:</span> <span style={{ color: MODEL_COLORS[p.trading_model] || '#94a3b8', fontWeight: 600 }}>{p.trading_model}</span></div>
                        <div><span style={{ color: '#64748b' }}>Market:</span> <span style={{ color: '#e2e8f0' }}>${(p.market_size_usd_m || 0).toFixed(0)}M</span></div>
                        <div><span style={{ color: '#64748b' }}>Margin:</span> <span style={{ color: COLORS.pass, fontWeight: 600 }}>{(p.gross_margin_pct || 0).toFixed(1)}%</span></div>
                        <div><span style={{ color: '#64748b' }}>WC:</span> <span style={{ color: '#e2e8f0' }}>₹{((p.working_capital_required_inr || 0) / 100000).toFixed(1)}L</span></div>
                        <div><span style={{ color: '#64748b' }}>Break Even:</span> <span style={{ color: '#e2e8f0' }}>{p.break_even_months || '?'} months</span></div>
                        <div><span style={{ color: '#64748b' }}>ROI Y1:</span> <span style={{ color: COLORS.pass, fontWeight: 600 }}>{(p.roi_year1_pct || 0).toFixed(0)}%</span></div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6 }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b', minWidth: '55px' }}>Source:</span>
                          <span>{p.primary_source_country || 'China'} via {p.primary_source_platform || 'Alibaba'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b', minWidth: '55px' }}>Incoterms:</span>
                          <span>{p.recommended_incoterms || 'FOB'} / {p.recommended_payment || 'T/T 30%'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b', minWidth: '55px' }}>Certs:</span>
                          <span>{p.certifications_needed || 'None'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b', minWidth: '55px' }}>Sales:</span>
                          <span>{p.sales_channel || 'Direct'} — {p.primary_buyer_cities || 'Various'}</span>
                        </div>
                      </div>
                      {/* Phase Roadmap */}
                      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(148,163,184,0.08)', paddingTop: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>Execution Roadmap</div>
                        {[{ label: 'Phase 1 (0-3 mo)', text: p.phase1_action, color: COLORS.pass },
                          { label: 'Phase 2 (3-6 mo)', text: p.phase2_action, color: COLORS.blue },
                          { label: 'Phase 3 (6-12 mo)', text: p.phase3_action, color: COLORS.cyan }]
                          .filter(ph => ph.text).map((ph, j) => (
                          <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '11px' }}>
                            <span style={{ color: ph.color, fontWeight: 600, minWidth: '95px', flexShrink: 0 }}>{ph.label}</span>
                            <span style={{ color: '#94a3b8' }}>{ph.text}</span>
                          </div>
                        ))}
                      </div>
                      {/* Risk */}
                      {p.key_risks && (
                        <div style={{ marginTop: '8px', fontSize: '11px', background: 'rgba(248,113,113,0.06)', borderRadius: '6px', padding: '8px' }}>
                          <span style={{ color: COLORS.drop, fontWeight: 600 }}>Risks:</span> <span style={{ color: '#94a3b8' }}>{p.key_risks}</span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
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
