# Nirman-AI (PAIMANA) 🏛️
### *National Infrastructure Oversight Co-Pilot, Zero-Trust Anti-Fraud Verification & Risk Intelligence Platform*

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Database](https://img.shields.io/badge/Database-Supabase_PostgreSQL_%2F_SQLite-3ECF8E.svg?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![Machine Learning](https://img.shields.io/badge/ML-XGBoost_%2B_SHAP-FF6600.svg?style=flat)](#-machine-learning--predictive-intelligence)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare_Pages-F38020.svg?style=flat&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7.svg?style=flat&logo=render&logoColor=black)](https://render.com/)
[![GovTech India](https://img.shields.io/badge/Framework-MoSPI_%2B_PM_GatiShakti-138808.svg?style=flat)](#-governance--compliance)

---

## 📑 Table of Contents
- [Executive Overview](#-executive-overview)
- [Key Metrics at a Glance](#-key-metrics-at-a-glance)
- [System Architecture](#-system-architecture)
- [Key Features & Capabilities](#-key-features--capabilities)
  - [1. Unified Single-Origin Portal](#1-unified-single-origin-portal)
  - [2. Interactive State Analysis & India Geospatial Engine](#2-interactive-state-analysis--india-geospatial-engine)
  - [3. Zero-Trust Anti-Fraud & Forensic Verification](#3-zero-trust-anti-fraud--forensic-verification)
  - [4. Maker-Checker Governance (4-Eyes Principle)](#4-maker-checker-governance-4-eyes-principle)
  - [5. Machine Learning & Predictive Risk Intelligence](#5-machine-learning--predictive-risk-intelligence)
  - [6. Hybrid Cloud / Local Dual Persistence Layer](#6-hybrid-cloud--local-dual-persistence-layer)
  - [7. Generative AI Copilot & Remedial Narratives](#7-generative-ai-copilot--remedial-narratives)
- [Project Directory Structure](#-project-directory-structure)
- [Quickstart: Running the Application](#-quickstart-running-the-application)
  - [Mode A: Unified Portal (Single-Origin, Production Ready)](#mode-a-unified-portal-single-origin-production-ready)
  - [Mode B: Decoupled Development Mode (Vite + FastAPI)](#mode-b-decoupled-development-mode-vite--fastapi)
- [Testing & Demo Credentials](#-testing--demo-credentials)
- [Cloud & Production Deployment Guide](#-cloud--production-deployment-guide)
  - [Frontend: Cloudflare Pages](#frontend-cloudflare-pages)
  - [Backend: Render](#backend-render)
  - [Supabase PostgreSQL Configuration](#supabase-postgresql-configuration)
- [Automated Verification Test Suite](#-automated-verification-test-suite)
- [Application Portals & Route Guide](#-application-portals--route-guide)
- [Core REST API Reference](#-core-rest-api-reference)
- [Technology Stack](#-technology-stack)
- [Governance, MoSPI & PM GatiShakti Compliance](#-governance-mospi--pm-gatishakti-compliance)

---

## 🔍 Executive Overview

**Nirman-AI (PAIMANA)** is an enterprise **National Infrastructure Oversight Co-Pilot** purpose-built to eliminate cost overruns, schedule delays, and contractor billing fraud across India's mega-infrastructure portfolio (highways, railways, metro systems, renewable energy, and urban transit corridors).

Historically, public capital expenditure monitoring has suffered from fragmented paper reporting, subjective field assessments, milestone recycling, and delayed anomaly detection. Nirman-AI transforms this paradigm by grounding infrastructure oversight in real **Ministry of Statistics and Programme Implementation (MoSPI)** data feeds and coupling it with:

1. **Predictive AI Risk Models**: Calibrated XGBoost classifiers predicting Cost Overrun Probability (COP) and Time Overrun Probability (TOP), accompanied by game-theoretic SHAP feature attributions.
2. **Zero-Trust Multi-Modal Forensics**: Perceptual image hashing (DCT 64-bit phash) to prevent cross-project milestone recycling, Error-Level Analysis (ELA) for image manipulation detection, and progress velocity jump validation.
3. **Four-Eyes Governance (Maker-Checker Principle)**: Strict dual-signature authorization preventing unilateral approval on high-value or high-risk milestone claims.
4. **Geospatial & Density Surface**: Interactive 36-jurisdiction vector map with real-time project density tiers, single-state focus isolation, and WGS-84 polygonal geofencing.
5. **Unified Portal Architecture**: A high-efficiency single-port architecture serving both the compiled React 18 SPA and the FastAPI engine on a single origin.

---

## 📊 Key Metrics at a Glance

| Metric | Specification / Coverage |
|---|---|
| **National Project Portfolio** | **317 Capital Infrastructure Projects** across 15+ Core Sectors |
| **Geographic Coverage** | **36 States & Union Territories** with vector density mapping |
| **ML Predictive Engine** | **XGBoost (COP & TOP)** trained on calibrated MoSPI features |
| **Explainable AI (XAI)** | **SHAP TreeExplainer** feature-level attribution per project |
| **Anti-Fraud Security** | **DCT 64-bit Perceptual Hash**, ELA Forensics, Velocity Jump Gates |
| **Governance Standard** | **Maker-Checker Dual Control** (Field Sub-Admin & Main Admin) |
| **Persistence Modes** | **Hybrid**: Cloud Supabase (Port 6543) + Local 3-Partition SQLite |
| **Generative Intelligence** | **OpenRouter AI Copilot** (`gemini-2.5-flash` / deterministic fallback) |

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Client Tier (React 18 + TypeScript + Vite + Tailwind)"]
        UI["Unified Portal SPA"]
        Dashboard["National Dashboard (/)"]
        StateMap["36-State Analytics (/state-analysis)"]
        GeoMap["Geospatial Map (/map)"]
        WhatIf["What-If Scenario Simulator (/intelligence)"]
        ContractorUI["Contractor Mobile Desk (/contractor)"]
        AdminUI["Maker-Checker Oversight Desk (/admin)"]
    end

    subgraph Server["Application & API Tier (FastAPI - Port 8000)"]
        FastAPI["FastAPI Routing Engine (api.py)"]
        SPAServe["Static SPA Handler (/frontend/dist)"]
        AuthModule["Unified Multi-Role Auth (JWT / Sessions)"]
        ScoringEngine["Scoring Engine (scoring.py)"]
        FraudEngine["Zero-Trust Forensics (fraud_detector.py)"]
        LLMModule["Executive Copilot (llm.py)"]
    end

    subgraph MLTier["Machine Learning & AI Layer"]
        COPModel["Cost Overrun Model (cop_model.json)"]
        TOPModel["Time Overrun Model (top_model.json)"]
        SHAPEngine["SHAP TreeExplainer (Feature Attribution)"]
        OpenRouter["OpenRouter Generative AI (Gemini 2.5 Flash)"]
    end

    subgraph Persistence["Hybrid Persistence Layer (db_manager.py)"]
        direction TB
        CloudDB[("Supabase PostgreSQL (Port 6543 Pooler)")]
        LocalDB[("Local SQLite 3-Tier Storage")]
        P1["project_monitoring.db (317 Projects, ML Scores)"]
        P2["contractors_admin.db (Auth, Geofences, Assignments)"]
        P3["reports_photos.db (Submissions, Hashes, Audits)"]
    end

    UI --> SPAServe
    UI -->|REST API Calls| FastAPI
    FastAPI --> AuthModule
    FastAPI --> ScoringEngine
    FastAPI --> FraudEngine
    FastAPI --> LLMModule
    ScoringEngine --> COPModel
    ScoringEngine --> TOPModel
    ScoringEngine --> SHAPEngine
    LLMModule --> OpenRouter
    FastAPI --> Persistence
    Persistence --> CloudDB
    Persistence -.->|Automatic Offline Fallback| LocalDB
    LocalDB --- P1
    LocalDB --- P2
    LocalDB --- P3
```

---

## 🚀 Key Features & Capabilities

### 1. Unified Single-Origin Portal
- **Zero CORS / Single Port**: Run one command (`python api.py`) to launch the complete full-stack portal on `http://localhost:8000/`.
- FastAPI natively mounts and serves optimized Vite production assets from `frontend/dist` with non-blocking SPA catch-all routing (`_spa_response`).
- Direct client-side route navigation (`/state-analysis`, `/projects`, `/admin`, `/contractor`) works seamlessly on both the unified server and static cloud hosts.

### 2. Interactive State Analysis & India Geospatial Engine
- **36-Jurisdiction Density Spectrum**: All 36 States and Union Territories display their real density colors upon load:
  - 🔴 **High Density** ($\ge 15$ projects): Deep Crimson (`#dc2626`)
  - 🟠 **Medium Density** ($5 - 14$ projects): Vibrant Orange (`#ea580c`)
  - 🟡 **Emerging States** ($< 5$ projects): Warm Amber (`#eab308`)
- **Selective Highlighting**: Clicking any state highlights that state with an elevation drop-shadow and greys out all other jurisdictions (`#94a3b8`).
- **One-Click Reset & Pan-India View**: Deselecting any state or clicking the status pill resets the map to full-color pan-India mode with aggregated national metrics (`/api/states/all`).
- **Container Auto-Fit & Boundary Sizing**: Proportional SVG scaling guarantees Northern Ladakh/J&K, Southern Kerala/Tamil Nadu, and Island territories fit inside `#geographic-india-map-container` without edge clipping.
- **Desktop-Centered Legend**: Density tier indicators horizontally centered along the bottom on desktop screens for balanced aesthetics.

### 3. Zero-Trust Anti-Fraud & Forensic Verification
The platform enforces an uncompromising zero-trust lifecycle for contractor claims ([`fraud_detector.py`](file:///home/hridyansh/NirmanAi/fraud_detector.py)):
- **Freeze on Premature State Mutation**: Progress claims enter staged review with `counts_towards_progress = 0`. Active project baselines never mutate until authorized by oversight officers.
- **Cross-Project Perceptual Duplicate Hashing**: 64-bit DCT perceptual hash (`imagehash.phash`) scanning all historical records nationwide. Flags recycled photos from other projects (`RECYCLED_PHOTO_CROSS_PROJECT`, Hamming distance $\le 6$).
- **Progress Velocity Anomaly Detection**: Mathematically impossible physical milestone jumps are flagged (`EXTREME_VELOCITY_JUMP` $> 30\%$, or `IMPOSSIBLE_VELOCITY_SPIKE` $> 15\%$ within 14 days).
- **Physical-to-Financial Decoupling**: Detects disproportionate financial disbursement claims when physical milestone advancement is zero or negative.
- **Multi-Modal Forensics**: Detects Error-Level Analysis (ELA) recompression anomalies, stale capture dates ($> 30$ days), and client device GPS vs. EXIF coordinate discrepancies ($> 500\text{m}$).

### 4. Maker-Checker Governance (4-Eyes Principle)
- **Field Inspector (Sub-Admin)**: Can approve routine, low-risk field audits ($\text{Score} < 25\%$).
- **Mandatory Escalation**: Submissions with **Fraud Score $\ge 25\%$**, claim $> ₹50\text{ Lakhs}$, or velocity leap $> 5\%$ require Sub-Admin field recommendation (`subadmin_approved`, `counts = 0`) followed by Main Admin (Director General) sign-off.
- **Mandatory Justification Gate**: Approving high-anomaly claims ($\text{Fraud Score} \ge 50\%$) strictly requires a substantive statutory justification note ($\ge 20$ characters) logged in the permanent audit trail.

### 5. Machine Learning & Predictive Risk Intelligence
- **Trained on MoSPI Data**: 16 calibrated features spanning financial burn rate, time elapsed ratio, sectoral baseline delay, and state-level historical slippage.
- **Cost Overrun Probability (COP)**: XGBoost classifier predicting whether a project will exceed original sanctioned cost.
- **Time Overrun Probability (TOP)**: XGBoost classifier predicting whether a project will breach its scheduled commissioning date.
- **SHAP Feature Attribution**: Explains *why* a project is at risk by highlighting the top positive and negative risk drivers in real time.

### 6. Hybrid Cloud / Local Dual Persistence Layer
- **Supabase PostgreSQL (Cloud Active)**: Automatic connection routing via Supabase connection pooler on port `6543`.
- **Zero-Config SQLite Fallback**: Automatic, seamless offline fallback across 3 partitioned databases:
  1. `project_monitoring.db`: Core infrastructure telemetry, snapshots, 16 features, and ML risk scores.
  2. `contractors_admin.db`: Contractor accounts, credentials, state package assignments, and geofences.
  3. `reports_photos.db`: On-site submissions, photo uploads, and audit verification records.

### 7. Generative AI Copilot & Remedial Narratives
- Integrates OpenRouter (`google/gemini-2.5-flash`) to generate real-time executive risk narratives and remedial action plans for monitored projects.
- **Deterministic Fallback**: Automatically falls back to rule-based explainability if an API key is not configured or offline.

---

## 📂 Project Directory Structure

```
NirmanAi/
├── api.py                           # Unified FastAPI Application (APIs & SPA Mount)
├── scoring.py                       # ML Inference Engine & SHAP TreeExplainer
├── fraud_detector.py                # Zero-Trust Anti-Fraud & Forensic Rules
├── verification_pipeline.py         # Multi-Modal Verification & Audit Pipeline
├── db_manager.py                    # Hybrid DB Layer (Supabase PostgreSQL / SQLite)
├── llm.py                           # OpenRouter Generative AI Risk Briefings
├── train_models.py                  # XGBoost Model Training Script (COP & TOP)
├── eval_model.py                    # Model Evaluation & ROC-AUC Validation
├── cop_model.json                   # Trained XGBoost Cost Overrun Model
├── top_model.json                   # Trained XGBoost Time Overrun Model
├── requirements.txt                 # Backend Python Dependencies
├── render.yaml                      # Render Blueprint Deployment Spec
├── package.json                     # Root Monorepo Build Helper
├── .env.example                     # Environment Variables Template
├── schema.sql                       # PostgreSQL / Supabase DDL Schema
│
├── frontend/                        # React 18 + TypeScript + Vite SPA
│   ├── package.json                 # Frontend NPM Dependencies
│   ├── vite.config.ts               # Vite Configuration & Proxy Settings
│   ├── tailwind.config.js           # GovTech Color Palette & UI Configuration
│   ├── dist/                        # Production Build Output (Served by FastAPI)
│   ├── public/
│   │   └── _redirects               # Cloudflare Pages Client-Side Route Redirects
│   └── src/
│       ├── App.tsx                  # Main Router & Theme Provider
│       ├── types.ts                 # TypeScript Interfaces & Model Types
│       ├── components/
│       │   ├── IndiaMapSvg.tsx      # Interactive 36-State Vector Density Map
│       │   ├── Navbar.tsx           # Global Navigation Header & Role Status
│       │   ├── AnomalyBreakdown.tsx # Forensic Breakdown & Flags Popover
│       │   └── ...                  # Reusable UI Elements
│       ├── pages/
│       │   ├── Dashboard.tsx        # Macro Executive KPI Dashboard
│       │   ├── StateAnalysis.tsx    # 36-State Analytics & Isolated View
│       │   ├── MapView.tsx          # Geospatial Leaflet Map View
│       │   ├── Projects.tsx         # Searchable National Project Catalog
│       │   ├── ProjectDetail.tsx    # S-Curves, SHAP Drivers & Audit Log
│       │   ├── Intelligence.tsx     # What-If Scenario Simulator
│       │   ├── ContractorPanel.tsx  # GPS Milestone Submission Mobile Desk
│       │   ├── AdminPanel.tsx       # Maker-Checker Audit & Geofence Desk
│       │   ├── Reports.tsx          # MoSPI Filterable Statutory Reports
│       │   └── LoginPage.tsx        # Multi-Role Authentication Gateway
│       └── services/
│           └── api.ts               # Axios Client with Dynamic API Base URL
│
├── test_fraud_prevention.py         # 7-Stage End-to-End Anti-Fraud Test Suite
├── test_contractor_geofence.py      # Contractor Panel & GPS Validation Tests
├── test_end_to_end.py               # Complete Project Lifecycle Tests
├── test_multi_db.py                 # Supabase / SQLite Dual-Engine Tests
│
├── project_monitoring.db            # Local SQLite: Projects & Risk Scores
├── contractors_admin.db             # Local SQLite: Auth, Packages & Geofences
└── reports_photos.db                # Local SQLite: Milestone Submissions & Photos
```

---

## ⚡ Quickstart: Running the Application

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Git**

### 2. Clone & Setup Python Environment
```bash
git clone https://github.com/vipuljoshi0001/NirmanAi.git
cd NirmanAi

# Create virtual environment
python -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure `.env` with your credentials:
```ini
# Supabase PostgreSQL (Port 6543 Transaction Pooler Recommended)
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Supabase REST / API Keys
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter / Gemini AI Copilot
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.5-flash
```
> [!NOTE]
> If `DATABASE_URL` is omitted, Nirman-AI automatically boots into its local SQLite mode using the 3 pre-seeded local databases.

---

### Mode A: Unified Portal (Single-Origin, Production Ready)
Build the frontend bundle and launch the complete stack from the unified server:

```bash
# 1. Build the production React frontend
npm --prefix frontend install && npm --prefix frontend run build

# 2. Start the unified portal
python api.py
```

The portal is immediately live on a single origin:
- 🏛️ **Unified Web Portal**: [http://localhost:8000/](http://localhost:8000/)
- 📖 **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- 🩺 **Health & Database Diagnostics**: [http://localhost:8000/api/databases/status](http://localhost:8000/api/databases/status)

---

### Mode B: Decoupled Development Mode (Vite + FastAPI)
For frontend development with instant Hot Module Replacement (HMR):

**Terminal 1 (Backend API):**
```bash
python api.py
```

**Terminal 2 (Frontend Dev Server):**
```bash
cd frontend
npm install
npm run dev
```

- ⚡ **Vite Dev Server**: [http://localhost:5173/](http://localhost:5173/) *(Proxies API requests to port 8000)*

---

## 🔑 Testing & Demo Credentials

Pre-configured accounts are provided to demonstrate role-based permissions and governance workflows:

### 1. Oversight Administrators
> Access via: **`/login?tab=admin`** or **`/admin`**

| Role / Identity | Username | Password | Level | Responsibilities |
|---|---|---|---|---|
| **Director General (Main Admin)** | `admin` | `admin123` | `main` | Full national oversight, statutory counter-signature on escalated audits, contractor assignment, geofence calibration. |
| **Er. Arvind Nair (Sub-Admin / Inspector)** | `subadmin_test` | `password123` | `sub` | Field inspection, routine audit clearance, staged recommendations for high-risk claims on assigned packages. |

### 2. General EPC Contractors
> Access via: **`/login?tab=contractor`** or **`/contractor`**

| Contractor Company | Contractor ID | Password | Key Assigned Projects | Primary States |
|---|---|---|---|---|
| **Larsen & Toubro Heavy Civil Infra** | `CNT-LT-01` | `contractor123` | `PRJ-0001`, `PRJ-0004`, `PRJ-0015` | Maharashtra, Gujarat, Rajasthan |
| **Afcons Infrastructure Ltd** | `CNT-AF-02` | `contractor123` | `PRJ-0002`, `PRJ-0010`, `PRJ-0018` | Delhi, Uttar Pradesh, Punjab |
| **Tata Projects Ltd** | `CNT-TP-03` | `contractor123` | `PRJ-0003`, `PRJ-0007`, `PRJ-0022` | Karnataka, Telangana, Tamil Nadu |
| **Dilip Buildcon Ltd** | `CNT-DB-04` | `contractor123` | `PRJ-0005`, `PRJ-0012`, `PRJ-0030` | Madhya Pradesh, Rajasthan, Bihar |
| **Megha Engineering & Infra (MEIL)** | `CNT-ME-05` | `contractor123` | `PRJ-0006`, `PRJ-0014`, `PRJ-0028` | Andhra Pradesh, Odisha, Telangana |

### 3. Public & Citizen Auditor Access
> Access via: **`/`**, **`/projects`**, **`/map`**, **`/state-analysis`**, **`/reports`**
- **No login required**: Citizens, journalists, and researchers can freely explore national KPIs, project timelines, state performance maps, and AI simulations in read-only mode.

---

## 🛡️ Zero-Trust Verification Workflow

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

## ☁️ Cloud & Production Deployment Guide

### Frontend: Cloudflare Pages

When deploying the frontend to **Cloudflare Pages**:

1. In Cloudflare Dashboard &rarr; **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
2. **Build Configuration**:
   - **Framework preset**: `Vite`
   - **Root directory**: `frontend` *(Crucial: ensures Cloudflare enters the frontend folder and avoids running Python installations)*
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. **Environment Variables**:
   - `NODE_VERSION`: `20`
   - `VITE_API_BASE_URL`: `https://your-backend-api.onrender.com` *(points API requests to your live backend)*

> [!TIP]
> The repository includes [`frontend/public/_redirects`](file:///home/hridyansh/NirmanAi/frontend/public/_redirects) (`/* /index.html 200`), ensuring that all React Router routes resolve properly on direct URL visits and page refreshes.

---

### Backend: Render

The repository includes a ready-to-use [`render.yaml`](file:///home/hridyansh/NirmanAi/render.yaml):

1. Link your repository in Render &rarr; **New Blueprint Instance**.
2. Configure environment variables in the Render Dashboard:
   - `DATABASE_URL`: Supabase connection pooler URI (`...:6543/postgres`).
   - `OPENROUTER_API_KEY`: OpenRouter API key for live AI narratives.
   - `PYTHON_VERSION`: `3.12.0`
3. **Build Command**:
   ```bash
   npm --prefix frontend install && npm --prefix frontend run build && pip install -r requirements.txt
   ```
4. **Start Command**:
   ```bash
   uvicorn api:app --host 0.0.0.0 --port $PORT
   ```

---

### Supabase PostgreSQL Configuration

For Supabase deployments:
- Use the **Transaction Pooler** connection string on port **`6543`**:
  ```ini
  DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
  ```
- Direct connections on port `5432` may experience IPv6 timeouts depending on cloud network environments; the `6543` pooler resolves this.
- To migrate or initialize tables, run:
  ```bash
  python migrate_to_supabase.py
  ```

---

## 🧪 Automated Verification Test Suite

Nirman-AI includes a comprehensive automated test suite covering machine learning, data pipelines, database synchronization, and anti-fraud governance:

```bash
# 1. Anti-Fraud & Zero-Trust Verification Test Suite (7 End-to-End Stages)
python test_fraud_prevention.py

# 2. Contractor Panel, Geofence, and Photo Verification Tests
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

## 🧭 Application Portals & Route Guide

| Route Path | Portal Name | Access Level | Primary Features |
|---|---|---|---|
| `/` | **National Infrastructure Dashboard** | Public / All | Macro KPI metrics, portfolio risk distribution, early warning list, sector breakdown. |
| `/projects` | **Project Directory** | Public / All | Searchable and filterable catalog of all 317 national capital projects with overrun risk tags. |
| `/projects/:id` | **Project Intelligence Detail** | Public / All | Isolated project timeline, S-curves, SHAP risk drivers, photo audit history, and AI briefs. |
| `/map` | **Geospatial Map View** | Public / All | Interactive national map with risk color-coding, GPS coordinates, and state boundary clusters. |
| `/state-analysis` | **State Macro Analytics** | Public / All | 36-jurisdiction map with full-color density tiers, state isolation, pan-India summary, and delay exposure. |
| `/intelligence` | **What-If Scenario Simulator** | Public / All | Interactive parameter tuning to simulate budget variance and schedule slip impacts via XGBoost. |
| `/reports` | **MoSPI Reports & Exports** | Public / All | Filterable baseline reports, CSV export capability, and statutory compliance indicators. |
| `/contractor` | **Contractor On-Site Panel** | Contractor | Package selector, live camera GPS capture, milestone claim submission, staged review tracking. |
| `/admin` | **Oversight Administration** | Admin / Sub-Admin | Audit queue, Fraud Risk Meter, Anomaly Breakdown popover, Maker-Checker actions, geofence calibration. |
| `/login` | **Authentication Gateway** | Public | Unified multi-role login and registration for Contractors and Sub-Admins. |

---

## 📡 Core REST API Reference

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate as Contractor, Sub-Admin, or Main Admin | Public |
| `POST` | `/api/auth/register` | Register new Contractor or Sub-Admin profile | Public |
| `GET` | `/api/health` | Healthcheck and active database connectivity status | Public |
| `GET` | `/api/databases/status` | Diagnostic inspection of all database tables and cloud status | Public |
| `GET` | `/api/projects` | List projects with status, cost, and physical progress | Public |
| `GET` | `/api/projects?map=true` | Map feed with deterministic GPS coordinates | Public |
| `GET` | `/api/projects/{id}` | Detailed project telemetry, SHAP drivers & risk score | Public |
| `GET` | `/api/states/{state_name}` | State detailed telemetry (supports `all` for Pan-India view) | Public |
| `GET` | `/api/contractors/{id}/projects` | Retrieve assigned packages and active geofences | Contractor |
| `POST` | `/api/contractor/submit-progress`| Submit on-site photo report with GPS coordinates | Contractor |
| `GET` | `/api/admin/audits` | View audit logs, fraud scores, and anomaly flags | Admin / Sub-Admin |
| `POST` | `/api/admin/audits/{id}/review` | Maker-Checker audit review (Approve / Reject / Recommend) | Admin / Sub-Admin |
| `POST` | `/api/admin/geofence` | Update center coordinates and radius for a project site | Main Admin |
| `POST` | `/api/admin/assign-contractor` | Assign an EPC contractor to a specific package | Main Admin |
| `POST` | `/api/predict` | Run hypothetical what-if scenario through ML models | Public |
| `GET` | `/api/llm/status` | Check if generative AI copilot is online | Public |
| `POST` | `/api/llm/explain` | Generate plain-English AI intervention briefs | Public |
| `GET` | `/api/llm/portfolio-summary` | Generate national portfolio executive summary via AI | Public |

---

## 🛠️ Technology Stack

| Layer | Technologies & Libraries |
|---|---|
| **Backend & API** | Python 3.10+, FastAPI, Uvicorn, Pydantic, SQLAlchemy, Psycopg2-binary |
| **Machine Learning** | XGBoost (`cop_model.json`, `top_model.json`), scikit-learn, SHAP TreeExplainer |
| **Anti-Fraud & Forensics**| ImageHash (`imagehash.phash`), Pillow, Piexif, Error-Level Analysis (ELA) |
| **Databases** | Supabase (PostgreSQL 17.6 with port 6543 pooler) / Local SQLite fallback |
| **Frontend Framework** | React 18, TypeScript 5.5, Vite 5 |
| **Styling & Theme** | Tailwind CSS, Lucide React, Universal Dark/Light GovTech Theme Engine |
| **Geospatial & Viz** | Leaflet, React-Leaflet 4, Recharts, Custom Ray-Casting WGS-84 Algorithms |
| **AI Copilot** | OpenRouter API (`google/gemini-2.5-flash` / deterministic fallback engine) |
| **Deployment** | Unified FastAPI Portal / Cloudflare Pages (Frontend) + Render (Backend) |

---

## 🏛️ Governance, MoSPI & PM GatiShakti Compliance

Nirman-AI is engineered in accordance with the public oversight frameworks of:
- **Ministry of Statistics and Programme Implementation (MoSPI)**: Standardized project baseline tracking, monthly expenditure ratio calculations, and physical-financial variance telemetry.
- **PM GatiShakti National Master Plan**: Integrated multi-modal connectivity coordination, spatial alignment verification, and geographical geofence demarcation.
- **Central Vigilance Commission (CVC) Guidelines**: Strict Maker-Checker dual control (4-Eyes Principle), mandatory non-repudiation audit trails for anomalous expenditures, and independent digital evidence verification.
