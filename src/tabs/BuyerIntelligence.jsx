import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};

export default function BuyerIntelligence() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({col:'total_cif_usd',dir:'desc'});
  const [search, setSearch] = useState('');
  const [hs4Filter, setHs4Filter] = useState('all');

  useEffect(() => {
    supabase.from('volza_top_buyers').select('*').order('total_cif_usd',{ascending:false}).limit(2500).then(({data})=>{ setBuyers(data||[]); setLoading(false); });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading buyers...</div>;

  const totalCIF = buyers.reduce((a,b)=>a+(b.total_cif_usd||0),0);
  const uniqueCompanies = new Set(buyers.map(b=>b.company_name)).size;
  const hs4s = [...new Set(buyers.map(b=>b.hs4).filter(Boolean))];

  const top10 = buyers.slice(0,10).map(b=>({name:b.company_name?.substring(0,25)||'Unknown',cif:b.total_cif_usd||0}));

  const stateMap = {};
  buyers.forEach(b=>{ if(b.state) stateMap[b.state]=(stateMap[b.state]||0)+1; });
  const stateData = Object.entries(stateMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value}));
  const stateColors = ['#34d399','#60a5fa','#fbbf24','#a78bfa','#f87171','#06b6d4','#f59e0b','#e879f9'];

  const kpis = [
    {label:'Total Buyers',value:buyers.length,color:'#60a5fa'},
    {label:'Unique Companies',value:uniqueCompanies,color:'#34d399'},
    {label:'HS4 Codes',value:hs4s.length,color:'#fbbf24'},
    {label:'Total CIF',value:`$${(totalCIF/1e6).toFixed(0)}M`,color:'#a78bfa'},
  ];

  let filtered = buyers;
  if(hs4Filter!=='all') filtered = filtered.filter(b=>b.hs4===hs4Filter);
  if(search) filtered = filtered.filter(b=>(b.company_name+' '+b.city+' '+b.hs4).toLowerCase().includes(search.toLowerCase()));
  filtered.sort((a,b)=>{
    let av=a[sort.col]??-Infinity, bv=b[sort.col]??-Infinity;
    if(typeof av==='string') { av=(av||'').toLowerCase(); bv=(bv||'').toLowerCase(); }
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
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Top 10 Buyers by CIF</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={top10} layout="vertical"><XAxis type="number" tick={{fill:'#94a3b8',fontSize:10}} tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} /><YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} width={150} />
              <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} formatter={v=>[`$${(v/1e6).toFixed(2)}M`,'CIF']} />
              <Bar dataKey="cif" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Buyers by State</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart><Pie data={stateData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,value})=>`${name}: ${value}`}>
              {stateData.map((_,i)=><Cell key={i} fill={stateColors[i%8]} />)}
            </Pie><Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:0}}>Buyer Table ({filtered.length})</h3>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company / city / HS4..." style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 12px',fontSize:12,flex:1,minWidth:180}} />
          <select value={hs4Filter} onChange={e=>setHs4Filter(e.target.value)} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 8px',fontSize:12}}>
            <option value="all">All HS4 ({hs4s.length})</option>
            {hs4s.sort().map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['company_name','Company'],['hs4','HS4'],['city','City'],['state','State'],['shipment_count','Shipments'],['total_cif_usd','CIF $'],['avg_unit_rate_usd','Avg Rate'],['supplier_count','Suppliers'],['china_pct','China %']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.slice(0,200).map((b,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.company_name}</td>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:11,fontFamily:'monospace'}}>{b.hs4}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{b.city||'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{b.state||'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{b.shipment_count||'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{b.total_cif_usd?`$${(b.total_cif_usd/1e6).toFixed(2)}M`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{b.avg_unit_rate_usd?`$${Number(b.avg_unit_rate_usd).toFixed(2)}`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{b.supplier_count||'-'}</td>
                <td style={{padding:'6px 10px',color:b.china_pct>50?'#f87171':'#94a3b8',fontSize:11}}>{b.china_pct?`${Number(b.china_pct).toFixed(0)}%`:'-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
