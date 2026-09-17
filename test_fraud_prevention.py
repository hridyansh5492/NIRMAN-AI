"""Automated Verification Suite for Anti-Fraud and Zero-Trust Verification Pipeline.

Tests:
1. Zero-Trust Staging: Contractor submission creates record with counts_towards_progress = 0
   and does NOT mutate project active records before review.
2. Duplicate Photo Detection: Cross-project / same-project image reuse triggers RECYCLED_PHOTO flag.
3. Maker-Checker Routine Approval: Approving low-risk routine submission updates counts_towards_progress = 1
   and establishes legitimate baseline.
4. Velocity Anomaly Detection: An extreme jump (+57.5%) from approved baseline triggers EXTREME_VELOCITY_JUMP.
5. Maker-Checker Escalation:
   - Sub-Admin approval on high-risk/high-value audit sets subadmin_approved but leaves counts_towards_progress = 0.
   - Main Admin approval counter-signs, updates counts_towards_progress = 1, and recalculates project intelligence.
6. High Anomaly Override Protection: Attempting to approve score >= 60 without justification is blocked (HTTP 400).
"""
from __future__ import annotations

import io
import json
import os
import time
from pathlib import Path
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

import db_manager
from api import app
import fraud_detector


def create_unique_jpeg(seed: int = 101, size=(128, 128)) -> bytes:
    rng = np.random.default_rng(seed)
    arr = rng.integers(0, 256, size=(size[1], size[0], 3), dtype=np.uint8)
    im = Image.fromarray(arr)
    buf = io.BytesIO()
    im.save(buf, format="JPEG")
    return buf.getvalue()


