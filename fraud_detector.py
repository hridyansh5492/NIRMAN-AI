"""Centralized Anti-Fraud and Anomaly Detection Engine for NirmanAi (PAIMANA).

Evaluates on-site contractor progress submissions across multi-modal dimensions:
1. Global Perceptual Duplicate Hash Matching (cross-project & within-project reuse).
2. Physical Progress Velocity Anomalies (rate of progress vs. time bounds).
3. Physical-to-Financial Divergence (S-Curve expenditure vs. milestone advancement).
4. Forensics (ELA recompression artifacts, stale capture times, GPS telemetry mismatch).
5. Maker-Checker Escalation Determination (4-Eyes Principle triggers).
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import db_manager
import verification_pipeline as verification


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        clean = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def get_all_historical_hashes() -> List[Dict[str, Any]]:
    """Retrieve all previously submitted photo hashes from reports_photos.db."""
    records = []
    conn = db_manager.get_reports_photos_conn()
    try:
        cur = conn.cursor()
        # Fetch submission_id, project_id, contractor_id, photo_hash, details_json
        cur.execute("""
        SELECT submission_id, project_id, contractor_id, photo_hash, details_json
        FROM contractor_progress_reports
        """)
        for row in cur.fetchall():
            sub_id, proj_id, cont_id, p_hash, details_str = row
            extracted_hash = p_hash
            if not extracted_hash and details_str:
                try:
                    d = json.loads(details_str)
                    extracted_hash = d.get("checks", {}).get("perceptual_hash")
                except Exception:
                    pass
            if extracted_hash:
                records.append({
                    "submission_id": sub_id,
                    "project_id": proj_id,
                    "contractor_id": cont_id,
                    "photo_hash": str(extracted_hash).strip(),
                })
        return records
    except Exception:
        return []
    finally:
        conn.close()


def get_latest_project_progress(project_id: str) -> Tuple[Optional[float], Optional[datetime], Optional[float]]:
    """Get the latest recorded or approved physical progress and timestamp for a project.
    
    Returns: (latest_progress_pct, latest_submitted_at, sanctioned_cost_cr)
    """
    latest_progress: Optional[float] = None
    latest_dt: Optional[datetime] = None
    sanctioned_cost: Optional[float] = None

    # Check reports_photos.db for previous approved/counted submissions
    conn = db_manager.get_reports_photos_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
        SELECT physical_progress_pct, submitted_at
        FROM contractor_progress_reports
        WHERE project_id = ? AND (counts_towards_progress = 1 OR verification_status LIKE ?)
        ORDER BY id DESC LIMIT 1
        """, (project_id, "%approved%"))
        row = cur.fetchone()
        if row and row[0] is not None:
            latest_progress = float(row[0])
            latest_dt = _parse_iso(row[1])
    except Exception:
        pass
    finally:
        conn.close()

    # If no approved submission yet, query project_monitoring.db projects & snapshots
    try:
        core_conn = db_manager.get_core_conn()
        cur_c = core_conn.cursor()
        cur_c.execute("SELECT sanctioned_cost FROM projects WHERE project_id = ?", (project_id,))
        p_row = cur_c.fetchone()
        if p_row and p_row[0] is not None:
            sanctioned_cost = float(p_row[0])

        if latest_progress is None:
            cur_c.execute("""
            SELECT physical_progress_pct, snapshot_date
            FROM project_snapshots
            WHERE project_id = ?
            ORDER BY id DESC LIMIT 1
            """, (project_id,))
            s_row = cur_c.fetchone()
            if s_row and s_row[0] is not None:
                latest_progress = float(s_row[0])
                latest_dt = _parse_iso(s_row[1])
        core_conn.close()
    except Exception:
        pass

    return latest_progress, latest_dt, sanctioned_cost


