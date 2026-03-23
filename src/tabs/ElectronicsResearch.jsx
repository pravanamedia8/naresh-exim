import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  pass: '#34d399',
  maybe: '#fbbf24',
  watch: '#a78bfa',
  drop: '#f87171',
  blue: '#4f8cff',
  cyan: '#06b6d4',
  violet: '#a78bfa',
};

const RGB = {
  pass: 'rgba(52, 211, 153, 0.15)',
  maybe: 'rgba(251, 191, 36, 0.15)',
  watch: 'rgba(167, 139, 250, 0.15)',
  drop: 'rgba(248, 113, 113, 0.15)',
  blue: 'rgba(79, 140, 255, 0.15)',
};

const MODEL_COLORS = {
  REGULAR: '#34d399',
  SPOT: '#fbbf24',
  BROKER: '#a78bfa',
  MIXED: '#06b6d4',
};

const PHASE_LABELS = {
  phase1_complete: 'Phase 1: DB Screen',
  phase2_pending: 'Phase 2: Alibaba',
  phase2_done: 'Phase 2: Alibaba (Done)',
  phase2b_pending: 'Phase 2b: Regulatory',
  phase2b_done: 'Phase 2b: Regulatory (Done)',
  phase3_pending: 'Phase 3: IndiaMART',
  phase3_done: 'Phase 3: IndiaMART (Done)',
  qa_pending: 'QA Gate',
  qa_pass: 'QA Gate (Pass)',
  phase4_pending: 'Phase 4: Volza',
  phase4_done: 'Phase 4: Volza (Done)',
  phase5_pending: 'Phase 5: Scoring',
  phase5_done: 'Phase 5: Scoring (Done)',
};

const KPI = ({ label, value, variant = 'blue', icon = '' }) => (
  <div style={{
    background: RGB[variant] || RGB.blue,
    border: `1px solid rgba(${variant === 'pass' ? '52,211,153' : variant === 'maybe' ? '251,191,36' : '79,140,255'}, 0.3)`,
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    backdropFilter: 'blur(10px)',
  }}>
    <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>{icon} {label}</div>
    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e2e8f0' }}>{value}</div>
  </div>
);

const Badge = ({ label, color = 'blue' }) => (
  <span style={{
    background: RGB[color] || RGB.blue,
    color: COLORS[color] || COLORS.blue,
    border: `1px solid rgba(${color === 'pass' ? '52,211,153' : color === 'maybe' ? '251,191,36' : color === 'drop' ? '248,113,113' : '79,140,255'}, 0.3)`,
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  }}>
    {label}
  </span>
);

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '20px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.1)', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '16px',
          background: '#111827',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: open ? '1px solid rgba(148,163,184,0.1)' : 'none',
        }}
      >
        <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{title}</span>
        <span style={{ color: '#94a3b8' }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && <div style={{ padding: '16px', background: 'rgba(11, 15, 25, 0.5)' }}>{children}</div>}
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
      <div style={{ background: color, height: '100%', width: `${(value/max)*100}%`, transition: 'width 0.3s' }} />
    </div>
  </div>
);

