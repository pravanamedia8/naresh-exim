import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};

export default function SupplyChainView() {
  const [alibaba, setAlibaba] = useState([]);
  const [indiamart, setIndiamart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({col:'gross_margin_pct',dir:'desc'});
  const [marginFilter, setMarginFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      supabase.from('phase2_alibaba_summary').select('*'),
      supabase.from('phase3_indiamart_summary').select('*'),
    ]).then(([a,i])=>{
      setAlibaba(a.data||[]);
      setIndiamart(i.data||[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading supply chain...</div>;

  // Join alibaba + indiamart by hs4
  const aliMap = {};
  alibaba.forEach(a=>{ aliMap[a.hs4]=a; });
  const joined = indiamart.map(im=>({
    hs4: im.hs4,
    // Supply side
    suppliers: aliMap[im.hs4]?.total_suppliers||0,
    verified: aliMap[im.hs4]?.verified_suppliers||0,
    gold_pct: aliMap[im.hs4]?.gold_supplier_pct||0,
    fob_low: aliMap[im.hs4]?.fob_lowest_usd||0,
    fob_high: aliMap[im.hs4]?.fob_highest_usd||0,
    fob_typ: aliMap[im.hs4]?.fob_typical_usd||0,
    moq: aliMap[im.hs4]?.typical_moq||'-',
    // Demand side
    sellers: im.total_sellers||0,
    mfr_pct: im.manufacturer_pct||0,
    trader_pct: im.trader_pct||0,
    price_low: im.price_low_inr||0,
    price_high: im.price_high_inr||0,
    price_typ: im.price_typical_inr||0,
    landed: im.landed_cost_inr||0,
    sell: im.sell_price_inr||0,
    margin_pct: im.gross_margin_pct||0,
    margin_inr: im.gross_margin_inr||0,
    keywords: aliMap[im.hs4]?.keywords_searched||0,
    ali_sources: aliMap[im.hs4]?.data_sources_used||'',
    im_sources: im.data_sources_used||'',
  }));

  // Also add alibaba-only entries that have no indiamart match
  alibaba.forEach(a=>{
    if(!indiamart.find(i=>i.hs4===a.hs4)){
      joined.push({
        hs4:a.hs4, suppliers:a.total_suppliers||0, verified:a.verified_suppliers||0,
        gold_pct:a.gold_supplier_pct||0, fob_low:a.fob_lowest_usd||0, fob_high:a.fob_highest_usd||0,
        fob_typ:a.fob_typical_usd||0, moq:a.typical_moq||'-',
        sellers:0, mfr_pct:0, trader_pct:0, price_low:0, price_high:0, price_typ:0,
        landed:0, sell:0, margin_pct:0, margin_inr:0, keywords:a.keywords_searched||0,
        ali_sources:a.data_sources_used||'', im_sources:'',
      });
    }
  });

  const totalCodes = joined.length;
  const withSupply = joined.filter(j=>j.suppliers>0).length;
  const withDemand = joined.filter(j=>j.sellers>0).length;
  const avgMargin = joined.filter(j=>j.margin_pct>0).length
    ? Math.round(joined.filter(j=>j.margin_pct>0).reduce((a,j)=>a+j.margin_pct,0)/joined.filter(j=>j.margin_pct>0).length*10)/10
    : 0;
  const highMargin = joined.filter(j=>j.margin_pct>=25).length;

  const kpis = [
    {label:'Total Codes',value:totalCodes,color:'#60a5fa'},
    {label:'With Supply',value:withSupply,sub:'Alibaba data',color:'#34d399'},
    {label:'With Demand',value:withDemand,sub:'IndiaMART data',color:'#fbbf24'},
    {label:'Avg Margin',value:`${avgMargin}%`,color:'#a78bfa'},
    {label:'High Margin',value:highMargin,sub:'margin >= 25%',color:'#34d399'},
  ];

  // Top 20 by margin
  const top20 = [...joined].filter(j=>j.margin_pct>0).sort((a,b)=>b.margin_pct-a.margin_pct).slice(0,20)
    .map(j=>({name:j.hs4,margin:j.margin_pct}));

  // Scatter: suppliers vs sellers, size = margin
  const scatterData = joined.filter(j=>j.suppliers>0&&j.sellers>0&&j.margin_pct>0)
    .map(j=>({x:j.suppliers,y:j.sellers,z:Math.max(j.margin_pct,5),name:j.hs4}));

  // Filters
  let filtered = joined;
  if(marginFilter==='high') filtered = filtered.filter(j=>j.margin_pct>=25);
  else if(marginFilter==='mid') filtered = filtered.filter(j=>j.margin_pct>=10&&j.margin_pct<25);
  else if(marginFilter==='low') filtered = filtered.filter(j=>j.margin_pct<10&&j.margin_pct>0);
  else if(marginFilter==='none') filtered = filtered.filter(j=>j.margin_pct===0);
  if(search) filtered = filtered.filter(j=>j.hs4.includes(search));
  filtered = [...filtered].sort((a,b)=>{ let av=a[sort.col]??-Infinity,bv=b[sort.col]??-Infinity; return sort.dir==='asc'?(av<bv?-1:1):(av>bv?-1:1); });

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
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Top 20 by Gross Margin %</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top20} layout="vertical"><XAxis type="number" tick={{fill:'#94a3b8',fontSize:11}} unit="%" /><YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} width={60} />
              <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} formatter={v=>[`${v.toFixed(1)}%`,'Margin']} />
              <Bar dataKey="margin">{top20.map((_,i)=><Cell key={i} fill={i<5?'#34d399':i<10?'#60a5fa':i<15?'#fbbf24':'#a78bfa'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Supply vs Demand (size = margin)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart><XAxis type="number" dataKey="x" name="Suppliers" tick={{fill:'#94a3b8',fontSize:11}} label={{value:'Alibaba Suppliers',fill:'#64748b',fontSize:11,position:'bottom'}} />
              <YAxis type="number" dataKey="y" name="Sellers" tick={{fill:'#94a3b8',fontSize:11}} label={{value:'IndiaMART Sellers',fill:'#64748b',fontSize:11,angle:-90,position:'left'}} />
              <ZAxis type="number" dataKey="z" range={[30,400]} />
              <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} formatter={(v,n)=>[v,n]} labelFormatter={()=>''} />
              <Scatter data={scatterData} fill="#60a5fa" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:0}}>Supply Chain Matrix ({filtered.length})</h3>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS4..." style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 12px',fontSize:12,width:140}} />
          <select value={marginFilter} onChange={e=>setMarginFilter(e.target.value)} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 8px',fontSize:12}}>
            <option value="all">All Margins</option>
            <option value="high">High (25%+)</option>
            <option value="mid">Medium (10-25%)</option>
            <option value="low">Low (&lt;10%)</option>
            <option value="none">No Margin Data</option>
          </select>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['hs4','HS4'],['suppliers','Suppliers'],['gold_pct','Gold %'],['fob_typ','FOB $'],['sellers','Sellers'],['mfr_pct','Mfr %'],['price_typ','Sell INR'],['landed','Landed INR'],['margin_pct','Margin %']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.slice(0,200).map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{r.hs4}</td>
                <td style={{padding:'6px 10px',color:r.suppliers>50?'#34d399':r.suppliers>10?'#fbbf24':'#f87171',fontSize:12}}>{r.suppliers||'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.gold_pct?`${Number(r.gold_pct).toFixed(0)}%`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.fob_typ?`$${Number(r.fob_typ).toFixed(2)}`:'-'}</td>
                <td style={{padding:'6px 10px',color:r.sellers>100?'#34d399':r.sellers>20?'#fbbf24':'#f87171',fontSize:12}}>{r.sellers||'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.mfr_pct?`${Number(r.mfr_pct).toFixed(0)}%`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.price_typ?`₹${Number(r.price_typ).toLocaleString()}`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.landed?`₹${Number(r.landed).toLocaleString()}`:'-'}</td>
                <td style={{padding:'6px 10px',color:r.margin_pct>25?'#34d399':r.margin_pct>10?'#fbbf24':'#f87171',fontSize:12,fontWeight:600}}>{r.margin_pct?`${Number(r.margin_pct).toFixed(1)}%`:'-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
