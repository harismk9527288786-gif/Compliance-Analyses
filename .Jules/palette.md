
## 2025-03-09 - Missing ARIA Labels on Search Inputs
**Learning:** Found multiple instances where standalone search inputs with an `aria-hidden` search icon lacked an `aria-label`, rendering them completely unlabelled and inaccessible to screen readers.
**Action:** When implementing standalone search bars with hidden icons, always explicitly add an `aria-label` attribute (e.g. `aria-label="Search records"`) to ensure screen reader users can identify the input field's purpose.
