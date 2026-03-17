import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { fetchApi } from '../api';

const COLORS = ['#4f8cff', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c'];

export default function BusinessIntel() {
  const [loading, setLoading] = useState(true);
  const [margins, setMargins] = useState([]);
  const [businessIntel, setBusinessIntel] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [marginsData, intelData, shortlistData] = await Promise.all([
          fetchApi('margins').catch(() => ({ margins: [] })),
          fetchApi('business_intel').catch(() => ({ forecasts: [], summary: {} })),
          fetchApi('shortlist').catch(() => ({ products: [] }))
        ]);

        setMargins(marginsData.margins || []);
        setBusinessIntel(intelData || { forecasts: [], summary: {} });
        setShortlist(shortlistData.products || []);
      } catch (err) {
        console.error('Error loading business intel data:', err);
        setError('Error loading business intelligence data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="loading">⏳ Loading Business Intelligence...</div>;

  // Compute KPIs from margins data
  const productsWithMarginData = margins.length;
  const avgRealMarginPct = margins.length > 0
    ? (margins.reduce((sum, m) => sum + (m.real_margin_pct || 0), 0) / margins.length).toFixed(1)
    : 0;

  const bestMarginProduct = margins.length > 0
    ? margins.reduce((best, current) =>
        (current.real_margin_pct || 0) > (best.real_margin_pct || 0) ? current : best
      )
    : null;

  const totalExpectedTurnover = businessIntel?.summary?.total_expected_turnover_usd ||
    margins.reduce((sum, m) => sum + (m.expected_annual_turnover_usd || 0), 0);

  const expectedYr1Profit = businessIntel?.summary?.total_expected_profit_yr1_usd ||
    margins.reduce((sum, m) => sum + (m.expected_profit_yr1_usd || 0), 0);

  const productsInPipeline = shortlist.length;

  // Prepare margin details for visualization
  const marginChartData = margins.slice(0, 15).map(m => ({
    name: `HS${m.hs4}`,
    margin: m.real_margin_pct || 0,
    hs4: m.hs4
  }));

  const priceFlowData = margins.slice(0, 8).map(m => ({
    name: `HS${m.hs4}`,
    'China Source': m.china_source_usd || 0,
    'Landed USD': m.landed_cost_usd || 0,
    'Sell Price USD': m.sell_price_usd || 0
  }));

  // Format currency
  const formatUSD = (val) => {
    if (!val) return '$0';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  // Compute scenarios
  const bestMarginVal = bestMarginProduct?.real_margin_pct || 0;
  const bestTurnover = bestMarginProduct?.expected_annual_turnover_usd || 0;
  const conservative = {
    margin_pct: (bestMarginVal * 0.5).toFixed(1),
    turnover: formatUSD(bestTurnover * 0.3),
    profit: formatUSD((bestTurnover * 0.3) * (bestMarginVal * 0.5 / 100))
  };
  const base = {
    margin_pct: (bestMarginVal * 0.8).toFixed(1),
    turnover: formatUSD(bestTurnover * 0.6),
    profit: formatUSD((bestTurnover * 0.6) * (bestMarginVal * 0.8 / 100))
  };
  const optimistic = {
    margin_pct: bestMarginVal.toFixed(1),
    turnover: formatUSD(bestTurnover),
    profit: formatUSD(bestTurnover * (bestMarginVal / 100))
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--tx)', marginBottom: '4px' }}>
          Business Intelligence - New Company Projections
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--tx2)' }}>
          Margin analysis, market opportunity scoring, and first-year financial projections
        </p>
      </div>

      {/* KPI ROW */}
      <div className="kpis">
        <div className="kpi hl">
          <div className="kpi-lbl">🧠 Products with Margin Data</div>
          <div className="kpi-val">{productsWithMarginData}</div>
          <div className="kpi-sub">analyzed</div>
        </div>
        <div className="kpi hl">
          <div className="kpi-lbl">📊 Avg Real Margin %</div>
          <div className="kpi-val">{avgRealMarginPct}%</div>
          <div className="kpi-sub">across portfolio</div>
        </div>
        <div className={`kpi ${bestMarginProduct?.real_margin_pct >= 0 ? 'gn' : 'rd'}`}>
          <div className="kpi-lbl">💰 Best Margin Product</div>
          <div className="kpi-val">HS{bestMarginProduct?.hs4 || '-'}</div>
          <div className="kpi-sub">{bestMarginProduct?.real_margin_pct?.toFixed(1) || 0}% margin</div>
        </div>
        <div className="kpi pp">
          <div className="kpi-lbl">💰 Total Expected Turnover</div>
          <div className="kpi-val">{formatUSD(totalExpectedTurnover)}</div>
          <div className="kpi-sub">Year 1 estimate</div>
        </div>
        <div className="kpi gn">
          <div className="kpi-lbl">💰 Expected Yr1 Profit</div>
          <div className="kpi-val">{formatUSD(expectedYr1Profit)}</div>
          <div className="kpi-sub">net profit</div>
        </div>
        <div className="kpi yw">
          <div className="kpi-lbl">📊 Products in Pipeline</div>
          <div className="kpi-val">{productsInPipeline}</div>
          <div className="kpi-sub">shortlisted</div>
        </div>
      </div>

      {/* MARGIN CHARTS */}
      {marginChartData.length > 0 && (
        <div className="g2">
          <div className="chart-container">
            <div className="card-title">📊 Margin % per HS4</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={marginChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--tx2)" />
                <YAxis stroke="var(--tx2)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
                <Bar dataKey="margin" fill="#4f8cff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <div className="card-title">📊 Price Ladder: China → Landed → Sell</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priceFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--tx2)" />
                <YAxis stroke="var(--tx2)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
                <Legend />
                <Bar dataKey="China Source" fill="#f87171" />
                <Bar dataKey="Landed USD" fill="#fbbf24" />
                <Bar dataKey="Sell Price USD" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* MARGIN ANALYSIS SECTION */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title">💰 Product Margin Deep Dive</div>

        {margins.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', marginTop: '16px' }}>
            {margins.map((product, idx) => {
              const isPositive = product.real_margin_pct >= 0;
              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg3)',
                    border: `1px solid ${isPositive ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '11px'
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--tx)', fontSize: '12px' }}>HS{product.hs4}</div>
                      <div style={{ color: 'var(--tx2)', marginTop: '2px' }}>{product.key_products || 'N/A'}</div>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: isPositive ? '#34d399' : '#f87171',
                      textAlign: 'right'
                    }}>
                      {(product.real_margin_pct || 0).toFixed(1)}%
                    </div>
                  </div>

                  {/* Price Flow */}
                  <div style={{ backgroundColor: 'var(--bg2)', padding: '8px', borderRadius: '4px', marginBottom: '8px', fontSize: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--tx2)' }}>China Source:</span>
                      <span style={{ color: 'var(--tx)', fontWeight: 500 }}>${(product.china_source_usd || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--tx2)' }}>Landed (INR):</span>
                      <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{(product.landed_cost_inr || 0).toFixed(0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--tx2)' }}>Sell Price (INR):</span>
                      <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{(product.sell_price_inr || 0).toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Margin Details */}
                  <div style={{ backgroundColor: 'var(--bg2)', padding: '8px', borderRadius: '4px', marginBottom: '8px', fontSize: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--tx2)' }}>Margin USD:</span>
                      <span style={{ color: '#4f8cff', fontWeight: 500 }}>${(product.margin_usd || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--tx2)' }}>Margin INR:</span>
                      <span style={{ color: '#4f8cff', fontWeight: 500 }}>{(product.margin_inr || 0).toFixed(0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--tx2)' }}>Margin %:</span>
                      <span style={{ color: '#4f8cff', fontWeight: 500 }}>{(product.margin_pct || 0).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Strategy & Credit Terms */}
                  {(product.strategy || product.credit_terms_note) && (
                    <div style={{ fontSize: '9px', color: 'var(--tx2)', lineHeight: '1.4', marginBottom: '8px' }}>
                      {product.strategy && <div><strong>Strategy:</strong> {product.strategy}</div>}
                      {product.credit_terms_note && <div><strong>Credit:</strong> {product.credit_terms_note}</div>}
                    </div>
                  )}

                  {/* Volume & Projections */}
                  {product.expected_monthly_volume && (
                    <div style={{ backgroundColor: 'var(--bg2)', padding: '8px', borderRadius: '4px', fontSize: '10px', borderLeft: '3px solid var(--yellow)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--tx2)' }}>Monthly Volume:</span>
                        <span style={{ color: 'var(--tx)' }}>{product.expected_monthly_volume}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--tx2)' }}>Annual Turnover:</span>
                        <span style={{ color: 'var(--tx)' }}>{formatUSD(product.expected_annual_turnover_usd)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--tx2)' }}>Yr1 Profit:</span>
                        <span style={{ color: '#34d399', fontWeight: 500 }}>{formatUSD(product.expected_profit_yr1_usd)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--tx2)' }}>Break-even:</span>
                        <span style={{ color: 'var(--tx)' }}>{product.break_even_months || '-'} months</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--tx2)' }}>ROI:</span>
                        <span style={{ color: '#4f8cff', fontWeight: 500 }}>{(product.roi_pct || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                  {!product.expected_monthly_volume && (
                    <div style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', padding: '8px', borderRadius: '4px', fontSize: '10px', color: 'var(--yellow)', textAlign: 'center', borderLeft: '3px solid var(--yellow)' }}>
                      Not yet analyzed for volume projections
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: 'var(--tx2)', textAlign: 'center', padding: '32px' }}>
            No margin data available yet. Run margin analysis to populate this section.
          </div>
        )}
      </div>

      {/* OPPORTUNITY MATRIX */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title">📊 Market Opportunity Scoring</div>

        {shortlist.length > 0 && (shortlist.some(p => p.margin_pct || p.market_opportunity)) ? (
          <table style={{ width: '100%', fontSize: '11px', marginTop: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: 'var(--tx2)' }}>HS4</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: 'var(--tx2)' }}>Commodity</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: 'var(--tx2)' }}>Score</th>
                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: 'var(--tx2)' }}>Margin %</th>
                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: 'var(--tx2)' }}>Expected Turnover</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600, color: 'var(--tx2)' }}>Opportunity</th>
              </tr>
            </thead>
            <tbody>
              {shortlist.filter(p => p.margin_pct || p.market_opportunity).map((product, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px', color: 'var(--tx)' }}>{product.hs4 || '-'}</td>
                  <td style={{ padding: '10px', color: 'var(--tx)' }}>{product.commodity || '-'}</td>
                  <td style={{ padding: '10px', color: '#4f8cff', fontWeight: 500 }}>{product.score || '-'}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: product.margin_pct >= 0 ? '#34d399' : '#f87171' }}>
                    {product.margin_pct?.toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--tx)' }}>
                    {formatUSD(product.expected_turnover_usd)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span className="badge" style={{
                      backgroundColor: product.market_opportunity === 'high' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                      color: product.market_opportunity === 'high' ? '#34d399' : '#fbbf24'
                    }}>
                      {product.market_opportunity || 'pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: 'var(--tx2)', textAlign: 'center', padding: '32px' }}>
            Opportunity data will appear as products are analyzed
          </div>
        )}
      </div>

      {/* FORECASTS SECTION */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title">🧠 Business Forecasts</div>

        {businessIntel?.forecasts?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', marginTop: '12px' }}>
            {businessIntel.forecasts.slice(0, 4).map((forecast, idx) => (
              <div key={idx} style={{
                backgroundColor: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '12px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--tx)', marginBottom: '8px', fontSize: '12px' }}>
                  {forecast.scenario || `Scenario ${idx + 1}`}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--tx2)' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Margin:</strong> {(forecast.expected_margin_pct || 0).toFixed(1)}%
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Turnover:</strong> {formatUSD(forecast.expected_turnover_usd)}
                  </div>
                  <div style={{ color: '#34d399', fontWeight: 500 }}>
                    <strong>Profit:</strong> {formatUSD(forecast.expected_profit_usd)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--tx2)', textAlign: 'center', padding: '32px' }}>
            Business forecasts will appear here once products are fully analyzed. Currently tracking {productsWithMarginData} products with margin data.
          </div>
        )}
      </div>

      {/* FIRST YEAR PROJECTIONS */}
      <div className="card">
        <div className="card-title">💰 New Company First Year Projections</div>

        <div className="g3" style={{ marginTop: '16px' }}>
          {/* Conservative */}
          <div style={{
            backgroundColor: 'var(--bg3)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            borderRadius: '6px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#f87171', fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase' }}>
              Conservative
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', marginBottom: '4px' }}>
              {conservative.margin_pct}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--tx2)', marginBottom: '12px' }}>Margin</div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--tx)', marginBottom: '4px' }}>
                {conservative.turnover}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--tx2)', marginBottom: '12px' }}>Annual Turnover</div>

              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>
                {conservative.profit}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--tx2)' }}>Year 1 Profit</div>
            </div>
          </div>

          {/* Base */}
          <div style={{
            backgroundColor: 'var(--bg3)',
            border: '2px solid rgba(251, 191, 36, 0.5)',
            borderRadius: '6px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase' }}>
              Base Case
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', marginBottom: '4px' }}>
              {base.margin_pct}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--tx2)', marginBottom: '12px' }}>Margin</div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--tx)', marginBottom: '4px' }}>
                {base.turnover}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--tx2)', marginBottom: '12px' }}>Annual Turnover</div>

              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24' }}>
                {base.profit}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--tx2)' }}>Year 1 Profit</div>
            </div>
          </div>

          {/* Optimistic */}
          <div style={{
            backgroundColor: 'var(--bg3)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            borderRadius: '6px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#34d399', fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase' }}>
              Optimistic
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', marginBottom: '4px' }}>
              {optimistic.margin_pct}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--tx2)', marginBottom: '12px' }}>Margin</div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--tx)', marginBottom: '4px' }}>
                {optimistic.turnover}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--tx2)', marginBottom: '12px' }}>Annual Turnover</div>

              <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>
                {optimistic.profit}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--tx2)' }}>Year 1 Profit</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
