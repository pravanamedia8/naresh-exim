import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchApi } from '../api';

const COLORS = ['#4f8cff','#34d399','#fbbf24','#f87171','#a78bfa','#fb923c'];

function ClassBadge({ c }) {
  if (!c) return <span className="badge">Unknown</span>;
  const u = c.toUpperCase();
  if (u.includes('MANUFACTURER')) return <span className="badge b-pass">{c}</span>;
  if (u.includes('TRADER')) return <span className="badge b-maybe">{c}</span>;
  return <span className="badge" style={{backgroundColor:'rgba(92,96,112,0.2)',color:'var(--tx2)'}}>{c}</span>;
}

function ConfidenceBadge({ confidence }) {
  if (confidence === 'HIGH') return <span className="badge b-pass">{confidence}</span>;
  return <span className="badge b-drop">{confidence}</span>;
}

function renderScoreBar(score) {
  const pct = Math.min((score / 100) * 100, 100);
  return (
    <div style={{display:'flex',alignItems:'center',gap:'6px',width:'100%'}}>
      <div style={{flex:1,height:'4px',backgroundColor:'var(--bg3)',borderRadius:'2px',overflow:'hidden'}}>
        <div style={{height:'100%',backgroundColor:'var(--blue)',width:pct+'%',transition:'width 0.2s'}}></div>
      </div>
      <span style={{minWidth:'30px',textAlign:'right',fontSize:'11px',fontWeight:600}}>{score.toFixed(1)}</span>
    </div>
  );
}

function renderCheckmark(value) {
  return value ? <span style={{color:'var(--green)',fontSize:'16px'}}>✓</span> : <span style={{color:'var(--tx3)'}}>-</span>;
}

