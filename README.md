# Nirman-AI (Paimana)

An **Infrastructure Oversight Co-Pilot** that monitors India's large infrastructure projects for **cost and time overruns**. It ingests monthly progress reports (MoSPI baselines), grounds synthetic project trajectories in real state/sector trends, trains **XGBoost** cost/time-overrun (COP/TOP) models, explains every prediction with **SHAP**, and surfaces actionable intelligence through a **FastAPI** backend and an enterprise **React** dashboard.

Now featuring an **On-Site Contractor Portal** with **Geofence Lamina Verification**, **EXIF/ELA Photo Auditing**, **Unified Authentication**, cloud-ready **Supabase PostgreSQL / SQLite Dual Storage**, and complete **Light & Dark Theme Styling**.

---

## Access Credentials

Public national project data, portfolios, maps, and intelligence remain accessible to guest visitors without logging in. Specialized management portals require role authentication:

### 1. Oversight Administrator (Director General / MoSPI / PMG)
- **Portal URL**: `/admin` or `/login?tab=admin`
- **Username**: `admin`
- **Password**: `admin123`
- **Identity**: `ADM-DG-01` — Director General (Project Monitoring Group, MoSPI)
- **Capabilities**:
  - Full infrastructure portfolio oversight and critical risk auditing
  - Contractor project assignment across states and sectors
  - Direct registration of new national capital projects
  - Dynamic hexagonal Geofence Lamina specification and GPS radius configuration
  - Comprehensive photo fraud and audit trail verification

### 2. General Contractor Logins (Infrastructure EPCs)
- **Portal URL**: `/contractor` or `/login?tab=contractor`
- **Password**: `contractor123` *(applies to all contractor profiles)*

| Contractor Company | Contractor ID | Password | Key Assigned Projects | Primary States |
|---|---|---|---|---|
| **Larsen & Toubro Heavy Civil Infra** | `CNT-LT-01` | `contractor123` | `PRJ-0001`, `PRJ-0004`, `PRJ-0015` | Maharashtra, Gujarat, Rajasthan |
| **Afcons Infrastructure Ltd** | `CNT-AF-02` | `contractor123` | `PRJ-0002`, `PRJ-0010`, `PRJ-0018` | Delhi, Uttar Pradesh, Punjab |
| **Tata Projects Ltd** | `CNT-TP-03` | `contractor123` | `PRJ-0003`, `PRJ-0007`, `PRJ-0022` | Karnataka, Telangana, Tamil Nadu |
| **Dilip Buildcon Ltd** | `CNT-DB-04` | `contractor123` | `PRJ-0005`, `PRJ-0012`, `PRJ-0030` | Madhya Pradesh, Rajasthan, Bihar |
| **Megha Engineering & Infra (MEIL)** | `CNT-ME-05` | `contractor123` | `PRJ-0006`, `PRJ-0014`, `PRJ-0028` | Andhra Pradesh, Odisha, Telangana |

---

## Architecture & System Flow

```
raw CSVs (MoSPI-style monthly reports, Feb–Jul)
      │  parse_*.py
      ▼
tidy CSVs ──► generate_synthetic_projects.py ──► synthetic project trajectories
      │                                              (drift sampled from real
      │                                               state/sector curves)
      ▼
build_database.py ──► Dual Database Engine (Supabase PostgreSQL / SQLite fallback)
      │               ├── project_monitoring (11 tables: projects, snapshots, features, baselines)
      │               ├── contractors_admin  (profiles, credentials, assignments, geofences)
      │               └── reports_photos     (on-site submissions, audits, photo telemetry)
      ▼
train_models.py ──► cop_model.json / top_model.json   (XGBoost COP & TOP models)
      │
      ▼
risk_analysis.py ──► model_risk_scores + early_warnings + SHAP figures
      │
      ▼
api.py (FastAPI) ◄── verification_pipeline.py (Geofence Lamina, EXIF, ELA, ImageHash)
      │          ◄── scoring.py (ScoreEngine: risk score, SHAP drivers, timeline)
      │          ◄── llm.py (OpenRouter AI Intervention Briefs)
      ▼
React Frontend (Vite + Tailwind + Recharts + Leaflet)
      ├── Public: Dashboard, Projects (/projects/:id), Map (/map), State Analysis, Reports
      ├── Contractor: Contractor Panel (/contractor) with live GPS camera & Lamina verification
      └── Admin: Oversight Panel (/admin) with contractor assignments & geofence mapping
```

---

## Key Features & Recent Enhancements

### 1. Synthetic Data Accuracy & "Completed" Project Status
- Projects with physical execution $\ge 100\%$ (`physical_progress_pct >= 100.0`) are automatically identified and mapped to the **`Completed`** status across cards, map views, detail views, and tables.
- Eliminates false "At Risk" flags for successfully delivered projects while preserving their historical cost variance and completion records.

