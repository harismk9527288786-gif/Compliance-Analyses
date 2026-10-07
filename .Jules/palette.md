## 2026-10-07 - Accessibility Labeling for Search Inputs
**Learning:** Standalone inputs without explicit `<label>` tags need an `aria-label` attribute to be accessible to screen readers, especially when accompanying icons are marked `aria-hidden="true"`.
**Action:** Add `aria-label="Search"` (or more specific labels like `"Search clauses"`) to all search `<input>` fields across the application.
