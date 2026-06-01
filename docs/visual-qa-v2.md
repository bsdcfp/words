# V2 Visual QA

Date: 2026-05-31

## Reference

- `docs/design-outputs/page-architecture-v2-dark-full.png`
- `docs/design-outputs/page-architecture-v2-light-full.png`
- `docs/page-architecture-v2.md`
- `docs/focus-design-guide.md`

## Simulator

- WeChat DevTools: Stable v2.01.2510290
- Base library: 3.16.0
- Device: iPhone 12/13 Pro simulator
- Captured evidence: `tmp/visual-qa/v2-current-screen.png`

## Checked Pages

- Home, first-run state: dark shell, book/progress card, single primary action, bottom tab.
- Level select: sticky back button, disabled levels are quiet, high-school level is clearly actionable.
- Precheck: centered single word card, bottom action area below card, no fake system status bar.
- Word study: focus mode, centered word, phonetic text, meaning, progress dots, one primary action.
- Profile: dark settings surface, actionable rows and theme switch visible.

## Remaining Visual Debt

- The current implementation uses CSS-drawn book/ambient shapes instead of illustration assets from the mockup.
- Completion animation is styled as a celebration page, but not yet animated like the reference.
- The visual match is substantially closer than the previous patch version, but still not a pixel-perfect clone.