### 2. Dynamic Theme Switching (Light & Dark Mode)
- Every page, component, modal dialog, and report table features full dark/light theme adaptation.
- System preferences and user toggles are persisted in `localStorage`.
- All modals, overlays, borders, typography, and charts smoothly transition between crisp slate/white surfaces and deep obsidian/ink tones.

### 3. Project Routing & Strict Data Isolation
- Each project URL (`/projects/:id`) points directly and strictly to its own unique telemetry, snapshot timeline, and SHAP drivers.
- All report downloads and overview tables link directly to isolated project profiles (`/projects/${project.id}`) rather than generic views.

### 4. Machine Learning Model Performance
Evaluated via `eval_model.py` on held-out live telemetry:
- **Cost Overrun Predictor (`cop_model.json`)**:
  - Accuracy: **0.952** (Exceeds target of 0.93)
  - Active Monitoring (July Snapshot) Accuracy: **0.963**
  - ROC AUC: **0.990**
- **Time Overrun Predictor (`top_model.json`)**:
  - Active Monitoring Accuracy: **0.957**
  - Project-level Aggregated Accuracy: **0.963**

### 5. On-Site Contractor Verification Pipeline
- **Geofence Lamina (`verification_pipeline.py`)**: Uses a ray-casting point-in-polygon algorithm over a 6-vertex WGS-84 polygonal perimeter around construction sites.
- **EXIF Extraction**: Checks GPS coordinates and capture timestamps against submission time.
- **Error-Level Analysis (ELA)**: Recompression artifact heuristics detect manipulated or resaved digital images.
- **Perceptual Hashing (`imagehash`)**: Detects duplicate or repeated photo submissions across reports.

### 6. Hybrid Database Architecture (Supabase PostgreSQL + SQLite)
- `db_manager.py` transparently routes queries to **Supabase PostgreSQL** via connection pooling when `DATABASE_URL` is set, and falls back to local SQLite databases when offline.
- Handles PostgreSQL `NUMERIC` types seamlessly with custom `DEC2FLOAT` typecasters.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend / API** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, Psycopg2 |
| **Databases** | Supabase (PostgreSQL) / SQLite (`project_monitoring.db`, `contractors_admin.db`, `reports_photos.db`) |
| **Machine Learning** | XGBoost (`cop_model.json`, `top_model.json`), scikit-learn, SHAP |
| **Verification** | Pillow (PIL), Piexif, ImageHash, Haversine & Ray-casting Polygon math |
| **AI Narratives** | OpenRouter API (`qwen/qwen3-reranker-8b` / fallback rule engine) |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons, Leaflet (React-Leaflet 4) |

---

## Setup & Running Locally

### 1. Python Environment
```bash
# Using uv (recommended)
uv venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
uv pip install -r requirements.txt

# Or standard pip
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Environment Configuration (.env)
Create a `.env` file in the project root (see `.env.example`):
```ini
# Supabase PostgreSQL connection string (optional; falls back to SQLite if empty)
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Optional OpenRouter key for AI narratives
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_MODEL="qwen/qwen3-reranker-8b"
```

### 3. Start Backend Server
```bash
python api.py
# Server running at: http://127.0.0.1:8000
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
# Dev server running at: http://localhost:5173
```

---

## Testing & Validation Suite

```bash
# Run end-to-end database, scoring, and baseline fidelity tests
python test_end_to_end.py

# Run contractor panel, geofence lamina, and photo verification tests
python test_contractor_geofence.py

# Evaluate XGBoost COP and TOP model performance metrics
python eval_model.py

# Test Supabase / Multi-database manager synchronization
python test_multi_db.py
```

---

## Key API Endpoints

| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate as Contractor or Admin | Public |
| `GET` | `/api/health` | Healthcheck and active database status | Public |
| `GET` | `/api/projects` | List projects with status, cost, and physical progress | Public |
| `GET` | `/api/projects?map=true` | Map feed with deterministic GPS coordinates | Public |
| `GET` | `/api/projects/{id}` | Comprehensive project detail, SHAP drivers & risk score | Public |
| `GET` | `/api/contractors/{id}/projects` | Retrieve assigned packages and active geofences | Contractor |
| `POST` | `/api/contractor/submit-progress`| Submit on-site photo report with GPS coordinates | Contractor |
| `GET` | `/api/admin/audits` | View photo audit logs, ELA scores, and geofence checks | Admin |
| `POST` | `/api/admin/geofence` | Update center coordinates and radius for a project site | Admin |
| `POST` | `/api/admin/assign-contractor` | Assign an EPC contractor to a specific package | Admin |
| `POST` | `/api/predict` | Run hypothetical what-if scenario through ML models | Public |
| `POST` | `/api/llm/explain` | Generate plain-English AI intervention briefs | Public |
