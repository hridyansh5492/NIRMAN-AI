"""Database Manager for NirmanAI: manages connections and schemas across the 3 databases:
1. project_monitoring.db  -- Core infrastructure projects, monthly snapshots, 16 features & ML risk scores
2. contractors_admin.db   -- Contractor profiles, admin credentials, state assignments & geofences
3. reports_photos.db      -- Contractor on-site progress reports, photo uploads & verification audits
"""
from __future__ import annotations

import os
import re
import sqlite3
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from dotenv import load_dotenv

load_dotenv()

import pandas as pd
import numpy as np
import psycopg2
import psycopg2.extensions
from psycopg2.extras import DictCursor
from sqlalchemy import create_engine, text

# Automatically cast PostgreSQL NUMERIC/DECIMAL to float
DEC2FLOAT = psycopg2.extensions.new_type(
    psycopg2.extensions.DECIMAL.values,
    "DEC2FLOAT",
    lambda value, curs: float(value) if value is not None else None
)
psycopg2.extensions.register_type(DEC2FLOAT)

import mock_data

BASE_DIR = Path(__file__).resolve().parent

DB_CORE = str(BASE_DIR / "project_monitoring.db")
DB_CONTRACTORS_ADMIN = str(BASE_DIR / "contractors_admin.db")
DB_REPORTS_PHOTOS = str(BASE_DIR / "reports_photos.db")

_ENGINE = None


def get_database_url() -> Optional[str]:
    url = os.getenv("DATABASE_URL", "").strip()
    return url if url else None


def is_supabase() -> bool:
    return bool(get_database_url())


def get_supabase_engine():
    global _ENGINE
    if _ENGINE is None:
        url = get_database_url()
        if not url:
            raise ValueError("DATABASE_URL is not configured.")
        sa_url = url
        if sa_url.startswith("postgresql://"):
            sa_url = sa_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        _ENGINE = create_engine(sa_url, pool_pre_ping=True, pool_size=10, max_overflow=20)
    return _ENGINE


TABLE_PKS = {
    "projects": ["project_id"],
    "project_snapshots": ["project_id", "month"],
    "project_features": ["project_id", "month"],
    "risk_scores": ["project_id", "month"],
    "model_risk_scores": ["project_id", "month"],
    "contractors": ["contractor_id"],
    "admins": ["admin_id"],
    "contractor_assignments": ["project_id", "contractor_id"],
    "project_geofences": ["project_id"],
    "contractor_progress_reports": ["submission_id"],
    "photo_uploads": ["file_name"],
    "verification_records": ["id"],
    "sector_baselines": ["sector"],
    "state_baselines": ["state"],
    "state_monthly_trends": ["state", "month"],
    "national_monthly_trends": ["month"],
    "progress_buckets": ["month", "progress_bucket"],
}


def translate_sql(sql: str) -> str:
    s = sql.strip()
    s = re.sub(
        r"sqlite_master\s+WHERE\s+type\s*=\s*'table'",
        "(SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public') AS sqlite_master",
        s,
        flags=re.IGNORECASE
    )
    if re.match(r"^INSERT\s+OR\s+IGNORE\s+INTO", s, re.IGNORECASE):
        s = re.sub(r"^INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", s, flags=re.IGNORECASE)
        s += " ON CONFLICT DO NOTHING"
    elif re.match(r"^INSERT\s+OR\s+REPLACE\s+INTO", s, re.IGNORECASE):
        m = re.search(r"^INSERT\s+OR\s+REPLACE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES", s, re.IGNORECASE)
        if m:
            tbl = m.group(1).lower()
            cols = [c.strip() for c in m.group(2).split(',')]
            pk = TABLE_PKS.get(tbl, [])
            if pk:
                update_cols = [c for c in cols if c.lower() not in [p.lower() for p in pk]]
                pk_str = ', '.join(pk)
                if update_cols:
                    set_str = ', '.join([f"{c} = EXCLUDED.{c}" for c in update_cols])
                    upsert = f" ON CONFLICT ({pk_str}) DO UPDATE SET {set_str}"
                else:
                    upsert = f" ON CONFLICT ({pk_str}) DO NOTHING"
                s = re.sub(r"^INSERT\s+OR\s+REPLACE\s+INTO", "INSERT INTO", s, flags=re.IGNORECASE)
                s += upsert
            else:
                s = re.sub(r"^INSERT\s+OR\s+REPLACE\s+INTO", "INSERT INTO", s, flags=re.IGNORECASE)
        else:
            s = re.sub(r"^INSERT\s+OR\s+REPLACE\s+INTO", "INSERT INTO", s, flags=re.IGNORECASE)
    # Replace AUTOINCREMENT with SERIAL
    s = re.sub(r"INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT", "SERIAL PRIMARY KEY", s, flags=re.IGNORECASE)
    s = s.replace('?', '%s')
    return s


