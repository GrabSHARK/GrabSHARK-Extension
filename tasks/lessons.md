# GrabSHARK Extension — Lessons Learned

*This file captures patterns and corrections to prevent repeating mistakes across sessions.*

---

## Session: 2026-03-27 (Initial Setup)

### Lesson 1: Always populate memory bank from real codebase data
- **Pattern:** Memory bank files must contain specific technical details (manager names, file counts, exact versions) — not generic descriptions.
- **Why:** Generic content provides no value for AI context loading. Real data enables informed decision-making.
- **Rule:** Before creating any memory bank file, run Explore agents to extract actual metrics from the codebase.

### Lesson 2: Extension uses React Query v4, NOT v5
- **Pattern:** The main GrabSHARK app uses `@tanstack/react-query@^5.51.15` but the extension uses `@tanstack/react-query@^4.32.6`.
- **Why:** Extension was forked earlier, and v4 → v5 migration hasn't been done. API differences exist between versions.
- **Rule:** When writing React Query code for the extension, use v4 API (`useQuery({ queryKey, queryFn })` style, NOT v5's simplified syntax). Check `package.json` version before assuming.

### Lesson 3: Content script changes require full build + extension reload
- **Pattern:** `npm run dev` only hot-reloads popup/options. Content script and embedded UI changes require `npm run build` + manual extension reload in browser.
- **Why:** Content scripts are bundled as IIFE/ES modules injected into web pages — Vite dev server can't hot-reload them.
- **Rule:** After modifying anything in `pages/ContentScript/`, always run full build and reload the extension. Don't waste time expecting hot reload.
