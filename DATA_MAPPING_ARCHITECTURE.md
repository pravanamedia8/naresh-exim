# Electronics Research — Data Mapping & Auto-Update Architecture

## How Dashboard Fields Auto-Fill When New HS4 Codes Are Researched

The entire pipeline is **zero-code, trigger-driven**. You INSERT research data into 3 Supabase tables → 10 triggers cascade → `research_codes` updates → React dashboard auto-reflects via real-time subscription.

---

## AUTO-UPDATE CHAIN (per HS4 code)

```
STEP 1: INSERT into phase2b_regulatory (65 cols)
  → trg_phase2b_sync fires (on UPDATE when completed_at changes)
    → UPDATE research_codes SET phase2b_status='DONE', current_phase='phase3_pending'
  → trg_log_phase2b_sources fires → INSERT into source_coverage
  → Dashboard: Regulatory Matrix tab updates, Overview KPIs update

STEP 2: INSERT into phase2_alibaba_summary (34 cols)
  → trg_phase2_sync fires (on INSERT/UPDATE)
    → UPDATE research_codes SET phase2_status='DONE', current_phase='phase2b_pending'
  → trg_log_phase2_sources fires → INSERT into source_coverage
  → Dashboard: Supply vs Demand tab gets supply data, Overview bar chart updates

STEP 3: INSERT into phase3_indiamart_summary (34 cols)
  → trg_phase3_sync fires (on INSERT/UPDATE)
    → UPDATE research_codes SET phase3_status='DONE', current_phase='qa_pending'
  → trg_log_phase3_sources fires → INSERT into source_coverage
  → Dashboard: Supply vs Demand tab gets demand data

  → research_codes UPDATE triggers trg_auto_qa:
    → Checks: zero suppliers? zero sellers? (HARD KILL)
    → Checks: regulatory barriers, margin, saturation (SOFT WARNINGS)
    → Classifies trading model: REGULAR / SPOT / BROKER / MIXED
    → Sets: qa_status, trading_model, trading_model_reason, qa_warnings
    → If PASS: current_phase → 'COMPLETE'
    → If FAIL: current_phase → 'qa_failed', kill_reason set

  → Then trg_auto_phase5_score fires (if qa_status='PASS'):
    → Reads P2 + P2b + P3 data
    → Calculates 12-dimension score (150 pts max)
    → INSERT into phase5_scoring (auto-scores from existing data)
    → UPDATE research_codes SET phase5_status='DONE', final_verdict=verdict

  → Dashboard: All 9 tabs update simultaneously via real-time subscription
```

---

## FIELD-BY-FIELD MAPPING: Supabase Columns → Dashboard Display

### Tab 1: Executive Overview
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| Total HS4 Codes | research_codes | COUNT(*) |
| Completed (All 5 Phases) | research_codes | COUNT WHERE current_phase IN ('COMPLETE','phase5_done','N/A') |
| Awaiting Research | research_codes | total - completed |
| QA Pass Rate | research_codes | COUNT(qa_status='PASS') / COUNT(qa_status IN ('PASS','FAILED')) |
| Total Trade Value | research_codes | SUM(val_m) for completed codes |
| Avg Score | phase5_scoring | AVG(total_score) |
| Trading Models | research_codes | MODE(trading_model) |
| Verdict Distribution pie chart | research_codes | verdict_scoring grouped |
| Pipeline Phase Progress bar chart | research_codes + phase tables | phase2b_status, phase2_status, phase3_status counts |
| Trade Value bar chart | research_codes | val_m per completed code |
| 150-Point Score bar chart | phase5_scoring | total_score per code |

### Tab 2: Pipeline Funnel
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| Phase KPIs (P1-P5) | research_codes | COUNT per phase status |
| Killed count | research_codes | COUNT(qa_status='FAILED') |
| Funnel bar chart | research_codes | aggregated phase counts |
| Trading Model pie chart | research_codes | trading_model grouped |
| Completion Matrix table | research_codes | current_phase per code |
| Phase flow indicator | research_codes | current_phase |

### Tab 3: Completed Codes
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| HS4, Commodity | research_codes | hs4, commodity |
| Trade $M | research_codes | val_m |
| Score/150 | phase5_scoring | total_score |
| Verdict | phase5_scoring | verdict |
| Trading Model | research_codes | trading_model |
| Margin % | phase3_indiamart_summary | gross_margin_pct |
| Suppliers | phase2_alibaba_summary | total_suppliers |
| Sellers | phase3_indiamart_summary | total_sellers |
| Total Duty % | phase2b_regulatory | total_duty_pct |
| Regulatory Risk | phase2b_regulatory | regulatory_risk_score |
| QA Warnings | research_codes | qa_warnings |
| Click → Deep Dive | n/a | navigates to deepdive tab |

