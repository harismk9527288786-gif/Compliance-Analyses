# MTC Compliance Checker — Full Check

**Date:** 2026-08-24 · **Branch:** `main` @ `f7abf11` (clean tree) · **Scope:** build, auth test suite, server boot, auth/RBAC/multi-tenant review, secrets scan

Every finding marked **Verified** below was reproduced against a running instance of your own `dist/server.cjs`, in an isolated copy with a throwaway data directory. Your repo and your `data/` file were not modified.

---

## Summary

| Check | Result |
|---|---|
| `tsc --noEmit` type check | **Pass**, zero errors |
| Production `vite build` | **Not verifiable here** (environment, not code — see Appendix) |
| Server boot + SPA serving | **Pass** — boots, serves `dist/index.html`, health OK |
| `test_auth_suite.ts` | **17 / 19 pass** — Tests 2 and 3 fail |
| Tenant isolation | **Holds** on documents, requirement sets, analyses, findings, audit |
| Secrets in git | **Clean** — `.env` never committed, `.env*` gitignored |

The multi-tenant data layer is genuinely solid — org scoping is applied consistently and the isolation tests pass. The problems are concentrated in the account lifecycle: registration, seeding, and password reset. Three of them are individually enough to hand an attacker a full admin account.

---

## Critical

### 1. Anyone on the internet can register themselves as ADMIN inside an existing tenant

`server/auth/routes.ts:100-101` takes `role` straight from the request body and honours it. `routes.ts:85-98` then places a user who supplies no `organizationName` into `orgs[0]` — the *first existing organization*, i.e. a real tenant.

**Verified.** An unauthenticated `POST /api/auth/register` with `{"role":"ADMIN"}` returned a session for `organization_id: org-apex-01` with `canManageUsers: true`, and `GET /api/auth/users` then returned that tenant's full staff roster with emails and roles. From there `PATCH /api/auth/users/:id/role` and `/status` are open, as are all of the tenant's analyses and audit logs.

**Fix:** never accept `role` from the registration body — force the lowest-privilege role and require an admin invitation to elevate. Registering without an `organizationName` should create a *new* organization, never join an existing one; joining an existing tenant should only be possible through `accept-invite`.

### 2. Demo accounts silently revert to `password123` on every restart

`server/db.ts:307-309` re-seeds a user whenever their stored hash does not begin with the hardcoded seed salt. Because a genuine password change produces a fresh random salt, the check fires and **replaces the entire user record** — password, role, `is_active` and name — with the compiled-in defaults. The default hash and its plaintext are in the source at `db.ts:62-65`.

**Verified.** Reset `admin@apexvalves.com` to a new password → new password worked (200), old rejected (401). After a restart with the same data directory: new password rejected (401), `password123` accepted (200), and the stored salt had reverted from `69eaaceab…` to the hardcoded `9ce9625d…`.

So five known accounts — including `admin@apexvalves.com` (ADMIN) — are permanently reachable with a password that is published in the repository, and any remediation an operator performs is undone by the next deploy.

**Fix:** seed a user only when `this.data.users[user.id]` is absent; delete the hash-prefix condition. Put all demo seeding behind the `SEED_DEMO_DATA` flag that already exists in `.env.example`, and don't ship a known-plaintext hash in source.

### 3. Password-reset tokens are handed to unauthenticated callers unless `NODE_ENV=production`

`routes.ts:377-379` returns the raw reset token in the `POST /api/auth/forgot-password` response whenever `isProduction` is false. `package.json`'s `start` script (`node dist/server.cjs`) does not set `NODE_ENV`, so this is the default on any host that doesn't inject it.

**Verified.** With `NODE_ENV` unset, the endpoint returned a usable 64-character token for an arbitrary email, which reset that account's password — full takeover of any account, unauthenticated. With `NODE_ENV=production` the token is correctly withheld and the cookie gains `Secure`. The mitigation works; the default does not apply it.

**Fix:** gate the token behind an explicit opt-in (`EXPOSE_DEV_RESET_TOKEN=true`) rather than the absence of a production flag, and set `NODE_ENV=production` in `start`. Note the same flag controls the cookie's `Secure` attribute, so the unsafe default also ships session cookies over plaintext HTTP.

---

## High

### 4. Login rate limiting is bypassable with a spoofed header

`server/auth/security.ts:87-92` derives the client IP by trusting `X-Forwarded-For` unconditionally, and Express has no `trust proxy` setting.

**Verified.** 25 wrong-password attempts with a rotating `X-Forwarded-For` produced **zero** 429s; the same 25 with a fixed header produced 10. Brute-force protection is effectively absent. This combines badly with finding 6 (enumeration) and a 6-character minimum password.

**Fix:** `app.set('trust proxy', 1)` and read `req.ip`; additionally key the limiter on the submitted email, and add per-account backoff.