def evaluate_submission(
    image_path: Path | str,
    project_id: str,
    contractor_id: str,
    physical_progress_pct: float,
    financial_expenditure_cr: float,
    device_lat: Optional[float] = None,
    device_lng: Optional[float] = None,
    site_center_lat: Optional[float] = None,
    site_center_lng: Optional[float] = None,
    max_geofence_km: float = 3.5,
    captured_at: Optional[str] = None,
    current_time: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Run comprehensive fraud and anomaly evaluation for a progress submission.

    Returns a rich evaluation dictionary containing:
    - fraud_score: int (0 to 100)
    - risk_level: "LOW" | "MEDIUM" | "HIGH"
    - flags: List[Dict[str, Any]] detailing specific triggered anomalies
    - requires_main_admin_approval: bool (Maker-Checker escalation)
    - photo_hash: Optional[str]
    - forensics: Dict of individual biometric/telemetric findings
    """
    now = current_time or datetime.now(timezone.utc)
    flags: List[Dict[str, Any]] = []
    score = 0

    # 1. Compute perceptual hash and scan for duplicate images
    phash = verification.perceptual_hash(str(image_path))
    duplicate_match = None

    if phash:
        historical_records = get_all_historical_hashes()
        for record in historical_records:
            hist_hash = record.get("photo_hash")
            if not hist_hash or len(hist_hash) != len(phash):
                continue
            dist = verification.hamming_distance(phash, hist_hash)
            if dist <= 6:  # Strong visual similarity threshold
                is_same_project = (record.get("project_id") == project_id)
                duplicate_match = {
                    "matched_submission_id": record.get("submission_id"),
                    "matched_project_id": record.get("project_id"),
                    "matched_contractor_id": record.get("contractor_id"),
                    "hamming_distance": dist,
                    "is_same_project": is_same_project,
                }
                if not is_same_project:
                    score += 65
                    flags.append({
                        "code": "RECYCLED_PHOTO_CROSS_PROJECT",
                        "severity": "CRITICAL",
                        "weight": 65,
                        "title": "Cross-Project Duplicate Photo Reuse",
                        "description": (
                            f"Uploaded site photo matches an existing submission "
                            f"({record.get('submission_id')}) from project '{record.get('project_id')}' "
                            f"(Hamming distance: {dist}/64)."
                        ),
                        "details": duplicate_match,
                    })
                else:
                    score += 45
                    flags.append({
                        "code": "RECYCLED_PHOTO_SAME_PROJECT",
                        "severity": "HIGH",
                        "weight": 45,
                        "title": "Duplicate Photo from Prior Milestone",
                        "description": (
                            f"Uploaded site photo matches a previous submission "
                            f"({record.get('submission_id')}) on this same project "
                            f"(Hamming distance: {dist}/64)."
                        ),
                        "details": duplicate_match,
                    })
                break

    # 2. Progress Velocity Anomaly Analysis
    prev_progress, prev_dt, sanctioned_cost = get_latest_project_progress(project_id)
    progress_delta = 0.0
    days_delta = 1.0

    if prev_progress is not None:
        progress_delta = round(physical_progress_pct - prev_progress, 2)
        if prev_dt:
            days_delta = max(0.1, round((now - prev_dt).total_seconds() / 86400.0, 2))
        else:
            days_delta = 14.0  # Fallback assumption

        # Velocity in % per day
        velocity_pct_per_day = round(progress_delta / days_delta, 2)

        if progress_delta > 30.0:
            score += 50
            flags.append({
                "code": "EXTREME_VELOCITY_JUMP",
                "severity": "CRITICAL",
                "weight": 50,
                "title": "Unrealistic Progress Leap",
                "description": (
                    f"Contractor claimed a +{progress_delta:.1f}% physical jump "
                    f"(from {prev_progress:.1f}% to {physical_progress_pct:.1f}%). "
                    f"A leap of >30% in a single submission is mathematically anomalous."
                ),
                "details": {
                    "prev_progress": prev_progress,
                    "claimed_progress": physical_progress_pct,
                    "delta": progress_delta,
                    "days": days_delta,
                },
            })
        elif progress_delta > 15.0 and days_delta < 14.0:
            score += 35
            flags.append({
                "code": "IMPOSSIBLE_VELOCITY_SPIKE",
                "severity": "HIGH",
                "weight": 35,
                "title": "Abnormal Progress Velocity Spike",
                "description": (
                    f"Contractor claimed a +{progress_delta:.1f}% progress jump in {days_delta:.1f} days "
                    f"({velocity_pct_per_day:.2f}%/day). Standard sector ceiling is ~0.4%/day."
                ),
                "details": {
                    "prev_progress": prev_progress,
                    "claimed_progress": physical_progress_pct,
                    "delta": progress_delta,
                    "days": days_delta,
                    "velocity_pct_per_day": velocity_pct_per_day,
                },
            })
        elif progress_delta < -3.0:
            score += 20
            flags.append({
                "code": "PROGRESS_REGRESSION_ANOMALY",
                "severity": "MEDIUM",
                "weight": 20,
                "title": "Negative Progress Regression",
                "description": (
                    f"Claimed progress ({physical_progress_pct:.1f}%) is lower than "
                    f"previously verified baseline ({prev_progress:.1f}%)."
                ),
                "details": {
                    "prev_progress": prev_progress,
                    "claimed_progress": physical_progress_pct,
                    "delta": progress_delta,
                },
            })
    else:
        # First submission on project - check for absurd initial claims
        if physical_progress_pct > 60.0:
            score += 30
            flags.append({
                "code": "UNVERIFIED_HIGH_INITIAL_PROGRESS",
                "severity": "MEDIUM",
                "weight": 30,
                "title": "High Initial Progress Without Baseline",
                "description": (
                    f"First recorded submission claims {physical_progress_pct:.1f}% complete "
                    f"without intermediate stage audits."
                ),
                "details": {"claimed_progress": physical_progress_pct},
            })

    # 3. Physical-to-Financial Divergence Analysis (S-Curve Decoupling)
    if financial_expenditure_cr is not None:
        cost_baseline = sanctioned_cost or 1000.0  # ₹ Cr
        claimed_cost_pct = (financial_expenditure_cr / cost_baseline) * 100.0

        # Claiming high expenditure with negligible physical gain
        if financial_expenditure_cr >= 10.0 and progress_delta < 1.0:
            score += 35
            flags.append({
                "code": "FINANCIAL_DIVERGENCE_HIGH_SPEND_ZERO_PROGRESS",
                "severity": "HIGH",
                "weight": 35,
                "title": "Financial Drain with Zero Progress",
                "description": (
                    f"Contractor claimed ₹{financial_expenditure_cr:.2f} Cr expenditure "
                    f"with negligible physical advancement (+{progress_delta:.1f}%)."
                ),
                "details": {
                    "claimed_expenditure_cr": financial_expenditure_cr,
                    "progress_delta": progress_delta,
                },
            })
        elif claimed_cost_pct > 25.0 and progress_delta < 3.0:
            score += 25
            flags.append({
                "code": "FINANCIAL_DISPROPORTIONATE_EXPENDITURE",
                "severity": "MEDIUM",
                "weight": 25,
                "title": "Disproportionate Claimed Expenditure",
                "description": (
                    f"Claimed expenditure (₹{financial_expenditure_cr:.2f} Cr) represents "
                    f"{claimed_cost_pct:.1f}% of project budget but only delivers {progress_delta:.1f}% physical progress."
                ),
                "details": {
                    "claimed_cost_cr": financial_expenditure_cr,
                    "cost_pct_of_budget": claimed_cost_pct,
                    "progress_delta": progress_delta,
                },
            })

    # 4. Forensics: ELA, EXIF Freshness, and GPS Discrepancy
    gps_exif = verification.read_gps_and_time(str(image_path))
    exif_lat = gps_exif.get("gps_lat")
    exif_lng = gps_exif.get("gps_lng")
    exif_time_str = gps_exif.get("captured_at") or captured_at

    # A. ELA Recompression Artifacts (screen captures, edited images)
    ela = verification.ela_score(str(image_path))
    if ela is not None and ela > 55.0:
        score += 25
        flags.append({
            "code": "TAMPERED_OR_SCREENSHOT_IMAGE",
            "severity": "MEDIUM",
            "weight": 25,
            "title": "Digital Manipulation / Screen Capture Artifacts",
            "description": (
                f"Error Level Analysis (ELA) score is {ela:.1f}/100. "
                f"Elevated compression variance indicates a photo taken of a screen, "
                f"re-saved image, or edited graphic."
            ),
            "details": {"ela_score": ela},
        })

    # B. EXIF Freshness Gap
    if exif_time_str:
        cap_dt = _parse_iso(exif_time_str)
        if cap_dt:
            age_days = (now - cap_dt).total_seconds() / 86400.0
            if age_days > 14.0:
                score += 20
                flags.append({
                    "code": "STALE_EXIF_CAPTURE",
                    "severity": "LOW",
                    "weight": 20,
                    "title": "Stale Capture Timestamp",
                    "description": (
                        f"Photo EXIF metadata indicates image was captured {age_days:.1f} days ago. "
                        f"Statutory reporting requires recent ground captures (<14 days)."
                    ),
                    "details": {"age_days": round(age_days, 1), "captured_at": exif_time_str},
                })

    # C. Telemetry Discrepancy: Device GPS vs EXIF GPS
    if device_lat is not None and device_lng is not None and exif_lat is not None and exif_lng is not None:
        telemetry_dist_km = verification.haversine_km(device_lat, device_lng, exif_lat, exif_lng)
        if telemetry_dist_km > 0.5:  # Over 500 meters difference
            score += 35
            flags.append({
                "code": "GPS_TELEMETRY_MISMATCH",
                "severity": "HIGH",
                "weight": 35,
                "title": "Device GPS vs Image EXIF Discrepancy",
                "description": (
                    f"Phone sensor GPS coordinates differ from the embedded photo EXIF GPS "
                    f"by {telemetry_dist_km:.2f} km. Possible mock location spoofing or gallery photo reuse."
                ),
                "details": {
                    "distance_km": telemetry_dist_km,
                    "device_coords": [device_lat, device_lng],
                    "exif_coords": [exif_lat, exif_lng],
                },
            })

    # D. Geofence Distance Check
    site_lat = site_center_lat or device_lat
    site_lng = site_center_lng or device_lng
    photo_lat = exif_lat if exif_lat is not None else device_lat
    photo_lng = exif_lng if exif_lng is not None else device_lng

    dist_from_site = 0.0
    if site_lat is not None and site_lng is not None and photo_lat is not None and photo_lng is not None:
        dist_from_site = verification.haversine_km(site_lat, site_lng, photo_lat, photo_lng)
        if dist_from_site > max_geofence_km:
            score += 50
            flags.append({
                "code": "GEOFENCE_BREACH",
                "severity": "CRITICAL",
                "weight": 50,
                "title": "Site Boundary Geofence Violation",
                "description": (
                    f"Photo location is {dist_from_site:.2f} km from site center "
                    f"(permitted radius: {max_geofence_km:.1f} km)."
                ),
                "details": {"distance_km": dist_from_site, "max_radius_km": max_geofence_km},
            })

    # Final capped composite score (0 to 100)
    final_score = min(100, max(0, score))

    if final_score >= 60:
        risk_level = "HIGH"
    elif final_score >= 25:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # Maker-Checker Escalation Rule:
    # Requires Main Admin (DG) counter-signature if:
    # 1. Anomaly score >= 25 (MEDIUM or HIGH risk)
    # 2. Financial claim >= ₹0.50 Cr (₹50 Lakhs)
    # 3. Physical progress leap >= 5.0%
    # 4. Geofence violation or duplicate photo detected
    requires_main_admin = (
        final_score >= 25
        or (financial_expenditure_cr is not None and financial_expenditure_cr >= 0.50)
        or abs(progress_delta) >= 5.0
        or any(f["code"] in ("RECYCLED_PHOTO_CROSS_PROJECT", "RECYCLED_PHOTO_SAME_PROJECT", "GEOFENCE_BREACH") for f in flags)
    )

    return {
        "fraud_score": final_score,
        "risk_level": risk_level,
        "flags": flags,
        "requires_main_admin_approval": bool(requires_main_admin),
        "photo_hash": phash,
        "duplicate_match": duplicate_match,
        "forensics": {
            "ela_score": ela,
            "dist_from_site_km": dist_from_site,
            "exif_captured_at": exif_time_str,
            "progress_delta": progress_delta,
        },
    }
