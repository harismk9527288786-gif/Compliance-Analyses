## 2026-09-01 - Missing ARIA Labels on Icon-only Buttons
**Learning:** Found multiple icon-only buttons lacking `aria-label`s, breaking accessibility for screen reader users. Specifically, the "Close" buttons in modals (like the Forgot Password and Standards Spec modals) and the "Show/Hide Password" button for the Invite form are missing labels, despite other similar buttons having them.
**Action:** Always verify icon-only buttons include `aria-label` attributes.
