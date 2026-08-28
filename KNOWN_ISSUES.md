# Known Architectural Issues — MTC Compliance Checker

> **Prepared from**: Full-Stack Audit (2026-08-28)
> **Status of code-level findings**: All fixable issues have been patched and pushed.
> The issues below require infrastructure or schema-level changes beyond code patches.

---

## CRITICAL — Data Integrity

### #5 · Last-Write-Wins Race Condition (DB Layer)

**Location**: `server/db.ts` — `scheduleSave()` / `persistToDisk()` / `persistToPostgres()`

**What happens**: The entire database is one in-memory JS object (`this.data`). When two concurrent requests both read `this.data`, mutate different sub-keys, and then write back, the second writer's snapshot overwrites the first writer's changes. No row-level locking exists.

**Impact**: Concurrent analyses run by two quality engineers simultaneously can corrupt each other's findings.

**Fix requires**: Migrate from single-blob JSONB to per-entity PostgreSQL rows with row-level locking (`SELECT ... FOR UPDATE`) and `BEGIN/COMMIT` transactions.

---

### #6 · No Transactional Boundaries on Multi-Step Writes

**Location**: `server/db.ts`, `server.ts` — analysis creation writes `setAnalysis`, `setFindings`, `setFeedbackDraft` as three separate in-memory mutations.

**What happens**: If the server crashes between `setAnalysis` and `setFindings`, the DB contains an analysis with zero findings — renders as a false PASS in the dashboard.

**Fix requires**: Wrap all multi-step writes in a PostgreSQL transaction. Requires per-entity row schema (see #5).

---

## HIGH — Data Architecture

### #14 · No Relational Schema — All Data in One JSONB Blob

All tenant data in one blob. No DB-level FK constraints, indexes, or query performance guarantees. Degrades linearly as data grows.

**Fix requires**: Full schema migration to normalised PostgreSQL tables: analyses, findings, documents, requirement_sets, users, sessions, audit_events — each indexed with foreign keys.

---

### #15 · Session Tokens in the Shared Blob

Session and password-reset tokens stored alongside compliance records. A DB backup also contains live session tokens.

**Fix requires**: Move sessions to a dedicated table or Redis/Upstash. Password-reset tokens need a time-limited table with `expires_at` index.

---

### #13 · Audit Log Capped at 10,000 Events

Once cap is reached, older events are silently discarded on every write — violates ISO 9001 record retention.

**Fix requires**: Move audit log to a dedicated append-only PostgreSQL table. Archive old records to cold storage (S3) rather than discard.

---

## MEDIUM — Security & Reliability

### #31 · Rate Limiter is In-Process Memory Only

On multi-process deployments (PM2 cluster, serverless), each process has its own rate-limit counter — trivially bypassed.

**Fix requires**: Replace in-process Map with Redis `INCR`/`EXPIRE` or Upstash rate-limiting middleware.

---

### #24 · Schema Evolution Entirely in Application Code

No migration history, no rollback, no way to verify which version production DB is on.

**Fix requires**: Introduce a migration framework (e.g. node-pg-migrate, drizzle-kit) with versioned migration files and a schema_migrations tracking table.

---

## Action Plan Summary

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Row-level DB schema (fixes #5, #6, #14) | ~2-3 weeks backend |
| P0 | Sessions in dedicated table (fixes #15) | ~2 days |
| P1 | Audit log to append-only table (fixes #13) | ~1 week |
| P1 | Distributed rate limiter via Redis (fixes #31) | ~1 day |
| P2 | Migration framework (fixes #24) | ~1 week |

> All code-fixable issues (CRITICAL #1-4, HIGH #7 #9 #11 #12 #16, MEDIUM #20 #21 #22 #26 #27 #30, LOW #32) have been patched and pushed to main.
