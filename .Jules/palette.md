## 2026-09-05 - Aria labels for Eye toggle
**Learning:** Some custom password input toggle buttons missed the `aria-label` attribute while others had it. This is a common accessibility issue where icon-only buttons aren't given screen reader accessible names. Also it is important to add `aria-hidden="true"` to decorative icons within these buttons.
**Action:** Always check newly created or existing icon-only buttons for `aria-label` and `aria-hidden` attributes to ensure they are fully accessible to screen reader users.
