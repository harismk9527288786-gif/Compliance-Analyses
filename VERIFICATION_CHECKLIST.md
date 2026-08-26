# Browser verification checklist

Everything server-side is verified (28/29 automated checks, plus a 19-check React
render harness). What's left can only be confirmed in a real browser, because the
crash you saw came from cached client code.

**Why this matters:** your error screenshot said *"encountered an unexpected state"*
with a **"Clear Cache & Restart"** button. Neither string exists in `src/` or in
`dist/` any more. Your browser was running a bundle older than both. Steps 1–3
exist to evict it.

---

## Step 1 — Rebuild (the important one)

```
npm run build
```

The service-worker fix lives in `public/sw.js` but your last build predates it,
so `dist/sw.js` is still the broken v1. Until you rebuild, the old worker keeps
serving the old bundle no matter what else you change.

Confirm it worked:

```
findstr /C:"mtc-compliance-v2" dist\sw.js
```

Expect a match. If you still see `v1`, the build didn't run.

## Step 2 — Start

```
npm start
```

Expect this line in the console:

```
Serving prebuilt frontend from dist/ (production mode)
```

For development instead, `npm run dev` should now say
`Vite dev middleware active — serving live source with HMR`. Before the fix it
silently took the production path and ignored your source edits.

## Step 3 — Evict the old service worker (once)

In DevTools:

1. Application → Service Workers → **Unregister**
2. Application → Storage → **Clear site data**
3. Ctrl+Shift+R

**Shortcut:** just open the site in a fresh **Incognito window** — no worker, no
cache. If it works there and not in your normal window, the app is fine and
you're only fighting cached state.

---

## Pass / fail checks

| # | Action | Expected | Fail means |
|---|--------|----------|------------|
| 1 | Load the site | Login page, no error screen | Old bundle still cached — redo step 3 |
| 2 | DevTools → Console | No React error #31 | Copy the full message and send it |
| 3 | Log in `admin@apexvalves.com` / `password123` | Dashboard loads | Send the Console + Network failure |
| 4 | DevTools → Network, filter `/api/` | All 200; none returning HTML | Note which endpoint and its response |
| 5 | Dashboard, history, requirements, audit tabs | All render | Note which tab and the Console error |
| 6 | Change your password, restart the server, log in with the new one | New password works | The seed-reset bug is back |
| 7 | Application → Service Workers | Shows `mtc-compliance-v2` | Step 1 or 3 didn't take |

Check 6 is the "encryption system not saving user details" symptom you
originally reported.

---

## What was fixed

**`server.ts`**
- Dev/prod mode is chosen by entry point, not by whether `dist/` exists. Previously any past `npm run build` made `npm run dev` serve the stale bundle, so source edits never reached the browser.
- Unknown `/api/*` paths return JSON 404 instead of the SPA's HTML (which made `res.json()` throw `Unexpected token '<'` and surface as an unrelated UI crash).
- Added an `/api` error handler. A malformed JSON body previously fell through to Express's default handler, which replied to an API call with an **HTML stack-trace page** leaking absolute server paths.
- `vite` is imported lazily, so `npm start` no longer loads the bundler chain at boot.
- `startServer()` has a `.catch()` so startup failures print a clear message.

**`server/db.ts`**
- Seed loop no longer overwrites existing users. It used to re-seed any user whose password hash didn't match the demo hash, silently reverting real password changes (and name/role edits) to `password123` on every restart.

**`server/auth/routes.ts`**
- `POST /api/auth/register` no longer honours a client-supplied `role`. Anyone could POST `{"role":"ADMIN"}` and mint an administrator inside your existing tenant — confirmed live before the fix. Registering a brand-new organization makes you its ADMIN; joining an existing one gives the default role, and an admin can promote you via `/invite` or `PATCH /users/:id/role`.

**`src/utils/api.ts`**
- `formatErrorMessage({})` returns the caller's fallback instead of the literal `"[object Object]"`.

## Note

Another agent was editing `server.ts` and `public/sw.js` during this session —
the cache-header block and the rewritten service worker are its work, not mine.
All changes coexist and `tsc --noEmit` is clean, but two agents writing the same
files will eventually clobber each other. Run one at a time.
