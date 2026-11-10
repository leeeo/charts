# Changelog

## 0.3.0
- New chart types (Phase B): lollipop, dumbbell, waterfall, pareto, marimekko, radar, parallel, ridgeline, beeswarm, candlestick, timeline, skyline, sunburst, tree, network, chord, map (Korea 17 provinces).
- 40 chart types in total; every reference type is covered.
- `map` boundary data: 통계청 SGIS via vuski/admdongkor (CC BY 4.0), simplified; the attribution line is printed under every map (see NOTICE.md).
- Value boxes (`kit.tip`) wrap long text (up to 3 lines) and never leave the viewBox (shipped in 0.2.0).

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
