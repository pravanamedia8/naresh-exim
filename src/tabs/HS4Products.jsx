import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { supabase } from '../supabaseClient';

const HS4Products = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [hs2Filter, setHs2Filter] = useState('all');
  const [entryTierFilter, setEntryTierFilter] = useState('all');
  const [minScoreFilter, setMinScoreFilter] = useState(0);

  const itemsPerPage = 50;

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('hs4_scored').select('*').order('drill_score', { ascending: false });
        if (error) throw error;
        const products = data || [];
        setProducts(products);
        setError(null);
      } catch (err) {
        setError(err.message || 'Data will appear here as research progresses');
        console.error('Error loading HS4 products:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Apply filters and sort
  useEffect(() => {
    let filtered = products.filter((product) => {
      const matchesSearch =
        product.hs4?.toString().includes(searchTerm) ||
        product.commodity?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVerdict = verdictFilter === 'all' || product.verdict === verdictFilter;
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesHs2 = hs2Filter === 'all' || product.hs2 === hs2Filter;
      const matchesEntryTier = entryTierFilter === 'all' || product.entry_tier === entryTierFilter;
      const matchesScore = (product.score || 0) >= minScoreFilter;

      return (
        matchesSearch &&
        matchesVerdict &&
        matchesCategory &&
        matchesHs2 &&
        matchesEntryTier &&
        matchesScore
      );
    });

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key] || 0;
      const bVal = b[sortConfig.key] || 0;
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [
    products,
    searchTerm,
    verdictFilter,
    categoryFilter,
    hs2Filter,
    entryTierFilter,
    minScoreFilter,
    sortConfig,
  ]);

  // Calculate KPIs
  const totalCount = products.length;
  const passCount = products.filter((p) => p.verdict === 'PASS').length;
  const maybeCount = products.filter((p) => p.verdict === 'MAYBE').length;
  const watchCount = products.filter((p) => p.verdict === 'WATCH').length;
  const dropCount = products.filter((p) => p.verdict === 'DROP').length;
  const avgScore =
    totalCount > 0
      ? (products.reduce((sum, p) => sum + (p.score || 0), 0) / totalCount).toFixed(2)
      : 0;

  // Get unique values for dropdowns
  const categories = [...new Set(products.map((p) => p.category))].filter(Boolean).sort();
  const hs2Values = [...new Set(products.map((p) => p.hs2))].filter(Boolean).sort();
  const entryTiers = [...new Set(products.map((p) => p.entry_tier))].filter(Boolean).sort();
  const verdicts = ['PASS', 'MAYBE', 'WATCH', 'DROP'];

  // Get verdict color
  const getVerdictColor = (verdict) => {
    const colors = { PASS: '#10b981', MAYBE: '#f59e0b', WATCH: '#a855f7', DROP: '#ef4444' };
    return colors[verdict] || '#6b7280';
  };

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIdx, endIdx);

  // Data for charts
  const top25Data = filteredProducts.slice(0, 25).map((p) => ({
    hs4: p.hs4,
    score: p.score || 0,
    verdict: p.verdict,
  }));

  const scatterData = filteredProducts.map((p) => ({
    score: p.score || 0,
    value_m: p.value_m || 0,
    verdict: p.verdict,
    hs4: p.hs4,
  }));

  // Handle sort
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc',
    });
  };

  if (loading) {
    return (
      <div className="tab-container">
        <div className="loading-state">⏳ Loading HS4 Products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-container">
        <div className="error-state">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="tab-container">
      {/* KPI Cards */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">🏷️ Total HS4 Products</div>
          <div className="kpi-value">{totalCount.toLocaleString()}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #10b981' }}>
          <div className="kpi-label">✅ PASS</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>
            {passCount}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #f59e0b' }}>
          <div className="kpi-label">⚠️ MAYBE</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>
            {maybeCount}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #a855f7' }}>
          <div className="kpi-label">👀 WATCH</div>
          <div className="kpi-value" style={{ color: '#a855f7' }}>
            {watchCount}
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '4px solid #ef4444' }}>
          <div className="kpi-label">❌ DROP</div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>
            {dropCount}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">📊 Avg Score</div>
          <div className="kpi-value">{avgScore}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-row">
        <input
          type="text"
          placeholder="Search HS4 code or commodity..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="filter-input"
        />
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Verdicts</option>
          {verdicts.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={hs2Filter}
          onChange={(e) => setHs2Filter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All HS2 Chapters</option>
          {hs2Values.map((hs2) => (
            <option key={hs2} value={hs2}>
              {hs2}
            </option>
          ))}
        </select>
        <select
          value={entryTierFilter}
          onChange={(e) => setEntryTierFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Entry Tiers</option>
          {entryTiers.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
        <div className="filter-group">
          <label>Min Score: {minScoreFilter}</label>
          <input
            type="range"
            min="0"
            max="100"
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(Number(e.target.value))}
            className="filter-slider"
          />
        </div>
      </div>

      {/* Top 25 Chart */}
      <div className="chart-section">
        <h3>📊 Top 25 HS4 Products by Score</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={top25Data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="hs4" type="category" />
            <Tooltip />
            <Bar dataKey="score" radius={[0, 8, 8, 0]}>
              {top25Data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getVerdictColor(entry.verdict)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Score Distribution Scatter Chart */}
      <div className="chart-section">
        <h3>📊 Score vs Value Distribution</h3>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="score" name="Score" />
            <YAxis dataKey="value_m" name="Value ($M)" />
            <ZAxis range={[100]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            {verdicts.map((verdict) => (
              <Scatter
                key={verdict}
                name={verdict}
                data={scatterData.filter((d) => d.verdict === verdict)}
                fill={getVerdictColor(verdict)}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Full Table */}
      <div className="table-section">
        <h3>All HS4 Products ({filteredProducts.length})</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('hs4')} style={{ cursor: 'pointer' }}>
                  HS4 {sortConfig.key === 'hs4' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('hs2')} style={{ cursor: 'pointer' }}>
                  HS2 {sortConfig.key === 'hs2' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('commodity')} style={{ cursor: 'pointer' }}>
                  Commodity {sortConfig.key === 'commodity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>
                  Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('value_m')} style={{ cursor: 'pointer' }}>
                  Value $M {sortConfig.key === 'value_m' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('growth')} style={{ cursor: 'pointer' }}>
                  Growth % {sortConfig.key === 'growth' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('bcd')} style={{ cursor: 'pointer' }}>
                  BCD % {sortConfig.key === 'bcd' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('china_pct')} style={{ cursor: 'pointer' }}>
                  China % {sortConfig.key === 'china_pct' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('hs8_count')} style={{ cursor: 'pointer' }}>
                  HS8 Cnt {sortConfig.key === 'hs8_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>Score Breakdown</th>
                <th onClick={() => handleSort('score')} style={{ cursor: 'pointer' }}>
                  Total Score {sortConfig.key === 'score' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('verdict')} style={{ cursor: 'pointer' }}>
                  Verdict {sortConfig.key === 'verdict' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('entry_tier')} style={{ cursor: 'pointer' }}>
                  Entry Tier {sortConfig.key === 'entry_tier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('hs2_verdict')} style={{ cursor: 'pointer' }}>
                  HS2 Verdict {sortConfig.key === 'hs2_verdict' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{product.hs4}</td>
                  <td style={{ fontSize: '0.85rem' }}>{product.hs2}</td>
                  <td title={product.commodity}>{(product.commodity || '').slice(0, 50)}</td>
                  <td>
                    <span className="badge" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                      {product.category}
                    </span>
                  </td>
                  <td>{product.value_m ? `$${product.value_m.toFixed(1)}M` : '-'}</td>
                  <td
                    style={{
                      color:
                        product.growth > 0
                          ? '#10b981'
                          : product.growth < 0
                            ? '#ef4444'
                            : '#6b7280',
                    }}
                  >
                    {product.growth ? `${product.growth.toFixed(1)}%` : '-'}
                  </td>
                  <td>{product.bcd ? `${product.bcd.toFixed(1)}%` : '-'}</td>
                  <td>{product.china_pct ? `${product.china_pct.toFixed(1)}%` : '-'}</td>
                  <td>{product.hs8_count || 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '3px', fontSize: '0.75rem' }}>
                      <span
                        title={`Value: ${product.pts_value || 0}`}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'rgba(59,130,246,0.2)',
                          color: '#93c5fd',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        V{product.pts_value || 0}
                      </span>
                      <span
                        title={`Duty: ${product.pts_duty || 0}`}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'rgba(236,72,153,0.2)',
                          color: '#f9a8d4',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        D{product.pts_duty || 0}
                      </span>
                      <span
                        title={`Growth: ${product.pts_growth || 0}`}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'rgba(16,185,129,0.2)',
                          color: '#6ee7b7',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        G{product.pts_growth || 0}
                      </span>
                      <span
                        title={`Regulatory: ${product.pts_regulatory || 0}`}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'rgba(245,158,11,0.2)',
                          color: '#fcd34d',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        R{product.pts_regulatory || 0}
                      </span>
                      <span
                        title={`Depth: ${product.pts_depth || 0}`}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'rgba(139,92,246,0.2)',
                          color: '#c4b5fd',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        Dp{product.pts_depth || 0}
                      </span>
                      <span
                        title={`Strategic: ${product.pts_strategic || 0}`}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'rgba(239,68,68,0.2)',
                          color: '#fca5a5',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        S{product.pts_strategic || 0}
                      </span>
                      <span
                        title={`Submarket: ${product.pts_submarket || 0}`}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'rgba(34,211,238,0.2)',
                          color: '#67e8f9',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        Sm{product.pts_submarket || 0}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {(product.score || 0).toFixed(2)}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{ backgroundColor: getVerdictColor(product.verdict) + '20', color: getVerdictColor(product.verdict), border: '1px solid ' + getVerdictColor(product.verdict) + '40' }}
                    >
                      {product.verdict}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: 'rgba(34,211,238,0.15)', color: '#67e8f9', border: '1px solid rgba(34,211,238,0.3)' }}>
                      {product.entry_tier}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <span
                      className="badge"
                      style={{ backgroundColor: getVerdictColor(product.hs2_verdict) + '20', color: getVerdictColor(product.hs2_verdict), border: '1px solid ' + getVerdictColor(product.hs2_verdict) + '40' }}
                    >
                      {product.hs2_verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <div className="pagination-info">
            Showing {startIdx + 1}-{Math.min(endIdx, filteredProducts.length)} of{' '}
            {filteredProducts.length} products
          </div>
          <div className="pagination-controls">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p >= currentPage - 2 && p <= currentPage + 2)
              .map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`pagination-btn ${currentPage === p ? 'active' : ''}`}
                >
                  {p}
                </button>
              ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HS4Products;
