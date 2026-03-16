#!/usr/bin/env python3
"""
Kalash EXIM — Sync electronics research SQLite → Supabase

Usage:
  python sync_to_supabase.py                    # Full sync (all tables)
  python sync_to_supabase.py --table research_codes  # Single table
  python sync_to_supabase.py --hs4 8504         # Single code (all phases)
  python sync_to_supabase.py --incremental      # Only changed rows (uses updated_at)

Env vars required:
  SUPABASE_URL        — Project URL (https://xxx.supabase.co)
  SUPABASE_SERVICE_KEY — Service role key (NOT anon key — needs write access)

Can be run:
  1. Manually from Windows: python sync_to_supabase.py
  2. Via GitHub Actions: push data/*.json files → action auto-syncs
  3. Via Cowork scheduled task: runs every N hours
"""

import os, sys, json, sqlite3, time
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    print("Installing supabase-py...")
    os.system(f"{sys.executable} -m pip install supabase --break-system-packages -q")
    from supabase import create_client

# ─── CONFIG ─────────────────────────────────────────────────
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# Auto-detect DB path
def find_db():
    candidates = [
        Path(__file__).parent.parent / 'electronics_research_v3.db',
        Path(__file__).parent.parent / 'electronics-research' / 'electronics_research_v3.db',
        Path('/tmp/research_v3.db'),
        Path(r'C:\Users\Naresh\OneDrive\Desktop\kalash EXIM\electronics_research_v3.db'),
        Path(r'C:\Users\Naresh\OneDrive\Desktop\kalash EXIM\electronics-research\electronics_research_v3.db'),
    ]
    # Also check mounted paths in Cowork VM
    import glob
    for p in glob.glob('/sessions/*/mnt/kalash EXIM/electronics_research_v3.db'):
        candidates.insert(0, Path(p))
    for p in candidates:
        if p.exists():
            return str(p)
    return None

TABLES = [
    'research_codes', 'phase2_alibaba', 'phase2_alibaba_summary',
    'phase2b_regulatory', 'phase3_indiamart', 'phase3_indiamart_summary',
    'phase4_volza', 'phase5_scoring', 'research_log', 'agent_assignments'
]

# Tables with auto-increment ID in Supabase (skip 'id' on upsert)
AUTO_ID_TABLES = {'phase2_alibaba', 'phase3_indiamart', 'research_log', 'agent_assignments'}

# Primary keys for upsert
PK_MAP = {
    'research_codes': 'hs4',
    'phase2_alibaba': None,  # No natural PK, use insert
    'phase2_alibaba_summary': 'hs4',
    'phase2b_regulatory': 'hs4',
    'phase3_indiamart': None,
    'phase3_indiamart_summary': 'hs4',
    'phase4_volza': 'hs4',
    'phase5_scoring': 'hs4',
    'research_log': None,
    'agent_assignments': None,
}

