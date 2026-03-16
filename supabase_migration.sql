-- ============================================================
-- KALASH EXIM Intelligence DB — Supabase Migration
-- Phase 1: Electronics Research (180 HS4 codes, 10 tables)
-- Run this via Supabase SQL Editor or apply_migration MCP tool
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. research_codes — Master list of 180 electronics HS4 codes
-- ============================================================
CREATE TABLE IF NOT EXISTS research_codes (
    hs4 TEXT PRIMARY KEY,
    commodity TEXT,
    val_m REAL,
    drill_score REAL,
    verdict_scoring TEXT,
    entry_tier TEXT,
    bcd_rate REAL,
    hs8_count INTEGER,
    hs8_keywords JSONB,          -- Store as JSONB for better querying
    regulatory_risk TEXT,
    regulatory_risks TEXT,
    current_phase TEXT DEFAULT 'pending',
    phase2_status TEXT DEFAULT 'pending',
    phase2b_status TEXT DEFAULT 'pending',
    phase3_status TEXT DEFAULT 'pending',
    phase4_status TEXT DEFAULT 'pending',
    phase5_status TEXT DEFAULT 'pending',
    final_verdict TEXT,
    kill_phase TEXT,
    kill_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    qa_status TEXT,
    qa_fail_count INTEGER DEFAULT 0,
    qa_fail_reason TEXT,
    qa_fail_date TIMESTAMPTZ,
    qa_pass_date TIMESTAMPTZ,
    qa_warnings TEXT,
    qa_completeness_score REAL
);

-- ============================================================
-- 2. phase2_alibaba — Per-keyword Alibaba search results
-- ============================================================
CREATE TABLE IF NOT EXISTS phase2_alibaba (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hs4 TEXT REFERENCES research_codes(hs4),
    hs8 TEXT,
    keyword TEXT,
    keyword_val_m REAL,
    search_url TEXT,
    page_title TEXT,
    supplier_count INTEGER,
    supplier_count_raw TEXT,
    fob_low_usd REAL,
    fob_high_usd REAL,
    fob_raw_text TEXT,
    moq_text TEXT,
    moq_value INTEGER,
    moq_unit TEXT,
    gold_supplier_count INTEGER,
    trade_assurance_count INTEGER,
    verified_supplier_count INTEGER,
    ready_to_ship INTEGER,
    top_3_suppliers JSONB,
    top_3_prices JSONB,
    extraction_method TEXT,
    page_screenshot_path TEXT,
    raw_page_snippet TEXT,
    extracted_at TIMESTAMPTZ,
    extraction_success BOOLEAN,
    extraction_notes TEXT
);

