import React, { useState, useEffect, useMemo } from 'react'
import { supabase, isConfigured } from './supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Treemap
} from 'recharts'

// ─── STYLES ────────────────────────────────────────────────
const COLORS = {
  bg: '#0b0f19', bg2: '#111827', bg3: '#1a2035',
  tx1: '#e2e8f0', tx2: '#94a3b8', border: 'rgba(148,163,184,0.08)',
  green: '#34d399', yellow: '#fbbf24', purple: '#a78bfa',
  red: '#f87171', blue: '#4f8cff', cyan: '#22d3ee',
  greenBg: 'rgba(52,211,153,0.12)', yellowBg: 'rgba(251,191,36,0.12)',
  purpleBg: 'rgba(167,139,250,0.12)', redBg: 'rgba(248,113,113,0.12)',
  blueBg: 'rgba(79,140,255,0.12)',
}

const PIE_COLORS = [COLORS.green, COLORS.yellow, COLORS.purple, COLORS.red, COLORS.blue, COLORS.cyan]

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${COLORS.bg}; color: ${COLORS.tx1}; font-family: 'Inter', system-ui, sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${COLORS.bg2}; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.tx2}; border-radius: 3px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.3s ease-out; }
  input, select { background: ${COLORS.bg}; color: ${COLORS.tx1}; border: 1px solid ${COLORS.border};
    border-radius: 6px; padding: 6px 10px; font-size: 13px; outline: none; }
  input:focus, select:focus { border-color: ${COLORS.blue}; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.5px; color: ${COLORS.tx2}; border-bottom: 1px solid ${COLORS.border}; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid ${COLORS.border}; }
  tr:hover td { background: rgba(255,255,255,0.02); }
`

// ─── HELPERS ───────────────────────────────────────────────
function Badge({ text, color }) {
  const c = { PASS: COLORS.green, STRONG: COLORS.green, PURSUE: COLORS.green,
    MAYBE: COLORS.yellow, MODERATE: COLORS.yellow, WATCH: COLORS.purple,
    DROP: COLORS.red, KILLED: COLORS.red, DONE: COLORS.green, PASSED: COLORS.green,
    pending: COLORS.tx2, HIGH: COLORS.red, MEDIUM: COLORS.yellow, LOW: COLORS.green,
    COMPLETE: COLORS.cyan }[text] || color || COLORS.tx2
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
    color: c, background: c + '20', border: `1px solid ${c}40` }}>{text || '—'}</span>
}

function KPI({ label, value, color, sub }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${COLORS.bg2}, ${COLORS.bg3})`, borderRadius:12,
      padding:'20px 24px', border:`1px solid ${COLORS.border}`, flex:'1 1 180px', minWidth:160 }}>
      <div style={{ fontSize:12, color:COLORS.tx2, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color: color || COLORS.tx1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:COLORS.tx2, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, children, style }) {
  return (
    <div className="fade-in" style={{ background: `linear-gradient(135deg, ${COLORS.bg2}, ${COLORS.bg3})`,
      borderRadius:12, padding:20, border:`1px solid ${COLORS.border}`, ...style }}>
      {title && <h3 style={{ fontSize:15, fontWeight:600, marginBottom:14, color:COLORS.tx1 }}>{title}</h3>}
      {children}
    </div>
  )
}

// ─── DATA HOOKS ────────────────────────────────────────────
function useSupabase(table, options = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let q = supabase.from(table).select(options.select || '*')
    if (options.order) q = q.order(options.order, { ascending: options.asc ?? false })
    if (options.limit) q = q.limit(options.limit)
    if (options.eq) q = q.eq(options.eq[0], options.eq[1])
    q.then(({ data, error }) => {
      if (error) setError(error.message)
      else setData(data || [])
      setLoading(false)
    })
  }, [table, JSON.stringify(options)])

  return { data, loading, error }
}

