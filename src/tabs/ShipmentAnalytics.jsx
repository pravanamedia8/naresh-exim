import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};

export default function ShipmentAnalytics() {
  const [stats, setStats] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hs4Filter, setHs4Filter] = useState('all');
  const PAGE_SIZE = 50;

  useEffect(() => { fetchStats(); fetchShipments(); }, [page, hs4Filter]);

  async function fetchStats() {
    const {data:scrapeQ} = await supabase.from('volza_scrape_queue').select('hs4, shipment_count, buyer_count, scrape_status').eq('scrape_status','completed');
    const totalShipments = (scrapeQ||[]).reduce((a,r)=>a+(r.shipment_count||0),0);
    const totalBuyers = (scrapeQ||[]).reduce((a,r)=>a+(r.buyer_count||0),0);
    const codesScraped = (scrapeQ||[]).length;

    const byHS4 = (scrapeQ||[]).sort((a,b)=>(b.shipment_count||0)-(a.shipment_count||0)).slice(0,15).map(r=>({name:r.hs4,shipments:r.shipment_count||0}));

    setStats({totalShipments,totalBuyers,codesScraped,byHS4});
  }

  async function fetchShipments() {
    let q = supabase.from('phase4_volza').select('*').order('total_shipments',{ascending:false});
    if(hs4Filter!=='all') q = q.eq('hs4',hs4Filter);
    const {data} = await q;
    setShipments(data||[]);
    setLoading(false);
  }

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading shipments...</div>;

  const hs4s = [...new Set(shipments.map(s=>s.hs4).filter(Boolean))];
  const colors = ['#34d399','#60a5fa','#fbbf24','#a78bfa','#f87171','#06b6d4','#f59e0b','#e879f9','#34d399','#60a5fa','#fbbf24','#a78bfa','#f87171','#06b6d4','#f59e0b'];

  const kpis = [
    {label:'Codes Scraped',value:stats?.codesScraped||0,color:'#60a5fa'},
    {label:'Total Shipments',value:(stats?.totalShipments||0).toLocaleString(),color:'#34d399'},
    {label:'Total Buyers',value:(stats?.totalBuyers||0).toLocaleString(),color:'#fbbf24'},
    {label:'Phase 4 Records',value:shipments.length,color:'#a78bfa'},
  ];

  const thStyle = {textAlign:'left',padding:'8px 10px',color:'#94a3b8',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.1)',position:'sticky',top:0,background:'rgba(17,24,39,0.95)',textTransform:'uppercase'};

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

      <div style={{...card,marginBottom:24}}>
        <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:16}}>Shipments by HS4 Code (Top 15)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats?.byHS4||[]}><XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} /><YAxis tick={{fill:'#94a3b8',fontSize:11}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}K`:v} />
            <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} formatter={v=>[v.toLocaleString(),'Shipments']} />
            <Bar dataKey="shipments">{(stats?.byHS4||[]).map((_,i)=><Cell key={i} fill={colors[i%15]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center'}}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:0}}>Phase 4 Volza Analytics ({shipments.length})</h3>
          <select value={hs4Filter} onChange={e=>{setHs4Filter(e.target.value);setPage(0);}} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 8px',fontSize:12}}>
            <option value="all">All HS4</option>
            {hs4s.sort().map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {['HS4','Shipments','Buyers','HHI','China %','Median CIF','Avg CIF','Shippers','Top Buyers'].map(h=>(
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{shipments.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map((s,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{s.hs4}</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12}}>{s.total_shipments?.toLocaleString()||'-'}</td>
                <td style={{padding:'6px 10px',color:'#34d399',fontSize:12}}>{s.unique_buyers||'-'}</td>
                <td style={{padding:'6px 10px',color:s.buyer_hhi>2500?'#f87171':s.buyer_hhi>1500?'#fbbf24':'#34d399',fontSize:12}}>{s.buyer_hhi||'-'}</td>
                <td style={{padding:'6px 10px',color:s.china_sourcing_pct>60?'#f87171':'#94a3b8',fontSize:12}}>{s.china_sourcing_pct?`${Number(s.china_sourcing_pct).toFixed(0)}%`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{s.median_cif_usd?`$${Number(s.median_cif_usd).toLocaleString()}`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{s.avg_cif_usd?`$${Number(s.avg_cif_usd).toLocaleString()}`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{s.unique_shippers||'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11,maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.top_5_buyers||'-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {shipments.length>PAGE_SIZE && (
          <div style={{display:'flex',gap:8,marginTop:12,justifyContent:'center'}}>
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'4px 12px',fontSize:12,cursor:'pointer'}}>Prev</button>
            <span style={{color:'#94a3b8',fontSize:12,padding:'4px 8px'}}>Page {page+1} of {Math.ceil(shipments.length/PAGE_SIZE)}</span>
            <button onClick={()=>setPage(p=>Math.min(Math.ceil(shipments.length/PAGE_SIZE)-1,p+1))} disabled={(page+1)*PAGE_SIZE>=shipments.length} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'4px 12px',fontSize:12,cursor:'pointer'}}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
