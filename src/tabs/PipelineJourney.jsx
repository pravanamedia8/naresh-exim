import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../supabaseClient';

const STAGE_COLORS = ['#4f8cff','#34d399','#fbbf24','#f87171','#a78bfa','#fb923c','#22d3ee','#f472b6'];

export default function PipelineJourney() {
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState([]);
  const [decisions, setDecisions] = useState(null);
  const [insights, setInsights] = useState([]);
  const [margins, setMargins] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [stages, shortlistData, marginData] = await Promise.all([
          supabase.from('pipeline_stages').select('*').order('sort_order'),
          supabase.from('shortlist').select('*').order('drill_score', { ascending: false }),
          supabase.from('margin_analysis').select('*').order('hs4')
        ]);

        // Build funnel from pipeline stages with shortlist counts
        const stageMap = {};
        shortlistData.data?.forEach(p => {
          const stage = p.pipeline_stage || 'Unknown';
          stageMap[stage] = (stageMap[stage] || 0) + 1;
        });

        const funnel = (stages.data || []).map(s => ({
          stage: s.stage,
          name: s.name,
          description: s.description,
          count: stageMap[s.stage] || 0
        }));

        // Categorize products
        const products = shortlistData.data || [];
        const pursue = products.filter(p => p.verdict === 'PASS').slice(0, 15);
        const marginal = products.filter(p => p.verdict === 'MAYBE').slice(0, 8);
        const avoid = products.filter(p => p.verdict === 'WATCH' || p.verdict === 'DROP').slice(0, 8);

        setFunnel(funnel);
        setDecisions({ pursue, marginal, avoid });
        setMargins(marginData.data || []);
        setInsights([]);
      } catch (err) {
        console.error('Error loading pipeline data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <div className="loading">⏳ Loading Pipeline Journey...</div>;

  const pursue = decisions?.pursue || [];
  const marginal = decisions?.marginal || [];
  const avoid = decisions?.avoid || [];

  const funnelChart = funnel.map(s => ({ name: s.name, count: s.count }));

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">🚀 Sales Funnel Pipeline</div>
        <div className="funnel">
          {funnel.map((stage, idx) => (
            <div key={idx} className="funnel-stage">
              <div className={`stage-num ${stage.count > 0 ? 'stage-done' : 'stage-next'}`}>{stage.stage}</div>
              <div className="stage-info">
                <div className="stage-name">{stage.name}</div>
                <div className="stage-desc">{stage.description}</div>
              </div>
              <div className="stage-count">{stage.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-title">📊 Products per Pipeline Stage</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={funnelChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" stroke="var(--tx2)" angle={-20} textAnchor="end" height={60} />
            <YAxis stroke="var(--tx2)" />
            <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
            <Bar dataKey="count">
              {funnelChart.map((_, idx) => <Cell key={idx} fill={STAGE_COLORS[idx % STAGE_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="g3">
        <div className="alert alert-green">
          <div className="alert-title">PURSUE ({pursue.length})</div>
          <div className="alert-content">
            {pursue.slice(0, 10).map((p, idx) => {
              const m = margins.find(x => x.hs4 === p.hs4);
              return (
                <div key={idx} style={{marginBottom:4}}>
                  <strong>HS {p.hs4}</strong> — {p.commodity} — Score: {p.drill_score?.toFixed(1)}
                  {m ? ` | Margin: ${m.real_margin_pct?.toFixed(1)}%` : ''}
                </div>
              );
            })}
            {pursue.length > 10 && <div style={{opacity:0.7}}>+{pursue.length-10} more...</div>}
          </div>
        </div>

        <div className="alert alert-yellow">
          <div className="alert-title">MARGINAL ({marginal.length})</div>
          <div className="alert-content">
            {marginal.slice(0, 8).map((p, idx) => (
              <div key={idx} style={{marginBottom:4}}>
                <strong>HS {p.hs4}</strong> — {p.commodity} — Score: {p.drill_score?.toFixed(1)}
              </div>
            ))}
            {marginal.length > 8 && <div style={{opacity:0.7}}>+{marginal.length-8} more...</div>}
          </div>
        </div>

        <div className="alert alert-red">
          <div className="alert-title">AVOID ({avoid.length})</div>
          <div className="alert-content">
            {avoid.slice(0, 8).map((p, idx) => (
              <div key={idx} style={{marginBottom:4}}>
                <strong>HS {p.hs4}</strong> — {p.commodity} — Score: {p.drill_score?.toFixed(1)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {margins.length > 0 && (
        <div className="card">
          <div className="card-title">💰 Margin Analysis Summary</div>
          <table>
            <thead><tr><th>HS4</th><th>Key Products</th><th>China Source $</th><th>Landed INR</th><th>Sell INR</th><th>Margin %</th><th>Strategy</th></tr></thead>
            <tbody>
              {margins.map((m, idx) => (
                <tr key={idx}>
                  <td>{m.hs4}</td>
                  <td>{m.key_products}</td>
                  <td>${m.china_source_usd?.toFixed(2)}</td>
                  <td>{m.landed_cost_inr?.toFixed(0)}</td>
                  <td>{m.local_sell_price_inr?.toFixed(0)}</td>
                  <td><span style={{color: m.real_margin_pct >= 0 ? '#34d399' : '#f87171', fontWeight:700}}>{m.real_margin_pct?.toFixed(1)}%</span></td>
                  <td style={{fontSize:11, maxWidth:300}}>{m.strategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {insights.length > 0 && (
        <div className="card">
          <div className="card-title">🎯 Key Insights</div>
          <table>
            <thead><tr><th>Type</th><th>HS4</th><th>Title</th><th>Detail</th></tr></thead>
            <tbody>
              {insights.map((i, idx) => (
                <tr key={idx}>
                  <td><span className="badge" style={{
                    background: i.type === 'top' ? 'rgba(52,211,153,0.15)' : i.type === 'margin' ? 'rgba(79,140,255,0.15)' : 'rgba(248,113,113,0.15)',
                    color: i.type === 'top' ? '#34d399' : i.type === 'margin' ? '#4f8cff' : '#f87171'
                  }}>{i.type}</span></td>
                  <td>{i.hs4}</td>
                  <td>{i.title}</td>
                  <td>{i.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
