#!/usr/bin/env python3
"""
Future-Proof Flask API Server for Kalash EXIM Dashboard
- Dynamic schema discovery: new tables/columns automatically exposed
- Generic /api/table/<table_name> endpoint for any table
- Automatic /api/schema endpoint showing all table metadata
- All specialized endpoints preserved for complex aggregations
- Port 8080, CORS enabled, debug=True
"""
import sqlite3
import json
import os
import sys
import traceback
import pathlib
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Robust DB path detection ──
def find_db():
    """Try multiple paths to find the database file"""
    script_dir = pathlib.Path(__file__).resolve().parent
    candidates = [
        # Same folder as server.py (most reliable)
        script_dir / 'kalash_exim_v3.db',
        pathlib.Path.cwd() / 'kalash_exim_v3.db',
        # Parent folder (kalash EXIM contains kalash-dashboard)
        script_dir.parent / 'kalash_exim_v3.db',
        # Sibling folder or subfolder patterns
        script_dir / '..' / 'kalash_exim_v3.db',
        script_dir / '..' / 'kalash EXIM' / 'kalash_exim_v3.db',
        script_dir.parent / 'kalash EXIM' / 'kalash_exim_v3.db',
        pathlib.Path.cwd() / '..' / 'kalash EXIM' / 'kalash_exim_v3.db',
        pathlib.Path.cwd() / 'kalash EXIM' / 'kalash_exim_v3.db',
    ]
    # Also search common Windows paths
    home = pathlib.Path.home()
    for sub in ['Documents', 'Desktop', 'Downloads', 'OneDrive/Documents', 'OneDrive']:
        candidates.append(home / sub / 'kalash EXIM' / 'kalash_exim_v3.db')

    for p in candidates:
        resolved = p.resolve()
        if resolved.exists():
            print(f"[DB FOUND] {resolved}")
            return str(resolved)

    print("[DB NOT FOUND] Searched paths:")
    for p in candidates:
        print(f"  {p.resolve()} -> exists={p.resolve().exists()}")
    return None


DB_PATH = find_db()


def get_db():
    """Get database connection with Row factory for dict-like access"""
    if not DB_PATH:
        raise Exception("Database file not found! Place kalash_exim_v3.db in the 'kalash EXIM' folder next to 'kalash-dashboard'")
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def q(sql, params=None):
    """Execute query and return all rows as list of dicts"""
    db = get_db()
    try:
        rows = db.execute(sql, params or []).fetchall()
        return [dict(r) for r in rows]
    finally:
        db.close()


def q1(sql, params=None):
    """Execute query and return first row as dict"""
    db = get_db()
    try:
        r = db.execute(sql, params or []).fetchone()
        return dict(r) if r else {}
    finally:
        db.close()


def safe(fn):
    """Decorator for safe endpoint execution with error logging"""
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': str(e), 'endpoint': fn.__name__}), 500
    wrapper.__name__ = fn.__name__
    return wrapper


# ════════════════════════════════════════════════════════════════════════════
# FUTURE-PROOF GENERIC ENDPOINTS (NEW)
# ════════════════════════════════════════════════════════════════════════════

@app.route('/api/schema')
@safe
def schema():
    """
    Returns complete database schema: all tables with columns, types, and row counts.
    Allows frontend to auto-discover new tables/columns without API changes.
    """
    db = get_db()
    try:
        # Get all tables
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]

        schema_data = {'tables': []}
        for table in tables:
            # Get row count
            count = db.execute(f'SELECT COUNT(*) FROM [{table}]').fetchone()[0]

            # Get column info
            cols_info = db.execute(f"PRAGMA table_info({table})").fetchall()
            columns = []
            for col_id, name, type_, notnull, default, pk in cols_info:
                columns.append({
                    'name': name,
                    'type': type_,
                    'notnull': bool(notnull),
                    'pk': bool(pk)
                })

            schema_data['tables'].append({
                'name': table,
                'row_count': count,
                'columns': columns
            })

        return jsonify(schema_data)
    finally:
        db.close()


