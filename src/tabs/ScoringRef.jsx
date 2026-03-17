import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { fetchApi } from '../api';

const COLORS = ['#4f8cff','#34d399','#fbbf24','#f87171','#a78bfa','#fb923c'];

function FactorCard({ factor, maxPoints, description, totalPoints }) {
  const pct = (maxPoints / totalPoints * 100).toFixed(0);
  return (
    <div style={{
      backgroundColor:'var(--bg2)',
      border:'1px solid var(--border)',
      borderRadius:'8px',
      padding:'14px',
      display:'flex',
      flexDirection:'column',
      gap:'8px'
    }}>
      <div style={{fontSize:'12px',fontWeight:600,color:'var(--tx)'}}>{factor}</div>
      <div style={{fontSize:'20px',fontWeight:700,color:'var(--blue)'}}>{maxPoints} pts</div>
      <div style={{
        height:'4px',
        backgroundColor:'var(--bg3)',
        borderRadius:'2px',
        overflow:'hidden'
      }}>
        <div style={{
          height:'100%',
          backgroundColor:COLORS[parseInt(pct)%COLORS.length],
          width:pct+'%'
        }}></div>
      </div>
      <div style={{fontSize:'9px',color:'var(--tx2)',lineHeight:1.4}}>{description}</div>
    </div>
  );
}

function VerdictRow({ verdict, tier, range, description, badgeClass }) {
  return (
    <tr>
      <td><span className={`badge ${badgeClass}`}>{verdict}</span></td>
      <td style={{fontSize:'11px',fontWeight:500}}>{tier}</td>
      <td style={{fontFamily:'monospace',fontWeight:600}}>{range}</td>
      <td style={{fontSize:'11px',color:'var(--tx2)'}}>{description}</td>
    </tr>
  );
}