export default function ElectronicsResearch() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCode, setSelectedCode] = useState(null);
  const [codes, setCodes] = useState([]);
  const [regulatory, setRegulatory] = useState([]);
  const [supply, setSupply] = useState([]);
  const [demand, setDemand] = useState([]);
  const [scoring, setScoring] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data
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
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const sub = supabase
      .channel('electronics_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'research_codes' }, () => fetchData())
      .subscribe();

    return () => sub.unsubscribe();
  }, []);

  // Summary stats
  const stats = useMemo(() => {
    const byPhase = {};
    const byQA = { 'PASS': 0, 'FAILED': 0, 'PENDING': 0 };
    const byModel = { REGULAR: 0, SPOT: 0, BROKER: 0, MIXED: 0, UNASSIGNED: 0 };

    codes.forEach(code => {
      const phase = code.current_phase || 'phase1_complete';
      byPhase[phase] = (byPhase[phase] || 0) + 1;

      if (code.qa_status === 'PASS') byQA['PASS']++;
      else if (code.qa_status === 'FAILED') byQA['FAILED']++;
      else byQA['PENDING']++;

      if (code.trading_model) byModel[code.trading_model]++;
      else byModel.UNASSIGNED++;
    });

    return { byPhase, byQA, byModel };
  }, [codes]);

  // Get code detail
  const selectedCodeDetail = useMemo(() => {
    if (!selectedCode) return null;
    const code = codes.find(c => c.hs4 === selectedCode);
    const reg = regulatory.find(r => r.hs4 === selectedCode);
    const sup = supply.find(s => s.hs4 === selectedCode);
    const dem = demand.find(d => d.hs4 === selectedCode);
    const scor = scoring.find(s => s.hs4 === selectedCode);
    return { code, reg, sup, dem, scor };
  }, [selectedCode, codes, regulatory, supply, demand, scoring]);

  // Code Detail View
  if (selectedCodeDetail && selectedCodeDetail.code) {
    const { code, reg, sup, dem, scor } = selectedCodeDetail;
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
        <button
          onClick={() => setSelectedCode(null)}
          style={{
            padding: '8px 16px',
            background: 'rgba(79,140,255,0.1)',
            color: '#4f8cff',
            border: '1px solid rgba(79,140,255,0.3)',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '20px',
            fontSize: '14px',
          }}
        >
          ← Back
        </button>

        <div style={{
          background: '#111827',
          border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h1 style={{ margin: '0 0 8px 0', color: '#e2e8f0', fontSize: '32px' }}>{code.hs4}</h1>
              <p style={{ margin: '0', color: '#94a3b8', fontSize: '14px' }}>{code.commodity}</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Badge label={PHASE_LABELS[code.current_phase] || code.current_phase} color="blue" />
              <Badge label={code.qa_status || 'PENDING'} color={code.qa_status === 'PASS' ? 'pass' : code.qa_status === 'FAILED' ? 'drop' : 'maybe'} />
              {code.trading_model && <Badge label={code.trading_model} color="blue" />}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(79,140,255,0.1)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Trade Value (M)</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e2e8f0' }}>${code.val_m?.toFixed(1) || 'N/A'}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(79,140,255,0.1)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Drill Score</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e2e8f0' }}>{code.drill_score?.toFixed(0) || 'N/A'}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(79,140,255,0.1)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>HS8 Count</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e2e8f0' }}>{code.hs8_count || 'N/A'}</div>
            </div>
          </div>
        </div>

        {reg && (
          <Section title="Phase 2b: Regulatory (13 Checks)" defaultOpen={true}>
            <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'rgba(52,211,153,0.1)', borderRadius: '8px', border: '1px solid rgba(52,211,153,0.2)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Duty %</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{reg.total_duty_pct?.toFixed(2) || 'N/A'}%</div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(251,191,36,0.1)', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Regulatory Risk</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>{reg.regulatory_risk_score || 'N/A'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Anti-Dumping', check: reg.check_anti_dumping, val: reg.add_rate_pct, notes: reg.add_notes },
                { label: 'Safeguard', check: reg.check_safeguard, val: reg.safeguard_pct, notes: reg.safeguard_notes },
                { label: 'AIDC', check: reg.check_aidc, val: reg.aidc_pct },
                { label: 'DGFT', check: reg.check_dgft_restriction, val: null, notes: reg.dgft_notes },
                { label: 'ADD Investigation', check: reg.check_add_investigation, val: null, notes: reg.add_investigation_notes },
                { label: 'WPC', check: reg.check_wpc, val: reg.wpc_cost_inr, unit: 'INR' },
                { label: 'TEC', check: reg.check_tec, val: reg.tec_cost_inr, unit: 'INR' },
                { label: 'BIS QCO', check: reg.check_bis_qco, val: reg.bis_cost_inr, unit: 'INR' },
                { label: 'PMP', check: reg.check_pmp, val: null, notes: reg.pmp_notes },
                { label: 'Input ADD', check: reg.check_input_add, val: null, notes: reg.input_add_notes },
                { label: 'EPR', check: reg.check_epr, val: reg.epr_cost_inr, unit: 'INR' },
                { label: 'FTA', check: reg.check_fta, val: reg.fta_duty_reduction_pct, unit: '%' },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '12px',
                  background: item.check ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.05)',
                  border: `1px solid rgba(${item.check ? '34,197,94' : '148,163,184'}, 0.2)`,
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', color: item.check ? '#22c55e' : '#94a3b8' }}>
                    {item.check ? '✓ Applies' : '○ N/A'}
                  </div>
                  {item.val !== null && <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: '600', marginTop: '4px' }}>
                    {item.val}{item.unit || '%'}
                  </div>}
                </div>
              ))}
            </div>

            {reg.data_sources_used && (
              <div style={{ fontSize: '12px', color: '#94a3b8', padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}>
                <strong>Sources Used:</strong> {reg.data_sources_used} ({reg.source_count || 0} sources)
              </div>
            )}
          </Section>
        )}

        {sup && (
          <Section title="Phase 2: Alibaba Supply" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: RGB.blue, borderRadius: '8px', border: '1px solid rgba(79,140,255,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Suppliers</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4f8cff' }}>{sup.total_suppliers || 0}</div>
              </div>
              <div style={{ padding: '12px', background: RGB.pass, borderRadius: '8px', border: '1px solid rgba(52,211,153,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Gold Supplier %</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{sup.gold_supplier_pct?.toFixed(1) || '0'}%</div>
              </div>
              <div style={{ padding: '12px', background: RGB.maybe, borderRadius: '8px', border: '1px solid rgba(251,191,36,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>FOB Range</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fbbf24' }}>
                  ${sup.fob_lowest_usd?.toFixed(2) || '0'} - ${sup.fob_highest_usd?.toFixed(2) || '0'}
                </div>
              </div>
            </div>

            {sup.typical_moq && (
              <div style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#e2e8f0' }}>
                <strong>Typical MOQ:</strong> {sup.typical_moq}
              </div>
            )}

            {sup.top_suppliers && (
              <div style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>Top Suppliers</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{sup.top_suppliers}</div>
              </div>
            )}
          </Section>
        )}

        {dem && (
          <Section title="Phase 3: IndiaMART Demand" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: RGB.blue, borderRadius: '8px', border: '1px solid rgba(79,140,255,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Sellers</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4f8cff' }}>{dem.total_sellers || 0}</div>
              </div>
              <div style={{ padding: '12px', background: RGB.pass, borderRadius: '8px', border: '1px solid rgba(52,211,153,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Manufacturer %</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{dem.manufacturer_pct?.toFixed(1) || '0'}%</div>
              </div>
              <div style={{ padding: '12px', background: RGB.maybe, borderRadius: '8px', border: '1px solid rgba(251,191,36,0.3)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Gross Margin</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: dem.gross_margin_pct > 20 ? '#34d399' : dem.gross_margin_pct > 10 ? '#fbbf24' : '#f87171' }}>
                  {dem.gross_margin_pct?.toFixed(1) || '0'}%
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Price Range (INR)</div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '600', marginTop: '4px' }}>
                  ₹{dem.price_low_inr?.toLocaleString() || '0'} - ₹{dem.price_high_inr?.toLocaleString() || '0'}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Demand Score</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4f8cff', marginTop: '4px' }}>{dem.demand_score?.toFixed(1) || '0'}</div>
              </div>
            </div>

            {dem.top_cities && (
              <div style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>Top Cities</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>{dem.top_cities}</div>
              </div>
            )}
          </Section>
        )}

        {scor && (
          <Section title="Phase 5: Final Scoring (150 Points)" defaultOpen={true}>
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(79,140,255,0.1)', borderRadius: '8px', border: '1px solid rgba(79,140,255,0.3)' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Total Score</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#4f8cff' }}>
                {scor.total_score || 0} <span style={{ fontSize: '18px', color: '#94a3b8' }}>/150</span>
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>Verdict: {scor.verdict || 'N/A'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Gross Margin %', val: scor.gross_margin_score, max: 25 },
                { label: 'Buyer Accessibility', val: scor.buyer_accessibility_score, max: 20 },
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
              ].map(factor => (
                <div key={factor.label} style={{ padding: '12px', background: 'rgba(79,140,255,0.05)', borderRadius: '8px' }}>
                  <ProgressBar label={factor.label} value={factor.val || 0} max={factor.max} color="#4f8cff" />
                </div>
              ))}
            </div>
          </Section>
        )}

        {code.qa_warnings && (
          <Section title="QA Warnings" defaultOpen={true}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {code.qa_warnings.split(',').map((w, i) => (
                <Badge key={i} label={w.trim()} color="maybe" />
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  // Main tabs view
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#e2e8f0' }}>Electronics Research Pipeline</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '8px' }}>
        {['overview', 'regulatory', 'supply_demand', 'scoring', 'all_codes'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px',
              background: activeTab === tab ? 'rgba(79,140,255,0.2)' : 'rgba(79,140,255,0.05)',
              color: activeTab === tab ? '#4f8cff' : '#94a3b8',
              border: `1px solid rgba(79,140,255, ${activeTab === tab ? '0.3' : '0.1'})`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {tab.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading...</div>
      ) : activeTab === 'overview' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <KPI label="Total Codes" value={codes.length} variant="blue" icon="📊" />
            <KPI label="QA PASS" value={stats.byQA['PASS']} variant="pass" icon="✓" />
            <KPI label="QA FAILED" value={stats.byQA['FAILED']} variant="drop" icon="✗" />
            <KPI label="QA PENDING" value={stats.byQA['PENDING']} variant="maybe" icon="⏳" />
            <KPI label="Phase 4 Pending" value={stats.byPhase['phase4_pending'] || 0} variant="blue" icon="🚀" />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '20px',
          }}>
            <div style={{
              background: '#111827',
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#e2e8f0', fontSize: '16px' }}>Trading Models Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={Object.entries(stats.byModel).map(([k, v]) => ({ name: k, value: v }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {Object.entries(stats.byModel).map(([k, v], i) => (
                      <Cell key={i} fill={MODEL_COLORS[k] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => v} contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{
              background: '#111827',
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#e2e8f0', fontSize: '16px' }}>Phase Progress</h3>
              {Object.entries(stats.byPhase)
                .sort((a, b) => {
                  const order = ['phase1_complete', 'phase2_pending', 'phase2_done', 'phase2b_pending', 'phase2b_done', 'phase3_pending', 'phase3_done', 'qa_pending', 'qa_pass', 'phase4_pending', 'phase4_done', 'phase5_pending', 'phase5_done'];
                  return order.indexOf(a[0]) - order.indexOf(b[0]);
                })
                .map(([phase, count]) => (
                  <div key={phase} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span style={{ color: '#e2e8f0' }}>{PHASE_LABELS[phase] || phase}</span>
                      <span style={{ color: '#94a3b8' }}>{count}</span>
                    </div>
                    <div style={{ background: 'rgba(79,140,255,0.1)', height: '6px', borderRadius: '3px' }}>
                      <div style={{ background: '#4f8cff', height: '100%', width: `${(count/(codes.length || 1))*100}%` }} />
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'regulatory' ? (
        <div style={{
          background: '#111827',
          border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#0b0f19', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>HS4</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Total Duty %</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Risk</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Sources</th>
                </tr>
              </thead>
              <tbody>
                {regulatory.slice(0, 50).map(reg => {
                  const dutyColor = reg.total_duty_pct < 30 ? '#34d399' : reg.total_duty_pct < 40 ? '#fbbf24' : reg.total_duty_pct < 50 ? '#f97316' : '#f87171';
                  return (
                    <tr
                      key={reg.hs4}
                      onClick={() => setSelectedCode(reg.hs4)}
                      style={{
                        borderBottom: '1px solid rgba(148,163,184,0.05)',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px', color: '#e2e8f0' }}><strong>{reg.hs4}</strong></td>
                      <td style={{ padding: '12px', color: dutyColor, fontWeight: '600' }}>{reg.total_duty_pct?.toFixed(2) || 'N/A'}%</td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>{reg.regulatory_risk_score || 'N/A'}</td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>{reg.source_count || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'supply_demand' ? (
        <div style={{
          background: '#111827',
          border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#0b0f19', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>HS4</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Suppliers</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>FOB Low</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Sellers</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {supply.map((sup, i) => {
                  const dem = demand.find(d => d.hs4 === sup.hs4);
                  const margin = dem?.gross_margin_pct || 0;
                  const marginColor = margin > 20 ? '#34d399' : margin > 10 ? '#fbbf24' : '#f87171';
                  return (
                    <tr
                      key={i}
                      onClick={() => setSelectedCode(sup.hs4)}
                      style={{
                        borderBottom: '1px solid rgba(148,163,184,0.05)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px', color: '#e2e8f0' }}><strong>{sup.hs4}</strong></td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>{sup.total_suppliers || 0}</td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>${sup.fob_lowest_usd?.toFixed(2) || '0'}</td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>{dem?.total_sellers || 'N/A'}</td>
                      <td style={{ padding: '12px', color: marginColor, fontWeight: '600' }}>{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'scoring' ? (
        <div style={{
          background: '#111827',
          border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          {scoring.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No Phase 5 scoring data yet</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
              {scoring.map(scor => (
                <div
                  key={scor.hs4}
                  onClick={() => setSelectedCode(scor.hs4)}
                  style={{
                    padding: '16px',
                    background: 'rgba(79,140,255,0.05)',
                    border: '1px solid rgba(79,140,255,0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'}
                >
                  <div style={{ fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>{scor.hs4}</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4f8cff', marginBottom: '8px' }}>
                    {scor.total_score || 0}/150
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{scor.verdict || 'N/A'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: '#111827',
          border: '1px solid rgba(148,163,184,0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#0b0f19', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>HS4</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Commodity</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Phase</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>QA</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Model</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: '600' }}>Drill Score</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(code => (
                  <tr
                    key={code.hs4}
                    onClick={() => setSelectedCode(code.hs4)}
                    style={{
                      borderBottom: '1px solid rgba(148,163,184,0.05)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,140,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px', color: '#e2e8f0' }}><strong>{code.hs4}</strong></td>
                    <td style={{ padding: '12px', color: '#94a3b8', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{code.commodity}</td>
                    <td style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>{PHASE_LABELS[code.current_phase] || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>
                      <Badge label={code.qa_status || 'PENDING'} color={code.qa_status === 'PASS' ? 'pass' : code.qa_status === 'FAILED' ? 'drop' : 'maybe'} />
                    </td>
                    <td style={{ padding: '12px', fontSize: '11px', color: '#94a3b8' }}>{code.trading_model || '—'}</td>
                    <td style={{ padding: '12px', color: '#e2e8f0', fontWeight: '600' }}>{code.drill_score?.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
