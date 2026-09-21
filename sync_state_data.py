"""Synchronize state_baselines and state_monthly_trends directly from
ground-truth projects and project_snapshots tables across both
Supabase PostgreSQL and local SQLite (project_monitoring.db).
"""
import sqlite3
import pandas as pd
from sqlalchemy import text
import db_manager

DB_SQLITE = "project_monitoring.db"

def compute_clean_state_data(conn_or_engine, is_pg=False):
    """Compute state_baselines and state_monthly_trends from project tables."""
    cast_num = "::numeric" if is_pg else ""
    
    q_baselines = f"""
    SELECT 
        p.state,
        COUNT(DISTINCT p.project_id) as project_count,
        ROUND(AVG(s.cost_overrun_to_date_pct){cast_num}, 2) as avg_cost_overrun_pct
    FROM projects p
    LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
    GROUP BY p.state
    ORDER BY project_count DESC, p.state ASC
    """
    
    q_trends = f"""
    SELECT 
        p.state,
        s.month,
        COUNT(DISTINCT p.project_id) as project_count,
        ROUND(SUM(p.sanctioned_cost){cast_num}, 2) as original_cost_cr,
        ROUND(SUM(s.revised_cost){cast_num}, 2) as revised_cost_cr,
        ROUND(SUM(s.cumulative_expenditure){cast_num}, 2) as expenditure_cr,
        ROUND(AVG(s.cost_overrun_to_date_pct){cast_num}, 2) as cost_overrun_pct
    FROM projects p
    JOIN project_snapshots s ON p.project_id = s.project_id
    GROUP BY p.state, s.month
    ORDER BY p.state ASC, 
        CASE s.month 
            WHEN 'Feb' THEN 1 
            WHEN 'March' THEN 2 
            WHEN 'April' THEN 3 
            WHEN 'May' THEN 4 
            WHEN 'June' THEN 5 
            WHEN 'July' THEN 6 
        END ASC
    """
    
    if is_pg:
        with conn_or_engine.connect() as conn:
            df_base = pd.read_sql(text(q_baselines), conn)
            df_trends = pd.read_sql(text(q_trends), conn)
    else:
        df_base = pd.read_sql(q_baselines, conn_or_engine)
        df_trends = pd.read_sql(q_trends, conn_or_engine)
        
    return df_base, df_trends


def sync_sqlite(df_base, df_trends):
    """Sync to local SQLite database."""
    print("-> Synchronizing local SQLite (project_monitoring.db)...")
    conn = sqlite3.connect(DB_SQLITE)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM state_baselines")
        cur.execute("DELETE FROM state_monthly_trends")
        
        df_base.to_sql("state_baselines", conn, if_exists="append", index=False)
        df_trends.to_sql("state_monthly_trends", conn, if_exists="append", index=False)
        conn.commit()
        
        cnt_base = cur.execute("SELECT COUNT(*) FROM state_baselines").fetchone()[0]
        cnt_trends = cur.execute("SELECT COUNT(*) FROM state_monthly_trends").fetchone()[0]
        sum_proj = cur.execute("SELECT SUM(project_count) FROM state_baselines").fetchone()[0]
        print(f"   [SQLite] state_baselines: {cnt_base} rows (total projects: {sum_proj})")
        print(f"   [SQLite] state_monthly_trends: {cnt_trends} rows")
    finally:
        conn.close()


def sync_supabase(df_base, df_trends):
    """Sync to Supabase PostgreSQL database if configured."""
    if not db_manager.is_supabase():
        print("-> Supabase not configured. Skipping Supabase sync.")
        return
        
    print("-> Synchronizing Supabase PostgreSQL...")
    engine = db_manager.get_supabase_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM state_baselines"))
        conn.execute(text("DELETE FROM state_monthly_trends"))
        
        # Insert baselines
        for _, row in df_base.iterrows():
            conn.execute(
                text("""
                    INSERT INTO state_baselines (state, project_count, avg_cost_overrun_pct)
                    VALUES (:state, :project_count, :avg_cost_overrun_pct)
                """),
                {
                    "state": str(row["state"]),
                    "project_count": int(row["project_count"]),
                    "avg_cost_overrun_pct": float(row["avg_cost_overrun_pct"]) if pd.notnull(row["avg_cost_overrun_pct"]) else 0.0
                }
            )
            
        # Insert trends
        for _, row in df_trends.iterrows():
            conn.execute(
                text("""
                    INSERT INTO state_monthly_trends (state, month, project_count, original_cost_cr, revised_cost_cr, expenditure_cr, cost_overrun_pct)
                    VALUES (:state, :month, :project_count, :original_cost_cr, :revised_cost_cr, :expenditure_cr, :cost_overrun_pct)
                """),
                {
                    "state": str(row["state"]),
                    "month": str(row["month"]),
                    "project_count": int(row["project_count"]),
                    "original_cost_cr": float(row["original_cost_cr"]) if pd.notnull(row["original_cost_cr"]) else 0.0,
                    "revised_cost_cr": float(row["revised_cost_cr"]) if pd.notnull(row["revised_cost_cr"]) else 0.0,
                    "expenditure_cr": float(row["expenditure_cr"]) if pd.notnull(row["expenditure_cr"]) else 0.0,
                    "cost_overrun_pct": float(row["cost_overrun_pct"]) if pd.notnull(row["cost_overrun_pct"]) else 0.0
                }
            )
            
    with engine.connect() as conn:
        cnt_base = conn.execute(text("SELECT COUNT(*) FROM state_baselines")).scalar()
        cnt_trends = conn.execute(text("SELECT COUNT(*) FROM state_monthly_trends")).scalar()
        sum_proj = conn.execute(text("SELECT SUM(project_count) FROM state_baselines")).scalar()
        print(f"   [Supabase] state_baselines: {cnt_base} rows (total projects: {sum_proj})")
        print(f"   [Supabase] state_monthly_trends: {cnt_trends} rows")


def main():
    print("=== SYNCHRONIZING REAL STATE DATA FROM PROJECTS ===")
    # Compute clean data from SQLite ground truth
    sqlite_conn = sqlite3.connect(DB_SQLITE)
    df_base, df_trends = compute_clean_state_data(sqlite_conn, is_pg=False)
    sqlite_conn.close()
    
    print(f"Computed {len(df_base)} state baselines covering {df_base['project_count'].sum()} projects.")
    print(f"Computed {len(df_trends)} monthly state trend rows.")
    
    sync_sqlite(df_base, df_trends)
    sync_supabase(df_base, df_trends)
    print("=== SYNCHRONIZATION COMPLETE ===")

if __name__ == "__main__":
    main()