export default function Importers() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importers, setImporters] = useState([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState(false);

  useEffect(() => {
    fetchApi('importers')
      .then(d => {
        setImporters((d.importers || []).sort((a,b) => (b.middleman_score||0) - (a.middleman_score||0)));
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load importers data');
      })
      .finally(() => setLoading(false));
  }, []);

  const classifications = useMemo(() => [...new Set(importers.map(i => i.classification).filter(Boolean))].sort(), [importers]);
  const cities = useMemo(() => [...new Set(importers.map(i => i.city).filter(Boolean))].sort(), [importers]);

  const filtered = useMemo(() => {
    return importers.filter(i => {
      const matchSearch = !search ||
        (i.company_name||'').toLowerCase().includes(search.toLowerCase()) ||
        (i.primary_hs4||'').includes(search) ||
        (i.city||'').toLowerCase().includes(search.toLowerCase());
      const matchClass = classFilter === 'all' || i.classification === classFilter;
      const matchCity = cityFilter === 'all' || i.city === cityFilter;
      const matchVerified = !verifiedFilter || i.volza_verified || i.zauba_verified;
      return matchSearch && matchClass && matchCity && matchVerified;
    });
  }, [importers, search, classFilter, cityFilter, verifiedFilter]);

  const stats = useMemo(() => ({
    total: importers.length,
    manufacturers: importers.filter(i => i.is_manufacturer).length,
    traders: importers.filter(i => !i.is_manufacturer && i.classification && i.classification.includes('TRADER')).length,
    avgMiddlemanScore: importers.length > 0 ? (importers.reduce((s,i) => s + (i.middleman_score||0), 0) / importers.length).toFixed(1) : 0,
    verified: importers.filter(i => i.volza_verified || i.zauba_verified).length
  }), [importers]);

  const classChart = useMemo(() => {
    const b = {};
    importers.forEach(i => { const c = i.classification||'Unknown'; b[c] = (b[c]||0)+1; });
    return Object.entries(b).map(([name,value]) => ({name,value}));
  }, [importers]);

  const topByScore = useMemo(() => {
    return [...importers].slice(0,15).map(i => ({
      name: i.company_name?.substring(0,18)+'...',
      score: i.middleman_score||0,
      classification: i.classification||'Unknown'
    }));
  }, [importers]);

  if (loading) return <div className="loading">⏳ Loading Importers...</div>;
  if (error) return <div className="alert alert-red"><div className="alert-title">Error</div><div className="alert-content">{error}</div></div>;

  return (
    <div>
      <div className="kpis">
        <div className="kpi hl"><div className="kpi-lbl">🏭 Total Importers</div><div className="kpi-val">{stats.total}</div></div>
        <div className="kpi gn"><div className="kpi-lbl">🏭 Manufacturers</div><div className="kpi-val">{stats.manufacturers}</div></div>
        <div className="kpi yw"><div className="kpi-lbl">📊 Traders</div><div className="kpi-val">{stats.traders}</div></div>
        <div className="kpi hl"><div className="kpi-lbl">⚡ Avg Middleman Score</div><div className="kpi-val">{stats.avgMiddlemanScore}</div></div>
        <div className="kpi gn"><div className="kpi-lbl">✅ Verified (Volza/Zauba)</div><div className="kpi-val">{stats.verified}</div></div>
      </div>

      <div className="g2">
        <div className="chart-container">
          <div className="chart-title">📊 Top 15 by Middleman Score</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topByScore} layout="vertical" margin={{top:5,right:20,left:120,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--tx2)" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="var(--tx2)" width={120} fontSize={9} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', borderRadius:'4px' }}
                labelStyle={{ color: 'var(--tx)' }}
                formatter={(v) => v.toFixed(1)}
              />
              <Bar dataKey="score" fill="var(--blue)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">📊 Classification Distribution</div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={classChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                label={({name,value})=>`${name} (${value})`}>
                {classChart.map((_,idx) => <Cell key={idx} fill={COLORS[idx%COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', borderRadius:'4px' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">🏭 Importers ({filtered.length} of {importers.length})</div>
        <div className="filters">
          <input type="text" className="filter-input" placeholder="Search company, HS4, city..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="filter-select" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="all">All Classifications</option>
            {classifications.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
            <option value="all">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',padding:'8px 12px',backgroundColor:'var(--bg3)',borderRadius:'4px',border:'1px solid var(--border)'}}>
            <input type="checkbox" checked={verifiedFilter} onChange={e => setVerifiedFilter(e.target.checked)} style={{cursor:'pointer'}} />
            <span style={{fontSize:'12px'}}>Verified Only</span>
          </label>
        </div>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Primary HS4</th>
              <th>Product Category</th>
              <th>Classification</th>
              <th>Confidence</th>
              <th>Middleman Score</th>
              <th>Score Reasons</th>
              <th>Shipments</th>
              <th>Market Share %</th>
              <th>City</th>
              <th>Manufacturer?</th>
              <th>Volza Verified</th>
              <th>Zauba Verified</th>
              <th>Action Required</th>
              <th>Data Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((i,idx) => (
              <tr key={idx}>
                <td style={{fontWeight:600,maxWidth:'150px'}}>{i.company_name}</td>
                <td style={{fontFamily:'monospace',fontWeight:500}}>{i.primary_hs4}</td>
                <td style={{fontSize:'11px',maxWidth:'100px'}}>{i.product_category}</td>
                <td><ClassBadge c={i.classification} /></td>
                <td><ConfidenceBadge confidence={i.confidence||'LOW'} /></td>
                <td>{renderScoreBar(i.middleman_score||0)}</td>
                <td style={{fontSize:'10px',maxWidth:'120px',color:'var(--tx2)'}}>{i.score_reasons||'-'}</td>
                <td style={{textAlign:'right',fontWeight:500}}>{(i.shipments||0).toLocaleString()}</td>
                <td style={{textAlign:'right',fontWeight:500}}>{(i.market_share_pct||0).toFixed(2)}%</td>
                <td>{i.city||'-'}</td>
                <td style={{textAlign:'center'}}>{renderCheckmark(i.is_manufacturer)}</td>
                <td style={{textAlign:'center'}}>{renderCheckmark(i.volza_verified)}</td>
                <td style={{textAlign:'center'}}>{renderCheckmark(i.zauba_verified)}</td>
                <td>{i.action_required ? <span style={{color:'var(--red)',fontWeight:600}}>⚠ {i.action_required}</span> : <span style={{color:'var(--tx3)'}}>-</span>}</td>
                <td style={{fontSize:'10px'}}>{i.data_source||'-'}</td>
              </tr>
            )) : (
              <tr><td colSpan="15" style={{textAlign:'center',color:'var(--tx2)',padding:'20px'}}>No importers match your filters</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
