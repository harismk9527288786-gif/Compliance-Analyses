## 2026-10-15 - Accessibility of Close Buttons
**Learning:** Icon-only close buttons (like the lucide-react 'X' icon) across various modal dialogs lacked explicit accessible names (via aria-label on the button) and had redundant or visible icons that screen readers could misinterpret (lacked aria-hidden on the icon itself).
**Action:** Add aria-label='Close modal' to the outer button and aria-hidden='true' to the inner SVG component for all modal close controls to ensure proper screen reader announcement and avoid redundant noise.
