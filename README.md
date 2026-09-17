# Nirman-AI (Paimana) 🏛️
### *National Infrastructure Oversight Co-Pilot, Zero-Trust Anti-Fraud Verification & Risk Intelligence Platform*

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61DAFB.svg)](https://react.dev/)
[![Database](https://img.shields.io/badge/Database-Supabase_PostgreSQL_%2F_SQLite-3ECF8E.svg)](https://supabase.com/)
[![Machine Learning](https://img.shields.io/badge/ML-XGBoost_%2B_SHAP-FF6600.svg)](https://xgboost.readthedocs.io/)
[![Zero-Trust](https://img.shields.io/badge/Security-Zero--Trust_Anti--Fraud-red.svg)](#-zero-trust-anti-fraud--verification-engine)

---

## 📑 Table of Contents
- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [All Recent Upgrades & Capabilities](#-all-recent-upgrades--capabilities)
- [Testing & Demo Credentials](#-testing--demo-credentials)
- [Zero-Trust Anti-Fraud & Verification Engine](#-zero-trust-anti-fraud--verification-engine)
- [Application Portals & Route Guide](#-application-portals--route-guide)
- [Tech Stack](#-tech-stack)
- [Local Setup & Quickstart](#-local-setup--quickstart)
- [Automated Verification Suite](#-automated-verification-suite)
- [Core REST API Reference](#-core-rest-api-reference)

---

## 🔍 Overview

**Nirman-AI (Paimana)** is an enterprise-grade **Infrastructure Oversight Co-Pilot** purpose-built to eliminate cost and time overruns in India's mega-infrastructure portfolio (roads, railways, metro, energy, water, and urban development). 

Grounding project forecasts in real **Ministry of Statistics and Programme Implementation (MoSPI)** monthly datasets, Nirman-AI combines **XGBoost machine learning**, **SHAP explainability**, **high-precision geospatial geofencing**, and a **Zero-Trust Anti-Fraud Engine** with **Maker-Checker dual governance** to ensure public funds are spent transparently and infrastructure milestones are verified with mathematical certainty.

---

## 🚀 All Recent Upgrades & Capabilities

Over recent releases, Nirman-AI has evolved from a predictive dashboard into a mission-critical, enterprise infrastructure co-pilot. Here is the full breakdown of recent upgrades:

### 1. 🛡️ Zero-Trust Staging & Anti-Fraud Engine ([`fraud_detector.py`](file:///home/hridyansh/NirmanAi/fraud_detector.py))
- **Freeze on Premature State Mutation**: Submissions uploaded by contractors enter staged review with `counts_towards_progress = 0`. No project statistics or completion metrics mutate until formal administrative sign-off.
- **Cross-Project Perceptual Duplicate Image Matching**: Uses 64-bit DCT perceptual hashing (`imagehash.phash`) across all historical submissions nationwide. Any recycled or reused photo from another project or earlier milestone is flagged (`RECYCLED_PHOTO_CROSS_PROJECT`, Hamming distance $\le 6$).
- **Progress Velocity Spike Detection**: Measures progress velocity ($\Delta P / \Delta T$) against approved project baselines. Flags mathematically impossible jumps (`EXTREME_VELOCITY_JUMP` $> 30\%$ leap, or `IMPOSSIBLE_VELOCITY_SPIKE` $> 15\%$ within 14 days).
- **Physical-to-Financial Expenditure Decoupling**: Detects disproportionate expenditure claims where large capital outlay is claimed with zero or negative milestone advancement.
- **Multi-Modal Digital Forensics**: Scans photos for Error-Level Analysis (ELA) recompression artifacts, stale capture dates ($> 30$ days), and client device vs. EXIF GPS telemetry mismatches ($> 500\text{m}$).

### 2. ⚖️ Maker-Checker Dual-Control Governance ("4-Eyes Principle")
- **Field Inspector (Sub-Admin) Scope**: Sub-Admins can clear routine, low-risk field audits.
- **Mandatory Escalation**: Any audit with **Fraud Risk Score $\ge 25\%$**, claimed expenditure $> ₹50\text{ Lakhs}$, or progress jump $> 5\%$ requires Sub-Admin field recommendation (`subadmin_approved`, `counts = 0`) followed by Main Admin (Director General) counter-signature.
- **Mandatory Statutory Justification**: Main Admin approval of high-anomaly claims ($\text{Fraud Score} \ge 50\%$) is strictly blocked by the API unless a substantive justification note ($\ge 20$ characters) is provided.

### 3. 👥 Hierarchical Multi-Role Authentication
- **Main Admin (Director General)**: Full portfolio oversight, statutory counter-signing, contractor assignment, and geofence boundary calibration.
- **Sub-Admin (Field Inspector)**: On-site audit inspections, routine approvals, and Maker-Checker field recommendations.
- **EPC Contractor**: Package-specific camera uploads, live GPS telemetry capture, and zero-trust submission tracking.
- **Public / Guest Access**: Open access to national infrastructure maps, macro state analytics, and AI predictive simulations without requiring login.

### 4. 🗄️ Hybrid Cloud / Local Database Engine ([`db_manager.py`](file:///home/hridyansh/NirmanAi/db_manager.py))
- Transparent dual routing between **Supabase PostgreSQL** (connection-pooled) and local **SQLite** fallbacks (`project_monitoring.db`, `contractors_admin.db`, `reports_photos.db`).
- SQL translation layer seamlessly converts dialect specifics (upserts with `ON CONFLICT`, `SERIAL PRIMARY KEY`, and parameter handling).

### 5. 🗺️ Advanced Geospatial & Lamina Intelligence
- **Hexagonal Geofence Lamina**: Precision ray-casting point-in-polygon algorithm calculating containment within a 6-vertex WGS-84 perimeter around construction sites.
- **Interactive Leaflet Mapping**: State boundary centroids, clustering, project risk dots, and direct routing to isolated project timelines (`/projects/:id`).

### 6. 🎨 GovTech UI/UX & Dual-Theme Engine
- **Dark & Light Theme**: Universal theme toggle persisted via `localStorage`, featuring sleek obsidian dark tones and crisp enterprise light palettes.
- **Fraud Risk Meter Badge**: Interactive color-coded pills (`HIGH RISK`, `MED RISK`, `LOW RISK`) with an Anomaly Breakdown modal displaying exact forensic drivers.
- **Real-Time Notifications**: Integrated `NotificationCenter` tracking approvals, escalations, and geofence warnings.
- **Official Branding**: Integrated national emblems, official Paimana iconography, and Paimana favicon assets.

---

## 🔑 Testing & Demo Credentials

Use the following credentials to test different permission tiers and workflows across the platform.

### 1. Oversight Administrators (MoSPI / PMG / Field Inspectors)
> Login via: **`/login?tab=admin`** or **`/admin`**

| Role / Identity | Username | Password | Admin Level | Authority & Scope |
|---|---|---|---|---|
| **Director General (Main Admin)** | `admin` | `admin123` | `main` | Full national oversight, statutory counter-signature on escalated audits, contractor assignment, geofence configuration. |
| **Er. Arvind Nair (Sub-Admin / Field Inspector)** | `subadmin_test` | `password123` | `sub` | Field inspection, routine audit clearance, staged recommendations for high-risk submissions on assigned packages. |

### 2. General EPC Contractors
> Login via: **`/login?tab=contractor`** or **`/contractor`**  
> *(You can either select the contractor company from the login dropdown or enter their Contractor ID)*

| Contractor EPC Company | Contractor ID | Password | Key Assigned Projects | Primary Operating States |
|---|---|---|---|---|
| **Larsen & Toubro Heavy Civil Infra** | `CNT-LT-01` | `contractor123` | `PRJ-0001`, `PRJ-0004`, `PRJ-0015` | Maharashtra, Gujarat, Rajasthan |
| **Afcons Infrastructure Ltd** | `CNT-AF-02` | `contractor123` | `PRJ-0002`, `PRJ-0010`, `PRJ-0018` | Delhi, Uttar Pradesh, Punjab |
| **Tata Projects Ltd** | `CNT-TP-03` | `contractor123` | `PRJ-0003`, `PRJ-0007`, `PRJ-0022` | Karnataka, Telangana, Tamil Nadu |
| **Dilip Buildcon Ltd** | `CNT-DB-04` | `contractor123` | `PRJ-0005`, `PRJ-0012`, `PRJ-0030` | Madhya Pradesh, Rajasthan, Bihar |
| **Megha Engineering & Infra (MEIL)** | `CNT-ME-05` | `contractor123` | `PRJ-0006`, `PRJ-0014`, `PRJ-0028` | Andhra Pradesh, Odisha, Telangana |
| **Apex Infra Works Pvt Ltd (Test EPC)** | `CNT-TEST-01` | `password123` | Test sandbox package | National |

### 3. Public / Citizen / Auditor Access
> Direct access via: **`/`** (Dashboard), **`/projects`**, **`/map`**, **`/state-analysis`**, **`/reports`**

- **No login required**.
- Guest visitors can freely explore project risk scores, cost/time overrun projections, SHAP predictive drivers, and macro state baselines in read-only mode.

---

## 🛡️ Zero-Trust Anti-Fraud & Verification Engine

The verification pipeline enforces an uncompromising zero-trust lifecycle for every milestone claim:

```
                  CONTRACTOR ON-SITE SUBMISSION
                                │ (GPS Photo + Progress % + ₹ Claim)
                                ▼
               ┌─────────────────────────────────┐
               │    fraud_detector.py Engine     │
               │  - Global Phash Cross-Check     │
               │  - Progress Velocity Anomaly    │
               │  - Financial-Physical Decouple  │
               │  - ELA & GPS Telemetry Check    │
               └────────────────┬────────────────┘
                                │
                      Computes Fraud Score (0-100)
                                │
                                ▼
               ┌─────────────────────────────────┐
               │    STAGED REVIEW (Zero-Trust)   │
               │   counts_towards_progress = 0   │
               │  (Active DB metrics unmutated)  │
               └────────────────┬────────────────┘
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                                             ▼
Low Risk (< 25 Score)                        Medium / High Risk
Routine Field Claim                          Maker-Checker Mandatory
         │                                             │
Sub-Admin Directly Approves                  Sub-Admin Inspects & Recommends
         │                                   (status: subadmin_approved)
         │                                             │
         │                                   Main Admin (DG) Counter-Signs
         │                                   (Requires Written Justification)
         └──────────────────────┬──────────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │     AUDIT APPROVED & LOCKED     │
               │   counts_towards_progress = 1   │
               │  recompute_project_intelligence │
               └─────────────────────────────────┘
```

---

## 🧭 Application Portals & Route Guide

| Route Path | Portal Name | Access Level | Primary Features |
|---|---|---|---|
| `/` | **National Infrastructure Dashboard** | Public / All | Macro KPI metrics, portfolio risk distribution, early warning list, sector breakdown. |
| `/projects` | **Project Directory** | Public / All | Searchable and filterable catalog of all national capital projects with overrun risk tags. |
| `/projects/:id` | **Project Intelligence Detail** | Public / All | Isolated project timeline, S-curves, SHAP risk drivers, photo audit history, and AI briefs. |
| `/map` | **Geospatial Map View** | Public / All | Interactive national map with risk color-coding, GPS coordinates, and state boundary clusters. |
| `/state-analysis` | **State Macro Analytics** | Public / Admin | State-by-state infrastructure health, budget variances, and delay trends. |
| `/reports` | **MoSPI Reports & Exports** | Public / Admin | Filterable baseline reports, CSV export capability, and statutory compliance indicators. |
| `/intelligence` | **What-If Scenario Simulator** | Public / Admin | Interactive parameter tuning to simulate the effect of budget changes and delays using XGBoost. |
| `/contractor` | **Contractor On-Site Panel** | Contractor | Package selector, live camera GPS capture, milestone claim submission, staged status banner. |
| `/admin` | **Oversight Administration** | Admin / Sub-Admin | Audit queue, Fraud Risk Meter, Anomaly Breakdown popover, Maker-Checker review actions, geofence editor, and contractor assignment. |
| `/login` | **Authentication Gateway** | Public | Unified multi-role login and registration for Contractors and Sub-Admins. |

---

## 🛠️ Tech Stack

| Layer | Technologies Used |
|---|---|
| **Backend & API** | Python 3.10+, FastAPI, Uvicorn, Pydantic, SQLAlchemy, Psycopg2 |
| **Machine Learning** | XGBoost (`cop_model.json`, `top_model.json`), scikit-learn, SHAP |
| **Anti-Fraud & Forensics**| ImageHash (`imagehash.phash`), Pillow (PIL), Piexif, Error-Level Analysis (ELA) |
| **Databases** | Supabase (PostgreSQL 15) with connection pooling / Local SQLite fallback |
| **Frontend Framework** | React 18, TypeScript, Vite |
| **Styling & Theme** | Tailwind CSS, Lucide Icons, Universal Dark/Light Theme Engine |
| **Geospatial & Viz** | Leaflet, React-Leaflet 4, Recharts, Custom Ray-Casting Polygon Algorithms |
| **AI Narratives** | OpenRouter API (`qwen/qwen3-reranker-8b` / local deterministic rule engine fallback) |

---

## 💻 Local Setup & Quickstart

### 1. Prerequisites
- Python 3.10 or higher
- Node.js 18+ & npm
- Git

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/vipuljoshi0001/NirmanAi.git
cd NirmanAi

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the project root:
```ini
# Optional: Supabase PostgreSQL connection string (falls back to local SQLite if omitted)
SUPABASE_DB_URL="postgresql://postgres.xxx:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Optional: OpenRouter key for generative AI intervention briefs
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_MODEL="qwen/qwen3-reranker-8b"
```

### 4. Start Backend API
```bash
python api.py
# Backend runs at: http://127.0.0.1:8000
# OpenAPI Docs at: http://127.0.0.1:8000/docs
```

### 5. Frontend Setup & Launch
```bash
cd frontend
npm install
npm run dev
# Frontend runs at: http://localhost:5173
```

---

## 🧪 Automated Verification Suite

Nirman-AI features a comprehensive suite of automated tests covering machine learning, data pipelines, database synchronization, and anti-fraud governance:

```bash
# 1. Anti-Fraud & Zero-Trust Verification Test Suite (7 End-to-End Stages)
python test_fraud_prevention.py

# 2. Contractor Panel, Geofence Lamina, and EXIF/ELA Photo Verification Tests
python test_contractor_geofence.py

# 3. Core Database, Scoring, and Baseline Fidelity Tests
python test_end_to_end.py

# 4. Multi-Database (Supabase PostgreSQL / SQLite) Synchronization Test
python test_multi_db.py

# 5. XGBoost Machine Learning Model Evaluation (COP & TOP Accuracy)
python eval_model.py
```

### What `test_fraud_prevention.py` Validates:
1. **Zero-Trust Staging**: Progress reports enter staged review with `counts_towards_progress = 0` without mutating project records.
2. **Duplicate Image Detection**: Cross-project and same-project photo reuse flags `RECYCLED_PHOTO_CROSS_PROJECT` ($\text{score} \ge 65\%$).
3. **Approved Baseline Establishment**: Authoritative sign-off by Main Admin correctly establishes legitimate project progress.
4. **Velocity Anomaly Detection**: Impossible progress leap ($+57.5\%$) flags `EXTREME_VELOCITY_JUMP`.
5. **Maker-Checker Escalation**: Sub-Admin approval on high-risk submissions leaves `counts = 0` awaiting Main Admin counter-sign.
6. **Mandatory Justification Protection**: Approving high-anomaly reports without a substantive justification note ($\ge 20$ chars) is blocked with HTTP 400.
7. **Enriched Audit Telemetry**: Audit endpoint delivers complete biometric, telemetric, and perceptual hash metadata.

---

## 📡 Core REST API Reference

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate as Contractor, Sub-Admin, or Main Admin | Public |
| `POST` | `/api/auth/register` | Register new Contractor or Sub-Admin profile | Public |
| `GET` | `/api/health` | Healthcheck and active database connectivity status | Public |
| `GET` | `/api/projects` | List projects with status, cost, and physical progress | Public |
| `GET` | `/api/projects?map=true` | Map feed with deterministic GPS coordinates | Public |
| `GET` | `/api/projects/{id}` | Detailed project telemetry, SHAP drivers & risk score | Public |
| `GET` | `/api/contractors/{id}/projects` | Retrieve assigned packages and active geofences | Contractor |
| `POST` | `/api/contractor/submit-progress`| Submit on-site photo report with GPS coordinates | Contractor |
| `GET` | `/api/admin/audits` | View audit logs, fraud scores, and anomaly flags | Admin / Sub-Admin |
| `POST` | `/api/admin/audits/{id}/review` | Maker-Checker audit review (Approve / Reject) | Admin / Sub-Admin |
| `POST` | `/api/admin/geofence` | Update center coordinates and radius for a project site | Main Admin |
| `POST` | `/api/admin/assign-contractor` | Assign an EPC contractor to a specific package | Main Admin |
| `POST` | `/api/predict` | Run hypothetical what-if scenario through ML models | Public |
| `POST` | `/api/llm/explain` | Generate plain-English AI intervention briefs | Public |

---

## 🏛️ Governance & Compliance

Nirman-AI is engineered to align with the oversight principles of the **Ministry of Statistics and Programme Implementation (MoSPI)**, the **PM GatiShakti National Master Plan**, and standard Central Vigilance Commission (CVC) infrastructure guidelines for public procurement and milestone verification.