@app.route('/api/table/<table_name>')
@safe
def generic_table(table_name):
    """
    Generic paginated endpoint for ANY table.
    Query params:
    - page: page number (default 1)
    - per_page: rows per page (default 100, max 1000)
    - search: search term (searches all text columns)
    - sort: column name to sort by
    - order: asc or desc (default asc)
    - filter_col=value: filter by exact column value

    Returns: {data: [...], page, per_page, total, total_pages}
    """
    # Validate table name (prevent SQL injection)
    db = get_db()
    try:
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table_name])
        if not cursor.fetchone():
            return jsonify({'error': f'Table {table_name} not found'}), 404
    finally:
        db.close()

    # Parse query params
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(1000, max(1, int(request.args.get('per_page', 100))))
    search = request.args.get('search', '').strip()
    sort = request.args.get('sort', '').strip()
    order = request.args.get('order', 'asc').lower()
    if order not in ('asc', 'desc'):
        order = 'asc'

    offset = (page - 1) * per_page

    # Build query
    db = get_db()
    try:
        # Get total count
        total = db.execute(f'SELECT COUNT(*) FROM [{table_name}]').fetchone()[0]

        # Build WHERE clause
        where_clauses = []
        params = []

        if search:
            # Get text columns
            cols = db.execute(f"PRAGMA table_info({table_name})").fetchall()
            text_cols = [col[1] for col in cols if col[2].upper() in ('TEXT', 'VARCHAR')]
            if text_cols:
                search_conditions = [f'[{col}] LIKE ?' for col in text_cols]
                where_clauses.append('(' + ' OR '.join(search_conditions) + ')')
                params.extend([f'%{search}%'] * len(text_cols))

        # Add filter_col=value params
        for key, value in request.args.items():
            if key.startswith('filter_'):
                col = key[7:]  # Remove 'filter_' prefix
                where_clauses.append(f'[{col}] = ?')
                params.append(value)

        where_sql = ''
        if where_clauses:
            where_sql = ' WHERE ' + ' AND '.join(where_clauses)

        # Build ORDER BY
        order_sql = ''
        if sort:
            # Verify column exists
            cols = db.execute(f"PRAGMA table_info({table_name})").fetchall()
            col_names = [col[1] for col in cols]
            if sort in col_names:
                order_sql = f' ORDER BY [{sort}] {order}'

        # Execute query
        sql = f'SELECT * FROM [{table_name}]{where_sql}{order_sql} LIMIT ? OFFSET ?'
        params.extend([per_page, offset])
        rows = db.execute(sql, params).fetchall()
        data = [dict(r) for r in rows]

        total_pages = (total + per_page - 1) // per_page

        return jsonify({
            'data': data,
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': total_pages,
            'table': table_name
        })
    finally:
        db.close()


@app.route('/api/table/<table_name>/columns')
@safe
def table_columns(table_name):
    """
    Returns column metadata for a specific table.
    Used by frontend to auto-build filter/sort UI.
    """
    db = get_db()
    try:
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table_name])
        if not cursor.fetchone():
            return jsonify({'error': f'Table {table_name} not found'}), 404

        cols = db.execute(f"PRAGMA table_info({table_name})").fetchall()
        columns = []
        for col_id, name, type_, notnull, default, pk in cols:
            columns.append({
                'name': name,
                'type': type_,
                'notnull': bool(notnull),
                'pk': bool(pk),
                'id': col_id
            })

        return jsonify({'table': table_name, 'columns': columns})
    finally:
        db.close()


@app.route('/api/table/<table_name>/stats')
@safe
def table_stats(table_name):
    """
    Auto-compute statistics for numeric columns in a table.
    Returns min, max, avg, sum for all numeric columns.
    """
    db = get_db()
    try:
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table_name])
        if not cursor.fetchone():
            return jsonify({'error': f'Table {table_name} not found'}), 404

        cols = db.execute(f"PRAGMA table_info({table_name})").fetchall()
        numeric_cols = [col[1] for col in cols if col[2].upper() in ('INTEGER', 'REAL', 'NUMERIC')]

        stats = {}
        for col in numeric_cols:
            result = db.execute(f'''
                SELECT
                    MIN([{col}]) as min_val,
                    MAX([{col}]) as max_val,
                    AVG([{col}]) as avg_val,
                    SUM([{col}]) as sum_val,
                    COUNT([{col}]) as count_val
                FROM [{table_name}]
            ''').fetchone()

            if result:
                stats[col] = {
                    'min': result[0],
                    'max': result[1],
                    'avg': round(result[2], 2) if result[2] is not None else None,
                    'sum': round(result[3], 2) if result[3] is not None else None,
                    'count': result[4]
                }

        return jsonify({'table': table_name, 'stats': stats})
    finally:
        db.close()


