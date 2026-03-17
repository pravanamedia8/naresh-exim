import { useState, useMemo } from 'react';

export default function DynamicTable({
  data = [],
  title = 'Table',
  defaultSort = null,
  defaultOrder = 'asc',
  pageSize = 50,
  searchable = true,
  columnConfig = {}
}) {
  const [sortColumn, setSortColumn] = useState(defaultSort);
  const [sortOrder, setSortOrder] = useState(defaultOrder);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Extract all column names from the data
  const allColumns = useMemo(() => {
    if (data.length === 0) return [];
    const columns = Object.keys(data[0]);
    return columns.filter(col => !col.startsWith('_') && !col.startsWith('id'));
  }, [data]);

  // Detect column types from data
  const detectColumnType = (columnName) => {
    if (columnConfig[columnName]?.type) {
      return columnConfig[columnName].type;
    }

    const samples = data.filter(row => row[columnName] != null).slice(0, 5);
    if (samples.length === 0) return 'text';

    const firstValue = samples[0][columnName];
    if (typeof firstValue === 'boolean') return 'boolean';
    if (typeof firstValue === 'number') {
      if (columnName.includes('pct') || columnName.includes('percent')) return 'pct';
      if (columnName.includes('usd') || columnName.includes('price') || columnName.includes('cost') || columnName.includes('margin')) return 'usd';
      return 'number';
    }
    if (columnName.includes('date') || columnName.includes('time')) return 'date';
    return 'text';
  };

  // Get display label for column
  const getColumnLabel = (columnName) => {
    if (columnConfig[columnName]?.label) {
      return columnConfig[columnName].label;
    }
    // Convert snake_case to Title Case
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format cell value
  const formatCellValue = (value, columnName) => {
    if (value === null || value === undefined || value === '') return '-';

    const colType = detectColumnType(columnName);
    const config = columnConfig[columnName];

    // Custom format function
    if (config?.format) {
      return config.format(value);
    }

    switch (colType) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value;
      case 'pct':
        return `${typeof value === 'number' ? value.toFixed(2) : value}%`;
      case 'usd':
        if (typeof value === 'number') {
          if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
          if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
          return `$${value.toFixed(2)}`;
        }
        return value;
      case 'boolean':
        return value ? '✓' : '✗';
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'badge':
        return <span className="badge">{value}</span>;
      default:
        return String(value);
    }
  };

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;

    return data.filter(row => {
      return allColumns.some(col => {
        const value = String(row[col] || '').toLowerCase();
        return value.includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, allColumns]);

  // Sort and paginate data
  const processedData = useMemo(() => {
    let sorted = [...filteredData];

    if (sortColumn) {
      sorted.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        if (aVal === null || aVal === undefined) return sortOrder === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortOrder === 'asc' ? -1 : 1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    const startIdx = (currentPage - 1) * pageSize;
    return sorted.slice(startIdx, startIdx + pageSize);
  }, [filteredData, sortColumn, sortOrder, currentPage, pageSize]);

  // Handle column sort
  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnName);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startRecord = filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, filteredData.length);

  // Generate page numbers
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 7;
    let start = Math.max(1, currentPage - 3);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) pages.push(1);
    if (start > 2) pages.push('...');

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) pages.push('...');
    if (end < totalPages) pages.push(totalPages);

    return pages;
  }, [currentPage, totalPages]);

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="card-title">{title}</div>
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--tx2)' }}>
          No data available
        </div>
      </div>
    );
  }

  if (allColumns.length === 0) {
    return (
      <div className="card">
        <div className="card-title">{title}</div>
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--tx2)' }}>
          No columns to display
        </div>
      </div>
    );
  }

  // Visible columns (exclude hidden ones)
  const visibleColumns = allColumns.filter(col => {
    const config = columnConfig[col];
    return !config?.hidden;
  });

  return (
    <div className="card">
      <div className="card-title">{title}</div>

      {/* Search Filter */}
      {searchable && (
        <div className="filters" style={{ marginBottom: '16px', marginTop: '12px' }}>
          <input
            type="text"
            className="filter-input"
            placeholder="Search all columns..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              maxWidth: '400px'
            }}
          />
        </div>
      )}

      {/* Table Container with horizontal scroll for small screens */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '12px', minWidth: '600px' }}>
          <thead>
            <tr>
              {visibleColumns.map((colName) => (
                <th
                  key={colName}
                  style={{
                    padding: '12px',
                    textAlign: detectColumnType(colName) === 'number' || detectColumnType(colName) === 'pct' || detectColumnType(colName) === 'usd' ? 'right' : 'left',
                    fontWeight: 600,
                    color: 'var(--tx2)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                  onClick={() => handleSort(colName)}
                >
                  <span className="sort-header">
                    {getColumnLabel(colName)}
                    {sortColumn === colName && (
                      <span className="sort-icon">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map((row, idx) => (
              <tr key={idx}>
                {visibleColumns.map((colName) => (
                  <td
                    key={`${idx}-${colName}`}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--tx)',
                      textAlign: detectColumnType(colName) === 'number' || detectColumnType(colName) === 'pct' || detectColumnType(colName) === 'usd' ? 'right' : 'left'
                    }}
                  >
                    {formatCellValue(row[colName], colName)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination" style={{ marginTop: '20px' }}>
        <button
          className="page-btn"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          ← Prev
        </button>

        {pageNumbers.map((page, idx) => (
          page === '...' ? (
            <span key={idx} className="page-info">...</span>
          ) : (
            <button
              key={idx}
              className={`page-btn ${page === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          )
        ))}

        <button
          className="page-btn"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next →
        </button>

        <span className="page-info">
          Showing {startRecord}-{endRecord} of {filteredData.length}
        </span>
      </div>
    </div>
  );
}