def _clean_params(params):
    if params is None:
        return None
    if isinstance(params, (list, tuple)):
        cleaned = []
        for p in params:
            if hasattr(p, 'item'):
                cleaned.append(p.item())
            else:
                cleaned.append(p)
        return tuple(cleaned)
    return params


class SupabaseCursor:
    def __init__(self, raw_cursor):
        self.raw_cursor = raw_cursor

    def execute(self, sql, params=None):
        return self.raw_cursor.execute(translate_sql(sql), _clean_params(params))

    def executemany(self, sql, seq_of_params):
        return self.raw_cursor.executemany(translate_sql(sql), [_clean_params(p) for p in seq_of_params])

    def fetchone(self):
        return self.raw_cursor.fetchone()

    def fetchall(self):
        return self.raw_cursor.fetchall()

    def fetchmany(self, size=None):
        return self.raw_cursor.fetchmany(size)

    @property
    def rowcount(self):
        return self.raw_cursor.rowcount

    @property
    def description(self):
        return self.raw_cursor.description

    def close(self):
        self.raw_cursor.close()

    def __iter__(self):
        return iter(self.raw_cursor)


class SupabaseDBConnection:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn = psycopg2.connect(db_url)
        self.row_factory = None

    def _ensure_conn(self):
        if self.conn is None or getattr(self.conn, 'closed', 1) != 0:
            self.conn = psycopg2.connect(self.db_url)
            return
        try:
            status = self.conn.get_transaction_status()
            if status == psycopg2.extensions.TRANSACTION_STATUS_UNKNOWN:
                self.conn = psycopg2.connect(self.db_url)
        except Exception:
            try:
                self.conn.close()
            except Exception:
                pass
            self.conn = psycopg2.connect(self.db_url)

    def cursor(self, cursor_factory=None):
        self._ensure_conn()
        cf = cursor_factory or DictCursor
        try:
            return SupabaseCursor(self.conn.cursor(cursor_factory=cf))
        except (psycopg2.InterfaceError, psycopg2.OperationalError):
            self.conn = psycopg2.connect(self.db_url)
            return SupabaseCursor(self.conn.cursor(cursor_factory=cf))

    def execute(self, sql, params=None):
        self._ensure_conn()
        try:
            cur = self.cursor()
            cur.execute(sql, params)
            return cur
        except (psycopg2.InterfaceError, psycopg2.OperationalError):
            self.conn = psycopg2.connect(self.db_url)
            cur = self.cursor()
            cur.execute(sql, params)
            return cur

    def commit(self):
        if self.conn and getattr(self.conn, 'closed', 1) == 0:
            try:
                self.conn.commit()
            except Exception:
                pass

    def rollback(self):
        if self.conn and getattr(self.conn, 'closed', 1) == 0:
            try:
                self.conn.rollback()
            except Exception:
                pass

    def close(self):
        try:
            if self.conn and getattr(self.conn, 'closed', 1) == 0:
                self.conn.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()


def read_sql(sql: str, params: Optional[Any] = None) -> pd.DataFrame:
    """Execute SQL query and return DataFrame using Supabase PostgreSQL or SQLite."""
    if is_supabase():
        engine = get_supabase_engine()
        if params:
            # Map ? to :p0, :p1 ...
            parts = sql.split("?")
            new_sql_parts = []
            param_dict = {}
            for i, part in enumerate(parts[:-1]):
                new_sql_parts.append(part)
                param_name = f"p{i}"
                new_sql_parts.append(f":{param_name}")
                val = params[i]
                if hasattr(val, "item"):
                    val = val.item()
                param_dict[param_name] = val
            new_sql_parts.append(parts[-1])
            final_sql = "".join(new_sql_parts)
            final_sql = re.sub(
                r"sqlite_master\s+WHERE\s+type\s*=\s*'table'",
                "(SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public') AS sqlite_master",
                final_sql,
                flags=re.IGNORECASE
            )
            with engine.connect() as conn:
                return pd.read_sql(text(final_sql), conn, params=param_dict)
        else:
            final_sql = re.sub(
                r"sqlite_master\s+WHERE\s+type\s*=\s*'table'",
                "(SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public') AS sqlite_master",
                sql,
                flags=re.IGNORECASE
            )
            with engine.connect() as conn:
                return pd.read_sql(text(final_sql), conn)
    else:
        with sqlite3.connect(DB_CORE) as conn:
            return pd.read_sql(sql, conn, params=params)


