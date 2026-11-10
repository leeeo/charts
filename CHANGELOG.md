# Changelog

## 0.2.0
- New chart types (Phase A): waffle, segmented, funnel, gauge, bullet, slope, bump, stream, scatter, bubble, box, histogram, heatmap, calendar, treemap, sankey, pie.
- bar: `percent` (100% stacked, requires `stacked`) and diverging stacks (negative values stack below zero).
- Internals: shared kit (`src/kit.ts`, `src/check.ts`, `src/cartesian.ts`, `src/radial.ts`) and a chart-type plugin registry (`src/charts/`). Core output for existing specs is unchanged.
- Stylesheet now includes per-type rules (`src/charts/*.css` concatenated into `dist/chart.css`).
- License: MIT (was UNLICENSED). No code change.
- Install guide moved to `docs/INSTALL.md` (bundle file or `dist/` copy).
- Intro site (https://charts.leeeo.app): search indexing allowed, canonical link, `sitemap.xml`.

## 0.1.0
- Initial release: spec validation, SVG renderer (line, area, bar, donut, sparkline, small multiples), DOM mount, React adapter, CSS tokens.
