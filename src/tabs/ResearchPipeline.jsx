import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};
const PHASE_COLORS = { phase1_complete:'#94a3b8', phase2b_done:'#60a5fa', phase3_pending:'#fbbf24', qa_pending:'#a78bfa', complete:'#34d399', phase4_complete:'#06b6d4' };
const MODEL_COLORS = { REGULAR:'#34d399', SPOT:'#fbbf24', BROKER:'#60a5fa', MIXED:'#a78bfa' };
const VERDICT_COLORS = { PURSUE:'#34d399', STRONG:'#60a5fa', MODERATE:'#fbbf24', DROP:'#f87171' };

export default function ResearchPipeline() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [sort, setSort] = useState({col:'drill_score',dir:'desc'});
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('research_codes').select('*').then(({data})=>{ setCodes(data||[]); setLoading(false); });
  }, []);

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading pipeline...</div>;

  const phases = {};
  codes.forEach(c => { phases[c.current_phase] = (phases[c.current_phase]||0)+1; });
  const phaseData = Object.entries(phases).map(([name,value])=>({name:name.replace(/_/g,' '),value}));

  const models = {};
  codes.forEach(c => { if(c.trading_model) models[c.trading_model] = (models[c.trading_model]||0)+1; });
  const modelData = Object.entries(models).map(([name,value])=>({name,value}));

  const verdicts = {};
  codes.forEach(c => { if(c.verdict_scoring) verdicts[c.verdict_scoring] = (verdicts[c.verdict_scoring]||0)+1; });
  const verdictData = Object.entries(verdicts).map(([name,value])=>({name,value}));

  const complete = codes.filter(c=>c.current_phase==='complete').length;
  const qaPass = codes.filter(c=>c.qa_status==='PASS').length;
  const p4Done = codes.filter(c=>c.phase4_status==='DONE').length;
  const p5Done = codes.filter(c=>c.phase5_status==='DONE').length;

  const kpis = [
    {label:'Total Codes',value:codes.length,color:'#60a5fa'},
    {label:'QA Passed',value:qaPass,color:'#34d399'},
    {label:'Phase 4 Done',value:p4Done,color:'#06b6d4'},
    {label:'Phase 5 Scored',value:p5Done,color:'#a78bfa'},
    {label:'Complete',value:complete,color:'#34d399'},
  ];

  const allPhases = [...new Set(codes.map(c=>c.current_phase).filter(Boolean))];
  const allModels = [...new Set(codes.map(c=>c.trading_model).filter(Boolean))];

  let filtered = codes;
  if(phaseFilter!=='all') filtered = filtered.filter(c=>c.current_phase===phaseFilter);
  if(modelFilter!=='all') filtered = filtered.filter(c=>c.trading_model===modelFilter);
  if(search) filtered = filtered.filter(c=>(c.hs4+' '+c.commodity).toLowerCase().includes(search.toLowerCase()));
  filtered.sort((a,b)=>{
    let av=a[sort.col], bv=b[sort.col];
    if(typeof av==='string') av=(av||'').toLowerCase();
    if(typeof bv==='string') bv=(bv||'').toLowerCase();
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

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:24}}>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Phase Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={phaseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({value})=>`${value}`}>
              {phaseData.map((d,i)=><Cell key={i} fill={PHASE_COLORS[d.name.replace(/ /g,'_')]||['#34d399','#60a5fa','#fbbf24','#a78bfa','#f87171','#06b6d4'][i%6]} />)}
            </Pie><Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} /><Legend wrapperStyle={{fontSize:11}} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Trading Models</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={modelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`}>
              {modelData.map((d,i)=><Cell key={i} fill={MODEL_COLORS[d.name]||'#60a5fa'} />)}
            </Pie><Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Scoring Verdicts</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={verdictData}><XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} /><YAxis tick={{fill:'#94a3b8',fontSize:11}} />
              <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} />
              <Bar dataKey="value">{verdictData.map((d,i)=><Cell key={i} fill={VERDICT_COLORS[d.name]||'#60a5fa'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          <h3 style={{color:'#e2e8f0',fontSize:14,margin:0}}>Research Codes ({filtered.length})</h3>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS4 / commodity..." style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 12px',fontSize:12,flex:1,minWidth:180}} />
          <select value={phaseFilter} onChange={e=>setPhaseFilter(e.target.value)} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 8px',fontSize:12}}>
            <option value="all">All Phases</option>
            {allPhases.map(p=><option key={p} value={p}>{p.replace(/_/g,' ')}</option>)}
          </select>
          <select value={modelFilter} onChange={e=>setModelFilter(e.target.value)} style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 8px',fontSize:12}}>
            <option value="all">All Models</option>
            {allModels.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['hs4','HS4'],['commodity','Commodity'],['val_m','Val $M'],['drill_score','Score'],['current_phase','Phase'],['trading_model','Model'],['qa_status','QA'],['phase4_status','P4'],['phase5_status','P5']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.slice(0,200).map((c,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{c.hs4}</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.commodity}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{c.val_m?`$${Number(c.val_m).toFixed(0)}M`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#fbbf24',fontSize:12,fontWeight:600}}>{c.drill_score||'-'}</td>
                <td style={{padding:'6px 10px'}}><span style={{background:'rgba(96,165,250,0.15)',color:'#60a5fa',padding:'2px 6px',borderRadius:4,fontSize:10}}>{(c.current_phase||'').replace(/_/g,' ')}</span></td>
                <td style={{padding:'6px 10px'}}>{c.trading_model&&<span style={{background:`rgba(${c.trading_model==='REGULAR'?'52,211,153':c.trading_model==='SPOT'?'251,191,36':'96,165,250'},0.15)`,color:MODEL_COLORS[c.trading_model]||'#94a3b8',padding:'2px 6px',borderRadius:4,fontSize:10}}>{c.trading_model}</span>}</td>
                <td style={{padding:'6px 10px'}}><span style={{color:c.qa_status==='PASS'?'#34d399':c.qa_status==='FAIL'?'#f87171':'#94a3b8',fontSize:11}}>{c.qa_status||'-'}</span></td>
                <td style={{padding:'6px 10px',color:c.phase4_status==='DONE'?'#34d399':'#64748b',fontSize:11}}>{c.phase4_status||'-'}</td>
                <td style={{padding:'6px 10px',color:c.phase5_status==='DONE'?'#34d399':'#64748b',fontSize:11}}>{c.phase5_status||'-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
