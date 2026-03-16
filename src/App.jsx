import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, isConfigured } from './supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line, Legend
} from 'recharts'

// ─── THEME ────────────────────────────────────────────────
const C = {
  bg: '#0b0f19', bg2: '#111827', bg3: '#1a2035',
  tx1: '#e2e8f0', tx2: '#94a3b8', border: 'rgba(148,163,184,0.08)',
  green: '#34d399', yellow: '#fbbf24', purple: '#a78bfa',
  red: '#f87171', blue: '#4f8cff', cyan: '#22d3ee', orange: '#fb923c',
  greenBg: 'rgba(52,211,153,0.12)', yellowBg: 'rgba(251,191,36,0.12)',
  purpleBg: 'rgba(167,139,250,0.12)', redBg: 'rgba(248,113,113,0.12)',
  blueBg: 'rgba(79,140,255,0.12)', cyanBg: 'rgba(34,211,238,0.12)',
  orangeBg: 'rgba(251,146,60,0.12)',
}
const PIE_COLORS = [C.green, C.yellow, C.purple, C.red, C.blue, C.cyan, C.orange]

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.tx1}; font-family: 'Inter', system-ui, sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${C.bg2}; }
  ::-webkit-scrollbar-thumb { background: ${C.tx2}; border-radius: 3px; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  .fade-in { animation: fadeIn 0.3s ease-out; }
  .pulse { animation: pulse 2s infinite; }
  input, select { background: ${C.bg}; color: ${C.tx1}; border: 1px solid ${C.border};
    border-radius: 6px; padding: 6px 10px; font-size: 13px; outline: none; }
  input:focus, select:focus { border-color: ${C.blue}; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.5px; color: ${C.tx2}; border-bottom: 1px solid ${C.border}; cursor: pointer; user-select: none; }
  th:hover { color: ${C.blue}; }
  td { padding: 7px 10px; font-size: 13px; border-bottom: 1px solid ${C.border}; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .sort-arrow { margin-left: 4px; font-size: 9px; }
`

// ─── HELPERS ────────────────────────────────────────────────
const VERDICT_COLORS = { PASS: C.green, STRONG: C.green, PURSUE: C.cyan, MAYBE: C.yellow,
  MODERATE: C.yellow, WATCH: C.purple, DROP: C.red, KILLED: C.red, DONE: C.green,
  PASSED: C.green, pending: C.tx2, HIGH: C.red, MEDIUM: C.yellow, LOW: C.green,
  COMPLETE: C.cyan, running: C.green, idle: C.tx2, error: C.red, cooldown: C.orange,
  scraping: C.green, navigating: C.blue, waiting: C.yellow, WORKING: C.green,
  BLOCKED: C.red, PARTIAL: C.yellow, PAID: C.purple, DEAD: C.red }

function Badge({ text, color }) {
  const c = VERDICT_COLORS[text] || color || C.tx2
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
    color: c, background: c + '20', border: `1px solid ${c}40` }}>{text || '—'}</span>
}

function KPI({ label, value, color, sub, icon }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, borderRadius:12,
      padding:'18px 22px', border:`1px solid ${C.border}`, flex:'1 1 160px', minWidth:140 }}>
      <div style={{ fontSize:11, color:C.tx2, marginBottom:4 }}>{icon && <span style={{marginRight:4}}>{icon}</span>}{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color: color || C.tx1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.tx2, marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, children, style }) {
  return (
    <div className="fade-in" style={{ background: `linear-gradient(135deg, ${C.bg2}, ${C.bg3})`,
      borderRadius:12, padding:18, border:`1px solid ${C.border}`, ...style }}>
      {title && <h3 style={{ fontSize:14, fontWeight:600, marginBottom:12, color:C.tx1 }}>{title}</h3>}
      {children}
    </div>
  )
}

function SubTab({ tabs, active, onChange }) {
  return (
    <div style={{ display:'flex', gap:2, marginBottom:16, background:C.bg, borderRadius:8, padding:3 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding:'7px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
          background: active === t.id ? C.blueBg : 'transparent',
          color: active === t.id ? C.blue : C.tx2, transition:'all 0.15s' }}>
          {t.icon && <span style={{marginRight:4}}>{t.icon}</span>}{t.label}
        </button>
      ))}
    </div>
  )
}

// ─── SORTABLE TABLE ─────────────────────────────────────────
function SortableTable({ columns, data, onRowClick, pageSize = 25, searchable = true }) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({})

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(0)
  }

  const filtered = useMemo(() => {
    let d = [...data]
    if (search) {
      const s = search.toLowerCase()
      d = d.filter(row => columns.some(c => String(row[c.key] ?? '').toLowerCase().includes(s)))
    }
    Object.entries(filters).forEach(([key, val]) => {
      if (val && val !== 'all') d = d.filter(row => String(row[key]) === val)
    })
    if (sortCol) {
      d.sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      })
    }
    return d
  }, [data, search, sortCol, sortDir, filters, columns])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const filterCols = columns.filter(c => c.filterable)

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        {searchable && <input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} style={{ width:200 }} />}
        {filterCols.map(c => {
          const vals = [...new Set(data.map(r => r[c.key]).filter(Boolean))].sort()
          return (
            <select key={c.key} value={filters[c.key] || 'all'} onChange={e => { setFilters(f => ({...f, [c.key]: e.target.value})); setPage(0) }}>
              <option value="all">{c.label} (All)</option>
              {vals.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )
        })}
        <span style={{ fontSize:11, color:C.tx2, marginLeft:'auto' }}>{filtered.length} rows</span>
      </div>
      <div style={{ overflowX:'auto', maxHeight:'62vh', overflowY:'auto' }}>
        <table>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} onClick={() => toggleSort(c.key)} style={{ whiteSpace:'nowrap' }}>
                  {c.label}
                  {sortCol === c.key && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={row.id || row.hs4 || i} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                {columns.map(c => (
                  <td key={c.key} style={c.style}>
                    {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display:'flex', gap:6, marginTop:10, alignItems:'center', justifyContent:'center' }}>
          <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
            style={{ padding:'4px 10px', background:C.bg, color:C.tx2, border:`1px solid ${C.border}`, borderRadius:4, cursor:'pointer', fontSize:12 }}>Prev</button>
          <span style={{ fontSize:12, color:C.tx2 }}>{page+1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page>=totalPages-1}
            style={{ padding:'4px 10px', background:C.bg, color:C.tx2, border:`1px solid ${C.border}`, borderRadius:4, cursor:'pointer', fontSize:12 }}>Next</button>
        </div>
      )}
    </div>
  )
}

// ─── DATA HOOKS ─────────────────────────────────────────────
function useSupabase(table, options = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    if (!supabase) { setLoading(false); return }
    let q = supabase.from(table).select(options.select || '*')
    if (options.order) q = q.order(options.order, { ascending: options.asc ?? false })
    if (options.limit) q = q.limit(options.limit)
    if (options.eq) q = q.eq(options.eq[0], options.eq[1])
    q.then(({ data: d }) => { if (d) setData(d); setLoading(false) })
  }, [table, JSON.stringify(options)])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 15s
  useEffect(() => {
    if (!supabase) return
    const iv = setInterval(fetchData, 15000)
    return () => clearInterval(iv)
  }, [fetchData])

  return { data, loading, refetch: fetchData }
}

// ─── TRIAL RUN DATA (8504) ──────────────────────────────────
const TRIAL = {
  hs4: '8504', commodity: 'Elec Transformers, Static Converters, Inductors',
  val_m: 2057.9, drill_score: 86.74, bcd_rate: 15, hs8_count: 23,
  phase2: {
    sources: [
      { name:'Alibaba', suppliers:562, fob_low:12.50, fob_high:1682, gold_pct:18, moq:'1-100 pcs', url:'alibaba.com' },
      { name:'Made-in-China', suppliers:483, fob_low:7.85, fob_high:890, gold_pct:22, moq:'5-50 pcs', url:'made-in-china.com' },
      { name:'DHgate', suppliers:225, fob_low:15.00, fob_high:450, gold_pct:0, moq:'1-10 pcs', url:'dhgate.com' },
    ],
    total_suppliers: 1270, fob_range: '$7.85 - $1,682', fob_typical: '$50-$75',
    keywords: ['electric inverters','battery chargers','rectifiers','transformers under 1 kva','electric power machinery parts'],
    verdict: 'PASS', notes: 'Strong supply base. 1,270 suppliers across 3 platforms.'
  },
  phase2b: {
    bcd: 15, igst: 18, sws: 1.5, aidc: 20, total_duty: 49.152,
    add_status: 'NONE', safeguard: 'NONE', dgft: 'FREE',
    bis_qco: true, wpc: false, tec: false, epr: true, pmp: false,
    fta_benefit: 'ASEAN FTA: BCD 5% via Thailand/Vietnam (saves 10%)',
    risk_level: 'HIGH', risk_score: 5,
    notes: 'BIS QCO required (add 1-3L + 6-12 weeks). AIDC 20% increases total duty to 49.15%. ASEAN FTA opportunity via Thailand/Vietnam at 5% BCD.',
    checks: [
      { check:'Anti-Dumping', result:'NONE', status:'PASS' },
      { check:'Safeguard Duty', result:'NONE', status:'PASS' },
      { check:'AIDC', result:'20%', status:'FLAG' },
      { check:'DGFT Restriction', result:'FREE', status:'PASS' },
      { check:'BIS QCO', result:'REQUIRED', status:'FLAG' },
      { check:'WPC', result:'NOT REQUIRED', status:'PASS' },
      { check:'TEC', result:'NOT REQUIRED', status:'PASS' },
      { check:'EPR E-Waste', result:'REQUIRED', status:'FLAG' },
      { check:'PMP', result:'NOT APPLICABLE', status:'PASS' },
      { check:'SWS', result:'10% of BCD', status:'PASS' },
      { check:'FTA Opportunity', result:'ASEAN 5% BCD', status:'OPPORTUNITY' },
      { check:'Import Policy', result:'FREE', status:'PASS' },
      { check:'Pending ADD', result:'NONE', status:'PASS' },
    ]
  },
  phase3: {
    sources: [
      { name:'IndiaMART', sellers:15000, price_low:350, price_high:500000, mfr_pct:40, trader_pct:60, url:'indiamart.com' },
      { name:'TradeIndia', sellers:3000, price_low:500, price_high:350000, mfr_pct:35, trader_pct:65, url:'tradeindia.com' },
    ],
    total_sellers: 18000, manufacturer_pct: 40, trader_pct: 60,
    price_range: '₹350 - ₹5,00,000', typical_price: '₹8,000',
    top_cities: ['Mumbai','Delhi','Ahmedabad','Pune','Chennai'],
    keywords: ['electric inverters','battery chargers','power transformers','UPS systems','rectifiers'],
    margin: { fob_usd:50, landed_inr:6339, sell_inr:8000, gross_pct:20.8, duty_multiplier:1.49152 },
    verdict: 'PASS', notes: '18,000 sellers. 20.8% gross margin. 60% trader market = good entry.'
  },
  phase4: {
    unique_buyers: 79, buyer_hhi: 838, china_pct: 69, median_cif: 1247,
    total_shipments: 255, total_cif: 8200000,
    top_buyers: [
      { name:'Schneider Electric', shipments:23, cif:571000 },
      { name:'ABB India', shipments:18, cif:423000 },
      { name:'Havells India', shipments:15, cif:312000 },
      { name:'Siemens Ltd', shipments:12, cif:289000 },
      { name:'Luminous Power', shipments:9, cif:198000 },
    ],
    verdict: 'PASS', notes: 'Well-distributed market (HHI 838). 79 unique buyers. 69% China sourcing.'
  },
  phase5: {
    total: 101, verdict: 'STRONG',
    factors: [
      { name:'Gross Margin', pts:15, max:25, tier:'>20%=15' },
      { name:'Buyer Accessibility', pts:20, max:20, tier:'>30 buyers=20' },
      { name:'Supply Reliability', pts:15, max:15, tier:'>20 Gold=15' },
      { name:'Market Size', pts:15, max:15, tier:'$50M+=15' },
      { name:'Regulatory Risk', pts:5, max:15, tier:'HIGH=5' },
      { name:'Competition', pts:2, max:10, tier:'High=2' },
      { name:'Growth Trend', pts:10, max:10, tier:'>10%=10' },
      { name:'Working Capital', pts:6, max:10, tier:'15-30L=6' },
      { name:'Logistics', pts:6, max:10, tier:'12-18%=6' },
      { name:'Obsolescence', pts:5, max:10, tier:'Mod=5' },
      { name:'Capital Required', pts:2, max:5, tier:'Med=3' },
      { name:'FTA Opportunity', pts:0, max:5, tier:'Partial=3' },
    ],
    notes: 'STRONG candidate. 20.8% margin. BIS QCO main barrier but manageable. ASEAN FTA recommended to reduce 49% duty.'
  }
}

// ─── 38 DATA SOURCES ────────────────────────────────────────
const SOURCES = [
  { id:1, name:'Alibaba.com', status:'WORKING', category:'China Supply', notes:'Keyword search, FOB, MOQ, suppliers' },
  { id:2, name:'Made-in-China', status:'WORKING', category:'China Supply', notes:'Products, FOB prices' },
  { id:3, name:'DHgate', status:'WORKING', category:'China Supply', notes:'Via screenshot extraction' },
  { id:4, name:'1688.com', status:'WORKING', category:'China Supply', notes:'Chinese, needs translation' },
  { id:5, name:'Global Sources', status:'BLOCKED', category:'China Supply', notes:'404 error, app-only' },
  { id:6, name:'HKTDC', status:'BLOCKED', category:'China Supply', notes:'Page Not Found' },
  { id:7, name:'ImportYeti', status:'PARTIAL', category:'China Supply', notes:'Company name only' },
  { id:8, name:'Panjiva', status:'PAID', category:'China Supply', notes:'S&P subscription' },
  { id:9, name:'Tendata', status:'PAID', category:'China Supply', notes:'Subscription required' },
  { id:10, name:'SGS/BV', status:'PAID', category:'China Supply', notes:'Verification service' },
  { id:11, name:'ExportGenius', status:'PAID', category:'China Supply', notes:'Subscription required' },
  { id:12, name:'GACC', status:'BLOCKED', category:'China Supply', notes:'Geo-blocked' },
  { id:13, name:'IndiaMART', status:'WORKING', category:'India Demand', notes:'Sellers, INR prices' },
  { id:14, name:'TradeIndia', status:'WORKING', category:'India Demand', notes:'Products, prices' },
  { id:15, name:'JustDial', status:'WORKING', category:'India Demand', notes:'Local business listings' },
  { id:16, name:'Google Trends', status:'WORKING', category:'India Demand', notes:'Demand validation' },
  { id:17, name:'Connect2India', status:'DEAD', category:'India Demand', notes:'Domain for sale' },
  { id:18, name:'Indian Trade Portal', status:'PARTIAL', category:'India Demand', notes:'Manual nav only' },
  { id:19, name:'ImportDuty.in', status:'WORKING', category:'Regulatory', notes:'BCD/IGST/SWS/ADD/FTA' },
  { id:20, name:'Seair', status:'PARTIAL', category:'India Demand', notes:'Sample data free' },
  { id:21, name:'Google Maps', status:'WORKING', category:'India Demand', notes:'Mfr contacts' },
  { id:22, name:'Qichacha', status:'WORKING', category:'Company Verify', notes:'Chinese company registry' },
  { id:23, name:'DGTR', status:'WORKING', category:'Regulatory', notes:'ADD investigations' },
  { id:24, name:'DGFT', status:'WORKING', category:'Regulatory', notes:'IEC + restrictions' },
  { id:25, name:'BIS', status:'WORKING', category:'Regulatory', notes:'QCO product list' },
  { id:26, name:'WPC', status:'WORKING', category:'Regulatory', notes:'ETA search' },
  { id:27, name:'TEC', status:'WORKING', category:'Regulatory', notes:'Telecom cert' },
  { id:28, name:'CPCB', status:'WORKING', category:'Regulatory', notes:'E-waste EPR' },
  { id:29, name:'MeitY PMP', status:'BLOCKED', category:'Regulatory', notes:'JS renders empty' },
  { id:30, name:'ICEGATE', status:'WORKING', category:'Regulatory', notes:'Tariff + COO' },
  { id:31, name:'TradeSTAT', status:'WORKING', category:'Regulatory', notes:'HS import values' },
  { id:32, name:'Zauba', status:'WORKING', category:'Regulatory', notes:'Import data' },
  { id:33, name:'Tofler', status:'WORKING', category:'Company Verify', notes:'Company search' },
  { id:34, name:'GST Portal', status:'WORKING', category:'Company Verify', notes:'GSTIN search' },
  { id:35, name:'MCA Portal', status:'WORKING', category:'Company Verify', notes:'Company registry' },
  { id:36, name:'LinkedIn', status:'WORKING', category:'Company Verify', notes:'Company profiles' },
  { id:37, name:'Volza', status:'WORKING', category:'Company Verify', notes:'Active account' },
  { id:38, name:'DGFT IEC', status:'WORKING', category:'Company Verify', notes:'IEC query' },
]

// ─── DEMO DATA ──────────────────────────────────────────────
const DEMO_CODES = [
  { hs4:'8504', commodity:'Elec Transformers/Inverters', val_m:2057.9, drill_score:86.74,
    current_phase:'COMPLETE', final_verdict:'STRONG', qa_status:'PASSED',
    phase2_status:'DONE', phase2b_status:'DONE', phase3_status:'DONE',
    phase4_status:'DONE', phase5_status:'DONE', bcd_rate:15, hs8_count:23, growth_1yr:12.5 },
  ...[
    ['8517','Telecom Equipment',8605,86.74,12],['8524','Flat Panel Displays',2659.9,86.74,8],
    ['8536','Switching Apparatus',2218.9,84.24,15],['8507','Electric Accumulators',4034.4,82.24,22],
    ['8516','Electric Heaters',546.2,82.24,5],['8544','Insulated Wire/Cable',1799.2,81.74,9],
    ['8523','Recorded Media',3207.5,80.24,3],['8471','Data Processing Machines',7851.2,79.24,-2],
    ['8542','Electronic ICs',12766.5,78.24,18],['8501','Electric Motors',1534.1,77.5,7],
    ['8532','Electrical Capacitors',412.3,76.2,11],['8533','Electrical Resistors',298.7,75.8,6],
    ['8535','Switchgear >1kV',876.4,74.9,4],['8538','Switchgear Parts',1123.6,74.1,8],
    ['8539','Electric Filament Lamps',234.5,73.5,3],['8541','Semiconductor Devices',2345.6,72.8,25],
    ['8543','Electrical Machines NES',567.8,71.2,9],['8545','Carbon Electrodes',189.3,70.5,2],
  ].map(([hs4,c,v,d,g])=>({ hs4, commodity:c, val_m:v, drill_score:d, growth_1yr:g,
    current_phase:'pending', final_verdict:null, qa_status:null,
    phase2_status:'pending', phase2b_status:'pending', phase3_status:'pending',
    phase4_status:'pending', phase5_status:'pending', bcd_rate:15, hs8_count:10 }))
]

// ─── TABS ───────────────────────────────────────────────────
const TAB_GROUPS = [
  { group:'Operations', tabs:[
    { id:'command', icon:'🎯', label:'Command Center' },
    { id:'agents', icon:'🤖', label:'Agent Monitor' },
    { id:'feed', icon:'📡', label:'Live Feed' },
  ]},
  { group:'Research', tabs:[
    { id:'pipeline', icon:'🚀', label:'Pipeline' },
    { id:'codes', icon:'📋', label:'All Codes' },
    { id:'detail', icon:'🔍', label:'Code Detail' },
  ]},
  { group:'Analysis', tabs:[
    { id:'trial', icon:'🧪', label:'Trial Run 8504' },
    { id:'scoring', icon:'⚡', label:'Scoring Matrix' },
    { id:'sources', icon:'🌐', label:'Data Sources' },
  ]},
  { group:'System', tabs:[
    { id:'log', icon:'📝', label:'Research Log' },
  ]},
]

// ─── COMMAND CENTER TAB ─────────────────────────────────────
function CommandCenter({ codes, agents, activity }) {
  const total = codes.length
  const complete = codes.filter(c => c.current_phase === 'COMPLETE').length
  const pending = codes.filter(c => c.current_phase === 'pending').length
  const killed = codes.filter(c => c.kill_phase).length
  const strong = codes.filter(c => c.final_verdict === 'STRONG' || c.final_verdict === 'PURSUE').length
  const totalVal = codes.reduce((s,c) => s + (c.val_m || 0), 0)
  const activeAgents = agents.filter(a => a.status === 'running' || a.status === 'scraping').length
  const totalDataPts = agents.reduce((s,a) => s + (a.data_points_collected || 0), 0)

  const verdictData = [
    { name:'PURSUE', value: codes.filter(c=>c.final_verdict==='PURSUE').length },
    { name:'STRONG', value: codes.filter(c=>c.final_verdict==='STRONG').length },
    { name:'MODERATE', value: codes.filter(c=>c.final_verdict==='MODERATE').length },
    { name:'DROP', value: codes.filter(c=>c.final_verdict==='DROP').length },
    { name:'Pending', value: codes.filter(c=>!c.final_verdict).length },
  ].filter(d => d.value > 0)

  const topByVal = [...codes].sort((a,b) => (b.val_m||0) - (a.val_m||0)).slice(0,12)
    .map(c => ({ name: c.hs4, val: Math.round(c.val_m || 0) }))

  const recentActivity = (activity || []).slice(0, 8)

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:18 }}>
        <KPI icon="📦" label="Total Codes" value={total} color={C.blue} />
        <KPI icon="✅" label="Completed" value={complete} color={C.green} sub={`${Math.round(complete/total*100)}%`} />
        <KPI icon="⏳" label="Pending" value={pending} color={C.yellow} />
        <KPI icon="💀" label="Killed" value={killed} color={C.red} />
        <KPI icon="🏆" label="Winners" value={strong} color={C.cyan} />
        <KPI icon="💰" label="Trade Value" value={`$${(totalVal/1000).toFixed(1)}B`} color={C.blue} />
        <KPI icon="🤖" label="Active Agents" value={`${activeAgents}/30`} color={activeAgents>0?C.green:C.tx2} />
        <KPI icon="📊" label="Data Points" value={totalDataPts.toLocaleString()} color={C.cyan} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
        <Card title="🎯 Verdict Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={verdictData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                label={({name,value}) => value > 0 ? `${name}: ${value}` : ''} labelLine={false}>
                {verdictData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, color:C.tx1 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="📦 Top Codes by Trade Value ($M)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topByVal} layout="vertical">
              <XAxis type="number" tick={{ fill:C.tx2, fontSize:10 }} />
              <YAxis type="category" dataKey="name" width={40} tick={{ fill:C.tx2, fontSize:10 }} />
              <Tooltip contentStyle={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, color:C.tx1 }} />
              <Bar dataKey="val" fill={C.blue} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="🤖 Agent Fleet">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:4 }}>
            {agents.slice(0,30).map((a,i) => (
              <div key={i} title={`${a.agent_name}: ${a.status}`} style={{
                width:28, height:28, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, color:C.bg,
                background: a.status === 'running' ? C.green : a.status === 'error' ? C.red : a.status === 'cooldown' ? C.orange : C.bg3,
                border: `1px solid ${a.status === 'running' ? C.green : C.border}40`,
              }}>{i+1}</div>
            ))}
          </div>
          <div style={{ marginTop:8, display:'flex', gap:12, fontSize:10, color:C.tx2 }}>
            <span><span style={{color:C.green}}>●</span> Running</span>
            <span><span style={{color:C.orange}}>●</span> Cooldown</span>
            <span><span style={{color:C.red}}>●</span> Error</span>
            <span><span style={{color:C.tx2}}>●</span> Idle</span>
          </div>
        </Card>
      </div>

      <Card title="📡 Recent Activity" style={{ marginTop:14 }}>
        {recentActivity.length === 0
          ? <p style={{ color:C.tx2, fontSize:13 }}>No activity yet. Deploy agents to begin research.</p>
          : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {recentActivity.map((a, i) => (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:10, color:C.tx2, width:60, flexShrink:0 }}>{a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}</span>
                  <Badge text={a.status} />
                  <span style={{ fontWeight:600, color:C.blue, width:40 }}>{a.hs4}</span>
                  <span style={{ fontSize:12, color:C.tx2, flex:1 }}>{a.action}</span>
                  <span style={{ fontSize:10, color:C.tx2 }}>{a.agent_id}</span>
                </div>
              ))}
            </div>
        }
      </Card>
    </div>
  )
}

// ─── AGENT MONITOR TAB ──────────────────────────────────────
function AgentMonitor({ agents, activity }) {
  const grouped = useMemo(() => {
    const g = {}
    agents.forEach(a => { const t = a.agent_type || 'other'; if (!g[t]) g[t] = []; g[t].push(a) })
    return g
  }, [agents])

  const typeLabels = { supply:'🏭 China Supply', demand:'🇮🇳 India Demand', regulatory:'📋 Regulatory',
    verify:'🔍 Company Verify', aggregator:'🔗 Aggregator', qa:'✅ QA Gate', scoring:'⚡ Scoring' }

  const agentCols = [
    { key:'agent_name', label:'Agent', render: v => <span style={{fontWeight:600}}>{v}</span> },
    { key:'source_name', label:'Source' },
    { key:'status', label:'Status', filterable:true, render: v => <Badge text={v} /> },
    { key:'current_hs4', label:'Current HS4', render: v => v ? <span style={{color:C.blue,fontWeight:600}}>{v}</span> : '—' },
    { key:'current_task', label:'Task', style:{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'} },
    { key:'codes_completed', label:'Done', render: v => <span style={{color:C.green}}>{v||0}</span> },
    { key:'codes_failed', label:'Failed', render: v => v > 0 ? <span style={{color:C.red}}>{v}</span> : '0' },
    { key:'error_count', label:'Errors', render: v => v > 0 ? <span style={{color:C.red}}>{v}</span> : '0' },
    { key:'data_points_collected', label:'Data Pts', render: v => (v||0).toLocaleString() },
    { key:'last_heartbeat', label:'Last Beat', render: v => v ? new Date(v).toLocaleTimeString() : '—' },
  ]

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        <KPI icon="🤖" label="Total Agents" value={agents.length} color={C.blue} />
        <KPI icon="🟢" label="Running" value={agents.filter(a=>a.status==='running').length} color={C.green} />
        <KPI icon="🟡" label="Idle" value={agents.filter(a=>a.status==='idle').length} color={C.yellow} />
        <KPI icon="🔴" label="Errors" value={agents.filter(a=>a.status==='error').length} color={C.red} />
        <KPI icon="📊" label="Total Data Points" value={agents.reduce((s,a)=>s+(a.data_points_collected||0),0).toLocaleString()} color={C.cyan} />
      </div>

      {Object.entries(grouped).map(([type, agentList]) => (
        <Card key={type} title={typeLabels[type] || type} style={{ marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10 }}>
            {agentList.map(a => (
              <div key={a.agent_id} style={{ background:C.bg, borderRadius:8, padding:12, border:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{a.agent_name}</span>
                  <Badge text={a.status} />
                </div>
                <div style={{ fontSize:11, color:C.tx2, marginBottom:4 }}>{a.source_name || '—'}</div>
                {a.current_hs4 && <div style={{ fontSize:12 }}>HS4: <span style={{color:C.blue,fontWeight:600}}>{a.current_hs4}</span></div>}
                <div style={{ display:'flex', gap:12, marginTop:6, fontSize:11, color:C.tx2 }}>
                  <span>Done: <span style={{color:C.green}}>{a.codes_completed||0}</span></span>
                  <span>Err: <span style={{color:C.red}}>{a.error_count||0}</span></span>
                  <span>Pts: {(a.data_points_collected||0).toLocaleString()}</span>
                </div>
                {a.last_heartbeat && (
                  <div style={{ fontSize:10, color:C.tx2, marginTop:4 }}>
                    Last beat: {new Date(a.last_heartbeat).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card title="📋 Full Agent Table" style={{ marginTop:14 }}>
        <SortableTable columns={agentCols} data={agents} pageSize={30} />
      </Card>
    </div>
  )
}

// ─── LIVE FEED TAB ──────────────────────────────────────────
function LiveFeed({ activity }) {
  const actCols = [
    { key:'created_at', label:'Time', render: v => v ? new Date(v).toLocaleString() : '—', style:{fontSize:11,whiteSpace:'nowrap'} },
    { key:'agent_id', label:'Agent', render: v => <span style={{fontSize:11}}>{v}</span> },
    { key:'hs4', label:'HS4', render: v => v ? <span style={{color:C.blue,fontWeight:600}}>{v}</span> : '—' },
    { key:'phase', label:'Phase', filterable:true, render: v => <Badge text={v} /> },
    { key:'action', label:'Action', style:{maxWidth:300} },
    { key:'status', label:'Status', filterable:true, render: v => <Badge text={v} /> },
    { key:'duration_ms', label:'Duration', render: v => v ? `${(v/1000).toFixed(1)}s` : '—' },
  ]

  return (
    <div className="fade-in">
      <Card title="📡 Live Activity Stream (auto-refreshes every 15s)">
        <SortableTable columns={actCols} data={activity} pageSize={50} />
      </Card>
    </div>
  )
}

// ─── PIPELINE TAB ───────────────────────────────────────────
function PipelineTab({ codes }) {
  const stages = [
    { label:'Total Codes', count: codes.length, color: C.blue },
    { label:'P2 Alibaba Done', count: codes.filter(c=>c.phase2_status==='DONE').length, color: C.cyan },
    { label:'P2b Regulatory Done', count: codes.filter(c=>c.phase2b_status==='DONE').length, color: C.purple },
    { label:'P3 IndiaMART Done', count: codes.filter(c=>c.phase3_status==='DONE').length, color: C.yellow },
    { label:'QA Passed', count: codes.filter(c=>c.qa_status==='PASSED').length, color: C.green },
    { label:'P4 Volza Done', count: codes.filter(c=>c.phase4_status==='DONE').length, color: C.blue },
    { label:'P5 Scored', count: codes.filter(c=>c.phase5_status==='DONE').length, color: C.cyan },
    { label:'Complete', count: codes.filter(c=>c.current_phase==='COMPLETE').length, color: C.green },
  ]
  const maxC = Math.max(...stages.map(s=>s.count), 1)

  return (
    <div className="fade-in">
      <Card title="🚀 Research Pipeline Funnel">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {stages.map((s, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:150, fontSize:12, color:C.tx2, textAlign:'right' }}>{s.label}</div>
              <div style={{ flex:1, height:30, background:C.bg, borderRadius:6, overflow:'hidden', position:'relative' }}>
                <div style={{ width:`${(s.count/maxC)*100}%`, height:'100%', background:`linear-gradient(90deg, ${s.color}40, ${s.color}80)`,
                  borderRadius:6, transition:'width 0.5s ease', minWidth: s.count > 0 ? 40 : 0 }} />
                <span style={{ position:'absolute', left:10, top:6, fontSize:13, fontWeight:600, color:C.tx1 }}>{s.count}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:14 }}>
        <Card title="🏆 Completed">
          {codes.filter(c=>c.current_phase==='COMPLETE').length === 0
            ? <p style={{ color:C.tx2, fontSize:13 }}>No codes completed yet</p>
            : <table>
                <thead><tr><th>HS4</th><th>Product</th><th>Verdict</th><th>Score</th></tr></thead>
                <tbody>{codes.filter(c=>c.current_phase==='COMPLETE').map(c => (
                  <tr key={c.hs4}><td style={{fontWeight:600,color:C.blue}}>{c.hs4}</td>
                    <td>{(c.commodity||'').slice(0,30)}</td><td><Badge text={c.final_verdict} /></td>
                    <td>{c.drill_score}</td></tr>
                ))}</tbody>
              </table>
          }
        </Card>
        <Card title="💀 Killed">
          {codes.filter(c=>c.kill_phase).length === 0
            ? <p style={{ color:C.tx2, fontSize:13 }}>No codes killed yet</p>
            : <table>
                <thead><tr><th>HS4</th><th>Phase</th><th>Reason</th></tr></thead>
                <tbody>{codes.filter(c=>c.kill_phase).map(c => (
                  <tr key={c.hs4}><td style={{fontWeight:600,color:C.red}}>{c.hs4}</td>
                    <td>{c.kill_phase}</td><td style={{fontSize:12}}>{(c.kill_reason||'').slice(0,50)}</td></tr>
                ))}</tbody>
              </table>
          }
        </Card>
      </div>
    </div>
  )
}

// ─── ALL CODES TAB ──────────────────────────────────────────
function CodesTab({ codes, onSelect }) {
  const codeCols = [
    { key:'hs4', label:'HS4', render: (v,r) => <span style={{fontWeight:700,color:C.blue,cursor:'pointer'}} onClick={()=>onSelect(v)}>{v}</span> },
    { key:'commodity', label:'Product', style:{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'} },
    { key:'val_m', label:'Trade $M', render: v => v ? `$${v.toLocaleString()}` : '—' },
    { key:'drill_score', label:'Score', render: v => <span style={{fontWeight:600}}>{v}</span> },
    { key:'growth_1yr', label:'Growth%', render: v => v != null ? <span style={{color:v>0?C.green:C.red}}>{v>0?'+':''}{v}%</span> : '—' },
    { key:'bcd_rate', label:'BCD%' },
    { key:'current_phase', label:'Phase', filterable:true, render: v => <Badge text={v} /> },
    { key:'phase2_status', label:'P2', render: v => <Badge text={v} /> },
    { key:'phase2b_status', label:'P2b', render: v => <Badge text={v} /> },
    { key:'phase3_status', label:'P3', render: v => <Badge text={v} /> },
    { key:'phase4_status', label:'P4', render: v => <Badge text={v} /> },
    { key:'phase5_status', label:'P5', render: v => <Badge text={v} /> },
    { key:'final_verdict', label:'Verdict', filterable:true, render: v => <Badge text={v} /> },
    { key:'qa_status', label:'QA', filterable:true, render: v => <Badge text={v} /> },
  ]

  return (
    <div className="fade-in">
      <SortableTable columns={codeCols} data={codes} onRowClick={r => onSelect(r.hs4)} pageSize={30} />
    </div>
  )
}

// ─── CODE DETAIL TAB ────────────────────────────────────────
function DetailTab({ hs4, codes, p2Data, p3Data, p4Data, scoringData }) {
  const code = codes.find(c => c.hs4 === hs4)
  if (!code) return <Card><p style={{color:C.tx2}}>Select a code from the All Codes tab to view details.</p></Card>

  const p2 = (p2Data || []).find(d => d.hs4 === hs4)
  const p3 = (p3Data || []).find(d => d.hs4 === hs4)
  const p4 = (p4Data || []).find(d => d.hs4 === hs4)
  const sc = (scoringData || []).find(d => d.hs4 === hs4)

  const Section = ({ title, items }) => (
    <Card title={title} style={{ marginBottom:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:8 }}>
        {items.map(([label, val, color]) => (
          <div key={label}>
            <span style={{ fontSize:11, color:C.tx2 }}>{label}</span>
            <div style={{ fontSize:14, fontWeight:500, color: color || C.tx1 }}>{val ?? '—'}</div>
          </div>
        ))}
      </div>
    </Card>
  )

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:12, marginBottom:14, flexWrap:'wrap' }}>
        <KPI label="HS4" value={hs4} color={C.blue} />
        <KPI label="Product" value={(code.commodity||'').slice(0,25)} />
        <KPI label="Trade $M" value={`$${(code.val_m||0).toLocaleString()}`} color={C.cyan} />
        <KPI label="Phase" value={code.current_phase} color={code.current_phase==='COMPLETE'?C.green:C.yellow} />
        <KPI label="Verdict" value={code.final_verdict || 'Pending'} />
      </div>
      <Section title="🔷 Phase 2 — Supply" items={[
        ['Suppliers', p2?.total_suppliers], ['FOB Low', p2?.fob_lowest_usd ? `$${p2.fob_lowest_usd}` : null],
        ['FOB High', p2?.fob_highest_usd ? `$${p2.fob_highest_usd}` : null], ['Gold %', p2?.gold_supplier_pct != null ? `${p2.gold_supplier_pct}%` : null],
        ['MOQ', p2?.typical_moq],
      ]} />
      <Section title="🟡 Phase 3 — Demand" items={[
        ['Sellers', p3?.total_sellers], ['Mfr %', p3?.manufacturer_pct ? `${p3.manufacturer_pct}%` : null],
        ['Price Low', p3?.price_low_inr ? `₹${p3.price_low_inr.toLocaleString()}` : null],
        ['Margin', p3?.gross_margin_pct ? `${p3.gross_margin_pct}%` : null, p3?.gross_margin_pct>20?C.green:C.yellow],
      ]} />
      <Section title="🚢 Phase 4 — Volza" items={[
        ['Buyers', p4?.unique_buyers], ['HHI', p4?.buyer_hhi], ['China %', p4?.china_sourcing_pct ? `${p4.china_sourcing_pct}%` : null],
        ['Median CIF', p4?.median_cif_usd ? `$${p4.median_cif_usd}` : null],
      ]} />
      {sc && <Section title="⚡ Phase 5 — Score" items={[
        ['Total', `${sc.total_score}/150`, sc.total_score>=90?C.green:C.yellow],
        ['Verdict', sc.final_verdict], ['Notes', sc.go_nogo_notes],
      ]} />}
    </div>
  )
}

// ─── TRIAL RUN TAB ──────────────────────────────────────────
function TrialRunTab() {
  const [sub, setSub] = useState('overview')
  const T = TRIAL

  const subTabs = [
    { id:'overview', icon:'📊', label:'Overview' },
    { id:'supply', icon:'🏭', label:'Supply (P2)' },
    { id:'regulatory', icon:'📋', label:'Regulatory (P2b)' },
    { id:'demand', icon:'🇮🇳', label:'Demand (P3)' },
    { id:'volza', icon:'🚢', label:'Volza (P4)' },
    { id:'score', icon:'⚡', label:'Scoring (P5)' },
  ]

  return (
    <div className="fade-in">
      <SubTab tabs={subTabs} active={sub} onChange={setSub} />

      {sub === 'overview' && (
        <div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            <KPI icon="📦" label="HS4 Code" value={T.hs4} color={C.blue} />
            <KPI icon="💰" label="Trade Value" value={`$${T.val_m.toLocaleString()}M`} color={C.cyan} />
            <KPI icon="📊" label="Drill Score" value={T.drill_score} color={C.blue} />
            <KPI icon="⚡" label="Final Score" value={`${T.phase5.total}/150`} color={C.green} />
            <KPI icon="🏆" label="Verdict" value={T.phase5.verdict} color={C.green} />
            <KPI icon="💵" label="Gross Margin" value={`${T.phase3.margin.gross_pct}%`} color={C.green} />
            <KPI icon="🏷️" label="Total Duty" value={`${T.phase2b.total_duty}%`} color={C.red} />
            <KPI icon="🏭" label="Suppliers" value={T.phase2.total_suppliers.toLocaleString()} color={C.cyan} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Card title="📊 150-Point Scoring Radar">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={T.phase5.factors.map(f => ({ factor:f.name, score:f.pts, max:f.max }))}>
                  <PolarGrid stroke={C.border} />
                  <PolarAngleAxis dataKey="factor" tick={{ fill:C.tx2, fontSize:9 }} />
                  <PolarRadiusAxis tick={{ fill:C.tx2, fontSize:9 }} domain={[0, 25]} />
                  <Radar dataKey="score" stroke={C.blue} fill={C.blue} fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="📊 Factor Breakdown">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={T.phase5.factors.map(f => ({ name:f.name, scored:f.pts, gap:f.max-f.pts }))} layout="vertical">
                  <XAxis type="number" tick={{ fill:C.tx2, fontSize:10 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill:C.tx2, fontSize:10 }} />
                  <Tooltip contentStyle={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, color:C.tx1 }} />
                  <Bar dataKey="scored" stackId="a" fill={C.green} />
                  <Bar dataKey="gap" stackId="a" fill={`${C.tx2}30`} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="📝 Final Assessment" style={{ marginTop:14 }}>
            <p style={{ fontSize:13, lineHeight:1.8, color:C.tx2 }}>{T.phase5.notes}</p>
          </Card>
        </div>
      )}

      {sub === 'supply' && (
        <div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            <KPI icon="🏭" label="Total Suppliers" value={T.phase2.total_suppliers.toLocaleString()} color={C.cyan} />
            <KPI icon="💲" label="FOB Range" value={T.phase2.fob_range} color={C.blue} />
            <KPI icon="📦" label="Typical FOB" value={T.phase2.fob_typical} color={C.green} />
            <KPI icon="✅" label="Verdict" value={T.phase2.verdict} color={C.green} />
          </div>
          <Card title="🏭 Supply Sources">
            <SortableTable columns={[
              { key:'name', label:'Source', render: v => <span style={{fontWeight:600}}>{v}</span> },
              { key:'suppliers', label:'Suppliers', render: v => v.toLocaleString() },
              { key:'fob_low', label:'FOB Low', render: v => `$${v}` },
              { key:'fob_high', label:'FOB High', render: v => `$${v}` },
              { key:'gold_pct', label:'Gold %', render: v => `${v}%` },
              { key:'moq', label:'MOQ' },
              { key:'url', label:'URL', style:{fontSize:11,color:C.tx2} },
            ]} data={T.phase2.sources} searchable={false} />
          </Card>
          <Card title="🔍 Search Keywords Used" style={{ marginTop:12 }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {T.phase2.keywords.map(k => (
                <span key={k} style={{ padding:'4px 10px', borderRadius:20, fontSize:11, background:C.blueBg, color:C.blue, border:`1px solid ${C.blue}30` }}>{k}</span>
              ))}
            </div>
          </Card>
        </div>
      )}

      {sub === 'regulatory' && (
        <div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            <KPI icon="📋" label="BCD" value={`${T.phase2b.bcd}%`} />
            <KPI icon="📋" label="IGST" value={`${T.phase2b.igst}%`} />
            <KPI icon="📋" label="SWS" value={`${T.phase2b.sws}%`} />
            <KPI icon="📋" label="AIDC" value={`${T.phase2b.aidc}%`} color={C.red} />
            <KPI icon="💰" label="Total Duty" value={`${T.phase2b.total_duty}%`} color={C.red} />
            <KPI icon="⚠️" label="Risk Level" value={T.phase2b.risk_level} color={C.red} />
          </div>
          <Card title="✅ 13-Point Regulatory Checklist">
            <SortableTable columns={[
              { key:'check', label:'Check', render: v => <span style={{fontWeight:500}}>{v}</span> },
              { key:'result', label:'Result' },
              { key:'status', label:'Status', filterable:true, render: v => <Badge text={v} /> },
            ]} data={T.phase2b.checks} searchable={false} />
          </Card>
          <Card title="🌏 FTA Opportunity" style={{ marginTop:12 }}>
            <p style={{ fontSize:13, color:C.cyan }}>{T.phase2b.fta_benefit}</p>
          </Card>
          <Card title="📝 Notes" style={{ marginTop:12 }}>
            <p style={{ fontSize:13, lineHeight:1.7, color:C.tx2 }}>{T.phase2b.notes}</p>
          </Card>
        </div>
      )}

      {sub === 'demand' && (
        <div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            <KPI icon="🇮🇳" label="Total Sellers" value={T.phase3.total_sellers.toLocaleString()} color={C.cyan} />
            <KPI icon="🏭" label="Manufacturers" value={`${T.phase3.manufacturer_pct}%`} />
            <KPI icon="🔄" label="Traders" value={`${T.phase3.trader_pct}%`} />
            <KPI icon="💵" label="Gross Margin" value={`${T.phase3.margin.gross_pct}%`} color={C.green} />
            <KPI icon="✅" label="Verdict" value={T.phase3.verdict} color={C.green} />
          </div>
          <Card title="🇮🇳 Demand Sources">
            <SortableTable columns={[
              { key:'name', label:'Source', render: v => <span style={{fontWeight:600}}>{v}</span> },
              { key:'sellers', label:'Sellers', render: v => v.toLocaleString() },
              { key:'price_low', label:'Price Low', render: v => `₹${v.toLocaleString()}` },
              { key:'price_high', label:'Price High', render: v => `₹${v.toLocaleString()}` },
              { key:'mfr_pct', label:'Mfr %', render: v => `${v}%` },
              { key:'trader_pct', label:'Trader %', render: v => `${v}%` },
            ]} data={T.phase3.sources} searchable={false} />
          </Card>
          <Card title="💰 Margin Calculation" style={{ marginTop:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
              {[['FOB Price (USD)', `$${T.phase3.margin.fob_usd}`],
                ['Duty Multiplier', `×${T.phase3.margin.duty_multiplier}`],
                ['Landed Cost (INR)', `₹${T.phase3.margin.landed_inr.toLocaleString()}`],
                ['Sell Price (INR)', `₹${T.phase3.margin.sell_inr.toLocaleString()}`],
                ['Gross Margin', `${T.phase3.margin.gross_pct}%`, C.green],
              ].map(([l,v,c]) => (
                <div key={l}><span style={{fontSize:11,color:C.tx2}}>{l}</span>
                  <div style={{fontSize:16,fontWeight:600,color:c||C.tx1}}>{v}</div></div>
              ))}
            </div>
          </Card>
          <Card title="🏙️ Top Cities" style={{ marginTop:12 }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {T.phase3.top_cities.map(c => (
                <span key={c} style={{ padding:'4px 10px', borderRadius:20, fontSize:11, background:C.greenBg, color:C.green, border:`1px solid ${C.green}30` }}>{c}</span>
              ))}
            </div>
          </Card>
        </div>
      )}

      {sub === 'volza' && (
        <div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            <KPI icon="👥" label="Unique Buyers" value={T.phase4.unique_buyers} color={C.cyan} />
            <KPI icon="📊" label="Buyer HHI" value={T.phase4.buyer_hhi} color={C.green} sub="<2500 = distributed" />
            <KPI icon="🇨🇳" label="China Sourcing" value={`${T.phase4.china_pct}%`} color={C.blue} />
            <KPI icon="💰" label="Median CIF" value={`$${T.phase4.median_cif.toLocaleString()}`} />
            <KPI icon="🚢" label="Total Shipments" value={T.phase4.total_shipments} />
          </div>
          <Card title="🎯 Top Buyers">
            <SortableTable columns={[
              { key:'name', label:'Company', render: v => <span style={{fontWeight:600}}>{v}</span> },
              { key:'shipments', label:'Shipments' },
              { key:'cif', label:'Total CIF', render: v => `$${v.toLocaleString()}` },
            ]} data={T.phase4.top_buyers} searchable={false} />
          </Card>
        </div>
      )}

      {sub === 'score' && (
        <div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            <KPI icon="⚡" label="Total Score" value={`${T.phase5.total}/150`} color={C.green} />
            <KPI icon="🏆" label="Verdict" value={T.phase5.verdict} color={C.green} />
          </div>
          <Card title="📊 150-Point Scoring Breakdown">
            <SortableTable columns={[
              { key:'name', label:'Factor', render: v => <span style={{fontWeight:500}}>{v}</span> },
              { key:'pts', label:'Points', render: (v,r) => <span style={{fontWeight:700,color:v>=r.max*0.7?C.green:v>=r.max*0.4?C.yellow:C.red}}>{v}</span> },
              { key:'max', label:'Max' },
              { key:'tier', label:'Tier Applied', style:{fontSize:12,color:C.tx2} },
            ]} data={T.phase5.factors} searchable={false} />
          </Card>
          <Card title="🎯 Scoring Radar" style={{ marginTop:14 }}>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={T.phase5.factors.map(f => ({ factor:f.name, score:f.pts, max:f.max }))}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="factor" tick={{ fill:C.tx2, fontSize:10 }} />
                <PolarRadiusAxis tick={{ fill:C.tx2, fontSize:9 }} domain={[0, 25]} />
                <Radar dataKey="score" stroke={C.cyan} fill={C.cyan} fillOpacity={0.3} />
                <Radar dataKey="max" stroke={C.tx2} fill="none" strokeDasharray="3 3" />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── SCORING MATRIX TAB ─────────────────────────────────────
function ScoringMatrixTab() {
  const matrix = [
    { factor:'Gross Margin %', max:25, tiers:'>30% = 25 | 20-30% = 15 | 10-20% = 8 | <10% = KILL' },
    { factor:'Buyer Accessibility', max:20, tiers:'>30 buyers = 20 | 10-30 = 10 | <10 = 5' },
    { factor:'Supply Reliability', max:15, tiers:'>20 Gold = 15 | 10-20 = 8 | <5 = KILL' },
    { factor:'Market Size', max:15, tiers:'$50M+ = 15 | $20-50M = 10 | $5-20M = 5' },
    { factor:'Regulatory Risk', max:15, tiers:'LOW = 15 | MED = 10 | HIGH = 5 | CRIT = 0' },
    { factor:'Competition Level', max:10, tiers:'Low = 10 | Med = 6 | High = 2' },
    { factor:'Growth Trend', max:10, tiers:'>10% = 10 | 5-10% = 6 | 0-5% = 3' },
    { factor:'Working Capital', max:10, tiers:'<15L = 10 | 15-30L = 6 | >50L = 2' },
    { factor:'Logistics Overhead', max:10, tiers:'<12% = 10 | 12-18% = 6 | >18% = 2' },
    { factor:'Obsolescence Risk', max:10, tiers:'Stable = 10 | Moderate = 5 | Fast = 0' },
    { factor:'Capital Required', max:5, tiers:'Low = 5 | Med = 3 | High = 1' },
    { factor:'FTA Opportunity', max:5, tiers:'Available = 5 | Partial = 3 | None = 0' },
  ]

  const verdicts = [
    { range:'120-150', verdict:'PURSUE', color:C.cyan, desc:'Top-tier opportunity. Fast-track to market entry.' },
    { range:'90-119', verdict:'STRONG', color:C.green, desc:'Strong candidate. Worth pursuing with minor risk mitigation.' },
    { range:'60-89', verdict:'MODERATE', color:C.yellow, desc:'Has potential but significant barriers. Monitor or niche approach.' },
    { range:'<60', verdict:'DROP', color:C.red, desc:'Too many barriers or insufficient margin. Not viable for Phase 1.' },
  ]

  return (
    <div className="fade-in">
      <Card title="⚡ 150-Point Viability Scoring Matrix">
        <SortableTable columns={[
          { key:'factor', label:'Factor', render: v => <span style={{fontWeight:600}}>{v}</span> },
          { key:'max', label:'Max Pts', render: v => <span style={{fontWeight:700,color:C.blue}}>{v}</span> },
          { key:'tiers', label:'Scoring Tiers', style:{fontSize:12,color:C.tx2} },
        ]} data={matrix} searchable={false} />
      </Card>

      <Card title="🏆 Verdict Thresholds" style={{ marginTop:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {verdicts.map(v => (
            <div key={v.verdict} style={{ background:C.bg, borderRadius:8, padding:14, border:`1px solid ${v.color}30`, textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:700, color:v.color }}>{v.verdict}</div>
              <div style={{ fontSize:14, fontWeight:600, color:C.tx2, marginTop:4 }}>{v.range} pts</div>
              <div style={{ fontSize:11, color:C.tx2, marginTop:6 }}>{v.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── DATA SOURCES TAB ───────────────────────────────────────
function SourcesTab() {
  const working = SOURCES.filter(s => s.status === 'WORKING').length
  const partial = SOURCES.filter(s => s.status === 'PARTIAL').length
  const blocked = SOURCES.filter(s => s.status === 'BLOCKED' || s.status === 'DEAD').length

  const srcCols = [
    { key:'id', label:'#' },
    { key:'name', label:'Source', render: v => <span style={{fontWeight:600}}>{v}</span> },
    { key:'status', label:'Status', filterable:true, render: v => <Badge text={v} /> },
    { key:'category', label:'Category', filterable:true },
    { key:'notes', label:'Notes', style:{fontSize:12,color:C.tx2} },
  ]

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <KPI icon="🌐" label="Total Sources" value={SOURCES.length} color={C.blue} />
        <KPI icon="✅" label="Working" value={working} color={C.green} />
        <KPI icon="⚠️" label="Partial" value={partial} color={C.yellow} />
        <KPI icon="❌" label="Blocked/Dead" value={blocked} color={C.red} />
        <KPI icon="💳" label="Paid (Skip)" value={SOURCES.filter(s=>s.status==='PAID').length} color={C.purple} />
      </div>
      <Card title="🌐 38 Data Sources">
        <SortableTable columns={srcCols} data={SOURCES} pageSize={40} />
      </Card>
    </div>
  )
}

// ─── RESEARCH LOG TAB ───────────────────────────────────────
function ResearchLogTab({ logs }) {
  const logCols = [
    { key:'created_at', label:'Time', render: v => v ? new Date(v).toLocaleString() : '—', style:{fontSize:11,whiteSpace:'nowrap'} },
    { key:'agent_id', label:'Agent' },
    { key:'hs4', label:'HS4', render: v => v ? <span style={{color:C.blue,fontWeight:600}}>{v}</span> : '—' },
    { key:'phase', label:'Phase', filterable:true, render: v => <Badge text={v} /> },
    { key:'action', label:'Action', style:{maxWidth:400} },
    { key:'status', label:'Status', filterable:true, render: v => <Badge text={v} /> },
    { key:'duration_ms', label:'Duration', render: v => v ? `${(v/1000).toFixed(1)}s` : '—' },
  ]

  return (
    <div className="fade-in">
      <Card title="📝 Full Research Log">
        {logs.length === 0
          ? <p style={{ color:C.tx2, fontSize:13 }}>No log entries yet. Start research to see activity here.</p>
          : <SortableTable columns={logCols} data={logs} pageSize={50} />
        }
      </Card>
    </div>
  )
}

// ─── MAIN APP ───────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('command')
  const [selectedCode, setSelectedCode] = useState('8504')
  const live = isConfigured()

  // Supabase data hooks (auto-refresh 15s)
  const codesQ = useSupabase('research_codes', { order: 'drill_score' })
  const agentsQ = useSupabase('agent_registry', { order: 'agent_id', asc: true })
  const activityQ = useSupabase('agent_activity', { order: 'created_at', limit: 500 })
  const p2SumQ = useSupabase('phase2_alibaba_summary')
  const p3SumQ = useSupabase('phase3_indiamart_summary')
  const p4Q = useSupabase('phase4_volza')
  const scoringQ = useSupabase('phase5_scoring')
  const logsQ = useSupabase('research_log', { order: 'timestamp', limit: 500 })

  // Data with fallbacks
  const codes = live && codesQ.data.length > 0 ? codesQ.data : DEMO_CODES
  const agents = agentsQ.data.length > 0 ? agentsQ.data : []
  const activity = activityQ.data
  const p2Data = p2SumQ.data.length > 0 ? p2SumQ.data : [TRIAL.phase2]
  const p3Data = p3SumQ.data.length > 0 ? p3SumQ.data : [TRIAL.phase3]
  const p4Data = p4Q.data.length > 0 ? p4Q.data : [TRIAL.phase4]
  const scoringData = scoringQ.data.length > 0 ? scoringQ.data : [TRIAL.phase5]
  const logs = logsQ.data

  const handleSelectCode = (hs4) => { setSelectedCode(hs4); setTab('detail') }

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:'100vh', display:'flex' }}>
        {/* Sidebar */}
        <div style={{ width:210, background:C.bg2, borderRight:`1px solid ${C.border}`,
          padding:'14px 0', flexShrink:0, position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
          <div style={{ padding:'0 16px', marginBottom:16 }}>
            <h1 style={{ fontSize:15, fontWeight:700, color:C.tx1 }}>KALASH EXIM</h1>
            <div style={{ fontSize:10, color:C.tx2 }}>Intelligence Dashboard v2</div>
          </div>

          {TAB_GROUPS.map(g => (
            <div key={g.group}>
              <div style={{ padding:'8px 16px 4px', fontSize:10, fontWeight:600, color:C.tx2, textTransform:'uppercase', letterSpacing:1 }}>
                {g.group}
              </div>
              {g.tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display:'flex', alignItems:'center', gap:7, width:'100%', padding:'8px 16px',
                  background: tab === t.id ? C.blueBg : 'transparent',
                  color: tab === t.id ? C.blue : C.tx2, border:'none', cursor:'pointer', fontSize:12,
                  fontWeight: tab === t.id ? 600 : 400,
                  borderLeft: tab === t.id ? `3px solid ${C.blue}` : '3px solid transparent',
                  transition:'all 0.15s ease' }}>
                  <span style={{fontSize:14}}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          ))}

          <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, position:'absolute', bottom:0, width:210, background:C.bg2 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background: live ? C.green : C.yellow }} className={live ? 'pulse' : ''} />
              <span style={{ color:C.tx2 }}>{live ? 'Live · Supabase' : 'Demo Mode'}</span>
            </div>
            <div style={{ fontSize:9, color:C.tx2, marginTop:3 }}>Auto-refresh: 15s</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, padding:20, overflowY:'auto' }}>
          <div style={{ maxWidth:1400, margin:'0 auto' }}>
            {!live && (
              <div style={{ background:C.yellowBg, border:`1px solid ${C.yellow}40`, borderRadius:8,
                padding:'8px 14px', marginBottom:14, fontSize:12, color:C.yellow }}>
                Demo Mode — Showing trial run data + demo codes. Connect Supabase for live data.
              </div>
            )}
            {tab === 'command' && <CommandCenter codes={codes} agents={agents} activity={activity} />}
            {tab === 'agents' && <AgentMonitor agents={agents} activity={activity} />}
            {tab === 'feed' && <LiveFeed activity={activity} />}
            {tab === 'pipeline' && <PipelineTab codes={codes} />}
            {tab === 'codes' && <CodesTab codes={codes} onSelect={handleSelectCode} />}
            {tab === 'detail' && <DetailTab hs4={selectedCode} codes={codes} p2Data={p2Data} p3Data={p3Data} p4Data={p4Data} scoringData={scoringData} />}
            {tab === 'trial' && <TrialRunTab />}
            {tab === 'scoring' && <ScoringMatrixTab />}
            {tab === 'sources' && <SourcesTab />}
            {tab === 'log' && <ResearchLogTab logs={logs} />}
          </div>
        </div>
      </div>
    </>
  )
}
