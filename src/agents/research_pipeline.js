/**
 * KALASH EXIM — Multi-Agent Research Pipeline v1.0
 *
 * Architecture: 7 Agent Types working in coordination
 * ─────────────────────────────────────────────────────
 * 1. COORDINATOR     — Manages queue, assigns codes to agents, tracks progress
 * 2. SUPPLY_SCOUT    — Phase 2: Alibaba + Made-in-China + DHgate + 1688 + ImportYeti
 * 3. REGULATORY_SCOUT— Phase 2b: ICEGATE + ImportDuty.in + DGTR + BIS + DGFT + WPC + TEC + CPCB + Trade Portal
 * 4. DEMAND_SCOUT    — Phase 3: IndiaMART + TradeIndia + JustDial + Google Trends + Google Maps
 * 5. VOLZA_SCOUT     — Phase 4: Volza deep scrape (manual trigger, KS4 v10)
 * 6. QA_AGENT        — Validates data quality, runs kill checks, flags warnings
 * 7. DB_WRITER       — Writes collected data to Supabase, updates source_coverage
 *
 * Flow per HS4 code:
 *   COORDINATOR picks next code from queue →
 *   SUPPLY_SCOUT + REGULATORY_SCOUT + DEMAND_SCOUT run in parallel →
 *   DB_WRITER saves all data to Supabase (triggers auto-update source_coverage) →
 *   QA_AGENT validates (auto-triggered by Supabase trigger when phase3 completes) →
 *   If QA PASS → code advances to Phase 4 queue
 *   If QA FAIL → code gets kill_reason, removed from pipeline
 *   COORDINATOR picks next code...
 *
 * Source Map (26 working sources across 5 phases):
 * ──────────────────────────────────────────────────
 * Phase 2 (Supply):     Alibaba, Made-in-China, DHgate, 1688, ImportYeti
 * Phase 2b (Regulatory): ICEGATE, ImportDuty.in, DGTR, BIS, DGFT, WPC, TEC, CPCB, Trade Portal
 * Phase 3 (Demand):     IndiaMART, TradeIndia, JustDial, Google Trends, Google Maps
 * Phase 4 (Validation): Volza ($1500 account)
 * Phase 5 (Scoring):    Zauba, Tofler, GST Portal, MCA, DGFT IEC, Qichacha, LinkedIn
 *
 * TOTAL: 26 active sources checked per HS4 code
 */

// This file documents the pipeline architecture.
// The actual execution happens via Cowork agents using WebSearch + Chrome tools.
// Each agent function below maps to a Cowork agent task.

export const AGENT_TYPES = {
  COORDINATOR: 'coordinator',
  SUPPLY_SCOUT: 'supply_scout',
  REGULATORY_SCOUT: 'regulatory_scout',
  DEMAND_SCOUT: 'demand_scout',
  VOLZA_SCOUT: 'volza_scout',
  QA_AGENT: 'qa_agent',
  DB_WRITER: 'db_writer'
};