### 5. An unknown or cross-tenant `requirementSetId` silently produces a report built from demo fixtures

`server.ts:416-418` falls back to `PILOT_MDS_REQUIREMENT_SET` when the requirement set can't be resolved, and `server.ts:440-442` falls back to `PILOT_SUPPLIER_MTC` for the certificate. Because `db.getRequirementSet` is org-scoped, a valid id belonging to *another* tenant also lands here.

**Verified.** `POST /api/analyses` with `requirementSetId: "reqset-TOTALLY-BOGUS-does-not-exist"` and my own title returned **HTTP 201** and a complete analysis attributed to `Western Forge & Flange Co.`, MTC `WW2606229-3`, 29 pass / 2 deviations — the bundled pilot data, presented under the caller's title with no warning.

This is the finding I'd escalate first after the auth issues. This tool exists to produce signed material-acceptance reports; a silent substitution of demo data for the real specification means a report can say APPROVED about a heat that was never actually checked.

**Fix:** return 404 when the referenced requirement set or document isn't found in the caller's organization. Confine pilot data to the explicit `/api/pilot-case` endpoint, and drop the `filename.includes('WW2606229-3')` special case at `server.ts:424`.

### 6. User enumeration reintroduced — this is what the two failing tests are telling you

`test_auth_suite.ts:116,126` assert that a wrong password and an unknown email both return the identical message `'Invalid email or password.'`, explicitly "prevents user enumeration". The current code returns `'No account found with this email address…'` (`routes.ts:197`) versus `'Incorrect password…'` (`routes.ts:229`), which confirms whether any given address holds an account.

This looks like a side effect of `00fafef` ("provide clear error messages"). Note the contrast with `/forgot-password`, which is carefully written to avoid exactly this leak.

**Fix:** restore the shared message for both branches — the tests already encode the intended behaviour. If the clearer wording is a deliberate UX decision, update the tests and accept the trade-off knowingly rather than leaving a red suite.

---

## Medium

**7. Approved analyses can be edited after sign-off.** `server.ts:621-676` doesn't check whether the analysis is already approved. **Verified:** patching a finding on an approved analysis returned 200 and flipped `status` back to `review_in_progress` while leaving `finalStatus: CONDITIONAL_APPROVAL`, `approvedByName: David Chen (ADMIN)` and the original `approvedAt` in place — the record now carries a sign-off attribution that no longer matches its contents. Either block edits post-approval or clear the approval fields and require re-signature.

**8. The audit trail is described as immutable but isn't.** `db.ts:858-862` keeps a mutable array capped at 5000 records **globally, not per tenant**, so one busy tenant silently evicts another's history. Worse, failed logins for unknown emails are written to a hardcoded `'org-apex-01'` (`routes.ts:186`), so an unauthenticated attacker can both flush every tenant's audit history and inject arbitrary email addresses into a real customer's log. Move to per-org retention, append-only storage, and don't attribute unknown-email failures to a real tenant.

**9. Session lifetime ignores its own configuration.** `db.ts:547` hardcodes a 7-day extension in `touchSession`, ignoring `SESSION_TTL_HOURS`. **Verified:** with `SESSION_TTL_HOURS=1` the cookie said `Max-Age=3600` but the server-side session lifetime was **168 hours** after a single request. There's also no absolute cap, so an active session never expires. Use the configured TTL and add a hard maximum age.

**10. Session IDs are stored in plaintext.** `db.ts:527-531` keys sessions by the raw token, while `hashToken` is correctly used for invitations and reset tokens. Anyone who reads the JSON file or the Postgres row can hijack every live session. Store `sha256(sessionId)` for consistency with the other two token types.

**11. `SESSION_SECRET` is configured but never used.** It appears in `.env` and `.env.example` but nowhere in the code, and `cookieParser()` (`server.ts:38`) is called without a secret, so cookies are unsigned. Either wire it up or remove the knob — a security setting that does nothing is worse than no setting.

**12. Upload validation gives false assurance.** `server/pdfService.ts:38-52` accepts a file if the mime type *or* the extension matches, so anything named `*.pdf` passes regardless of content. The "Basic security scanning" greps the first 4 KB for `<script>` and `javascript:` and reports `Malware/Script security violation` — trivially evaded and not malware scanning. Also `xlsx` is in `ALLOWED_MIMES` but absent from the extension list. Validate by sniffing magic bytes and rename the check honestly.

**13. Missing security headers.** Live responses carry only `nosniff`, `SAMEORIGIN` and the deprecated `X-XSS-Protection`, plus `X-Powered-By: Express`. No CSP, HSTS or Referrer-Policy. Add `helmet` with a CSP and disable `x-powered-by`.

**14. Postgres TLS verification is disabled in production.** `db.ts:191` sets `rejectUnauthorized: false` exactly when `NODE_ENV === 'production'`, which permits a man-in-the-middle on the database connection. Supply the provider's CA instead.

