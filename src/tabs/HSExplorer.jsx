import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const card = {background:'rgba(17,24,39,0.8)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:12, padding:20};
const VERDICT_COLORS = { PASS:'#34d399', MAYBE:'#fbbf24', WATCH:'#a78bfa', DROP:'#f87171' };

export default function HSExplorer() {
  const [level, setLevel] = useState('hs2');
  const [hs2Data, setHs2Data] = useState([]);
  const [hs4Data, setHs4Data] = useState([]);
  const [hs8Data, setHs8Data] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHs2, setSelectedHs2] = useState(null);
  const [selectedHs4, setSelectedHs4] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({col:'chapter_score',dir:'desc'});

  useEffect(() => {
    Promise.all([
      supabase.from('hs2_scored').select('*').order('chapter_score',{ascending:false}),
      supabase.from('hs4_scored').select('*').order('drill_score',{ascending:false}).limit(1200),
    ]).then(([h2,h4])=>{
      setHs2Data(h2.data||[]);
      setHs4Data(h4.data||[]);
      setLoading(false);
    });
  }, []);

  async function drillToHs8(hs4) {
    setSelectedHs4(hs4);
    setLevel('hs8');
    const {data} = await supabase.from('hs8_raw').select('*').eq('hs4',hs4).order('val_2024_25',{ascending:false});
    setHs8Data(data||[]);
  }

  if (loading) return <div style={{padding:40,color:'#94a3b8'}}>Loading hierarchy...</div>;

  const breadcrumb = (
    <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
      <button onClick={()=>{setLevel('hs2');setSelectedHs2(null);setSelectedHs4(null);setSearch('');}} style={{background:level==='hs2'?'rgba(96,165,250,0.15)':'transparent',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.3)',borderRadius:6,padding:'4px 12px',fontSize:12,cursor:'pointer'}}>HS2 Chapters ({hs2Data.length})</button>
      <span style={{color:'#64748b'}}>/</span>
      <button onClick={()=>{setLevel('hs4');setSelectedHs4(null);setSearch('');}} style={{background:level==='hs4'?'rgba(96,165,250,0.15)':'transparent',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.3)',borderRadius:6,padding:'4px 12px',fontSize:12,cursor:'pointer'}}>HS4 Products ({selectedHs2?hs4Data.filter(h=>h.hs2===selectedHs2).length:hs4Data.length})</button>
      <span style={{color:'#64748b'}}>/</span>
      <button disabled={!selectedHs4} style={{background:level==='hs8'?'rgba(96,165,250,0.15)':'transparent',color:selectedHs4?'#60a5fa':'#64748b',border:'1px solid rgba(96,165,250,0.3)',borderRadius:6,padding:'4px 12px',fontSize:12,cursor:'pointer'}}>HS8 Raw ({hs8Data.length})</button>
    </div>
  );

  const toggleSort = col => setSort(s=>({col,dir:s.col===col&&s.dir==='desc'?'asc':'desc'}));
  const thStyle = {textAlign:'left',padding:'8px 10px',color:'#94a3b8',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.1)',cursor:'pointer',position:'sticky',top:0,background:'rgba(17,24,39,0.95)',textTransform:'uppercase'};

  const renderHs2 = () => {
    let rows = hs2Data;
    if(search) rows = rows.filter(r=>(r.hs2+' '+r.description).toLowerCase().includes(search.toLowerCase()));
    rows = [...rows].sort((a,b)=>{ let av=a[sort.col]??-Infinity,bv=b[sort.col]??-Infinity; return sort.dir==='asc'?(av<bv?-1:1):(av>bv?-1:1); });
    const top15 = rows.slice(0,15).map(r=>({name:`Ch ${r.hs2}`,score:r.chapter_score||0}));
    return (<>
      <div style={{...card,marginBottom:24}}>
        <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>Top 15 HS2 Chapters by Score</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={top15}><XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} /><YAxis tick={{fill:'#94a3b8',fontSize:11}} />
            <Tooltip contentStyle={{background:'#1e293b',border:'none',color:'#e2e8f0'}} />
            <Bar dataKey="score">{top15.map((_,i)=><Cell key={i} fill={['#34d399','#60a5fa','#fbbf24','#a78bfa','#f87171','#06b6d4'][i%6]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS2 / description..." style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 12px',fontSize:12,flex:1}} />
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['hs2','HS2'],['description','Description'],['chapter_score','Score'],['verdict','Verdict'],['total_val','Value $M'],['hs4_count','HS4s'],['avg_growth','Avg Growth']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{rows.map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)',cursor:'pointer'}} onClick={()=>{setSelectedHs2(r.hs2);setLevel('hs4');setSearch('');setSort({col:'drill_score',dir:'desc'});}}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{r.hs2}</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</td>
                <td style={{padding:'6px 10px',color:'#fbbf24',fontSize:12,fontWeight:600}}>{r.chapter_score||'-'}</td>
                <td style={{padding:'6px 10px'}}><span style={{background:`rgba(${r.verdict==='PASS'?'52,211,153':r.verdict==='MAYBE'?'251,191,36':'248,113,113'},0.15)`,color:VERDICT_COLORS[r.verdict]||'#94a3b8',padding:'2px 6px',borderRadius:4,fontSize:10}}>{r.verdict||'-'}</span></td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{r.total_val?`$${Number(r.total_val).toFixed(0)}M`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{r.hs4_count||'-'}</td>
                <td style={{padding:'6px 10px',color:r.avg_growth>0?'#34d399':'#f87171',fontSize:12}}>{r.avg_growth?`${Number(r.avg_growth).toFixed(1)}%`:'-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </>);
  };

  const renderHs4 = () => {
    let rows = selectedHs2 ? hs4Data.filter(h=>h.hs2===selectedHs2) : hs4Data;
    if(search) rows = rows.filter(r=>(r.hs4+' '+r.commodity).toLowerCase().includes(search.toLowerCase()));
    rows = [...rows].sort((a,b)=>{ let av=a[sort.col]??-Infinity,bv=b[sort.col]??-Infinity; return sort.dir==='asc'?(av<bv?-1:1):(av>bv?-1:1); });
    return (
      <div style={card}>
        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search HS4 / commodity..." style={{background:'#1e293b',color:'#e2e8f0',border:'1px solid rgba(148,163,184,0.2)',borderRadius:6,padding:'6px 12px',fontSize:12,flex:1}} />
          {selectedHs2 && <span style={{color:'#60a5fa',fontSize:12,padding:'6px'}}>Chapter {selectedHs2}</span>}
        </div>
        <div style={{maxHeight:600,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {[['hs4','HS4'],['commodity','Commodity'],['drill_score','Score'],['verdict','Verdict'],['val_2024_25','Val $M'],['growth_1yr','Growth'],['bcd_rate','BCD %'],['hs8_count','HS8s']].map(([col,label])=>(
                <th key={col} onClick={()=>toggleSort(col)} style={thStyle}>{label}{sort.col===col?(sort.dir==='asc'?' ▲':' ▼'):''}</th>
              ))}
            </tr></thead>
            <tbody>{rows.slice(0,300).map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)',cursor:'pointer'}} onClick={()=>drillToHs8(r.hs4)}>
                <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:12,fontFamily:'monospace'}}>{r.hs4}</td>
                <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12,maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.commodity}</td>
                <td style={{padding:'6px 10px',color:'#fbbf24',fontSize:12,fontWeight:600}}>{r.drill_score||'-'}</td>
                <td style={{padding:'6px 10px'}}><span style={{background:`rgba(${r.verdict==='PASS'?'52,211,153':r.verdict==='MAYBE'?'251,191,36':'248,113,113'},0.15)`,color:VERDICT_COLORS[r.verdict]||'#94a3b8',padding:'2px 6px',borderRadius:4,fontSize:10}}>{r.verdict||'-'}</span></td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{r.val_2024_25?`$${Number(r.val_2024_25).toFixed(0)}M`:'-'}</td>
                <td style={{padding:'6px 10px',color:r.growth_1yr>0?'#34d399':'#f87171',fontSize:12}}>{r.growth_1yr?`${Number(r.growth_1yr).toFixed(1)}%`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{r.bcd_rate?`${r.bcd_rate}%`:'-'}</td>
                <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{r.hs8_count||'-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderHs8 = () => (
    <div style={card}>
      <h3 style={{color:'#e2e8f0',fontSize:14,marginBottom:12}}>HS8 Products for {selectedHs4} ({hs8Data.length})</h3>
      <div style={{maxHeight:600,overflowY:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>
            {['HS8','Commodity','Val 24-25 $M','Val 23-24 $M','Growth 1yr','Growth 3yr CAGR'].map(h=>(
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{hs8Data.map((r,i)=>(
            <tr key={i} style={{borderBottom:'1px solid rgba(148,163,184,0.05)'}}>
              <td style={{padding:'6px 10px',color:'#60a5fa',fontSize:11,fontFamily:'monospace'}}>{r.hs8}</td>
              <td style={{padding:'6px 10px',color:'#e2e8f0',fontSize:12,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.commodity}</td>
              <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{r.val_2024_25?`$${Number(r.val_2024_25).toFixed(1)}M`:'-'}</td>
              <td style={{padding:'6px 10px',color:'#94a3b8',fontSize:12}}>{r.val_2023_24?`$${Number(r.val_2023_24).toFixed(1)}M`:'-'}</td>
              <td style={{padding:'6px 10px',color:r.growth_1yr>0?'#34d399':'#f87171',fontSize:12}}>{r.growth_1yr?`${Number(r.growth_1yr).toFixed(1)}%`:'-'}</td>
              <td style={{padding:'6px 10px',color:r.growth_3yr_cagr>0?'#34d399':'#f87171',fontSize:12}}>{r.growth_3yr_cagr?`${Number(r.growth_3yr_cagr).toFixed(1)}%`:'-'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{padding:24}}>
      {breadcrumb}
      {level==='hs2' && renderHs2()}
      {level==='hs4' && renderHs4()}
      {level==='hs8' && renderHs8()}
    </div>
  );
}