def get_core_conn():
    if is_supabase():
        return SupabaseDBConnection(get_database_url())
    return sqlite3.connect(DB_CORE, check_same_thread=False)


def get_contractors_admin_conn():
    if is_supabase():
        return SupabaseDBConnection(get_database_url())
    return sqlite3.connect(DB_CONTRACTORS_ADMIN, check_same_thread=False)


def get_reports_photos_conn():
    if is_supabase():
        return SupabaseDBConnection(get_database_url())
    return sqlite3.connect(DB_REPORTS_PHOTOS, check_same_thread=False)


def init_contractors_admin_db() -> None:
    """Initialize contractors_admin.db with admins, contractors, assignments, and geofences."""
    conn = get_contractors_admin_conn()
    try:
        cur = conn.cursor()

        # 1. Admins table
        cur.execute("""
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
                approval_status TEXT DEFAULT 'approved',
                admin_level TEXT DEFAULT 'main',
                assigned_contractor_id TEXT,
                approved_by TEXT,
                approved_at TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # 2. Contractors table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contractors (
                contractor_id TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                company_name TEXT NOT NULL,
                contact_person TEXT,
                email TEXT,
                phone TEXT,
                rating NUMERIC DEFAULT 4.5,
                active_contracts INT DEFAULT 0,
                approval_status TEXT DEFAULT 'approved',
                approved_by TEXT,
                approved_at TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # Run safe column additions for existing installations
        admin_cols = [
            ("approval_status", "TEXT DEFAULT 'approved'"),
            ("admin_level", "TEXT DEFAULT 'main'"),
            ("assigned_contractor_id", "TEXT"),
            ("approved_by", "TEXT"),
            ("approved_at", "TEXT"),
        ]
        contractor_cols = [
            ("approval_status", "TEXT DEFAULT 'approved'"),
            ("approved_by", "TEXT"),
            ("approved_at", "TEXT"),
        ]

        if is_supabase():
            for col_name, col_type in admin_cols:
                try:
                    cur.execute(f"ALTER TABLE admins ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                except Exception:
                    pass
            for col_name, col_type in contractor_cols:
                try:
                    cur.execute(f"ALTER TABLE contractors ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                except Exception:
                    pass
        else:
            for col_name, col_type in admin_cols:
                try:
                    cur.execute(f"ALTER TABLE admins ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass
            for col_name, col_type in contractor_cols:
                try:
                    cur.execute(f"ALTER TABLE contractors ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass

        # 3. Contractor Assignments table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contractor_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                contractor_id TEXT NOT NULL,
                package_name TEXT,
                assigned_date TEXT,
                contract_value_cr NUMERIC,
                UNIQUE(project_id, contractor_id)
            )
        """)

        # 4. Project Geofences table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS project_geofences (
                project_id TEXT PRIMARY KEY,
                center_lat NUMERIC NOT NULL,
                center_lng NUMERIC NOT NULL,
                radius_km NUMERIC DEFAULT 3.5,
                boundary_geojson TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        # Seed default Admin account if empty
        cur.execute("SELECT COUNT(*) FROM admins")
        if cur.fetchone()[0] == 0:
            now_str = datetime.now(timezone.utc).isoformat()
            cur.execute("""
                INSERT INTO admins (admin_id, username, password, name, role, title, company, agency, email, approval_status, admin_level, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "ADM-DG-01",
                "admin",
                "admin123",
                "Director General",
                "admin",
                "Director General / Oversight Administrator",
                "Govt of India (MoSPI Oversight)",
                "National Infrastructure Monitoring Authority",
                "dg.oversight@gov.in",
                "approved",
                "main",
                now_str
            ))


        # Seed contractors (migrate from project_monitoring.db or mock_data.CONTRACTORS)
        cur.execute("SELECT COUNT(*) FROM contractors")
        if cur.fetchone()[0] == 0:
            now_str = datetime.now(timezone.utc).isoformat()
            # Check if project_monitoring.db has existing contractors
            migrated_cnt = 0
            if os.path.exists(DB_CORE):
                try:
                    c_core = sqlite3.connect(DB_CORE)
                    rows = c_core.execute("SELECT contractor_id, company_name, contact_person, email, phone, rating, active_contracts FROM contractors").fetchall()
                    for r in rows:
                        cur.execute("""
                            INSERT OR REPLACE INTO contractors
                            (contractor_id, password, company_name, contact_person, email, phone, rating, active_contracts, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (r[0], "contractor123", r[1], r[2], r[3], r[4], r[5], r[6], now_str))
                        migrated_cnt += 1
                    c_core.close()
                except Exception:
                    pass

            if migrated_cnt == 0:
                for c in mock_data.CONTRACTORS:
                    cur.execute("""
                        INSERT OR REPLACE INTO contractors
                        (contractor_id, password, company_name, contact_person, email, phone, rating, active_contracts, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        c["contractor_id"],
                        "contractor123",
                        c["company_name"],
                        c["contact_person"],
                        c["email"],
                        c["phone"],
                        c.get("rating", 4.5),
                        c.get("active_contracts", 4),
                        now_str
                    ))

        # Migrate or seed contractor assignments
        cur.execute("SELECT COUNT(*) FROM contractor_assignments")
        if cur.fetchone()[0] == 0:
            migrated_asgn = 0
            if os.path.exists(DB_CORE):
                try:
                    c_core = sqlite3.connect(DB_CORE)
                    rows = c_core.execute("SELECT project_id, contractor_id, package_name, assigned_date, contract_value_cr FROM contractor_assignments").fetchall()
                    for r in rows:
                        cur.execute("""
                            INSERT OR IGNORE INTO contractor_assignments
                            (project_id, contractor_id, package_name, assigned_date, contract_value_cr)
                            VALUES (?, ?, ?, ?, ?)
                        """, (r[0], r[1], r[2], r[3], r[4]))
                        migrated_asgn += 1
                    c_core.close()
                except Exception:
                    pass

            if migrated_asgn == 0:
                for pid, cid in mock_data.EXPLICIT_ASSIGNMENTS.items():
                    cur.execute("""
                        INSERT OR IGNORE INTO contractor_assignments
                        (project_id, contractor_id, package_name, assigned_date, contract_value_cr)
                        VALUES (?, ?, ?, ?, ?)
                    """, (pid, cid, f"Civil Works Pkg - {pid}", "2024-01-15", 1250.0))

        # Migrate project geofences
        cur.execute("SELECT COUNT(*) FROM project_geofences")
        if cur.fetchone()[0] == 0 and os.path.exists(DB_CORE):
            try:
                c_core = sqlite3.connect(DB_CORE)
                rows = c_core.execute("SELECT project_id, center_lat, center_lng, radius_km, boundary_geojson, created_at FROM project_geofences").fetchall()
                for r in rows:
                    cur.execute("""
                        INSERT OR REPLACE INTO project_geofences
                        (project_id, center_lat, center_lng, radius_km, boundary_geojson, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (r[0], r[1], r[2], r[3], r[4], r[5] or datetime.now(timezone.utc).isoformat()))
                c_core.close()
            except Exception:
                pass

        conn.commit()
    finally:
        conn.close()


def init_reports_photos_db() -> None:
    """Initialize reports_photos.db with contractor_progress_reports, verification_records, and photo_uploads."""
    conn = get_reports_photos_conn()
    try:
        cur = conn.cursor()

        # 1. Contractor Progress Reports table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contractor_progress_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            )
        """)

        # 2. Verification Records table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS verification_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            )
        """)

        # 3. Photo Uploads metadata table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS photo_uploads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT UNIQUE NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                content_type TEXT,
                project_id TEXT,
                contractor_id TEXT,
                uploaded_at TEXT NOT NULL
            )
        """)

        # Migrate existing reports and verification records from project_monitoring.db if empty
        cur.execute("SELECT COUNT(*) FROM contractor_progress_reports")
        if cur.fetchone()[0] == 0 and os.path.exists(DB_CORE):
            try:
                c_core = sqlite3.connect(DB_CORE)
                rows = c_core.execute("""
                    SELECT submission_id, project_id, contractor_id, physical_progress_pct,
                           financial_expenditure_cr, notes, photo_url, gps_lat, gps_lng,
                           inside_geofence, verification_status, counts_towards_progress,
                           submitted_at, details_json, ai_intelligence_json
                    FROM contractor_progress_reports
                """).fetchall()
                for r in rows:
                    cur.execute("""
                        INSERT OR IGNORE INTO contractor_progress_reports
                        (submission_id, project_id, contractor_id, physical_progress_pct,
                         financial_expenditure_cr, notes, photo_url, gps_lat, gps_lng,
                         inside_geofence, verification_status, counts_towards_progress,
                         submitted_at, details_json, ai_intelligence_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, r)
                c_core.close()
            except Exception:
                pass

        cur.execute("SELECT COUNT(*) FROM verification_records")
        if cur.fetchone()[0] == 0 and os.path.exists(DB_CORE):
            try:
                c_core = sqlite3.connect(DB_CORE)
                # Check column structure of verification_records in DB_CORE
                info = [col[1] for col in c_core.execute("PRAGMA table_info(verification_records)").fetchall()]
                if "file_name" in info and "result_json" in info:
                    cols = ["file_name", "original_name", "capture_time", "client_lat", "client_lng",
                            "extracted_lat", "extracted_lng", "distance_meters", "result_json", "status", "created_at"]
                    avail_cols = [c for c in cols if c in info]
                    query = f"SELECT {', '.join(avail_cols)} FROM verification_records"
                    rows = c_core.execute(query).fetchall()
                    for r in rows:
                        row_dict = dict(zip(avail_cols, r))
                        cur.execute("""
                            INSERT INTO verification_records
                            (file_name, original_name, capture_time, client_lat, client_lng,
                             extracted_lat, extracted_lng, distance_meters, result_json, status, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            row_dict.get("file_name", "upload.jpg"),
                            row_dict.get("original_name", "upload.jpg"),
                            row_dict.get("capture_time", ""),
                            row_dict.get("client_lat"),
                            row_dict.get("client_lng"),
                            row_dict.get("extracted_lat"),
                            row_dict.get("extracted_lng"),
                            row_dict.get("distance_meters", 0.0),
                            row_dict.get("result_json", "{}"),
                            row_dict.get("status", "accepted"),
                            row_dict.get("created_at", datetime.now(timezone.utc).isoformat()),
                        ))
                c_core.close()
            except Exception:
                pass

        conn.commit()
    finally:
        conn.close()


def init_all_databases() -> None:
    """Initialize both dedicated databases and perform automatic data migrations."""
    init_contractors_admin_db()
    init_reports_photos_db()


def get_all_database_status() -> Dict[str, Any]:
    """Inspect and report the status, file sizes, and table counts of all databases."""
    if is_supabase():
        tables = {}
        try:
            with get_supabase_engine().connect() as conn:
                res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
                table_names = [r[0] for r in res.fetchall()]
                for t in sorted(table_names):
                    cnt = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                    tables[t] = cnt
            return {
                "status": "healthy",
                "database_engine": "Supabase PostgreSQL (Active Cloud)",
                "total_databases": 1,
                "total_tables": len(tables),
                "tables": tables,
            }
        except Exception as e:
            return {
                "status": "degraded",
                "database_engine": "Supabase PostgreSQL",
                "error": str(e),
            }

    databases = {}

    configs = [
        ("core", DB_CORE, "Core Infrastructure Telemetry, 16-Feature ML Models & Risk Scores"),
        ("contractors_admin", DB_CONTRACTORS_ADMIN, "Contractors Registry, Admin Authentication & State Package Geofences"),
        ("reports_photos", DB_REPORTS_PHOTOS, "On-Site Work Reports, Uploaded Photos & Telemetry Verification Audits"),
    ]

    for key, path_str, purpose in configs:
        p = Path(path_str)
        exists = p.is_file()
        size_bytes = p.stat().st_size if exists else 0
        tables = {}
        if exists:
            try:
                conn = sqlite3.connect(path_str)
                table_names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]
                for t in table_names:
                    cnt = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                    tables[t] = cnt
                conn.close()
            except Exception as e:
                tables = {"error": str(e)}

        databases[key] = {
            "filename": p.name,
            "path": str(p),
            "exists": exists,
            "size_kb": round(size_bytes / 1024, 1),
            "purpose": purpose,
            "tables": tables,
        }

    return {
        "status": "healthy",
        "total_databases": len(databases),
        "databases": databases,
    }


def update_project_sanctioned_cost(
    project_id: str,
    sanctioned_cost: float,
    contractor_id: Optional[str] = None,
    package_name: Optional[str] = None
) -> dict:
    """Synchronously updates the sanctioned package value for a project across ALL databases:
    1. SQLite project_monitoring.db (projects.sanctioned_cost and contractor_assignments)
    2. SQLite contractors_admin.db (contractor_assignments)
    3. Supabase PostgreSQL (projects.sanctioned_cost and contractor_assignments)
    """
    results = {
        "project_id": project_id,
        "sanctioned_cost": float(sanctioned_cost),
        "sqlite_core_updated": False,
        "sqlite_admin_updated": False,
        "supabase_updated": False,
    }
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Update SQLite project_monitoring.db
    try:
        conn = sqlite3.connect(DB_CORE)
        cur = conn.cursor()
        cur.execute("UPDATE projects SET sanctioned_cost = ? WHERE project_id = ?", (sanctioned_cost, project_id))
        if contractor_id:
            cur.execute("""
            INSERT OR REPLACE INTO contractor_assignments
            (project_id, contractor_id, package_name, assigned_date, contract_value_cr)
            VALUES (?, ?, ?, ?, ?)
            """, (project_id, contractor_id, package_name or f"Package Contract -- {project_id}", today, sanctioned_cost))
        conn.commit()
        conn.close()
        results["sqlite_core_updated"] = True
    except Exception as e:
        results["sqlite_core_error"] = str(e)

    # 2. Update SQLite contractors_admin.db
    try:
        conn_adm = sqlite3.connect(DB_CONTRACTORS_ADMIN)
        cur_adm = conn_adm.cursor()
        if contractor_id:
            cur_adm.execute("""
            INSERT OR REPLACE INTO contractor_assignments
            (project_id, contractor_id, package_name, assigned_date, contract_value_cr)
            VALUES (?, ?, ?, ?, ?)
            """, (project_id, contractor_id, package_name or f"Package Contract -- {project_id}", today, sanctioned_cost))
        conn_adm.commit()
        conn_adm.close()
        results["sqlite_admin_updated"] = True
    except Exception as e:
        results["sqlite_admin_error"] = str(e)

    # 3. Update Supabase PostgreSQL if configured
    url = get_database_url()
    if url:
        try:
            with psycopg2.connect(url) as pg_conn:
                with pg_conn.cursor() as pg_cur:
                    pg_cur.execute("UPDATE projects SET sanctioned_cost = %s WHERE project_id = %s", (sanctioned_cost, project_id))
                    if contractor_id:
                        pg_cur.execute("""
                        INSERT INTO contractor_assignments
                        (project_id, contractor_id, package_name, assigned_date, contract_value_cr)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (project_id, contractor_id) DO UPDATE SET
                            contract_value_cr = EXCLUDED.contract_value_cr,
                            package_name = EXCLUDED.package_name,
                            assigned_date = EXCLUDED.assigned_date
                        """, (project_id, contractor_id, package_name or f"Package Contract -- {project_id}", today, sanctioned_cost))
                pg_conn.commit()
            results["supabase_updated"] = True
        except Exception as e:
            results["supabase_error"] = str(e)

    return results


def register_contractor(contractor_id: str, password: str, company_name: str, contact_person: str, email: str, phone: str) -> dict:
    """Register a new contractor with pending approval status."""
    now_str = datetime.now(timezone.utc).isoformat()
    cid = contractor_id.strip().upper()
    conn = get_contractors_admin_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT contractor_id FROM contractors WHERE UPPER(contractor_id) = ?", (cid,))
        if cur.fetchone():
            raise ValueError(f"Contractor ID '{cid}' is already registered.")

        cur.execute("""
            INSERT INTO contractors
            (contractor_id, password, company_name, contact_person, email, phone, rating, active_contracts, approval_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (cid, password, company_name, contact_person, email, phone, 4.5, 0, 'pending', now_str))
        conn.commit()
    finally:
        conn.close()

    if is_supabase() and os.path.exists(DB_CONTRACTORS_ADMIN):
        try:
            sq = sqlite3.connect(DB_CONTRACTORS_ADMIN)
            sq.execute("""
                INSERT OR REPLACE INTO contractors
                (contractor_id, password, company_name, contact_person, email, phone, rating, active_contracts, approval_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (cid, password, company_name, contact_person, email, phone, 4.5, 0, 'pending', now_str))
            sq.commit()
            sq.close()
        except Exception:
            pass

    return {
        "status": "success",
        "contractor_id": cid,
        "company_name": company_name,
        "approval_status": "pending",
        "message": "Contractor registration submitted for review by Main Admin."
    }


def register_subadmin(username: str, password: str, name: str, email: str, title: str = None, agency: str = None, target_contractor_id: str = None) -> dict:
    """Register a new sub-admin with pending approval status."""
    now_str = datetime.now(timezone.utc).isoformat()
    uname = username.strip().lower()
    admin_id = f"SADM-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')[-6:]}"
    conn = get_contractors_admin_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT admin_id FROM admins WHERE LOWER(username) = ?", (uname,))
        if cur.fetchone():
            raise ValueError(f"Username '{uname}' is already taken.")

        cur.execute("""
            INSERT INTO admins
            (admin_id, username, password, name, role, title, company, agency, email, approval_status, admin_level, assigned_contractor_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (admin_id, uname, password, name, 'subadmin', title or 'Sub-Admin Auditor', 'MoSPI Field Division', agency or 'National Oversight', email, 'pending', 'sub', target_contractor_id, now_str))
        conn.commit()
    finally:
        conn.close()

    if is_supabase() and os.path.exists(DB_CONTRACTORS_ADMIN):
        try:
            sq = sqlite3.connect(DB_CONTRACTORS_ADMIN)
            sq.execute("""
                INSERT OR REPLACE INTO admins
                (admin_id, username, password, name, role, title, company, agency, email, approval_status, admin_level, assigned_contractor_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (admin_id, uname, password, name, 'subadmin', title or 'Sub-Admin Auditor', 'MoSPI Field Division', agency or 'National Oversight', email, 'pending', 'sub', target_contractor_id, now_str))
            sq.commit()
            sq.close()
        except Exception:
            pass

    return {
        "status": "success",
        "admin_id": admin_id,
        "username": uname,
        "name": name,
        "approval_status": "pending",
        "assigned_contractor_id": target_contractor_id,
        "message": "Sub-Admin registration submitted for review by Main Admin."
    }


def get_pending_approvals() -> dict:
    """Retrieve all pending registration requests across contractors and sub-admins."""
    conn = get_contractors_admin_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT contractor_id, company_name, contact_person, email, phone, approval_status, created_at
            FROM contractors
            WHERE approval_status = 'pending'
            ORDER BY created_at DESC
        """)
        pending_contractors = [{
            "id": r[0],
            "type": "contractor",
            "identifier": r[0],
            "name": r[1],
            "contact_person": r[2],
            "email": r[3],
            "phone": r[4],
            "approval_status": r[5] or "pending",
            "created_at": r[6],
        } for r in cur.fetchall()]

        cur.execute("""
            SELECT a.admin_id, a.username, a.name, a.email, a.title, a.agency, a.assigned_contractor_id, a.approval_status, a.created_at,
                   c.company_name as assigned_company_name
            FROM admins a
            LEFT JOIN contractors c ON a.assigned_contractor_id = c.contractor_id
            WHERE a.approval_status = 'pending'
            ORDER BY a.created_at DESC
        """)
        pending_subadmins = [{
            "id": r[0],
            "type": "subadmin",
            "identifier": r[1],
            "name": r[2],
            "email": r[3],
            "title": r[4],
            "agency": r[5],
            "assigned_contractor_id": r[6],
            "assigned_company_name": r[9] or r[6] or "Unassigned",
            "approval_status": r[7] or "pending",
            "created_at": r[8],
        } for r in cur.fetchall()]

        return {
            "pending_contractors": pending_contractors,
            "pending_subadmins": pending_subadmins,
            "total_pending": len(pending_contractors) + len(pending_subadmins),
        }
    finally:
        conn.close()


def approve_or_reject_account(account_type: str, account_id: str, action: str, assigned_contractor_id: str = None, approved_by: str = "Director General (Admin)") -> dict:
    """Main Admin approves or rejects a contractor or sub-admin account."""
    now_str = datetime.now(timezone.utc).isoformat()
    new_status = "approved" if action.lower() == "approve" else "rejected"
    conn = get_contractors_admin_conn()
    try:
        cur = conn.cursor()
        if account_type.lower() == "contractor":
            cur.execute("""
                UPDATE contractors
                SET approval_status = ?, approved_by = ?, approved_at = ?
                WHERE contractor_id = ?
            """, (new_status, approved_by, now_str, account_id))
            conn.commit()

            if is_supabase() and os.path.exists(DB_CONTRACTORS_ADMIN):
                try:
                    sq = sqlite3.connect(DB_CONTRACTORS_ADMIN)
                    sq.execute("UPDATE contractors SET approval_status = ?, approved_by = ?, approved_at = ? WHERE contractor_id = ?", (new_status, approved_by, now_str, account_id))
                    sq.commit()
                    sq.close()
                except Exception:
                    pass
        elif account_type.lower() in ("subadmin", "admin"):
            if new_status == "approved" and assigned_contractor_id:
                cur.execute("""
                    UPDATE admins
                    SET approval_status = ?, approved_by = ?, approved_at = ?, assigned_contractor_id = ?, admin_level = 'sub', role = 'subadmin'
                    WHERE admin_id = ? OR username = ?
                """, (new_status, approved_by, now_str, assigned_contractor_id, account_id, account_id))
            else:
                cur.execute("""
                    UPDATE admins
                    SET approval_status = ?, approved_by = ?, approved_at = ?
                    WHERE admin_id = ? OR username = ?
                """, (new_status, approved_by, now_str, account_id, account_id))
            conn.commit()

            if is_supabase() and os.path.exists(DB_CONTRACTORS_ADMIN):
                try:
                    sq = sqlite3.connect(DB_CONTRACTORS_ADMIN)
                    if new_status == "approved" and assigned_contractor_id:
                        sq.execute("UPDATE admins SET approval_status = ?, approved_by = ?, approved_at = ?, assigned_contractor_id = ?, admin_level = 'sub', role = 'subadmin' WHERE admin_id = ? OR username = ?", (new_status, approved_by, now_str, assigned_contractor_id, account_id, account_id))
                    else:
                        sq.execute("UPDATE admins SET approval_status = ?, approved_by = ?, approved_at = ? WHERE admin_id = ? OR username = ?", (new_status, approved_by, now_str, account_id, account_id))
                    sq.commit()
                    sq.close()
                except Exception:
                    pass
        else:
            raise ValueError(f"Unknown account type '{account_type}'")
    finally:
        conn.close()

    return {
        "status": "success",
        "account_id": account_id,
        "account_type": account_type,
        "approval_status": new_status,
        "assigned_contractor_id": assigned_contractor_id,
        "approved_by": approved_by,
        "approved_at": now_str,
    }


def get_subadmins() -> list:
    """List all registered and approved sub-admins with their assigned contractor."""
    conn = get_contractors_admin_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT a.admin_id, a.username, a.name, a.email, a.title, a.agency, a.assigned_contractor_id, a.approval_status, a.created_at,
                   c.company_name as assigned_company_name
            FROM admins a
            LEFT JOIN contractors c ON a.assigned_contractor_id = c.contractor_id
            WHERE a.admin_level = 'sub' OR a.role = 'subadmin'
            ORDER BY a.created_at DESC
        """)
        rows = cur.fetchall()
        return [{
            "admin_id": r[0],
            "username": r[1],
            "name": r[2],
            "email": r[3],
            "title": r[4],
            "agency": r[5],
            "assigned_contractor_id": r[6],
            "approval_status": r[7] or "approved",
            "created_at": r[8],
            "assigned_company_name": r[9] or r[6] or "Unassigned",
        } for r in rows]
    finally:
        conn.close()


def assign_subadmin_contractor(subadmin_id: str, contractor_id: str) -> dict:
    """Main Admin updates/reassigns the contractor monitored by a sub-admin."""
    conn = get_contractors_admin_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE admins
            SET assigned_contractor_id = ?, admin_level = 'sub', role = 'subadmin'
            WHERE admin_id = ? OR username = ?
        """, (contractor_id, subadmin_id, subadmin_id))
        conn.commit()
    finally:
        conn.close()

    if is_supabase() and os.path.exists(DB_CONTRACTORS_ADMIN):
        try:
            sq = sqlite3.connect(DB_CONTRACTORS_ADMIN)
            sq.execute("UPDATE admins SET assigned_contractor_id = ?, admin_level = 'sub', role = 'subadmin' WHERE admin_id = ? OR username = ?", (contractor_id, subadmin_id, subadmin_id))
            sq.commit()
            sq.close()
        except Exception:
            pass

    return {
        "status": "success",
        "subadmin_id": subadmin_id,
        "assigned_contractor_id": contractor_id,
    }



if __name__ == "__main__":
    print("Initializing dedicated databases...")
    init_all_databases()
    status = get_all_database_status()
    import json
    print(json.dumps(status, indent=2))
