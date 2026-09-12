# MTC Compliance Checker — PROJECT.md

## Overview

**MTC Compliance Checker** (codename: **Zarique**) is a production AI-powered document analysis platform for the oil & gas / petrochemical quality assurance domain. It automates the verification of Material Test Certificates (MTCs) against client Material Data Sheets (MDS), performing deterministic requirement-by-requirement compliance evaluation with AI-augmented extraction.

## Domain

- **Industry:** Oil & Gas, Petrochemical, Industrial Quality Assurance
- **Primary Use Case:** Verify supplier-issued Material Test Certificates against client-specified MDS requirements (ASTM, ASME, NACE, MESC standards)
- **End Users:** Quality Control Engineers, Metallurgical Inspectors, Procurement teams
- **Organization:** Apex Valve & Flow Engineering Ltd.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (Vite), TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | SQLite (better-sqlite3), JSON file-backed |
| **AI** | Google Gemini 3.7 Flash (extraction + fallback) |
| **Export** | jsPDF (PDF reports), xlsx-js-style (Excel workbooks) |
| **Auth** | JWT + bcrypt, role-based (Admin, Reviewer, Quality Engineer, Viewer) |
| **Deployment** | Vercel (serverless), local dev server |
| **Build** | Vite (frontend), esbuild (server bundling) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│  LoginPage → Dashboard → AnalysisView → Reports │
│  NewComparison → FindingDetailDrawer → Exports   │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────┐
│              Backend (Express + TS)              │
│  server.ts → auth/ → db.ts → gemini.ts          │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │     Compliance Engine (src/engine/)      │    │
│  │  rules.ts → evaluateCompliance()         │    │
│  │  27 deterministic rules per MDS          │    │
│  │  Chemistry, Mechanical, HT, NDE, Certs   │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │   AI Extraction (server/gemini.ts)       │    │
│  │  Gemini API → Deterministic Fallback     │    │
│  │  Table-aware parsing, field canonicalization│  │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

## Key Components

### Frontend (17 components, ~400KB source)
- **LoginPage.tsx** — Authentication with animated UI
- **Dashboard.tsx** — Fleet overview, metrics, analysis list
- **AnalysisView.tsx** — Single analysis detail with finding table
- **FindingDetailDrawer.tsx** — Deep inspection of individual findings
- **ReportModal.tsx** — Quality report preview + supplier clarification letter
- **NewComparison.tsx** — MDS/MTC upload wizard
- **RequirementLibrary.tsx** — MDS requirement set browser
- **HistoryView.tsx** — Analysis history with filtering

### Backend (server.ts + server/)
- **server.ts** (49KB) — Express API routes, analysis execution pipeline
- **server/db.ts** (37KB) — SQLite + JSON data layer
- **server/gemini.ts** (67KB) — AI extraction + deterministic fallback
- **server/auth/** — JWT auth middleware, bcrypt, RBAC

### Compliance Engine (src/engine/)
- **rules.ts** (33KB) — 27 deterministic compliance rules
- **pilotData.ts** — Demo/pilot MTC data
- **testSuite.ts** — Automated compliance test suite

### Export Pipeline (src/utils/)
- **exportUtils.ts** (63KB) — PDF + Excel report generation
- **sanitizeEvidence.ts** — Evidence text sanitization (shared)

## Codebase Metrics

- **62 source files**, ~6MB total source
- **27 compliance rules** per MDS evaluation
- **32 automated compliance tests** (all passing)
- **24 identity regression tests** (all passing)
- **27 export mapping tests** (all passing)

## Current Status

**Production** — Actively deployed and used for real material certificate verification.

### Recent Work (Last 5 Commits)
1. `318ed3e` — Fix export mapping: parameter-specific supplier values in Quality Report
2. `76a17cf` — Table-aware MTC parsing and canonical field matching
3. `cdf5f99` — Refine HT soaking, NACE edition, EN 10204 classifications
4. `5a10888` — Independent multi-requirement evaluation, phase classification
5. `c49ad37` — Prevent identity short-circuit blocking full evaluation

### Known Issues
- Quality Report export "Supplier Technical Clarification" section can render raw MTC text in action items (fix in progress — `sanitizeEvidence.ts` created but not yet fully deployed)
- AI extraction accuracy varies by MTC format; deterministic regex fallback covers core cases

## Team

- **Solo developer** — haris (harismk927288786@gmail.com)
- **Git:** github.com/harismk9527288786-gif/Compliance-Analyses

## Decisions & Constraints

1. **Deterministic-first compliance:** All PASS/FAIL/REVIEW decisions are made by deterministic rules, never by AI. AI only assists with evidence extraction.
2. **Evidence integrity:** Raw `supplierRawValue` is never modified in the database. Formatting/sanitization happens only at the export/display boundary.
3. **Multi-tenant isolation:** All data is scoped by `organization_id`. No cross-org data leakage.
4. **Four-phase compliance status:** PASS, DEVIATION, REVIEW_REQUIRED, DOCUMENTATION_GAP — each with distinct UI treatment.
5. **No hardcoded test data in production paths:** Every extracted value must come from parsing actual document text.
