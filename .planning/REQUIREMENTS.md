# MTC Compliance Checker — REQUIREMENTS.md

## Milestone 1: Production Stability & Quality

### R1. Export Data-Mapping Integrity
- **Priority:** P0 (Critical)
- **Description:** The Quality Report export pipeline must map parameter-specific supplier evidence to each clarification/deviation action item. Raw extracted MTC document text must never appear in finding descriptions, supplier evidence fields, or action-item cards.
- **Acceptance Criteria:**
  - [ ] Every clarification item displays only: specific parameter, client requirement, relevant supplier evidence, actual finding/reason, required action
  - [ ] `sanitizeEvidence.ts` is fully integrated into server-side clarification point generation (`server.ts`) and PDF/Excel rendering (`exportUtils.ts`)
  - [ ] Previously-persisted feedback drafts with raw dumps are sanitized at render time
  - [ ] Generic fallback says "Relevant supplier evidence not identified" or "Manual review required" — never dumps full document
  - [ ] Existing deterministic compliance logic (PASS/FAIL/REVIEW decisions) is preserved

### R2. UI/UX Polish & Responsive Design
- **Priority:** P1 (High)
- **Description:** Improve dashboard responsiveness, mobile viewport support, and visual polish across all views.
- **Acceptance Criteria:**
  - [ ] Dashboard renders correctly on tablet (768px) and mobile (375px) viewports
  - [ ] Finding table is horizontally scrollable on narrow screens
  - [ ] Report modal is usable on mobile
  - [ ] Login page adapts to small screens
  - [ ] Consistent spacing, typography, and color usage across all components

### R3. AI Extraction Accuracy
- **Priority:** P1 (High)
- **Description:** Improve Gemini AI extraction reliability for diverse MTC formats and ensure deterministic fallback covers all critical fields.
- **Acceptance Criteria:**
  - [ ] AI extraction handles multi-heat MTCs with tabular chemistry/mechanical sections
  - [ ] Deterministic regex fallback covers at least 90% of critical fields for ASTM A182 F316, A105N, and A350 LF2 grades
  - [ ] AI extraction results are validated against deterministic extraction for field coverage
  - [ ] Malformed AI JSON responses fall back gracefully without data loss

### R4. Testing & Regression Safety
- **Priority:** P1 (High)
- **Description:** Maintain and expand automated test coverage to prevent regressions.
- **Acceptance Criteria:**
  - [ ] All 3 existing test suites pass (compliance phases, identity regression, export mapping)
  - [ ] New tests added for any new compliance rules or extraction changes
  - [ ] `npm run build` succeeds with zero type errors

## Non-Functional Requirements

### NF1. Evidence Integrity
- Raw `supplierRawValue` is never modified in the database or audit trail
- Formatting/sanitization happens only at the export/display boundary

### NF2. Security
- JWT auth enforced on all protected routes
- Role-based access control (Admin, Reviewer, Quality Engineer, Viewer)
- No cross-organization data leakage

### NF3. Performance
- Analysis execution completes within 15 seconds (including AI extraction)
- PDF/Excel export generates within 5 seconds for 27-requirement analyses
- Dashboard loads within 3 seconds with 100+ analyses
