## 2023-10-27 - [Close Modal Buttons ARIA]
**Learning:** Found a recurring pattern where icon-only `X` (close) buttons in modals and toasts lack accessible names (like `aria-label="Close modal"`). This affects keyboard/screen-reader users.
**Action:** Applied `aria-label="Close modal"` (and `"Dismiss toast"`) to these buttons in `LoginPage.tsx`, `AdminUsersModal.tsx`, and `FramerToast.tsx`. When building new modals, ensure all icon-only buttons include an accessible label.
