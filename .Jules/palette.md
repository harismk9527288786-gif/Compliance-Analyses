## 2026-09-11 - Add ARIA labels to standalone search inputs
**Learning:** Found multiple instances where standalone search inputs lacked an `aria-label`, relying only on `placeholder` text which is insufficient for accessibility.
**Action:** Always ensure standalone input fields (e.g., search bars) have a descriptive `aria-label` for screen readers.
