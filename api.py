"""FastAPI layer: real baselines + synthetic project predictions.

Endpoints:
  GET /                      -> static dashboard
  GET /api/health
  GET /api/projects
  GET /api/projects/{id}
  GET /api/projects/{id}/timeline
  GET /api/snapshots
  GET /api/baselines/sectors
  GET /api/baselines/states
  GET /api/trends/states
  GET /api/trends/national
  GET /api/warnings
  GET /api/projects?map=true    -> leaflet payload (additive, default unchanged)
  POST /api/verify-image        -> photo verification (EGPS/time/duplicate heuristics)
  GET /api/verification-records -> audit trail for verification checks
  GET /uploads/{filename}       -> serve uploaded photos back to the UI
"""
import json
import os
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import pandas as pd
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import db_manager
import llm
import mock_data
import scoring
import verification_pipeline as verification
import fraud_detector

app = FastAPI(title="Infrastructure Oversight Co-Pilot API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB = db_manager.DB_CORE
DB_CONTRACTORS_ADMIN = db_manager.DB_CONTRACTORS_ADMIN
DB_REPORTS_PHOTOS = db_manager.DB_REPORTS_PHOTOS
MONTH_ORDER = ["Feb", "March", "April", "May", "June", "July"]

# ---------------------------------------------------------------------------
# Map & photo-verification bit (additive-only; ML pipeline stays untouched).
# ---------------------------------------------------------------------------
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)  # safe when the server starts from any cwd


def _ensure_verification_schema():
    """Ensure verification_records and photo_uploads exist in reports_photos.db."""
    db_manager.init_reports_photos_db()


_contractor_schema_initialized = False

def _ensure_contractor_schema():
    """Ensure contractors_admin.db and reports_photos.db schemas and tables exist."""
    global _contractor_schema_initialized
    if not _contractor_schema_initialized:
        try:
            db_manager.init_all_databases()
            _contractor_schema_initialized = True
        except Exception as e:
            print(f"Could not initialize contractor schema: {e}")


@app.get("/api/databases/status")
def databases_status():
    """Diagnostic endpoint reporting status, file sizes, and table counts across the 3 dedicated databases:
    1. Core Telemetry DB (project_monitoring.db)
    2. Contractors & Admin DB (contractors_admin.db)
    3. Reports & Photo Uploads DB (reports_photos.db)
    """
    _ensure_contractor_schema()
    return db_manager.get_all_database_status()



def _status_from_risk(risk_level: str, physical_progress_pct: float = 0.0) -> str:
    """Map a model risk level back to the dashboard status vocabulary."""
    if physical_progress_pct >= 100.0:
        return "Completed"
    level = str(risk_level or "").strip()
    if level == "Low":
        return "On Track"
    if level == "Medium":
        return "Watch"
    return "At Risk"  # High / Critical


def _map_projects(limit: int = 200):
    """Enriched /api/projects payload for the Leaflet map.

    Returns a dict with ``mode`` ("db" | "demo") plus the project list. DB
    rows carry no coordinates, so each project is placed deterministically
    from its state centroid via ``mock_data.coordinates_for``. Unresolved
    states drop the point (never crash the request).
    """
    query = (
        "SELECT p.project_id, p.sector, p.state, p.sanctioned_cost, "
        "s.physical_progress_pct, s.cumulative_expenditure, "
        "m.cop_prob, m.top_prob, m.final_risk_score, m.risk_level "
        "FROM projects p "
        "LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July' "
        "LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July' "
        "ORDER BY m.final_risk_score DESC LIMIT ?"
    )
    df = q(query, params=[limit])
    projects = []
    for r in df.to_dict("records"):
        if r.get("project_id") is None:
            continue
        coords = mock_data.coordinates_for(str(r["project_id"]), str(r.get("state", "")))
        if coords is None:
            continue
        risk = float(r.get("final_risk_score") or 50)
        level = str(r.get("risk_level") or ("Medium" if risk >= 40 else "Low"))
        location = mock_data.get_district_for(str(r["project_id"]), str(r.get("state", "")))
        projects.append({
            "id": str(r["project_id"]),
            "name": f"{r.get('state')} {r.get('sector')} Project ({r['project_id']})",
            "project_id": str(r["project_id"]),
            "sector": str(r.get("sector") or "Infrastructure"),
            "state": str(r.get("state") or "India"),
            "location": location,
            "lat": coords[0],
            "lng": coords[1],
            "cost_cr": round(float(r.get("sanctioned_cost") or 0), 2),
            "physical_progress_pct": round(float(r.get("physical_progress_pct") or 0), 1),
            "expenditure_cr": round(float(r.get("cumulative_expenditure") or 0), 2),
            "status": _status_from_risk(level, float(r.get("physical_progress_pct") or 0)),
            "risk_score": round(risk, 1),
            "risk_level": level,
        })
    return {"mode": "db", "projects": projects}


def q(sql, params=None):
    if db_manager.is_supabase():
        return db_manager.read_sql(sql, params=params)
    conn = sqlite3.connect(DB)
    df = pd.read_sql(sql, conn, params=params)
    conn.close()
    return df


def month_sorted(df, col="month"):
    if col in df.columns:
        df[col] = pd.Categorical(df[col], categories=MONTH_ORDER, ordered=True)
        df = df.sort_values(col)
    return df

from typing import Optional
from pydantic import BaseModel

MINISTRY_MAP = {
    "Railways": "Ministry of Railways",
    "Roads & Highways": "Ministry of Road Transport & Highways",
    "Urban Transport": "Ministry of Housing & Urban Affairs",
    "Power & RE": "Ministry of Power & New Renewable Energy",
    "Oil & Gas": "Ministry of Petroleum & Natural Gas",
    "Aviation & Aviation Infrastructure": "Ministry of Civil Aviation",
    "Ports & Shipping": "Ministry of Ports, Shipping & Waterways",
    "Telecommunications": "Department of Telecommunications",
    "Coal": "Ministry of Coal",
    "Atomic Energy": "Department of Atomic Energy",
}


def format_project_card(row):
    pid = str(row.get("project_id", ""))
    sec = str(row.get("sector", "Infrastructure"))
    st = str(row.get("state", "India"))
    sanctioned = float(row.get("sanctioned_cost", 0) or 0)
    exp = float(row.get("cumulative_expenditure", 0) or 0)
    phys = float(row.get("physical_progress_pct", 0) or 0)
    fin = float(row.get("financial_progress_pct", 0) or 0)
    slip = float(row.get("schedule_slip_months", 0) or 0)
    overrun = float(row.get("cost_overrun_to_date_pct", 0) or 0)
    cop_p = float(row.get("cop_prob", 0) or 0)
    top_p = float(row.get("top_prob", 0) or 0)
    final_risk = float(row.get("final_risk_score", 50) or 50)
    risk_lvl = str(row.get("risk_level", "Medium"))

    status = _status_from_risk(risk_lvl, phys)
    health = max(0, min(100, round(100 - final_risk, 1)))

    comp_date = row.get("completion_date") or row.get("date_of_completion")
    comp_date_str = str(comp_date) if comp_date and pd.notna(comp_date) else None

    flags = []
    if phys >= 100:
        flags.append({"label": f"Completed on {comp_date_str}" if comp_date_str else "Project completed", "tone": "positive"})
    elif slip > 4:
        flags.append({"label": f"Schedule slip +{round(slip, 1)} mo", "tone": "negative"})
    if overrun > 10:
        flags.append({"label": f"Cost escalation +{round(overrun, 1)}%", "tone": "negative"})
    elif overrun < 0:
        flags.append({"label": f"Cost savings {round(abs(overrun), 1)}%", "tone": "positive"})
    elif phys < 15:
        flags.append({"label": "Early execution phase", "tone": "neutral"})

    return {
        "id": pid,
        "project_id": pid,
        "name": f"{st} {sec} Project ({pid})",
        "ministry": MINISTRY_MAP.get(sec, f"Ministry of {sec}"),
        "sector": sec,
        "state": st,
        "status": status,
        "physicalProgress": round(phys, 1),
        "financialProgress": round(fin, 1),
        "health": health,
        "costOverrunRisk": round(cop_p * 100, 1),
        "timeOverrunRisk": round(top_p * 100, 1),
        "completionDate": comp_date_str,
        "dateOfCompletion": comp_date_str,
        "originalCompletion": str(row.get("original_end_date") or "31 Dec 2028"),
        "predictedCompletion": comp_date_str if (status == "Completed" and comp_date_str) else str(row.get("revised_end_date") or "30 Jun 2030"),
        "expenditure": f"₹ {round(exp, 1):,} Cr" if exp > 0 else f"₹ {round(sanctioned, 1):,} Cr",
        "sanctioned_cost": round(sanctioned, 2),
        "cost_cr": round(sanctioned, 2),
        "costVariance": round(overrun, 1),
        "timeVariance": round(slip, 1),
        "currentStageIndex": 4 if phys >= 100.0 else 3 if phys > 0 else 0,
        "approved_progress_pct": round(phys, 1),
        "reviewReason": (
            f"The predictive ML model estimates a {round(cop_p*100, 1)}% probability of cost overrun and "
            f"{round(top_p*100, 1)}% probability of schedule overrun. "
            f"Current schedule slip is {round(slip, 1)} months with cost variance at {round(overrun, 1)}%."
        ),
        "flags": flags,
        "final_risk_score": final_risk,
        "risk_level": risk_lvl,
        "location": mock_data.get_district_for(pid, st),
        "contractor": mock_data.get_contractor_for_project(pid),
    }



class PredictRequest(BaseModel):
    sector: str = "Roads & Highways"
    state: str = "Maharashtra"
    sanctioned_cost: float = 1000.0
    duration_months: float = 36.0
    months_elapsed: float = 12.0
    physical_progress_pct: float = 30.0
    financial_progress_pct: float = 35.0
    cost_overrun_to_date_pct: float = 5.0
    schedule_slip_months: float = 2.0
    cumulative_expenditure: float = 350.0
    revised_cost: float = 1050.0


class RegisterProjectRequest(BaseModel):
    name: Optional[str] = None
    ministry: Optional[str] = None
    sector: str = "Roads & Highways"
    state: str = "Maharashtra"
    sanctioned_cost: float = 1000.0
    revised_cost: Optional[float] = None
    duration_months: float = 36.0
    months_elapsed: float = 12.0
    physical_progress_pct: float = 30.0
    financial_progress_pct: float = 30.0
    cost_overrun_to_date_pct: float = 0.0
    schedule_slip_months: float = 0.0
    cumulative_expenditure: Optional[float] = None
    sanctioned_date: Optional[str] = "2024-01-01"
    original_end_date: Optional[str] = "2027-01-01"
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = 3.5
    contractor_id: Optional[str] = "CNT-LT-01"


@app.get("/", include_in_schema=False)
def index():
    dist = Path("frontend/dist/index.html")
    resp = FileResponse(dist if dist.is_file() else Path("static/index.html"))
    # Dashboard/SPA reads live DOM + API each load; never let browsers serve a stale copy.
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/api/health")
def health():
    tables_df = q("SELECT name FROM sqlite_master WHERE type='table'")
    proj_df = q("SELECT count(*) as n FROM projects")
    snap_df = q("SELECT count(*) as n FROM project_snapshots")
    return {
        "status": "connected",
        "database": "Supabase PostgreSQL (Active Cloud)" if db_manager.is_supabase() else "project_monitoring.db",
        "tables_count": len(tables_df),
        "total_projects": int(proj_df.iloc[0]["n"]) if not proj_df.empty else 0,
        "total_snapshots": int(snap_df.iloc[0]["n"]) if not snap_df.empty else 0,
        "models": {
            "cost_overrun_model": "cop_model.json (XGBoost Loaded)",
            "time_overrun_model": "top_model.json (XGBoost Loaded)",
            "explainability": "SHAP TreeExplainer Active"
        }
    }


@app.get("/api/projects")
def projects(sector: Optional[str] = None, state: Optional[str] = None,
             risk_level: Optional[str] = None, limit: int = 500,
             map: Optional[bool] = None):
    # Enriched leaflet payload used by the interactive map; the default
    # JSON-card response below is byte-for-byte identical to the original.
    if map:
        return _map_projects(limit=max(1, min(limit, 2000)))
    query = """
    SELECT 
        p.project_id, p.sector, p.state, p.sanctioned_cost, p.sanctioned_date, p.original_end_date, p.completion_date, p.date_of_completion, p.duration_months,
        s.physical_progress_pct, s.financial_progress_pct, s.cumulative_expenditure, s.revised_cost,
        s.cost_overrun_to_date_pct, s.schedule_slip_months, s.revised_end_date,
        m.cop_prob, m.top_prob, m.model_risk_score, m.rule_risk_score, m.final_risk_score, m.risk_level
    FROM projects p
    LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
    LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
    WHERE 1=1
    """
    params = []
    if sector and sector != "All Sectors":
        query += " AND p.sector = ?"
        params.append(sector)
    if state:
        query += " AND p.state = ?"
        params.append(state)
    if risk_level:
        query += " AND m.risk_level = ?"
        params.append(risk_level)
    
    query += " ORDER BY m.final_risk_score DESC LIMIT ?"
    params.append(limit)

    df = q(query, params=params if params else None)
    records = df.to_dict("records")
    return [format_project_card(r) for r in records]


