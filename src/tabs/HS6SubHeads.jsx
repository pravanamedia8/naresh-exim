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
} from 'recharts';
import { fetchApi } from '../api';

export default function HS6SubHeads() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedHs4, setSelectedHs4] = useState('');
  const [selectedHs2, setSelectedHs2] = useState('');
  const [minValue, setMinValue] = useState('');

  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: 'total_val', direction: 'desc' });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetchApi('hs6_data');
        setData(response.hs6_data || []);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load data');
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filter data
  const filteredData = data.filter((item) => {
    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      !searchText ||
      item.hs6.toLowerCase().includes(searchLower) ||
      item.hs4.toLowerCase().includes(searchLower) ||
      item.hs2.toLowerCase().includes(searchLower) ||
      (item.commodities && item.commodities.toLowerCase().includes(searchLower));

    const matchesHs4 = !selectedHs4 || item.hs4 === selectedHs4;
    const matchesHs2 = !selectedHs2 || item.hs2 === selectedHs2;
    const matchesMinValue = !minValue || (item.total_val || 0) >= parseFloat(minValue);

    return matchesSearch && matchesHs4 && matchesHs2 && matchesMinValue;
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === 'number') {
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    return sortConfig.direction === 'asc'
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIdx, startIdx + itemsPerPage);

  // Get unique HS4 and HS2 values for dropdowns
  const uniqueHs4 = [...new Set(data.map((item) => item.hs4))].sort();
  const uniqueHs2 = [...new Set(data.map((item) => item.hs2))].sort();

  // Calculate KPIs
  const totalHs6 = data.length;
  const withMultipleHs8 = data.filter((item) => item.hs8_count > 1).length;
  const avgValue = data.length > 0 ? data.reduce((sum, item) => sum + (item.total_val || 0), 0) / data.length : 0;
  const highGrowth = data.filter((item) => (item.avg_growth || 0) > 20).length;

  // Top 20 data for chart
  const top20 = [...data]
    .sort((a, b) => (b.total_val || 0) - (a.total_val || 0))
    .slice(0, 20);

  // Handle sort
  const handleSort = (key) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Format currency
  const formatCurrency = (val) => {
    if (val == null) return '$0.0M';
    return `$${(val / 1_000_000).toFixed(1)}M`;
  };

  // Get trend indicator
  const getTrendIndicator = (val2024, val2023) => {
    if (!val2024 || !val2023) return '–';
    return val2024 > val2023 ? '↑' : val2024 < val2023 ? '↓' : '→';
  };

  // Get growth color
  const getGrowthColor = (growth) => {
    if (growth == null) return '#666';
    return growth > 0 ? '#4caf50' : '#f44336';
  };

  if (loading) {
    return <div className="loading">⏳ Loading HS6 Sub-Headings...</div>;
  }

  if (error) {
    return <div className="error">❌ Error: {error}</div>;
  }

  return (
    <div className="hs6-subheads-container">
      {/* KPI Cards */}
      <div className="kpis">
        <div className="kpi card">
          <div className="kpi-lbl">🔍 Total HS6 Sub-Headings</div>
          <div className="kpi-val">{totalHs6.toLocaleString()}</div>
        </div>
        <div className="kpi card">
          <div className="kpi-lbl">📦 With Multiple HS8</div>
          <div className="kpi-val">{withMultipleHs8.toLocaleString()}</div>
        </div>
        <div className="kpi card">
          <div className="kpi-lbl">💲 Avg Value per HS6</div>
          <div className="kpi-val">{formatCurrency(avgValue)}</div>
        </div>
        <div className="kpi card">
          <div className="kpi-lbl">📈 High Growth (&gt;20%)</div>
          <div className="kpi-val">{highGrowth.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters card">
        <input
          type="text"
          className="filter-input"
          placeholder="Search HS6/HS4/HS2/Commodity..."
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setCurrentPage(1);
          }}
        />
        <select
          className="filter-select"
          value={selectedHs4}
          onChange={(e) => {
            setSelectedHs4(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All HS4</option>
          {uniqueHs4.map((hs4) => (
            <option key={hs4} value={hs4}>
              {hs4}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedHs2}
          onChange={(e) => {
            setSelectedHs2(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All HS2</option>
          {uniqueHs2.map((hs2) => (
            <option key={hs2} value={hs2}>
              {hs2}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="filter-input"
          placeholder="Min Value ($M)..."
          value={minValue}
          onChange={(e) => {
            setMinValue(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Top 20 Chart */}
      <div className="chart-container card">
        <h3 className="chart-title">📊 Top 20 HS6 by Value (2024-25)</h3>
        {top20.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top20} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="hs6" type="category" width={75} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => `HS6: ${label}`}
              />
              <Bar dataKey="total_val" fill="#4f8cff" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>No data to display</p>
        )}
      </div>

      {/* Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th
                className="sortable"
                onClick={() => handleSort('hs6')}
                title="Click to sort"
              >
                HS6 Code {sortConfig.key === 'hs6' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('hs4')}
                title="Click to sort"
              >
                HS4 {sortConfig.key === 'hs4' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('hs2')}
                title="Click to sort"
              >
                HS2 {sortConfig.key === 'hs2' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('hs8_count')}
                title="Click to sort"
              >
                HS8 Count {sortConfig.key === 'hs8_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Commodities</th>
              <th
                className="sortable"
                onClick={() => handleSort('total_val')}
                title="Click to sort"
              >
                Value 2024-25 {sortConfig.key === 'total_val' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('val_2023_24')}
                title="Click to sort"
              >
                Value 2023-24 {sortConfig.key === 'val_2023_24' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('avg_growth')}
                title="Click to sort"
              >
                Avg Growth % {sortConfig.key === 'avg_growth' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <code style={{ fontWeight: 'bold', fontSize: '0.95em' }}>
                      {item.hs6}
                    </code>
                  </td>
                  <td>{item.hs4}</td>
                  <td>{item.hs2}</td>
                  <td style={{ textAlign: 'center' }}>{item.hs8_count}</td>
                  <td
                    title={item.commodities || 'N/A'}
                    style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {item.commodities ? item.commodities.substring(0, 80) : 'N/A'}
                    {item.commodities && item.commodities.length > 80 ? '...' : ''}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '500' }}>
                    {formatCurrency(item.total_val)}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.val_2023_24)}</td>
                  <td
                    style={{
                      textAlign: 'right',
                      color: getGrowthColor(item.avg_growth),
                      fontWeight: '500',
                    }}
                  >
                    {item.avg_growth != null ? `${item.avg_growth.toFixed(2)}%` : 'N/A'}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '1.2em' }}>
                    {getTrendIndicator(item.total_val, item.val_2023_24)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                  No data matches your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination">
          <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
            First
          </button>
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
            Prev
          </button>

          <div className="page-numbers">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={currentPage === pageNum ? 'active' : ''}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
            Next
          </button>
          <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>
            Last
          </button>

          <span className="page-info">
            Showing {sortedData.length > 0 ? startIdx + 1 : 0}-{Math.min(startIdx + itemsPerPage, sortedData.length)} of{' '}
            {sortedData.length}
          </span>
        </div>
      </div>
    </div>
  );
}
