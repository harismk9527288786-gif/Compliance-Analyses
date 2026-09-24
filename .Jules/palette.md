## 2024-10-24 - Search Input Accessibility
**Learning:** Found that search inputs using placeholder text and nearby `lucide-react` icons were lacking proper accessible names. While placeholder text exists, `aria-label` provides a reliable, semantic name for screen readers, enhancing the app's overall accessibility for search features.
**Action:** Always verify that standalone `<input>` elements (especially those for searching) have an explicit `aria-label` if a formal `<label>` is not present. Avoid removing auto-generated lock files when doing git commits.
