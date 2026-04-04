import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};
const VERDICT_COLORS = { PURSUE:'#34d399', STRONG:'#60a5fa', MODERATE:'#fbbf24', DROP:'#f87171' };

export default function ScoringDashboard() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [sort, setSort] = useState({col:'total_score',dir:'desc'});

  useEffect(() => {
    supabase.from('phase5_scoring').select('*').order('total_score',{ascending:false}).then(({data})=>{ setScores(data||[]); setLoading(false); });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading scores...</div>;

  const verdicts = {};
  scores.forEach(s=>{ verdicts[s.verdict]=(verdicts[s.verdict]||0)+1; });
  const verdictData = Object.entries(verdicts).map(([name,value])=>({name,value}));

  const pursue = scores.filter(s=>s.verdict==='PURSUE');
  const strong = scores.filter(s=>s.verdict==='STRONG');
  const avgScore = scores.length ? Math.round(scores.reduce((a,s)=>a+s.total_score,0)/scores.length) : 0;

  const factors = ['margin_pts','buyer_access_pts','supply_pts','market_size_pts','regulatory_pts','competition_pts','growth_pts','working_capital_pts','logistics_pts','obsolescence_pts','capital_pts','fta_pts'];
  const factorLabels = {margin_pts:'Margin',buyer_access_pts:'Buyer Access',supply_pts:'Supply',market_size_pts:'Market Size',regulatory_pts:'Regulatory',competition_pts:'Competition',growth_pts:'Growth',working_capital_pts:'Working Cap',logistics_pts:'Logistics',obsolescence_pts:'Obsolescence',capital_pts:'Capital',fta_pts:'FTA'};
  const factorMax = {margin_pts:25,buyer_access_pts:20,supply_pts:15,market_size_pts:15,regulatory_pts:15,competition_pts:10,growth_pts:10,working_capital_pts:10,logistics_pts:10,obsolescence_pts:10,capital_pts:5,fta_pts:5};

  const avgFactors = factors.map(f=>({
    name: factorLabels[f],
    avg: scores.length ? Math.round(scores.reduce((a,s)=>a+(s[f]||0),0)/scores.length*10)/10 : 0,
    max: factorMax[f]
  }));

  const kpis = [
    {label:'Total Scored',value:scores.length,color:'#60a5fa'},
    {label:'PURSUE',value:pursue.length,color:'#34d399'},
    {label:'STRONG',value:strong.length,color:'#60a5fa'},
    {label:'Avg Score',value:`${avgScore}/150`,color:'#fbbf24'},
    {label:'Top Score',value:scores[0]?.total_score||0,color:'#a78bfa'},
  ];

  let filtered = verdictFilter==='all' ? scores : scores.filter(s=>s.verdict===verdictFilter);
  filtered.sort((a,b)=>{
    let av=a[sort.col], bv=b[sort.col];
    if(av<bv) return sort.dir==='asc'?-1:1;
    if(av>bv) return sort.dir==='asc'?1:-1;
    return 0;
  });

  const toggleSort = col => setSort(s=>({col,dir:s.col===col&&s.dir==='desc'?'asc':'desc'}));
  const thStyle = {textAlign:'left',padding:'8px 10px',color:'#94a3b8',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.1)',cursor:'pointer',position:'sticky',top:0,background:'rgba(17,24,39,0.95)',textTransform:'uppercase'};

  return (
    <div style={{padding:24}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:16,marginBottom:24}}>
        {kpis.map(k=>(
          <div key={k.label} style={{...card,borderTop:`3px solid ${k.color}`}}>
            <div style={{color:'#94a3b8',fontSize:12,textTransform:'uppercase'}}>{k.label}</div>
            <div style={{color:k.color,fontSize:28,fontWeight:700,marginTop:4}}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Verdict Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={verdictData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`}>
              {verdictData.map((d,i)=><Cell key={i} fill={VERDICT_COLORS[d.name]||'#60a5fa'} />)}
            </Pie><Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Average Factor Scores</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={avgFactors} layout="vertical"><XAxis type="number" tick={{fill:'#94a3b8',fontSize:10}} /><YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} width={90} />
              <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} formatter={(v,n,p)=>[`${v} / ${p.payload.max}`,'Avg']} />
              <Bar dataKey="avg" fill="#60a5fa">{avgFactors.map((_,i)=><Cell key={i} fill={['#34d399','#60a5fa','#fbbf24','#a78bfa','#f87171','#06b6d4','#34d399','#60a5fa','#fbbf24','#a78bfa','#f87171','#06b6d4'][i]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center'}}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:0}}>Scoring Table ({filtered.length})</h3>
          <select value={verdictFilter} onChange={e=>setVerdictFilter(e.target.value)} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 8px',fontSize:12}}>
            <option value="all">All Verdicts</option>
            {Object.keys(verdicts).map(v=><option key={v} value={v}>{v} ({verdicts[v]})</option>)}
          </select>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['hs4','HS4'],['total_score','Score'],['verdict','Verdict'],['margin_pts','Margin'],['buyer_access_pts','Buyers'],['supply_pts','Supply'],['market_size_pts','Market'],['regulatory_pts','Reg'],['competition_pts','Comp'],['growth_pts','Growth']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.map((s,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{s.hs4}</td>
                <td style={{padding:'6px 10px',color:'#fbbf24',fontSize:13,fontWeight:700}}>{s.total_score}</td>
                <td style={{padding:'6px 10px'}}><span style={{background:`rgba(${s.verdict==='PURSUE'?'52,211,153':s.verdict==='STRONG'?'96,165,250':'251,191,36'},0.15)`,color:VERDICT_COLORS[s.verdict]||'#94a3b8',padding:'2px 8px',borderRadius:4,fontSize:11}}>{s.verdict}</span></td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12}}>{s.margin_pts||0}/25</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12}}>{s.buyer_access_pts||0}/20</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12}}>{s.supply_pts||0}/15</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12}}>{s.market_size_pts||0}/15</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12}}>{s.regulatory_pts||0}/15</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12}}>{s.competition_pts||0}/10</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12}}>{s.growth_pts||0}/10</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