@app.route('/api/table/<table_name>/distinct/<column>')
@safe
def table_distinct(table_name, column):
    """
    Get distinct values for a column (for building filter dropdowns).
    Query params:
    - limit: max distinct values to return (default 1000)
    - search: filter distinct values by substring
    """
    db = get_db()
    try:
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table_name])
        if not cursor.fetchone():
            return jsonify({'error': f'Table {table_name} not found'}), 404

        # Verify column exists
        cols = db.execute(f"PRAGMA table_info({table_name})").fetchall()
        col_names = [col[1] for col in cols]
        if column not in col_names:
            return jsonify({'error': f'Column {column} not found in table {table_name}'}), 404

        limit = min(10000, int(request.args.get('limit', 1000)))
        search = request.args.get('search', '').strip()

        # Build query
        where_sql = ''
        params = []
        if search:
            where_sql = f" WHERE [{column}] LIKE ?"
            params.append(f'%{search}%')

        sql = f'SELECT DISTINCT [{column}] FROM [{table_name}]{where_sql} ORDER BY [{column}] LIMIT ?'
        params.append(limit)

        rows = db.execute(sql, params).fetchall()
        distinct_values = [row[0] for row in rows]

        return jsonify({
            'table': table_name,
            'column': column,
            'distinct_values': distinct_values,
            'count': len(distinct_values)
        })
    finally:
        db.close()


@app.route('/api/business_intel')
@safe
def business_intel():
    """
    Aggregate business intelligence from margin_analysis and shortlist.
    Shows margins, expected turnover, expected profits.
    """
    # Get margin analysis
    margins = q('SELECT * FROM margin_analysis')

    # Get shortlist with verdicts
    shortlist = q('''SELECT hs4, commodity, verdict, drill_score, val_latest,
                     pipeline_stage FROM shortlist ORDER BY drill_score DESC''')

    # Aggregate
    total_margin_value = sum(float(m.get('real_margin_pct', 0) or 0) for m in margins)
    avg_margin = total_margin_value / len(margins) if margins else 0

    pass_count = sum(1 for s in shortlist if s.get('verdict') == 'PASS')
    maybe_count = sum(1 for s in shortlist if s.get('verdict') == 'MAYBE')

    pass_items = [s for s in shortlist if s.get('verdict') == 'PASS']
    total_pass_value = sum(float(s.get('val_latest', 0) or 0) for s in pass_items)

    return jsonify({
        'margin_analysis': {
            'total_records': len(margins),
            'avg_margin_pct': round(avg_margin, 2),
            'records': margins
        },
        'shortlist_summary': {
            'total': len(shortlist),
            'pass': pass_count,
            'maybe': maybe_count,
            'drop': sum(1 for s in shortlist if s.get('verdict') == 'DROP'),
            'total_pass_value_m': round(total_pass_value, 2),
            'top_pass_items': pass_items[:10]
        }
    })


# ════════════════════════════════════════════════════════════════════════════
# ORIGINAL SPECIALIZED ENDPOINTS (PRESERVED)
# ════════════════════════════════════════════════════════════════════════════

# ── Health check ──
@app.route('/api/health')
def health():
    try:
        cnt = q1('SELECT count(*) as c FROM hs4_scored')
        return jsonify({'status': 'ok', 'db': DB_PATH, 'hs4_count': cnt.get('c', 0)})
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e), 'db_path': DB_PATH}), 500

