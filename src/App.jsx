import { useState } from 'react';
import Overview from './tabs/Overview';
import PipelineJourney from './tabs/PipelineJourney';
import HS2Chapters from './tabs/HS2Chapters';
import HS4Products from './tabs/HS4Products';
import HS6SubHeads from './tabs/HS6SubHeads';
import HS8Raw from './tabs/HS8Raw';
import Categories from './tabs/Categories';
import Margins from './tabs/Margins';
import Shipments from './tabs/Shipments';
import BuyersTargets from './tabs/BuyersTargets';
import Importers from './tabs/Importers';
import ScoringRef from './tabs/ScoringRef';
import BusinessIntel from './tabs/BusinessIntel';
import ElectronicsResearch from './tabs/ElectronicsResearch';
import ProductShortlist from './tabs/ProductShortlist';
import HS8DeepDive from './tabs/HS8DeepDive';
import DealPipeline from './tabs/DealPipeline';
import FinancialProjections from './tabs/FinancialProjections';
import ComplianceTracker from './tabs/ComplianceTracker';
import SupplierNegotiations from './tabs/SupplierNegotiations';
import SupplyChainPlan from './tabs/SupplyChainPlan';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabGroups = [
    {
      label: 'Executive',
      tabs: [
        { id: 'overview', label: '📊 Overview', subtitle: 'Executive dashboard' },
        { id: 'deals', label: '🤝 Deal Pipeline', subtitle: 'Active deals & stages' },
        { id: 'finance', label: '💹 Financials', subtitle: '3-scenario projections' },
        { id: 'compliance', label: '📋 Compliance', subtitle: 'Cert tracking' },
        { id: 'negotiations', label: '🏭 Suppliers', subtitle: 'Negotiation tracker' },
        { id: 'supplychain', label: '🔗 Supply Chain', subtitle: 'Go-to-market plan' },
      ],
    },
    {
      label: 'Operations',
      tabs: [
        { id: 'pipeline', label: '🚀 Pipeline', subtitle: 'Sales funnel journey' },
        { id: 'shipments', label: '🚢 Shipments', subtitle: '7,784 records' },
        { id: 'buyers', label: '🎯 Buyers & Targets', subtitle: '950 buyers + 12 targets' },
        { id: 'importers', label: '🏭 Importers', subtitle: '54 classified' },
      ],
    },
    {
      label: 'Research',
      tabs: [
        { id: 'electronics', label: '🔬 Electronics', subtitle: '180 codes pipeline' },
        { id: 'shortlist', label: '🏆 Shortlist', subtitle: '35 scored products' },
        { id: 'hs8deep', label: '🔎 HS8 Deep Dive', subtitle: '249 products, 3.6K buyers' },
      ],
    },
    {
      label: 'Product Hierarchy',
      tabs: [
        { id: 'hs2', label: '📦 HS2', subtitle: '97 chapters' },
        { id: 'hs4', label: '🏷️ HS4', subtitle: '1,123 products' },
        { id: 'hs6', label: '🔍 HS6', subtitle: '4,632 sub-headings' },
        { id: 'hs8', label: '📋 HS8', subtitle: '9,300 line items' },
      ],
    },
    {
      label: 'Analysis',
      tabs: [
        { id: 'categories', label: '📁 Categories', subtitle: '17 categories' },
        { id: 'margins', label: '💰 Margins', subtitle: '4 products' },
        { id: 'business', label: '🧠 Business Intel', subtitle: 'Projections & forecasts' },
        { id: 'scoring', label: '⚡ Scoring', subtitle: 'Methodology reference' },
      ],
    },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'deals':
        return <DealPipeline />;
      case 'finance':
        return <FinancialProjections />;
      case 'compliance':
        return <ComplianceTracker />;
      case 'negotiations':
        return <SupplierNegotiations />;
      case 'supplychain':
        return <SupplyChainPlan />;
      case 'pipeline':
        return <PipelineJourney />;
      case 'hs2':
        return <HS2Chapters />;
      case 'hs4':
        return <HS4Products />;
      case 'hs6':
        return <HS6SubHeads />;
      case 'hs8':
        return <HS8Raw />;
      case 'categories':
        return <Categories />;
      case 'margins':
        return <Margins />;
      case 'business':
        return <BusinessIntel />;
      case 'shipments':
        return <Shipments />;
      case 'buyers':
        return <BuyersTargets />;
      case 'importers':
        return <Importers />;
      case 'electronics':
        return <ElectronicsResearch />;
      case 'shortlist':
        return <ProductShortlist />;
      case 'hs8deep':
        return <HS8DeepDive />;
      case 'scoring':
        return <ScoringRef />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="app">
      <header className="hdr">
        <div>
          <div className="hdr-title">🏢 KALASH EXIM Command Center</div>
          <div className="hdr-subtitle">📡 LIVE from Supabase + SQLite | Electronics Research Pipeline + Import Operations</div>
        </div>
        <div className="hdr-right">
          <div className="hdr-subtitle">{new Date().toLocaleDateString()}</div>
          <div className="db-indicator">🟢 DB Connected</div>
        </div>
      </header>

      <nav className="tabs">
        {tabGroups.map((group, groupIdx) => (
          <div key={group.label} className="tab-group">
            {group.tabs.map((tab, tabIdx) => (
              <div key={tab.id}>
                <button
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.subtitle}
                >
                  {tab.label}
                </button>
                {tabIdx < group.tabs.length - 1 && <div className="tab-separator" />}
              </div>
            ))}
            {groupIdx < tabGroups.length - 1 && <div className="group-separator" />}
          </div>
        ))}
      </nav>

      <div className="tab-content">
        {renderTab()}
      </div>

      <footer className="footer">
        ⚡ KALASH EXIM Command Center © 2026 | Powered by React + Supabase + Recharts
      </footer>
    </div>
  );
}