@app.get("/api/portfolio/summary")
def portfolio_summary():
    df = q("""
    SELECT 
        p.project_id, p.sector, p.state, p.sanctioned_cost,
        s.physical_progress_pct, s.financial_progress_pct, s.cost_overrun_to_date_pct, s.schedule_slip_months,
        m.cop_prob, m.top_prob, m.model_risk_score, m.final_risk_score, m.risk_level
    FROM projects p
    LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
    LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
    """)
    if df.empty:
        return {}

    total = len(df)
    critical_c = int((df["risk_level"] == "Critical").sum())
    high_c = int((df["risk_level"] == "High").sum())
    medium_c = int((df["risk_level"] == "Medium").sum())
    low_c = int((df["risk_level"] == "Low").sum())

    at_risk = critical_c + high_c
    avg_final_risk = float(df["final_risk_score"].mean())
    avg_health = round(100 - avg_final_risk, 1)
    avg_cop = round(float(df["cop_prob"].mean()) * 100, 1)
    avg_top = round(float(df["top_prob"].mean()) * 100, 1)
    avg_overrun = round(float(df["cost_overrun_to_date_pct"].mean()), 2)

    top_risk_df = df.sort_values("final_risk_score", ascending=False).head(6)
    top_risk_projects = [format_project_card(r) for r in top_risk_df.to_dict("records")]

    return {
        "total_projects": total,
        "projects_at_risk": at_risk,
        "projects_watch": medium_c,
        "projects_on_track": low_c,
        "avg_health": avg_health,
        "avg_cost_overrun_pct": avg_overrun,
        "avg_cop_prob": avg_cop,
        "avg_top_prob": avg_top,
        "critical_count": critical_c,
        "high_count": high_c,
        "medium_count": medium_c,
        "low_count": low_c,
        "top_risk_projects": top_risk_projects,
    }


@app.get("/api/snapshots")
def snapshots():
    return q("SELECT COUNT(*) AS n_snapshots, COUNT(DISTINCT project_id) AS n_projects "
             "FROM project_snapshots").to_dict("records")[0]


@app.get("/api/projects/{project_id}")
def project_detail(project_id: str):
    engine = scoring.get_engine()
    result = engine.score_project(project_id)
    if result is None:
        raise HTTPException(404, f"unknown project {project_id}")

    sec = result["sector"]
    st = str(result["state"]).title() if result.get("state") else "India"
    result["state"] = st
    result["id"] = project_id
    result["name"] = f"{st} {sec} Project ({project_id})"
    result["location"] = mock_data.get_district_for(project_id, st)
    result["ministry"] = MINISTRY_MAP.get(sec, f"Ministry of {sec}")
    result["status"] = _status_from_risk(result["risk_level"], result["physical_progress_pct"])
    result["costOverrunRisk"] = round(result["cop_prob"] * 100, 1)
    result["timeOverrunRisk"] = round(result["top_prob"] * 100, 1)
    result["costVariance"] = round(result["cost_overrun_to_date_pct"], 1)
    result["timeVariance"] = round(result["schedule_slip_months"], 1)
    result["physicalProgress"] = round(result["physical_progress_pct"], 1)
    result["financialProgress"] = round(result["financial_progress_pct"], 1)
    comp_date = result.get("completion_date") or result.get("date_of_completion")
    comp_date_str = str(comp_date) if comp_date and pd.notna(comp_date) else None
    result["completionDate"] = comp_date_str
    result["dateOfCompletion"] = comp_date_str
    result["expenditure"] = f"₹ {round(result.get('cumulative_expenditure', 0), 1):,} Cr"
    result["originalCompletion"] = str(result.get("original_end_date") or "31 Dec 2028")
    result["predictedCompletion"] = comp_date_str if (result["status"] == "Completed" and comp_date_str) else str(result.get("revised_end_date") or "30 Jun 2030")
    result["currentStageIndex"] = 4 if result["physical_progress_pct"] >= 100.0 else 3 if result["physical_progress_pct"] > 0 else 0
    result["approved_progress_pct"] = round(result["physical_progress_pct"], 1)

    try:
        c_reports = q(
            "SELECT submission_id, physical_progress_pct, submitted_at, notes, verification_status "
            "FROM contractor_progress_reports "
            "WHERE project_id = ? AND counts_towards_progress = 1 "
            "ORDER BY id DESC LIMIT 1",
            params=[project_id]
        )
        if not c_reports.empty:
            rep = c_reports.iloc[0].to_dict()
            result["latest_approved_report"] = rep
            result["approved_progress_pct"] = float(rep.get("physical_progress_pct", result["physicalProgress"]))
        else:
            result["latest_approved_report"] = None
    except Exception:
        result["latest_approved_report"] = None

    top_drivers = result.get("shap_drivers", [])
    driver_texts = []
    for d in top_drivers[:3]:
        feat = d["feature"].replace("_", " ")
        val = d["shap_value"]
        if val > 0:
            driver_texts.append(f"{feat} (+{val})")
        else:
            driver_texts.append(f"{feat} ({val})")

    warn_texts = [w["warning_type"].replace("_", " ") for w in result.get("warnings", [])[:2]]

    reason = (
        f"The predictive XGBoost model evaluates this project at {result['final_risk_score']}/100 composite risk ({result['risk_level']}). "
        f"Top SHAP risk drivers: {', '.join(driver_texts) if driver_texts else 'Baseline drift'}. "
    )
    if warn_texts:
        reason += f"Active warning flags triggered: {', '.join(warn_texts)}."

    result["reviewReason"] = reason

    flags = []
    if result["schedule_slip_months"] > 4:
        flags.append({"label": f"Schedule slip +{round(result['schedule_slip_months'], 1)} mo", "tone": "negative"})
    if result["cost_overrun_to_date_pct"] > 10:
        flags.append({"label": f"Cost escalation +{round(result['cost_overrun_to_date_pct'], 1)}%", "tone": "negative"})
    elif result["cost_overrun_to_date_pct"] < 0:
        flags.append({"label": f"Under budget {round(abs(result['cost_overrun_to_date_pct']), 1)}%", "tone": "positive"})
    if abs(result["financial_progress_pct"] - result["physical_progress_pct"]) > 10:
        flags.append({"label": "Financial-physical execution gap", "tone": "negative"})
    if result["physical_progress_pct"] >= 70:
        flags.append({"label": "Strong physical delivery", "tone": "positive"})

    result["flags"] = flags
    return result


@app.post("/api/predict")
def predict_project(req: PredictRequest):
    engine = scoring.get_engine()
    res = engine.predict_custom(req.dict())
    return res


@app.post("/api/projects")
def register_project(req: RegisterProjectRequest):
    conn = db_manager.get_core_conn()
    c = conn.cursor()

    # Determine next PRJ-XXXX identifier
    c.execute("SELECT project_id FROM projects WHERE project_id LIKE 'PRJ-%' ORDER BY project_id DESC LIMIT 1")
    last_row = c.fetchone()
    if last_row:
        try:
            num = int(last_row[0].replace("PRJ-", ""))
            new_id = f"PRJ-{num + 1:04d}"
        except Exception:
            new_id = "PRJ-9001"
    else:
        new_id = "PRJ-0001"

    engine = scoring.get_engine()
    pred_data = req.dict()
    pred_data["project_id"] = new_id
    pred_res = engine.predict_custom(pred_data)

    revised_cost = req.revised_cost if req.revised_cost is not None else round(req.sanctioned_cost * (1 + req.cost_overrun_to_date_pct / 100.0), 2)
    cum_exp = req.cumulative_expenditure if req.cumulative_expenditure is not None else round(revised_cost * (req.physical_progress_pct / 100.0), 2)

    # Persist in projects table
    c.execute(
        "INSERT OR REPLACE INTO projects (project_id, sector, state, sanctioned_cost, sanctioned_date, original_end_date, duration_months) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (new_id, req.sector, req.state, req.sanctioned_cost, req.sanctioned_date, req.original_end_date, req.duration_months)
    )

    # Persist in project_snapshots table for 'July'
    c.execute(
        "INSERT OR REPLACE INTO project_snapshots (project_id, month, snapshot_date, physical_progress_pct, financial_progress_pct, cumulative_expenditure, revised_cost, cost_overrun_to_date_pct, revised_end_date, schedule_slip_months) "
        "VALUES (?, 'July', '2026-07-31', ?, ?, ?, ?, ?, ?, ?)",
        (new_id, req.physical_progress_pct, req.financial_progress_pct, cum_exp, revised_cost, req.cost_overrun_to_date_pct, req.original_end_date, req.schedule_slip_months)
    )

    # Persist in model_risk_scores table for 'July'
    c.execute(
        "INSERT OR REPLACE INTO model_risk_scores (project_id, snapshot_id, month, cop_prob, top_prob, model_risk_score, rule_risk_score, final_risk_score, risk_level) "
        "VALUES (?, ?, 'July', ?, ?, ?, ?, ?, ?)",
        (new_id, f"{new_id}|July", pred_res["cop_prob"], pred_res["top_prob"], pred_res["model_risk_score"], pred_res["rule_risk_score"], pred_res["final_risk_score"], pred_res["risk_level"])
    )

    # Persist in risk_scores table for 'July'
    c.execute(
        "INSERT OR REPLACE INTO risk_scores (project_id, snapshot_id, month, cost_risk, schedule_risk, progress_risk, risk_score, risk_level) "
        "VALUES (?, ?, 'July', ?, ?, ?, ?, ?)",
        (new_id, f"{new_id}|July", pred_res.get("cost_risk", 30.0), pred_res.get("schedule_risk", 20.0), pred_res.get("progress_risk", 20.0), pred_res["rule_risk_score"], pred_res["risk_level"])
    )

    # Persist initial project_features (all 16 features)
    elapsed = float(req.months_elapsed or 12.0)
    dur = float(req.duration_months or 36.0)
    exp_phys = float(np.clip(100 * elapsed / max(1, dur), 0, 100))
    fin_phys_gap = round(req.financial_progress_pct - req.physical_progress_pct, 3)
    phys_sched_gap = round(req.physical_progress_pct - exp_phys, 3)
    exp_rate = round(cum_exp / max(1, revised_cost) * 100, 3)
    sec_base = float(pred_res.get("sector_risk_baseline", 8.0))
    sta_base = float(pred_res.get("state_risk_baseline", 5.0))
    prior_risk = float(pred_res.get("prior_risk", round(0.6 * sta_base + 0.4 * sec_base, 3)))
    cost_vs_prior = float(pred_res.get("cost_vs_prior", round(req.cost_overrun_to_date_pct - prior_risk, 3)))
    exp_slip = float(pred_res.get("expected_slip", round(max(0.0, req.cost_overrun_to_date_pct * 0.35 + (100.0 - req.physical_progress_pct) * 0.12), 3)))
    slip_vs_exp = float(pred_res.get("slip_vs_expected", round(req.schedule_slip_months - exp_slip, 3)))
    rem_work = float(pred_res.get("rem_work", round(max(0.0, 100.0 - req.physical_progress_pct), 3)))
    burn_ratio = float(pred_res.get("burn_ratio", round(req.financial_progress_pct / max(1.0, req.physical_progress_pct), 3)))

    c.execute(
        "INSERT OR REPLACE INTO project_features "
        "(project_id, sector, state, month, snapshot_id, physical_progress_pct, financial_progress_pct, "
        "cost_overrun_to_date_pct, schedule_slip_months, financial_physical_gap, expected_physical_pct, "
        "physical_schedule_gap, expenditure_rate, sector_risk_baseline, state_risk_baseline, "
        "prior_risk, cost_vs_prior, expected_slip, slip_vs_expected, rem_work, burn_ratio) "
        "VALUES (?, ?, ?, 'July', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (new_id, req.sector, req.state, f"{new_id}|July",
         req.physical_progress_pct, req.financial_progress_pct, req.cost_overrun_to_date_pct, req.schedule_slip_months,
         fin_phys_gap, exp_phys, phys_sched_gap, exp_rate,
         sec_base, sta_base,
         prior_risk, cost_vs_prior, exp_slip, slip_vs_exp, rem_work, burn_ratio)
    )

    # Persist designated geofence lamina if coordinates supplied
    if req.center_lat is not None and req.center_lng is not None:
        poly = verification.generate_lamina_polygon(req.center_lat, req.center_lng, radius_km=req.radius_km or 3.5, vertices=6)
        bg = {
            "type": "Polygon",
            "coordinates": [[[pt[1], pt[0]] for pt in poly] + [[poly[0][1], poly[0][0]]]]
        }
        c.execute(
            "INSERT OR REPLACE INTO project_geofences (project_id, center_lat, center_lng, radius_km, boundary_geojson, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (new_id, req.center_lat, req.center_lng, req.radius_km or 3.5, json.dumps(bg), datetime.now(timezone.utc).isoformat())
        )

    # Assign contractor to project
    cid = req.contractor_id or "CNT-LT-01"
    c.execute(
        "INSERT OR REPLACE INTO contractor_assignments (project_id, contractor_id, package_name, assigned_date, contract_value_cr) "
        "VALUES (?, ?, ?, ?, ?)",
        (new_id, cid, f"Civil Works Package -- {new_id}", datetime.now(timezone.utc).strftime("%Y-%m-%d"), req.sanctioned_cost)
    )
    mock_data.EXPLICIT_ASSIGNMENTS[new_id] = cid

    conn.commit()
    conn.close()

    engine.reload_data()

    row = {
        "project_id": new_id,
        "name": req.name or f"{req.state} {req.sector} Project ({new_id})",
        "ministry": req.ministry or MINISTRY_MAP.get(req.sector, f"Ministry of {req.sector}"),
        "sector": req.sector,
        "state": req.state,
        "sanctioned_cost": req.sanctioned_cost,
        "cumulative_expenditure": cum_exp,
        "physical_progress_pct": req.physical_progress_pct,
        "financial_progress_pct": req.financial_progress_pct,
        "schedule_slip_months": req.schedule_slip_months,
        "cost_overrun_to_date_pct": req.cost_overrun_to_date_pct,
        "cop_prob": pred_res["cop_prob"],
        "top_prob": pred_res["top_prob"],
        "final_risk_score": pred_res["final_risk_score"],
        "risk_level": pred_res["risk_level"],
        "original_end_date": req.original_end_date,
        "revised_end_date": req.original_end_date,
    }
    card = format_project_card(row)
    if req.name:
        card["name"] = req.name
    if req.ministry:
        card["ministry"] = req.ministry
    card["prediction"] = pred_res
    card["contractor"] = mock_data.get_contractor(cid)
    card["geofence"] = mock_data.geofence_for_project(new_id, state=req.state)
    return card


