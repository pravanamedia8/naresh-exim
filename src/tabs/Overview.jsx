import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = { EXCELLENT: '#34d399', GOOD: '#60a5fa', MODERATE: '#fbbf24', THIN: '#f59e0b', NEGATIVE: '#f87171', PURSUE: '#34d399', STRONG: '#60a5fa', REGULAR: '#34d399', SPOT: '#fbbf24', MIXED: '#a78bfa', BROKER: '#60a5fa' };

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [rc, p5, hm, tb, vq, sl] = await Promise.all([
        supabase.from('research_codes').select('current_phase, trading_model'),
        supabase.from('phase5_scoring').select('verdict'),
        supabase.from('hs8_margin_analysis').select('margin_verdict'),
        supabase.from('task_board').select('status'),
        supabase.from('volza_scrape_queue').select('scrape_status'),
        supabase.from('strategy_log').select('*').order('timestamp', { ascending: false }).limit(5),
      ]);
      const phases = {}; (rc.data||[]).forEach(r => { phases[r.current_phase] = (phases[r.current_phase]||0)+1; });
      const models = {}; (rc.data||[]).forEach(r => { if(r.trading_model) models[r.trading_model] = (models[r.trading_model]||0)+1; });
      const verdicts = {}; (p5.data||[]).forEach(r => { verdicts[r.verdict] = (verdicts[r.verdict]||0)+1; });
      const margins = {}; (hm.data||[]).forEach(r => { margins[r.margin_verdict] = (margins[r.margin_verdict]||0)+1; });
      const taskPending = (tb.data||[]).filter(r => r.status==='pending').length;
      const taskDone = (tb.data||[]).filter(r => r.status==='completed').length;
      const scrapeComp = (vq.data||[]).filter(r => r.scrape_status==='completed').length;
      const scrapeTotal = (vq.data||[]).length;
      setData({ phases, models, verdicts, margins, taskPending, taskDone, scrapeComp, scrapeTotal, strategy: sl.data||[], totalCodes: (rc.data||[]).length, marginTotal: (hm.data||[]).length });
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading dashboard...</div>;
  if (!data) return <div style={{padding:40,color:'#f87171'}}>Error loading data</div>;

  const phaseData = Object.entries(data.phases).map(([name,value]) => ({name: name.replace(/_/g,' '), value}));
  const marginData = ['EXCELLENT','GOOD','MODERATE','THIN','NEGATIVE'].map(v => ({name:v, count: data.margins[v]||0}));
  const modelData = Object.entries(data.models).map(([name,value]) => ({name,value}));

  const kpis = [
    {label:'Research Codes', value:data.totalCodes, color:'#60a5fa'},
    {label:'Phase 5 Scored', value:(data.verdicts.PURSUE||0)+(data.verdicts.STRONG||0), sub:`${data.verdicts.PURSUE||0} PURSUE + ${data.verdicts.STRONG||0} STRONG`, color:'#34d399'},
    {label:'HS8 Winners', value:(data.margins.EXCELLENT||0)+(data.margins.GOOD||0), sub:`of ${data.marginTotal} analyzed`, color:'#fbbf24'},
    {label:'Tasks Pending', value:data.taskPending, sub:`${data.taskDone} completed`, color:'#f59e0b'},
    {label:'Volza Scraped', value:`${data.scrapeComp}/${data.scrapeTotal}`, color:'#a78bfa'},
    {label:'Trading Models', value:Object.values(data.models).reduce((a,b)=>a+b,0), sub:Object.entries(data.models).map(([k,v])=>`${v} ${k}`).join(', '), color:'#34d399'},
  ];

  const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};

  return (
    <div style={{padding:24}}>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24}}>
        {kpis.map(k => (
          <div key={k.label} style={{...card, borderTop:`3px solid ${k.color}`}}>
            <div style={{color:'#94a3b8', fontSize:12, textTransform:'uppercase', letterSpacing:1}}>{k.label}</div>
            <div style={{color:k.color, fontSize:28, fontWeight:700, marginTop:4}}>{k.value}</div>
            {k.sub && <div style={{color:'#64748b', fontSize:11, marginTop:4}}>{k.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:24}}>
        <div style={card}>
          <h3 style={{color:'#e2e8f0', fontSize:14, marginBottom:12}}>Research Phases</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={phaseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({value})=>`${value}`}>
              {phaseData.map((_,i) => <Cell key={i} fill={['#34d399','#60a5fa','#fbbf24','#a78bfa','#f87171','#06b6d4'][i%6]} />)}
            </Pie><Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} /><Legend wrapperStyle={{fontSize:11}} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0', fontSize:14, marginBottom:12}}>HS8 Margin Verdicts</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={marginData}><XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} /><YAxis tick={{fill:'#94a3b8',fontSize:11}} /><Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} />
              <Bar dataKey="count">{marginData.map((d,i)=><Cell key={i} fill={COLORS[d.name]||'#60a5fa'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0', fontSize:14, marginBottom:12}}>Trading Models</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={modelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`}>
              {modelData.map((d,i)=><Cell key={i} fill={COLORS[d.name]||'#60a5fa'} />)}
            </Pie><Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={card}>
        <h3 style={{color:'#e2e8f0', fontSize:14, marginBottom:12}}>Recent Strategy Updates</h3>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead><tr>{['Time','Phase','Action','Details'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 12px',color:'#94a3b8',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.1)',textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
          <tbody>{(data.strategy).map((s,i)=>(
            <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
              <td style={{padding:'8px 12px',color:'#64748b',fontSize:12}}>{s.timestamp?new Date(s.timestamp).toLocaleString():'-'}</td>
              <td style={{padding:'8px 12px'}}><span style={{background:'rgba(96,165,250,0.15)',color:'#60a5fa',padding:'2px 8px',borderRadius:4,fontSize:11}}>{s.phase}</span></td>
              <td style={{padding:'8px 12px',color:'#e2e8f0',fontSize:13,fontWeight:500}}>{s.action}</td>
              <td style={{padding:'8px 12px',color:'#94a3b8',fontSize:12,maxWidth:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.details}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
