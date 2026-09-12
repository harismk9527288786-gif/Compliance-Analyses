# MTC Compliance Checker — ROADMAP.md

## Milestone 1: Production Stability & Quality

### Phase 1: Export Data-Mapping Fix (P0)
**Requirement:** R1  
**Status:** 🟡 In Progress  
**Description:** Complete the `sanitizeEvidence.ts` integration across the entire export pipeline. Fix the "Supplier Technical Clarification & Concession Action Items" section rendering raw MTC text dumps. Ensure all clarification points, deviation items, and action cards display only parameter-specific evidence.

**Scope:**
- Finish integrating `sanitizeEvidence.ts` into `server.ts` (both main and pilot paths)
- Integrate into `gemini.ts` (AI clarification drafting)
- Add render-time sanitization guard in PDF export for persisted drafts
- Update `ReportModal.tsx` frontend fallback path
- Add Excel clarification sheet sanitization
- Build and verify all test suites pass
- Commit and push

---

### Phase 2: UI/UX Responsive Polish (P1)
**Requirement:** R2  
**Status:** ⬜ Not Started  
**Description:** Systematic responsive design pass across all 17 components. Add mobile breakpoints, fix overflow issues, improve touch targets, and ensure visual consistency.

**Scope:**
- Dashboard responsive grid (tablet + mobile)
- Finding table horizontal scroll on narrow viewports
- ReportModal mobile layout
- LoginPage small-screen adaptation
- Navbar responsive collapse
- Typography and spacing audit

---

### Phase 3: AI Extraction Hardening (P1)
**Requirement:** R3  
**Status:** ⬜ Not Started  
**Description:** Improve AI extraction reliability and deterministic fallback coverage for diverse MTC formats.

**Scope:**
- Multi-heat tabular MTC handling
- Additional material grade support (A105N, A350 LF2)
- AI result validation against deterministic extraction
- Graceful fallback on malformed AI responses
- Extraction confidence scoring

---

### Phase 4: Test Suite Expansion (P1)
**Requirement:** R4  
**Status:** ⬜ Not Started  
**Description:** Expand automated test coverage with new regression tests and integration tests.

**Scope:**
- Export sanitization unit tests
- Multi-format MTC extraction tests
- Edge case compliance rule tests
- Build verification automation