// ─── SOURCE DEFINITIONS ──────────────────────────────────────
export const SOURCES = {
  phase2: [
    { id: 'alibaba', name: 'Alibaba', url: 'https://www.alibaba.com/trade/search?SearchText={keyword}&Country=CN', method: 'browser', fields: ['total_suppliers','fob_lowest_usd','fob_highest_usd','fob_typical_usd','typical_moq','gold_supplier_pct','trade_assurance_available','ready_to_ship_available','top_suppliers'] },
    { id: 'mic', name: 'Made-in-China', url: 'https://www.made-in-china.com/products-search/hot-china-products/{keyword}.html', method: 'browser', fields: ['mic_supplier_count','mic_fob_low_usd','mic_fob_high_usd'] },
    { id: 'dhgate', name: 'DHgate', url: 'https://www.dhgate.com/wholesale/search.do?searchkey={keyword}', method: 'browser', fields: ['dhgate_supplier_count','dhgate_fob_low_usd','dhgate_fob_high_usd'] },
    { id: 'ali1688', name: '1688.com', url: 'https://s.1688.com/selloffer/offer_search.htm?keywords={keyword}', method: 'browser', fields: ['ali1688_factory_count','ali1688_price_low_cny','ali1688_price_high_cny'] },
    { id: 'importyeti', name: 'ImportYeti', url: 'https://www.importyeti.com/search?q={hs4}', method: 'browser', fields: ['importyeti_shipper_count','importyeti_top_factories'] },
  ],
  phase2b: [
    { id: 'icegate', name: 'ICEGATE', url: 'https://old.icegate.gov.in/Webappl/Trade-Guide-on-Imports', method: 'browser', fields: ['bcd_pct','igst_pct','sws_pct','total_duty_pct','icegate_url','icegate_raw_text'] },
    { id: 'importduty', name: 'ImportDuty.in', url: 'https://www.importduty.in/search?q={hs4}', method: 'websearch', fields: ['importduty_total_duty_pct','importduty_url'] },
    { id: 'dgtr', name: 'DGTR', url: 'https://www.dgtr.gov.in/anti-dumping-cases', method: 'websearch', fields: ['check_anti_dumping','add_rate_pct','add_notes'] },
    { id: 'bis', name: 'BIS Portal', url: 'https://bis.gov.in', method: 'websearch', fields: ['check_bis_qco','bis_cost_inr','bis_weeks'] },
    { id: 'dgft', name: 'DGFT', url: 'https://dgft.gov.in', method: 'websearch', fields: ['check_dgft_restriction','dgft_notes'] },
    { id: 'wpc', name: 'WPC Portal', url: 'https://wpc.dot.gov.in', method: 'websearch', fields: ['check_wpc','wpc_cost_inr','wpc_weeks'] },
    { id: 'tec', name: 'TEC Portal', url: 'https://tec.gov.in', method: 'websearch', fields: ['check_tec','tec_cost_inr','tec_weeks'] },
    { id: 'cpcb', name: 'CPCB EPR', url: 'https://cpcb.nic.in', method: 'websearch', fields: ['check_epr','epr_cost_inr'] },
    { id: 'trade_portal', name: 'Indian Trade Portal', url: 'https://indiantradeportal.in', method: 'websearch', fields: ['check_fta','fta_benefit_notes','fta_duty_reduction_pct'] },
  ],
  phase3: [
    { id: 'indiamart', name: 'IndiaMART', url: 'https://dir.indiamart.com/search.mp?ss={keyword}', method: 'browser', fields: ['total_sellers','manufacturer_pct','trader_pct','price_low_inr','price_high_inr','price_typical_inr','top_cities'] },
    { id: 'tradeindia', name: 'TradeIndia', url: 'https://www.tradeindia.com/search.html?keyword={keyword}', method: 'browser', fields: ['tradeindia_seller_count','tradeindia_price_low_inr','tradeindia_price_high_inr'] },
    { id: 'justdial', name: 'JustDial', url: 'https://www.justdial.com/search?q={keyword}', method: 'browser', fields: ['justdial_count'] },
    { id: 'google_trends', name: 'Google Trends', url: 'https://trends.google.com/trends/explore?q={keyword}&geo=IN', method: 'browser', fields: ['google_trends_direction','google_trends_interest'] },
    { id: 'google_maps', name: 'Google Maps', url: 'https://www.google.com/maps/search/{keyword}+manufacturer+India', method: 'browser', fields: ['google_maps_cluster_count','google_maps_top_areas'] },
  ],
  phase4: [
    { id: 'volza', name: 'Volza', url: 'https://app.volza.com', method: 'manual_scraper', fields: ['total_shipments','unique_buyers','buyer_hhi','median_cif_usd','china_sourcing_pct','top_5_buyers','top_5_shippers'] },
  ],
  phase5: [
    { id: 'zauba', name: 'Zauba Corp', url: 'https://www.zaubacorp.com/company-search', method: 'browser', fields: ['zauba_verified','zauba_data'] },
    { id: 'tofler', name: 'Tofler', url: 'https://www.tofler.in/search', method: 'browser', fields: ['tofler_verified','tofler_data'] },
    { id: 'gst_portal', name: 'GST Portal', url: 'https://services.gst.gov.in/services/searchtp', method: 'browser', fields: ['gst_verified','gst_data'] },
    { id: 'mca', name: 'MCA Portal', url: 'https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do', method: 'browser', fields: ['mca_verified','mca_data'] },
    { id: 'dgft_iec', name: 'DGFT IEC', url: 'https://dgft.gov.in/CP/', method: 'browser', fields: ['dgft_iec_verified','dgft_iec_data'] },
    { id: 'qichacha', name: 'Qichacha', url: 'https://www.qcc.com', method: 'browser', fields: ['qichacha_verified','qichacha_data'] },
  ]
};

// Total source count per phase
export const SOURCE_COUNTS = {
  phase2: 5,
  phase2b: 9,
  phase3: 5,
  phase4: 1,
  phase5: 6,
  total: 26
};

// ─── QA KILL CHECKS ──────────────────────────────────────────
export const QA_HARD_KILLS = [
  { id: 'no_supply', check: (d) => !d.p2?.total_suppliers || d.p2.total_suppliers < 5, reason: 'Fewer than 5 suppliers found' },
  { id: 'no_fob', check: (d) => !d.p2?.fob_lowest_usd, reason: 'No FOB pricing data' },
  { id: 'no_demand', check: (d) => !d.p3?.total_sellers || d.p3.total_sellers === 0, reason: 'No demand data found' },
  { id: 'no_india_price', check: (d) => !d.p3?.price_low_inr, reason: 'No Indian pricing data' },
  { id: 'negative_margin', check: (d) => d.p3?.gross_margin_pct !== null && d.p3.gross_margin_pct < 10, reason: 'Gross margin below 10%' },
  { id: 'cant_calc_margin', check: (d) => !d.p3?.gross_margin_pct && d.p3?.total_sellers > 0, reason: 'Cannot calculate margin' },
  { id: 'critical_regulatory', check: (d) => d.p2b?.regulatory_risk_score === 'CRITICAL', reason: 'Critical regulatory risk' },
  { id: 'high_add', check: (d) => d.p2b?.add_rate_pct > 25, reason: 'Anti-dumping duty exceeds 25%' },
  { id: 'dgft_restricted', check: (d) => d.p2b?.check_dgft_restriction === 1, reason: 'DGFT import restricted' },
];

export const QA_SOFT_WARNINGS = [
  { id: 'low_supply', check: (d) => d.p2?.total_suppliers < 20, warning: 'Low supply diversity (<20 suppliers)' },
  { id: 'low_verified', check: (d) => d.p2?.gold_supplier_pct < 20, warning: 'Low verified supplier percentage (<20%)' },
  { id: 'thin_margin', check: (d) => d.p3?.gross_margin_pct >= 10 && d.p3.gross_margin_pct < 15, warning: 'Thin margin (10-15%)' },
  { id: 'saturated', check: (d) => d.p3?.total_sellers > 500, warning: 'Saturated market (>500 sellers)' },
  { id: 'captive', check: (d) => d.p3?.manufacturer_pct > 90, warning: 'Captive market (>90% manufacturers)' },
  { id: 'bis_qco', check: (d) => d.p2b?.check_bis_qco === 1, warning: 'BIS QCO certification required' },
  { id: 'wpc_tec', check: (d) => d.p2b?.check_wpc === 1 || d.p2b?.check_tec === 1, warning: 'WPC/TEC certification required' },
];
