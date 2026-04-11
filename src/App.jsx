import { useState } from 'react';
import Overview from './tabs/Overview';
import ProjectTracker from './tabs/ProjectTracker';
import ResearchPipeline from './tabs/ResearchPipeline';
import ScoringDashboard from './tabs/ScoringDashboard';
import MarginIntelligence from './tabs/MarginIntelligence';
import WinnersDashboard from './tabs/WinnersDashboard';
import BuyerIntelligence from './tabs/BuyerIntelligence';
import ShipmentAnalytics from './tabs/ShipmentAnalytics';
import HSExplorer from './tabs/HSExplorer';
import RegulatoryDashboard from './tabs/RegulatoryDashboard';
import SupplyChainView from './tabs/SupplyChainView';
import SellingPriceResearch from './tabs/SellingPriceResearch';
import HS8MarginDetail from './tabs/HS8MarginDetail';
import ElectronicsPriority from './tabs/ElectronicsPriority';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabGroups = [
    {
      label: 'Command Center',
      tabs: [
        { id: 'overview', label: '🎯 Overview' },
        { id: 'tracker', label: '📋 Tracker' },
      ],
    },
    {
      label: 'Research',
      tabs: [
        { id: 'pipeline', label: '🔬 Pipeline' },
        { id: 'scoring', label: '🏆 Scoring' },
      ],
    },
    {
      label: 'Margins',
      tabs: [
        { id: 'margins', label: '💰 HS8 Margins' },
        { id: 'winners', label: '🌟 Winners' },
        { id: 'selling', label: '🏷️ Selling Prices' },
        { id: 'hs8detail', label: '🔬 HS8 Deep Dive' },
        { id: 'elecpriority', label: '⚡ Electronics Top 30' },
      ],
    },
    {
      label: 'Market Intel',
      tabs: [
        { id: 'buyers', label: '🎯 Buyers' },
        { id: 'shipments', label: '🚢 Shipments' },
      ],
    },
    {
      label: 'Hierarchy',
      tabs: [
        { id: 'hierarchy', label: '📊 HS Explorer' },
      ],
    },
    {
      label: 'Deep Dive',
      tabs: [
        { id: 'regulatory', label: '📋 Regulatory' },
        { id: 'supply', label: '🏭 Supply Chain' },
      ],
    },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <Overview />;
      case 'tracker': return <ProjectTracker />;
      case 'pipeline': return <ResearchPipeline />;
      case 'scoring': return <ScoringDashboard />;
      case 'margins': return <MarginIntelligence />;
      case 'winners': return <WinnersDashboard />;
      case 'selling': return <SellingPriceResearch />;
      case 'hs8detail': return <HS8MarginDetail />;
      case 'elecpriority': return <ElectronicsPriority />;
      case 'buyers': return <BuyerIntelligence />;
      case 'shipments': return <ShipmentAnalytics />;
      case 'hierarchy': return <HSExplorer />;
      case 'regulatory': return <RegulatoryDashboard />;
      case 'supply': return <SupplyChainView />;
      default: return <Overview />;
    }
  };

  return (
    <div className="app">
      <header className="hdr">
        <div>
          <div className="hdr-title">KALASH EXIM Command Center</div>
          <div className="hdr-subtitle">Real-time Supabase Analytics | Electronics + Chemicals Research</div>
        </div>
        <div className="hdr-right">
          <div className="hdr-subtitle">{new Date().toLocaleDateString()}</div>
          <div className="db-indicator">LIVE</div>
        </div>
      </header>
      <nav className="tabs">
        {tabGroups.map((group, gi) => (
          <div key={group.label} className="tab-group">
            {group.tabs.map((tab, ti) => (
              <div key={tab.id}>
                <button className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
                {ti < group.tabs.length - 1 && <div className="tab-separator" />}
              </div>
            ))}
            {gi < tabGroups.length - 1 && <div className="group-separator" />}
          </div>
        ))}
      </nav>
      <div className="tab-content">{renderTab()}</div>
      <footer className="footer">KALASH EXIM Command Center &copy; 2026 | React + Supabase + Recharts</footer>
    </div>
  );
}