### Tab 4: Deep Dive (per code)
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| **Header** | research_codes | hs4, commodity, val_m, drill_score, entry_tier, current_phase |
| **Phase Flow** | research_codes | phase2b_status, phase2_status, phase3_status, phase5_status |
| **Trading Model** | research_codes | trading_model, trading_model_reason |
| **QA Status** | research_codes | qa_status, qa_warnings, qa_completeness_score |
| **Supply (Alibaba)** | phase2_alibaba_summary | total_suppliers, verified_suppliers, gold_supplier_pct, fob_lowest_usd, fob_highest_usd, fob_typical_usd, typical_moq, keywords_searched, data_sources_used, source_count |
| **Multi-source supply** | phase2_alibaba_summary | mic_supplier_count, mic_fob_low_usd, mic_fob_high_usd, dhgate_supplier_count, dhgate_fob_low_usd, dhgate_fob_high_usd, ali1688_factory_count |
| **Regulatory** | phase2b_regulatory | bcd_pct, igst_pct, sws_pct, total_duty_pct, check_anti_dumping, add_rate_pct, check_safeguard, check_aidc, aidc_pct, check_dgft_restriction, check_bis_qco, check_wpc, check_tec, check_pmp, check_epr, check_fta, fta_duty_reduction_pct, regulatory_risk_score, total_compliance_cost_inr |
| **Demand (IndiaMART)** | phase3_indiamart_summary | total_sellers, manufacturer_pct, trader_pct, price_low_inr, price_high_inr, price_typical_inr, top_cities, keywords_searched, data_sources_used |
| **Margin Calc** | phase3_indiamart_summary | fob_typical_usd, landed_cost_inr, sell_price_inr, gross_margin_pct, gross_margin_inr |
| **150-Point Radar** | phase5_scoring | score_margin, score_buyer_access, score_supply, score_market_size, score_regulatory, score_competition, score_growth, score_working_capital, score_logistics, score_obsolescence, score_capital, score_fta |
| **Final Score** | phase5_scoring | total_score, verdict, go_nogo_notes |

### Tab 5: 150-Point Scoring
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| Score comparison bar chart | phase5_scoring | total_score per code |
| Radar chart (selected code) | phase5_scoring | all 12 score_* columns |
| Scoring breakdown table | phase5_scoring | hs4, score_margin (25), score_buyer_access (20), score_supply (15), score_market_size (15), score_regulatory (15), score_competition (10), score_growth (10), score_working_capital (10), score_logistics (10), score_obsolescence (10), score_capital (5), score_fta (5), total_score, verdict |

### Tab 6: Regulatory Matrix
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| Risk Distribution KPIs | phase2b_regulatory | COUNT per regulatory_risk_score |
| 13-check grid per code | phase2b_regulatory | check_anti_dumping, check_safeguard, check_aidc, check_dgft_restriction, check_add_investigation, check_wpc, check_tec, check_bis_qco, check_pmp, check_input_add, check_epr, check_fta + sws (always 1) |
| Duty rates | phase2b_regulatory | bcd_pct, igst_pct, sws_pct, total_duty_pct |
| FTA info | phase2b_regulatory | fta_benefit_notes, fta_duty_reduction_pct |
| Compliance cost | phase2b_regulatory | total_compliance_cost_inr, total_compliance_weeks |
| Verification badges | phase2b_regulatory | importduty_verified, icegate_verified, dgtr_verified, bis_verified, dgft_verified |

### Tab 7: Supply vs Demand
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| Supply bars | phase2_alibaba_summary | total_suppliers per code |
| Demand bars | phase3_indiamart_summary | total_sellers per code |
| FOB vs India Price | phase2_alibaba_summary + phase3_indiamart_summary | fob_typical_usd, price_typical_inr |
| Margin % | phase3_indiamart_summary | gross_margin_pct |
| Combined table | both tables joined by hs4 | all key columns |

### Tab 8: All 180 Codes
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| Every code row | research_codes (merged) | hs4, commodity, val_m, drill_score, verdict_scoring, current_phase, qa_status, trading_model |
| Merged supply data | phase2_alibaba_summary | total_suppliers, fob_lowest_usd |
| Merged demand data | phase3_indiamart_summary | total_sellers, gross_margin_pct |
| Merged regulatory | phase2b_regulatory | total_duty_pct, regulatory_risk_score |
| Merged score | phase5_scoring | total_score, verdict |
| Filters | research_codes | qa_status, trading_model, verdict_scoring |

### Tab 9: Research Queue
| Dashboard Element | Source Table | Column(s) |
|---|---|---|
| Next 20 pending codes | research_codes | WHERE current_phase='phase1_complete' ORDER BY drill_score DESC LIMIT 20 |
| Expansion plan | static | Future phases description |

