# @leeeo/charts

A framework-agnostic chart library. You pass a typed JSON spec; it is validated at the boundary and rendered to a
deterministic, accessible SVG string, in Node or in the browser. Zero runtime dependencies, an optional React adapter,
MIT licensed.

- Live gallery with every chart in light and dark, its spec JSON (with a copy button) and a playground:
  **https://charts.leeeo.app**
- Full guide in Korean: [README.ko.md](README.ko.md) · Changes: [CHANGELOG.md](CHANGELOG.md)

![Line chart, light](https://charts.leeeo.app/images/line.png)

## Why

- **Same output everywhere.** The same spec gives the same SVG string in Node (build step, server rendering) and in the
  browser, so a chart can be rendered at build time and still work without JavaScript.
- **No dependencies.** The core has no runtime dependencies. React is an optional peer, used only by `./react`.
- **Validated at the boundary.** A wrong spec throws a `ChartSpecError` that names the path, for example
  `series[0].values[2]: must be a finite number or null`. Unknown properties are rejected.
- **Accessible by default.** Title and generated summary, a real data table, keyboard focus on data points with the same
  tooltip as the mouse, and text next to every colour.
- **Missing is not zero.** `null` breaks a line, leaves out a bar or slice and is listed as "no data"; a real `0` is drawn.

## Install

```bash
npm install @leeeo/charts
```

Node 20 or newer for build-time rendering. The browser build is plain ES modules.

## Quick start

### Browser (`./dom`)

```js
import { mountChart } from '@leeeo/charts/dom';
import '@leeeo/charts/styles.css';

const chart = mountChart(document.querySelector('#visits'), {
  type: 'line',
  title: 'Daily visitors',
  lang: 'en',
  unit: { suffix: ' visits' },
  labels: ['Nov 3', 'Nov 4', 'Nov 5'],
  series: [{ id: 'web', name: 'Web', values: [320, null, 310] }], // null = missing, drawn as a gap
});

chart.update(nextSpec);
chart.destroy();
```

The chart fits the element's width and redraws when the width changes.

### Only the types you use (`./core` + `./charts/<type>`)

```js
import { createCharts } from '@leeeo/charts/core';
import { plugin as sankey } from '@leeeo/charts/charts/sankey';
import { plugin as combo } from '@leeeo/charts/charts/combo';

const { mountChart, renderChart } = createCharts([sankey, combo]);
```

`core` holds the six base types (line, area, bar, sparkline, donut, multiples); other types are bundled only when you
pass them. Output is identical to the full entry point.

### React and Next.js (`./react`)

```jsx
import { Chart } from '@leeeo/charts/react';
import '@leeeo/charts/styles.css';

export function Visits({ spec }) {
  return <Chart spec={spec} width={480} />;
}
```

Server rendering works; the markup is the same as `renderChart`.

### Node or build step (default entry)

```js
import { renderChart } from '@leeeo/charts';

const html = renderChart(spec);                 // same spec, same string
const wide = renderChart(spec, { width: 720 }); // viewBox width
```

## Chart types

47 types. Every one is in the [gallery](https://charts.leeeo.app) with its spec.

| Group | Types |
|---|---|
| Basic | `line` `area` `bar` (grouped, stacked, horizontal, 100%, diverging) `donut` `pie` `sparkline` `multiples` |
| Part of a whole | `waffle` `segmented` `treemap` `sunburst` `marimekko` `funnel` |
| Comparison | `bullet` `gauge` `slope` `bump` `lollipop` `dumbbell` `waterfall` `pareto` `radar` `parallel` |
| Distribution | `histogram` `box` `ridgeline` `beeswarm` `scatter` `bubble` `heatmap` |
| Time | `stream` `calendar` `timeline` `skyline` |
| Flow and network | `sankey` `chord` `network` `tree` `map` |
| Finance | `candlestick` `ohlc` `price` `combo` `surprise` `range52` `valuation` `marketmap` |

## Spec, in short

Every chart takes `type`, `title` (required), `description`, `unit` (`{ label?, prefix?, suffix?, decimals? }`),
`width`/`height`, `legend`, `lang` (`ko` default, or `en`), `table` (`details` | `hidden` | `none`) and `id`.
Series are `{ id, name, values: (number | null)[], color?, quality? }`, one value per label. The field list for every
type is in [README.ko.md](README.ko.md#스펙) and each gallery card shows a working spec.

Colours accept only `#hex`, `var(--token)` or a colour name, and all text is escaped. The only inline style the output
uses is a series colour variable (`style="--c:..."`), so a strict CSP needs `style-src-attr 'unsafe-inline'` and nothing
else: no `<style>` blocks, no inline scripts.

## Theming

Styles are CSS custom properties. If the page defines `--ink`, `--muted`, `--surface`, `--line` or `--font`, they are
used. Dark mode follows `html[data-theme="dark"]`, otherwise `prefers-color-scheme`. Series colours are `--chart-1` …
`--chart-8` (blue first, orange second, checked against colour-vision simulations). Finance up/down colours default to
the Korean convention (up red, down blue); set `convention: "global"` on a spec or `data-chart-convention="global"` on an
ancestor for up green, down red. Arrows and signed numbers carry the direction too.

## Versioning

0.x: fields may be added to specs; changed behaviour is written in [CHANGELOG.md](CHANGELOG.md) first.

## 한국어

leeeo 앱에서 함께 쓰려고 만든 차트 모듈입니다. JSON 스펙을 넣으면 같은 SVG 문자열이 나옵니다. 빠진 값은 0이 아니라
끊김으로 그리고, 제목·요약·데이터 표·키보드 이동이 기본으로 들어갑니다. 차트 47종을
[소개 사이트](https://charts.leeeo.app)에서 밝은·어두운 화면과 스펙(복사 버튼 포함)으로 볼 수 있습니다.
자세한 설명은 [README.ko.md](README.ko.md)에 있습니다.

## License

MIT. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
