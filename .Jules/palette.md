## 2024-03-24 - Accessibility Gaps in Search Inputs and Modals
**Learning:** This app's components frequently omit accessible names on standalone filter/search inputs and some generic modal close buttons. Without visible labels or `aria-label`s, screen reader users cannot discern the purpose of these interactive elements.
**Action:** Always add `aria-label="Search"` to standalone `<input>` elements acting as search bars and `aria-label="Close modal"` to standalone icon-only close `<button>`s.
