import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { supabase } from '../supabaseClient';

const Overview = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch counts from all tables
        const [hs8, hs4, hs2, shortlist, ps, volza_ships, volza_buyers, targets, margins, importers] = await Promise.all([
          supabase.from('hs8_raw').select('*', { count: 'exact' }).limit(1),
          supabase.from('hs4_scored').select('*', { count: 'exact' }).limit(1),
          supabase.from('hs2_scored').select('*', { count: 'exact' }).limit(1),
          supabase.from('shortlist').select('*', { count: 'exact' }).limit(1),
          supabase.from('pipeline_stages').select('*'),
          supabase.from('volza_shipments').select('*', { count: 'exact' }).limit(1),
          supabase.from('volza_buyers').select('*', { count: 'exact' }).limit(1),
          supabase.from('target_buyers').select('*', { count: 'exact' }).limit(1),
          supabase.from('margin_analysis').select('*', { count: 'exact' }).limit(1),
          supabase.from('importers_classified').select('*', { count: 'exact' }).limit(1)
        ]);

        // Calculate verdict breakdown from hs4_scored
        const hs4Data = await supabase.from('hs4_scored').select('verdict');
        const verdictBreakdown = { PASS: 0, MAYBE: 0, WATCH: 0, DROP: 0 };
        hs4Data.data?.forEach(row => {
          if (row.verdict && verdictBreakdown.hasOwnProperty(row.verdict)) {
            verdictBreakdown[row.verdict]++;
          }
        });

        // Get categories data from hs4_scored
        const allHs4 = await supabase.from('hs4_scored').select('category, verdict, drill_score');
        const categoryMap = {};
        allHs4.data?.forEach(row => {
          if (!categoryMap[row.category]) {
            categoryMap[row.category] = { category: row.category, count: 0, pass_count: 0, maybe_count: 0, watch_count: 0, drop_count: 0, avg_score: 0, total_score: 0 };
          }
          categoryMap[row.category].count++;
          categoryMap[row.category].total_score += row.drill_score || 0;
          if (row.verdict === 'PASS') categoryMap[row.category].pass_count++;
          else if (row.verdict === 'MAYBE') categoryMap[row.category].maybe_count++;
          else if (row.verdict === 'WATCH') categoryMap[row.category].watch_count++;
          else if (row.verdict === 'DROP') categoryMap[row.category].drop_count++;
        });
        Object.values(categoryMap).forEach(c => { c.avg_score = c.total_score / c.count; });

        const overview = {
          counts: {
            hs8_raw: hs8.count || 0,
            hs4_scored: hs4.count || 0,
            hs2_scored: hs2.count || 0,
            shortlist: shortlist.count || 0,
            volza_shipments: volza_ships.count || 0,
            volza_buyers: volza_buyers.count || 0,
            target_buyers: targets.count || 0,
            margin_analysis: margins.count || 0,
            importers_classified: importers.count || 0,
            verdict_breakdown: verdictBreakdown
          },
          pipeline_stages: (ps.data || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        };

        setOverviewData(overview);
        setCategoryData({ categories: Object.values(categoryMap) });
      } catch (err) {
        console.error('Error loading overview data:', err);
        setError('Data will appear here as research progresses');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="overview-container">
        <div className="loading">⏳ Loading Overview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overview-container">
        <div style={{ color: 'var(--error)', padding: '20px', textAlign: 'center' }}>{error}</div>
      </div>
    );
  }

  if (!overviewData) {
    return (
      <div className="overview-container">
        <div style={{ color: 'var(--tx2)', padding: '20px', textAlign: 'center' }}>No data available</div>
      </div>
    );
  }

  const { counts = {}, pipeline_stages = [] } = overviewData;
  const verdictData = [
    { name: 'PASS', value: counts.verdict_breakdown?.PASS || 0, color: '#34d399' },
    { name: 'MAYBE', value: counts.verdict_breakdown?.MAYBE || 0, color: '#fbbf24' },
    { name: 'WATCH', value: counts.verdict_breakdown?.WATCH || 0, color: '#a78bfa' },
    { name: 'DROP', value: counts.verdict_breakdown?.DROP || 0, color: '#f87171' }
  ];

  // Prepare top 10 categories by avg_score
  const topCategories = categoryData?.categories
    ? [...categoryData.categories]
        .sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0))
        .slice(0, 10)
        .reverse()
    : [];

  // Prepare category verdict distribution data
  const categoryVerdictData = categoryData?.categories
    ? categoryData.categories.map(cat => ({
        category: cat.category,
        PASS: cat.pass_count || 0,
        MAYBE: cat.maybe_count || 0,
        WATCH: cat.watch_count || 0,
        DROP: cat.drop_count || 0
      }))
    : [];

  return (
    <div>
      {/* TOP ROW: KPI CARDS */}
      <div className="kpis">
        <div className="kpi hl">
          <div className="kpi-lbl">📋 HS8 Raw Products</div>
          <div className="kpi-val" style={{ color: '#60a5fa' }}>{(counts.hs8_raw || 0).toLocaleString()}</div>
          <div className="kpi-sub">Total raw products</div>
        </div>
        <div className="kpi hl">
          <div className="kpi-lbl">🏷️ HS4 Scored Products</div>
          <div className="kpi-val" style={{ color: '#60a5fa' }}>{(counts.hs4_scored || 0).toLocaleString()}</div>
          <div className="kpi-sub">Scored in system</div>
        </div>
        <div className="kpi hl">
          <div className="kpi-lbl">📦 HS2 Chapters</div>
          <div className="kpi-val" style={{ color: '#60a5fa' }}>{(counts.hs2_scored || 0).toLocaleString()}</div>
          <div className="kpi-sub">Product categories</div>
        </div>
        <div className="kpi gn">
          <div className="kpi-lbl">⭐ Shortlisted</div>
          <div className="kpi-val" style={{ color: '#34d399' }}>{(counts.shortlist || 0).toLocaleString()}</div>
          <div className="kpi-sub">Selected products</div>
        </div>
        <div className="kpi gn">
          <div className="kpi-lbl">✅ PASS / High Confidence</div>
          <div className="kpi-val" style={{ color: '#34d399' }}>{(counts.verdict_breakdown?.PASS || 0).toLocaleString()}</div>
          <div className="kpi-sub">High confidence</div>
        </div>
        <div className="kpi yw">
          <div className="kpi-lbl">⚠️ MAYBE / Moderate</div>
          <div className="kpi-val" style={{ color: '#fbbf24' }}>{(counts.verdict_breakdown?.MAYBE || 0).toLocaleString()}</div>
          <div className="kpi-sub">Needs review</div>
        </div>
        <div className="kpi pp">
          <div className="kpi-lbl">👀 WATCH / Low Priority</div>
          <div className="kpi-val" style={{ color: '#a78bfa' }}>{(counts.verdict_breakdown?.WATCH || 0).toLocaleString()}</div>
          <div className="kpi-sub">Monitor status</div>
        </div>
        <div className="kpi rd">
          <div className="kpi-lbl">❌ DROP / Below Threshold</div>
          <div className="kpi-val" style={{ color: '#f87171' }}>{(counts.verdict_breakdown?.DROP || 0).toLocaleString()}</div>
          <div className="kpi-sub">Below threshold</div>
        </div>
      </div>

      {/* SECOND ROW: VERDICT PIE + PIPELINE STAGES */}
      <div className="g2">
        <div className="card">
          <h3 className="card-title">🎯 Verdict Distribution</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={verdictData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {verdictData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">🚀 Pipeline Stages</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '340px', overflowY: 'auto' }}>
            {pipeline_stages.length > 0 ? (
              pipeline_stages.map((stage, idx) => (
                <div key={idx} style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg2)',
                  borderRadius: '6px',
                  borderLeft: '3px solid #4f8cff'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--tx1)', marginBottom: '4px' }}>
                    {stage.name || `Stage ${idx + 1}`}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--tx2)', marginBottom: '6px' }}>
                    {stage.description || ''}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#4f8cff' }}>
                    {(stage.count || 0).toLocaleString()} products
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--tx2)', padding: '20px', textAlign: 'center' }}>No pipeline stages available</div>
            )}
          </div>
        </div>
      </div>

      {/* THIRD ROW: CATEGORY PERFORMANCE + DATA COVERAGE */}
      <div className="g2">
        <div className="card">
          <h3 className="card-title">📊 Category Performance (Top 10)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={topCategories}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--tx2)" />
                <YAxis dataKey="category" type="category" width={140} stroke="var(--tx2)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} formatter={(value) => value.toFixed(2)} />
                <Bar dataKey="avg_score" fill="#4f8cff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">📡 Data Coverage Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--tx2)', fontWeight: 500 }}>🚢 Volza Shipments</span>
              <span style={{ color: 'var(--tx1)', fontWeight: 600 }}>{(counts.volza_shipments || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--tx2)', fontWeight: 500 }}>🎯 Volza Buyers</span>
              <span style={{ color: 'var(--tx1)', fontWeight: 600 }}>{(counts.volza_buyers || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--tx2)', fontWeight: 500 }}>🏆 Target Buyers</span>
              <span style={{ color: 'var(--tx1)', fontWeight: 600 }}>{(counts.target_buyers || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--tx2)', fontWeight: 500 }}>💰 Margin Analysis</span>
              <span style={{ color: 'var(--tx1)', fontWeight: 600 }}>{(counts.margin_analysis || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ color: 'var(--tx2)', fontWeight: 500 }}>🏭 Importers Classified</span>
              <span style={{ color: 'var(--tx1)', fontWeight: 600 }}>{(counts.importers_classified || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: CATEGORY VERDICT DISTRIBUTION */}
      <div className="card">
        <h3 className="card-title">📈 Category Verdict Distribution</h3>
        <div className="chart-container" style={{ minHeight: '400px' }}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={categoryVerdictData}
              margin={{ top: 20, right: 30, left: 100, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="category"
                angle={-45}
                textAnchor="end"
                height={100}
                stroke="var(--tx2)"
              />
              <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Legend />
              <Bar dataKey="PASS" stackId="a" fill="#34d399" />
              <Bar dataKey="MAYBE" stackId="a" fill="#fbbf24" />
              <Bar dataKey="WATCH" stackId="a" fill="#a78bfa" />
              <Bar dataKey="DROP" stackId="a" fill="#f87171" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Overview;
