import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = { pass: '#34d399', maybe: '#fbbf24', watch: '#a78bfa', drop: '#f87171', blue: '#4f8cff', cyan: '#06b6d4' };
const RGB = { pass: 'rgba(52,211,153,0.15)', maybe: 'rgba(251,191,36,0.15)', watch: 'rgba(167,139,250,0.15)', drop: 'rgba(248,113,113,0.15)', blue: 'rgba(79,140,255,0.15)' };
const MODEL_COLORS = { REGULAR: '#34d399', SPOT: '#fbbf24', BROKER: '#a78bfa', MIXED: '#06b6d4', UNASSIGNED: '#94a3b8' };
const PHASE_LABELS = {
  phase1_complete: 'Phase 1: DB Screen', phase2_pending: 'Phase 2: Alibaba', phase2_done: 'Phase 2 Done',
  phase2b_pending: 'Phase 2b: Regulatory', phase2b_done: 'Phase 2b Done', phase3_pending: 'Phase 3: IndiaMART',
  phase3_done: 'Phase 3 Done', qa_pending: 'QA Gate', qa_pass: 'QA Pass', phase4_pending: 'Phase 4: Volza',
  phase4_done: 'Phase 4 Done', phase5_pending: 'Phase 5: Scoring', phase5_done: 'Complete', 'N/A': 'Complete',
};

// Reusable components
const KPI = ({ label, value, variant = 'blue', icon = '' }) => (
  <div style={{ background: RGB[variant] || RGB.blue, border: `1px solid rgba(${variant === 'pass' ? '52,211,153' : variant === 'drop' ? '248,113,113' : variant === 'maybe' ? '251,191,36' : '79,140,255'}, 0.3)`, borderRadius: '12px', padding: '16px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
    <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>{icon} {label}</div>
    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e2e8f0' }}>{value}</div>
  </div>
);

const Badge = ({ label, color = 'blue' }) => (
  <span style={{ background: RGB[color] || RGB.blue, color: COLORS[color] || COLORS.blue, border: `1px solid rgba(${color === 'pass' ? '52,211,153' : color === 'drop' ? '248,113,113' : color === 'maybe' ? '251,191,36' : '79,140,255'}, 0.3)`, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '20px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.1)', overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '16px', background: '#111827', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: open ? '1px solid rgba(148,163,184,0.1)' : 'none' }}>
        <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{title}</span>
        <span style={{ color: '#94a3b8' }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && <div style={{ padding: '16px', background: 'rgba(11,15,25,0.5)' }}>{children}</div>}
    </div>
  );
};

const ProgressBar = ({ label, value, max = 100, color = '#4f8cff' }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
      <span style={{ color: '#e2e8f0' }}>{label}</span>
      <span style={{ color: '#94a3b8' }}>{value}/{max}</span>
    </div>
    <div style={{ background: 'rgba(79,140,255,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ background: color, height: '100%', width: `${(value / max) * 100}%`, transition: 'width 0.3s' }} />
    </div>
  </div>
);

// Sortable Table Header
const SortHeader = ({ label, field, sortField, sortDir, onSort, style = {} }) => (
  <th
    onClick={() => onSort(field)}
    style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
  >
    {label} {sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
  </th>
);

// Search/Filter Bar
const FilterBar = ({ search, setSearch, filters = [], children }) => (
  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
    <input
      type="text"
      placeholder="Search HS4, commodity..."
      value={search}
      onChange={e => setSearch(e.target.value)}
      style={{ padding: '10px 16px', background: 'rgba(79,140,255,0.05)', border: '1px solid rgba(79,140,255,0.2)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', minWidth: '250px', outline: 'none' }}
    />
    {children}
    {filters.map(f => (
      <select
        key={f.label}
        value={f.value}
        onChange={e => f.onChange(e.target.value)}
        style={{ padding: '10px 12px', background: '#111827', border: '1px solid rgba(79,140,255,0.2)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', outline: 'none' }}
      >
        <option value="">{f.label}</option>
        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ))}
  </div>
);

// Sort helper
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
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r => Object.values(r).some(v => v != null && String(v).toLowerCase().includes(s)));
    }
    filtered.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return filtered;
  }, [data, sortField, sortDir, search]);

  return { sorted, sortField, sortDir, onSort, search, setSearch };
}

