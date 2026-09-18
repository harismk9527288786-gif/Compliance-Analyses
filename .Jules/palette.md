## 2023-10-25 - Redundant aria-labels
**Learning:** Adding `aria-label` to buttons that already have `<span className="sr-only">` text is redundant and clutters screen reader output without providing additional value.
**Action:** Always check if an element already has a visually hidden but accessible name (like `sr-only` text or `title`) before adding `aria-label`. Focus `aria-label` additions on truly icon-only buttons that have no screen-reader text whatsoever.