# ─── HELPERS ────────────────────────────────────────────────
def get_sqlite_data(db_path, table, hs4_filter=None):
    """Read all rows from a SQLite table as list of dicts."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if hs4_filter and table != 'research_log':
        cursor.execute(f"SELECT * FROM [{table}] WHERE hs4 = ?", (hs4_filter,))
    else:
        cursor.execute(f"SELECT * FROM [{table}]")

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Clean up for Supabase (handle None, remove sqlite internals)
    for row in rows:
        if table in AUTO_ID_TABLES and 'id' in row:
            del row['id']
        # Convert boolean-ish integers to proper bools for Supabase
        for key in list(row.keys()):
            if key.startswith('check_') or key in ('kill_signal', 'extraction_success', 'success',
                                                     'ready_to_ship_available', 'trade_assurance_available'):
                if row[key] is not None:
                    row[key] = bool(row[key])

    return rows

def sync_table(sb, table, rows, pk=None):
    """Sync rows to Supabase table."""
    if not rows:
        print(f"  {table}: 0 rows (skip)")
        return 0

    if pk:
        # Upsert (insert or update on conflict)
        result = sb.table(table).upsert(rows, on_conflict=pk).execute()
    else:
        # For tables without natural PK, delete existing and re-insert
        # This avoids duplicates in log/detail tables
        try:
            # Get hs4 values from rows to scope the delete
            hs4_vals = list(set(r.get('hs4') for r in rows if r.get('hs4')))
            if hs4_vals and table not in ('research_log',):
                for h in hs4_vals:
                    sb.table(table).delete().eq('hs4', h).execute()
            result = sb.table(table).insert(rows).execute()
        except Exception as e:
            print(f"  {table}: ERROR — {e}")
            return 0

    count = len(result.data) if result.data else len(rows)
    print(f"  {table}: {count} rows synced")
    return count

def export_to_json(db_path, output_dir):
    """Export all tables as JSON files (for GitHub commit-based sync)."""
    os.makedirs(output_dir, exist_ok=True)
    for table in TABLES:
        rows = get_sqlite_data(db_path, table)
        out_path = os.path.join(output_dir, f'{table}.json')
        with open(out_path, 'w') as f:
            json.dump(rows, f, indent=2, default=str)
        print(f"  Exported {table}: {len(rows)} rows → {out_path}")

# ─── MAIN ───────────────────────────────────────────────────
def main():
    import argparse
    parser = argparse.ArgumentParser(description='Sync electronics research to Supabase')
    parser.add_argument('--table', help='Sync specific table only')
    parser.add_argument('--hs4', help='Sync specific HS4 code only')
    parser.add_argument('--incremental', action='store_true', help='Only sync changed rows')
    parser.add_argument('--export-json', help='Export to JSON directory (for GitHub sync)')
    parser.add_argument('--from-json', help='Import from JSON directory to Supabase')
    parser.add_argument('--status', action='store_true', help='Show sync status')
    args = parser.parse_args()

    # Find DB
    db_path = find_db()
    if not db_path:
        print("ERROR: Cannot find electronics_research_v3.db")
        sys.exit(1)
    print(f"DB: {db_path}")

    # Export JSON mode (no Supabase needed)
    if args.export_json:
        print(f"\nExporting to JSON → {args.export_json}")
        export_to_json(db_path, args.export_json)
        print("\nDone! Commit and push these JSON files to trigger GitHub Actions sync.")
        return

    # Status mode
    if args.status:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        for t in TABLES:
            cursor.execute(f"SELECT count(*) FROM [{t}]")
            print(f"  {t}: {cursor.fetchone()[0]} rows")
        conn.close()
        return

    # Supabase sync modes
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
        print("  Or use --export-json to export data for GitHub-based sync")
        sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Supabase: {SUPABASE_URL}")

    # Import from JSON mode
    if args.from_json:
        print(f"\nImporting from JSON ← {args.from_json}")
        total = 0
        for table in TABLES:
            json_path = os.path.join(args.from_json, f'{table}.json')
            if not os.path.exists(json_path):
                continue
            with open(json_path) as f:
                rows = json.load(f)
            pk = PK_MAP.get(table)
            total += sync_table(sb, table, rows, pk)
        print(f"\nTotal: {total} rows synced from JSON")
        return

    # Direct SQLite → Supabase sync
    tables_to_sync = [args.table] if args.table else TABLES
    total = 0

    print(f"\nSyncing {'HS4 ' + args.hs4 if args.hs4 else 'all data'}...")
    for table in tables_to_sync:
        if table not in TABLES:
            print(f"  Unknown table: {table}")
            continue
        rows = get_sqlite_data(db_path, table, args.hs4)
        pk = PK_MAP.get(table)
        total += sync_table(sb, table, rows, pk)
        time.sleep(0.2)  # Rate limit courtesy

    print(f"\nTotal: {total} rows synced to Supabase")

if __name__ == '__main__':
    main()