---

## SUPABASE TRIGGERS (10 research-related)

| # | Trigger | Fires On | Table | Action |
|---|---|---|---|---|
| 1 | trg_phase2_sync | INSERT/UPDATE | phase2_alibaba_summary | → research_codes.phase2_status='DONE' |
| 2 | trg_log_phase2_sources | INSERT/UPDATE | phase2_alibaba_summary | → INSERT source_coverage |
| 3 | trg_phase2b_sync | UPDATE (completed_at changes) | phase2b_regulatory | → research_codes.phase2b_status='DONE' |
| 4 | trg_log_phase2b_sources | INSERT/UPDATE | phase2b_regulatory | → INSERT source_coverage |
| 5 | trg_phase3_sync | INSERT/UPDATE | phase3_indiamart_summary | → research_codes.phase3_status='DONE', current_phase='qa_pending' |
| 6 | trg_log_phase3_sources | INSERT/UPDATE | phase3_indiamart_summary | → INSERT source_coverage |
| 7 | trg_auto_qa | UPDATE (current_phase→qa_pending) | research_codes | → qa_status, trading_model, warnings |
| 8 | trg_auto_phase5_score | UPDATE (current_phase→phase4_pending, qa_status=PASS) | research_codes | → INSERT phase5_scoring (12 dimensions) |
| 9 | trg_phase5_sync | INSERT/UPDATE | phase5_scoring | → research_codes.phase5_status='DONE' |
| 10 | research_codes_updated_at | UPDATE | research_codes | → auto-sets updated_at |

---

## REACT REAL-TIME SUBSCRIPTION

```javascript
// ElectronicsResearch.jsx subscribes to ALL 5 tables
const sub = supabase.channel('electronics_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'research_codes' }, () => fetchData())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'phase2b_regulatory' }, () => fetchData())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'phase2_alibaba_summary' }, () => fetchData())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'phase3_indiamart_summary' }, () => fetchData())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'phase5_scoring' }, () => fetchData())
  .subscribe();
```

Any INSERT/UPDATE to any of these 5 tables → `fetchData()` re-queries all 5 → React re-renders → dashboard updates within 1-2 seconds.

---

## HOW TO ADD A NEW HS4 CODE'S DATA

### Step 1: Phase 2b Regulatory (WebSearch agent)
```sql
UPDATE phase2b_regulatory SET
  bcd_pct = 15.0, igst_pct = 18.0, sws_pct = 1.5, total_duty_pct = 36.77,
  check_anti_dumping = 0, check_safeguard = 0, check_aidc = 0,
  check_dgft_restriction = 0, check_bis_qco = 1, check_wpc = 0, check_tec = 0,
  check_pmp = 0, check_epr = 1, check_fta = 1, check_input_add = 0,
  regulatory_risk_score = 'MEDIUM',
  total_compliance_cost_inr = 150000, total_compliance_weeks = 12,
  importduty_verified = true, icegate_verified = true, dgtr_verified = true,
  completed_at = NOW()
WHERE hs4 = 'XXXX';
-- → trg_phase2b_sync fires → research_codes updated → dashboard reflects
```

### Step 2: Phase 2 Alibaba Supply (Chrome agent)
```sql
INSERT INTO phase2_alibaba_summary (hs4, keywords_searched, total_suppliers,
  verified_suppliers, gold_supplier_pct, fob_lowest_usd, fob_highest_usd,
  fob_typical_usd, typical_moq, data_sources_used, source_count, completed_at)
VALUES ('XXXX', 3, 245, 67, 27.3, 2.50, 185.00, 45.00, '100 pieces',
  'Alibaba,Made-in-China', 2, NOW())
ON CONFLICT (hs4) DO UPDATE SET
  total_suppliers=EXCLUDED.total_suppliers, fob_lowest_usd=EXCLUDED.fob_lowest_usd,
  fob_highest_usd=EXCLUDED.fob_highest_usd, fob_typical_usd=EXCLUDED.fob_typical_usd,
  completed_at=NOW();
-- → trg_phase2_sync fires → research_codes.phase2_status='DONE'
```

