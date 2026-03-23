import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabaseClient';

const COLORS = ['#4f8cff','#34d399','#fbbf24','#f87171','#a78bfa','#fb923c','#22d3ee','#f472b6','#818cf8','#94a3b8'];

export default function Categories() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data, error } = await supabase.from('hs4_scored').select('category, verdict, drill_score');
        if (error) throw error;

        // Group by category
        const categoryMap = {};
        (data || []).forEach(row => {
          if (!categoryMap[row.category]) {
            categoryMap[row.category] = {
              category: row.category,
              count: 0,
              pass_count: 0,
              maybe_count: 0,
              watch_count: 0,
              drop_count: 0,
              avg_score: 0,
              total_score: 0,
              total_value_m: 0
            };
          }
          categoryMap[row.category].count++;
          categoryMap[row.category].total_score += row.drill_score || 0;
          if (row.verdict === 'PASS') categoryMap[row.category].pass_count++;
          else if (row.verdict === 'MAYBE') categoryMap[row.category].maybe_count++;
          else if (row.verdict === 'WATCH') categoryMap[row.category].watch_count++;
          else if (row.verdict === 'DROP') categoryMap[row.category].drop_count++;
        });

        Object.values(categoryMap).forEach(c => {
          c.avg_score = c.count > 0 ? c.total_score / c.count : 0;
        });

        setCategories(Object.values(categoryMap));
      } catch (err) {
        console.error('Error loading categories:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="loading">⏳ Loading Categories...</div>;

  const countChart = categories.map(c => ({ name: c.category || 'Unknown', count: c.count || 0 }));
  const scoreChart = categories.map(c => ({ name: c.category || 'Unknown', score: c.avg_score || 0 }));
  const verdictChart = categories.map(c => ({
    name: c.category || 'Unknown',
    PASS: c.pass_count || 0,
    MAYBE: c.maybe_count || 0,
    DROP: c.drop_count || 0,
    WATCH: c.watch_count || 0,
  }));

  return (
    <div>
      <div className="kpis">
        <div className="kpi hl"><div className="kpi-lbl">📁 Categories</div><div className="kpi-val">{categories.length}</div></div>
        <div className="kpi gn"><div className="kpi-lbl">🏷️ Total Products</div><div className="kpi-val">{categories.reduce((s,c)=>s+c.count,0)}</div></div>
        <div className="kpi yw"><div className="kpi-lbl">💲 Total Value</div><div className="kpi-val">${categories.reduce((s,c)=>s+(c.total_value_m||0),0).toFixed(0)}M</div></div>
      </div>

      <div className="g2">
        <div className="chart-container">
          <div className="chart-title">📊 Products per Category</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={countChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--tx2)" />
              <YAxis dataKey="name" type="category" stroke="var(--tx2)" width={160} fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Bar dataKey="count" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">📊 Avg Score per Category</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--tx2)" />
              <YAxis dataKey="name" type="category" stroke="var(--tx2)" width={160} fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
              <Bar dataKey="score" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-title">📊 Verdict Distribution by Category</div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={verdictChart} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" stroke="var(--tx2)" />
            <YAxis dataKey="name" type="category" stroke="var(--tx2)" width={160} fontSize={10} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--bg3)', border: '1px solid var(--border)' }} />
            <Legend />
            <Bar dataKey="PASS" stackId="a" fill="#34d399" />
            <Bar dataKey="MAYBE" stackId="a" fill="#fbbf24" />
            <Bar dataKey="WATCH" stackId="a" fill="#a78bfa" />
            <Bar dataKey="DROP" stackId="a" fill="#f87171" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">📁 Category Analysis</div>
        <table>
          <thead>
            <tr><th>Category</th><th>Products</th><th>Avg Score</th><th>Total Value $M</th><th>PASS</th><th>MAYBE</th><th>WATCH</th><th>DROP</th></tr>
          </thead>
          <tbody>
            {categories.map((cat, idx) => (
              <tr key={idx}>
                <td style={{fontWeight:600}}>{cat.category || '-'}</td>
                <td>{cat.count || 0}</td>
                <td style={{fontWeight:700}}>{(cat.avg_score || 0).toFixed(1)}</td>
                <td>${(cat.total_value_m || 0).toFixed(1)}M</td>
                <td style={{color:'#34d399'}}>{cat.pass_count || 0}</td>
                <td style={{color:'#fbbf24'}}>{cat.maybe_count || 0}</td>
                <td style={{color:'#a78bfa'}}>{cat.watch_count || 0}</td>
                <td style={{color:'#f87171'}}>{cat.drop_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