const thStyle = { padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600', fontSize: '12px', background: '#0b0f19', position: 'sticky', top: 0, zIndex: 1 };
const tdStyle = { padding: '10px 12px', color: '#94a3b8', fontSize: '13px', borderBottom: '1px solid rgba(148,163,184,0.05)' };
const tableContainer = { background: '#111827', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '12px', overflow: 'hidden' };

export default function ElectronicsResearch() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCode, setSelectedCode] = useState(null);
  const [codes, setCodes] = useState([]);
  const [regulatory, setRegulatory] = useState([]);
  const [supply, setSupply] = useState([]);
  const [demand, setDemand] = useState([]);
  const [scoring, setScoring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [codesRes, regRes, supRes, demRes, scorRes] = await Promise.all([
          supabase.from('research_codes').select('*').order('drill_score', { ascending: false }),
          supabase.from('phase2b_regulatory').select('*'),
          supabase.from('phase2_alibaba_summary').select('*'),
          supabase.from('phase3_indiamart_summary').select('*'),
          supabase.from('phase5_scoring').select('*'),
        ]);
        setCodes(codesRes.data || []);
        setRegulatory(regRes.data || []);
        setSupply(supRes.data || []);
        setDemand(demRes.data || []);
        setScoring(scorRes.data || []);
      } catch (err) { console.error('Fetch error:', err); }
      finally { setLoading(false); }
    };
    fetchData();
    const sub = supabase.channel('electronics_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'research_codes' }, () => fetchData())
      .subscribe();
    return () => sub.unsubscribe();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const byPhase = {}, byQA = { PASS: 0, FAILED: 0, PENDING: 0 }, byModel = { REGULAR: 0, SPOT: 0, BROKER: 0, MIXED: 0, UNASSIGNED: 0 };
    let totalValM = 0, completedCodes = 0;
    codes.forEach(c => {
      const phase = c.current_phase || 'phase1_complete';
      byPhase[phase] = (byPhase[phase] || 0) + 1;
      if (c.qa_status === 'PASS') { byQA.PASS++; completedCodes++; }
      else if (c.qa_status === 'FAILED') byQA.FAILED++;
      else byQA.PENDING++;
      if (c.trading_model) byModel[c.trading_model]++; else byModel.UNASSIGNED++;
      totalValM += c.val_m || 0;
    });
    return { byPhase, byQA, byModel, totalValM, completedCodes };
  }, [codes]);

  // Merged data for All Codes tab
  const mergedCodes = useMemo(() => {
    const regMap = Object.fromEntries(regulatory.map(r => [r.hs4, r]));
    const supMap = Object.fromEntries(supply.map(s => [s.hs4, s]));
    const demMap = Object.fromEntries(demand.map(d => [d.hs4, d]));
    const scorMap = Object.fromEntries(scoring.map(s => [s.hs4, s]));
    return codes.map(c => ({
      ...c,
      total_duty_pct: regMap[c.hs4]?.total_duty_pct,
      regulatory_risk: regMap[c.hs4]?.regulatory_risk_score,
      total_suppliers: supMap[c.hs4]?.total_suppliers,
      fob_low: supMap[c.hs4]?.fob_lowest_usd,
      fob_high: supMap[c.hs4]?.fob_highest_usd,
      gold_pct: supMap[c.hs4]?.gold_supplier_pct,
      total_sellers: demMap[c.hs4]?.total_sellers,
      margin_pct: demMap[c.hs4]?.gross_margin_pct,
      price_low_inr: demMap[c.hs4]?.price_low_inr,
      price_high_inr: demMap[c.hs4]?.price_high_inr,
      total_score: scorMap[c.hs4]?.total_score,
      verdict_score: scorMap[c.hs4]?.verdict,
    }));
  }, [codes, regulatory, supply, demand, scoring]);

  // Code Detail View
  const detail = useMemo(() => {
    if (!selectedCode) return null;
    return {
      code: codes.find(c => c.hs4 === selectedCode),
      reg: regulatory.find(r => r.hs4 === selectedCode),
      sup: supply.find(s => s.hs4 === selectedCode),
      dem: demand.find(d => d.hs4 === selectedCode),
      scor: scoring.find(s => s.hs4 === selectedCode),
    };
  }, [selectedCode, codes, regulatory, supply, demand, scoring]);

  if (detail && detail.code) {
    const { code, reg, sup, dem, scor } = detail;
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
        <button onClick={() => setSelectedCode(null)} style={{ padding: '8px 16px', background: 'rgba(79,140,255,0.1)', color: '#4f8cff', border: '1px solid rgba(79,140,255,0.3)', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' }}>
          ← Back to List
        </button>

        {/* Header Card */}
        <div style={{ background: '#111827', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ margin: '0 0 8px 0', color: '#e2e8f0', fontSize: '32px' }}>HS {code.hs4}</h1>
              <p style={{ margin: '0', color: '#94a3b8', fontSize: '14px', maxWidth: '600px' }}>{code.commodity}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Badge label={code.qa_status || 'PENDING'} color={code.qa_status === 'PASS' ? 'pass' : code.qa_status === 'FAILED' ? 'drop' : 'maybe'} />
              {code.trading_model && <Badge label={code.trading_model} color={code.trading_model === 'REGULAR' ? 'pass' : code.trading_model === 'MIXED' ? 'blue' : 'maybe'} />}
              {scor && <Badge label={`${scor.total_score}/150 ${scor.verdict}`} color={scor.total_score >= 120 ? 'pass' : scor.total_score >= 90 ? 'blue' : 'maybe'} />}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Trade Value', val: `$${code.val_m?.toFixed(1) || 0}M` },
              { label: 'Drill Score', val: code.drill_score?.toFixed(0) || 'N/A' },
              { label: 'HS8 Count', val: code.hs8_count || 'N/A' },
              { label: 'Entry Tier', val: code.entry_tier || 'N/A' },
              { label: 'BCD Rate', val: code.bcd_rate ? `${code.bcd_rate}%` : 'N/A' },
              { label: 'Phase', val: PHASE_LABELS[code.current_phase] || code.current_phase || 'N/A' },
            ].map(item => (
              <div key={item.label} style={{ padding: '12px', background: 'rgba(79,140,255,0.08)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e2e8f0', marginTop: '4px' }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Regulatory Section */}
        {reg && (
          <Section title="Phase 2b: Regulatory Analysis" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: 'rgba(52,211,153,0.1)', borderRadius: '8px', border: '1px solid rgba(52,211,153,0.2)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>BCD %</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{reg.bcd_pct?.toFixed(1) || 'N/A'}%</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(79,140,255,0.1)', borderRadius: '8px', border: '1px solid rgba(79,140,255,0.2)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>IGST %</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4f8cff' }}>{reg.igst_pct?.toFixed(1) || 'N/A'}%</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(251,191,36,0.1)', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Duty %</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>{reg.total_duty_pct?.toFixed(2) || 'N/A'}%</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(167,139,250,0.1)', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Risk Level</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: reg.regulatory_risk_score === 'HIGH' ? '#f87171' : reg.regulatory_risk_score === 'MEDIUM' ? '#fbbf24' : '#34d399' }}>{reg.regulatory_risk_score || 'N/A'}</div>
              </div>
              {reg.total_compliance_cost_inr > 0 && (
                <div style={{ padding: '12px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Compliance Cost</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f87171' }}>₹{(reg.total_compliance_cost_inr || 0).toLocaleString()}</div>
                </div>
              )}
              {reg.fta_duty_reduction_pct > 0 && (
                <div style={{ padding: '12px', background: 'rgba(52,211,153,0.1)', borderRadius: '8px', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>FTA Savings</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{reg.fta_duty_reduction_pct}%</div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Anti-Dumping', check: reg.check_anti_dumping, val: reg.add_rate_pct, unit: '%', notes: reg.add_notes },
                { label: 'Safeguard', check: reg.check_safeguard, val: reg.safeguard_pct, unit: '%', notes: reg.safeguard_notes },
                { label: 'AIDC', check: reg.check_aidc, val: reg.aidc_pct, unit: '%' },
                { label: 'DGFT Restriction', check: reg.check_dgft_restriction, notes: reg.dgft_notes },
                { label: 'ADD Investigation', check: reg.check_add_investigation, notes: reg.add_investigation_notes },
                { label: 'WPC Cert', check: reg.check_wpc, val: reg.wpc_cost_inr, unit: ' INR', extra: reg.wpc_weeks ? `${reg.wpc_weeks} wks` : null },
                { label: 'TEC Cert', check: reg.check_tec, val: reg.tec_cost_inr, unit: ' INR', extra: reg.tec_weeks ? `${reg.tec_weeks} wks` : null },
                { label: 'BIS QCO', check: reg.check_bis_qco, val: reg.bis_cost_inr, unit: ' INR', extra: reg.bis_weeks ? `${reg.bis_weeks} wks` : null },
                { label: 'PMP Impact', check: reg.check_pmp, notes: reg.pmp_notes },
                { label: 'Input ADD', check: reg.check_input_add, notes: reg.input_add_notes },
                { label: 'EPR E-Waste', check: reg.check_epr, val: reg.epr_cost_inr, unit: ' INR' },
                { label: 'FTA Benefit', check: reg.check_fta, val: reg.fta_duty_reduction_pct, unit: '%', notes: reg.fta_benefit_notes },
              ].map(item => (
                <div key={item.label} style={{ padding: '10px', background: item.check ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.03)', border: `1px solid rgba(${item.check ? '34,197,94' : '148,163,184'}, 0.15)`, borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', color: item.check ? '#22c55e' : '#64748b' }}>{item.check ? '✓ Applies' : '○ N/A'}</div>
                  {item.val != null && item.val > 0 && <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: '600', marginTop: '2px' }}>{item.val}{item.unit}</div>}
                  {item.extra && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{item.extra}</div>}
                  {item.notes && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{item.notes}</div>}
                </div>
              ))}
            </div>

            {(reg.data_sources_used || reg.importduty_url || reg.dgtr_url) && (
              <div style={{ fontSize: '12px', color: '#94a3b8', padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}>
                <strong style={{ color: '#e2e8f0' }}>Data Sources:</strong> {reg.data_sources_used || 'N/A'} ({reg.source_count || 0} sources verified)
                {reg.importduty_verified && <span style={{ color: '#34d399' }}> | ImportDuty.in ✓</span>}
                {reg.icegate_verified && <span style={{ color: '#34d399' }}> | ICEGATE ✓</span>}
                {reg.dgtr_verified && <span style={{ color: '#34d399' }}> | DGTR ✓</span>}
                {reg.bis_verified && <span style={{ color: '#34d399' }}> | BIS ✓</span>}
                {reg.dgft_verified && <span style={{ color: '#34d399' }}> | DGFT ✓</span>}
              </div>
            )}
          </Section>
        )}

        {/* Supply Section */}
        {sup && (
          <Section title="Phase 2: Supply Analysis (Alibaba + Sources)" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Total Suppliers', val: sup.total_suppliers || 0, color: '#4f8cff' },
                { label: 'Verified/Gold %', val: `${(sup.gold_supplier_pct || 0).toFixed(1)}%`, color: '#34d399' },
                { label: 'FOB Low', val: `$${(sup.fob_lowest_usd || 0).toFixed(2)}`, color: '#fbbf24' },
                { label: 'FOB High', val: `$${(sup.fob_highest_usd || 0).toFixed(2)}`, color: '#f97316' },
                { label: 'FOB Typical', val: sup.fob_typical_usd ? `$${sup.fob_typical_usd.toFixed(2)}` : 'N/A', color: '#06b6d4' },
                { label: 'Keywords Searched', val: sup.keywords_searched || 0, color: '#a78bfa' },
              ].map(item => (
                <div key={item.label} style={{ padding: '12px', background: `${item.color}15`, borderRadius: '8px', border: `1px solid ${item.color}30` }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: item.color, marginTop: '4px' }}>{item.val}</div>
                </div>
              ))}
            </div>

            {sup.typical_moq && <div style={{ padding: '10px 12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#e2e8f0' }}><strong>MOQ:</strong> {sup.typical_moq}</div>}
            {sup.top_suppliers && <div style={{ padding: '10px 12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px', marginBottom: '12px' }}><div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '6px' }}>Top Suppliers</div><div style={{ fontSize: '13px', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{sup.top_suppliers}</div></div>}

            {/* Multi-source details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              {sup.mic_supplier_count > 0 && (
                <div style={{ padding: '12px', background: 'rgba(6,182,212,0.08)', borderRadius: '8px', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#06b6d4', marginBottom: '6px' }}>Made-in-China</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>Suppliers: {sup.mic_supplier_count} | FOB: ${sup.mic_fob_low_usd?.toFixed(2)} - ${sup.mic_fob_high_usd?.toFixed(2)}</div>
                </div>
              )}
              {sup.dhgate_supplier_count > 0 && (
                <div style={{ padding: '12px', background: 'rgba(167,139,250,0.08)', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#a78bfa', marginBottom: '6px' }}>DHgate</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>Suppliers: {sup.dhgate_supplier_count} | FOB: ${sup.dhgate_fob_low_usd?.toFixed(2)} - ${sup.dhgate_fob_high_usd?.toFixed(2)}</div>
                </div>
              )}
              {sup.ali1688_factory_count > 0 && (
                <div style={{ padding: '12px', background: 'rgba(251,191,36,0.08)', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#fbbf24', marginBottom: '6px' }}>1688.com</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>Factories: {sup.ali1688_factory_count} | Price: ¥{sup.ali1688_price_low_cny?.toFixed(2)} - ¥{sup.ali1688_price_high_cny?.toFixed(2)}</div>
                </div>
              )}
            </div>

            {sup.data_sources_used && <div style={{ fontSize: '12px', color: '#94a3b8', padding: '10px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}><strong style={{ color: '#e2e8f0' }}>Sources:</strong> {sup.data_sources_used} ({sup.source_count || 0} sources)</div>}
          </Section>
        )}

        {/* Demand Section */}
        {dem && (
          <Section title="Phase 3: Demand Analysis (IndiaMART + Sources)" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Total Sellers', val: dem.total_sellers || 0, color: '#4f8cff' },
                { label: 'Manufacturer %', val: `${(dem.manufacturer_pct || 0).toFixed(1)}%`, color: '#34d399' },
                { label: 'Trader %', val: `${(dem.trader_pct || 0).toFixed(1)}%`, color: '#fbbf24' },
                { label: 'Gross Margin', val: `${(dem.gross_margin_pct || 0).toFixed(1)}%`, color: dem.gross_margin_pct > 20 ? '#34d399' : dem.gross_margin_pct > 10 ? '#fbbf24' : '#f87171' },
                { label: 'Demand Score', val: (dem.demand_score || 0).toFixed(1), color: '#a78bfa' },
                { label: 'Keywords', val: dem.keywords_searched || 0, color: '#06b6d4' },
              ].map(item => (
                <div key={item.label} style={{ padding: '12px', background: `${item.color}15`, borderRadius: '8px', border: `1px solid ${item.color}30` }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: item.color, marginTop: '4px' }}>{item.val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>India Price Range (INR)</div>
                <div style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: '600', marginTop: '4px' }}>₹{(dem.price_low_inr || 0).toLocaleString()} - ₹{(dem.price_high_inr || 0).toLocaleString()}</div>
              </div>
              {dem.landed_cost_inr > 0 && (
                <div style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Landed Cost (INR)</div>
                  <div style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: '600', marginTop: '4px' }}>₹{(dem.landed_cost_inr || 0).toLocaleString()}</div>
                </div>
              )}
              {dem.sell_price_inr > 0 && (
                <div style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Sell Price (INR)</div>
                  <div style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: '600', marginTop: '4px' }}>₹{(dem.sell_price_inr || 0).toLocaleString()}</div>
                </div>
              )}
              {dem.gross_margin_inr > 0 && (
                <div style={{ padding: '12px', background: 'rgba(52,211,153,0.08)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Gross Margin (INR)</div>
                  <div style={{ fontSize: '15px', color: '#34d399', fontWeight: '600', marginTop: '4px' }}>₹{(dem.gross_margin_inr || 0).toLocaleString()}</div>
                </div>
              )}
            </div>

            {dem.top_cities && <div style={{ padding: '10px 12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px', marginBottom: '12px' }}><div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '6px' }}>Top Cities</div><div style={{ fontSize: '13px', color: '#94a3b8' }}>{dem.top_cities}</div></div>}

            {dem.tradeindia_seller_count > 0 && (
              <div style={{ padding: '12px', background: 'rgba(6,182,212,0.08)', borderRadius: '8px', border: '1px solid rgba(6,182,212,0.2)', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#06b6d4', marginBottom: '6px' }}>TradeIndia</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>Sellers: {dem.tradeindia_seller_count} | Price: ₹{dem.tradeindia_price_low_inr?.toLocaleString()} - ₹{dem.tradeindia_price_high_inr?.toLocaleString()}</div>
              </div>
            )}

            {dem.google_trends_direction && <div style={{ padding: '10px 12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#e2e8f0' }}><strong>Google Trends:</strong> {dem.google_trends_direction} {dem.google_trends_interest ? `(Interest: ${dem.google_trends_interest})` : ''}</div>}

            {dem.data_sources_used && <div style={{ fontSize: '12px', color: '#94a3b8', padding: '10px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}><strong style={{ color: '#e2e8f0' }}>Sources:</strong> {dem.data_sources_used} ({dem.source_count || 0} sources)</div>}
          </Section>
        )}

        {/* Phase 5 Scoring */}
        {scor && (
          <Section title={`Phase 5: Viability Score — ${scor.total_score}/150 ${scor.verdict}`} defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ padding: '20px', background: `rgba(79,140,255,0.1)`, borderRadius: '12px', border: '1px solid rgba(79,140,255,0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: scor.total_score >= 120 ? '#34d399' : scor.total_score >= 90 ? '#4f8cff' : '#fbbf24' }}>{scor.total_score}</div>
                <div style={{ fontSize: '16px', color: '#94a3b8' }}>/ 150</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginTop: '8px' }}>{scor.verdict}</div>
              </div>
              <div>
                {[
                  { label: 'Gross Margin', val: scor.gross_margin_score, max: 25 },
                  { label: 'Buyer Access', val: scor.buyer_accessibility_score, max: 20 },
                  { label: 'Supply Reliability', val: scor.supply_reliability_score, max: 15 },
                  { label: 'Market Size', val: scor.market_size_score, max: 15 },
                  { label: 'Regulatory Risk', val: scor.regulatory_score, max: 15 },
                  { label: 'Competition', val: scor.competition_score, max: 10 },
                  { label: 'Growth Trend', val: scor.growth_score, max: 10 },
                  { label: 'Working Capital', val: scor.working_capital_score, max: 10 },
                  { label: 'Logistics', val: scor.logistics_score, max: 10 },
                  { label: 'Obsolescence', val: scor.obsolescence_score, max: 10 },
                  { label: 'Capital Required', val: scor.capital_score, max: 5 },
                  { label: 'FTA Opportunity', val: scor.fta_score, max: 5 },
                ].map(f => <ProgressBar key={f.label} label={`${f.label} (${f.val || 0}/${f.max})`} value={f.val || 0} max={f.max} color={f.val >= f.max * 0.7 ? '#34d399' : f.val >= f.max * 0.4 ? '#4f8cff' : '#f87171'} />)}
              </div>
            </div>
          </Section>
        )}

        {/* QA Warnings & Trading Model */}
        {(code.qa_warnings || code.trading_model_reason) && (
          <Section title="QA Assessment & Trading Model" defaultOpen={true}>
            {code.trading_model && (
              <div style={{ padding: '12px', background: `${MODEL_COLORS[code.trading_model]}15`, borderRadius: '8px', border: `1px solid ${MODEL_COLORS[code.trading_model]}30`, marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: MODEL_COLORS[code.trading_model] }}>Trading Model: {code.trading_model}</div>
                {code.trading_model_reason && <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>{code.trading_model_reason}</div>}
              </div>
            )}
            {code.qa_warnings && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {code.qa_warnings.split(',').map((w, i) => <Badge key={i} label={w.trim()} color="maybe" />)}
              </div>
            )}
          </Section>
        )}
      </div>
    );
  }

  // === MAIN TAB VIEWS ===
  const tabs = ['overview', 'regulatory', 'supply_demand', 'scoring', 'all_codes'];

  // Regulatory sort/filter
  const regSF = useSortFilter(regulatory, 'total_duty_pct', 'desc');
  const [regRiskFilter, setRegRiskFilter] = useState('');
  const regFiltered = useMemo(() => {
    let d = regSF.sorted;
    if (regRiskFilter) d = d.filter(r => r.regulatory_risk_score === regRiskFilter);
    return d;
  }, [regSF.sorted, regRiskFilter]);

  // All codes sort/filter
  const allSF = useSortFilter(mergedCodes, 'drill_score', 'desc');
  const [qaFilter, setQaFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const allFiltered = useMemo(() => {
    let d = allSF.sorted;
    if (qaFilter) d = d.filter(c => (c.qa_status || 'PENDING') === qaFilter);
    if (modelFilter) d = d.filter(c => (c.trading_model || 'UNASSIGNED') === modelFilter);
    if (phaseFilter) d = d.filter(c => (c.current_phase || '') === phaseFilter);
    return d;
  }, [allSF.sorted, qaFilter, modelFilter, phaseFilter]);

  // Supply+demand merge
  const supplyDemand = useMemo(() => {
    const demMap = Object.fromEntries(demand.map(d => [d.hs4, d]));
    return supply.map(s => ({ ...s, ...(demMap[s.hs4] ? { sellers: demMap[s.hs4].total_sellers, margin: demMap[s.hs4].gross_margin_pct, price_low: demMap[s.hs4].price_low_inr, price_high: demMap[s.hs4].price_high_inr, mfr_pct: demMap[s.hs4].manufacturer_pct, demand_score: demMap[s.hs4].demand_score } : {}) }));
  }, [supply, demand]);
  const sdSF = useSortFilter(supplyDemand, 'total_suppliers', 'desc');

  // Scoring sort
  const scorSF = useSortFilter(scoring, 'total_score', 'desc');

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#e2e8f0' }}>Electronics Research Pipeline</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '8px' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }} style={{ padding: '10px 16px', background: activeTab === tab ? 'rgba(79,140,255,0.2)' : 'rgba(79,140,255,0.05)', color: activeTab === tab ? '#4f8cff' : '#94a3b8', border: `1px solid rgba(79,140,255,${activeTab === tab ? '0.3' : '0.1'})`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
            {tab.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading...</div> :

      /* ===== OVERVIEW ===== */
      activeTab === 'overview' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <KPI label="Total Codes" value={codes.length} variant="blue" icon="📊" />
            <KPI label="QA PASS" value={stats.byQA.PASS} variant="pass" icon="✓" />
            <KPI label="QA FAILED" value={stats.byQA.FAILED} variant="drop" icon="✗" />
            <KPI label="QA PENDING" value={stats.byQA.PENDING} variant="maybe" icon="⏳" />
            <KPI label="With Scoring" value={scoring.length} variant="blue" icon="🏆" />
            <KPI label="Supply Data" value={supply.length} variant="pass" icon="🏭" />
            <KPI label="Demand Data" value={demand.length} variant="blue" icon="📈" />
            <KPI label="Total Trade $M" value={`$${stats.totalValM.toFixed(0)}M`} variant="maybe" icon="💰" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div style={{ ...tableContainer, padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#e2e8f0', fontSize: '16px' }}>Trading Models</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={Object.entries(stats.byModel).filter(([,v]) => v > 0).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {Object.entries(stats.byModel).filter(([,v]) => v > 0).map(([k], i) => <Cell key={i} fill={MODEL_COLORS[k] || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...tableContainer, padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#e2e8f0', fontSize: '16px' }}>Phase Progress</h3>
              {Object.entries(stats.byPhase).sort((a, b) => {
                const order = ['phase5_done', 'phase5_pending', 'phase4_done', 'phase4_pending', 'qa_pass', 'qa_pending', 'phase3_done', 'phase2b_done', 'phase2_done', 'phase1_complete'];
                return order.indexOf(a[0]) - order.indexOf(b[0]);
              }).map(([phase, count]) => (
                <div key={phase} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                    <span style={{ color: '#e2e8f0' }}>{PHASE_LABELS[phase] || phase}</span>
                    <span style={{ color: '#94a3b8' }}>{count}</span>
                  </div>
                  <div style={{ background: 'rgba(79,140,255,0.1)', height: '6px', borderRadius: '3px' }}>
                    <div style={{ background: '#4f8cff', height: '100%', width: `${(count / (codes.length || 1)) * 100}%`, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top scored codes */}
          {scoring.length > 0 && (
            <div style={{ ...tableContainer, padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#e2e8f0', fontSize: '16px' }}>Top Scored Codes</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, scoring.length * 50)}>
                <BarChart data={[...scoring].sort((a, b) => b.total_score - a.total_score)} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis type="number" domain={[0, 150]} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="hs4" stroke="#94a3b8" width={50} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#e2e8f0' }} />
                  <Bar dataKey="total_score" fill="#4f8cff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) :

      /* ===== REGULATORY ===== */
      activeTab === 'regulatory' ? (
        <div>
          <FilterBar search={regSF.search} setSearch={regSF.setSearch} filters={[{ label: 'Risk Level', value: regRiskFilter, onChange: setRegRiskFilter, options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }]}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{regFiltered.length} of {regulatory.length} codes</span>
          </FilterBar>
          <div style={{ ...tableContainer }}>
            <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0b0f19' }}>
                    <SortHeader label="HS4" field="hs4" {...regSF} />
                    <SortHeader label="BCD %" field="bcd_pct" {...regSF} />
                    <SortHeader label="IGST %" field="igst_pct" {...regSF} />
                    <SortHeader label="SWS %" field="sws_pct" {...regSF} />
                    <SortHeader label="Total Duty %" field="total_duty_pct" {...regSF} />
                    <SortHeader label="Risk" field="regulatory_risk_score" {...regSF} />
                    <th style={thStyle}>ADD</th>
                    <th style={thStyle}>DGFT</th>
                    <th style={thStyle}>BIS</th>
                    <th style={thStyle}>WPC</th>
                    <th style={thStyle}>TEC</th>
                    <th style={thStyle}>FTA</th>
                    <SortHeader label="Compliance ₹" field="total_compliance_cost_inr" {...regSF} />
                    <SortHeader label="Sources" field="source_count" {...regSF} />
                  </tr>
                </thead>
                <tbody>
                  {regFiltered.map(r => {
                    const dutyColor = (r.total_duty_pct || 0) < 30 ? '#34d399' : (r.total_duty_pct || 0) < 40 ? '#fbbf24' : '#f87171';
                    const riskColor = r.regulatory_risk_score === 'HIGH' ? '#f87171' : r.regulatory_risk_score === 'CRITICAL' ? '#ef4444' : r.regulatory_risk_score === 'MEDIUM' ? '#fbbf24' : '#34d399';
                    return (
                      <tr key={r.hs4} onClick={() => setSelectedCode(r.hs4)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(148,163,184,0.05)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...tdStyle, color: '#e2e8f0', fontWeight: '600' }}>{r.hs4}</td>
                        <td style={tdStyle}>{r.bcd_pct?.toFixed(1) || '—'}</td>
                        <td style={tdStyle}>{r.igst_pct?.toFixed(1) || '—'}</td>
                        <td style={tdStyle}>{r.sws_pct?.toFixed(1) || '—'}</td>
                        <td style={{ ...tdStyle, color: dutyColor, fontWeight: '600' }}>{r.total_duty_pct?.toFixed(2) || '—'}%</td>
                        <td style={{ ...tdStyle, color: riskColor, fontWeight: '600' }}>{r.regulatory_risk_score || '—'}</td>
                        <td style={tdStyle}>{r.check_anti_dumping ? <span style={{ color: '#f87171' }}>⚠ {r.add_rate_pct || ''}%</span> : '—'}</td>
                        <td style={tdStyle}>{r.check_dgft_restriction ? <span style={{ color: '#f87171' }}>⚠</span> : '✓'}</td>
                        <td style={tdStyle}>{r.check_bis_qco ? <span style={{ color: '#fbbf24' }}>Req</span> : '—'}</td>
                        <td style={tdStyle}>{r.check_wpc ? <span style={{ color: '#fbbf24' }}>Req</span> : '—'}</td>
                        <td style={tdStyle}>{r.check_tec ? <span style={{ color: '#fbbf24' }}>Req</span> : '—'}</td>
                        <td style={tdStyle}>{r.check_fta ? <span style={{ color: '#34d399' }}>{r.fta_duty_reduction_pct || ''}%↓</span> : '—'}</td>
                        <td style={tdStyle}>{r.total_compliance_cost_inr ? `₹${(r.total_compliance_cost_inr / 1000).toFixed(0)}K` : '—'}</td>
                        <td style={tdStyle}>{r.source_count || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) :

      /* ===== SUPPLY DEMAND ===== */
      activeTab === 'supply_demand' ? (
        <div>
          <FilterBar search={sdSF.search} setSearch={sdSF.setSearch}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{sdSF.sorted.length} codes with supply data</span>
          </FilterBar>
          <div style={{ ...tableContainer }}>
            <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0b0f19' }}>
                    <SortHeader label="HS4" field="hs4" {...sdSF} />
                    <SortHeader label="Suppliers" field="total_suppliers" {...sdSF} />
                    <SortHeader label="Gold %" field="gold_supplier_pct" {...sdSF} />
                    <SortHeader label="FOB Low $" field="fob_lowest_usd" {...sdSF} />
                    <SortHeader label="FOB High $" field="fob_highest_usd" {...sdSF} />
                    <th style={thStyle}>MOQ</th>
                    <SortHeader label="Sellers" field="sellers" {...sdSF} />
                    <SortHeader label="Mfr %" field="mfr_pct" {...sdSF} />
                    <SortHeader label="Price Low ₹" field="price_low" {...sdSF} />
                    <SortHeader label="Price High ₹" field="price_high" {...sdSF} />
                    <SortHeader label="Margin %" field="margin" {...sdSF} />
                    <SortHeader label="Demand Score" field="demand_score" {...sdSF} />
                    <th style={thStyle}>Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {sdSF.sorted.map(r => {
                    const m = r.margin || 0;
                    const mColor = m > 20 ? '#34d399' : m > 10 ? '#fbbf24' : '#f87171';
                    return (
                      <tr key={r.hs4} onClick={() => setSelectedCode(r.hs4)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(148,163,184,0.05)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...tdStyle, color: '#e2e8f0', fontWeight: '600' }}>{r.hs4}</td>
                        <td style={{ ...tdStyle, color: '#4f8cff', fontWeight: '600' }}>{r.total_suppliers || 0}</td>
                        <td style={tdStyle}>{r.gold_supplier_pct?.toFixed(1) || '—'}%</td>
                        <td style={tdStyle}>${r.fob_lowest_usd?.toFixed(2) || '—'}</td>
                        <td style={tdStyle}>${r.fob_highest_usd?.toFixed(2) || '—'}</td>
                        <td style={tdStyle}>{r.typical_moq || '—'}</td>
                        <td style={{ ...tdStyle, color: '#4f8cff', fontWeight: '600' }}>{r.sellers || '—'}</td>
                        <td style={tdStyle}>{r.mfr_pct?.toFixed(0) || '—'}%</td>
                        <td style={tdStyle}>{r.price_low ? `₹${r.price_low.toLocaleString()}` : '—'}</td>
                        <td style={tdStyle}>{r.price_high ? `₹${r.price_high.toLocaleString()}` : '—'}</td>
                        <td style={{ ...tdStyle, color: mColor, fontWeight: '700', fontSize: '14px' }}>{m.toFixed(1)}%</td>
                        <td style={tdStyle}>{r.demand_score?.toFixed(1) || '—'}</td>
                        <td style={tdStyle}>{r.source_count || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) :

      /* ===== SCORING ===== */
      activeTab === 'scoring' ? (
        <div>
          <FilterBar search={scorSF.search} setSearch={scorSF.setSearch}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{scorSF.sorted.length} codes scored</span>
          </FilterBar>
          {scorSF.sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No scoring data yet. Codes need to pass QA gate first.</div>
          ) : (
            <div style={{ ...tableContainer }}>
              <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#0b0f19' }}>
                      <SortHeader label="HS4" field="hs4" {...scorSF} />
                      <SortHeader label="Total" field="total_score" {...scorSF} />
                      <SortHeader label="Verdict" field="verdict" {...scorSF} />
                      <SortHeader label="Margin" field="gross_margin_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Buyers" field="buyer_accessibility_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Supply" field="supply_reliability_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Market" field="market_size_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Reg Risk" field="regulatory_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Comp" field="competition_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Growth" field="growth_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="WC" field="working_capital_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Logis" field="logistics_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Obsol" field="obsolescence_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="Cap" field="capital_score" {...scorSF} style={{ fontSize: '11px' }} />
                      <SortHeader label="FTA" field="fta_score" {...scorSF} style={{ fontSize: '11px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {scorSF.sorted.map(s => {
                      const scoreColor = s.total_score >= 120 ? '#34d399' : s.total_score >= 90 ? '#4f8cff' : s.total_score >= 60 ? '#fbbf24' : '#f87171';
                      const cellColor = (val, max) => (val || 0) >= max * 0.7 ? '#34d399' : (val || 0) >= max * 0.4 ? '#94a3b8' : '#f87171';
                      return (
                        <tr key={s.hs4} onClick={() => setSelectedCode(s.hs4)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(148,163,184,0.05)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ ...tdStyle, color: '#e2e8f0', fontWeight: '600' }}>{s.hs4}</td>
                          <td style={{ ...tdStyle, color: scoreColor, fontWeight: '700', fontSize: '16px' }}>{s.total_score}/150</td>
                          <td style={tdStyle}><Badge label={s.verdict} color={s.verdict === 'PURSUE' ? 'pass' : s.verdict === 'STRONG' ? 'blue' : 'maybe'} /></td>
                          <td style={{ ...tdStyle, color: cellColor(s.gross_margin_score, 25) }}>{s.gross_margin_score || 0}/25</td>
                          <td style={{ ...tdStyle, color: cellColor(s.buyer_accessibility_score, 20) }}>{s.buyer_accessibility_score || 0}/20</td>
                          <td style={{ ...tdStyle, color: cellColor(s.supply_reliability_score, 15) }}>{s.supply_reliability_score || 0}/15</td>
                          <td style={{ ...tdStyle, color: cellColor(s.market_size_score, 15) }}>{s.market_size_score || 0}/15</td>
                          <td style={{ ...tdStyle, color: cellColor(s.regulatory_score, 15) }}>{s.regulatory_score || 0}/15</td>
                          <td style={{ ...tdStyle, color: cellColor(s.competition_score, 10) }}>{s.competition_score || 0}/10</td>
                          <td style={{ ...tdStyle, color: cellColor(s.growth_score, 10) }}>{s.growth_score || 0}/10</td>
                          <td style={{ ...tdStyle, color: cellColor(s.working_capital_score, 10) }}>{s.working_capital_score || 0}/10</td>
                          <td style={{ ...tdStyle, color: cellColor(s.logistics_score, 10) }}>{s.logistics_score || 0}/10</td>
                          <td style={{ ...tdStyle, color: cellColor(s.obsolescence_score, 10) }}>{s.obsolescence_score || 0}/10</td>
                          <td style={{ ...tdStyle, color: cellColor(s.capital_score, 5) }}>{s.capital_score || 0}/5</td>
                          <td style={{ ...tdStyle, color: cellColor(s.fta_score, 5) }}>{s.fta_score || 0}/5</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) :

      /* ===== ALL CODES ===== */
      activeTab === 'all_codes' ? (
        <div>
          <FilterBar search={allSF.search} setSearch={allSF.setSearch} filters={[
            { label: 'QA Status', value: qaFilter, onChange: setQaFilter, options: ['PASS', 'FAILED', 'PENDING'] },
            { label: 'Trading Model', value: modelFilter, onChange: setModelFilter, options: ['REGULAR', 'SPOT', 'BROKER', 'MIXED', 'UNASSIGNED'] },
          ]}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{allFiltered.length} of {codes.length} codes</span>
          </FilterBar>
          <div style={{ ...tableContainer }}>
            <div style={{ overflowX: 'auto', maxHeight: '650px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#0b0f19' }}>
                    <SortHeader label="HS4" field="hs4" {...allSF} />
                    <th style={{ ...thStyle, minWidth: '200px' }}>Commodity</th>
                    <SortHeader label="Val $M" field="val_m" {...allSF} />
                    <SortHeader label="Score" field="drill_score" {...allSF} />
                    <th style={thStyle}>Phase</th>
                    <th style={thStyle}>QA</th>
                    <th style={thStyle}>Model</th>
                    <SortHeader label="Duty %" field="total_duty_pct" {...allSF} />
                    <th style={thStyle}>Risk</th>
                    <SortHeader label="Suppliers" field="total_suppliers" {...allSF} />
                    <SortHeader label="FOB $" field="fob_low" {...allSF} />
                    <SortHeader label="Sellers" field="total_sellers" {...allSF} />
                    <SortHeader label="Margin %" field="margin_pct" {...allSF} />
                    <SortHeader label="150pt" field="total_score" {...allSF} />
                  </tr>
                </thead>
                <tbody>
                  {allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(c => {
                    const mColor = (c.margin_pct || 0) > 20 ? '#34d399' : (c.margin_pct || 0) > 10 ? '#fbbf24' : c.margin_pct ? '#f87171' : '#64748b';
                    return (
                      <tr key={c.hs4} onClick={() => setSelectedCode(c.hs4)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(148,163,184,0.05)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...tdStyle, color: '#e2e8f0', fontWeight: '600' }}>{c.hs4}</td>
                        <td style={{ ...tdStyle, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.commodity}>{c.commodity}</td>
                        <td style={tdStyle}>${c.val_m?.toFixed(1) || '—'}</td>
                        <td style={{ ...tdStyle, color: '#4f8cff', fontWeight: '600' }}>{c.drill_score?.toFixed(0) || '—'}</td>
                        <td style={tdStyle}><span style={{ fontSize: '11px' }}>{PHASE_LABELS[c.current_phase] || c.current_phase || '—'}</span></td>
                        <td style={tdStyle}><Badge label={c.qa_status || 'PENDING'} color={c.qa_status === 'PASS' ? 'pass' : c.qa_status === 'FAILED' ? 'drop' : 'maybe'} /></td>
                        <td style={tdStyle}>{c.trading_model ? <span style={{ color: MODEL_COLORS[c.trading_model] || '#94a3b8', fontWeight: '600', fontSize: '11px' }}>{c.trading_model}</span> : '—'}</td>
                        <td style={tdStyle}>{c.total_duty_pct?.toFixed(1) || '—'}%</td>
                        <td style={{ ...tdStyle, color: c.regulatory_risk === 'HIGH' ? '#f87171' : c.regulatory_risk === 'MEDIUM' ? '#fbbf24' : '#34d399' }}>{c.regulatory_risk || '—'}</td>
                        <td style={tdStyle}>{c.total_suppliers || '—'}</td>
                        <td style={tdStyle}>{c.fob_low ? `$${c.fob_low.toFixed(2)}` : '—'}</td>
                        <td style={tdStyle}>{c.total_sellers || '—'}</td>
                        <td style={{ ...tdStyle, color: mColor, fontWeight: '600' }}>{c.margin_pct ? `${c.margin_pct.toFixed(1)}%` : '—'}</td>
                        <td style={{ ...tdStyle, color: '#4f8cff', fontWeight: '600' }}>{c.total_score ? `${c.total_score}/150` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Pagination */}
          {allFiltered.length > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', background: 'rgba(79,140,255,0.1)', color: page === 1 ? '#64748b' : '#4f8cff', border: '1px solid rgba(79,140,255,0.2)', borderRadius: '6px', cursor: page === 1 ? 'default' : 'pointer' }}>← Prev</button>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Page {page} of {Math.ceil(allFiltered.length / PAGE_SIZE)}</span>
              <button onClick={() => setPage(p => Math.min(Math.ceil(allFiltered.length / PAGE_SIZE), p + 1))} disabled={page >= Math.ceil(allFiltered.length / PAGE_SIZE)} style={{ padding: '8px 16px', background: 'rgba(79,140,255,0.1)', color: page >= Math.ceil(allFiltered.length / PAGE_SIZE) ? '#64748b' : '#4f8cff', border: '1px solid rgba(79,140,255,0.2)', borderRadius: '6px', cursor: page >= Math.ceil(allFiltered.length / PAGE_SIZE) ? 'default' : 'pointer' }}>Next →</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
