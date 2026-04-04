import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};

export default function WinnersDashboard() {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({col:'real_margin_pct',dir:'desc'});

  useEffect(() => {
    supabase.from('hs8_margin_analysis').select('*').in('margin_verdict',['EXCELLENT','GOOD']).order('real_margin_pct',{ascending:false}).then(({data})=>{ setWinners(data||[]); setLoading(false); });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading winners...</div>;

  const excellent = winners.filter(w=>w.margin_verdict==='EXCELLENT');
  const good = winners.filter(w=>w.margin_verdict==='GOOD');
  const totalCIF = winners.reduce((a,w)=>a+(w.total_cif_usd||0),0);
  const avgMargin = winners.length ? Math.round(winners.reduce((a,w)=>a+(w.real_margin_pct||0),0)/winners.length) : 0;

  const top20 = winners.slice(0,20).map(w=>({
    name: w.hs8,
    margin: w.real_margin_pct||0,
    fill: w.margin_verdict==='EXCELLENT'?'#34d399':'#60a5fa'
  }));

  const kpis = [
    {label:'Total Winners',value:winners.length,color:'#34d399'},
    {label:'EXCELLENT',value:excellent.length,color:'#34d399'},
    {label:'GOOD',value:good.length,color:'#60a5fa'},
    {label:'Avg Margin',value:`${avgMargin}%`,color:'#fbbf24'},
    {label:'CIF Pool',value:`$${(totalCIF/1e9).toFixed(1)}B`,color:'#a78bfa'},
  ];

  let sorted = [...winners];
  sorted.sort((a,b)=>{
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
          </div>
        ))}
      </div>

      <div style={{...card,marginBottom:24}}>
        <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:16}}>Top 20 Winners by Margin %</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={top20} layout="vertical"><XAxis type="number" tick={{fill:'#94a3b8',fontSize:11}} unit="%" /><YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} width={80} />
            <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} formatter={v=>[`${v.toFixed(1)}%`,'Margin']} />
            <Bar dataKey="margin">{top20.map((d,i)=><Cell key={i} fill={d.fill} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={card}>
        <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:16}}>Winner Products ({winners.length})</h3>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['hs8','HS8'],['hs4','HS4'],['commodity','Commodity'],['real_margin_pct','Margin %'],['margin_verdict','Verdict'],['total_cif_usd','CIF $'],['avg_unit_rate_usd','FOB $'],['indiamart_sell_price_inr','Sell ₹'],['unique_buyers','Buyers'],['china_pct','China %']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{sorted.map((w,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:11,fontFamily:'monospace'}}>{w.hs8}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{w.hs4}</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:11,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{w.commodity}</td>
                <td style={{padding:'6px 10px',color:w.margin_verdict==='EXCELLENT'?'#34d399':'#60a5fa',fontSize:12,fontWeight:700}}>{w.real_margin_pct?`${Number(w.real_margin_pct).toFixed(1)}%`:'-'}</td>
                <td style={{padding:'6px 10px'}}><span style={{background:w.margin_verdict==='EXCELLENT'?'rgba(52,211,153,0.15)':'rgba(96,165,250,0.15)',color:w.margin_verdict==='EXCELLENT'?'#34d399':'#60a5fa',padding:'2px 6px',borderRadius:4,fontSize:10}}>{w.margin_verdict}</span></td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{w.total_cif_usd?`$${(w.total_cif_usd/1e6).toFixed(1)}M`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{w.avg_unit_rate_usd?`$${Number(w.avg_unit_rate_usd).toFixed(2)}`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{w.indiamart_sell_price_inr?`₹${Number(w.indiamart_sell_price_inr).toLocaleString()}`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{w.unique_buyers||'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{w.china_pct?`${Number(w.china_pct).toFixed(0)}%`:'-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