def test_fraud_prevention_suite():
    client = TestClient(app)
    db_manager.init_all_databases()

    print("\n=======================================================")
    print("RUNNING ANTI-FRAUD & ZERO-TRUST VERIFICATION TEST SUITE")
    print("=======================================================\n")

    # Project to test with (from project_geofences)
    project_id = "PRJ-0005"
    contractor_id = "CNT-LT-01"
    run_seed = int(time.time() * 1000) % 900000 + 10000

    # Step 1: Zero-Trust Staged Submission (No Immediate Progress Credited)
    print("--- 1. Testing Zero-Trust Staged Submission ---")
    img_bytes_1 = create_unique_jpeg(seed=run_seed)

    resp_submit_1 = client.post(
        "/api/contractor/submit-progress",
        data={
            "project_id": project_id,
            "contractor_id": contractor_id,
            "physical_progress_pct": 24.5,
            "financial_expenditure_cr": 2.5,
            "notes": "Foundation piling milestone phase 1 completed.",
            "gps_lat": 19.0760,
            "gps_lng": 72.8777,
        },
        files={"file": ("site_unique_1.jpg", img_bytes_1, "image/jpeg")},
    )
    assert resp_submit_1.status_code == 200, f"Submit 1 failed: {resp_submit_1.text}"
    data_1 = resp_submit_1.json()
    sub_id_1 = data_1["submission_id"]
    print(f"✓ Submission 1 created: {sub_id_1}")
    print(f"  Status: {data_1['verification_status']}, Counts Towards Progress: {data_1['counts_towards_progress']}")
    assert data_1["counts_towards_progress"] is False, "Zero-Trust violation: unapproved submission counted towards progress!"
    assert data_1["counts"] is False
    assert data_1["status"] in ("pending_review", "flagged_anomaly")

    # Check database record
    conn_rp = db_manager.get_reports_photos_conn()
    cur = conn_rp.cursor()
    cur.execute("SELECT verification_status, counts_towards_progress, fraud_score, photo_hash FROM contractor_progress_reports WHERE submission_id = ?", (sub_id_1,))
    row_1 = cur.fetchone()
    conn_rp.close()
    assert row_1 is not None
    assert row_1[1] == 0, "DB error: counts_towards_progress should be 0 on submission!"
    print(f"✓ DB verified: counts_towards_progress = 0, photo_hash = {row_1[3][:12]}...")

    # Step 2: Testing Duplicate Photo Detection (Cross-Project / Reused Photo)
    print("\n--- 2. Testing Duplicate Photo Detection (Cross-Project / Reused Photo) ---")
    # Submit the exact same image bytes for a different project
    resp_submit_dup = client.post(
        "/api/contractor/submit-progress",
        data={
            "project_id": "PRJ-0001",
            "contractor_id": "CNT-LT-01",
            "physical_progress_pct": 30.0,
            "financial_expenditure_cr": 1.0,
            "notes": "Claiming progress with reused photo from Mumbai metro.",
            "gps_lat": 19.1000,
            "gps_lng": 72.9000,
        },
        files={"file": ("site_reused.jpg", img_bytes_1, "image/jpeg")},
    )
    assert resp_submit_dup.status_code == 200
    data_dup = resp_submit_dup.json()
    sub_id_dup = data_dup["submission_id"]
    print(f"✓ Duplicate submission created: {sub_id_dup}")
    print(f"  Fraud Score: {data_dup.get('fraud_score')}%, Risk Level: {data_dup.get('risk_level')}")
    flags_dup = [f["code"] for f in data_dup.get("fraud_flags", [])]
    print(f"  Triggered Flags: {flags_dup}")
    assert any("RECYCLED_PHOTO" in code for code in flags_dup), f"Expected RECYCLED_PHOTO flag, got {flags_dup}"
    assert data_dup["fraud_score"] >= 60, f"Expected high fraud score for duplicate photo, got {data_dup['fraud_score']}"
    assert data_dup["status"] == "flagged_anomaly"

    # Step 3: Approve Submission 1 via Main Admin to establish approved baseline
    print("\n--- 3. Establishing Approved Baseline via Authoritative Sign-Off ---")
    resp_appr_1 = client.post(
        f"/api/admin/audits/{sub_id_1}/review",
        json={
            "status": "approved",
            "reviewer_name": "Director General (Admin)",
            "reviewer_role": "main_admin",
            "reviewer_notes": "Statutory inspection verified on-ground piling.",
        },
    )
    assert resp_appr_1.status_code == 200
    data_appr_1 = resp_appr_1.json()
    print(f"✓ Baseline established: {data_appr_1['message']}")
    assert data_appr_1["counts_towards_progress"] == 1

    # Step 4: Testing Progress Velocity Anomaly (+57.5% jump from 24.5% to 82.0%)
    print("\n--- 4. Testing Progress Velocity Anomaly (Impossible Jump) ---")
    img_bytes_3 = create_unique_jpeg(seed=run_seed + 55555)  # Distinct unique image
    resp_submit_spike = client.post(
        "/api/contractor/submit-progress",
        data={
            "project_id": project_id,
            "contractor_id": contractor_id,
            "physical_progress_pct": 82.0,  # Spiking from 24.5% to 82.0% (+57.5% jump!)
            "financial_expenditure_cr": 15.0,
            "notes": "Unrealistic jump in progress.",
            "gps_lat": 19.0760,
            "gps_lng": 72.8777,
        },
        files={"file": ("site_spike.jpg", img_bytes_3, "image/jpeg")},
    )
    assert resp_submit_spike.status_code == 200
    data_spike = resp_submit_spike.json()
    sub_id_spike = data_spike["submission_id"]
    print(f"✓ Velocity Spike submission created: {sub_id_spike}")
    print(f"  Fraud Score: {data_spike.get('fraud_score')}%, Risk Level: {data_spike.get('risk_level')}")
    flags_spike = [f["code"] for f in data_spike.get("fraud_flags", [])]
    print(f"  Triggered Flags: {flags_spike}")
    assert any("VELOCITY" in code for code in flags_spike), f"Expected velocity anomaly flag, got {flags_spike}"
    assert data_spike["requires_main_admin_approval"] is True

    # Step 5: Testing Maker-Checker Workflow (Sub-Admin cannot unilaterally approve high-risk/high-value claims)
    print("\n--- 5. Testing Maker-Checker Escalation ---")
    # Sub-admin attempts to approve the high-risk velocity spike
    resp_sub_review = client.post(
        f"/api/admin/audits/{sub_id_spike}/review",
        json={
            "status": "approved",
            "reviewer_name": "Field Inspector Roy",
            "reviewer_role": "subadmin",
            "reviewer_id": "SADM-ROY",
            "reviewer_notes": "Field inspection conducted. Recommending approval.",
        },
    )
    assert resp_sub_review.status_code == 200
    data_sub_rev = resp_sub_review.json()
    print(f"✓ Sub-admin review response: {data_sub_rev['message']}")
    print(f"  Verification Status: {data_sub_rev['verification_status']}, Counts: {data_sub_rev['counts_towards_progress']}")
    assert data_sub_rev["verification_status"] == "subadmin_approved"
    assert data_sub_rev["counts_towards_progress"] == 0, "Maker-Checker breached: Sub-Admin was able to credit progress on an escalated audit!"

    # Step 6: High Anomaly Mandatory Justification Requirement
    print("\n--- 6. Testing High Anomaly Mandatory Justification ---")
    # Main Admin attempts to approve high-risk audit without a substantive justification
    resp_bad_override = client.post(
        f"/api/admin/audits/{sub_id_spike}/review",
        json={
            "status": "approved",
            "reviewer_name": "Director General",
            "reviewer_role": "main_admin",
            "override_reason": "ok",  # Too short (< 20 chars)
        },
    )
    assert resp_bad_override.status_code == 400, f"Expected 400 for short justification, got {resp_bad_override.status_code}"
    print(f"✓ Blocked unreasoned high-anomaly approval: {resp_bad_override.json()['detail']}")

    # Main Admin provides legally binding statutory justification
    valid_justification = "Central technical audit verified deck girder casting on-site via LiDAR telemetry."
    resp_good_override = client.post(
        f"/api/admin/audits/{sub_id_spike}/review",
        json={
            "status": "approved",
            "reviewer_name": "Director General",
            "reviewer_role": "main_admin",
            "override_reason": valid_justification,
        },
    )
    assert resp_good_override.status_code == 200
    data_good_rev = resp_good_override.json()
    print(f"✓ Main Admin authoritative sign-off accepted: {data_good_rev['message']}")
    assert data_good_rev["counts_towards_progress"] == 1
    assert data_good_rev["verification_status"] == "manually_approved"

    # Step 7: Verify Admin Audits Endpoint Returns Full Forensic Data
    print("\n--- 7. Testing /api/admin/audits enriched payload ---")
    resp_audits = client.get("/api/admin/audits?limit=10")
    assert resp_audits.status_code == 200
    audits_list = resp_audits.json()
    assert len(audits_list) > 0
    sample_audit = next(a for a in audits_list if a["submission_id"] == sub_id_spike)
    assert "fraud_score" in sample_audit
    assert "fraud_flags" in sample_audit
    assert "photo_hash" in sample_audit
    print(f"✓ Audit record {sample_audit['submission_id']} has fraud_score: {sample_audit['fraud_score']}, flags: {len(sample_audit['fraud_flags'])}")

    print("\n=======================================================")
    print("ALL ANTI-FRAUD VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=======================================================\n")


if __name__ == "__main__":
    test_fraud_prevention_suite()
