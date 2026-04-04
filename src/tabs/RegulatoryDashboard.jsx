import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};
const RISK_COLORS = { LOW:'#34d399', MEDIUM:'#fbbf24', HIGH:'#f59e0b', CRITICAL:'#f87171' };

export default function RegulatoryDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({col:'total_duty_pct',dir:'desc'});

  useEffect(() => {
    supabase.from('phase2b_regulatory').select('*').order('total_duty_pct',{ascending:false}).then(({data:d})=>{ setData(d||[]); setLoading(false); });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading regulatory...</div>;

  const risks = {};
  data.forEach(r=>{ if(r.regulatory_risk_score) risks[r.regulatory_risk_score]=(risks[r.regulatory_risk_score]||0)+1; });
  const riskData = Object.entries(risks).map(([name,value])=>({name,value}));

  const dutyBuckets = [{name:'0-10%',count:0},{name:'10-20%',count:0},{name:'20-30%',count:0},{name:'30-50%',count:0},{name:'50%+',count:0}];
  data.forEach(r=>{
    const d = r.total_duty_pct||0;
    if(d<=10) dutyBuckets[0].count++;
    else if(d<=20) dutyBuckets[1].count++;
    else if(d<=30) dutyBuckets[2].count++;
    else if(d<=50) dutyBuckets[3].count++;
    else dutyBuckets[4].count++;
  });

  const addCodes = data.filter(r=>r.check_anti_dumping).length;
  const bisCodes = data.filter(r=>r.check_bis_qco).length;
  const wpcCodes = data.filter(r=>r.check_wpc).length;
  const ftaCodes = data.filter(r=>r.check_fta).length;
  const avgDuty = data.length ? Math.round(data.reduce((a,r)=>a+(r.total_duty_pct||0),0)/data.length*10)/10 : 0;

  const kpis = [
    {label:'Codes Checked',value:data.length,color:'#60a5fa'},
    {label:'Avg Duty',value:`${avgDuty}%`,color:'#fbbf24'},
    {label:'Anti-Dumping',value:addCodes,sub:'codes flagged',color:'#f87171'},
    {label:'BIS QCO',value:bisCodes,sub:'codes required',color:'#f59e0b'},
    {label:'FTA Benefit',value:ftaCodes,sub:'codes eligible',color:'#34d399'},
  ];

  let filtered = data;
  if(riskFilter!=='all') filtered = filtered.filter(r=>r.regulatory_risk_score===riskFilter);
  if(search) filtered = filtered.filter(r=>(r.hs4||'').includes(search));
  filtered = [...filtered].sort((a,b)=>{ let av=a[sort.col]??-Infinity,bv=b[sort.col]??-Infinity; return sort.dir==='asc'?(av<bv?-1:1):(av>bv?-1:1); });

  const toggleSort = col => setSort(s=>({col,dir:s.col===col&&s.dir==='desc'?'asc':'desc'}));
  const thStyle = {textAlign:'left',padding:'8px 10px',color:'#94a3b8',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.1)',cursor:'pointer',position:'sticky',top:0,background:'rgba(17,24,39,0.95)',textTransform:'uppercase'};

  const check = (v) => v ? <span style={{color:'#f87171'}}>Yes</span> : <span style={{color:'#64748b'}}>No</span>;

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
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`}>
              {riskData.map((d,i)=><Cell key={i} fill={RISK_COLORS[d.name]||['#34d399','#60a5fa','#fbbf24','#f87171'][i%4]} />)}
            </Pie><Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} /><Legend wrapperStyle={{fontSize:11}} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Duty Rate Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dutyBuckets}><XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} /><YAxis tick={{fill:'#94a3b8',fontSize:11}} />
              <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} />
              <Bar dataKey="count">{dutyBuckets.map((_,i)=><Cell key={i} fill={['#34d399','#60a5fa','#fbbf24','#f59e0b','#f87171'][i]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:0}}>Regulatory Checks ({filtered.length})</h3>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS4..." style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 12px',fontSize:12,width:150}} />
          <select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 8px',fontSize:12}}>
            <option value="all">All Risk Levels</option>
            {Object.keys(risks).map(r=><option key={r} value={r}>{r} ({risks[r]})</option>)}
          </select>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['hs4','HS4'],['total_duty_pct','Duty %'],['bcd_pct','BCD'],['igst_pct','IGST'],['regulatory_risk_score','Risk'],['check_anti_dumping','ADD'],['check_bis_qco','BIS'],['check_wpc','WPC'],['check_dgft_restriction','DGFT'],['check_fta','FTA']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.slice(0,200).map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{r.hs4}</td>
                <td style={{padding:'6px 10px',color:r.total_duty_pct>30?'#f87171':r.total_duty_pct>20?'#fbbf24':'#34d399',fontSize:12,fontWeight:600}}>{r.total_duty_pct?`${Number(r.total_duty_pct).toFixed(1)}%`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.bcd_pct?`${r.bcd_pct}%`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:11}}>{r.igst_pct?`${r.igst_pct}%`:'-'}</td>
                <td style={{padding:'6px 10px'}}><span style={{background:`rgba(${r.regulatory_risk_score==='LOW'?'52,211,153':r.regulatory_risk_score==='MEDIUM'?'251,191,36':'248,113,113'},0.15)`,color:RISK_COLORS[r.regulatory_risk_score]||'#94a3b8',padding:'2px 6px',borderRadius:4,fontSize:10}}>{r.regulatory_risk_score||'-'}</span></td>
                <td style={{padding:'6px 10px',fontSize:11}}>{check(r.check_anti_dumping)}</td>
                <td style={{padding:'6px 10px',fontSize:11}}>{check(r.check_bis_qco)}</td>
                <td style={{padding:'6px 10px',fontSize:11}}>{check(r.check_wpc)}</td>
                <td style={{padding:'6px 10px',fontSize:11}}>{check(r.check_dgft_restriction)}</td>
                <td style={{padding:'6px 10px',fontSize:11}}>{r.check_fta?<span style={{color:'#34d399'}}>Yes</span>:<span style={{color:'#64748b'}}>No</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
