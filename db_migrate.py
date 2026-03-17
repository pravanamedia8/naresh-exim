#!/usr/bin/env python3
"""
Kalash EXIM Database Migration Script
Run this to add future-proof columns for business intelligence.
Safe to run multiple times (idempotent).

Usage: python db_migrate.py
"""
import sqlite3, os, sys, pathlib

def find_db():
    script_dir = pathlib.Path(__file__).resolve().parent
    candidates = [
        script_dir / 'kalash_exim_v3.db',
        script_dir.parent / 'kalash_exim_v3.db',
        script_dir / '..' / 'kalash EXIM' / 'kalash_exim_v3.db',
    ]
    for p in candidates:
        if p.resolve().exists():
            return str(p.resolve())
    return None

def add_col(db, table, col, coltype):
    try:
        db.execute(f"ALTER TABLE [{table}] ADD COLUMN [{col}] {coltype}")
        print(f"  + Added {table}.{col} ({coltype})")
        return True
    except Exception as e:
        if "duplicate column" in str(e).lower():
            print(f"  = {table}.{col} already exists")
        else:
            print(f"  ! {table}.{col}: {e}")
        return False

def main():
    db_path = find_db()
    if not db_path:
        print("ERROR: kalash_exim_v3.db not found!")
        print("Place it in the same folder or parent folder as this script.")
        sys.exit(1)

    print(f"Database: {db_path}")
    db = sqlite3.connect(db_path)

    tables = [t[0] for t in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print(f"Existing tables: {len(tables)}")

    print("\n--- Adding columns to hs4_scored ---")
    for col, ctype in [
        ('margin_pct', 'REAL'), ('expected_turnover_usd', 'REAL'), ('expected_profit_yr1_usd', 'REAL'),
        ('market_opportunity', 'TEXT'), ('competition_level', 'TEXT'), ('sourcing_difficulty', 'TEXT'), ('last_updated', 'TEXT')
    ]:
        add_col(db, 'hs4_scored', col, ctype)

    print("\n--- Adding columns to shortlist ---")
    for col, ctype in [
        ('margin_pct', 'REAL'), ('expected_turnover_usd', 'REAL'), ('expected_profit_yr1_usd', 'REAL'),
        ('market_opportunity', 'TEXT'), ('sourcing_status', 'TEXT'), ('supplier_count', 'INTEGER'), ('best_fob_usd', 'REAL'), ('last_updated', 'TEXT')
    ]:
        add_col(db, 'shortlist', col, ctype)

    print("\n--- Adding columns to volza_buyers ---")
    for col, ctype in [
        ('expected_order_value_usd', 'REAL'), ('credit_risk', 'TEXT'), ('relationship_stage', 'TEXT'),
        ('last_contacted', 'TEXT'), ('contact_notes', 'TEXT')
    ]:
        add_col(db, 'volza_buyers', col, ctype)

    print("\n--- Adding columns to margin_analysis ---")
    for col, ctype in [
        ('expected_monthly_volume', 'REAL'), ('expected_annual_turnover_usd', 'REAL'), ('expected_profit_yr1_usd', 'REAL'),
        ('break_even_months', 'INTEGER'), ('roi_pct', 'REAL')
    ]:
        add_col(db, 'margin_analysis', col, ctype)

    print("\n--- Creating business_forecasts table ---")
    try:
        db.execute('''CREATE TABLE IF NOT EXISTS business_forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hs4 TEXT, commodity TEXT, forecast_date TEXT,
            expected_monthly_revenue_usd REAL, expected_monthly_cost_usd REAL, expected_monthly_profit_usd REAL,
            expected_annual_turnover_usd REAL, expected_profit_yr1_usd REAL, margin_pct REAL,
            market_size_usd REAL, addressable_market_pct REAL, confidence_level TEXT,
            assumptions TEXT, created_date TEXT DEFAULT CURRENT_TIMESTAMP
        )''')
        print("  + business_forecasts table ready")
    except Exception as e:
        print(f"  ! {e}")

    print("\n--- Creating scoring_matrix table ---")
    try:
        db.execute('''CREATE TABLE IF NOT EXISTS scoring_matrix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            matrix_name TEXT, is_active INTEGER DEFAULT 0,
            phase TEXT, factor TEXT, max_points REAL, weight REAL DEFAULT 1.0,
            description TEXT, formula TEXT, created_date TEXT DEFAULT CURRENT_TIMESTAMP
        )''')
        print("  + scoring_matrix table ready")
    except Exception as e:
        print(f"  ! {e}")

    cnt = db.execute("SELECT count(*) FROM scoring_matrix").fetchone()[0]
    if cnt == 0 and 'scoring_config' in tables:
        existing = db.execute("SELECT phase, factor, max_points, description FROM scoring_config").fetchall()
        for row in existing:
            db.execute("INSERT INTO scoring_matrix (matrix_name, is_active, phase, factor, max_points, weight, description) VALUES (?,?,?,?,?,?,?)",
                      ('default_v1', 1, row[0], row[1], row[2], 1.0, row[3]))
        print(f"  + Populated scoring_matrix with {len(existing)} rows")

    db.commit()

    print("\n--- Verification ---")
    tables = [t[0] for t in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    for table in sorted(tables):
        if table == 'sqlite_sequence':
            continue
        cols = db.execute(f"PRAGMA table_info([{table}])").fetchall()
        cnt = db.execute(f"SELECT count(*) FROM [{table}]").fetchone()[0]
        print(f"  {table}: {cnt} rows, {len(cols)} columns")

    db.close()
    print("\nMigration complete!")

if __name__ == '__main__':
    main()
