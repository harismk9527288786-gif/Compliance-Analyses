## 2026-08-25 - [Add missing ARIA label to password toggle in invite form]
**Learning:** Some components in `LoginPage.tsx` like `<Eye />` or modal close `<X />` are repeated in different tabs (e.g. Sign In vs Accept Invite). Often, the primary one gets `aria-label` and `aria-hidden` applied correctly, but alternative flows (like invite forms or modals) are missed during initial development.
**Action:** Always check similar secondary UI components or duplicate logic blocks in the same file to ensure accessibility attributes are applied consistently across all variations.