### Step 3: Phase 3 IndiaMART Demand (Chrome agent)
```sql
INSERT INTO phase3_indiamart_summary (hs4, keywords_searched, total_sellers,
  manufacturer_pct, trader_pct, price_low_inr, price_high_inr, price_typical_inr,
  top_cities, fob_typical_usd, landed_cost_inr, sell_price_inr,
  gross_margin_pct, gross_margin_inr, data_sources_used, source_count, completed_at)
VALUES ('XXXX', 3, 1250, 45.0, 55.0, 500, 25000, 8000,
  'Delhi,Mumbai,Bangalore', 45.00, 5200, 8000,
  35.0, 2800, 'IndiaMART,TradeIndia', 2, NOW())
ON CONFLICT (hs4) DO UPDATE SET
  total_sellers=EXCLUDED.total_sellers, gross_margin_pct=EXCLUDED.gross_margin_pct,
  completed_at=NOW();
-- → trg_phase3_sync fires → current_phase='qa_pending'
-- → trg_auto_qa fires → qa_status set, trading_model classified
-- → trg_auto_phase5_score fires → phase5_scoring row created (12 dimensions)
-- → trg_phase5_sync fires → research_codes.phase5_status='DONE'
-- → Dashboard: ALL 9 tabs update in real-time
```

**That's it. Three INSERTs and the entire dashboard populates for a new code.**

---

## CURRENT STATUS (2026-03-24)

| Metric | Count |
|---|---|
| Total codes in pipeline | 180 |
| Phase 2b regulatory completed | 3 |
| Phase 2 Alibaba completed | 3 |
| Phase 3 IndiaMART completed | 3 |
| Phase 5 scored | 3 |
| QA passed | 3 |
| Remaining to research | 177 |

---

## ARCHITECTURE DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────┐
│                    RESEARCH PIPELINE (per HS4 code)                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WebSearch Agent          Chrome Agent            Chrome Agent        │
│  ┌─────────────┐         ┌─────────────┐        ┌──────────────┐    │
│  │ Phase 2b    │         │ Phase 2     │        │ Phase 3      │    │
│  │ Regulatory  │         │ Alibaba     │        │ IndiaMART    │    │
│  │ 13 checks   │         │ 3 keywords  │        │ 3 keywords   │    │
│  └──────┬──────┘         └──────┬──────┘        └──────┬───────┘    │
│         │                       │                       │            │
│         ▼                       ▼                       ▼            │
│  ┌─────────────┐         ┌─────────────┐        ┌──────────────┐    │
│  │ phase2b_    │         │ phase2_     │        │ phase3_      │    │
│  │ regulatory  │         │ alibaba_    │        │ indiamart_   │    │
│  │ (65 cols)   │         │ summary     │        │ summary      │    │
│  │             │         │ (34 cols)   │        │ (34 cols)    │    │
│  └──────┬──────┘         └──────┬──────┘        └──────┬───────┘    │
│         │                       │                       │            │
│    trg_phase2b_sync       trg_phase2_sync        trg_phase3_sync    │
│         │                       │                       │            │
│         └───────────┬───────────┘                       │            │
│                     ▼                                   ▼            │
│              ┌─────────────────────────────────────────────┐         │
│              │          research_codes (32 cols)           │         │
│              │  phase2b_status, phase2_status, phase3_status│        │
│              │  current_phase → 'qa_pending'               │         │
│              └─────────────────┬───────────────────────────┘         │
│                                │                                     │
│                          trg_auto_qa                                 │
│                                │                                     │
│                                ▼                                     │
│              ┌─────────────────────────────────────────────┐         │
│              │  QA Gate: 2 hard kills + 9 soft warnings   │         │
│              │  Trading Model: REGULAR/SPOT/BROKER/MIXED  │         │
│              └─────────────────┬───────────────────────────┘         │
│                                │                                     │
│                     trg_auto_phase5_score                            │
│                                │                                     │
│                                ▼                                     │
│              ┌─────────────────────────────────────────────┐         │
│              │     phase5_scoring (38 cols)                │         │
│              │  12 dimensions, 150 pts, verdict            │         │
│              └─────────────────┬───────────────────────────┘         │
│                                │                                     │
│                         trg_phase5_sync                              │
│                                │                                     │
│                                ▼                                     │
│              ┌─────────────────────────────────────────────┐         │
│              │  research_codes.phase5_status = 'DONE'     │         │
│              │  research_codes.final_verdict = verdict     │         │
│              │  research_codes.current_phase = 'COMPLETE'  │         │
│              └─────────────────────────────────────────────┘         │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                     REACT DASHBOARD (auto-refresh)                   │
│                                                                      │
│  supabase.channel('electronics_changes')                            │
│    .on('postgres_changes', table: 'research_codes')                 │
│    .on('postgres_changes', table: 'phase2b_regulatory')             │
│    .on('postgres_changes', table: 'phase2_alibaba_summary')         │
│    .on('postgres_changes', table: 'phase3_indiamart_summary')       │
│    .on('postgres_changes', table: 'phase5_scoring')                 │
│                                                                      │
│  Any change → fetchData() → re-render all 9 tabs → 1-2s delay      │
└──────────────────────────────────────────────────────────────────────┘
```