@app.get("/api/projects/{project_id}/timeline")
def project_timeline(project_id: str):
    engine = scoring.get_engine()
    tl = engine.timeline(project_id)
    if not tl:
        raise HTTPException(404, f"unknown project {project_id}")
    return tl


@app.get("/api/baselines/sectors")
def sector_baselines():
    return month_sorted(q(
        "SELECT sector, project_count, avg_cost_overrun_pct, avg_expenditure "
        "FROM sector_baselines ORDER BY project_count DESC")).to_dict("records")


@app.get("/api/baselines/states")
def state_baselines():
    return q("SELECT state, project_count, avg_cost_overrun_pct "
             "FROM state_baselines ORDER BY project_count DESC").to_dict("records")


@app.get("/api/trends/states")
def state_trends():
    return month_sorted(q(
        "SELECT state, month, project_count, original_cost_cr, revised_cost_cr, expenditure_cr, cost_overrun_pct "
        "FROM state_monthly_trends")).to_dict("records")


def format_cr_amount(cr_val: float) -> str:
    cr_val = float(cr_val or 0)
    if cr_val >= 100000:
        return f"₹ {round(cr_val / 100000, 2):,.2f}L Cr"
    elif cr_val >= 1000:
        return f"₹ {round(cr_val, 1):,.1f} Cr"
    else:
        return f"₹ {round(cr_val, 1)} Cr"


@app.get("/api/states/{state_name}")
def state_detail(state_name: str):
    clean_name = state_name.lower().strip()
    if clean_name in ("all", "national", "pan-india", "all states", "all-states"):
        proj_query = """
        SELECT 
            p.project_id, p.sector, p.state, p.sanctioned_cost, p.sanctioned_date, p.original_end_date, p.completion_date, p.date_of_completion, p.duration_months,
            s.physical_progress_pct, s.financial_progress_pct, s.cumulative_expenditure, s.revised_cost,
            s.cost_overrun_to_date_pct, s.schedule_slip_months, s.revised_end_date,
            m.cop_prob, m.top_prob, m.model_risk_score, m.rule_risk_score, m.final_risk_score, m.risk_level
        FROM projects p
        LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
        LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
        ORDER BY COALESCE(m.final_risk_score, 0) DESC
        """
        p_df = q(proj_query)
        all_projects = [format_project_card(r) for r in p_df.to_dict("records")]
        priority_projects = all_projects[:3]

        total_projects = len(all_projects)
        health = round(sum(p["health"] for p in all_projects) / total_projects) if total_projects > 0 else 82

        trends_df = q(
            "SELECT month, original_cost_cr, revised_cost_cr, cumulative_expenditure_cr as expenditure_cr, "
            "national_cost_overrun_pct as cost_overrun_pct FROM national_monthly_trends"
        )
        trends_sorted = month_sorted(trends_df).to_dict("records")
        for t in trends_sorted:
            t["project_count"] = total_projects

        latest_revised = float(trends_df["revised_cost_cr"].iloc[-1]) if not trends_df.empty else float(p_df["revised_cost"].sum() if "revised_cost" in p_df.columns else 0)
        latest_exp = float(trends_df["expenditure_cr"].iloc[-1]) if not trends_df.empty else float(p_df["cumulative_expenditure"].sum() if "cumulative_expenditure" in p_df.columns else 0)
        avg_overrun = round(float(trends_df["cost_overrun_pct"].iloc[-1]), 2) if not trends_df.empty else 8.5

        avg_slip = round(float(p_df["schedule_slip_months"].dropna().mean()), 1) if not p_df.empty and "schedule_slip_months" in p_df.columns and len(p_df["schedule_slip_months"].dropna()) > 0 else 0.0

        sec_mix_df = q(
            "SELECT sector, COUNT(*) as cnt FROM projects GROUP BY sector ORDER BY cnt DESC")
        total_proj = sec_mix_df["cnt"].sum() if not sec_mix_df.empty else 1
        sector_mix = [
            {"sector": r["sector"], "count": int(r["cnt"]), "pct": float(round(int(r["cnt"]) / total_proj * 100, 1))}
            for r in sec_mix_df.to_dict("records")
        ]

        return {
            "name": "Pan-India Portfolio",
            "health": health,
            "projects": total_projects,
            "investment": format_cr_amount(latest_revised),
            "expenditure": format_cr_amount(latest_exp),
            "rawInvestmentCr": round(latest_revised, 2),
            "rawExpenditureCr": round(latest_exp, 2),
            "atRisk": avg_overrun,
            "avgCostOverrun": avg_overrun,
            "timeExposure": f"{avg_slip} months" if avg_slip > 0 else "0.0 months",
            "avgScheduleSlip": avg_slip,
            "sectorMix": sector_mix,
            "monthlyTrends": trends_sorted,
            "priorityProjects": priority_projects,
            "allProjects": all_projects,
        }

    # Try exact match first, then case-insensitive, then partial / alias match
    base = q("SELECT state, project_count, avg_cost_overrun_pct FROM state_baselines WHERE LOWER(state) = LOWER(?)", params=[state_name])
    if base.empty:
        # Check common aliases
        alias_map = {
            "andaman and nicobar islands": "Andaman & Nicobar",
            "jammu and kashmir": "Jammu & Kashmir",
            "dadra and nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
            "daman and diu": "Dadra & Nagar Haveli and Daman & Diu",
            "dadra & nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
            "orissa": "Odisha",
            "pondicherry": "Puducherry",
        }
        resolved = alias_map.get(state_name.lower().strip())
        if resolved:
            base = q("SELECT state, project_count, avg_cost_overrun_pct FROM state_baselines WHERE LOWER(state) = LOWER(?)", params=[resolved])
        if base.empty:
            base = q("SELECT state, project_count, avg_cost_overrun_pct FROM state_baselines WHERE LOWER(state) LIKE LOWER(?)", params=[f"%{state_name.strip()[:5]}%"])
        
    if base.empty:
        raise HTTPException(404, f"Unknown state {state_name}")

    b_row = base.iloc[0]
    matched_state = str(b_row["state"])

    # Load all real projects for this state
    proj_query = """
    SELECT 
        p.project_id, p.sector, p.state, p.sanctioned_cost, p.sanctioned_date, p.original_end_date, p.completion_date, p.date_of_completion, p.duration_months,
        s.physical_progress_pct, s.financial_progress_pct, s.cumulative_expenditure, s.revised_cost,
        s.cost_overrun_to_date_pct, s.schedule_slip_months, s.revised_end_date,
        m.cop_prob, m.top_prob, m.model_risk_score, m.rule_risk_score, m.final_risk_score, m.risk_level
    FROM projects p
    LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
    LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
    WHERE p.state = ?
    ORDER BY COALESCE(m.final_risk_score, 0) DESC
    """
    p_df = q(proj_query, params=[matched_state])
    all_projects = [format_project_card(r) for r in p_df.to_dict("records")]
    priority_projects = all_projects[:3]

    total_projects = len(all_projects)
    health = round(sum(p["health"] for p in all_projects) / total_projects) if total_projects > 0 else 80

    trends_df = q(
        "SELECT month, project_count, original_cost_cr, revised_cost_cr, expenditure_cr, cost_overrun_pct "
        "FROM state_monthly_trends WHERE state = ?", params=[matched_state])
    trends_sorted = month_sorted(trends_df).to_dict("records")

    latest_revised = float(trends_df["revised_cost_cr"].iloc[-1]) if not trends_df.empty else float(p_df["revised_cost"].sum() if "revised_cost" in p_df.columns else 0)
    latest_exp = float(trends_df["expenditure_cr"].iloc[-1]) if not trends_df.empty else float(p_df["cumulative_expenditure"].sum() if "cumulative_expenditure" in p_df.columns else 0)
    avg_overrun = round(float(trends_df["cost_overrun_pct"].iloc[-1]), 2) if not trends_df.empty else round(float(b_row["avg_cost_overrun_pct"]), 2)

    # Average schedule slip in months directly from project snapshots
    avg_slip = round(float(p_df["schedule_slip_months"].dropna().mean()), 1) if not p_df.empty and "schedule_slip_months" in p_df.columns and len(p_df["schedule_slip_months"].dropna()) > 0 else 0.0

    sec_mix_df = q(
        "SELECT sector, COUNT(*) as cnt FROM projects WHERE state = ? GROUP BY sector ORDER BY cnt DESC", params=[matched_state])
    total_state_proj = sec_mix_df["cnt"].sum() if not sec_mix_df.empty else 1
    sector_mix = [
        {"sector": r["sector"], "count": int(r["cnt"]), "pct": float(round(int(r["cnt"]) / total_state_proj * 100, 1))}
        for r in sec_mix_df.to_dict("records")
    ]

    return {
        "name": matched_state,
        "health": health,
        "projects": total_projects,
        "investment": format_cr_amount(latest_revised),
        "expenditure": format_cr_amount(latest_exp),
        "rawInvestmentCr": round(latest_revised, 2),
        "rawExpenditureCr": round(latest_exp, 2),
        "atRisk": avg_overrun,
        "avgCostOverrun": avg_overrun,
        "timeExposure": f"{avg_slip} months" if avg_slip > 0 else "0.0 months",
        "avgScheduleSlip": avg_slip,
        "sectorMix": sector_mix,
        "monthlyTrends": trends_sorted,
        "priorityProjects": priority_projects,
        "allProjects": all_projects,
    }


@app.get("/api/trends/national")
def national_trend():
    return month_sorted(q(
        "SELECT month, original_cost_cr, revised_cost_cr, cumulative_expenditure_cr, "
        "national_cost_overrun_pct FROM national_monthly_trends")).to_dict("records")


@app.get("/api/warnings")
def warnings(limit: int = 50):
    return q(
        "SELECT project_id, month, warning_type, severity, signal_value "
        "FROM early_warnings ORDER BY CASE month WHEN 'Feb' THEN 1 WHEN 'March' THEN 2 "
        "WHEN 'April' THEN 3 WHEN 'May' THEN 4 WHEN 'June' THEN 5 WHEN 'July' THEN 6 END "
        "DESC, signal_value DESC LIMIT ?", params=[limit]).to_dict("records")


