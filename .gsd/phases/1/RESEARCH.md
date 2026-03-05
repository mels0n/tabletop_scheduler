---
phase: 1
level: 2
researched_at: 2026-03-05
---

# Phase 1 Post-Implementation Research

## Questions Investigated
1. Does adding `overflow-x-hidden` to the `body` tag in `globals.css` break any intentional horizontal scrolling within the application?
2. Are there any side-effects of setting `themeColor` to `#0f172a` (slate-900) across all devices and color schemes?

## Findings

### Horizontal Overflow
Adding `overflow-x-hidden` to the body solves the Android mobile scrolling bug (Issue #34/Feedback) where users could accidentally drag the screen horizontally. 

I searched the codebase for `overflow-x` to ensure no components rely on the body's horizontal overflow. The only occurrences were:
1. `app/features/page.tsx`: A table within evaluating features has `overflow-x-auto` on its direct container.
2. `app/developers/page.tsx`: Code snippet blocks have `overflow-x-auto` on their direct containers.

Because these components have `overflow-x-auto` applied to their *containers* rather than relying on page-level scrolling, they will still scroll horizontally within their dedicated areas. The global `overflow-x-hidden` on the `body` only prevents the whole viewport from shifting left/right when the content exceeds 100vw, which is the desired fix for the mobile UI bug.

**Side effects:** `overflow-x-hidden` on `body` or `html` can sometimes interfere with `position: sticky` elements in certain browsers. I empirically tested this using a headless Chromium browser instance. The `Navbar` (`sticky top-0 z-40`) remains correctly fixed to the top of the viewport when scrolling down the page. Furthermore, testing at mobile widths (320px-500px) confirmed there is no horizontal layout clipping or scrolling.

### Theme Color
The iOS Safari "white edge" bug happens because iOS Safari adopts the page's background color or defaults to white. Our site relies on a dark gradient (`bg-slate-900` to `black`).
Setting the `themeColor` to `#0f172a` (which corresponds to `slate-900`) matches the starting color of our gradient.

**Side effects:** Hardcoding both light and dark modes to `#0f172a` forces the safari browser chrome to be dark regardless of the user's OS settings. Because Tabletop Scheduler does not currently feature a light theme (the `body` has hardcoded dark `text-slate-50` and `from-slate-900` gradient colors), forcing the dark theme color is the correct and necessary approach to maintain visual cohesion.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Viewport `themeColor` | Proceed | Safe; enforcing the dark theme color eliminates the harsh white iOS top/bottom system bars and matches the app's existing dark-only aesthetic. |
| `overflow-x-hidden` | Proceed | Safe; intentional horizontal scrolls (like tables and code blocks) have explicit `overflow-x-auto` containers and will function normally. Prevents the identified Android viewport drag issue. |

## Ready for Planning
- [x] Questions answered
- [x] Approach verified post-implementation
- [x] Dependencies identified (None)
