import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};

export default function ProjectTracker() {
  const [tasks, setTasks] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [strategy, setStrategy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState('all');

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel('task-live').on('postgres_changes',{event:'*',schema:'public',table:'task_board'},()=>fetchAll()).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function fetchAll() {
    const [t, p, s] = await Promise.all([
      supabase.from('task_board').select('*').order('created_at',{ascending:false}),
      supabase.from('pipeline_master').select('*'),
      supabase.from('strategy_log').select('*').order('timestamp',{ascending:false}),
    ]);
    setTasks(t.data||[]); setPipeline(p.data||[]); setStrategy(s.data||[]);
    setLoading(false);
  }

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading tracker...</div>;

  const pending = tasks.filter(t=>t.status==='pending');
  const completed = tasks.filter(t=>t.status==='completed');
  const pipePhases = [
    {name:'Phase 2b', done:pipeline.filter(p=>p.phase2b_done).length},
    {name:'Phase 2', done:pipeline.filter(p=>p.phase2_done).length},
    {name:'Phase 3', done:pipeline.filter(p=>p.phase3_done).length},
    {name:'QA', done:pipeline.filter(p=>p.qa_done).length},
    {name:'Phase 4', done:pipeline.filter(p=>p.phase4_done).length},
    {name:'Phase 5', done:pipeline.filter(p=>p.phase5_done).length},
    {name:'HS8 Margin', done:pipeline.filter(p=>p.hs8_margin_research_done).length},
  ];
  const total = pipeline.length || 180;

  const kpis = [
    {label:'Pending', value:pending.length, color:'#f59e0b'},
    {label:'Completed', value:completed.length, color:'#34d399'},
    {label:'Completion %', value:`${total?Math.round(completed.length/(pending.length+completed.length)*100):0}%`, color:'#60a5fa'},
    {label:'Pipeline Done', value:pipeline.filter(p=>p.phase5_done).length, sub:`of ${total}`, color:'#a78bfa'},
    {label:'HS8 Research', value:pipeline.filter(p=>p.hs8_margin_research_done).length, sub:`of ${total}`, color:'#34d399'},
  ];

  const filteredPending = taskFilter==='all' ? pending : pending.filter(t=>t.task_type===taskFilter);
  const taskTypes = [...new Set(tasks.map(t=>t.task_type).filter(Boolean))];

  return (
    <div style={{padding:24}}>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:16, marginBottom:24}}>
        {kpis.map(k=>(
          <div key={k.label} style={{...card, borderTop:`3px solid ${k.color}`}}>
            <div style={{color:'#94a3b8',fontSize:12,textTransform:'uppercase'}}>{k.label}</div>
            <div style={{color:k.color,fontSize:28,fontWeight:700,marginTop:4}}>{k.value}</div>
            {k.sub && <div style={{color:'#64748b',fontSize:11,marginTop:4}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24}}>
        <div style={card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h3 style={{color:'#f59e0b',fontSize:14}}>Pending Tasks ({filteredPending.length})</h3>
            <select value={taskFilter} onChange={e=>setTaskFilter(e.target.value)} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'4px 8px',fontSize:12}}>
              <option value="all">All Types</option>
              {taskTypes.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{maxHeight:400,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['HS4','Type','Description','Priority'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:'#94a3b8',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.1)',position:'sticky',top:0,background:'rgba(17,24,39,0.95)'}}>{h}</th>)}</tr></thead>
              <tbody>{filteredPending.slice(0,50).map((t,i)=>(
                <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                  <td style={{padding:'6px 8px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{t.hs4}</td>
                  <td style={{padding:'6px 8px',color:'#94a3b8',fontSize:11}}>{t.task_type}</td>
                  <td style={{padding:'6px 8px',color:'#e2e8f0',fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</td>
                  <td style={{padding:'6px 8px'}}><span style={{background:t.priority==='high'?'rgba(248,113,113,0.15)':'rgba(148,163,184,0.1)',color:t.priority==='high'?'#f87171':'#94a3b8',padding:'2px 6px',borderRadius:4,fontSize:10}}>{t.priority||'normal'}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <div style={card}>
          <h3 style={{color:'#34d399',fontSize:14,marginBottom:12}}>Completed Tasks ({completed.length})</h3>
          <div style={{maxHeight:400,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['HS4','Type','Result','Done'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:'#94a3b8',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.1)',position:'sticky',top:0,background:'rgba(17,24,39,0.95)'}}>{h}</th>)}</tr></thead>
              <tbody>{completed.slice(0,50).map((t,i)=>(
                <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                  <td style={{padding:'6px 8px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{t.hs4}</td>
                  <td style={{padding:'6px 8px',color:'#94a3b8',fontSize:11}}>{t.task_type}</td>
                  <td style={{padding:'6px 8px',color:'#e2e8f0',fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.result_summary||'-'}</td>
                  <td style={{padding:'6px 8px',color:'#64748b',fontSize:11}}>{t.completed_at?new Date(t.completed_at).toLocaleDateString():'-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:16}}>Pipeline Phase Completion</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={pipePhases} layout="vertical"><XAxis type="number" domain={[0,total]} tick={{fill:'#94a3b8',fontSize:11}} /><YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} width={80} />
            <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} formatter={v=>[`${v}/${total} (${Math.round(v/total*100)}%)`,'Done']} />
            <Bar dataKey="done">{pipePhases.map((_,i)=><Cell key={i} fill={['#34d399','#60a5fa','#fbbf24','#a78bfa','#06b6d4','#f59e0b','#34d399'][i]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{...card,marginTop:16}}>
        <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:16}}>Strategy Timeline</h3>
        {strategy.map((s,i)=>(
          <div key={i} style={{display:'flex',gap:16,padding:'12px 0',borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
            <div style={{minWidth:120,color:'#64748b',fontSize:11}}>{s.timestamp?new Date(s.timestamp).toLocaleString():'-'}</div>
            <span style={{background:'rgba(96,165,250,0.15)',color:'#60a5fa',padding:'2px 8px',borderRadius:4,fontSize:11,height:'fit-content'}}>{s.phase}</span>
            <div><div style={{color:'#e2e8f0',fontSize:13,fontWeight:500}}>{s.action}</div><div style={{color:'#94a3b8',fontSize:12,marginTop:2}}>{s.details}</div>{s.impact && <div style={{color:'#34d399',fontSize:11,marginTop:2}}>Impact: {s.impact}</div>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