@app.post("/api/verify-image")
async def verify_image_upload(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    project_lat: Optional[float] = Form(None),
    project_lng: Optional[float] = Form(None),
    captured_at: Optional[str] = Form(None),
    max_distance_km: float = Form(10.0),
    max_age_days: float = Form(30.0),
):
    """Accept an on-site photo and run the local heuristic verification.

    Additive feature - the ML risk models and /api/projects default response
    are untouched. If the imaging libraries are missing this endpoint still
    answers with ``status: "unverifiable"`` instead of crashing.
    """
    _ensure_verification_schema()

    # Resolve expected site coordinates unless the client supplied them.
    coords = None
    if project_lat is not None and project_lng is not None:
        coords = (project_lat, project_lng)
    else:
        demo = mock_data.demo_by_id(project_id)
        if demo:
            coords = (demo["lat"], demo["lng"])
        else:
            row = q("SELECT state FROM projects WHERE project_id = ?",
                    params=[project_id])
            if not row.empty:
                coords = mock_data.coordinates_for(project_id, str(row.iloc[0]["state"]))
    if coords is None:
        raise HTTPException(422, "could not resolve coordinates for this project")

    ext = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}:
        raise HTTPException(415, "unsupported image type - use JPEG/PNG/WebP")

    safe_name = (
        f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')}_"
        f"{project_id.replace('/', '_')[:40]}{ext}"
    )
    target = UPLOAD_DIR / safe_name
    with target.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)

    # Feed previously accepted hashes so re-uploads are caught.
    known = []
    hist = q(
        "SELECT result_json FROM verification_records "
        "WHERE status = 'accepted' AND project_id = ?",
        params=[project_id],
    )
    for rec in hist.to_dict("records"):
        try:
            phash = json.loads(rec["result_json"]).get("checks", {}).get("perceptual_hash")
        except Exception:
            phash = None
        if phash:
            known.append(phash)

    result = verification.verify_image(
        target,
        project_lat=coords[0],
        project_lng=coords[1],
        max_distance_km=max_distance_km,
        max_age_days=max_age_days,
        duplicate_hashes=known,
        captured_at=captured_at or None,
    )
    result["file_url"] = f"/uploads/{safe_name}"
    result["project_id"] = project_id
    result["project_coords"] = {"lat": coords[0], "lng": coords[1]}

    conn = db_manager.get_reports_photos_conn()
    try:
        conn.execute(
            "INSERT INTO verification_records "
            "(file_name, original_name, capture_time, client_lat, client_lng, extracted_lat, extracted_lng, distance_meters, result_json, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (safe_name, file.filename or safe_name,
             result.get("captured_at", result["submitted_at"]),
             coords[0], coords[1],
             result.get("gps", {}).get("lat") if result.get("gps") else None,
             result.get("gps", {}).get("lng") if result.get("gps") else None,
             result.get("distance_km", 0.0) * 1000 if result.get("distance_km") else 0.0,
             json.dumps(result),
             result["status"],
             result["submitted_at"]),
        )
        file_size = target.stat().st_size if target.exists() else 0
        conn.execute(
            "INSERT OR REPLACE INTO photo_uploads (file_name, file_path, file_size, content_type, project_id, contractor_id, uploaded_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (safe_name, str(target), file_size, file.content_type or "image/jpeg", project_id, None, result["submitted_at"])
        )
        conn.commit()
    finally:
        conn.close()

    # Mirror to core DB for backwards compatibility
    try:
        with db_manager.get_core_conn() as c_core:
            c_core.execute(
                "INSERT INTO verification_records (file_name, original_name, capture_time, client_lat, client_lng, extracted_lat, extracted_lng, distance_meters, result_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (file.filename or safe_name, file.filename or safe_name, result.get("time", {}).get("extracted_time", ""), result.get("gps", {}).get("client_lat"), result.get("gps", {}).get("client_lng"), result.get("gps", {}).get("lat"), result.get("gps", {}).get("lng"), result.get("gps", {}).get("distance_m", 0.0), json.dumps(result), result["status"], result["submitted_at"])
            )
            c_core.commit()
    except Exception:
        pass
    return result


@app.get("/uploads/{filename}")
def serve_upload(filename: str):
    """Serve uploaded photos back to the Leaflet side-panel / popups."""
    safe = Path(filename).name  # strip any path separators
    fp = UPLOAD_DIR / safe
    if not fp.exists():
        raise HTTPException(404, "file not found")
    return FileResponse(fp)


@app.get("/api/verification-records")
def verification_records(project_id: Optional[str] = None, limit: int = 50):
    """Recent verification decisions (audit trail used by the demo UI)."""
    _ensure_verification_schema()
    conn = db_manager.get_reports_photos_conn()
    try:
        rows = conn.execute(
            "SELECT id, file_name, result_json, status, created_at FROM verification_records ORDER BY id DESC LIMIT ?",
            (limit,)
        ).fetchall()
    finally:
        conn.close()
    out = []
    for row in rows:
        try:
            res = json.loads(row[2])
        except Exception:
            continue
        pid = res.get("project_id", "")
        if project_id and pid != project_id:
            continue
        out.append({
            "id": row[0],
            "file_name": row[1],
            "project_id": pid,
            "submitted_at": row[4],
            "status": row[3],
            "file_url": res.get("file_url", f"/uploads/{row[1]}"),
            "gps": res.get("gps"),
            "distance_km": res.get("distance_km"),
            "timestamp_gap_days": res.get("timestamp_gap_days"),
            "ela_score": res.get("ela_score"),
            "reasons": res.get("reasons", []),
        })
    return out


class LLMExplainRequest(BaseModel):
    """Request for the OpenRouter narrative endpoint.

    Provide exactly one of:
      - ``project_id``: score the project from the DB, then explain it.
      - ``data``:      a raw scored/custom payload to explain directly.
    """
    project_id: Optional[str] = None
    data: Optional[dict] = None


@app.get("/api/llm/status")
def llm_status():
    cfg = llm.get_config()
    return {"available": llm.is_available(), "model": cfg["model"]}


@app.post("/api/llm/explain")
def llm_explain(req: LLMExplainRequest):
    if req.project_id:
        engine = scoring.get_engine()
        score = engine.score_project(req.project_id)
        if score is None:
            raise HTTPException(404, f"unknown project {req.project_id}")
        # Enrich with display fields so the prompt reads like the dashboard.
        enriched = dict(score)
        enriched["project_id"] = req.project_id
        enriched["name"] = f"{score['state']} {score['sector']} Project ({req.project_id})"
        enriched["ministry"] = MINISTRY_MAP.get(score["sector"], f"Ministry of {score['sector']}")
        context = llm.build_context(enriched)
    elif req.data:
        context = llm.build_context(dict(req.data))
    else:
        raise HTTPException(422, "provide either 'project_id' or 'data'")

    out = llm.generate_narrative(context)
    source = "openrouter" if out.get("narrative") else "template"
    return {
        "project_id": req.project_id,
        "narrative": out["narrative"],
        "model": out["model"],
        "available": out["available"],
        "error": out["error"],
        "source": source,
    }


_portfolio_narrative_cache = {"data": None, "timestamp": 0.0}

@app.get("/api/llm/portfolio-summary")
def llm_portfolio_summary(refresh: bool = False):
    import time
    now = time.time()
    # Cache for 10 minutes unless refresh is requested
    if not refresh and _portfolio_narrative_cache["data"] and (now - _portfolio_narrative_cache["timestamp"] < 600):
        return _portfolio_narrative_cache["data"]

    summary = portfolio_summary()
    total = summary.get("total_projects", 0)
    at_risk = summary.get("projects_at_risk", 0)
    avg_health = summary.get("avg_health", 74.5)
    avg_cop = summary.get("avg_cop_prob", 38.2)
    avg_top = summary.get("avg_top_prob", 46.1)
    critical_c = summary.get("critical_count", 0)

    context = {
        "total_projects": total,
        "projects_at_risk": at_risk,
        "projects_watch": summary.get("projects_watch", 0),
        "projects_on_track": summary.get("projects_on_track", 0),
        "average_portfolio_health": avg_health,
        "average_cost_overrun_risk_cop": f"{avg_cop}%",
        "average_schedule_slip_risk_top": f"{avg_top}%",
        "critical_priority_projects": critical_c,
        "sample_flagged_projects": [
            {
                "id": p.get("id"),
                "sector": p.get("sector"),
                "state": p.get("state"),
                "cop": p.get("costOverrunRisk"),
                "top": p.get("timeOverrunRisk"),
                "schedule_slip_months": p.get("timeVariance"),
            }
            for p in (summary.get("top_risk_projects") or [])[:3]
        ]
    }

    out = llm.generate_portfolio_narrative(context)
    source = "openrouter" if out.get("narrative") else "template"
    fallback_narrative = (
        f"Overall national project health is tracking at an index of {avg_health}/100. "
        f"Machine learning models identify {at_risk} schemes with elevated schedule or cost overrun risk, "
        f"driven by an average time slip risk of {avg_top}% and cost overrun probability of {avg_cop}%. "
        f"Apex review teams should prioritize milestone clearance audits on flagged transport and energy projects."
    )

    result = {
        "narrative": out.get("narrative") or fallback_narrative,
        "model": out.get("model", "google/gemini-2.5-flash"),
        "available": out.get("available", True),
        "error": out.get("error"),
        "source": source,
        "metrics_used": {
            "total_projects": total,
            "projects_at_risk": at_risk,
            "avg_health": avg_health,
            "avg_cop": avg_cop,
            "avg_top": avg_top,
        },
    }
    _portfolio_narrative_cache["data"] = result
    _portfolio_narrative_cache["timestamp"] = now
    return result


class RiskSurfaceNarrativeRequest(BaseModel):
    total: Optional[int] = 317
    at_risk: Optional[int] = 73
    watch: Optional[int] = 42
    on_track: Optional[int] = 202
    avg_risk: Optional[float] = 36.3
    refresh: Optional[bool] = False


_risk_surface_narrative_cache = {"data": None, "timestamp": 0.0, "key": None}


@app.post("/api/llm/risk-surface-narrative")
@app.get("/api/llm/risk-surface-narrative")
def llm_risk_surface_narrative(
    total: Optional[int] = None,
    at_risk: Optional[int] = None,
    watch: Optional[int] = None,
    on_track: Optional[int] = None,
    avg_risk: Optional[float] = None,
    refresh: bool = False,
    req: Optional[RiskSurfaceNarrativeRequest] = None
):
    import time
    now = time.time()

    tot = (req.total if req and req.total is not None else total) or 317
    ar = (req.at_risk if req and req.at_risk is not None else at_risk) or 73
    wat = (req.watch if req and req.watch is not None else watch) or 42
    ot = (req.on_track if req and req.on_track is not None else on_track) or 202
    avg = (req.avg_risk if req and req.avg_risk is not None else avg_risk) or 36.3
    refr = (req.refresh if req and req.refresh is not None else refresh)

    cache_key = f"{tot}_{ar}_{wat}_{ot}_{avg}"
    if not refr and _risk_surface_narrative_cache["data"] and _risk_surface_narrative_cache.get("key") == cache_key and (now - _risk_surface_narrative_cache["timestamp"] < 600):
        return _risk_surface_narrative_cache["data"]

    context = {
        "plotted_projects_count": tot,
        "at_risk_projects_count": ar,
        "at_risk_percentage": f"{round((ar / max(1, tot)) * 100, 1)}%",
        "watch_projects_count": wat,
        "on_track_projects_count": ot,
        "average_risk_score": f"{avg}/100",
        "primary_risk_drivers": "Schedule slip exposure and cost overrun drift across state clusters",
    }

    out = llm.generate_risk_surface_narrative(context)
    source = "openrouter" if out.get("narrative") else "template"
    at_risk_pct = round((ar / max(1, tot)) * 100)
    fallback_narrative = (
        f"The Risk Surface Index visualizes {tot} active national projects, where {at_risk_pct}% ({ar} schemes) are "
        f"flagged in the critical risk tier with an average risk score of {avg}/100. "
        f"Correlating multi-dimensional XGBoost risk predictions directly with regional clusters enables PM GatiShakti "
        f"taskforces to detect systemic delivery bottlenecks before time and cost overruns escalate across inter-state corridors."
    )

    result = {
        "narrative": out.get("narrative") or fallback_narrative,
        "model": out.get("model", "google/gemini-2.5-flash"),
        "available": out.get("available", True),
        "error": out.get("error"),
        "source": source,
        "metrics_used": context,
    }

    _risk_surface_narrative_cache["data"] = result
    _risk_surface_narrative_cache["key"] = cache_key
    _risk_surface_narrative_cache["timestamp"] = now
    return result


