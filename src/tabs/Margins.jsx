import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchApi } from '../api';

const COLORS = ['#4f8cff', '#34d399', '#fbbf24', '#f87171'];

export default function Margins() {
  const [loading, setLoading] = useState(true);
  const [margins, setMargins] = useState([]);
  const [marginChartData, setMarginChartData] = useState([]);
  const [priceChartData, setPriceChartData] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchApi('margins');
        const marginsList = data.margins || [];
        setMargins(marginsList);

        const marginChart = marginsList.slice(0, 15).map((m) => ({
          name: `HS${m.hs4}`,
          margin: m.real_margin_pct || 0,
        }));
        setMarginChartData(marginChart);

        const priceChart = marginsList.slice(0, 10).map((m) => ({
          name: `HS${m.hs4}`,
          'Landed INR': m.landed_cost_inr || 0,
          'Sell INR': m.local_sell_price_inr || 0,
        }));
        setPriceChartData(priceChart);
      } catch (error) {
        console.error('Error loading margins:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="loading">⏳ Loading Margins...</div>;

  const pursue = margins.filter((m) => m.real_margin_pct > 10);
  const avoid = margins.filter((m) => m.real_margin_pct < 0);

  return (
    <div>
      <div className="kpis">
        {margins.slice(0, 8).map((m, idx) => {
          const isPositive = m.real_margin_pct >= 0;
          return (
            <div key={idx} className={`kpi ${isPositive ? 'gn' : 'rd'}`}>
              <div className="kpi-lbl">HS {m.hs4}</div>
              <div className="kpi-val">{(m.real_margin_pct || 0).toFixed(1)}%</div>
              <div className="kpi-sub">{(m.landed_cost_inr || 0).toFixed(0)} INR</div>
            </div>
          );
        })}
      </div>

      <div className="g2">
        <div className="alert alert-green">
          <div className="alert-title">PURSUE ({pursue.length})</div>
          <div className="alert-content">
            {pursue.length > 0 ? (
              pursue.slice(0, 3).map((m, idx) => (
                <div key={idx}>
                  HS {m.hs4}: +{m.real_margin_pct.toFixed(1)}% ({m.key_products})
                </div>
              ))
            ) : (
              <div>No high-margin opportunities</div>
            )}
          </div>
        </div>

        <div className="alert alert-red">
          <div className="alert-title">AVOID ({avoid.length})</div>
          <div className="alert-content">
            {avoid.length > 0 ? (
              avoid.slice(0, 3).map((m, idx) => (
                <div key={idx}>
                  HS {m.hs4}: {m.real_margin_pct.toFixed(1)}% Loss Risk
                </div>
              ))
            ) : (
              <div>No loss-making products</div>
            )}
          </div>
        </div>
      </div>

      {marginChartData.length > 0 && (
        <div className="chart-container">
          <div className="chart-title">📊 Margin % per HS4</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={marginChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--tx2)" />
              <YAxis stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Bar dataKey="margin" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {priceChartData.length > 0 && (
        <div className="chart-container">
          <div className="chart-title">📊 Price Ladder: Landed vs Sell Price</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={priceChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--tx2)" />
              <YAxis stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Legend />
              <Bar dataKey="Landed INR" fill={COLORS[1]} />
              <Bar dataKey="Sell INR" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="card-title">💰 Margin Details</div>
        <table>
          <thead>
            <tr>
              <th>HS4</th>
              <th>China Source $</th>
              <th>Landed INR</th>
              <th>Sell INR</th>
              <th>Margin %</th>
              <th>Products</th>
              <th>Credit Terms</th>
              <th>Strategy</th>
            </tr>
          </thead>
          <tbody>
            {margins.map((m, idx) => (
              <tr key={idx}>
                <td>{m.hs4}</td>
                <td>${(m.china_source_usd || 0).toFixed(2)}</td>
                <td>{(m.landed_cost_inr || 0).toFixed(0)}</td>
                <td>{(m.local_sell_price_inr || 0).toFixed(0)}</td>
                <td>
                  <span style={{ color: m.real_margin_pct >= 0 ? '#34d399' : '#f87171' }}>
                    {(m.real_margin_pct || 0).toFixed(1)}%
                  </span>
                </td>
                <td>{m.key_products || '-'}</td>
                <td>{m.credit_terms_note || '-'}</td>
                <td>{m.strategy || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
