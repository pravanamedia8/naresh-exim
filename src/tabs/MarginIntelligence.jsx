import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};
const MV = { EXCELLENT:'#34d399', GOOD:'#60a5fa', MODERATE:'#fbbf24', THIN:'#f59e0b', NEGATIVE:'#f87171' };

export default function MarginIntelligence() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [sort, setSort] = useState({col:'real_margin_pct',dir:'desc'});
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('hs8_margin_analysis').select('*').order('total_cif_usd',{ascending:false}).then(({data:d})=>{ setData(d||[]); setLoading(false); });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading margins...</div>;

  const verdicts = {};
  data.forEach(r=>{ if(r.margin_verdict) verdicts[r.margin_verdict]=(verdicts[r.margin_verdict]||0)+1; });
  const verdictData = ['EXCELLENT','GOOD','MODERATE','THIN','NEGATIVE'].map(v=>({name:v,count:verdicts[v]||0}));

  const researched = data.filter(r=>r.research_status==='completed').length;
  const winners = data.filter(r=>r.margin_verdict==='EXCELLENT'||r.margin_verdict==='GOOD').length;
  const avgMargin = data.filter(r=>r.real_margin_pct).length ? Math.round(data.filter(r=>r.real_margin_pct).reduce((a,r)=>a+r.real_margin_pct,0)/data.filter(r=>r.real_margin_pct).length) : 0;
  const totalCIF = data.reduce((a,r)=>a+(r.total_cif_usd||0),0);

  const kpis = [
    {label:'HS8 Codes',value:data.length,color:'#60a5fa'},
    {label:'Researched',value:researched,sub:`of ${data.length}`,color:'#06b6d4'},
    {label:'Winners',value:winners,sub:'EXCELLENT + GOOD',color:'#34d399'},
    {label:'Avg Margin',value:`${avgMargin}%`,color:'#fbbf24'},
    {label:'Total CIF',value:`$${(totalCIF/1e9).toFixed(1)}B`,color:'#a78bfa'},
  ];

  const scatterData = data.filter(r=>r.real_margin_pct&&r.total_cif_usd).map(r=>({
    x: r.total_cif_usd/1e6,
    y: r.real_margin_pct,
    z: r.unique_buyers||5,
    name: r.commodity?.substring(0,30)||r.hs8,
    hs8: r.hs8,
    fill: MV[r.margin_verdict]||'#94a3b8'
  }));

  let filtered = data;
  if(verdictFilter!=='all') filtered = filtered.filter(r=>r.margin_verdict===verdictFilter);
  if(search) filtered = filtered.filter(r=>(r.hs8+' '+r.commodity+' '+r.hs4).toLowerCase().includes(search.toLowerCase()));
  filtered.sort((a,b)=>{
    let av=a[sort.col]??-Infinity, bv=b[sort.col]??-Infinity;
    if(av<bv) return sort.dir==='asc'?-1:1;
    if(av>bv) return sort.dir==='asc'?1:-1;
    return 0;
  });

  const toggleSort = col => setSort(s=>({col,dir:s.col===col&&s.dir==='desc'?'asc':'desc'}));
  const thStyle = {textAlign:'left',padding:'8px 10px',color:'#94a3b8',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.1)',cursor:'pointer',position:'sticky',top:0,background:'rgba(17,24,39,0.95)',textTransform:'uppercase'};

  return (
    <div style={{padding:24}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:16,marginBottom:24}}>
        {kpis.map(k=>(
          <div key={k.label} style={{...card,borderTop:`3px solid ${k.color}`}}>
            <div style={{color:'#94a3b8',fontSize:12,textTransform:'uppercase'}}>{k.label}</div>
            <div style={{color:k.color,fontSize:28,fontWeight:700,marginTop:4}}>{k.value}</div>
            {k.sub && <div style={{color:'#64748b',fontSize:11,marginTop:4}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Margin Verdict Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={verdictData}><XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} /><YAxis tick={{fill:'#94a3b8',fontSize:11}} />
              <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} />
              <Bar dataKey="count">{verdictData.map((d,i)=><Cell key={i} fill={MV[d.name]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Margin vs CIF Value (Bubble)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart><XAxis type="number" dataKey="x" name="CIF $M" tick={{fill:'#94a3b8',fontSize:10}} /><YAxis type="number" dataKey="y" name="Margin %" tick={{fill:'#94a3b8',fontSize:10}} /><ZAxis type="number" dataKey="z" range={[20,200]} />
              <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} formatter={(v,n)=>[n==='CIF $M'?`$${v.toFixed(1)}M`:`${v.toFixed(1)}%`,n]} />
              <Scatter data={scatterData}>{scatterData.map((d,i)=><Cell key={i} fill={d.fill} />)}</Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:0}}>HS8 Margin Analysis ({filtered.length})</h3>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS8 / HS4 / commodity..." style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 12px',fontSize:12,flex:1,minWidth:180}} />
          <select value={verdictFilter} onChange={e=>setVerdictFilter(e.target.value)} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 8px',fontSize:12}}>
            <option value="all">All Verdicts</option>
            {['EXCELLENT','GOOD','MODERATE','THIN','NEGATIVE'].map(v=><option key={v} value={v}>{v} ({verdicts[v]||0})</option>)}
          </select>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['hs8','HS8'],['hs4','HS4'],['commodity','Commodity'],['total_cif_usd','CIF $'],['avg_unit_rate_usd','Avg Rate'],['volza_landed_cost_inr','Landed INR'],['indiamart_sell_price_inr','Sell INR'],['real_margin_pct','Margin %'],['margin_verdict','Verdict'],['unique_buyers','Buyers']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.slice(0,200).map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:11,fontFamily:'monospace'}}>{r.hs8}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11,fontFamily:'monospace'}}>{r.hs4}</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:11,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.commodity}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.total_cif_usd?`$${(r.total_cif_usd/1e6).toFixed(1)}M`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.avg_unit_rate_usd?`$${Number(r.avg_unit_rate_usd).toFixed(2)}`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.volza_landed_cost_inr?`₹${Number(r.volza_landed_cost_inr).toLocaleString()}`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.indiamart_sell_price_inr?`₹${Number(r.indiamart_sell_price_inr).toLocaleString()}`:'-'}</td>
                <td style={{padding:'6px 10px',color:r.real_margin_pct>25?'#34d399':r.real_margin_pct>10?'#fbbf24':'#f87171',fontSize:12,fontWeight:600}}>{r.real_margin_pct?`${Number(r.real_margin_pct).toFixed(1)}%`:'-'}</td>
                <td style={{padding:'6px 10px'}}>{r.margin_verdict&&<span style={{background:`rgba(${r.margin_verdict==='EXCELLENT'||r.margin_verdict==='GOOD'?'52,211,153':r.margin_verdict==='MODERATE'?'251,191,36':'248,113,113'},0.15)`,color:MV[r.margin_verdict],padding:'2px 6px',borderRadius:4,fontSize:10}}>{r.margin_verdict}</span>}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.unique_buyers||'-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