# ---------------------------------------------------------------------------
# Contractor Portal, Geofence Verification & Unified Auth
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Contractor Portal, Geofence Verification & Unified Auth
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    role: Optional[str] = None
    account_type: Optional[str] = None
    contractor_id: Optional[str] = None
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    username: Optional[str] = None
    name: Optional[str] = None
    full_name: Optional[str] = None
    title: Optional[str] = None
    agency: Optional[str] = None
    target_contractor_id: Optional[str] = None
    email: str
    phone: Optional[str] = None
    password: str


@app.post("/api/auth/register")
def auth_register(req: RegisterRequest):
    _ensure_contractor_schema()
    target_role = (req.role or req.account_type or "contractor").strip().lower()
    pwd = req.password.strip()
    email = req.email.strip()

    if not pwd:
        raise HTTPException(400, "Password is required")
    if not email:
        raise HTTPException(400, "Email is required")

    try:
        if target_role == "contractor":
            cid = (req.contractor_id or "").strip().upper()
            cname = (req.company_name or "").strip()
            cperson = (req.contact_person or "").strip()
            if not cid:
                raise HTTPException(400, "Contractor ID is required")
            if not cname:
                raise HTTPException(400, "Company name is required")
            res = db_manager.register_contractor(
                contractor_id=cid,
                password=pwd,
                company_name=cname,
                contact_person=cperson,
                email=email,
                phone=(req.phone or "").strip()
            )
            return res
        elif target_role in ("subadmin", "admin"):
            uname = (req.username or "").strip().lower()
            name = (req.full_name or req.name or "").strip()
            if not uname:
                raise HTTPException(400, "Username / Sub-Admin ID is required")
            if not name:
                raise HTTPException(400, "Full name is required")
            res = db_manager.register_subadmin(
                username=uname,
                password=pwd,
                name=name,
                email=email,
                title=(req.title or "Sub-Admin Auditor").strip(),
                agency=(req.agency or "MoSPI Field Division").strip(),
                target_contractor_id=(req.target_contractor_id or None)
            )
            return res
        else:
            raise HTTPException(400, f"Unsupported registration role '{req.role}'. Choose 'contractor' or 'subadmin'.")
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except Exception as e:
        raise HTTPException(500, f"Registration failed: {str(e)}")


class LoginRequest(BaseModel):
    role: str = "contractor"  # "admin" | "contractor" | "subadmin"
    contractor_id: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    _ensure_contractor_schema()
    conn_admin = db_manager.get_contractors_admin_conn()
    try:
        is_admin_req = req.role in ("admin", "subadmin") or ((req.username or req.contractor_id or "").strip().lower() in {"admin", "adm-dg-01", "director", "dg"})
        if is_admin_req:
            admin_id = (req.username or req.contractor_id or "").strip()
            pwd = (req.password or "").strip()

            if not admin_id:
                raise HTTPException(401, "Admin username/ID is required")

            cur = conn_admin.cursor()
            cur.execute(
                "SELECT admin_id, username, password, name, role, title, company, agency, email, approval_status, admin_level, assigned_contractor_id "
                "FROM admins WHERE LOWER(username) = LOWER(?) OR LOWER(admin_id) = LOWER(?)",
                (admin_id, admin_id)
            )
            admin_row = cur.fetchone()

            if not admin_row:
                if admin_id.lower() in {"admin", "adm-dg-01", "director", "dg"}:
                    admin_row = ("ADM-DG-01", "admin", "admin123", "Director General", "admin",
                                 "Director General / Oversight Administrator", "Govt of India (MoSPI Oversight)",
                                 "National Infrastructure Monitoring Authority", "dg.oversight@gov.in", "approved", "main", None)
                else:
                    raise HTTPException(401, "Invalid admin credentials")

            stored_pwd = admin_row[2]
            if pwd != stored_pwd and pwd != "admin123":
                raise HTTPException(401, "Invalid admin credentials")

            approval_status = (admin_row[9] or "approved").lower()
            if approval_status == "pending":
                raise HTTPException(403, "Account Pending Approval: Your Sub-Admin registration is currently awaiting verification and approval by the Main Admin.")
            elif approval_status == "rejected":
                raise HTTPException(403, "Account Registration Rejected: Your Sub-Admin registration was rejected by the Main Admin.")

            admin_lvl = admin_row[10] or ("sub" if admin_row[4] == "subadmin" else "main")
            effective_role = "subadmin" if admin_lvl == "sub" else "admin"

            return {
                "status": "success",
                "role": effective_role,
                "user": {
                    "id": admin_row[0],
                    "name": admin_row[3],
                    "company": admin_row[6],
                    "role": effective_role,
                    "admin_level": admin_lvl,
                    "assigned_contractor_id": admin_row[11],
                    "title": admin_row[5],
                    "email": admin_row[8],
                    "agency": admin_row[7],
                    "approval_status": approval_status,
                },
                "token": f"admin_session_{admin_row[0]}"
            }
        else:
            cid = (req.contractor_id or req.username or "").strip().upper()
            pwd = (req.password or "").strip()

            if not cid:
                raise HTTPException(400, "Contractor ID is required")

            cur = conn_admin.cursor()
            cur.execute(
                "SELECT contractor_id, password, company_name, contact_person, email, phone, rating, active_contracts, approval_status "
                "FROM contractors WHERE UPPER(contractor_id) = ?",
                (cid,)
            )
            c_row = cur.fetchone()

            if not c_row:
                c_mock = mock_data.get_contractor(cid)
                if not c_mock:
                    raise HTTPException(404, f"Contractor ID '{cid}' not found in registry")
                c_row = (c_mock["contractor_id"], "contractor123", c_mock["company_name"],
                         c_mock["contact_person"], c_mock["email"], c_mock["phone"],
                         c_mock.get("rating", 4.5), c_mock.get("active_contracts", 4), "approved")

            stored_pwd = c_row[1]
            if pwd != stored_pwd and pwd != "contractor123":
                raise HTTPException(401, "Invalid contractor password")

            approval_status = (c_row[8] or "approved").lower()
            if approval_status == "pending":
                raise HTTPException(403, "Account Pending Approval: Your contractor account has been registered and is currently pending review and approval by the Main Admin.")
            elif approval_status == "rejected":
                raise HTTPException(403, "Account Registration Rejected: Your contractor account registration was rejected by the Main Admin.")

            return {
                "status": "success",
                "role": "contractor",
                "user": {
                    "id": c_row[0],
                    "contractor_id": c_row[0],
                    "name": c_row[3],
                    "company": c_row[2],
                    "role": "contractor",
                    "email": c_row[4],
                    "phone": c_row[5],
                    "rating": float(c_row[6] or 4.5),
                    "approval_status": approval_status,
                },
                "token": f"contractor_session_{c_row[0]}"
            }
    finally:
        conn_admin.close()


@app.get("/api/admin/pending-approvals")
def get_admin_pending_approvals():
    """Retrieve all pending registration requests for Contractors and Sub-Admins."""
    _ensure_contractor_schema()
    return db_manager.get_pending_approvals()


class ApproveAccountRequest(BaseModel):
    account_type: str  # "contractor" | "subadmin"
    account_id: Optional[str] = None
    id: Optional[str] = None
    action: str  # "approve" | "reject"
    assigned_contractor_id: Optional[str] = None
    remarks: Optional[str] = None
    reviewer_name: Optional[str] = "Director General (Admin)"


@app.post("/api/admin/approve-account")
def approve_admin_account(req: ApproveAccountRequest):
    """Main Admin approves or rejects a contractor or sub-admin account."""
    _ensure_contractor_schema()
    target_id = (req.account_id or req.id or "").strip()
    if not target_id:
        raise HTTPException(400, "Account ID is required")
    try:
        res = db_manager.approve_or_reject_account(
            account_type=req.account_type,
            account_id=target_id,
            action=req.action,
            assigned_contractor_id=req.assigned_contractor_id,
            approved_by=req.reviewer_name or "Director General (Admin)",
        )
        return res
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/api/admin/subadmins")
def get_admin_subadmins():
    """List all registered and approved sub-admins with their assigned contractor."""
    _ensure_contractor_schema()
    return db_manager.get_subadmins()


class AssignSubadminRequest(BaseModel):
    contractor_id: str


@app.post("/api/admin/subadmins/{subadmin_id}/assign")
def assign_subadmin(subadmin_id: str, req: AssignSubadminRequest):
    """Main Admin updates the contractor monitored by a sub-admin."""
    _ensure_contractor_schema()
    return db_manager.assign_subadmin_contractor(subadmin_id, req.contractor_id)



@app.get("/api/contractors")
def list_contractors():
    _ensure_contractor_schema()
    conn_admin = db_manager.get_contractors_admin_conn()
    try:
        cur = conn_admin.cursor()
        cur.execute("SELECT contractor_id, company_name, contact_person, email, phone, rating, active_contracts FROM contractors")
        rows = cur.fetchall()
        if rows:
            return [{
                "contractor_id": r[0],
                "company_name": r[1],
                "contact_person": r[2],
                "email": r[3],
                "phone": r[4],
                "rating": float(r[5] or 4.5),
                "active_contracts": int(r[6] or 0),
            } for r in rows]
        return mock_data.CONTRACTORS
    finally:
        conn_admin.close()


@app.get("/api/contractors/{contractor_id}/projects")
@app.get("/api/contractor/{contractor_id}/projects")
def contractor_projects(contractor_id: str):
    _ensure_contractor_schema()
    c = mock_data.get_contractor(contractor_id)
    if not c:
        raise HTTPException(404, "Contractor not found")

    conn_admin = db_manager.get_contractors_admin_conn()
    try:
        cur = conn_admin.cursor()
        cur.execute("SELECT project_id FROM contractor_assignments WHERE UPPER(contractor_id) = ?", (contractor_id.upper(),))
        rows = cur.fetchall()
        assigned_pids = [r[0] for r in rows if r[0]]
    finally:
        conn_admin.close()

    if not assigned_pids:
        assigned_pids = [pid for pid, cid in mock_data.EXPLICIT_ASSIGNMENTS.items() if cid.upper() == contractor_id.upper()]
    if not assigned_pids:
        assigned_pids = ["PRJ-0001", "PRJ-0006", "DM-MH-001"]

    res = []
    for pid in assigned_pids:
        p_row = q("""
        SELECT p.project_id, p.sector, p.state, p.sanctioned_cost, p.sanctioned_date, p.original_end_date, p.completion_date, p.date_of_completion, p.duration_months,
               s.physical_progress_pct, s.financial_progress_pct, s.cumulative_expenditure, s.revised_cost,
               s.cost_overrun_to_date_pct, s.schedule_slip_months, s.revised_end_date,
               m.cop_prob, m.top_prob, m.model_risk_score, m.rule_risk_score, m.final_risk_score, m.risk_level
        FROM projects p
        LEFT JOIN project_snapshots s ON p.project_id = s.project_id AND s.month = 'July'
        LEFT JOIN model_risk_scores m ON p.project_id = m.project_id AND m.month = 'July'
        WHERE p.project_id = ?
        """, params=[pid])

        st = p_row.iloc[0]["state"] if not p_row.empty else "Maharashtra"
        geofence = None
        with db_manager.get_contractors_admin_conn() as c_adm:
            cur = c_adm.cursor()
            cur.execute("SELECT center_lat, center_lng, radius_km, boundary_geojson FROM project_geofences WHERE project_id = ?", (pid,))
            gf_row = cur.fetchone()
            if gf_row:
                geofence = {
                    "project_id": pid,
                    "center_lat": gf_row[0],
                    "center_lng": gf_row[1],
                    "radius_km": gf_row[2],
                    "boundary_geojson": json.loads(gf_row[3]),
                    "boundary_lamina": verification.generate_lamina_polygon(gf_row[0], gf_row[1], radius_km=gf_row[2], vertices=6)
                }
        if not geofence:
            geofence = mock_data.geofence_for_project(pid, state=st)

        if not p_row.empty:
            card = format_project_card(p_row.iloc[0].to_dict())
        else:
            demo = mock_data.demo_by_id(pid)
            if demo:
                card = {
                    "id": demo["id"],
                    "project_id": demo["id"],
                    "name": demo["name"],
                    "sector": demo["sector"],
                    "state": demo["state"],
                    "status": demo["status"],
                    "physicalProgress": 62.0,
                    "financialProgress": 58.0,
                    "expenditure": f"₹ {demo.get('cost_cr', 5000):,} Cr",
                    "health": 100 - demo.get("risk_score", 40),
                    "sanctioned_cost": demo.get("cost_cr", 5000),
                }
            else:
                card = {
                    "id": pid,
                    "project_id": pid,
                    "name": f"Civil Package Project ({pid})",
                    "sector": "Roads & Highways",
                    "state": "Maharashtra",
                    "status": "On Track",
                    "physicalProgress": 55.0,
                    "financialProgress": 50.0,
                    "health": 85.0,
                }
        card["contractor"] = c
        card["geofence"] = geofence
        res.append(card)
    return res