# ── /api/overview ──
@app.route('/api/overview')
@safe
def overview():
    counts = {
        'hs8_raw': q1('SELECT count(*) as c FROM hs8_raw').get('c', 0),
        'hs4_scored': q1('SELECT count(*) as c FROM hs4_scored').get('c', 0),
        'hs2_scored': q1('SELECT count(*) as c FROM hs2_scored').get('c', 0),
        'shortlist': q1('SELECT count(*) as c FROM shortlist').get('c', 0),
        'volza_shipments': q1('SELECT count(*) as c FROM volza_shipments').get('c', 0),
        'volza_buyers': q1('SELECT count(*) as c FROM volza_buyers').get('c', 0),
        'target_buyers': q1('SELECT count(*) as c FROM target_buyers').get('c', 0),
        'margin_analysis': q1('SELECT count(*) as c FROM margin_analysis').get('c', 0),
        'verdict_breakdown': {}
    }
    for row in q('SELECT verdict, count(*) as c FROM hs4_scored GROUP BY verdict'):
        counts['verdict_breakdown'][row['verdict']] = row['c']

    stages = q('SELECT * FROM pipeline_stages ORDER BY stage')
    return jsonify({'counts': counts, 'pipeline_stages': stages})

# ── /api/pipeline_journey ──
@app.route('/api/pipeline_journey')
@safe
def pipeline_journey():
    stages = q('SELECT * FROM pipeline_stages ORDER BY stage')
    funnel = []
    for s in stages:
        cnt = q1('SELECT count(*) as c FROM shortlist WHERE pipeline_stage=?', [s['stage']]).get('c', 0)
        funnel.append({**s, 'count': cnt})

    decisions = {
        'pursue': q('SELECT hs4, commodity, drill_score, verdict FROM shortlist WHERE verdict="PASS" ORDER BY drill_score DESC LIMIT 20'),
        'marginal': q('SELECT hs4, commodity, drill_score, verdict FROM shortlist WHERE verdict="MAYBE" ORDER BY drill_score DESC LIMIT 20'),
        'avoid': q('SELECT hs4, commodity, drill_score, verdict FROM hs4_scored WHERE verdict IN ("DROP","WATCH") ORDER BY drill_score DESC LIMIT 10')
    }

    insights = []
    top = q('SELECT hs4, commodity, drill_score FROM shortlist WHERE verdict="PASS" ORDER BY drill_score DESC LIMIT 3')
    for t in top:
        score = t.get('drill_score', 0) or 0
        insights.append({'type': 'top', 'hs4': t['hs4'], 'title': f"Top scorer: {t['commodity']}", 'detail': f"Score {score:.1f}"})

    margins = q('SELECT hs4, real_margin_pct, key_products FROM margin_analysis WHERE real_margin_pct > 0')
    for m in margins:
        pct = m.get('real_margin_pct', 0) or 0
        insights.append({'type': 'margin', 'hs4': m['hs4'], 'title': f"Positive margin: {m.get('key_products','')}", 'detail': f"{pct:.1f}% margin"})

    return jsonify({'funnel': funnel, 'decisions': decisions, 'key_insights': insights})

# ── /api/shortlist ──
@app.route('/api/shortlist')
@safe
def shortlist():
    rows = q('''SELECT hs4, hs2, commodity, category, drill_score as score,
                verdict, entry_tier, val_latest as value_m, growth_1yr as growth,
                hs8_count, bcd_rate as bcd, pipeline_stage, notes
                FROM shortlist ORDER BY drill_score DESC''')
    return jsonify({'products': rows})

# ── /api/hs2_analysis ──
@app.route('/api/hs2_analysis')
@safe
def hs2_analysis():
    rows = q('''SELECT hs2, description, hs4_count, hs8_count, total_val,
                avg_val, avg_growth, avg_china_pct, pts_value, pts_combined,
                pts_middleman, pts_pipeline, pts_dominance, pts_depth,
                chapter_score, verdict, verdict_reason, goods_type
                FROM hs2_scored ORDER BY chapter_score DESC''')
    return jsonify({'chapters': rows})

# ── /api/hs4_top ──
@app.route('/api/hs4_top')
@safe
def hs4_top():
    rows = q('''SELECT hs4, hs2, commodity, category, drill_score as score,
                verdict, entry_tier, val_2024_25 as value_m, growth_1yr as growth,
                hs8_count, bcd_rate as bcd, china_pct, chapter_desc,
                pts_combined, pts_value, pts_duty, pts_regulatory,
                pts_growth, pts_depth, pts_strategic, pts_submarket,
                hs2_verdict, hs2_score
                FROM hs4_scored ORDER BY drill_score DESC''')
    return jsonify({'top': rows, 'total': len(rows)})