-- ============================================================
-- 3. phase2_alibaba_summary — Aggregated per-HS4 supply data
-- ============================================================
CREATE TABLE IF NOT EXISTS phase2_alibaba_summary (
    hs4 TEXT PRIMARY KEY REFERENCES research_codes(hs4),
    keywords_searched INTEGER,
    total_suppliers INTEGER,
    verified_suppliers INTEGER,
    gold_supplier_pct REAL,
    fob_lowest_usd REAL,
    fob_highest_usd REAL,
    fob_typical_usd REAL,
    typical_moq TEXT,
    ready_to_ship_available BOOLEAN,
    trade_assurance_available BOOLEAN,
    top_suppliers JSONB,
    kill_signal BOOLEAN DEFAULT FALSE,
    kill_reason TEXT,
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- 4. phase2b_regulatory — 13 regulatory checks per code
-- ============================================================
CREATE TABLE IF NOT EXISTS phase2b_regulatory (
    hs4 TEXT PRIMARY KEY REFERENCES research_codes(hs4),
    bcd_pct REAL,
    igst_pct REAL,
    sws_pct REAL,
    total_duty_pct REAL,
    icegate_url TEXT,
    icegate_raw_text TEXT,
    check_anti_dumping BOOLEAN,
    add_rate_pct REAL,
    add_source_url TEXT,
    add_notes TEXT,
    check_safeguard BOOLEAN,
    safeguard_pct REAL,
    safeguard_notes TEXT,
    check_aidc BOOLEAN,
    aidc_pct REAL,
    check_dgft_restriction BOOLEAN,
    dgft_notes TEXT,
    check_add_investigation BOOLEAN,
    add_investigation_notes TEXT,
    check_wpc BOOLEAN,
    wpc_cost_inr REAL,
    wpc_weeks INTEGER,
    check_tec BOOLEAN,
    tec_cost_inr REAL,
    tec_weeks INTEGER,
    check_bis_qco BOOLEAN,
    bis_cost_inr REAL,
    bis_weeks INTEGER,
    check_pmp BOOLEAN,
    pmp_notes TEXT,
    check_input_add BOOLEAN,
    input_add_notes TEXT,
    check_epr BOOLEAN,
    epr_cost_inr REAL,
    check_fta BOOLEAN,
    fta_benefit_notes TEXT,
    fta_duty_reduction_pct REAL,
    regulatory_risk_score TEXT,
    total_compliance_cost_inr REAL,
    total_compliance_weeks INTEGER,
    kill_signal BOOLEAN DEFAULT FALSE,
    kill_reason TEXT,
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- 5. phase3_indiamart — Per-keyword IndiaMART search results
-- ============================================================
CREATE TABLE IF NOT EXISTS phase3_indiamart (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hs4 TEXT REFERENCES research_codes(hs4),
    hs8 TEXT,
    keyword TEXT,
    search_url TEXT,
    page_title TEXT,
    seller_count INTEGER,
    seller_count_raw TEXT,
    price_low_inr REAL,
    price_high_inr REAL,
    price_raw_text TEXT,
    manufacturer_count INTEGER,
    trader_count INTEGER,
    wholesaler_count INTEGER,
    top_3_cities JSONB,
    top_3_sellers JSONB,
    top_3_prices_inr JSONB,
    extraction_method TEXT,
    page_screenshot_path TEXT,
    raw_page_snippet TEXT,
    extracted_at TIMESTAMPTZ,
    extraction_success BOOLEAN,
    extraction_notes TEXT
);

-- ============================================================
-- 6. phase3_indiamart_summary — Aggregated per-HS4 demand data
-- ============================================================
CREATE TABLE IF NOT EXISTS phase3_indiamart_summary (
    hs4 TEXT PRIMARY KEY REFERENCES research_codes(hs4),
    keywords_searched INTEGER,
    total_sellers INTEGER,
    manufacturer_pct REAL,
    trader_pct REAL,
    price_low_inr REAL,
    price_high_inr REAL,
    price_typical_inr REAL,
    top_cities JSONB,
    google_trends_direction TEXT,
    justdial_count INTEGER,
    fob_typical_usd REAL,
    landed_cost_inr REAL,
    sell_price_inr REAL,
    gross_margin_pct REAL,
    gross_margin_inr REAL,
    kill_signal BOOLEAN DEFAULT FALSE,
    kill_reason TEXT,
    demand_score REAL,
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- 7. phase4_volza — Volza scrape validation metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS phase4_volza (
    hs4 TEXT PRIMARY KEY REFERENCES research_codes(hs4),
    scrape_date TEXT,
    date_range TEXT,
    total_shipments INTEGER,
    total_pages INTEGER,
    unique_buyers INTEGER,
    buyer_hhi REAL,
    top_5_buyers JSONB,
    median_cif_usd REAL,
    avg_cif_usd REAL,
    small_buyer_pct REAL,
    unique_shippers INTEGER,
    top_5_shippers JSONB,
    china_sourcing_pct REAL,
    volza_avg_unit_rate REAL,
    volza_median_unit_rate REAL,
    price_std_dev REAL,
    kill_signal BOOLEAN DEFAULT FALSE,
    kill_reason TEXT,
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- 8. phase5_scoring — Final 150-point scoring
-- ============================================================
CREATE TABLE IF NOT EXISTS phase5_scoring (
    hs4 TEXT PRIMARY KEY REFERENCES research_codes(hs4),
    pts_gross_margin REAL,
    pts_buyer_accessibility REAL,
    pts_supply_reliability REAL,
    pts_market_size REAL,
    pts_regulatory_risk REAL,
    pts_competition REAL,
    pts_growth REAL,
    pts_working_capital REAL,
    pts_logistics REAL,
    pts_obsolescence REAL,
    pts_capital_required REAL,
    pts_fta REAL,
    total_score REAL,
    working_capital_est_inr REAL,
    fx_risk_level TEXT,
    obsolescence_risk TEXT,
    freight_estimate_usd REAL,
    total_overhead_pct REAL,
    final_verdict TEXT,
    go_nogo_notes TEXT,
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- 9. research_log — Audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS research_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    hs4 TEXT,
    phase TEXT,
    action TEXT,
    agent_id TEXT,
    source_url TEXT,
    detail TEXT,
    success BOOLEAN,
    error_msg TEXT
);

-- ============================================================
-- 10. agent_assignments — Track parallel agent work
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agent_id TEXT,
    batch_name TEXT,
    hs4_codes JSONB,
    phase TEXT,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    codes_completed INTEGER DEFAULT 0,
    codes_failed INTEGER DEFAULT 0,
    output_file TEXT,
    notes TEXT
);

-- ============================================================
-- Indexes for fast dashboard queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_research_codes_phase ON research_codes(current_phase);
CREATE INDEX IF NOT EXISTS idx_research_codes_verdict ON research_codes(final_verdict);
CREATE INDEX IF NOT EXISTS idx_research_codes_score ON research_codes(drill_score DESC);
CREATE INDEX IF NOT EXISTS idx_phase2_alibaba_hs4 ON phase2_alibaba(hs4);
CREATE INDEX IF NOT EXISTS idx_phase3_indiamart_hs4 ON phase3_indiamart(hs4);
CREATE INDEX IF NOT EXISTS idx_research_log_hs4 ON research_log(hs4);
CREATE INDEX IF NOT EXISTS idx_research_log_ts ON research_log(timestamp DESC);

-- ============================================================
-- Row Level Security (RLS) — public read, authenticated write
-- ============================================================
ALTER TABLE research_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_alibaba ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_alibaba_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2b_regulatory ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase3_indiamart ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase3_indiamart_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase4_volza ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase5_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_assignments ENABLE ROW LEVEL SECURITY;

-- Public read access for dashboard
CREATE POLICY "Public read" ON research_codes FOR SELECT USING (true);
CREATE POLICY "Public read" ON phase2_alibaba FOR SELECT USING (true);
CREATE POLICY "Public read" ON phase2_alibaba_summary FOR SELECT USING (true);
CREATE POLICY "Public read" ON phase2b_regulatory FOR SELECT USING (true);
CREATE POLICY "Public read" ON phase3_indiamart FOR SELECT USING (true);
CREATE POLICY "Public read" ON phase3_indiamart_summary FOR SELECT USING (true);
CREATE POLICY "Public read" ON phase4_volza FOR SELECT USING (true);
CREATE POLICY "Public read" ON phase5_scoring FOR SELECT USING (true);
CREATE POLICY "Public read" ON research_log FOR SELECT USING (true);
CREATE POLICY "Public read" ON agent_assignments FOR SELECT USING (true);

-- Anon insert/update for pipeline scripts (using service key)
CREATE POLICY "Service write" ON research_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON phase2_alibaba FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON phase2_alibaba_summary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON phase2b_regulatory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON phase3_indiamart FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON phase3_indiamart_summary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON phase4_volza FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON phase5_scoring FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON research_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write" ON agent_assignments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Updated_at auto-trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER research_codes_updated_at
    BEFORE UPDATE ON research_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- View: Pipeline funnel summary (for dashboard KPIs)
-- ============================================================
CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
    COUNT(*) AS total_codes,
    COUNT(*) FILTER (WHERE current_phase != 'pending') AS codes_started,
    COUNT(*) FILTER (WHERE phase2_status = 'DONE') AS phase2_done,
    COUNT(*) FILTER (WHERE phase2b_status = 'DONE') AS phase2b_done,
    COUNT(*) FILTER (WHERE phase3_status = 'DONE') AS phase3_done,
    COUNT(*) FILTER (WHERE qa_status = 'PASSED') AS qa_passed,
    COUNT(*) FILTER (WHERE phase4_status = 'DONE') AS phase4_done,
    COUNT(*) FILTER (WHERE phase5_status = 'DONE') AS phase5_done,
    COUNT(*) FILTER (WHERE current_phase = 'COMPLETE') AS completed,
    COUNT(*) FILTER (WHERE kill_phase IS NOT NULL) AS killed,
    COUNT(*) FILTER (WHERE final_verdict = 'PURSUE') AS verdict_pursue,
    COUNT(*) FILTER (WHERE final_verdict = 'STRONG') AS verdict_strong,
    COUNT(*) FILTER (WHERE final_verdict = 'MODERATE') AS verdict_moderate,
    COUNT(*) FILTER (WHERE final_verdict = 'DROP') AS verdict_drop,
    ROUND(AVG(val_m)::numeric, 1) AS avg_trade_val_m,
    ROUND(AVG(drill_score)::numeric, 1) AS avg_drill_score
FROM research_codes;

-- ============================================================
-- View: Completed research cards (joined across all phases)
-- ============================================================
CREATE OR REPLACE VIEW research_cards AS
SELECT
    rc.hs4,
    rc.commodity,
    rc.val_m,
    rc.drill_score,
    rc.current_phase,
    rc.final_verdict,
    rc.qa_status,
    rc.qa_warnings,
    -- Phase 2
    a.total_suppliers,
    a.fob_lowest_usd,
    a.fob_highest_usd,
    a.fob_typical_usd,
    a.gold_supplier_pct,
    a.typical_moq,
    a.kill_signal AS p2_kill,
    -- Phase 2b
    r.total_duty_pct,
    r.bcd_pct,
    r.igst_pct,
    r.regulatory_risk_score,
    r.total_compliance_cost_inr,
    r.kill_signal AS p2b_kill,
    -- Phase 3
    i.total_sellers,
    i.manufacturer_pct,
    i.trader_pct,
    i.price_low_inr,
    i.price_high_inr,
    i.gross_margin_pct,
    i.landed_cost_inr,
    i.sell_price_inr,
    i.demand_score,
    i.kill_signal AS p3_kill,
    -- Phase 4
    v.unique_buyers,
    v.buyer_hhi,
    v.china_sourcing_pct,
    v.median_cif_usd,
    v.total_shipments AS volza_shipments,
    v.kill_signal AS p4_kill,
    -- Phase 5
    s.total_score,
    s.pts_gross_margin,
    s.pts_buyer_accessibility,
    s.pts_supply_reliability,
    s.pts_market_size,
    s.pts_regulatory_risk,
    s.pts_competition,
    s.pts_growth,
    s.go_nogo_notes
FROM research_codes rc
LEFT JOIN phase2_alibaba_summary a ON rc.hs4 = a.hs4
LEFT JOIN phase2b_regulatory r ON rc.hs4 = r.hs4
LEFT JOIN phase3_indiamart_summary i ON rc.hs4 = i.hs4
LEFT JOIN phase4_volza v ON rc.hs4 = v.hs4
LEFT JOIN phase5_scoring s ON rc.hs4 = s.hs4;