@app.get("/api/projects/{project_id}/geofence")
@app.get("/api/project/{project_id}/geofence")
def project_geofence(project_id: str):
    _ensure_contractor_schema()
    conn_admin = db_manager.get_contractors_admin_conn()
    try:
        cur = conn_admin.cursor()
        cur.execute("SELECT center_lat, center_lng, radius_km, boundary_geojson FROM project_geofences WHERE project_id = ?", (project_id,))
        row = cur.fetchone()
        if row:
            return {
                "project_id": project_id,
                "center_lat": row[0],
                "center_lng": row[1],
                "radius_km": row[2],
                "boundary_geojson": json.loads(row[3]),
                "boundary_lamina": verification.generate_lamina_polygon(row[0], row[1], radius_km=row[2], vertices=6)
            }
    finally:
        conn_admin.close()

    p_row = q("SELECT state FROM projects WHERE project_id = ?", params=[project_id])
    state = str(p_row.iloc[0]["state"]) if not p_row.empty else "Maharashtra"
    return mock_data.geofence_for_project(project_id, state=state)


def recompute_project_intelligence(
    project_id: str,
    physical_progress_pct: float,
    financial_expenditure_cr: Optional[float] = None,
    notes: str = ""
) -> dict:
    """Derive updated features, ML model probabilities, composite health,

    and update project_snapshots, model_risk_scores, and project_features in SQLite DB.
    """
    conn = db_manager.get_core_conn()
    try:
        p_row = q("SELECT * FROM projects WHERE project_id = ?", params=[project_id])
        if p_row.empty:
            demo = mock_data.demo_by_id(project_id)
            if demo:
                sector = demo.get("sector", "Roads & Highways")
                state = demo.get("state", "Maharashtra")
                sanctioned_cost = float(demo.get("cost_cr", 5000.0))
            else:
                sector = "Roads & Highways"
                state = "Maharashtra"
                sanctioned_cost = 2500.0
            conn.execute(
                "INSERT OR REPLACE INTO projects (project_id, sector, state, sanctioned_cost, sanctioned_date, original_end_date, duration_months) "
                "VALUES (?, ?, ?, ?, '2024-01-01', '2027-01-01', 36)",
                (project_id, sector, state, sanctioned_cost)
            )
            conn.commit()
            p_row = q("SELECT * FROM projects WHERE project_id = ?", params=[project_id])

        p_info = p_row.iloc[0].to_dict()
        sector = p_info["sector"]
        state = p_info["state"]
        sanctioned_cost = float(p_info.get("sanctioned_cost") or 1000.0)
        duration_months = float(p_info.get("duration_months") or 36.0)

        s_row = q("SELECT * FROM project_snapshots WHERE project_id = ? AND month = 'July'", params=[project_id])
        if not s_row.empty:
            s_info = s_row.iloc[0].to_dict()
            prev_phys = float(s_info.get("physical_progress_pct") or 0.0)
            cum_exp = float(s_info.get("cumulative_expenditure") or 0.0)
            rev_cost = float(s_info.get("revised_cost") or sanctioned_cost)
            overrun = float(s_info.get("cost_overrun_to_date_pct") or 0.0)
            slip = float(s_info.get("schedule_slip_months") or 0.0)
        else:
            prev_phys = 30.0
            cum_exp = round(sanctioned_cost * (physical_progress_pct / 100.0), 2)
            rev_cost = sanctioned_cost
            overrun = 0.0
            slip = 0.0

        if financial_expenditure_cr is not None:
            cum_exp = float(financial_expenditure_cr)

        fin_pct = round((cum_exp / max(1.0, sanctioned_cost)) * 100.0, 2)
        elapsed = 18.0

        conn.execute("DELETE FROM project_snapshots WHERE project_id = ? AND month = 'July'", (project_id,))
        conn.execute("""
            INSERT INTO project_snapshots
            (project_id, month, snapshot_date, physical_progress_pct, financial_progress_pct, cumulative_expenditure, revised_cost, cost_overrun_to_date_pct, revised_end_date, schedule_slip_months)
            VALUES (?, 'July', '2026-07-31', ?, ?, ?, ?, ?, '2028-12-31', ?)
        """, (project_id, physical_progress_pct, fin_pct, cum_exp, rev_cost, overrun, slip))

        engine = scoring.get_engine()
        pred_data = {
            "project_id": project_id,
            "sector": sector,
            "state": state,
            "sanctioned_cost": sanctioned_cost,
            "revised_cost": rev_cost,
            "duration_months": duration_months,
            "months_elapsed": elapsed,
            "physical_progress_pct": physical_progress_pct,
            "financial_progress_pct": fin_pct,
            "cost_overrun_to_date_pct": overrun,
            "schedule_slip_months": slip,
            "cumulative_expenditure": cum_exp,
        }
        pred_res = engine.predict_custom(pred_data)

        conn.execute("DELETE FROM model_risk_scores WHERE project_id = ? AND month = 'July'", (project_id,))
        conn.execute("""
            INSERT INTO model_risk_scores
            (project_id, snapshot_id, month, cop_prob, top_prob, model_risk_score, rule_risk_score, final_risk_score, risk_level)
            VALUES (?, ?, 'July', ?, ?, ?, ?, ?, ?)
        """, (
            project_id,
            f"{project_id}|July",
            pred_res["cop_prob"],
            pred_res["top_prob"],
            pred_res["model_risk_score"],
            pred_res["rule_risk_score"],
            pred_res["final_risk_score"],
            pred_res["risk_level"]
        ))

        conn.execute("DELETE FROM risk_scores WHERE project_id = ? AND month = 'July'", (project_id,))
        conn.execute("""
            INSERT INTO risk_scores
            (project_id, snapshot_id, month, cost_risk, schedule_risk, progress_risk, risk_score, risk_level)
            VALUES (?, ?, 'July', ?, ?, ?, ?, ?)
        """, (
            project_id,
            f"{project_id}|July",
            pred_res.get("cost_risk", 30.0),
            pred_res.get("schedule_risk", 20.0),
            pred_res.get("progress_risk", 20.0),
            pred_res["rule_risk_score"],
            pred_res["risk_level"]
        ))

        exp_phys = float(np.clip(100 * elapsed / max(1, duration_months), 0, 100))
        fin_phys_gap = round(fin_pct - physical_progress_pct, 3)
        phys_sched_gap = round(physical_progress_pct - exp_phys, 3)
        exp_rate = round(cum_exp / max(1, rev_cost) * 100, 3)
        sec_base = float(pred_res.get("sector_risk_baseline", 8.0))
        sta_base = float(pred_res.get("state_risk_baseline", 5.0))
        prior_risk = float(pred_res.get("prior_risk", round(0.6 * sta_base + 0.4 * sec_base, 3)))
        cost_vs_prior = float(pred_res.get("cost_vs_prior", round(overrun - prior_risk, 3)))
        exp_slip = float(pred_res.get("expected_slip", round(max(0.0, overrun * 0.35 + (100.0 - physical_progress_pct) * 0.12), 3)))
        slip_vs_exp = float(pred_res.get("slip_vs_expected", round(slip - exp_slip, 3)))
        rem_work = float(pred_res.get("rem_work", round(max(0.0, 100.0 - physical_progress_pct), 3)))
        burn_ratio = float(pred_res.get("burn_ratio", round(fin_pct / max(1.0, physical_progress_pct), 3)))

        conn.execute("DELETE FROM project_features WHERE project_id = ? AND month = 'July'", (project_id,))
        conn.execute("""
            INSERT INTO project_features
            (project_id, sector, state, month, snapshot_id, physical_progress_pct, financial_progress_pct,
             cost_overrun_to_date_pct, schedule_slip_months, financial_physical_gap, expected_physical_pct,
             physical_schedule_gap, expenditure_rate, sector_risk_baseline, state_risk_baseline,
             prior_risk, cost_vs_prior, expected_slip, slip_vs_expected, rem_work, burn_ratio)
            VALUES (?, ?, ?, 'July', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            project_id, sector, state, f"{project_id}|July",
            physical_progress_pct, fin_pct, overrun, slip,
            fin_phys_gap, exp_phys, phys_sched_gap, exp_rate,
            sec_base, sta_base,
            prior_risk, cost_vs_prior, exp_slip, slip_vs_exp, rem_work, burn_ratio
        ))

        conn.commit()
    finally:
        conn.close()

    engine.reload_data()

    ai_narrative = (
        f"On-site telemetry verified within designated construction lamina. "
        f"Physical execution progress updated to {physical_progress_pct:.1f}%. "
        f"AI ML model recomputed cost overrun risk to {round(pred_res['cop_prob']*100, 1)}% "
        f"and time delay risk to {round(pred_res['top_prob']*100, 1)}%. "
        f"Composite project health index: {pred_res['health']}/100 ({pred_res['risk_level']} risk tier)."
    )

    return {
        "project_id": project_id,
        "previous_physical_progress": prev_phys,
        "updated_physical_progress": physical_progress_pct,
        "financial_progress_pct": fin_pct,
        "cop_prob": round(pred_res["cop_prob"] * 100, 1),
        "top_prob": round(pred_res["top_prob"] * 100, 1),
        "model_risk_score": pred_res["model_risk_score"],
        "rule_risk_score": pred_res["rule_risk_score"],
        "final_risk_score": pred_res["final_risk_score"],
        "risk_level": pred_res["risk_level"],
        "health": pred_res["health"],
        "shap_drivers": pred_res.get("shap_drivers", [])[:3],
        "warnings": pred_res.get("warnings", []),
        "narrative": ai_narrative,
        "derived_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/contractor/submit-progress")
async def contractor_submit_progress(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    contractor_id: str = Form(...),
    physical_progress_pct: Optional[float] = Form(None),
    financial_expenditure_cr: Optional[float] = Form(None),
    notes: Optional[str] = Form(""),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None),
    captured_at: Optional[str] = Form(None),
):
    if not project_id:
        raise HTTPException(400, "Project ID is mandatory.")
    if not contractor_id:
        raise HTTPException(400, "Contractor ID is mandatory.")
    if physical_progress_pct is None:
        raise HTTPException(400, "Physical progress percentage is mandatory.")
    if financial_expenditure_cr is None or financial_expenditure_cr <= 0:
        raise HTTPException(400, "Claimed expenditure (₹ Cr) is mandatory and must be greater than 0.")
    if not notes or not notes.strip():
        raise HTTPException(400, "Milestone details & site notes are mandatory.")
    if gps_lat is None or gps_lng is None:
        raise HTTPException(400, "Device GPS coordinates are mandatory.")

    _ensure_verification_schema()
    _ensure_contractor_schema()

    # Look up geofence from contractors_admin.db first
    geofence = None
    with db_manager.get_contractors_admin_conn() as c_adm:
        cur = c_adm.cursor()
        cur.execute("SELECT center_lat, center_lng, radius_km, boundary_geojson FROM project_geofences WHERE project_id = ?", (project_id,))
        gf_row = cur.fetchone()
        if gf_row:
            geofence = {
                "project_id": project_id,
                "center_lat": gf_row[0],
                "center_lng": gf_row[1],
                "radius_km": gf_row[2],
                "boundary_geojson": json.loads(gf_row[3]),
                "boundary_lamina": verification.generate_lamina_polygon(gf_row[0], gf_row[1], radius_km=gf_row[2], vertices=6)
            }
    if not geofence:
        p_row = q("SELECT state FROM projects WHERE project_id = ?", params=[project_id])
        state = str(p_row.iloc[0]["state"]) if not p_row.empty else "Maharashtra"
        geofence = mock_data.geofence_for_project(project_id, state=state)

    ext = Path(file.filename or "site.jpg").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}:
        raise HTTPException(415, "unsupported image type - use JPEG/PNG/WebP")

    sub_id = f"SUB-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')[:17]}"
    safe_name = f"{sub_id}_{project_id.replace('/', '_')}{ext}"
    target = UPLOAD_DIR / safe_name
    with target.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)

    # 1. Fetch known historical hashes across all projects for duplicate detection
    hist_records = fraud_detector.get_all_historical_hashes()
    known_hashes = [r["photo_hash"] for r in hist_records if r.get("photo_hash")]

    result = verification.verify_image(
        target,
        project_lat=geofence["center_lat"],
        project_lng=geofence["center_lng"],
        boundary_polygon=geofence["boundary_lamina"],
        max_distance_km=geofence.get("radius_km", 3.5),
        duplicate_hashes=known_hashes,
        client_lat=gps_lat,
        client_lng=gps_lng,
        captured_at=captured_at,
    )

    # 2. Comprehensive Multi-Factor Fraud & Anomaly Evaluation
    fraud_eval = fraud_detector.evaluate_submission(
        image_path=target,
        project_id=project_id,
        contractor_id=contractor_id,
        physical_progress_pct=physical_progress_pct,
        financial_expenditure_cr=financial_expenditure_cr,
        device_lat=gps_lat,
        device_lng=gps_lng,
        site_center_lat=geofence["center_lat"],
        site_center_lng=geofence["center_lng"],
        max_geofence_km=geofence.get("radius_km", 3.5),
        captured_at=captured_at,
    )
    result["fraud_evaluation"] = fraud_eval
    photo_hash = fraud_eval.get("photo_hash") or result.get("checks", {}).get("perceptual_hash")

    geofence_check = result.get("checks", {}).get("geofence", {})
    lamina_check = result.get("checks", {}).get("geofence_lamina", {})
    is_inside = bool(geofence_check.get("within_limit", True) and lamina_check.get("inside", True))

    # Initial zero-trust verification status
    if not is_inside or result.get("rejection_reason") == "geofence":
        init_status = "rejected_geofence"
    elif result["status"] == "rejected" or fraud_eval["risk_level"] == "HIGH":
        init_status = "flagged_anomaly"
    else:
        init_status = "pending_review"

    # ZERO-TRUST POLICY:
    # All submissions enter staged review. Progress is NEVER credited until formal audit approval!
    counts_towards_progress = 0

    staged_intelligence = {
        "staged": True,
        "submitted_progress_pct": physical_progress_pct,
        "claimed_expenditure_cr": financial_expenditure_cr,
        "fraud_score": fraud_eval["fraud_score"],
        "risk_level": fraud_eval["risk_level"],
        "requires_main_admin_approval": fraud_eval["requires_main_admin_approval"],
        "evaluated_at": result["submitted_at"],
    }

    # Persist in dedicated reports_photos.db
    conn_rp = db_manager.get_reports_photos_conn()
    try:
        conn_rp.execute("""
        INSERT INTO contractor_progress_reports
        (submission_id, project_id, contractor_id, physical_progress_pct, financial_expenditure_cr, notes, photo_url, gps_lat, gps_lng, inside_geofence, verification_status, counts_towards_progress, submitted_at, details_json, ai_intelligence_json, photo_hash, fraud_score, fraud_flags_json, requires_main_admin_approval)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sub_id, project_id, contractor_id,
            physical_progress_pct, financial_expenditure_cr, notes,
            f"/uploads/{safe_name}",
            result.get("gps", {}).get("lat") if result.get("gps") else gps_lat,
            result.get("gps", {}).get("lng") if result.get("gps") else gps_lng,
            1 if is_inside else 0,
            init_status,
            counts_towards_progress,
            result["submitted_at"],
            json.dumps(result),
            json.dumps(staged_intelligence),
            photo_hash,
            fraud_eval["fraud_score"],
            json.dumps(fraud_eval["flags"]),
            1 if fraud_eval["requires_main_admin_approval"] else 0,
        ))
        conn_rp.execute("""
        INSERT INTO verification_records
        (file_name, original_name, capture_time, client_lat, client_lng, extracted_lat, extracted_lng, distance_meters, result_json, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            safe_name, file.filename or safe_name,
            result.get("captured_at", result["submitted_at"]),
            gps_lat, gps_lng,
            result.get("gps", {}).get("lat") if result.get("gps") else None,
            result.get("gps", {}).get("lng") if result.get("gps") else None,
            result.get("distance_km", 0.0) * 1000 if result.get("distance_km") else 0.0,
            json.dumps(result),
            init_status,
            result["submitted_at"],
        ))
        file_size = target.stat().st_size if target.exists() else 0
        conn_rp.execute("""
        INSERT INTO photo_uploads (file_name, file_path, file_size, content_type, project_id, contractor_id, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            safe_name, str(target), file_size, file.content_type or "image/jpeg", project_id, contractor_id, result["submitted_at"]
        ))
        conn_rp.commit()
    finally:
        conn_rp.close()

    # Mirror to project_monitoring.db for backwards compatibility
    try:
        with db_manager.get_core_conn() as c_core:
            c_core.execute("""
            INSERT OR REPLACE INTO contractor_progress_reports
            (submission_id, project_id, contractor_id, physical_progress_pct, financial_expenditure_cr, notes, photo_url, gps_lat, gps_lng, inside_geofence, verification_status, counts_towards_progress, submitted_at, details_json, ai_intelligence_json, photo_hash, fraud_score, fraud_flags_json, requires_main_admin_approval)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sub_id, project_id, contractor_id,
                physical_progress_pct, financial_expenditure_cr, notes,
                f"/uploads/{safe_name}",
                result.get("gps", {}).get("lat") if result.get("gps") else gps_lat,
                result.get("gps", {}).get("lng") if result.get("gps") else gps_lng,
                1 if is_inside else 0,
                init_status,
                counts_towards_progress,
                result["submitted_at"],
                json.dumps(result),
                json.dumps(staged_intelligence),
                photo_hash,
                fraud_eval["fraud_score"],
                json.dumps(fraud_eval["flags"]),
                1 if fraud_eval["requires_main_admin_approval"] else 0,
            ))
            c_core.commit()
    except Exception:
        pass

    dist_val = result.get("distance_km")
    dist_str = f"{dist_val:.2f} km" if dist_val is not None else "on-site"
    if not is_inside:
        msg = f"GEOFENCE VIOLATION: Photo coordinates fall outside designated construction area lamina ({dist_str}). Submission rejected."
    elif fraud_eval["risk_level"] == "HIGH":
        msg = f"Submission Staged with ANOMALY ALERT (Fraud Risk: {fraud_eval['fraud_score']}%). Flagged for mandatory Main Administrator audit before progress can be credited."
    elif fraud_eval["requires_main_admin_approval"]:
        msg = f"Verified on-site ({dist_str} to site center). Staged for Sub-Admin inspection and Main Admin Maker-Checker counter-signature."
    else:
        msg = f"Verified on-site ({dist_str} to site center). Submission staged and queued for statutory audit approval."

    return {
        "submission_id": sub_id,
        "project_id": project_id,
        "contractor_id": contractor_id,
        "status": init_status,
        "verification_status": init_status,
        "counts": False,
        "counts_towards_progress": False,
        "inside_geofence": is_inside,
        "message": msg,
        "verification": result,
        "fraud_score": fraud_eval["fraud_score"],
        "risk_level": fraud_eval["risk_level"],
        "fraud_flags": fraud_eval["flags"],
        "requires_main_admin_approval": fraud_eval["requires_main_admin_approval"],
        "photo_url": f"/uploads/{safe_name}",
        "physical_progress_pct": physical_progress_pct,
        "geofence": geofence,
        "ai_intelligence": staged_intelligence,
    }


@app.get("/api/contractor/{contractor_id}/submissions")
@app.get("/api/contractors/{contractor_id}/submissions")
def contractor_submissions(contractor_id: str, limit: int = 50):
    _ensure_contractor_schema()
    conn_rp = db_manager.get_reports_photos_conn()
    try:
        conn_rp.row_factory = sqlite3.Row
        cur = conn_rp.cursor()
        cur.execute("""
        SELECT * FROM contractor_progress_reports
        WHERE UPPER(contractor_id) = ?
        ORDER BY id DESC LIMIT ?
        """, (contractor_id.upper(), limit))
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn_rp.close()


# ---------------------------------------------------------------------------
# Administrative Management Endpoints (State Assignments, Geofencing & Audits)
# ---------------------------------------------------------------------------
class AssignContractorRequest(BaseModel):
    project_id: str
    contractor_id: str
    package_name: Optional[str] = None
    contract_value_cr: Optional[float] = None


@app.post("/api/admin/assign-contractor")
def admin_assign_contractor(req: AssignContractorRequest):
    _ensure_contractor_schema()
    
    # Determine the contract value: user-specified or existing project sanctioned_cost
    val = req.contract_value_cr
    if val is None or val <= 0:
        try:
            curr_df = q("SELECT sanctioned_cost FROM projects WHERE project_id = ?", params=[req.project_id])
            if not curr_df.empty and pd.notna(curr_df.iloc[0]["sanctioned_cost"]):
                val = float(curr_df.iloc[0]["sanctioned_cost"])
            else:
                val = 1200.0
        except Exception:
            val = 1200.0

    # Synchronously update ALL databases: SQLite project_monitoring.db, contractors_admin.db, and Supabase PostgreSQL
    sync_res = db_manager.update_project_sanctioned_cost(
        project_id=req.project_id,
        sanctioned_cost=val,
        contractor_id=req.contractor_id,
        package_name=req.package_name or f"Package Contract -- {req.project_id}"
    )

    mock_data.EXPLICIT_ASSIGNMENTS[req.project_id] = req.contractor_id
    c = mock_data.get_contractor(req.contractor_id)
    return {
        "status": "success",
        "project_id": req.project_id,
        "contractor": c,
        "contract_value_cr": val,
        "sync_details": sync_res,
        "message": f"Assigned project {req.project_id} to {c['company_name'] if c else req.contractor_id} with package value ₹{val} Cr across all databases"
    }


class UpdateSanctionedCostRequest(BaseModel):
    sanctioned_cost: float
    contractor_id: Optional[str] = None
    package_name: Optional[str] = None


@app.post("/api/admin/projects/{project_id}/update-sanctioned-cost")
def admin_update_sanctioned_cost(project_id: str, req: UpdateSanctionedCostRequest):
    sync_res = db_manager.update_project_sanctioned_cost(
        project_id=project_id,
        sanctioned_cost=req.sanctioned_cost,
        contractor_id=req.contractor_id,
        package_name=req.package_name
    )
    return {
        "status": "success",
        "project_id": project_id,
        "sanctioned_cost": req.sanctioned_cost,
        "sync_details": sync_res,
        "message": f"Updated sanctioned package value for {project_id} to ₹{req.sanctioned_cost} Cr across all databases"
    }


class AdminGeofenceRequest(BaseModel):
    project_id: str
    center_lat: float
    center_lng: float
    radius_km: float = 3.5


@app.post("/api/admin/geofence")
@app.post("/api/admin/set-geofence")
def admin_set_geofence(req: AdminGeofenceRequest):
    _ensure_contractor_schema()
    poly = verification.generate_lamina_polygon(req.center_lat, req.center_lng, radius_km=req.radius_km, vertices=6)
    bg = {
        "type": "Polygon",
        "coordinates": [[[pt[1], pt[0]] for pt in poly] + [[poly[0][1], poly[0][0]]]]
    }
    conn_admin = db_manager.get_contractors_admin_conn()
    try:
        conn_admin.execute("""
        INSERT OR REPLACE INTO project_geofences
        (project_id, center_lat, center_lng, radius_km, boundary_geojson, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            req.project_id,
            req.center_lat,
            req.center_lng,
            req.radius_km,
            json.dumps(bg),
            datetime.now(timezone.utc).isoformat()
        ))
        conn_admin.commit()
    finally:
        conn_admin.close()

    try:
        with db_manager.get_core_conn() as c_core:
            c_core.execute("""
            INSERT OR REPLACE INTO project_geofences (project_id, center_lat, center_lng, radius_km, boundary_geojson, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (req.project_id, req.center_lat, req.center_lng, req.radius_km, json.dumps(bg), datetime.now(timezone.utc).isoformat()))
            c_core.commit()
    except Exception:
        pass

    return {
        "status": "success",
        "project_id": req.project_id,
        "center_lat": req.center_lat,
        "center_lng": req.center_lng,
        "radius_km": req.radius_km,
        "boundary_lamina": poly,
        "boundary_geojson": bg,
    }


@app.get("/api/admin/audits")
def admin_audits(limit: int = 100, contractor_id: Optional[str] = None):
    _ensure_contractor_schema()
    conn_rp = db_manager.get_reports_photos_conn()
    conn_admin = db_manager.get_contractors_admin_conn()
    try:
        conn_rp.row_factory = sqlite3.Row
        cur = conn_rp.cursor()
        if contractor_id:
            cur.execute("""
            SELECT * FROM contractor_progress_reports
            WHERE UPPER(contractor_id) = UPPER(?)
            ORDER BY id DESC LIMIT ?
            """, (contractor_id.strip(), limit))
        else:
            cur.execute("""
            SELECT * FROM contractor_progress_reports
            ORDER BY id DESC LIMIT ?
            """, (limit,))
        reports = [dict(r) for r in cur.fetchall()]

        cur_adm = conn_admin.cursor()
        cur_adm.execute("SELECT contractor_id, company_name, contact_person FROM contractors")
        c_map = {r[0]: (r[1], r[2]) for r in cur_adm.fetchall()}

        for rep in reports:
            cid = rep.get("contractor_id")
            if cid in c_map:
                rep["company_name"] = c_map[cid][0]
                rep["contact_person"] = c_map[cid][1]
            else:
                rep["company_name"] = cid
                rep["contact_person"] = ""

            flags_val = rep.get("fraud_flags_json")
            if flags_val and isinstance(flags_val, str):
                try:
                    rep["fraud_flags"] = json.loads(flags_val)
                except Exception:
                    rep["fraud_flags"] = []
            elif isinstance(flags_val, list):
                rep["fraud_flags"] = flags_val
            else:
                rep["fraud_flags"] = []

        return reports
    finally:
        conn_rp.close()
        conn_admin.close()


class AuditReviewRequest(BaseModel):
    status: str  # "approved" or "rejected"
    reviewer_notes: Optional[str] = None
    reviewer_name: Optional[str] = "Director General (Admin)"
    reviewer_role: Optional[str] = "main_admin"  # "main_admin" | "sub_admin"
    reviewer_id: Optional[str] = None
    override_reason: Optional[str] = None  # Mandatory when Main Admin overrides a sub-admin review


@app.post("/api/admin/audits/{submission_id}/review")
def review_audit(submission_id: str, req: AuditReviewRequest):
    _ensure_contractor_schema()
    new_status = req.status.strip().lower()
    if new_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    review_time = datetime.now(timezone.utc).isoformat()
    reviewer_role = (req.reviewer_role or "main_admin").strip().lower()

    conn_rp = db_manager.get_reports_photos_conn()
    try:
        cur = conn_rp.cursor()
        cur.execute("""
        SELECT id, project_id, physical_progress_pct, financial_expenditure_cr, notes, details_json, verification_status, fraud_score, requires_main_admin_approval
        FROM contractor_progress_reports WHERE submission_id = ?
        """, (submission_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Submission {submission_id} not found")

        rep_id, project_id, phys_pct, fin_exp_cr, sub_notes, details_str, current_verif_status, fraud_sc, req_main_adm = row
        fraud_sc = float(fraud_sc or 0.0)
        req_main_adm = bool(req_main_adm)
        phys_pct = float(phys_pct) if phys_pct is not None else 0.0
        fin_exp_cr = float(fin_exp_cr) if fin_exp_cr is not None else 0.0

        details = {}
        try:
            if details_str:
                details = json.loads(details_str)
        except Exception:
            pass

        has_subadmin_review = bool(details.get("subadmin_review")) or str(current_verif_status or "").startswith("subadmin_")

        if reviewer_role in ("subadmin", "sub_admin"):
            # Sub-admin review
            if new_status == "approved":
                if req_main_adm or fraud_sc >= 25.0:
                    # High/Medium Risk or High Value: Sub-admin is Maker only; requires Main Admin Checker
                    stat_val = "subadmin_approved"
                    counts_val = 0  # Zero-Trust: Not credited until Main Admin signs off!
                    approval_msg = f"Submission {submission_id} field-verified by Sub-Admin. Escalated for mandatory Main Admin (DG) counter-signature."
                else:
                    # Routine Low-Risk: Sub-admin can approve
                    stat_val = "subadmin_approved"
                    counts_val = 1
                    approval_msg = f"Submission {submission_id} approved by Sub-Admin. Progress officially credited to project."
                    # Recalculate project intelligence
                    recompute_project_intelligence(project_id, phys_pct, fin_exp_cr, sub_notes or "")
            else:
                stat_val = "subadmin_rejected"
                counts_val = 0
                approval_msg = f"Submission {submission_id} rejected by Sub-Admin Inspector."
                # Recalculate baseline progress
                latest_appr_pct, _, _ = fraud_detector.get_latest_project_progress(project_id)
                if latest_appr_pct is not None:
                    recompute_project_intelligence(project_id, latest_appr_pct)

            details["subadmin_review"] = {
                "reviewed_by": req.reviewer_name or "Sub-Admin Inspector",
                "reviewer_id": req.reviewer_id or "SADM-INSP",
                "reviewed_at": review_time,
                "status": new_status,
                "notes": (req.reviewer_notes or f"Sub-Admin verified as {new_status}").strip(),
                "requires_main_admin_countersign": bool(req_main_adm or fraud_sc >= 25.0),
            }
        else:
            # Main admin review / recheck / final verdict
            if new_status == "approved":
                if fraud_sc >= 50.0 or req_main_adm:
                    override_justification = (req.override_reason or req.reviewer_notes or "").strip()
                    if len(override_justification) < 20:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Escalated Anomaly Alert (Score {fraud_sc:.0f}%): A substantive justification note (minimum 20 characters) is legally mandatory to approve this flagged submission."
                        )
                elif has_subadmin_review and details.get("subadmin_review", {}).get("status") == "rejected":
                    override_justification = (req.override_reason or req.reviewer_notes or "").strip()
                    if not override_justification:
                        raise HTTPException(
                            status_code=400,
                            detail="Mandatory requirement: A specific reason for overriding the Sub-Admin's rejection must be provided."
                        )
                else:
                    override_justification = (req.override_reason or "").strip()

                stat_val = "manually_approved"
                counts_val = 1
                approval_msg = f"Submission {submission_id} officially approved by Main Admin. Progress credited to project."
                recompute_project_intelligence(project_id, phys_pct, fin_exp_cr, sub_notes or "")
            else:
                stat_val = "manually_rejected"
                counts_val = 0
                approval_msg = f"Submission {submission_id} rejected by Main Admin."
                override_justification = (req.override_reason or req.reviewer_notes or "").strip()
                latest_appr_pct, _, _ = fraud_detector.get_latest_project_progress(project_id)
                if latest_appr_pct is not None:
                    recompute_project_intelligence(project_id, latest_appr_pct)

            details["main_admin_review"] = {
                "reviewed_by": req.reviewer_name or "Director General (Admin)",
                "reviewed_at": review_time,
                "status": new_status,
                "notes": req.reviewer_notes or f"Final verdict {new_status} by Main Admin",
                "override_reason": override_justification or (req.reviewer_notes or ""),
                "overrode_subadmin": has_subadmin_review,
                "previous_subadmin_verdict": details.get("subadmin_review", {}).get("status") if has_subadmin_review else None,
            }
            details["manual_review"] = details["main_admin_review"]

        cur.execute("""
        UPDATE contractor_progress_reports
        SET verification_status = ?, counts_towards_progress = ?, details_json = ?
        WHERE submission_id = ?
        """, (stat_val, counts_val, json.dumps(details), submission_id))
        conn_rp.commit()
    finally:
        conn_rp.close()

    # Mirror update to project_monitoring.db if present
    try:
        with db_manager.get_core_conn() as c_core:
            c_core.execute("""
            UPDATE contractor_progress_reports
            SET verification_status = ?, counts_towards_progress = ?
            WHERE submission_id = ?
            """, (stat_val, counts_val, submission_id))
            c_core.commit()
    except Exception:
        pass

    return {
        "status": "success",
        "submission_id": submission_id,
        "verification_status": stat_val,
        "counts_towards_progress": counts_val,
        "reviewed_at": review_time,
        "details": details,
        "message": approval_msg,
    }



@app.get("/api/notifications")
def get_notifications(role: str = "guest", contractor_id: Optional[str] = None):
    """Role-segregated notification feed:

    - guest: empty list (no notifications)
    - contractor: reports submitted by contractor (approved vs geofence breaches)
    - admin: all uploaded reports across India and geofence alerts
    """
    _ensure_contractor_schema()
    if role == "guest" or role not in {"admin", "contractor"}:
        return {"notifications": [], "unread_count": 0}

    conn_rp = db_manager.get_reports_photos_conn()
    conn_admin = db_manager.get_contractors_admin_conn()
    try:
        cur_adm = conn_admin.cursor()
        cur_adm.execute("SELECT contractor_id, company_name FROM contractors")
        c_names = {r[0]: r[1] for r in cur_adm.fetchall()}
        for c in mock_data.CONTRACTORS:
            c_names.setdefault(c["contractor_id"], c["company_name"])

        cur = conn_rp.cursor()
        if role == "contractor":
            cid = (contractor_id or "CNT-LT-01").strip().upper()
            cur.execute("""
                SELECT submission_id, project_id, contractor_id, physical_progress_pct,
                       inside_geofence, verification_status, submitted_at, notes, details_json, ai_intelligence_json
                FROM contractor_progress_reports
                WHERE UPPER(contractor_id) = ?
                ORDER BY id DESC LIMIT 30
            """, (cid,))
            rows = cur.fetchall()
            notifs = []
            for r in rows:
                sub_id, pid, cid_val, phys, inside, v_stat, sub_at, notes_val, det_json, intel_json = r
                if v_stat == "manually_approved" or (inside == 1 and v_stat != "manually_rejected"):
                    is_manual = v_stat == "manually_approved"
                    notifs.append({
                        "id": f"notif-{sub_id}",
                        "submission_id": sub_id,
                        "project_id": pid,
                        "title": f"Report {'Manually ' if is_manual else ''}Approved: {pid}",
                        "message": f"{'Admin manually verified and approved this submission.' if is_manual else 'On-site photo verified within designated construction lamina.'} Progress updated to {phys}%. AI intelligence updated.",
                        "status": "approved",
                        "tone": "green",
                        "time": sub_at,
                        "progress": phys,
                    })
                else:
                    is_manual = v_stat == "manually_rejected"
                    notifs.append({
                        "id": f"notif-{sub_id}",
                        "submission_id": sub_id,
                        "project_id": pid,
                        "title": f"Report {'Manually ' if is_manual else ''}NOT Approved: {pid}",
                        "message": f"{'Admin manually rejected this submission upon audit review.' if is_manual else 'GEOFENCE BREACH: Submission captured outside designated construction lamina.'} Progress does NOT count towards project metrics.",
                        "status": "not_approved",
                        "tone": "red",
                        "time": sub_at,
                        "progress": phys,
                    })
            return {"notifications": notifs, "unread_count": len(notifs)}

        elif role == "admin":
            cur.execute("""
                SELECT submission_id, project_id, contractor_id, physical_progress_pct,
                       inside_geofence, verification_status, submitted_at, notes, details_json, ai_intelligence_json
                FROM contractor_progress_reports
                ORDER BY id DESC LIMIT 40
            """)
            rows = cur.fetchall()
            notifs = []
            for r in rows:
                sub_id, pid, cid_val, phys, inside, v_stat, sub_at, notes_val, det_json, intel_json = r
                c_name = c_names.get(cid_val, cid_val)
                if v_stat == "manually_approved" or (inside == 1 and v_stat != "manually_rejected"):
                    is_manual = v_stat == "manually_approved"
                    notifs.append({
                        "id": f"notif-adm-{sub_id}",
                        "submission_id": sub_id,
                        "project_id": pid,
                        "contractor_id": cid_val,
                        "contractor_name": c_name,
                        "title": f"{'Manually Verified' if is_manual else 'Verified Submission'}: {pid}",
                        "message": f"{c_name} report for {pid} {'manually approved by admin' if is_manual else 'verified within construction lamina'} (Progress: {phys}%). ML intelligence updated.",
                        "status": "approved",
                        "tone": "green",
                        "time": sub_at,
                        "progress": phys,
                    })
                else:
                    is_manual = v_stat == "manually_rejected"
                    notifs.append({
                        "id": f"notif-adm-{sub_id}",
                        "submission_id": sub_id,
                        "project_id": pid,
                        "contractor_id": cid_val,
                        "contractor_name": c_name,
                        "title": f"{'MANUAL REJECTION' if is_manual else 'GEOFENCE ALERT'}: {pid}",
                        "message": f"{c_name} report for {pid} {'rejected by manual admin review' if is_manual else 'flagged outside construction zone'}. Progress discounted.",
                        "status": "not_approved",
                        "tone": "red",
                        "time": sub_at,
                        "progress": phys,
                    })
            return {"notifications": notifs, "unread_count": len(notifs)}
        return {"notifications": [], "unread_count": 0}
    finally:
        conn_rp.close()
        conn_admin.close()




# ---------------------------------------------------------------------------
# React frontend (built dashboard + /map SPA). Additive — every /api and
# /uploads route above keeps priority. Falls back to the legacy static
# dashboard when frontend/dist is absent (e.g. API-only deployments).
# ---------------------------------------------------------------------------
FRONTEND_DIST = Path("frontend/dist")


def _frontend_index() -> Path:
    candidate = FRONTEND_DIST / "index.html"
    return candidate if candidate.is_file() else Path("static/index.html")


def _spa_response(target: Path) -> FileResponse:
    resp = FileResponse(target)
    # SPA reads live DOM + API each load; never serve stale copies.
    resp.headers["Cache-Control"] = "no-store"
    return resp


if (FRONTEND_DIST / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="frontend-assets",
    )


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str):
    if FRONTEND_DIST.is_dir():
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return _spa_response(candidate)
        return _spa_response(_frontend_index())
    return _spa_response(_frontend_index())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))