// ─── DEMO DATA (used when Supabase not yet connected) ──────
const DEMO_CODES = [
  { hs4:'8504', commodity:'Elec Transformers/Inverters', val_m:2057.9, drill_score:86.74,
    current_phase:'COMPLETE', final_verdict:'STRONG', qa_status:'PASSED',
    phase2_status:'DONE', phase2b_status:'DONE', phase3_status:'DONE',
    phase4_status:'DONE', phase5_status:'DONE', bcd_rate:15, hs8_count:23 },
  ...[
    ['8517','Telecom Equipment',8605,86.74],['8524','Flat Panel Displays',2659.9,86.74],
    ['8536','Switching Apparatus',2218.9,84.24],['8507','Electric Accumulators',4034.4,82.24],
    ['8516','Electric Heaters',546.2,82.24],['8544','Insulated Wire/Cable',1799.2,81.74],
    ['8523','Recorded Media',3207.5,80.24],['8471','Data Processing Machines',7851.2,79.24],
    ['8542','Electronic ICs',12766.5,78.24],
  ].map(([hs4,c,v,d])=>({ hs4, commodity:c, val_m:v, drill_score:d,
    current_phase:'pending', final_verdict:null, qa_status:null,
    phase2_status:'pending', phase2b_status:'pending', phase3_status:'pending',
    phase4_status:'pending', phase5_status:'pending', bcd_rate:15, hs8_count:10 }))
]

const DEMO_SCORING = {
  hs4:'8504', pts_gross_margin:15, pts_buyer_accessibility:20, pts_supply_reliability:8,
  pts_market_size:15, pts_regulatory_risk:10, pts_competition:2, pts_growth:10,
  pts_working_capital:6, pts_logistics:2, pts_obsolescence:5, pts_capital_required:3,
  pts_fta:5, total_score:101, final_verdict:'STRONG',
  go_nogo_notes:'STRONG candidate. 20.8% margin. BIS QCO main barrier. ASEAN FTA recommended.'
}

const DEMO_P2 = { hs4:'8504', total_suppliers:1270, fob_lowest_usd:7.85, fob_highest_usd:1682,
  fob_typical_usd:75, gold_supplier_pct:0, typical_moq:'1-50 pieces' }
const DEMO_P3 = { hs4:'8504', total_sellers:18000, manufacturer_pct:40, trader_pct:60,
  price_low_inr:350, price_high_inr:500000, gross_margin_pct:20.8, landed_cost_inr:6339, sell_price_inr:8000, demand_score:7.5 }
const DEMO_P4 = { hs4:'8504', unique_buyers:79, buyer_hhi:838, china_sourcing_pct:69,
  median_cif_usd:189, total_shipments:255 }

// ─── TABS ──────────────────────────────────────────────────
const TABS = [
  { id:'overview', icon:'📊', label:'Overview' },
  { id:'pipeline', icon:'🚀', label:'Pipeline' },
  { id:'codes', icon:'📋', label:'All Codes' },
  { id:'scoring', icon:'⚡', label:'Scoring' },
  { id:'detail', icon:'🔍', label:'Code Detail' },
  { id:'activity', icon:'📝', label:'Activity Log' },
]