function PipelineStage({ stage, items, count, total }) {
  const pct = (count / total * 100);
  return (
    <div style={{
      backgroundColor:'var(--bg2)',
      border:'1px solid var(--border)',
      borderRadius:'8px',
      padding:'12px',
      marginBottom:'10px'
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <div style={{fontSize:'12px',fontWeight:600,color:'var(--tx)'}}>{stage}</div>
        <div style={{fontSize:'11px',fontWeight:600,color:'var(--blue)'}}>{count.toLocaleString()} / {total.toLocaleString()}</div>
      </div>
      <div style={{
        height:'6px',
        backgroundColor:'var(--bg3)',
        borderRadius:'3px',
        overflow:'hidden'
      }}>
        <div style={{
          height:'100%',
          backgroundColor:'var(--green)',
          width:pct+'%',
          transition:'width 0.3s'
        }}></div>
      </div>
      <div style={{fontSize:'9px',color:'var(--tx2)',marginTop:'6px',lineHeight:1.4}}>{items}</div>
    </div>
  );
}

export default function ScoringRef() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState([]);

  useEffect(() => {
    fetchApi('scoring_config')
      .then(d => {
        setConfig(d.scoring_config || []);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load scoring configuration');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">⏳ Loading Scoring Reference...</div>;
  if (error) return <div className="alert alert-red"><div className="alert-title">Error</div><div className="alert-content">{error}</div></div>;

  const hs2Config = config.filter(c => c.phase === 'HS2');
  const hs4Config = config.filter(c => c.phase === 'HS4');
  const hs2Total = hs2Config.reduce((s, c) => s + (c.max_points || 0), 0);
  const hs4Total = hs4Config.reduce((s, c) => s + (c.max_points || 0), 0);

  const combinedChart = [
    { name: 'HS2 Total', HS2: hs2Total, HS4: 0 },
    { name: 'HS4 Total', HS2: 0, HS4: hs4Total }
  ];

  return (
    <div>
      <div style={{marginBottom:'24px'}}>
        <h2 style={{fontSize:'20px',fontWeight:700,color:'var(--tx)',marginBottom:'12px'}}>
          ⚡ Scoring Methodology: Two-Level Product Evaluation Framework
        </h2>
        <div style={{backgroundColor:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'8px',padding:'16px',color:'var(--tx2)',lineHeight:1.7,fontSize:'13px'}}>
          <p>
            This framework uses a two-phase hierarchical scoring system to identify the most promising import opportunities.
            <strong> Phase 1 (HS2)</strong> evaluates entire product chapters (97 total) across key market factors, screening for chapters with sufficient opportunity.
            <strong> Phase 2 (HS4)</strong> drills down into specific 4-digit product codes within passing chapters, applying detailed scoring criteria for granular product selection.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi hl"><div className="kpi-lbl">⚡ HS2 Max Score</div><div className="kpi-val">{hs2Total}</div></div>
        <div className="kpi hl"><div className="kpi-lbl">⚡ HS4 Max Score</div><div className="kpi-val">{hs4Total}</div></div>
        <div className="kpi gn"><div className="kpi-lbl">📊 Total Factors</div><div className="kpi-val">{config.length}</div></div>
        <div className="kpi yw"><div className="kpi-lbl">📊 HS2 Factors</div><div className="kpi-val">{hs2Config.length}</div></div>
        <div className="kpi yw"><div className="kpi-lbl">📊 HS4 Factors</div><div className="kpi-val">{hs4Config.length}</div></div>
      </div>

      <div className="card">
        <div className="card-title">📊 Phase 1: HS2 Chapter Scoring (100 points max)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'12px'}}>
          {hs2Config.map((c, idx) => (
            <FactorCard key={idx} factor={c.factor} maxPoints={c.max_points||0} description={c.description} totalPoints={hs2Total} />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">📊 Phase 2: HS4 Product Drill-Down (~120 points with bonuses)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'12px'}}>
          {hs4Config.map((c, idx) => (
            <FactorCard key={idx} factor={c.factor} maxPoints={c.max_points||0} description={c.description} totalPoints={hs4Total} />
          ))}
        </div>
      </div>

      <div className="g2">
        <div className="chart-container">
          <div className="chart-title">📊 HS2 Scoring Weights Distribution</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hs2Config.map(c => ({ name: c.factor?.substring(0,12), points: c.max_points||0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--tx2)" fontSize={9} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)',borderRadius:'4px' }} />
              <Bar dataKey="points" fill="var(--blue)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">📊 HS4 Scoring Weights Distribution</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hs4Config.map(c => ({ name: c.factor?.substring(0,12), points: c.max_points||0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--tx2)" fontSize={9} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="var(--tx2)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)',borderRadius:'4px' }} />
              <Bar dataKey="points" fill="var(--green)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">⚡ Verdict Thresholds & Actions</div>
        <table>
          <thead><tr><th>Verdict</th><th>Entry Tier</th><th>Score Range</th><th>Action & Rationale</th></tr></thead>
          <tbody>
            <VerdictRow
              verdict="PASS"
              tier="HIGH_CONFIDENCE"
              range="60+ points"
              description="Strong opportunity with favorable market dynamics and competitive landscape. Pursue actively with Volza verification, margin analysis, and direct supplier outreach."
              badgeClass="b-pass"
            />
            <VerdictRow
              verdict="MAYBE"
              tier="MODERATE"
              range="35 - 59 points"
              description="Moderate potential with some positive indicators. Evaluate further by analyzing specific HS8 products, checking regional demand variations, and comparing margin profiles."
              badgeClass="b-maybe"
            />
            <VerdictRow
              verdict="WATCH"
              tier="LOW_PRIORITY"
              range="20 - 34 points"
              description="Low priority due to mixed or marginal scoring. Monitor quarterly for market changes, emerging trends, or regulatory shifts that could improve opportunity profile."
              badgeClass="b-watch"
            />
            <VerdictRow
              verdict="DROP"
              tier="BELOW_THRESHOLD"
              range="< 20 points"
              description="Not viable at this time due to insufficient trade volume, poor margin structure, regulatory barriers, or saturated competition. Deprioritize unless major market shifts occur."
              badgeClass="b-drop"
            />
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">📊 Data Pipeline: Opportunity Funnel</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginTop:'12px'}}>
          <div>
            <div style={{fontSize:'11px',fontWeight:600,color:'var(--tx2)',textTransform:'uppercase',marginBottom:'12px',letterSpacing:'0.5px'}}>HS Code Narrowing</div>
            <PipelineStage stage="HS8 Universe" items="Complete HS8 codes in focus categories" count={9300} total={9300} />
            <PipelineStage stage="HS4 Shortlist" items="4-digit codes passing initial filters" count={1123} total={9300} />
            <PipelineStage stage="HS2 Chapters" items="2-digit chapters with viable opportunities" count={97} total={1123} />
          </div>
          <div>
            <div style={{fontSize:'11px',fontWeight:600,color:'var(--tx2)',textTransform:'uppercase',marginBottom:'12px',letterSpacing:'0.5px'}}>Product Selection</div>
            <PipelineStage stage="Shortlisted Products" items="Products scoring 20+ points (WATCH+)" count={595} total={97} />
            <PipelineStage stage="Target Opportunities" items="Products scoring 35+ points (MAYBE+)" count={187} total={595} />
            <PipelineStage stage="Hot Prospects" items="Products scoring 60+ points (PASS)" count={12} total={187} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📊 Detailed Scoring Reference</div>
        <div className="g2">
          <div>
            <div style={{fontSize:'12px',fontWeight:600,color:'var(--tx)',marginBottom:'12px',textTransform:'uppercase',letterSpacing:'0.5px'}}>HS2 Chapter Factors ({hs2Total} pts)</div>
            <table style={{fontSize:'11px'}}>
              <thead><tr><th>Factor</th><th style={{textAlign:'right'}}>Pts</th><th style={{textAlign:'right'}}>%</th></tr></thead>
              <tbody>
                {hs2Config.map((c, idx) => (
                  <tr key={idx}>
                    <td style={{fontWeight:500}}>{c.factor}</td>
                    <td style={{textAlign:'right',fontWeight:600,color:'var(--blue)'}}>{c.max_points}</td>
                    <td style={{textAlign:'right',color:'var(--tx2)'}}>{((c.max_points||0)/hs2Total*100).toFixed(0)}%</td>
                  </tr>
                ))}
                <tr style={{fontWeight:700,borderTop:'2px solid var(--border)',backgroundColor:'var(--bg3)'}}>
                  <td>TOTAL</td>
                  <td style={{textAlign:'right',color:'var(--green)'}}>{hs2Total}</td>
                  <td style={{textAlign:'right'}}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <div style={{fontSize:'12px',fontWeight:600,color:'var(--tx)',marginBottom:'12px',textTransform:'uppercase',letterSpacing:'0.5px'}}>HS4 Product Factors ({hs4Total} pts)</div>
            <table style={{fontSize:'11px'}}>
              <thead><tr><th>Factor</th><th style={{textAlign:'right'}}>Pts</th><th style={{textAlign:'right'}}>%</th></tr></thead>
              <tbody>
                {hs4Config.map((c, idx) => (
                  <tr key={idx}>
                    <td style={{fontWeight:500}}>{c.factor}</td>
                    <td style={{textAlign:'right',fontWeight:600,color:'var(--green)'}}>{c.max_points}</td>
                    <td style={{textAlign:'right',color:'var(--tx2)'}}>{((c.max_points||0)/hs4Total*100).toFixed(0)}%</td>
                  </tr>
                ))}
                <tr style={{fontWeight:700,borderTop:'2px solid var(--border)',backgroundColor:'var(--bg3)'}}>
                  <td>TOTAL</td>
                  <td style={{textAlign:'right',color:'var(--green)'}}>{hs4Total}</td>
                  <td style={{textAlign:'right'}}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
