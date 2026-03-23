import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { supabase } from '../supabaseClient';

const COLORS = ['#4f8cff', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#22d3ee', '#f472b6', '#84cc16', '#e879f9'];

export default function Shipments() {
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  // Server-side paginated data
  const [shipments, setShipments] = useState([]);
  const [total, setTotal] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Stats & filter options
  const [stats, setStats] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [hs4Filter, setHs4Filter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [portFilter, setPortFilter] = useState('');
  const [shipModeFilter, setShipModeFilter] = useState('');
  const [consigneeFilter, setConsigneeFilter] = useState('');
  const [shipperFilter, setShipperFilter] = useState('');
  const [minCif, setMinCif] = useState('');
  const [maxCif, setMaxCif] = useState('');

  // Pagination & sorting
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortCol, setSortCol] = useState('id');
  const [sortDir, setSortDir] = useState('desc');

  // Active view: 'charts' or 'table'
  const [activeView, setActiveView] = useState('charts');

  // Debounce timer for search
  const [searchTimer, setSearchTimer] = useState(null);

  // Build query string from current state
  const buildQuery = useCallback((pageOverride) => {
    const p = pageOverride !== undefined ? pageOverride : page;
    const params = new URLSearchParams();
    params.set('page', p);
    params.set('page_size', pageSize);
    params.set('sort', sortCol);
    params.set('dir', sortDir);
    if (search) params.set('search', search);
    if (hs4Filter) params.set('hs4', hs4Filter);
    if (countryFilter) params.set('country', countryFilter);
    if (portFilter) params.set('port', portFilter);
    if (shipModeFilter) params.set('ship_mode', shipModeFilter);
    if (consigneeFilter) params.set('consignee', consigneeFilter);
    if (shipperFilter) params.set('shipper', shipperFilter);
    if (minCif) params.set('min_cif', minCif);
    if (maxCif) params.set('max_cif', maxCif);
    return params.toString();
  }, [page, pageSize, sortCol, sortDir, search, hs4Filter, countryFilter, portFilter, shipModeFilter, consigneeFilter, shipperFilter, minCif, maxCif]);

  // Fetch shipments from Supabase
  const fetchShipments = useCallback(async (queryOverride) => {
    setTableLoading(true);
    try {
      const p = page;
      const from = p * pageSize;
      const to = from + pageSize - 1;

      let query = supabase.from('volza_shipments').select('*', { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`product_desc.ilike.%${search}%,consignee_name.ilike.%${search}%,shipper_name.ilike.%${search}%`);
      }
      if (hs4Filter) query = query.eq('hs4', hs4Filter);
      if (countryFilter) query = query.eq('country_origin', countryFilter);
      if (portFilter) query = query.eq('port_dest', portFilter);
      if (shipModeFilter) query = query.eq('ship_mode', shipModeFilter);
      if (consigneeFilter) query = query.ilike('consignee_name', `%${consigneeFilter}%`);
      if (shipperFilter) query = query.ilike('shipper_name', `%${shipperFilter}%`);
      if (minCif) query = query.gte('cif_value_usd', parseFloat(minCif));
      if (maxCif) query = query.lte('cif_value_usd', parseFloat(maxCif));

      // Apply sorting and pagination
      query = query.order(sortCol, { ascending: sortDir === 'asc' }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setShipments(data || []);
      setTotal(count || 0);
      setFilteredTotal(data?.length || 0);
      setTotalPages(Math.ceil((count || 0) / pageSize));
    } catch (err) {
      console.error('Failed to fetch shipments:', err);
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSize, sortCol, sortDir, search, hs4Filter, countryFilter, portFilter, shipModeFilter, consigneeFilter, shipperFilter, minCif, maxCif]);

  // Initial load: stats + filters + first page of data
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const { data, error, count } = await supabase.from('volza_shipments').select('*', { count: 'exact' }).limit(1);
        if (error) throw error;

        // Build stats from all shipments
        const allShips = await supabase.from('volza_shipments').select('hs4, country_origin, port_dest, port_origin, date, consignee_name, shipper_name, cif_value_usd');
        const shipData = allShips.data || [];

        // Calculate by_hs4
        const hs4Map = {};
        shipData.forEach(s => {
          const hs4 = s.hs4 || 'Unknown';
          if (!hs4Map[hs4]) hs4Map[hs4] = { hs4, shipments: 0, total_cif: 0, avg_rate: 0 };
          hs4Map[hs4].shipments++;
          hs4Map[hs4].total_cif += s.cif_value_usd || 0;
        });

        // Calculate by country, port, month, top consignees, top shippers similarly
        const countryMap = {}, portMap = {}, monthMap = {}, consigneeMap = {}, shipperMap = {};

        shipData.forEach(s => {
          const country = s.country_origin || 'Unknown';
          if (!countryMap[country]) countryMap[country] = { country_origin: country, shipments: 0, total_cif: 0 };
          countryMap[country].shipments++;
          countryMap[country].total_cif += s.cif_value_usd || 0;

          const port = s.port_dest || 'Unknown';
          if (!portMap[port]) portMap[port] = { port_dest: port, shipments: 0, total_cif: 0 };
          portMap[port].shipments++;
          portMap[port].total_cif += s.cif_value_usd || 0;

          const month = s.date ? s.date.substring(0, 7) : 'Unknown';
          if (!monthMap[month]) monthMap[month] = { month, shipments: 0, total_cif: 0 };
          monthMap[month].shipments++;
          monthMap[month].total_cif += s.cif_value_usd || 0;

          const consignee = s.consignee_name || 'Unknown';
          if (!consigneeMap[consignee]) consigneeMap[consignee] = { consignee_name: consignee, shipments: 0, total_cif: 0 };
          consigneeMap[consignee].shipments++;
          consigneeMap[consignee].total_cif += s.cif_value_usd || 0;

          const shipper = s.shipper_name || 'Unknown';
          if (!shipperMap[shipper]) shipperMap[shipper] = { shipper_name: shipper, shipments: 0, total_cif: 0 };
          shipperMap[shipper].shipments++;
          shipperMap[shipper].total_cif += s.cif_value_usd || 0;
        });

        const statsData = {
          by_hs4: Object.values(hs4Map),
          by_country: Object.values(countryMap),
          by_port: Object.values(portMap),
          by_month: Object.values(monthMap),
          top_consignees: Object.values(consigneeMap).sort((a, b) => b.total_cif - a.total_cif).slice(0, 10),
          top_shippers: Object.values(shipperMap).sort((a, b) => b.total_cif - a.total_cif).slice(0, 10)
        };

        setStats(statsData);
        setFilterOptions({
          hs4_codes: [...new Set(shipData.map(s => s.hs4).filter(Boolean))],
          countries: [...new Set(shipData.map(s => s.country_origin).filter(Boolean))],
          ports: [...new Set(shipData.map(s => s.port_dest).filter(Boolean))]
        });

        // Load first page
        const { data: pageData, error: pageError, count: pageCount } = await supabase.from('volza_shipments').select('*', { count: 'exact' }).order('id', { ascending: false }).limit(50);
        if (pageError) throw pageError;
        setShipments(pageData || []);
        setTotal(pageCount || 0);
        setFilteredTotal(pageData?.length || 0);
        setTotalPages(Math.ceil((pageCount || 0) / 50));
      } catch (err) {
        setError(err.message || 'Data will appear here as Volza research progresses');
      } finally {
        setLoading(false);
      }
    };
    loadInitial();
  }, []);

  // Re-fetch when page/sort changes (not search — that has debounce)
  useEffect(() => {
    if (!loading) {
      fetchShipments();
    }
  }, [page, sortCol, sortDir, pageSize]);

  // Debounced search & filter changes → reset page and fetch
  useEffect(() => {
    if (loading) return;
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setPage(0);
      const qs = buildQuery(0);
      fetchShipments(qs);
    }, 400);
    setSearchTimer(timer);
    return () => clearTimeout(timer);
  }, [search, hs4Filter, countryFilter, portFilter, shipModeFilter, consigneeFilter, shipperFilter, minCif, maxCif]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
    setPage(0);
  };

  const resetFilters = () => {
    setSearch('');
    setHs4Filter('');
    setCountryFilter('');
    setPortFilter('');
    setShipModeFilter('');
    setConsigneeFilter('');
    setShipperFilter('');
    setMinCif('');
    setMaxCif('');
    setPage(0);
  };

  const goToPage = (p) => setPage(Math.max(0, Math.min(totalPages - 1, p)));

  if (loading) return <div className="loading">Loading Shipments...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const by_hs4 = stats?.by_hs4 || [];
  const by_country = stats?.by_country || [];
  const by_port = stats?.by_port || [];
  const by_month = stats?.by_month || [];
  const top_consignees = stats?.top_consignees || [];
  const top_shippers = stats?.top_shippers || [];

  // Calculate KPIs from stats (full dataset, not just current page)
  const totalCif = by_hs4.reduce((s, i) => s + (i.total_cif || 0), 0);
  const totalShipments = by_hs4.reduce((s, i) => s + (i.shipments || 0), 0);
  const uniqueCountries = by_country.length;
  const uniquePorts = by_port.length;
  const uniqueHs4 = by_hs4.length;
  const avgRate = by_hs4.length > 0
    ? by_hs4.reduce((s, i) => s + (i.avg_rate || 0) * (i.shipments || 0), 0) / Math.max(1, totalShipments)
    : 0;

  // Chart data
  const hs4ChartData = by_hs4.slice(0, 10).map(i => ({
    name: `HS${i.hs4}`,
    shipments: i.shipments,
    cif: (i.total_cif || 0) / 1e6
  }));

  const countryChartData = by_country.slice(0, 10).map(i => ({
    name: i.country_origin || 'Unknown',
    value: i.shipments,
    cif: (i.total_cif || 0) / 1e6
  }));

  const portChartData = by_port.slice(0, 10).map(i => ({
    name: i.port_dest || 'Unknown',
    shipments: i.shipments,
    cif: (i.total_cif || 0) / 1e6
  }));

  const monthChartData = (by_month || []).filter(i => i.month && i.month !== 'Unknown').map(i => ({
    month: i.month,
    cif: (i.total_cif || 0) / 1e6,
    shipments: i.shipments
  }));

  const consigneeChartData = top_consignees.slice(0, 10).map(i => ({
    name: (i.consignee_name || '').substring(0, 25),
    cif: (i.total_cif || 0) / 1e6,
    shipments: i.shipments
  }));

  const shipperChartData = top_shippers.slice(0, 10).map(i => ({
    name: (i.shipper_name || '').substring(0, 25),
    cif: (i.total_cif || 0) / 1e6,
    shipments: i.shipments
  }));

  // Filter options
  const hs4Codes = filterOptions?.hs4_codes || [];
  const countries = filterOptions?.countries || [];
  const ports = filterOptions?.ports || [];
  const shipModes = filterOptions?.ship_modes || [];

  // Sort indicator helper
  const sortIcon = (col) => {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  // Pagination page buttons
  const pageButtons = () => {
    const buttons = [];
    const maxButtons = 7;
    let start = Math.max(0, page - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons);
    if (end - start < maxButtons) start = Math.max(0, end - maxButtons);
    for (let i = start; i < end; i++) {
      buttons.push(i);
    }
    return buttons;
  };

  const hasActiveFilters = search || hs4Filter || countryFilter || portFilter || shipModeFilter || consigneeFilter || shipperFilter || minCif || maxCif;

  return (
    <div className="shipments-container">
      {/* KPI Section */}
      <div className="kpis">
        <div className="kpi hl">
          <div className="kpi-lbl">Total Shipments</div>
          <div className="kpi-val">{totalShipments.toLocaleString()}</div>
        </div>
        <div className="kpi gn">
          <div className="kpi-lbl">Total CIF Value</div>
          <div className="kpi-val">${(totalCif / 1e6).toFixed(1)}M</div>
        </div>
        <div className="kpi yw">
          <div className="kpi-lbl">HS4 Codes Tracked</div>
          <div className="kpi-val">{uniqueHs4}</div>
        </div>
        <div className="kpi pp">
          <div className="kpi-lbl">Origin Countries</div>
          <div className="kpi-val">{uniqueCountries}</div>
        </div>
        <div className="kpi bl" style={{ '--kpi-color': '#22d3ee' }}>
          <div className="kpi-lbl">Dest Ports</div>
          <div className="kpi-val">{uniquePorts}</div>
        </div>
        <div className="kpi pk" style={{ '--kpi-color': '#f472b6' }}>
          <div className="kpi-lbl">Avg Unit Rate</div>
          <div className="kpi-val">${avgRate.toFixed(2)}</div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="view-toggle">
        <button className={`toggle-btn ${activeView === 'charts' ? 'active' : ''}`} onClick={() => setActiveView('charts')}>
          Charts & Analytics
        </button>
        <button className={`toggle-btn ${activeView === 'table' ? 'active' : ''}`} onClick={() => setActiveView('table')}>
          Shipment Records ({total.toLocaleString()})
        </button>
      </div>

      {/* ===== CHARTS VIEW ===== */}
      {activeView === 'charts' && (
        <>
          {/* Charts Row 1: HS4 Bar & Country Pie */}
          <div className="charts-grid g2">
            <div className="chart-container">
              <div className="chart-title">Shipments & CIF by HS4 Code (Top 10)</div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={hs4ChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--tx2)" angle={-45} textAnchor="end" height={80} />
                  <YAxis yAxisId="left" stroke="var(--tx2)" />
                  <YAxis yAxisId="right" orientation="right" stroke={COLORS[1]} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--tx1)' }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="shipments" fill={COLORS[0]} name="Shipments" />
                  <Bar yAxisId="right" dataKey="cif" fill={COLORS[1]} name="CIF ($M)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <div className="chart-title">Shipments by Origin Country (Top 10)</div>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={countryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {countryChartData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--tx1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2: Port Bar & Month Trend */}
          <div className="charts-grid g2">
            <div className="chart-container">
              <div className="chart-title">Shipment Count by Dest Port (Top 10)</div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={portChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--tx2)" />
                  <YAxis dataKey="name" type="category" stroke="var(--tx2)" width={120} fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--tx1)' }} />
                  <Bar dataKey="shipments" fill={COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <div className="chart-title">CIF Value Trend by Month</div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--tx2)" />
                  <YAxis stroke="var(--tx2)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--tx1)' }} />
                  <Legend />
                  <Bar dataKey="cif" fill={COLORS[4]} name="CIF Value ($M)" />
                  <Bar dataKey="shipments" fill={COLORS[0]} name="Shipments" opacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 3: Top Consignees & Top Shippers */}
          <div className="charts-grid g2">
            <div className="chart-container">
              <div className="chart-title">Top 10 Consignees by CIF Value</div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={consigneeChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--tx2)" />
                  <YAxis dataKey="name" type="category" stroke="var(--tx2)" width={160} fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--tx1)' }}
                    formatter={(val) => [`$${val.toFixed(2)}M`, 'CIF Value']} />
                  <Bar dataKey="cif" fill={COLORS[1]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <div className="chart-title">Top 10 Shippers by CIF Value</div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={shipperChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--tx2)" />
                  <YAxis dataKey="name" type="category" stroke="var(--tx2)" width={160} fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--tx1)' }}
                    formatter={(val) => [`$${val.toFixed(2)}M`, 'CIF Value']} />
                  <Bar dataKey="cif" fill={COLORS[5]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Consignees Table */}
          {top_consignees.length > 0 && (
            <div className="card">
              <div className="card-title">Top 20 Importers by CIF Value</div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Consignee</th>
                      <th>Shipments</th>
                      <th>Total CIF</th>
                      <th>Avg Rate</th>
                      <th>HS Codes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_consignees.map((c, idx) => (
                      <tr key={idx} onClick={() => { setConsigneeFilter(c.consignee_name); setActiveView('table'); }} style={{ cursor: 'pointer' }}>
                        <td className="cell-number">{idx + 1}</td>
                        <td className="cell-name" title={c.consignee_name}>{(c.consignee_name || '').substring(0, 40)}</td>
                        <td className="cell-number">{(c.shipments || 0).toLocaleString()}</td>
                        <td className="cell-number">${((c.total_cif || 0) / 1e6).toFixed(2)}M</td>
                        <td className="cell-number">${(c.avg_rate || 0).toFixed(2)}</td>
                        <td className="cell-code">{c.hs_codes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== TABLE VIEW ===== */}
      {activeView === 'table' && (
        <>
          {/* Filters */}
          <div className="card">
            <div className="card-title">
              Filter & Search
              {hasActiveFilters && (
                <span className="filter-badge">{filteredTotal.toLocaleString()} of {total.toLocaleString()} records</span>
              )}
            </div>
            <div className="filters-grid">
              <input
                type="text"
                className="filter-input"
                placeholder="Search product, consignee, shipper, HS code, IEC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="filter-select" value={hs4Filter} onChange={(e) => setHs4Filter(e.target.value)}>
                <option value="">All HS4 Codes</option>
                {hs4Codes.map((h) => <option key={h} value={h}>HS {h}</option>)}
              </select>
              <select className="filter-select" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                <option value="">All Countries</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="filter-select" value={portFilter} onChange={(e) => setPortFilter(e.target.value)}>
                <option value="">All Ports</option>
                {ports.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {shipModes.length > 0 && (
                <select className="filter-select" value={shipModeFilter} onChange={(e) => setShipModeFilter(e.target.value)}>
                  <option value="">All Ship Modes</option>
                  {shipModes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              <input
                type="text"
                className="filter-input"
                placeholder="Filter by consignee name..."
                value={consigneeFilter}
                onChange={(e) => setConsigneeFilter(e.target.value)}
              />
              <input
                type="text"
                className="filter-input"
                placeholder="Filter by shipper name..."
                value={shipperFilter}
                onChange={(e) => setShipperFilter(e.target.value)}
              />
              <input
                type="number"
                className="filter-input"
                placeholder="Min CIF ($)"
                value={minCif}
                onChange={(e) => setMinCif(e.target.value)}
              />
              <input
                type="number"
                className="filter-input"
                placeholder="Max CIF ($)"
                value={maxCif}
                onChange={(e) => setMaxCif(e.target.value)}
              />
              <button className="filter-btn-reset" onClick={resetFilters}>Reset Filters</button>
            </div>
          </div>

          {/* Results Summary */}
          <div className="results-summary">
            <span>
              Showing {shipments.length > 0 ? (page * pageSize + 1).toLocaleString() : 0}
              {' - '}{Math.min((page + 1) * pageSize, filteredTotal).toLocaleString()}
              {' of '}{filteredTotal.toLocaleString()} records
              {hasActiveFilters && ` (filtered from ${total.toLocaleString()} total)`}
            </span>
            <div className="page-size-select">
              <span>Rows per page:</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          {/* Shipment Table */}
          <div className="card" style={{ position: 'relative' }}>
            {tableLoading && <div className="table-loading-overlay">Loading...</div>}
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {[
                      ['date', 'Date'],
                      ['hs4', 'HS4'],
                      ['hs_code', 'HS Code'],
                      ['hs_description', 'HS Description'],
                      ['product_desc', 'Product Description'],
                      ['consignee_name', 'Consignee (Importer)'],
                      ['shipper_name', 'Shipper (Exporter)'],
                      ['cif_value_usd', 'CIF Value (USD)'],
                      ['landed_value_inr', 'Landed Value (INR)'],
                      ['std_qty', 'Quantity'],
                      [null, 'Unit'],
                      ['unit_rate_usd', 'Unit Rate (USD)'],
                      ['est_unit_rate', 'Landed Rate (INR)'],
                      ['country_origin', 'Origin Country'],
                      ['shipper_country', 'Shipper Country'],
                      ['port_origin', 'Port of Origin'],
                      ['port_dest', 'Port of Dest'],
                      ['ship_mode', 'Ship Mode'],
                      ['bl_type', 'BL Type'],
                      ['tax_inr', 'Duty/Tax (INR)'],
                      ['tax_pct', 'Tax %'],
                      [null, 'City'],
                      ['consignee_state', 'State'],
                      ['iec', 'IEC Code'],
                      ['fta_agreement', 'FTA Agreement'],
                      ['fta_rate', 'FTA/Duty Rate'],
                      ['notify_party', 'Notify Party'],
                      ['gross_wt', 'Gross Wt'],
                      ['shipper_address', 'Shipper Address']
                    ].map(([col, label], idx) => (
                      <th key={idx}
                        className={col ? 'sortable' : ''}
                        onClick={col ? () => handleSort(col) : undefined}
                        title={col ? `Sort by ${label}` : ''}
                      >
                        {label}{col ? sortIcon(col) : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shipments.length > 0 ? (
                    shipments.map((s, idx) => (
                      <tr key={idx}>
                        <td className="cell-date">{s.date || '-'}</td>
                        <td className="cell-code">{s.hs4 || '-'}</td>
                        <td className="cell-code">{s.hs_code || '-'}</td>
                        <td className="cell-text" title={s.hs_description}>{(s.hs_description || '-').substring(0, 30)}</td>
                        <td className="cell-product" title={s.product_desc}>
                          {(s.product_desc || '-').substring(0, 60)}
                          {(s.product_desc || '').length > 60 ? '...' : ''}
                        </td>
                        <td className="cell-name" title={s.consignee_name}>
                          <span className="clickable-name" onClick={() => { setConsigneeFilter(s.consignee_name); setPage(0); }}>
                            {(s.consignee_name || '-').substring(0, 30)}
                          </span>
                        </td>
                        <td className="cell-name" title={s.shipper_name}>
                          <span className="clickable-name" onClick={() => { setShipperFilter(s.shipper_name); setPage(0); }}>
                            {(s.shipper_name || '-').substring(0, 30)}
                          </span>
                        </td>
                        <td className="cell-number cell-cif">${(s.cif_value_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        <td className="cell-number">{s.landed_value_inr ? `₹${Number(s.landed_value_inr).toLocaleString(undefined, {maximumFractionDigits: 0})}` : '-'}</td>
                        <td className="cell-number">{(s.std_qty || 0).toLocaleString()}</td>
                        <td className="cell-unit">{s.std_unit || '-'}</td>
                        <td className="cell-number">${(s.unit_rate_usd || 0).toFixed(2)}</td>
                        <td className="cell-number">{s.est_unit_rate ? `₹${Number(s.est_unit_rate).toLocaleString(undefined, {maximumFractionDigits: 2})}` : '-'}</td>
                        <td className="cell-text">{s.country_origin || '-'}</td>
                        <td className="cell-text">{s.shipper_country || '-'}</td>
                        <td className="cell-text">{s.port_origin || '-'}</td>
                        <td className="cell-text">{s.port_dest || '-'}</td>
                        <td className="cell-text">{s.ship_mode || '-'}</td>
                        <td className="cell-code">{s.bl_type || '-'}</td>
                        <td className="cell-number">{s.tax_inr ? `₹${Number(s.tax_inr).toLocaleString(undefined, {maximumFractionDigits: 0})}` : '-'}</td>
                        <td className="cell-number">{s.tax_pct ? `${Number(s.tax_pct).toFixed(1)}%` : '-'}</td>
                        <td className="cell-text">{s.consignee_city || '-'}</td>
                        <td className="cell-text">{s.consignee_state || '-'}</td>
                        <td className="cell-code">{s.iec || '-'}</td>
                        <td className="cell-text" title={s.fta_agreement || ''}>
                          {s.fta_agreement ? (s.fta_agreement.substring(0, 20) + (s.fta_agreement.length > 20 ? '...' : '')) : '-'}
                        </td>
                        <td className="cell-number">{s.fta_rate && s.fta_rate !== '0' ? s.fta_rate : '-'}</td>
                        <td className="cell-text" title={s.notify_party}>
                          {(s.notify_party || '-').substring(0, 25)}
                        </td>
                        <td className="cell-number">{s.gross_wt ? Number(s.gross_wt).toLocaleString() : '-'}</td>
                        <td className="cell-text" title={s.shipper_address}>
                          {(s.shipper_address || '-').substring(0, 25)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="29" className="cell-empty">
                        {tableLoading ? 'Loading records...' : 'No records found matching the filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" onClick={() => goToPage(0)} disabled={page === 0}>
                  First
                </button>
                <button className="pagination-btn" onClick={() => goToPage(page - 1)} disabled={page === 0}>
                  Prev
                </button>
                {pageButtons().map((p) => (
                  <button
                    key={p}
                    className={`pagination-btn ${p === page ? 'pagination-active' : ''}`}
                    onClick={() => goToPage(p)}
                  >
                    {p + 1}
                  </button>
                ))}
                <button className="pagination-btn" onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1}>
                  Next
                </button>
                <button className="pagination-btn" onClick={() => goToPage(totalPages - 1)} disabled={page >= totalPages - 1}>
                  Last
                </button>
                <span className="pagination-info">
                  Page {page + 1} of {totalPages.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
