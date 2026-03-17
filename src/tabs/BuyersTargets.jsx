import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchApi } from '../api';

const COLORS = ['#4f8cff','#34d399','#fbbf24','#f87171','#a78bfa','#fb923c','#22d3ee','#f472b6'];

const getPriorityColor = (priority) => {
  if (priority === 1) return '#34d399'; // green - High
  if (priority === 2) return '#fbbf24'; // yellow - Medium
  if (priority === 3) return '#f87171'; // red - Low
  return 'var(--tx2)';
};

const getPriorityLabel = (priority) => {
  if (priority === 1) return 'High';
  if (priority === 2) return 'Medium';
  if (priority === 3) return 'Low';
  return '-';
};

export default function BuyersTargets() {
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [isMiddlemanFilter, setIsMiddlemanFilter] = useState('all');
  const [isTargetFilter, setIsTargetFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  useEffect(() => {
    Promise.all([fetchApi('targets'), fetchApi('buyers')])
      .then(([t, b]) => {
        setTargets(t.targets || []);
        setBuyers(b.buyers || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const classifications = useMemo(() =>
    [...new Set(buyers.map(b => b.classification).filter(Boolean))].sort(),
    [buyers]
  );

  const states = useMemo(() =>
    [...new Set(buyers.map(b => b.state).filter(Boolean))].sort(),
    [buyers]
  );

  const filteredBuyers = useMemo(() => {
    return buyers.filter(b => {
      const matchSearch = !search ||
        (b.company_name||'').toLowerCase().includes(search.toLowerCase()) ||
        (b.iec||'').includes(search) ||
        (b.city||'').toLowerCase().includes(search.toLowerCase());
      const matchClass = classFilter === 'all' || b.classification === classFilter;
      const matchState = stateFilter === 'all' || b.state === stateFilter;
      const matchMiddleman = isMiddlemanFilter === 'all' ||
        (isMiddlemanFilter === 'yes' ? b.is_middleman : !b.is_middleman);
      const matchTarget = isTargetFilter === 'all' ||
        (isTargetFilter === 'yes' ? b.is_target : !b.is_target);

      return matchSearch && matchClass && matchState && matchMiddleman && matchTarget;
    });
  }, [buyers, search, classFilter, stateFilter, isMiddlemanFilter, isTargetFilter]);

  const sortedBuyers = useMemo(() => {
    return [...filteredBuyers].sort((a, b) => (b.total_cif_usd || 0) - (a.total_cif_usd || 0));
  }, [filteredBuyers]);

  const totalPages = Math.ceil(sortedBuyers.length / PAGE_SIZE);
  const displayBuyers = sortedBuyers.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  const classChart = useMemo(() => {
    const breakdown = {};
    buyers.forEach(b => {
      const c = b.classification||'UNKNOWN';
      breakdown[c] = (breakdown[c]||0)+1;
    });
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  }, [buyers]);

  const stateChart = useMemo(() => {
    const breakdown = {};
    buyers.forEach(b => {
      const s = b.state||'Unknown';
      breakdown[s] = (breakdown[s]||0)+1;
    });
    return Object.entries(breakdown)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,15)
      .map(([name,value])=>({name,count:value}));
  }, [buyers]);

  const verifiedCount = useMemo(() =>
    buyers.filter(b => b.verified_classification || b.volza_verified).length,
    [buyers]
  );

  const middlemanCount = useMemo(() =>
    buyers.filter(b => b.is_middleman).length,
    [buyers]
  );

  const totalCifValue = useMemo(() =>
    buyers.reduce((sum, b) => sum + (b.total_cif_usd || 0), 0),
    [buyers]
  );

  if (loading) return <div className="loading">⏳ Loading Buyers & Targets...</div>;

  return (
    <div>
      {/* KPI Section */}
      <div className="kpis">
        <div className="kpi gn">
          <div className="kpi-lbl">🎯 Target Buyers</div>
          <div className="kpi-val">{targets.length}</div>
        </div>
        <div className="kpi hl">
          <div className="kpi-lbl">👤 Total Buyers</div>
          <div className="kpi-val">{buyers.length}</div>
        </div>
        <div className="kpi yw">
          <div className="kpi-lbl">✅ Verified Count</div>
          <div className="kpi-val">{verifiedCount}</div>
        </div>
        <div className="kpi yw">
          <div className="kpi-lbl">🏢 Middleman Count</div>
          <div className="kpi-val">{middlemanCount}</div>
        </div>
        <div className="kpi hl">
          <div className="kpi-lbl">💲 Total CIF Value</div>
          <div className="kpi-val">${(totalCifValue / 1000000).toFixed(1)}M</div>
        </div>
      </div>

      {/* Target Buyers Card Section */}
      <div className="card">
        <div className="card-title">🎯 {targets.length} Target Buyers - Approach Strategy</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '16px' }}>
          {targets.map((t, idx) => (
            <div key={idx} style={{
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '16px',
              background: 'var(--bg2)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              {/* Company Header */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--tx)', marginBottom: '4px' }}>
                  {t.company_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--tx2)' }}>
                  {t.city}{t.city && t.state ? ', ' : ''}{t.state}
                </div>
              </div>

              {/* IEC and GST */}
              <div style={{ fontSize: '11px', color: 'var(--tx2)', marginBottom: '12px', lineHeight: '1.6' }}>
                <div><strong>IEC:</strong> {t.iec || '-'}</div>
                <div><strong>GST#:</strong> {t.gst_number || '-'}</div>
              </div>

              {/* Financial Info */}
              <div style={{ fontSize: '12px', color: 'var(--tx)', marginBottom: '12px', lineHeight: '1.8', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                <div><strong>Annual Turnover:</strong> {t.annual_turnover || '-'}</div>
                <div><strong>Import CIF:</strong> ${(t.import_cif_usd || 0).toLocaleString()}</div>
              </div>

              {/* Products */}
              <div style={{ fontSize: '10px', color: 'var(--tx2)', marginBottom: '12px', maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <div style={{ marginBottom: '4px', fontWeight: 600, color: 'var(--tx)' }}>Products Sold</div>
                {t.products_sold || '-'}
              </div>

              {/* Approach Strategy */}
              <div style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: '4px',
                padding: '8px',
                fontSize: '11px',
                color: '#93c5fd',
                marginBottom: '12px',
                fontWeight: 500,
                minHeight: '32px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <strong style={{ marginRight: '4px' }}>Strategy:</strong> {t.approach_strategy || '-'}
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: getPriorityColor(t.priority),
                  color: '#fff',
                  fontWeight: 500
                }}>
                  Priority: {getPriorityLabel(t.priority)}
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'var(--bg3)',
                  color: 'var(--tx)',
                  border: '1px solid var(--border)'
                }}>
                  {t.pipeline_stage || '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="g2">
        <div className="chart-container">
          <div className="chart-title">📊 Buyer Classification Breakdown</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={classChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({name,value})=>`${name}: ${value}`}>
                {classChart.map((_,idx) => <Cell key={idx} fill={COLORS[idx%COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">📊 Top 15 Buyer States by Count</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stateChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--tx2)" angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Bar dataKey="count" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters Section */}
      <div className="card">
        <div className="card-title">👤 All Buyers ({sortedBuyers.length} of {buyers.length})</div>
        <div className="filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            className="filter-input"
            placeholder="Search company, IEC, city..."
            value={search}
            onChange={e=>{setSearch(e.target.value);setPage(0);}}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg2)' }}
          />
          <select
            className="filter-select"
            value={classFilter}
            onChange={e=>{setClassFilter(e.target.value);setPage(0);}}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg2)' }}
          >
            <option value="all">All Classifications</option>
            {classifications.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="filter-select"
            value={stateFilter}
            onChange={e=>{setStateFilter(e.target.value);setPage(0);}}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg2)' }}
          >
            <option value="all">All States</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="filter-select"
            value={isMiddlemanFilter}
            onChange={e=>{setIsMiddlemanFilter(e.target.value);setPage(0);}}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg2)' }}
          >
            <option value="all">All (Middleman)</option>
            <option value="yes">Middleman Only</option>
            <option value="no">Non-Middleman Only</option>
          </select>
          <select
            className="filter-select"
            value={isTargetFilter}
            onChange={e=>{setIsTargetFilter(e.target.value);setPage(0);}}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg2)' }}
          >
            <option value="all">All (Target Status)</option>
            <option value="yes">Target Only</option>
            <option value="no">Non-Target Only</option>
          </select>
        </div>

        {/* Buyers Table */}
        <div style={{overflowX:'auto'}}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>IEC</th>
                <th>City</th>
                <th>State</th>
                <th>Shipments</th>
                <th>Total CIF $</th>
                <th>China %</th>
                <th>Middleman Score</th>
                <th>Classification</th>
                <th>Pipeline Stage</th>
                <th>Verified</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {displayBuyers.map((b,idx) => (
                <tr key={idx} style={{background:b.is_target?'rgba(52,211,153,0.05)':'transparent'}}>
                  <td style={{fontWeight:b.is_target?700:400}}>{b.company_name}</td>
                  <td style={{fontSize:10,color:'var(--tx2)'}}>{b.iec}</td>
                  <td>{b.city||'-'}</td>
                  <td>{b.state||'-'}</td>
                  <td>{b.shipment_count}</td>
                  <td style={{ fontWeight: 500 }}>${(b.total_cif_usd||0).toLocaleString()}</td>
                  <td style={{color:(b.china_pct||0)>20?'#f87171':'var(--tx)'}}>{(b.china_pct||0).toFixed(1)}%</td>
                  <td>{(b.middleman_score||0).toFixed(1)}</td>
                  <td>
                    <span style={{
                      fontSize:10,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: 'var(--bg3)',
                      color: 'var(--tx)',
                      border: '1px solid var(--border)'
                    }}>
                      {b.classification || '-'}
                    </span>
                  </td>
                  <td style={{ fontSize: '11px' }}>{b.pipeline_stage || '-'}</td>
                  <td>{(b.verified_classification || b.volza_verified) ? '✓' : '-'}</td>
                  <td>{b.is_target ? '★' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{display:'flex',gap:6,marginTop:16,alignItems:'center'}}>
            <button
              onClick={()=>setPage(Math.max(0,page-1))}
              disabled={page===0}
              style={{padding:'8px 16px',background:'var(--bg3)',color:'var(--tx)',border:'1px solid var(--border)',borderRadius:4,cursor:page===0?'not-allowed':'pointer',opacity:page===0?0.5:1}}
            >
              ← Prev
            </button>
            <span style={{padding:'5px 8px',color:'var(--tx2)',fontSize:'12px'}}>
              Page {page+1} of {totalPages}
            </span>
            <button
              onClick={()=>setPage(Math.min(totalPages-1,page+1))}
              disabled={page>=totalPages-1}
              style={{padding:'8px 16px',background:'var(--bg3)',color:'var(--tx)',border:'1px solid var(--border)',borderRadius:4,cursor:page>=totalPages-1?'not-allowed':'pointer',opacity:page>=totalPages-1?0.5:1}}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
