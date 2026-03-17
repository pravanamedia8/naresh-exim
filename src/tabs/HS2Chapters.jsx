import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend
} from 'recharts';
import { fetchApi } from '../api';

const HS2Chapters = () => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('All');
  const [goodsTypeFilter, setGoodsTypeFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'chapter_score', direction: 'desc' });

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchApi('hs2_analysis');
        setChapters(data.chapters || []);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load HS2 chapters');
        console.error('Error loading HS2 chapters:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter chapters
  const filteredChapters = chapters.filter((ch) => {
    const matchesSearch =
      ch.hs2.toString().includes(searchTerm) ||
      ch.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVerdict = verdictFilter === 'All' || ch.verdict === verdictFilter;
    const matchesGoodsType = goodsTypeFilter === 'All' || ch.goods_type === goodsTypeFilter;
    return matchesSearch && matchesVerdict && matchesGoodsType;
  });

  // Sort chapters
  const sortedChapters = [...filteredChapters].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortConfig.direction === 'desc' ? -comparison : comparison;
  });

  // Get unique goods types
  const goodsTypes = ['All', ...new Set(chapters.map((ch) => ch.goods_type).filter(Boolean))];

  // Get unique verdicts for dropdown
  const verdicts = ['All', 'PASS', 'MAYBE', 'WATCH', 'DROP'];

  // Handle column sort
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Calculate KPIs
  const totalChapters = chapters.length;
  const passCount = chapters.filter((ch) => ch.verdict === 'PASS').length;
  const avgScore = chapters.length > 0
    ? (chapters.reduce((sum, ch) => sum + (ch.chapter_score || 0), 0) / chapters.length).toFixed(2)
    : 0;
  const totalValue = chapters.reduce((sum, ch) => sum + (ch.total_val || 0), 0);

  // Chart data - Top 20 by score
  const top20Chapters = [...chapters]
    .sort((a, b) => (b.chapter_score || 0) - (a.chapter_score || 0))
    .slice(0, 20)
    .map((ch) => ({
      name: `${ch.hs2} - ${ch.description.substring(0, 20)}...`,
      score: ch.chapter_score || 0,
      verdict: ch.verdict,
    }));

  // Scoring breakdown chart - Top 15
  const top15Chapters = [...chapters]
    .sort((a, b) => (b.chapter_score || 0) - (a.chapter_score || 0))
    .slice(0, 15)
    .map((ch) => ({
      name: `${ch.hs2}`,
      pts_value: ch.pts_value || 0,
      pts_combined: ch.pts_combined || 0,
      pts_middleman: ch.pts_middleman || 0,
      pts_pipeline: ch.pts_pipeline || 0,
      pts_dominance: ch.pts_dominance || 0,
      pts_depth: ch.pts_depth || 0,
    }));

  // Get verdict color
  const getVerdictColor = (verdict) => {
    const colors = {
      PASS: '#34d399',
      MAYBE: '#fbbf24',
      WATCH: '#a78bfa',
      DROP: '#f87171',
    };
    return colors[verdict] || '#9ca3af';
  };

  // Get verdict badge class
  const getVerdictBadgeClass = (verdict) => {
    return `badge b-${verdict.toLowerCase()}`;
  };

  // Format currency
  const formatCurrency = (value) => {
    return `$${(value / 1000000).toFixed(2)}M`;
  };

  if (loading) {
    return <div className="loading">⏳ Loading HS2 Chapters...</div>;
  }

  if (error) {
    return <div className="loading" style={{ color: '#f87171' }}>❌ Error: {error}</div>;
  }

  return (
    <div className="hs2-chapters">
      {/* KPI Cards */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-lbl">📦 Total Chapters</div>
          <div className="kpi-val">{totalChapters}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">✅ PASS Chapters</div>
          <div className="kpi-val" style={{ color: '#34d399' }}>{passCount}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">📊 Average Chapter Score</div>
          <div className="kpi-val">{avgScore}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">💵 Total Trade Value</div>
          <div className="kpi-val">{formatCurrency(totalValue)}</div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="filters">
        <input
          type="text"
          className="filter-input"
          placeholder="Search by HS2 code or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
        >
          {verdicts.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={goodsTypeFilter}
          onChange={(e) => setGoodsTypeFilter(e.target.value)}
        >
          {goodsTypes.map((gt) => (
            <option key={gt} value={gt}>
              {gt}
            </option>
          ))}
        </select>
      </div>

      {/* Top 20 Score Chart */}
      <div className="chart-container">
        <h3 className="chart-title">📊 Top 20 Chapters by Score</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={top20Chapters} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="score" fill="#4f8cff">
              {top20Chapters.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getVerdictColor(entry.verdict)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scoring Breakdown Chart */}
      <div className="chart-container">
        <h3 className="chart-title">📈 Scoring Breakdown (Top 15 Chapters)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={top15Chapters}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="pts_value" stackId="a" fill="#4f8cff" name="Value" />
            <Bar dataKey="pts_combined" stackId="a" fill="#34d399" name="Combined" />
            <Bar dataKey="pts_middleman" stackId="a" fill="#fbbf24" name="Middleman" />
            <Bar dataKey="pts_pipeline" stackId="a" fill="#a78bfa" name="Pipeline" />
            <Bar dataKey="pts_dominance" stackId="a" fill="#f87171" name="Dominance" />
            <Bar dataKey="pts_depth" stackId="a" fill="#fb923c" name="Depth" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full Table */}
      <div className="card">
        <h3 className="card-title">All HS2 Chapters ({sortedChapters.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('hs2')} style={{ cursor: 'pointer' }}>
                  HS2 {sortConfig.key === 'hs2' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('description')} style={{ cursor: 'pointer' }}>
                  Description
                </th>
                <th onClick={() => handleSort('goods_type')} style={{ cursor: 'pointer' }}>
                  Goods Type
                </th>
                <th onClick={() => handleSort('hs4_count')} style={{ cursor: 'pointer' }}>
                  HS4 Count
                </th>
                <th onClick={() => handleSort('hs8_count')} style={{ cursor: 'pointer' }}>
                  HS8 Count
                </th>
                <th onClick={() => handleSort('total_val')} style={{ cursor: 'pointer' }}>
                  Total Value
                </th>
                <th onClick={() => handleSort('avg_growth')} style={{ cursor: 'pointer' }}>
                  Avg Growth
                </th>
                <th>China %</th>
                <th>Score Breakdown</th>
                <th onClick={() => handleSort('chapter_score')} style={{ cursor: 'pointer' }}>
                  Chapter Score {sortConfig.key === 'chapter_score' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('verdict')} style={{ cursor: 'pointer' }}>
                  Verdict
                </th>
                <th>Verdict Reason</th>
              </tr>
            </thead>
            <tbody>
              {sortedChapters.map((ch, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 'bold' }}>{ch.hs2}</td>
                  <td>{ch.description.substring(0, 40)}</td>
                  <td>
                    <span className="badge">{ch.goods_type || 'N/A'}</span>
                  </td>
                  <td>{ch.hs4_count || 0}</td>
                  <td>{ch.hs8_count || 0}</td>
                  <td>{formatCurrency(ch.total_val || 0)}</td>
                  <td
                    style={{
                      color: (ch.avg_growth || 0) > 0 ? '#34d399' : '#f87171',
                      fontWeight: 'bold',
                    }}
                  >
                    {((ch.avg_growth || 0) * 100).toFixed(1)}%
                  </td>
                  <td>
                    <div
                      style={{
                        background: 'rgba(55,65,81,0.5)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          background: '#4f8cff',
                          width: `${(ch.avg_china_pct || 0) * 100}%`,
                          padding: '2px 4px',
                          color: 'white',
                          fontSize: '11px',
                        }}
                      >
                        {((ch.avg_china_pct || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--tx2)' }}>
                    <span style={{ color: '#4f8cff', marginRight: '4px' }}>
                      V:{(ch.pts_value || 0).toFixed(1)}
                    </span>
                    <span style={{ color: '#34d399', marginRight: '4px' }}>
                      C:{(ch.pts_combined || 0).toFixed(1)}
                    </span>
                    <span style={{ color: '#fbbf24', marginRight: '4px' }}>
                      M:{(ch.pts_middleman || 0).toFixed(1)}
                    </span>
                    <span style={{ color: '#a78bfa', marginRight: '4px' }}>
                      P:{(ch.pts_pipeline || 0).toFixed(1)}
                    </span>
                    <span style={{ color: '#f87171', marginRight: '4px' }}>
                      D:{(ch.pts_dominance || 0).toFixed(1)}
                    </span>
                    <span style={{ color: '#fb923c' }}>
                      Dp:{(ch.pts_depth || 0).toFixed(1)}
                    </span>
                  </td>
                  <td style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {(ch.chapter_score || 0).toFixed(2)}
                  </td>
                  <td>
                    <span className={getVerdictBadgeClass(ch.verdict)}>
                      {ch.verdict}
                    </span>
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--tx2)' }}>
                    {ch.verdict_reason || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .hs2-chapters {
          padding: 20px;
          color: var(--tx);
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 30px;
        }

        .kpi {
          background: var(--bg3);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .kpi-lbl {
          font-size: 12px;
          color: var(--tx2);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .kpi-val {
          font-size: 24px;
          font-weight: bold;
          color: var(--tx);
        }

        .filters {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .filter-input,
        .filter-select {
          padding: 10px 12px;
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          background: var(--bg2);
          color: var(--tx);
        }

        .filter-input {
          flex: 1;
          min-width: 250px;
        }

        .filter-input:focus,
        .filter-select:focus {
          outline: none;
          border-color: #4f8cff;
          box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
        }

        .card {
          background: var(--bg3);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .card-title {
          font-size: 16px;
          font-weight: bold;
          color: var(--tx);
          margin-bottom: 16px;
        }

        .chart-container {
          background: var(--bg3);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .chart-title {
          font-size: 16px;
          font-weight: bold;
          color: var(--tx);
          margin-bottom: 16px;
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          background: rgba(55,65,81,0.3);
          color: var(--tx2);
        }

        .b-pass {
          background: rgba(16,185,129,0.2);
          color: #34d399;
        }

        .b-maybe {
          background: rgba(245,158,11,0.2);
          color: #fbbf24;
        }

        .b-watch {
          background: rgba(139,92,246,0.2);
          color: #a78bfa;
        }

        .b-drop {
          background: rgba(239,68,68,0.2);
          color: #f87171;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .data-table thead {
          background: rgba(26,32,53,0.8);
          border-bottom: 2px solid rgba(59,130,246,0.2);
        }

        .data-table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: var(--tx);
          user-select: none;
        }

        .data-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(37,42,54,0.5);
          color: var(--tx);
        }

        .data-table tbody tr:hover {
          background: rgba(26,32,53,0.8);
        }

        .loading {
          padding: 40px;
          text-align: center;
          font-size: 16px;
          color: var(--tx2);
        }
      `}</style>
    </div>
  );
};

export default HS2Chapters;
