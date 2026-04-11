import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)',border:'1px solid rgba(148,163,184,0.1)',borderRadius:12,padding:20};
const MV = {EXCELLENT:'#34d399',GOOD:'#60a5fa',MODERATE:'#fbbf24',THIN:'#f59e0b',NEGATIVE:'#f87171',NO_DATA:'#94a3b8'};
const STATUS_COLORS = {completed:'#34d399',in_progress:'#fbbf24',pending:'#94a3b8',no_marketplace_data:'#a78bfa',failed:'#f87171'};

function fmt(n) { return n==null?'—':typeof n==='number'?(n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(2)}`):n; }
function fmtINR(n) { return n==null?'—':typeof n==='number'?(n>=1e5?`₹${(n/1e5).toFixed(1)}L`:n>=1e3?`₹${(n/1e3).toFixed(1)}K`:`₹${Math.round(n)}`):n; }
function pct(n) { return n==null?'—':`${n>0?'+':''}${n.toFixed(1)}%`; }
function shortName(c) { if(!c)return'—'; const s=c.split(',')[0].trim(); return s.length>50?s.slice(0,47)+'...':s; }

export default function ElectronicsPriority() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({col:'total_cif_usd',dir:'desc'});
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    supabase.from('electronics_priority_hs8').select('*')
      .then(({data:d}) => { setData(d||[]); setLoading(false); });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading electronics priority HS8 codes...</div>;

  // KPI calculations
  const total = data.length;
  const researched = data.filter(r=>r.selling_price_research_status==='completed').length;
  const inProg = data.filter(r=>r.selling_price_research_status==='in_progress').length;
  const pending = data.filter(r=>r.selling_price_research_status==='pending').length;
  const withMargin = data.filter(r=>r.real_margin_pct!=null && r.margin_verdict!=='NO_DATA');
  const positive = withMargin.filter(r=>r.real_margin_pct>0);
  const excellent = data.filter(r=>r.margin_verdict==='EXCELLENT').length;
  const good = data.filter(r=>r.margin_verdict==='GOOD').length;
  const moderate = data.filter(r=>r.margin_verdict==='MODERATE').length;
  const totalCIF = data.reduce((a,r)=>a+(r.total_cif_usd||0),0);
  const totalShipments = data.reduce((a,r)=>a+(r.shipment_count||0),0);
  const avgMargin = positive.length ? Math.round(positive.reduce((a,r)=>a+r.real_margin_pct,0)/positive.length*10)/10 : 0;

  // Filter
  const filtered = filter==='all' ? data
    : filter==='researched' ? data.filter(r=>r.selling_price_research_status==='completed')
    : filter==='pending' ? data.filter(r=>['pending','in_progress'].includes(r.selling_price_research_status))
    : filter==='positive' ? data.filter(r=>r.real_margin_pct>0)
    : filter==='excellent' ? data.filter(r=>r.margin_verdict==='EXCELLENT')
    : filter==='good' ? data.filter(r=>r.margin_verdict==='GOOD')
    : data;

  // Sort
  const sorted = [...filtered].sort((a,b) => {
    const av=a[sort.col], bv=b[sort.col];
    if(av==null&&bv==null)return 0; if(av==null)return 1; if(bv==null)return -1;
    return sort.dir==='asc'?(av>bv?1:-1):(av<bv?1:-1);
  });

  const doSort = col => setSort(s=>({col,dir:s.col===col&&s.dir==='desc'?'asc':'desc'}));
  const arrow = col => sort.col===col?(sort.dir==='desc'?'▼':'▲'):'';

  // Verdict pie chart data
  const verdictData = [
    {name:'EXCELLENT',value:excellent,color:MV.EXCELLENT},
    {name:'GOOD',value:good,color:MV.GOOD},
    {name:'MODERATE',value:moderate,color:MV.MODERATE},
    {name:'THIN',value:data.filter(r=>r.margin_verdict==='THIN').length,color:MV.THIN},
    {name:'NEGATIVE',value:data.filter(r=>r.margin_verdict==='NEGATIVE').length,color:MV.NEGATIVE},
    {name:'NO_DATA',value:data.filter(r=>!r.margin_verdict||r.margin_verdict==='NO_DATA').length,color:MV.NO_DATA},
  ].filter(d=>d.value>0);

  // Research status pie
  const statusData = [
    {name:'Completed',value:researched,color:STATUS_COLORS.completed},
    {name:'In Progress',value:inProg,color:STATUS_COLORS.in_progress},
    {name:'Pending',value:pending,color:STATUS_COLORS.pending},
    {name:'No Data',value:data.filter(r=>r.selling_price_research_status==='no_marketplace_data').length,color:STATUS_COLORS.no_marketplace_data},
  ].filter(d=>d.value>0);

  // Top 10 by CIF bar chart
  const top10 = [...data].sort((a,b)=>(b.total_cif_usd||0)-(a.total_cif_usd||0)).slice(0,10).map(r=>({
    name:r.hs8, cif:(r.total_cif_usd||0)/1e6, margin:r.real_margin_pct||0, verdict:r.margin_verdict
  }));

  const kpis = [
    {label:'Priority HS8 Codes',value:total,color:'#60a5fa'},
    {label:'Total CIF Value',value:`$${(totalCIF/1e9).toFixed(1)}B`,color:'#4f8cff'},
    {label:'Total Shipments',value:totalShipments.toLocaleString(),color:'#a78bfa'},
    {label:'Researched',value:researched,sub:`${total?Math.round(researched/total*100):0}%`,color:'#34d399'},
    {label:'Avg Margin (positive)',value:`${avgMargin}%`,color:avgMargin>25?'#34d399':'#fbbf24'},
    {label:'EXCELLENT',value:excellent,color:MV.EXCELLENT},
    {label:'GOOD',value:good,color:MV.GOOD},
    {label:'Pending Research',value:pending+inProg,color:'#f59e0b'},
  ];

  const thS = {padding:'10px 8px',textAlign:'left',cursor:'pointer',borderBottom:'1px solid rgba(148,163,184,0.1)',fontSize:12,fontWeight:600,color:'#94a3b8',whiteSpace:'nowrap',userSelect:'none'};
  const tdS = {padding:'8px',borderBottom:'1px solid rgba(148,163,184,0.06)',fontSize:12,color:'#e2e8f0'};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{...card,background:'linear-gradient(135deg,rgba(79,140,255,0.15),rgba(96,165,250,0.05))'}}>
        <h2 style={{margin:0,fontSize:20,color:'#e2e8f0'}}>⚡ Electronics Priority HS8 — Top 30 by CIF</h2>
        <p style={{margin:'8px 0 0',fontSize:13,color:'#94a3b8'}}>
          Focused research queue: 30 highest-value electronics HS8 codes from Volza import data.
          Selling prices from IndiaMART, TradeIndia, Amazon, Moglix, IndustryBuying.
          Margin = (Sell Price - Median Landed Cost) / Sell Price × 100.
        </p>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
        {kpis.map((k,i) => (
          <div key={i} style={{...card,textAlign:'center',padding:16}}>
            <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:26,fontWeight:700,color:k.color}}>{k.value}</div>
            {k.sub && <div style={{fontSize:11,color:'#64748b'}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        <div style={card}>
          <h3 style={{margin:'0 0 12px',fontSize:14,color:'#e2e8f0'}}>📊 Margin Verdicts</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={verdictData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({name,value})=>`${name}: ${value}`} labelLine={false} style={{fontSize:10}}>
              {verdictData.map((d,i)=><Cell key={i} fill={d.color}/>)}
            </Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{margin:'0 0 12px',fontSize:14,color:'#e2e8f0'}}>🔬 Research Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({name,value})=>`${name}: ${value}`} labelLine={false} style={{fontSize:10}}>
              {statusData.map((d,i)=><Cell key={i} fill={d.color}/>)}
            </Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{margin:'0 0 12px',fontSize:14,color:'#e2e8f0'}}>💰 Top 10 by CIF ($M)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={top10} layout="vertical" margin={{left:50,right:10}}>
              <XAxis type="number" tick={{fontSize:10,fill:'#94a3b8'}} />
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#94a3b8'}} width={60}/>
              <Tooltip formatter={v=>`$${v.toFixed(1)}M`}/>
              <Bar dataKey="cif" radius={[0,4,4,0]}>
                {top10.map((d,i)=><Cell key={i} fill={MV[d.verdict]||'#60a5fa'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {[{id:'all',label:'All'},{id:'researched',label:'Researched'},{id:'pending',label:'Pending'},{id:'positive',label:'Positive Margin'},{id:'excellent',label:'EXCELLENT'},{id:'good',label:'GOOD'}].map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            padding:'6px 14px',borderRadius:8,border:'1px solid',fontSize:12,cursor:'pointer',
            background:filter===f.id?'rgba(79,140,255,0.2)':'transparent',
            borderColor:filter===f.id?'#4f8cff':'rgba(148,163,184,0.2)',
            color:filter===f.id?'#60a5fa':'#94a3b8'
          }}>{f.label} ({f.id==='all'?total:f.id==='researched'?researched:f.id==='pending'?pending+inProg:f.id==='positive'?positive.length:f.id==='excellent'?excellent:good})</button>
        ))}
      </div>

      {/* Main Table */}
      <div style={{...card,padding:0,overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'rgba(15,23,42,0.6)'}}>
              <th style={thS}>#</th>
              <th style={thS} onClick={()=>doSort('hs8')}>HS8 {arrow('hs8')}</th>
              <th style={thS}>Product</th>
              <th style={thS} onClick={()=>doSort('total_cif_usd')}>CIF Value {arrow('total_cif_usd')}</th>
              <th style={thS} onClick={()=>doSort('shipment_count')}>Shipments {arrow('shipment_count')}</th>
              <th style={thS} onClick={()=>doSort('unique_buyers')}>Buyers {arrow('unique_buyers')}</th>
              <th style={thS} onClick={()=>doSort('median_unit_rate_usd')}>Median Rate {arrow('median_unit_rate_usd')}</th>
              <th style={thS}>Unit</th>
              <th style={thS} onClick={()=>doSort('median_landed_cost_inr')}>Landed Cost {arrow('median_landed_cost_inr')}</th>
              <th style={thS} onClick={()=>doSort('indiamart_sell_price_inr')}>IndiaMART Price {arrow('indiamart_sell_price_inr')}</th>
              <th style={thS} onClick={()=>doSort('indiamart_seller_count')}>Sellers {arrow('indiamart_seller_count')}</th>
              <th style={thS} onClick={()=>doSort('real_margin_pct')}>Margin % {arrow('real_margin_pct')}</th>
              <th style={thS}>Verdict</th>
              <th style={thS}>Research</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r,i) => {
              const isExpanded = expanded===r.hs8;
              return [
                <tr key={r.hs8} onClick={()=>setExpanded(isExpanded?null:r.hs8)}
                    style={{cursor:'pointer',background:isExpanded?'rgba(79,140,255,0.08)':i%2?'rgba(15,23,42,0.3)':'transparent',transition:'background 0.2s'}}>
                  <td style={tdS}>{i+1}</td>
                  <td style={{...tdS,fontWeight:600,color:'#60a5fa',fontFamily:'monospace'}}>{r.hs8}</td>
                  <td style={{...tdS,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.commodity}>{shortName(r.commodity)}</td>
                  <td style={{...tdS,textAlign:'right',fontWeight:600}}>{fmt(r.total_cif_usd)}</td>
                  <td style={{...tdS,textAlign:'right'}}>{(r.shipment_count||0).toLocaleString()}</td>
                  <td style={{...tdS,textAlign:'right'}}>{r.unique_buyers||'—'}</td>
                  <td style={{...tdS,textAlign:'right',fontFamily:'monospace'}}>{r.median_unit_rate_usd!=null?`$${r.median_unit_rate_usd.toFixed(2)}`:'—'}</td>
                  <td style={{...tdS,textAlign:'center',fontSize:10}}>{r.dominant_unit||'—'}</td>
                  <td style={{...tdS,textAlign:'right',fontFamily:'monospace'}}>{fmtINR(r.median_landed_cost_inr)}</td>
                  <td style={{...tdS,textAlign:'right',fontFamily:'monospace',color:r.indiamart_sell_price_inr?'#34d399':'#64748b'}}>{fmtINR(r.indiamart_sell_price_inr)}</td>
                  <td style={{...tdS,textAlign:'right'}}>{r.indiamart_seller_count?r.indiamart_seller_count.toLocaleString():'—'}</td>
                  <td style={{...tdS,textAlign:'right',fontWeight:700,color:r.real_margin_pct>0?MV[r.margin_verdict]||'#e2e8f0':'#f87171'}}>
                    {r.real_margin_pct!=null?pct(r.real_margin_pct):'—'}
                  </td>
                  <td style={tdS}>
                    {r.margin_verdict && <span style={{padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:600,
                      background:`${MV[r.margin_verdict]||'#64748b'}22`,color:MV[r.margin_verdict]||'#94a3b8',
                      border:`1px solid ${MV[r.margin_verdict]||'#64748b'}44`}}>{r.margin_verdict}</span>}
                  </td>
                  <td style={tdS}>
                    <span style={{padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:600,
                      background:`${STATUS_COLORS[r.selling_price_research_status]||'#64748b'}22`,
                      color:STATUS_COLORS[r.selling_price_research_status]||'#94a3b8',
                      border:`1px solid ${STATUS_COLORS[r.selling_price_research_status]||'#64748b'}44`}}>
                      {(r.selling_price_research_status||'pending').replace(/_/g,' ')}
                    </span>
                  </td>
                </tr>,
                isExpanded && (
                  <tr key={r.hs8+'_exp'}>
                    <td colSpan={14} style={{padding:16,background:'rgba(15,23,42,0.5)',borderBottom:'2px solid rgba(79,140,255,0.2)'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                        <div>
                          <h4 style={{margin:'0 0 8px',fontSize:13,color:'#60a5fa'}}>💰 Cost Analysis</h4>
                          <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.8}}>
                            <div>Median Rate: <b style={{color:'#e2e8f0'}}>${r.median_unit_rate_usd?.toFixed(2)}</b> / {r.dominant_unit}</div>
                            <div>P25-P75: <b style={{color:'#e2e8f0'}}>${r.p25_unit_rate_usd?.toFixed(2)} — ${r.p75_unit_rate_usd?.toFixed(2)}</b></div>
                            <div>Landed Cost: <b style={{color:'#e2e8f0'}}>{fmtINR(r.median_landed_cost_inr)}</b></div>
                            <div>Dispersion: <b style={{color:r.rate_dispersion==='HIGH'?'#f87171':r.rate_dispersion==='MODERATE'?'#fbbf24':'#34d399'}}>{r.rate_dispersion||'—'}</b></div>
                            <div>IQR Ratio: <b style={{color:'#e2e8f0'}}>{r.iqr_ratio?.toFixed(1)||'—'}</b></div>
                            <div>Captive %: <b style={{color:r.captive_pct>50?'#f87171':'#e2e8f0'}}>{r.captive_pct?.toFixed(1)||'—'}%</b></div>
                            <div>Duty: <b style={{color:'#e2e8f0'}}>{r.total_duty_pct?.toFixed(1)||r.avg_duty_pct?.toFixed(1)||'—'}%</b></div>
                          </div>
                        </div>
                        <div>
                          <h4 style={{margin:'0 0 8px',fontSize:13,color:'#34d399'}}>🏪 Selling Prices</h4>
                          <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.8}}>
                            <div>IndiaMART: <b style={{color:r.indiamart_sell_price_inr?'#34d399':'#64748b'}}>{fmtINR(r.indiamart_sell_price_inr)}</b> ({r.indiamart_seller_count?.toLocaleString()||0} sellers)</div>
                            <div>TradeIndia: <b style={{color:r.tradeindia_sell_price_inr?'#34d399':'#64748b'}}>{fmtINR(r.tradeindia_sell_price_inr)}</b></div>
                            <div>Amazon: <b style={{color:r.amazon_sell_price_inr?'#34d399':'#64748b'}}>{fmtINR(r.amazon_sell_price_inr)}</b></div>
                            <div>Moglix: <b style={{color:r.moglix_sell_price_inr?'#34d399':'#64748b'}}>{fmtINR(r.moglix_sell_price_inr)}</b></div>
                            <div>IndustryBuying: <b style={{color:r.industbuy_sell_price_inr?'#34d399':'#64748b'}}>{fmtINR(r.industbuy_sell_price_inr)}</b></div>
                            <div>Consensus: <b style={{color:'#fbbf24'}}>{fmtINR(r.price_consensus_inr)}</b> ({r.price_confidence||'—'})</div>
                            <div>Sources: <b style={{color:'#e2e8f0'}}>{r.source_count||0}</b> — {r.sources_checked||'none'}</div>
                          </div>
                        </div>
                        <div>
                          <h4 style={{margin:'0 0 8px',fontSize:13,color:'#fbbf24'}}>📈 Market Profile</h4>
                          <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.8}}>
                            <div>CIF Value: <b style={{color:'#e2e8f0'}}>{fmt(r.total_cif_usd)}</b></div>
                            <div>Shipments: <b style={{color:'#e2e8f0'}}>{(r.shipment_count||0).toLocaleString()}</b></div>
                            <div>Buyers: <b style={{color:'#e2e8f0'}}>{r.unique_buyers||'—'}</b></div>
                            <div>Shippers: <b style={{color:'#e2e8f0'}}>{r.unique_shippers||'—'}</b></div>
                            <div>China %: <b style={{color:r.china_pct>60?'#f87171':r.china_pct>30?'#fbbf24':'#34d399'}}>{r.china_pct?.toFixed(0)||'—'}%</b></div>
                            <div>Real Margin: <b style={{color:r.real_margin_pct>0?'#34d399':'#f87171'}}>{r.real_margin_pct!=null?pct(r.real_margin_pct):'—'}</b></div>
                            <div>Margin INR: <b style={{color:r.real_margin_inr>0?'#34d399':'#f87171'}}>{fmtINR(r.real_margin_inr)}</b></div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* About parallel agents */}
      <div style={{...card,background:'rgba(251,191,36,0.05)',border:'1px solid rgba(251,191,36,0.2)'}}>
        <h3 style={{margin:'0 0 8px',fontSize:14,color:'#fbbf24'}}>⚠️ Research Note</h3>
        <p style={{margin:0,fontSize:12,color:'#94a3b8',lineHeight:1.6}}>
          Chrome browser tools operate on ONE active tab at a time — true parallel agents aren't possible for marketplace visits.
          Instead, we batch by HS4 family (e.g., all 8524 display codes together), minimize wait times between searches, and
          use the Volza MEDIAN unit rate as price anchor to match the correct product tier on each marketplace.
          All landed costs come directly from Volza scraped import data (not auto-computed).
        </p>
      </div>
    </div>
  );
}
