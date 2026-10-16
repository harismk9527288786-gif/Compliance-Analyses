## 2024-03-01 - Icon Button Accessibility
**Learning:** Icon-only buttons (like close modals using the 'X' Lucide icon) across various components were missing aria-labels, making them inaccessible to screen readers. The 'X' icon also lacked aria-hidden='true', causing redundant or confusing announcements.
**Action:** Always add explicit aria-labels (e.g., 'Close modal', 'Dismiss toast') to icon-only buttons, and apply aria-hidden='true' to decorative SVGs/icons within them to ensure a clean accessibility tree.
