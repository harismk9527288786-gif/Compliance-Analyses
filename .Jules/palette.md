
## 2024-05-18 - Missing ARIA Labels on Search Inputs & Icon Buttons
**Learning:** Found that multiple search `<input>` fields across various list and data table components were only relying on placeholders to convey intent, which is an accessibility anti-pattern. Additionally, modal close buttons with `<X>` icons were missing `aria-label`s, rendering them functionally invisible to screen readers.
**Action:** Always ensure standalone `<input>` elements (e.g., search or filter fields without a visible `<label>`) have descriptive `aria-label` attributes. Likewise, any button containing solely an icon must receive an `aria-label` communicating its action.
