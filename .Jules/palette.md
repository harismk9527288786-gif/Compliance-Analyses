## 2026-10-10 - [Missing Accessible Names in Icon-only Close Buttons]
**Learning:** Close modal buttons using purely  icons were missing accessible names, leading to poor screen reader experience where they might only read out 'button'.
**Action:** Always add `aria-label="Close modal"` to icon-only close buttons if they lack `sr-only` text or a `title` attribute.
## 2026-10-10 - [Missing Accessible Names in Icon-only Close Buttons]
**Learning:** Close modal buttons using purely X icons were missing accessible names, leading to poor screen reader experience where they might only read out 'button'.
**Action:** Always add aria-label='Close modal' to icon-only close buttons if they lack sr-only text or a title attribute.