# ── /api/hs6_data (HS6 aggregation from hs8_raw) ──
@app.route('/api/hs6_data')
@safe
def hs6_data():
    """
    Aggregate HS8 data by HS6 level (GROUP BY hs6 only, not hs6+commodity).
    Uses GROUP_CONCAT for commodity names to avoid row explosion.
    """
    rows = q('''
        SELECT
            hs6,
            hs4,
            hs2,
            GROUP_CONCAT(DISTINCT commodity) as commodities,
            COUNT(DISTINCT hs8) as hs8_count,
            ROUND(SUM(COALESCE(val_2024_25,0)),2) as total_val,
            ROUND(SUM(COALESCE(val_2023_24,0)),2) as val_2023_24,
            ROUND(SUM(COALESCE(val_2022_23,0)),2) as val_2022_23,
            ROUND(SUM(COALESCE(val_2021_22,0)),2) as val_2021_22,
            ROUND(AVG(growth_1yr),2) as avg_growth
        FROM hs8_raw
        GROUP BY hs6
        ORDER BY total_val DESC
    ''')
    return jsonify({'hs6_data': rows, 'total': len(rows)})

# ── /api/hs8_raw (all 9300 HS8 products) ──
@app.route('/api/hs8_raw')
@safe
def hs8_raw():
    """
    All raw HS8 level data - uses SELECT * for dynamic column support.
    """
    rows = q('SELECT * FROM hs8_raw ORDER BY val_2024_25 DESC')
    return jsonify({'hs8_raw': rows, 'total': len(rows)})

# ── /api/categories ──
@app.route('/api/categories')
@safe
def categories():
    rows = q('''SELECT category, count(*) as count,
                ROUND(avg(drill_score),1) as avg_score,
                ROUND(sum(val_2024_25),1) as total_value_m,
                sum(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END) as pass_count,
                sum(CASE WHEN verdict='MAYBE' THEN 1 ELSE 0 END) as maybe_count,
                sum(CASE WHEN verdict='DROP' THEN 1 ELSE 0 END) as drop_count,
                sum(CASE WHEN verdict='WATCH' THEN 1 ELSE 0 END) as watch_count
                FROM hs4_scored GROUP BY category ORDER BY avg_score DESC''')
    return jsonify({'categories': rows})

# ── /api/margins ──
@app.route('/api/margins')
@safe
def margins():
    rows = q('SELECT * FROM margin_analysis')
    return jsonify({'margins': rows})

