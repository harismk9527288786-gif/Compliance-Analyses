## 2026-09-13 - Added missing accessibility tags to close buttons
**Learning:** Found instances where close buttons using an `X` icon were lacking `aria-label` on the button and `aria-hidden="true"` on the SVG icon, particularly in `AdminUsersModal` and `FramerToast`. This pattern might be present in other custom components with icon-only buttons.
**Action:** Always ensure any icon-only button, such as modal close controls, has an `aria-label` for context and its decorative child elements (like icons) use `aria-hidden="true"` to avoid confusing screen readers.
