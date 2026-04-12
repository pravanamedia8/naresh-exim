import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)',border:'1px solid rgba(148,163,184,0.1)',borderRadius:12,padding:20};
const MV = {EXCELLENT:'#34d399',GOOD:'#60a5fa',MODERATE:'#fbbf24',THIN:'#f59e0b',NEGATIVE:'#f87171'};
const STATUS_COLORS = {done:'#34d399',in_progress:'#fbbf24',pending:'#94a3b8',failed:'#f87171'};

export default function SellingPriceResearch() {
  const [data, setData] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({col:'total_cif_usd',dir:'desc'});
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from('hs8_margin_analysis').select('*').not('median_unit_rate_usd','is',null).order('total_cif_usd',{ascending:false}),
      supabase.from('hs8_price_sources').select('*').order('researched_at',{ascending:false}).limit(500)
    ]).then(([{data:d1},{data:d2}]) => {
      setData(d1||[]);
      setSources(d2||[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading selling price research...</div>;

  // KPI calculations
  const total = data.length;
  const done = data.filter(r=>r.selling_price_research_status==='done'||r.selling_price_research_status==='completed').length;
  const inProg = data.filter(r=>r.selling_price_research_status==='in_progress').length;
  const pending = total - done - inProg;
  const withMargin = data.filter(r=>r.real_margin_pct!=null);
  const avgMargin = withMargin.length ? Math.round(withMargin.reduce((a,r)=>a+r.real_margin_pct,0)/withMargin.length*10)/10 : 0;
  const excellent = data.filter(r=>r.margin_verdict==='EXCELLENT').length;
  const good = data.filter(r=>r.margin_verdict==='GOOD').length;
  const moderate = data.filter(r=>r.margin_verdict==='MODERATE').length;
  const thin = data.filter(r=>r.margin_verdict==='THIN').length;
  const negative = data.filter(r=>r.margin_verdict==='NEGATIVE').length;
  const avgSources = done ? Math.round(data.filter(r=>r.source_count>0).reduce((a,r)=>a+(r.source_count||0),0)/Math.max(1,data.filter(r=>r.source_count>0).length)*10)/10 : 0;
  const unitMatched = data.filter(r=>r.unit_matched).length;

  const kpis = [
    {label:'Total HS8',value:total,color:'#60a5fa'},
    {label:'Researched',value:done,sub:`${Math.round(done/total*100)}%`,color:'#34d399'},
    {label:'In Progress',value:inProg,color:'#fbbf24'},
    {label:'Pending',value:pending,color:'#94a3b8'},
    {label:'Avg Margin',value:`${avgMargin}%`,color:avgMargin>25?'#34d399':avgMargin>15?'#fbbf24':'#f87171'},
    {label:'Winners',value:excellent+good,sub:'EXC+GOOD',color:'#34d399'},
    {label:'Avg Sources',value:avgSources,sub:'per code',color:'#a78bfa'},
    {label:'Unit Matched',value:unitMatched,sub:`of ${done}`,color:'#06b6d4'},
  ];

  // Verdict distribution
  const verdictData = [
    {name:'EXCELLENT',count:excellent,fill:'#34d399'},
    {name:'GOOD',count:good,fill:'#60a5fa'},
    {name:'MODERATE',count:moderate,fill:'#fbbf24'},
    {name:'THIN',count:thin,fill:'#f59e0b'},
    {name:'NEGATIVE',count:negative,fill:'#f87171'},
    {name:'Pending',count:total-done,fill:'#475569'},
  ].filter(v=>v.count>0);

  // Progress by HS4
  const hs4Map = {};
  data.forEach(r => {
    if (!hs4Map[r.hs4]) hs4Map[r.hs4] = {hs4:r.hs4,total:0,done:0,winners:0,cif:0};
    hs4Map[r.hs4].total++;
    hs4Map[r.hs4].cif += r.total_cif_usd||0;
    if (r.selling_price_research_status==='done'||r.selling_price_research_status==='completed') hs4Map[r.hs4].done++;
    if (r.margin_verdict==='EXCELLENT'||r.margin_verdict==='GOOD') hs4Map[r.hs4].winners++;
  });
  const hs4Progress = Object.values(hs4Map).sort((a,b)=>b.cif-a.cif);

  // Source coverage
  const srcMap = {};
  sources.forEach(s => { srcMap[s.source_name] = (srcMap[s.source_name]||0)+1; });
  const sourceData = Object.entries(srcMap).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);

  // Filtered table data
  let filtered = data;
  if (filter==='done') filtered = filtered.filter(r=>r.selling_price_research_status==='done'||r.selling_price_research_status==='completed');
  else if (filter==='pending') filtered = filtered.filter(r=>r.selling_price_research_status==='pending');
  else if (filter==='winners') filtered = filtered.filter(r=>r.margin_verdict==='EXCELLENT'||r.margin_verdict==='GOOD');
  else if (filter==='negative') filtered = filtered.filter(r=>r.margin_verdict==='NEGATIVE');
  if (search) filtered = filtered.filter(r=>(r.hs8+' '+r.hs4+' '+(r.commodity||'')).toLowerCase().includes(search.toLowerCase()));
  filtered.sort((a,b)=>{
    let av=a[sort.col]??-Infinity, bv=b[sort.col]??-Infinity;
    return sort.dir==='desc' ? (bv>av?1:bv<av?-1:0) : (av>bv?1:av<bv?-1:0);
  });

  const toggleSort = col => setSort(s=>({col,dir:s.col===col&&s.dir==='desc'?'asc':'desc'}));
  const th = {textAlign:'left',padding:'8px 6px',color:'#94a3b8',fontSize:10,borderBottom:'1px solid rgba(148,163,184,0.1)',cursor:'pointer',position:'sticky',top:0,background:'rgba(17,24,39,0.95)',textTransform:'uppercase',whiteSpace:'nowrap'};
  const td = {padding:'6px',fontSize:12,borderBottom:'1px solid rgba(148,163,184,0.05)',color:'#e2e8f0'};
  const badge = (text,color) => <span style={{background:`rgba(${color},0.15)`,color:`rgb(${color})`,padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:600}}>{text}</span>;
  const mvBadge = v => v ? badge(v, v==='EXCELLENT'?'52,211,153':v==='GOOD'?'96,165,250':v==='MODERATE'?'251,191,36':v==='THIN'?'245,158,11':'248,113,113') : <span style={{color:'#475569',fontSize:10}}>—</span>;
  const statusBadge = s => badge(s||'pending', (s==='done'||s==='completed')?'52,211,153':s==='in_progress'?'251,191,36':'148,163,184');
  const fmt = (n,d=0) => n!=null ? n.toLocaleString(undefined,{maximumFractionDigits:d}) : '—';
  const fmtUSD = n => n!=null ? '$'+n.toLocaleString(undefined,{maximumFractionDigits:0}) : '—';

  // Source details for expanded row
  const rowSources = expanded ? sources.filter(s=>s.hs8===expanded) : [];

  return (
    <div style={{padding:'20px 24px',maxWidth:1600,margin:'0 auto'}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <h2 style={{color:'#e2e8f0',margin:0,fontSize:22}}>🔍 HS8 Selling Price Research</h2>
        <p style={{color:'#94a3b8',margin:'4px 0 0',fontSize:13}}>Multi-source Indian selling prices matched to MEDIAN import costs by unit type</p>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {kpis.map(k => (
          <div key={k.label} style={{...card,padding:14,textAlign:'center'}}>
            <div style={{color:k.color,fontSize:28,fontWeight:700}}>{k.value}</div>
            <div style={{color:'#94a3b8',fontSize:11,marginTop:2}}>{k.label}</div>
            {k.sub && <div style={{color:'#64748b',fontSize:10}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {['overview','table','sources','by_hs4'].map(v => (
          <button key={v} onClick={()=>setView(v)} style={{padding:'6px 16px',borderRadius:8,border:'1px solid',borderColor:view===v?'#4f8cff':'rgba(148,163,184,0.2)',background:view===v?'rgba(79,140,255,0.15)':'transparent',color:view===v?'#60a5fa':'#94a3b8',fontSize:12,cursor:'pointer',fontWeight:view===v?600:400}}>
            {v==='overview'?'📊 Overview':v==='table'?'📋 Full Table':v==='sources'?'🔗 Source Coverage':'📦 By HS4'}
          </button>
        ))}
      </div>

      {view==='overview' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Verdict Distribution */}
          <div style={card}>
            <h3 style={{color:'#e2e8f0',fontSize:14,margin:'0 0 12px'}}>Margin Verdict Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={verdictData}>
                <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} />
                <YAxis tick={{fill:'#94a3b8',fontSize:11}} />
                <Tooltip contentStyle={{background:'#1a2035',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8,color:'#e2e8f0'}} />
                <Bar dataKey="count" radius={[6,6,0,0]}>
                  {verdictData.map((e,i)=><Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Research Progress */}
          <div style={card}>
            <h3 style={{color:'#e2e8f0',fontSize:14,margin:'0 0 12px'}}>Research Progress</h3>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:30}}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={[{value:done,fill:'#34d399'},{value:inProg,fill:'#fbbf24'},{value:pending,fill:'#334155'}]} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2}>
                    {[{fill:'#34d399'},{fill:'#fbbf24'},{fill:'#334155'}].map((e,i)=><Cell key={i} fill={e.fill}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div>
                <div style={{color:'#34d399',fontSize:14,marginBottom:6}}>✅ Done: {done}</div>
                <div style={{color:'#fbbf24',fontSize:14,marginBottom:6}}>🔄 In Progress: {inProg}</div>
                <div style={{color:'#94a3b8',fontSize:14,marginBottom:6}}>⏳ Pending: {pending}</div>
                <div style={{color:'#64748b',fontSize:12,marginTop:12}}>Progress: {Math.round(done/total*100)}%</div>
              </div>
            </div>
          </div>

          {/* Source Coverage */}
          <div style={card}>
            <h3 style={{color:'#e2e8f0',fontSize:14,margin:'0 0 12px'}}>Source Visit Coverage</h3>
            {sourceData.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sourceData} layout="vertical">
                  <XAxis type="number" tick={{fill:'#94a3b8',fontSize:11}} />
                  <YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} width={100} />
                  <Tooltip contentStyle={{background:'#1a2035',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8,color:'#e2e8f0'}} />
                  <Bar dataKey="count" fill="#60a5fa" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{color:'#475569',padding:40,textAlign:'center'}}>No source visits yet — research pending</div>}
          </div>

          {/* Top Winners Preview */}
          <div style={card}>
            <h3 style={{color:'#e2e8f0',fontSize:14,margin:'0 0 12px'}}>🏆 Top Margin Winners</h3>
            <div style={{maxHeight:200,overflowY:'auto'}}>
              {data.filter(r=>r.real_margin_pct!=null).sort((a,b)=>b.real_margin_pct-a.real_margin_pct).slice(0,8).map(r => (
                <div key={r.hs8} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                  <div>
                    <span style={{color:'#60a5fa',fontSize:12,fontWeight:600}}>{r.hs8}</span>
                    <span style={{color:'#94a3b8',fontSize:11,marginLeft:8}}>{(r.commodity||'').substring(0,35)}</span>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{color:r.real_margin_pct>40?'#34d399':r.real_margin_pct>25?'#60a5fa':'#fbbf24',fontWeight:700,fontSize:13}}>{r.real_margin_pct?.toFixed(1)}%</span>
                    {mvBadge(r.margin_verdict)}
                  </div>
                </div>
              ))}
              {!data.filter(r=>r.real_margin_pct!=null).length && <div style={{color:'#475569',padding:20,textAlign:'center'}}>Margins pending — research in progress</div>}
            </div>
          </div>
        </div>
      )}

      {view==='table' && (
        <div style={card}>
          {/* Filters */}
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS8, HS4, commodity..." style={{padding:'6px 12px',borderRadius:8,border:'1px solid rgba(148,163,184,0.2)',background:'rgba(0,0,0,0.3)',color:'#e2e8f0',fontSize:12,width:250}} />
            {['all','done','pending','winners','negative'].map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{padding:'4px 12px',borderRadius:6,border:'1px solid',borderColor:filter===f?'#4f8cff':'rgba(148,163,184,0.15)',background:filter===f?'rgba(79,140,255,0.12)':'transparent',color:filter===f?'#60a5fa':'#64748b',fontSize:11,cursor:'pointer'}}>{f==='all'?`All (${total})`:f==='done'?`Done (${done})`:f==='pending'?`Pending (${pending})`:f==='winners'?`Winners (${excellent+good})`:`Negative (${negative})`}</button>
            ))}
            <span style={{color:'#64748b',fontSize:11,marginLeft:'auto'}}>Showing {filtered.length} of {total}</span>
          </div>

          <div style={{maxHeight:'65vh',overflowY:'auto',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:1200}}>
              <thead>
                <tr>
                  {[
                    {col:'hs8',label:'HS8'},
                    {col:'hs4',label:'HS4'},
                    {col:'commodity',label:'Product'},
                    {col:'dominant_unit',label:'Unit'},
                    {col:'median_unit_rate_usd',label:'Median Cost $'},
                    {col:'median_landed_cost_inr',label:'Landed ₹'},
                    {col:'price_consensus_inr',label:'Sell Price ₹'},
                    {col:'real_margin_pct',label:'Margin %'},
                    {col:'margin_verdict',label:'Verdict'},
                    {col:'source_count',label:'Sources'},
                    {col:'unit_matched',label:'Unit Match'},
                    {col:'total_cif_usd',label:'CIF $'},
                    {col:'rate_dispersion',label:'Dispersion'},
                    {col:'selling_price_research_status',label:'Status'},
                  ].map(c => (
                    <th key={c.col} style={th} onClick={()=>toggleSort(c.col)}>
                      {c.label} {sort.col===c.col ? (sort.dir==='desc'?'↓':'↑') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0,200).map(r => (
                  <tr key={r.hs8} onClick={()=>setExpanded(expanded===r.hs8?null:r.hs8)} style={{cursor:'pointer',background:expanded===r.hs8?'rgba(79,140,255,0.05)':'transparent'}}>
                    <td style={{...td,color:'#60a5fa',fontWeight:600,fontFamily:'monospace'}}>{r.hs8}</td>
                    <td style={{...td,color:'#94a3b8',fontFamily:'monospace'}}>{r.hs4}</td>
                    <td style={{...td,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.commodity}>{(r.commodity||'').substring(0,40)}</td>
                    <td style={{...td,textAlign:'center'}}><span style={{background:'rgba(96,165,250,0.12)',color:'#60a5fa',padding:'2px 6px',borderRadius:4,fontSize:10}}>{r.dominant_unit||'—'}</span></td>
                    <td style={{...td,textAlign:'right',fontFamily:'monospace'}}>${fmt(r.median_unit_rate_usd,2)}</td>
                    <td style={{...td,textAlign:'right',fontFamily:'monospace'}}>₹{fmt(r.median_landed_cost_inr,0)}</td>
                    <td style={{...td,textAlign:'right',fontFamily:'monospace',color:r.price_consensus_inr?'#34d399':'#475569'}}>
                      {r.price_consensus_inr ? `₹${fmt(r.price_consensus_inr,0)}` : '—'}
                    </td>
                    <td style={{...td,textAlign:'right',fontWeight:700,color:r.real_margin_pct>40?'#34d399':r.real_margin_pct>25?'#60a5fa':r.real_margin_pct>15?'#fbbf24':r.real_margin_pct>0?'#f59e0b':'#f87171'}}>
                      {r.real_margin_pct!=null ? `${r.real_margin_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={td}>{mvBadge(r.margin_verdict)}</td>
                    <td style={{...td,textAlign:'center'}}>{r.source_count||0}</td>
                    <td style={{...td,textAlign:'center'}}>{r.unit_matched ? '✅' : '—'}</td>
                    <td style={{...td,textAlign:'right',fontFamily:'monospace'}}>{fmtUSD(r.total_cif_usd)}</td>
                    <td style={td}>{badge(r.rate_dispersion||'—', r.rate_dispersion==='LOW'?'52,211,153':r.rate_dispersion==='MODERATE'?'251,191,36':'248,113,113')}</td>
                    <td style={td}>{statusBadge(r.selling_price_research_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded Row Detail */}
          {expanded && (
            <div style={{marginTop:12,padding:16,background:'rgba(79,140,255,0.05)',borderRadius:8,border:'1px solid rgba(79,140,255,0.15)'}}>
              <h4 style={{color:'#60a5fa',margin:'0 0 10px'}}>📋 Source Details for {expanded}</h4>
              {rowSources.length ? (
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      {['Source','Keyword','Price Low','Price High','Typical','Unit','Sellers','Confidence','Date'].map(h => (
                        <th key={h} style={{...th,fontSize:10}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowSources.map(s => (
                      <tr key={s.id}>
                        <td style={{...td,fontWeight:600}}>{s.source_name}</td>
                        <td style={td}>{s.keyword_used}</td>
                        <td style={{...td,fontFamily:'monospace'}}>₹{fmt(s.price_low_inr,0)}</td>
                        <td style={{...td,fontFamily:'monospace'}}>₹{fmt(s.price_high_inr,0)}</td>
                        <td style={{...td,fontFamily:'monospace',color:'#34d399'}}>₹{fmt(s.price_typical_inr,0)}</td>
                        <td style={td}>{s.price_unit||'—'}</td>
                        <td style={{...td,textAlign:'center'}}>{s.seller_count||'—'}</td>
                        <td style={td}>{s.confidence ? badge(s.confidence, s.confidence==='HIGH'?'52,211,153':s.confidence==='MEDIUM'?'251,191,36':'248,113,113') : '—'}</td>
                        <td style={{...td,fontSize:10}}>{s.researched_at ? new Date(s.researched_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{color:'#475569',fontSize:12}}>No source visits recorded yet for this code</div>}
            </div>
          )}
        </div>
      )}

      {view==='sources' && (
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:'0 0 16px'}}>🔗 Source Coverage Matrix</h3>
          <p style={{color:'#94a3b8',fontSize:12,marginBottom:16}}>Each HS8 code is researched across 5 Indian marketplaces to triangulate real selling prices</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:20}}>
            {['IndiaMART','TradeIndia','Amazon.in','Moglix','IndustryBuying'].map(src => {
              const key = src.toLowerCase().replace(/[^a-z]/g,'');
              const srcCount = sources.filter(s=>s.source_name.toLowerCase().replace(/[^a-z]/g,'')===key).length;
              return (
                <div key={src} style={{...card,padding:14,textAlign:'center'}}>
                  <div style={{color:'#60a5fa',fontSize:20,fontWeight:700}}>{srcCount}</div>
                  <div style={{color:'#94a3b8',fontSize:11}}>{src}</div>
                  <div style={{color:'#475569',fontSize:10}}>visits</div>
                </div>
              );
            })}
          </div>

          <h4 style={{color:'#e2e8f0',fontSize:13,margin:'16px 0 10px'}}>Recent Source Visits</h4>
          <div style={{maxHeight:400,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['HS8','Source','Keyword','Price Range ₹','Unit','Sellers','Tier Match','Confidence','Time'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.slice(0,100).map(s => (
                  <tr key={s.id}>
                    <td style={{...td,color:'#60a5fa',fontFamily:'monospace'}}>{s.hs8}</td>
                    <td style={{...td,fontWeight:600}}>{s.source_name}</td>
                    <td style={{...td,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis'}}>{s.keyword_used}</td>
                    <td style={{...td,fontFamily:'monospace'}}>₹{fmt(s.price_low_inr,0)} – ₹{fmt(s.price_high_inr,0)}</td>
                    <td style={td}>{s.price_unit||'—'}</td>
                    <td style={{...td,textAlign:'center'}}>{s.seller_count||'—'}</td>
                    <td style={{...td,textAlign:'center'}}>{s.price_tier_match ? '✅' : s.price_tier_match===false ? '❌' : '—'}</td>
                    <td style={td}>{s.confidence ? badge(s.confidence, s.confidence==='HIGH'?'52,211,153':s.confidence==='MEDIUM'?'251,191,36':'248,113,113') : '—'}</td>
                    <td style={{...td,fontSize:10}}>{s.researched_at ? new Date(s.researched_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view==='by_hs4' && (
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:'0 0 16px'}}>📦 Research Progress by HS4 Category</h3>
          <div style={{maxHeight:'65vh',overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['HS4','HS8 Codes','Researched','Winners','CIF Coverage','Progress'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hs4Progress.map(h => (
                  <tr key={h.hs4}>
                    <td style={{...td,color:'#60a5fa',fontWeight:600,fontFamily:'monospace'}}>{h.hs4}</td>
                    <td style={{...td,textAlign:'center'}}>{h.total}</td>
                    <td style={{...td,textAlign:'center',color:'#34d399'}}>{h.done}/{h.total}</td>
                    <td style={{...td,textAlign:'center'}}>{h.winners ? <span style={{color:'#34d399',fontWeight:600}}>{h.winners}</span> : '—'}</td>
                    <td style={{...td,textAlign:'right',fontFamily:'monospace'}}>{fmtUSD(h.cif)}</td>
                    <td style={{...td,width:120}}>
                      <div style={{background:'rgba(148,163,184,0.1)',borderRadius:4,height:16,overflow:'hidden'}}>
                        <div style={{background:'#34d399',height:'100%',width:`${Math.round(h.done/h.total*100)}%`,borderRadius:4,transition:'width 0.3s'}} />
                      </div>
                    </td>
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
