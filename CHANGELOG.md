# Changelog

## 0.7.0
- Sankey readability. **Behaviour change:** nodes inside a column are reordered when that strictly reduces how much
  bands cover each other (`order: "auto"`, the new default). A layout that is already crossing-free renders in spec
  order, unchanged; `order: "input"` always keeps the spec order.
- Sankey labels move outside the bands: first column left of the bar, last column right of it (the plot is inset by
  the widest label, capped at 28% of the width), middle columns above or below the bar, beside it only when there is
  no room. Two lines: the name, then the value in bold tinted by the node's meaning (`.lc-node-val`, colour mixed
  with ink for contrast). Side labels are pushed apart vertically with a leader line (`.lc-sk-lead`); narrow middle
  columns wrap names onto up to three lines instead of cutting them to one letter.
- Sankey hover / keyboard focus: the hovered band stays and the rest fade; a hovered node keeps its own bands (bands
  carry `data-s` / `data-t`; node rules cover the first 40 nodes). Labels fade while a tooltip is open.
- Gallery income example rewritten as a standard income flow (revenue -> gross profit / cost of sales -> operating
  income / SG&A -> net income / tax), whole numbers.

## 0.6.0
- Palette v2. Series colours are blue-first and orange-second, then teal, rose, violet, green, ochre, slate
  (light `#3c4dba #dd5f1d #2b93a1 #943351 #4e2175 #275e08 #92865a #647587`, dark `#72aaf2 #feab73 #5cecf0 #df5e7a
  #9966ce #bcf7bc #fedb62 #8193b3`). Lightness is staggered so every pair stays apart under protan/deutan/tritan
  simulation (min OKLab distance x100: 5.6 light / 9.3 dark, was 2.3 / 2.8); contrast is at least 3.3:1 on light and
  3.5:1 on dark surfaces.
- **Behaviour change:** series 1 no longer reads the host `--accent`. Hosts set `--chart-1` .. `--chart-8` (or
  `--lc-s1` .. `--lc-s8`) to replace a colour.
- Semantic tones get real values: revenue = series 1 blue, profit = series 3 teal, cost = series 2 orange (still
  hatched), neutral = series 8 slate.
- Lighter large fills: sankey bands use `--lc-band-opacity` (0.22 light / 0.3 dark, was 0.32), areas use
  `--lc-area-opacity` (0.14 / 0.18, was 0.18). Tokens only; no style attributes.
- Up/down colours keep their 0.5 values (`--lc-up-base` / `--lc-down-base`), independent of the series palette.
- Stock indicator lines (ma / overlays) skip blue and rose so they never read as down/up; the first two stay
  orange then gold-ochre.
- Multiples quality subtitle (`lc-psub-q`) is ink and semibold instead of series 2, so it keeps 4.5:1 text contrast.

## 0.5.0
- Slim entry points: `@leeeo/charts/core` (`createCharts([...plugins])` -> `renderChart` / `validateSpec` / `mountChart`)
  with the core six types, plus one module per chart type at `@leeeo/charts/charts/<type>` (exports `plugin`). Output
  is byte-identical to the full entry for the same spec; unregistered types fail validation at `type`. Example:
  sankey + combo bundle 15.9 KB gzip vs 85.4 KB for the full set (esbuild 0.25 minify). `.`, `./dom`, `./react`
  and `./styles.css` are unchanged.
- sankey: optional `tone` on nodes and links (`revenue`, `profit`, `cost`, `neutral`) drawn with the semantic tokens
  `--lc-tone-revenue` / `-profit` / `-cost` / `-neutral` (for now aliases of series colours 3 / 6 / 7 / 8; hosts may set
  `--chart-revenue` / `--chart-profit` / `--chart-cost` / `--chart-neutral`). Cost marks are hatched and the legend
  names each tone, so the meaning does not rely on colour alone. `computed: true` adds `*` to the node label and a
  legend note (`computedNote`). `align: "justify"` puts end nodes in the last column; `relax: true` moves nodes
  towards their bands to reduce crossings while keeping the input order inside each column. No style attributes are
  added (tones are classes, the hatch is an SVG pattern). Specs without these fields render as before, except that
  node labels now have a surface-coloured outline for legibility over bands.
- Gallery: income-flow sankey example (made-up data). `site/shots.mjs` scrolls lazily drawn cards into view before
  the focus capture.

## 0.4.0
- Stock chart set: `price` (close line/area with a volume pane on the same x axis), `ohlc` (OHLC bars), `combo` (grouped bars + lines, optional right axis that requires both axis titles), `surprise` (actual vs estimate, missing estimate written "미확인"), `range52` (52-week range bar), `valuation` (PER/PBR band from EPS/BPS × multiples) and `marketmap` (market-cap treemap coloured by change in steps, ▲/▼ text and a ranged legend). 47 chart types in total.
- candlestick: `volume` pane, `overlays` (SMA / EMA / Bollinger computed from the closes), `convention`. Existing specs render the same marks; `ma` lines keep their first two colours (a third/fourth `ma` now uses gold/teal instead of blue/purple so no indicator uses the up/down hues).
- Up/down colours are theme tokens: `--lc-up` / `--lc-down` (host overrides `--chart-up` / `--chart-down`), Korean convention by default; `convention: "global"` or `data-chart-convention="global"` on an ancestor switches to up green / down red. Candle colours now read these tokens (same default values).
- No inline `style` attributes in the new types (CSP `style-src-attr` can stay strict unless a `color` override is used).
- Gallery: stock chart examples with made-up data, labelled as examples.

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