// ─── OVERVIEW TAB ──────────────────────────────────────────
function OverviewTab({ codes }) {
  const total = codes.length
  const complete = codes.filter(c => c.current_phase === 'COMPLETE').length
  const pending = codes.filter(c => c.current_phase === 'pending').length
  const killed = codes.filter(c => c.kill_phase).length
  const p2Done = codes.filter(c => c.phase2_status === 'DONE').length
  const p3Done = codes.filter(c => c.phase3_status === 'DONE').length
  const strong = codes.filter(c => c.final_verdict === 'STRONG' || c.final_verdict === 'PURSUE').length
  const totalVal = codes.reduce((s,c) => s + (c.val_m || 0), 0)

  const verdictData = [
    { name:'PURSUE', value: codes.filter(c=>c.final_verdict==='PURSUE').length },
    { name:'STRONG', value: codes.filter(c=>c.final_verdict==='STRONG').length },
    { name:'MODERATE', value: codes.filter(c=>c.final_verdict==='MODERATE').length },
    { name:'DROP', value: codes.filter(c=>c.final_verdict==='DROP').length },
    { name:'Pending', value: codes.filter(c=>!c.final_verdict).length },
  ].filter(d => d.value > 0)

  const topByVal = [...codes].sort((a,b) => (b.val_m||0) - (a.val_m||0)).slice(0,15)
    .map(c => ({ name: c.hs4, val: Math.round(c.val_m || 0) }))

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:20 }}>
        <KPI label="Total HS4 Codes" value={total} color={COLORS.blue} />
        <KPI label="Completed" value={complete} color={COLORS.green} sub={`${Math.round(complete/total*100)}% done`} />
        <KPI label="Pending" value={pending} color={COLORS.yellow} />
        <KPI label="Killed" value={killed} color={COLORS.red} />
        <KPI label="Winners" value={strong} color={COLORS.cyan} />
        <KPI label="Total Trade Value" value={`$${(totalVal/1000).toFixed(1)}B`} color={COLORS.blue} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card title="🎯 Verdict Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={verdictData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                label={({name,value}) => `${name}: ${value}`} labelLine={false}>
                {verdictData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background:COLORS.bg2, border:`1px solid ${COLORS.border}`, borderRadius:8, color:COLORS.tx1 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="📦 Top 15 by Trade Value ($M)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topByVal} layout="vertical">
              <XAxis type="number" tick={{ fill:COLORS.tx2, fontSize:11 }} />
              <YAxis type="category" dataKey="name" width={50} tick={{ fill:COLORS.tx2, fontSize:11 }} />
              <Tooltip contentStyle={{ background:COLORS.bg2, border:`1px solid ${COLORS.border}`, borderRadius:8, color:COLORS.tx1 }} />
              <Bar dataKey="val" fill={COLORS.blue} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

// ─── PIPELINE TAB ──────────────────────────────────────────
function PipelineTab({ codes }) {
  const stages = [
    { label:'Total Codes', count: codes.length, color: COLORS.blue },
    { label:'P2 Alibaba Done', count: codes.filter(c=>c.phase2_status==='DONE').length, color: COLORS.cyan },
    { label:'P2b Regulatory Done', count: codes.filter(c=>c.phase2b_status==='DONE').length, color: COLORS.purple },
    { label:'P3 IndiaMART Done', count: codes.filter(c=>c.phase3_status==='DONE').length, color: COLORS.yellow },
    { label:'QA Passed', count: codes.filter(c=>c.qa_status==='PASSED').length, color: COLORS.green },
    { label:'P4 Volza Done', count: codes.filter(c=>c.phase4_status==='DONE').length, color: COLORS.blue },
    { label:'P5 Scored', count: codes.filter(c=>c.phase5_status==='DONE').length, color: COLORS.cyan },
    { label:'Complete', count: codes.filter(c=>c.current_phase==='COMPLETE').length, color: COLORS.green },
  ]
  const maxCount = Math.max(...stages.map(s=>s.count), 1)

  return (
    <div className="fade-in">
      <Card title="🚀 Research Pipeline Funnel">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {stages.map((s, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:140, fontSize:12, color:COLORS.tx2, textAlign:'right' }}>{s.label}</div>
              <div style={{ flex:1, height:28, background:COLORS.bg, borderRadius:6, overflow:'hidden', position:'relative' }}>
                <div style={{ width:`${(s.count/maxCount)*100}%`, height:'100%', background:`linear-gradient(90deg, ${s.color}40, ${s.color}80)`,
                  borderRadius:6, transition:'width 0.5s ease', minWidth: s.count > 0 ? 40 : 0 }} />
                <span style={{ position:'absolute', left:8, top:5, fontSize:13, fontWeight:600, color:COLORS.tx1 }}>{s.count}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16 }}>
        <Card title="🏆 Completed Codes">
          {codes.filter(c=>c.current_phase==='COMPLETE').length === 0
            ? <p style={{ color:COLORS.tx2, fontSize:13 }}>No codes completed yet</p>
            : <table>
                <thead><tr><th>HS4</th><th>Product</th><th>Verdict</th><th>Score</th></tr></thead>
                <tbody>
                  {codes.filter(c=>c.current_phase==='COMPLETE').map(c => (
                    <tr key={c.hs4}>
                      <td style={{ fontWeight:600, color:COLORS.blue }}>{c.hs4}</td>
                      <td>{(c.commodity||'').slice(0,30)}</td>
                      <td><Badge text={c.final_verdict} /></td>
                      <td>{c.drill_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </Card>
        <Card title="💀 Killed Codes">
          {codes.filter(c=>c.kill_phase).length === 0
            ? <p style={{ color:COLORS.tx2, fontSize:13 }}>No codes killed yet</p>
            : <table>
                <thead><tr><th>HS4</th><th>Phase</th><th>Reason</th></tr></thead>
                <tbody>
                  {codes.filter(c=>c.kill_phase).map(c => (
                    <tr key={c.hs4}>
                      <td style={{ fontWeight:600, color:COLORS.red }}>{c.hs4}</td>
                      <td>{c.kill_phase}</td>
                      <td style={{ fontSize:12 }}>{(c.kill_reason||'').slice(0,50)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </Card>
      </div>
    </div>
  )
}

// ─── ALL CODES TAB ─────────────────────────────────────────
function CodesTab({ codes, onSelect }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('drill_score')
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    let d = [...codes]
    if (search) d = d.filter(c => c.hs4.includes(search) || (c.commodity||'').toLowerCase().includes(search.toLowerCase()))
    if (filter === 'complete') d = d.filter(c => c.current_phase === 'COMPLETE')
    if (filter === 'pending') d = d.filter(c => c.current_phase === 'pending')
    if (filter === 'killed') d = d.filter(c => c.kill_phase)
    d.sort((a,b) => (b[sortBy]||0) - (a[sortBy]||0))
    return d
  }, [codes, search, sortBy, filter])

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <input placeholder="Search HS4 or product..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{ width:220 }} />
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All ({codes.length})</option>
          <option value="complete">Complete</option>
          <option value="pending">Pending</option>
          <option value="killed">Killed</option>
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="drill_score">Drill Score</option>
          <option value="val_m">Trade Value</option>
          <option value="hs8_count">HS8 Count</option>
        </select>
        <span style={{ fontSize:12, color:COLORS.tx2, alignSelf:'center' }}>{filtered.length} codes</span>
      </div>
      <div style={{ overflowX:'auto', maxHeight:'70vh', overflowY:'auto' }}>
        <table>
          <thead>
            <tr>
              <th>HS4</th><th>Product</th><th>Trade $M</th><th>Score</th><th>BCD%</th>
              <th>Phase</th><th>P2</th><th>P2b</th><th>P3</th><th>P4</th><th>P5</th>
              <th>Verdict</th><th>QA</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.hs4} onClick={() => onSelect(c.hs4)} style={{ cursor:'pointer' }}>
                <td style={{ fontWeight:600, color:COLORS.blue }}>{c.hs4}</td>
                <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {(c.commodity||'').slice(0,40)}
                </td>
                <td>${(c.val_m||0).toLocaleString()}</td>
                <td style={{ fontWeight:600 }}>{c.drill_score}</td>
                <td>{c.bcd_rate}%</td>
                <td><Badge text={c.current_phase} /></td>
                <td><Badge text={c.phase2_status} /></td>
                <td><Badge text={c.phase2b_status} /></td>
                <td><Badge text={c.phase3_status} /></td>
                <td><Badge text={c.phase4_status} /></td>
                <td><Badge text={c.phase5_status} /></td>
                <td><Badge text={c.final_verdict} /></td>
                <td><Badge text={c.qa_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── SCORING TAB ───────────────────────────────────────────
function ScoringTab({ scoring }) {
  if (!scoring) return <Card><p style={{color:COLORS.tx2}}>No scoring data yet. Complete Phase 5 for at least one code.</p></Card>

  const factors = [
    { name:'Margin', key:'pts_gross_margin', max:25 },
    { name:'Buyers', key:'pts_buyer_accessibility', max:20 },
    { name:'Supply', key:'pts_supply_reliability', max:15 },
    { name:'Market', key:'pts_market_size', max:15 },
    { name:'Regulatory', key:'pts_regulatory_risk', max:15 },
    { name:'Competition', key:'pts_competition', max:10 },
    { name:'Growth', key:'pts_growth', max:10 },
    { name:'WorkCap', key:'pts_working_capital', max:10 },
    { name:'Logistics', key:'pts_logistics', max:10 },
    { name:'Obsolescence', key:'pts_obsolescence', max:10 },
    { name:'Capital', key:'pts_capital_required', max:5 },
    { name:'FTA', key:'pts_fta', max:5 },
  ]

  const radarData = factors.map(f => ({
    factor: f.name, score: scoring[f.key] || 0, max: f.max,
    pct: Math.round(((scoring[f.key]||0) / f.max) * 100)
  }))

  const barData = factors.map(f => ({
    name: f.name, scored: scoring[f.key] || 0, remaining: f.max - (scoring[f.key] || 0)
  }))

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:14, marginBottom:20, flexWrap:'wrap' }}>
        <KPI label="HS4 Code" value={scoring.hs4} color={COLORS.blue} />
        <KPI label="Total Score" value={`${scoring.total_score}/150`} color={
          scoring.total_score >= 120 ? COLORS.green : scoring.total_score >= 90 ? COLORS.cyan : COLORS.yellow} />
        <KPI label="Verdict" value={scoring.final_verdict} color={
          scoring.final_verdict === 'PURSUE' ? COLORS.green : scoring.final_verdict === 'STRONG' ? COLORS.cyan : COLORS.yellow} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card title="🎯 Scoring Radar">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={COLORS.border} />
              <PolarAngleAxis dataKey="factor" tick={{ fill:COLORS.tx2, fontSize:10 }} />
              <PolarRadiusAxis tick={{ fill:COLORS.tx2, fontSize:9 }} domain={[0, 25]} />
              <Radar dataKey="score" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="📊 Factor Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical">
              <XAxis type="number" tick={{ fill:COLORS.tx2, fontSize:11 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fill:COLORS.tx2, fontSize:10 }} />
              <Tooltip contentStyle={{ background:COLORS.bg2, border:`1px solid ${COLORS.border}`, borderRadius:8, color:COLORS.tx1 }} />
              <Bar dataKey="scored" stackId="a" fill={COLORS.green} radius={[0,0,0,0]} />
              <Bar dataKey="remaining" stackId="a" fill={COLORS.bg} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      {scoring.go_nogo_notes && (
        <Card title="📝 Analysis Notes" style={{ marginTop:16 }}>
          <p style={{ fontSize:13, lineHeight:1.7, color:COLORS.tx2 }}>{scoring.go_nogo_notes}</p>
        </Card>
      )}
    </div>
  )
}

// ─── CODE DETAIL TAB ───────────────────────────────────────
function DetailTab({ hs4, codes, p2Data, p3Data, p4Data, scoringData }) {
  const code = codes.find(c => c.hs4 === hs4)
  if (!code) return <Card><p style={{color:COLORS.tx2}}>Select a code from the All Codes tab to view details.</p></Card>

  const p2 = (p2Data || []).find(d => d.hs4 === hs4)
  const p3 = (p3Data || []).find(d => d.hs4 === hs4)
  const p4 = (p4Data || []).find(d => d.hs4 === hs4)
  const sc = (scoringData || []).find(d => d.hs4 === hs4)

  const Section = ({ title, items }) => (
    <Card title={title} style={{ marginBottom:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8 }}>
        {items.map(([label, val, color]) => (
          <div key={label}>
            <span style={{ fontSize:11, color:COLORS.tx2 }}>{label}</span>
            <div style={{ fontSize:14, fontWeight:500, color: color || COLORS.tx1 }}>
              {val ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:14, marginBottom:16, flexWrap:'wrap' }}>
        <KPI label="HS4" value={hs4} color={COLORS.blue} />
        <KPI label="Product" value={(code.commodity||'').slice(0,25)} />
        <KPI label="Trade Value" value={`$${(code.val_m||0).toLocaleString()}M`} color={COLORS.cyan} />
        <KPI label="Phase" value={code.current_phase} color={code.current_phase==='COMPLETE'?COLORS.green:COLORS.yellow} />
        <KPI label="Verdict" value={code.final_verdict || 'Pending'} color={
          code.final_verdict==='STRONG'?COLORS.green:code.final_verdict==='PURSUE'?COLORS.cyan:COLORS.yellow} />
      </div>

      <Section title="🔷 Phase 2 — Alibaba Supply" items={[
        ['Total Suppliers', p2?.total_suppliers],
        ['FOB Low', p2?.fob_lowest_usd ? `$${p2.fob_lowest_usd}` : null],
        ['FOB High', p2?.fob_highest_usd ? `$${p2.fob_highest_usd}` : null],
        ['FOB Typical', p2?.fob_typical_usd ? `$${p2.fob_typical_usd}` : null],
        ['Gold Supplier %', p2?.gold_supplier_pct != null ? `${p2.gold_supplier_pct}%` : null],
        ['Typical MOQ', p2?.typical_moq],
      ]} />

      <Section title="🟡 Phase 3 — IndiaMART Demand" items={[
        ['Total Sellers', p3?.total_sellers],
        ['Manufacturer %', p3?.manufacturer_pct ? `${p3.manufacturer_pct}%` : null],
        ['Price Low', p3?.price_low_inr ? `₹${p3.price_low_inr.toLocaleString()}` : null],
        ['Price High', p3?.price_high_inr ? `₹${p3.price_high_inr.toLocaleString()}` : null],
        ['Landed Cost', p3?.landed_cost_inr ? `₹${Math.round(p3.landed_cost_inr).toLocaleString()}` : null],
        ['Gross Margin', p3?.gross_margin_pct ? `${p3.gross_margin_pct}%` : null, p3?.gross_margin_pct>20?COLORS.green:COLORS.yellow],
        ['Demand Score', p3?.demand_score],
      ]} />

      <Section title="🚢 Phase 4 — Volza Validation" items={[
        ['Unique Buyers', p4?.unique_buyers],
        ['Buyer HHI', p4?.buyer_hhi],
        ['China %', p4?.china_sourcing_pct ? `${p4.china_sourcing_pct}%` : null],
        ['Median CIF', p4?.median_cif_usd ? `$${p4.median_cif_usd}` : null],
        ['Total Shipments', p4?.total_shipments],
      ]} />

      {sc && <Section title="⚡ Phase 5 — 150-Point Scoring" items={[
        ['Total Score', `${sc.total_score}/150`, sc.total_score>=90?COLORS.green:COLORS.yellow],
        ['Margin', `${sc.pts_gross_margin}/25`],
        ['Buyers', `${sc.pts_buyer_accessibility}/20`],
        ['Supply', `${sc.pts_supply_reliability}/15`],
        ['Market', `${sc.pts_market_size}/15`],
        ['Regulatory', `${sc.pts_regulatory_risk}/15`],
        ['Competition', `${sc.pts_competition}/10`],
        ['Growth', `${sc.pts_growth}/10`],
        ['FTA', `${sc.pts_fta}/5`],
      ]} />}
    </div>
  )
}

// ─── ACTIVITY LOG TAB ──────────────────────────────────────
function ActivityTab({ logs }) {
  return (
    <div className="fade-in">
      <Card title="📝 Research Activity Log">
        {logs.length === 0
          ? <p style={{ color:COLORS.tx2 }}>No activity recorded yet.</p>
          : <div style={{ maxHeight:'65vh', overflowY:'auto' }}>
              <table>
                <thead><tr><th>Time</th><th>HS4</th><th>Phase</th><th>Action</th><th>Status</th></tr></thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={i}>
                      <td style={{ fontSize:11, color:COLORS.tx2, whiteSpace:'nowrap' }}>
                        {l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}
                      </td>
                      <td style={{ fontWeight:600, color:COLORS.blue }}>{l.hs4}</td>
                      <td><Badge text={l.phase} /></td>
                      <td style={{ maxWidth:300, overflow:'hidden', textOverflow:'ellipsis' }}>{l.action}</td>
                      <td>{l.success ? <Badge text="OK" color={COLORS.green} /> : <Badge text="FAIL" color={COLORS.red} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </Card>
    </div>
  )
}

// ─── MAIN APP ──────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('overview')
  const [selectedCode, setSelectedCode] = useState('8504')
  const [liveMode, setLiveMode] = useState(isConfigured())

  // Supabase data hooks
  const codesQ = useSupabase('research_codes', { order: 'drill_score' })
  const p2SumQ = useSupabase('phase2_alibaba_summary')
  const p3SumQ = useSupabase('phase3_indiamart_summary')
  const p4Q = useSupabase('phase4_volza')
  const scoringQ = useSupabase('phase5_scoring')
  const logsQ = useSupabase('research_log', { order: 'timestamp', limit: 200 })

  // Use live data or demo data
  const codes = liveMode && codesQ.data.length > 0 ? codesQ.data : DEMO_CODES
  const p2Data = liveMode ? p2SumQ.data : [DEMO_P2]
  const p3Data = liveMode ? p3SumQ.data : [DEMO_P3]
  const p4Data = liveMode ? p4Q.data : [DEMO_P4]
  const scoringData = liveMode ? scoringQ.data : [DEMO_SCORING]
  const logs = liveMode ? logsQ.data : []

  const handleSelectCode = (hs4) => { setSelectedCode(hs4); setTab('detail') }

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:'100vh', display:'flex' }}>
        {/* Sidebar */}
        <div style={{ width:200, background:COLORS.bg2, borderRight:`1px solid ${COLORS.border}`,
          padding:'16px 0', flexShrink:0, position:'sticky', top:0, height:'100vh' }}>
          <div style={{ padding:'0 16px', marginBottom:20 }}>
            <h1 style={{ fontSize:16, fontWeight:700, color:COLORS.tx1 }}>KALASH EXIM</h1>
            <div style={{ fontSize:11, color:COLORS.tx2 }}>Intelligence Dashboard</div>
          </div>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 16px',
                background: tab === t.id ? COLORS.blueBg : 'transparent', color: tab === t.id ? COLORS.blue : COLORS.tx2,
                border:'none', cursor:'pointer', fontSize:13, fontWeight: tab === t.id ? 600 : 400,
                borderLeft: tab === t.id ? `3px solid ${COLORS.blue}` : '3px solid transparent',
                transition:'all 0.15s ease' }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
          <div style={{ padding:'16px', marginTop:'auto', borderTop:`1px solid ${COLORS.border}`, position:'absolute', bottom:0, width:200 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: liveMode ? COLORS.green : COLORS.yellow }} />
              <span style={{ color:COLORS.tx2 }}>{liveMode ? 'Live · Supabase' : 'Demo Mode'}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            {!liveMode && (
              <div style={{ background:COLORS.yellowBg, border:`1px solid ${COLORS.yellow}40`, borderRadius:8,
                padding:'10px 16px', marginBottom:16, fontSize:13, color:COLORS.yellow }}>
                ⚠️ Demo Mode — Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> env vars to connect to live data.
              </div>
            )}
            {tab === 'overview' && <OverviewTab codes={codes} />}
            {tab === 'pipeline' && <PipelineTab codes={codes} />}
            {tab === 'codes' && <CodesTab codes={codes} onSelect={handleSelectCode} />}
            {tab === 'scoring' && <ScoringTab scoring={scoringData[0]} />}
            {tab === 'detail' && <DetailTab hs4={selectedCode} codes={codes} p2Data={p2Data} p3Data={p3Data} p4Data={p4Data} scoringData={scoringData} />}
            {tab === 'activity' && <ActivityTab logs={logs} />}
          </div>
        </div>
      </div>
    </>
  )
}
