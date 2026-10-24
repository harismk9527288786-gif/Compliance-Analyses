## 2025-05-18 - Missing ARIA Labels on Standalone Search Inputs
**Learning:** This app extensively uses standalone search inputs containing only visual cues (an icon and a placeholder) and lacks explicit `<label>` elements, leaving screen reader users without proper context for the input field.
**Action:** When implementing or modifying search, filter, or similar standalone inputs that rely primarily on icons and placeholder text for context, always ensure an `aria-label` is applied to the `<input>` directly.