**15. Prompt-injection surface in requirement extraction.** `server/gemini.ts:62` interpolates up to 15 000 characters of untrusted document text into the prompt, and the extracted requirements *become* the pass/fail criteria. A supplier-supplied PDF containing instructions could shape the thresholds it is later judged against. Treat AI-extracted sets as `draft` requiring human approval before any analysis runs against them.

---

## Low / correctness

**16.** Unknown `/api/*` routes return the SPA HTML with **200** instead of a JSON 404, because `app.get('*')` at `server.ts:834` catches them (verified). Mount a JSON 404 for `/api` before the catch-all.

**17.** Persistence rewrites the **entire** store — including the full `rawText` of every upload — as one JSON blob / one JSONB row on a 100 ms debounce (`db.ts:229-241, 274-295`). No transactions or locking, so two instances last-write-wins and silently discard each other's data, and write cost grows with total corpus size. This is the main thing standing between the current design and a second dyno.

**18.** Retention doesn't match what the app claims. `enforce30DayRetention` (`db.ts:765`) purges only analyses, findings and feedback drafts; documents, certificates, audit logs, expired sessions, used reset tokens and invitations are never purged — yet `getRetentionPolicyInfo` (`db.ts:789-801`) tells users that "audit logs, and account files" are covered, and hardcodes 30 days while `register` sets `retentionMonths: 24` for new orgs.

**19.** Password whitespace is handled inconsistently: `register` and `login` trim (`routes.ts:54,181`) but `reset-password` and `accept-invite` do not (`routes.ts:421,548`). A password set with a leading or trailing space through either of those flows can never be used to log in. Length is also checked before trimming, so `"      a"` passes the 6-character minimum.

**20.** `POST /api/test-suite/run` (`server.ts:801`) has no role guard — a VIEWER gets 200 (verified).

**21.** `db.ts:923-924` exports `USERS` / `ORGANIZATIONS` snapshotted at module load, including every `password_hash`. Nothing imports them; they're permanently stale. Delete.

**22.** `getCertificate` / `setCertificate` (`db.ts:684-691`) take no `orgId` despite sitting under a "STRICTLY ORG SCOPED" header. Latent rather than exploitable — `getCertificate` currently has no callers — but worth closing before something starts reading certificates.

**23.** Worth confirming the model id `'gemini-3.7-flash'` (`gemini.ts:65`) actually exists. If the call fails, the code silently falls back to local parsing while analyses still record `aiModelUsed: 'gemini-3.7-flash'` as provenance — a wrong provenance claim on a QA record is its own problem.

**24.** `server.ts:7` statically imports `vite`, so the production server drags in the whole bundler chain at boot even when serving from `dist` (this is why it wouldn't start here). Move it to a dynamic `import()` inside the dev branch.

---

## What's working well

Tenant scoping is applied consistently and correctly across documents, requirement sets, analyses, findings, feedback drafts and audit logs, and the cross-tenant tests (10 and 11) pass — including direct-by-ID access. Password hashing is done properly: scrypt with a per-password random salt and `timingSafeEqual`, with the length-mismatch throw handled. `sanitizeUser` never leaks `password_hash` (asserted by test 4). Password reset and deactivation both invalidate existing sessions. Invitations and reset tokens are stored hashed, single-use, and expiry-checked at lookup. There's no `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere in the codebase. And `.env` has never been committed — `.gitignore` correctly uses `.env*` with a `!.env.example` exception.

---

## Suggested order of work

1. Findings 1, 2, 3 — each is a standalone path to an admin account. Do these before the next deploy.
2. Finding 5 — reports built from demo data undermine the product's core claim.
3. Finding 4, then 6 (which also turns the suite green).
4. Findings 7 and 8 — the compliance/traceability story.
5. Finding 17 before scaling past one instance.

---

## Appendix — why the build couldn't be verified here

`npm run build` fails in this Linux sandbox with `Cannot find module @rollup/rollup-linux-x64-gnu`. Your `node_modules` contains only Windows binaries (`@rollup/rollup-win32-x64-{gnu,msvc}`, `@esbuild/win32-x64`), because it was installed on Windows; the npm registry is blocked here, so the Linux equivalents can't be fetched. **This is an environment artifact, not a defect in your code** — `tsc --noEmit` passes cleanly, and the committed `dist/` bundle boots and serves correctly.

Two things to confirm on your side: run `npm run build` locally on Windows to be sure the Vite step is green, and make sure your deploy host runs its own `npm ci` rather than receiving a `node_modules` built on another platform.

To run the tests I transpiled `test_auth_suite.ts` with `tsc` (its imports of `./server/db` and `./server/auth/security` are unused) and stubbed the rollup native module so the prebuilt server could boot. The server code itself was executed unmodified.
