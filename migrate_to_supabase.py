"""Migration script: Migrate NirmanAI SQLite databases to Supabase PostgreSQL.

Reads data from:
1. project_monitoring.db
2. contractors_admin.db
3. reports_photos.db

And creates and populates unified tables in Supabase PostgreSQL.
"""
import os
import sqlite3
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

# Convert psycopg2 URI format if needed for SQLAlchemy
sa_url = DATABASE_URL
if sa_url.startswith("postgresql://"):
    sa_url = sa_url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(sa_url)

DDL_SCHEMA = """
-- Sector baselines
CREATE TABLE IF NOT EXISTS sector_baselines (
    sector TEXT PRIMARY KEY,
    rank INT,
    project_count INT,
    latest_expenditure NUMERIC,
    original_cost NUMERIC,
    anticipated_cost NUMERIC,
    avg_cost_overrun_pct NUMERIC,
    avg_expenditure NUMERIC
);

-- State baselines
CREATE TABLE IF NOT EXISTS state_baselines (
    state TEXT PRIMARY KEY,
    project_count INT,
    avg_cost_overrun_pct NUMERIC
);

-- Monthly state trends
CREATE TABLE IF NOT EXISTS state_monthly_trends (
    state TEXT,
    month TEXT,
    project_count INT,
    original_cost_cr NUMERIC,
    revised_cost_cr NUMERIC,
    expenditure_cr NUMERIC,
    cost_overrun_pct NUMERIC,
    PRIMARY KEY (state, month)
);

-- National trends
CREATE TABLE IF NOT EXISTS national_monthly_trends (
    month TEXT PRIMARY KEY,
    original_cost_cr NUMERIC,
    revised_cost_cr NUMERIC,
    cumulative_expenditure_cr NUMERIC,
    national_cost_overrun_pct NUMERIC
);

-- Progress buckets
CREATE TABLE IF NOT EXISTS progress_buckets (
    month TEXT,
    progress_bucket TEXT,
    project_count INT,
    original_cost_cr NUMERIC,
    revised_cost_cr NUMERIC,
    expenditure_cr NUMERIC,
    cost_overrun_pct NUMERIC,
    PRIMARY KEY (month, progress_bucket)
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    sector TEXT,
    state TEXT,
    sanctioned_cost NUMERIC,
    sanctioned_date TEXT,
    original_end_date TEXT,
    duration_months INT,
    target_cost_overrun_pct NUMERIC,
    real_state_overrun_july NUMERIC,
    real_sector_overrun_pct NUMERIC,
    real_state_drift_pp_month NUMERIC
);

-- Project snapshots
CREATE TABLE IF NOT EXISTS project_snapshots (
    project_id TEXT,
    month TEXT,
    snapshot_date TEXT,
    physical_progress_pct NUMERIC,
    financial_progress_pct NUMERIC,
    cumulative_expenditure NUMERIC,
    revised_cost NUMERIC,
    cost_overrun_to_date_pct NUMERIC,
    revised_end_date TEXT,
    schedule_slip_months NUMERIC,
    PRIMARY KEY (project_id, month)
);

-- Derived ML features
CREATE TABLE IF NOT EXISTS project_features (
    project_id TEXT,
    sector TEXT,
    state TEXT,
    month TEXT,
    snapshot_id TEXT,
    physical_progress_pct NUMERIC,
    financial_progress_pct NUMERIC,
    cost_overrun_to_date_pct NUMERIC,
    schedule_slip_months NUMERIC,
    financial_physical_gap NUMERIC,
    expected_physical_pct NUMERIC,
    physical_schedule_gap NUMERIC,
    expenditure_rate NUMERIC,
    sector_risk_baseline NUMERIC,
    state_risk_baseline NUMERIC,
    prior_risk NUMERIC,
    cost_vs_prior NUMERIC,
    expected_slip NUMERIC,
    slip_vs_expected NUMERIC,
    rem_work NUMERIC,
    burn_ratio NUMERIC
);

-- Risk scores
CREATE TABLE IF NOT EXISTS risk_scores (
    project_id TEXT,
    snapshot_id TEXT,
    month TEXT,
    cost_risk NUMERIC,
    schedule_risk NUMERIC,
    progress_risk NUMERIC,
    risk_score NUMERIC,
    risk_level TEXT
);

-- Early warnings
CREATE TABLE IF NOT EXISTS early_warnings (
    project_id TEXT,
    snapshot_id TEXT,
    month TEXT,
    warning_type TEXT,
    severity TEXT,
    signal_value NUMERIC
);

-- Model risk scores
CREATE TABLE IF NOT EXISTS model_risk_scores (
    project_id TEXT,
    snapshot_id TEXT,
    month TEXT,
    cop_prob NUMERIC,
    top_prob NUMERIC,
    model_risk_score NUMERIC,
    rule_risk_score NUMERIC,
    final_risk_score NUMERIC,
    risk_level TEXT
);

-- Admins
CREATE TABLE IF NOT EXISTS admins (
    admin_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    title TEXT,
    company TEXT,
    agency TEXT,
    email TEXT,
    created_at TEXT NOT NULL
);

-- Contractors
CREATE TABLE IF NOT EXISTS contractors (
    contractor_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    rating NUMERIC DEFAULT 4.5,
    active_contracts INT DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Contractor assignments
CREATE TABLE IF NOT EXISTS contractor_assignments (
    id SERIAL PRIMARY KEY,
    project_id TEXT NOT NULL,
    contractor_id TEXT NOT NULL,
    package_name TEXT,
    assigned_date TEXT,
    contract_value_cr NUMERIC,
    UNIQUE(project_id, contractor_id)
);

-- Geofences
CREATE TABLE IF NOT EXISTS project_geofences (
    project_id TEXT PRIMARY KEY,
    center_lat NUMERIC NOT NULL,
    center_lng NUMERIC NOT NULL,
    radius_km NUMERIC DEFAULT 3.0,
    boundary_geojson TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Contractor Progress Reports
CREATE TABLE IF NOT EXISTS contractor_progress_reports (
    id SERIAL PRIMARY KEY,
    submission_id TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL,
    contractor_id TEXT NOT NULL,
    physical_progress_pct NUMERIC,
    financial_expenditure_cr NUMERIC,
    notes TEXT,
    photo_url TEXT,
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    inside_geofence INT,
    verification_status TEXT,
    counts_towards_progress INT,
    submitted_at TEXT NOT NULL,
    details_json TEXT,
    ai_intelligence_json TEXT
);

-- Verification records
CREATE TABLE IF NOT EXISTS verification_records (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    original_name TEXT,
    capture_time TEXT,
    client_lat NUMERIC,
    client_lng NUMERIC,
    extracted_lat NUMERIC,
    extracted_lng NUMERIC,
    distance_meters NUMERIC,
    result_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Photo uploads
CREATE TABLE IF NOT EXISTS photo_uploads (
    id SERIAL PRIMARY KEY,
    file_name TEXT UNIQUE NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    content_type TEXT,
    project_id TEXT,
    contractor_id TEXT,
    uploaded_at TEXT NOT NULL
);
"""