# ── /api/shipments (server-side pagination, filtering, sorting) ──
@app.route('/api/shipments')
@safe
def shipments():
    # Pagination params
    page = request.args.get('page', 0, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 200)  # Cap at 200 per request

    # Sort params
    sort_col = request.args.get('sort', 'cif_value_usd')
    sort_dir = request.args.get('dir', 'desc')
    # Whitelist sortable columns to prevent SQL injection
    allowed_sort = {'id', 'date', 'hs_code', 'hs4', 'product_desc', 'consignee_name',
                    'shipper_name', 'cif_value_usd', 'std_qty', 'unit_rate_usd',
                    'est_unit_rate', 'country_origin', 'port_dest', 'port_origin',
                    'ship_mode', 'consignee_city', 'consignee_state', 'iec',
                    'fta_agreement', 'fta_rate', 'notify_party', 'hs_description',
                    'landed_value_inr', 'tax_inr', 'tax_pct', 'freight_usd',
                    'insurance_usd', 'gross_wt', 'shipper_country', 'shipper_address',
                    'bl_type', 'payment_terms', 'bill_of_entry', 'be_date',
                    'exchange_rate', 'rate_fc', 'rate_currency'}
    if sort_col not in allowed_sort:
        sort_col = 'cif_value_usd'
    if sort_dir not in ('asc', 'desc'):
        sort_dir = 'desc'

    # Filter params
    search = request.args.get('search', '').strip()
    hs4 = request.args.get('hs4', '').strip()
    country = request.args.get('country', '').strip()
    port = request.args.get('port', '').strip()
    ship_mode = request.args.get('ship_mode', '').strip()
    consignee = request.args.get('consignee', '').strip()
    shipper = request.args.get('shipper', '').strip()
    date_from = request.args.get('date_from', '').strip()
    date_to = request.args.get('date_to', '').strip()
    min_cif = request.args.get('min_cif', '', type=str).strip()
    max_cif = request.args.get('max_cif', '', type=str).strip()

    # Build WHERE clause
    conditions = []
    params = []

    if search:
        conditions.append('''(product_desc LIKE ? OR consignee_name LIKE ?
                             OR shipper_name LIKE ? OR hs_code LIKE ? OR iec LIKE ?)''')
        s = f'%{search}%'
        params.extend([s, s, s, s, s])
    if hs4:
        conditions.append('hs4 = ?')
        params.append(hs4)
    if country:
        conditions.append('country_origin = ?')
        params.append(country)
    if port:
        conditions.append('port_dest = ?')
        params.append(port)
    if ship_mode:
        conditions.append('ship_mode = ?')
        params.append(ship_mode)
    if consignee:
        conditions.append('consignee_name LIKE ?')
        params.append(f'%{consignee}%')
    if shipper:
        conditions.append('shipper_name LIKE ?')
        params.append(f'%{shipper}%')
    if date_from:
        conditions.append('date >= ?')
        params.append(date_from)
    if date_to:
        conditions.append('date <= ?')
        params.append(date_to)
    if min_cif:
        try:
            conditions.append('cif_value_usd >= ?')
            params.append(float(min_cif))
        except ValueError:
            pass
    if max_cif:
        try:
            conditions.append('cif_value_usd <= ?')
            params.append(float(max_cif))
        except ValueError:
            pass

    where = ''
    if conditions:
        where = 'WHERE ' + ' AND '.join(conditions)

    # Get filtered count
    count_sql = f'SELECT count(*) as c FROM volza_shipments {where}'
    filtered_total = q1(count_sql, params).get('c', 0)

    # Get total (unfiltered)
    total = q1('SELECT count(*) as c FROM volza_shipments').get('c', 0)

    # Get page of results — return ALL 45 columns
    offset = page * page_size
    data_sql = f'''SELECT * FROM volza_shipments {where}
                   ORDER BY {sort_col} {sort_dir}
                   LIMIT ? OFFSET ?'''
    rows = q(data_sql, params + [page_size, offset])

    return jsonify({
        'shipments': rows,
        'total': total,
        'filtered_total': filtered_total,
        'page': page,
        'page_size': page_size,
        'total_pages': max(1, -(-filtered_total // page_size))  # ceil div
    })


# ── /api/shipment_filters (distinct values for dropdowns) ──
@app.route('/api/shipment_filters')
@safe
def shipment_filters():
    hs4_codes = q('SELECT DISTINCT hs4 FROM volza_shipments WHERE hs4 IS NOT NULL ORDER BY hs4')
    countries = q("SELECT DISTINCT country_origin FROM volza_shipments WHERE country_origin IS NOT NULL AND country_origin != '' ORDER BY country_origin")
    ports = q("SELECT DISTINCT port_dest FROM volza_shipments WHERE port_dest IS NOT NULL AND port_dest != '' ORDER BY port_dest")
    ship_modes = q("SELECT DISTINCT ship_mode FROM volza_shipments WHERE ship_mode IS NOT NULL AND ship_mode != '' ORDER BY ship_mode")
    consignees = q('''SELECT consignee_name, COUNT(*) as cnt FROM volza_shipments
                      WHERE consignee_name IS NOT NULL AND consignee_name != ''
                      GROUP BY consignee_name ORDER BY cnt DESC LIMIT 200''')
    shippers = q('''SELECT shipper_name, COUNT(*) as cnt FROM volza_shipments
                    WHERE shipper_name IS NOT NULL AND shipper_name != ''
                    GROUP BY shipper_name ORDER BY cnt DESC LIMIT 200''')
    return jsonify({
        'hs4_codes': [r['hs4'] for r in hs4_codes],
        'countries': [r['country_origin'] for r in countries],
        'ports': [r['port_dest'] for r in ports],
        'ship_modes': [r['ship_mode'] for r in ship_modes],
        'top_consignees': [{'name': r['consignee_name'], 'count': r['cnt']} for r in consignees],
        'top_shippers': [{'name': r['shipper_name'], 'count': r['cnt']} for r in shippers]
    })


# ── /api/shipment_stats ──
@app.route('/api/shipment_stats')
@safe
def shipment_stats():
    by_hs4 = q('''SELECT hs4, count(*) as shipments,
                  ROUND(sum(cif_value_usd),0) as total_cif,
                  ROUND(avg(unit_rate_usd),2) as avg_rate
                  FROM volza_shipments GROUP BY hs4 ORDER BY total_cif DESC''')
    by_country = q('''SELECT country_origin, count(*) as shipments,
                      ROUND(sum(cif_value_usd),0) as total_cif
                      FROM volza_shipments
                      WHERE country_origin IS NOT NULL AND country_origin != ''
                      GROUP BY country_origin ORDER BY total_cif DESC''')
    by_port = q('''SELECT port_dest, count(*) as shipments,
                   ROUND(sum(cif_value_usd),0) as total_cif
                   FROM volza_shipments
                   WHERE port_dest IS NOT NULL AND port_dest != ''
                   GROUP BY port_dest ORDER BY total_cif DESC''')
    by_month = q('''SELECT substr(date,-8,3) as month, count(*) as shipments,
                    ROUND(sum(cif_value_usd),0) as total_cif
                    FROM volza_shipments
                    WHERE date IS NOT NULL AND date != ''
                    GROUP BY month ORDER BY month''')
    # Top consignees by CIF value
    top_consignees = q('''SELECT consignee_name, count(*) as shipments,
                          ROUND(sum(cif_value_usd),0) as total_cif,
                          ROUND(avg(unit_rate_usd),2) as avg_rate,
                          GROUP_CONCAT(DISTINCT hs4) as hs_codes
                          FROM volza_shipments
                          WHERE consignee_name IS NOT NULL AND consignee_name != ''
                          GROUP BY consignee_name ORDER BY total_cif DESC LIMIT 20''')
    # Top shippers by CIF value
    top_shippers = q('''SELECT shipper_name, count(*) as shipments,
                        ROUND(sum(cif_value_usd),0) as total_cif,
                        ROUND(avg(unit_rate_usd),2) as avg_rate,
                        GROUP_CONCAT(DISTINCT hs4) as hs_codes
                        FROM volza_shipments
                        WHERE shipper_name IS NOT NULL AND shipper_name != ''
                        GROUP BY shipper_name ORDER BY total_cif DESC LIMIT 20''')
    return jsonify({
        'by_hs4': by_hs4, 'by_country': by_country,
        'by_port': by_port, 'by_month': by_month,
        'top_consignees': top_consignees, 'top_shippers': top_shippers
    })

# ── /api/buyers ──
@app.route('/api/buyers')
@safe
def buyers():
    rows = q('''SELECT company_name, iec, consignee_id, shipment_count,
                total_cif_usd, avg_unit_rate, hs_codes, city, state, address,
                shippers, shipper_count, china_shipments, china_pct,
                is_middleman, middleman_score, classification, pipeline_stage,
                volza_verified, notes, verified_classification, company_notes, is_target
                FROM volza_buyers ORDER BY total_cif_usd DESC''')
    return jsonify({'buyers': rows, 'total': len(rows)})

# ── /api/targets ──
@app.route('/api/targets')
@safe
def targets():
    rows = q('SELECT * FROM target_buyers ORDER BY priority, pipeline_stage DESC')
    return jsonify({'targets': rows})

# ── /api/importers ──
@app.route('/api/importers')
@safe
def importers():
    rows = q('SELECT * FROM importers ORDER BY middleman_score DESC')
    return jsonify({'importers': rows})

# ── /api/scoring_config ──
@app.route('/api/scoring_config')
@safe
def scoring_config():
    rows = q('SELECT * FROM scoring_config ORDER BY phase, max_points DESC')
    return jsonify({'scoring_config': rows})

# ── /api/all_hs4 (full data for comprehensive view) ──
@app.route('/api/all_hs4')
@safe
def all_hs4():
    rows = q('SELECT * FROM hs4_scored ORDER BY drill_score DESC')
    return jsonify({'products': rows, 'total': len(rows)})


# ════════════════════════════════════════════════════════════════════════════
# STARTUP DIAGNOSTICS
# ════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print(f"\n{'='*80}")
    print(f"  KALASH EXIM DASHBOARD API SERVER (FUTURE-PROOF)")
    print(f"{'='*80}")
    print(f"  Database Path: {DB_PATH}")
    print(f"  Script Directory: {pathlib.Path(__file__).resolve().parent}")
    print(f"  Current Working Directory: {pathlib.Path.cwd()}")

    if DB_PATH:
        print(f"  DB Exists: {os.path.exists(DB_PATH)}")
        try:
            db = sqlite3.connect(DB_PATH)
            tables = db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
            print(f"\n  Tables ({len(tables)}):")
            for t in tables:
                cnt = db.execute(f'SELECT count(*) FROM [{t[0]}]').fetchone()[0]
                print(f"    ├─ {t[0]:30} {cnt:>10,} rows")

            # Show detailed schema for key tables
            print(f"\n  Key Tables Schema:")
            for table in ['hs8_raw', 'hs4_scored', 'hs2_scored', 'shortlist']:
                if any(t[0] == table for t in tables):
                    cols = db.execute(f"PRAGMA table_info({table})").fetchall()
                    col_names = [c[1] for c in cols]
                    print(f"    ├─ {table}:")
                    for col in col_names[:8]:
                        print(f"    │  • {col}")
                    if len(col_names) > 8:
                        print(f"    │  ... and {len(col_names) - 8} more columns")

            db.close()
        except Exception as e:
            print(f"  [DB ERROR] {e}")
    else:
        print(f"  [ERROR] Database not found!")
        print(f"  Place kalash_exim_v3.db in the parent 'kalash EXIM' folder")

    print(f"\n  API ENDPOINTS (Future-Proof Generic):")
    print(f"    ├─ GET /api/schema")
    print(f"    │  → Complete database schema with all tables/columns/types")
    print(f"    ├─ GET /api/table/<table_name>")
    print(f"    │  → Generic paginated access: ?page=1&per_page=100&search=term&sort=col&order=desc")
    print(f"    ├─ GET /api/table/<table_name>/columns")
    print(f"    │  → Column metadata for UI generation")
    print(f"    ├─ GET /api/table/<table_name>/stats")
    print(f"    │  → Auto-compute min/max/avg/sum for numeric columns")
    print(f"    ├─ GET /api/table/<table_name>/distinct/<column>")
    print(f"    │  → Distinct values for building filter dropdowns")
    print(f"    └─ GET /api/business_intel")
    print(f"       → Aggregate business intelligence (margins + shortlist)")

    print(f"\n  API ENDPOINTS (Original Specialized):")
    specialized = [
        ('GET /api/health', 'Diagnostic health check'),
        ('GET /api/overview', 'KPIs and summary stats'),
        ('GET /api/pipeline_journey', 'Funnel stages, decisions, insights'),
        ('GET /api/shortlist', 'Shortlisted products'),
        ('GET /api/hs2_analysis', 'All 97 HS2 chapters with scoring'),
        ('GET /api/hs4_top', 'All 1123 HS4 products with scoring'),
        ('GET /api/hs6_data', 'HS6 aggregation from hs8_raw'),
        ('GET /api/hs8_raw', 'All 9300 HS8 products (SELECT *)'),
        ('GET /api/categories', 'Category breakdown'),
        ('GET /api/margins', 'Margin analysis'),
        ('GET /api/shipments', 'Volza shipments (limit 500)'),
        ('GET /api/shipment_stats', 'Aggregated shipment statistics'),
        ('GET /api/buyers', 'All 950 buyers'),
        ('GET /api/targets', '12 target buyers'),
        ('GET /api/importers', '54 importers'),
        ('GET /api/scoring_config', 'Scoring methodology'),
        ('GET /api/all_hs4', 'All HS4 data (full detail)'),
    ]
    for endpoint, desc in specialized:
        print(f"    ├─ {endpoint:40} → {desc}")

    print(f"\n  Server: http://localhost:8080")
    print(f"  CORS: Enabled")
    print(f"  Debug: True")
    print(f"\n  Key Design Principles:")
    print(f"    • SELECT * instead of hardcoded columns → auto-discover new columns")
    print(f"    • /api/schema endpoint → frontend auto-discovers all tables")
    print(f"    • /api/table/<table> endpoint → works for ANY table without code changes")
    print(f"    • All new columns/tables automatically exposed via generic endpoints")
    print(f"    • Specialized endpoints preserved for complex aggregations")
    print(f"{'='*80}\n")

    app.run(host='0.0.0.0', port=8080, debug=True)