def init_schema():
    print("--- 1. Creating Supabase PostgreSQL tables ---")
    with engine.begin() as conn:
        for stmt in DDL_SCHEMA.split(";"):
            cleaned = stmt.strip()
            if cleaned:
                conn.execute(text(cleaned))
    print("Schema applied successfully!")


def migrate_data():
    print("\n--- 2. Migrating Data from SQLite to Supabase ---")
    
    # Mapping of tables to their source sqlite database
    sources = [
        ("project_monitoring.db", [
            "sector_baselines",
            "state_baselines",
            "state_monthly_trends",
            "national_monthly_trends",
            "progress_buckets",
            "projects",
            "project_snapshots",
            "project_features",
            "risk_scores",
            "early_warnings",
            "model_risk_scores",
        ]),
        ("contractors_admin.db", [
            "admins",
            "contractors",
            "contractor_assignments",
            "project_geofences",
        ]),
        ("reports_photos.db", [
            "contractor_progress_reports",
            "verification_records",
            "photo_uploads",
        ])
    ]

    for db_file, tables in sources:
        if not os.path.exists(db_file):
            print(f"File {db_file} not found, skipping...")
            continue

        print(f"\nProcessing source: {db_file}")
        with sqlite3.connect(db_file) as sqlite_conn:
            for tbl in tables:
                try:
                    df = pd.read_sql(f"SELECT * FROM {tbl}", sqlite_conn)
                    if df.empty:
                        print(f"  - {tbl}: 0 rows in source, skipped")
                        continue
                    
                    # For tables with autoincrement primary key 'id', remove 'id' so Postgres generates serial IDs cleanly
                    df_to_insert = df.copy()
                    if "id" in df_to_insert.columns and tbl in ["contractor_assignments", "contractor_progress_reports", "verification_records", "photo_uploads"]:
                        df_to_insert = df_to_insert.drop(columns=["id"])

                    # Clear existing rows in target table to be idempotent
                    with engine.begin() as conn:
                        conn.execute(text(f"TRUNCATE TABLE {tbl} RESTART IDENTITY CASCADE"))

                    df_to_insert.to_sql(tbl, engine, if_exists="append", index=False, method="multi", chunksize=1000)
                    print(f"  ✓ {tbl}: migrated {len(df_to_insert)} rows")
                except Exception as e:
                    print(f"  ✗ {tbl} error: {e}")


def verify_migration():
    print("\n--- 3. Verifying Supabase Tables and Counts ---")
    all_tables = [
        "sector_baselines", "state_baselines", "state_monthly_trends", "national_monthly_trends",
        "progress_buckets", "projects", "project_snapshots", "project_features", "risk_scores",
        "early_warnings", "model_risk_scores", "admins", "contractors", "contractor_assignments",
        "project_geofences", "contractor_progress_reports", "verification_records", "photo_uploads"
    ]
    with engine.connect() as conn:
        for tbl in all_tables:
            res = conn.execute(text(f"SELECT COUNT(*) FROM {tbl}"))
            cnt = res.scalar()
            print(f"  {tbl:<28}: {cnt:>5} rows")


if __name__ == "__main__":
    init_schema()
    migrate_data()
    verify_migration()
    print("\nAll data successfully migrated to Supabase!")
