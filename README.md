# @leeeo/charts

> **English summary.** A framework-agnostic chart core for leeeo apps. A typed JSON spec is validated at the boundary and
> rendered to a deterministic, accessible SVG string in Node or the browser, with zero runtime dependencies. Entries:
> `renderChart` (core), `mountChart` (`./dom`) and `<Chart>` (`./react`, optional peer). Chart types: line, area,
> bar (grouped / stacked / horizontal), donut, sparkline and small multiples. MIT licensed. Not on npm yet; see
> [docs/INSTALL.md](docs/INSTALL.md) to install. Live gallery: https://charts.leeeo.app

leeeo 앱에서 함께 쓰는 차트 모듈입니다. JSON 스펙을 받아 SVG 문자열을 돌려줍니다.

## 왜 만들었나

leeeo 앱은 만든 방식이 제각각입니다. Next.js·React 앱이 있고, 빌드 도구 없는 정적 HTML 앱이 있고, 서버에서 HTML을
만드는 관리 화면도 있습니다. 앱마다 차트를 따로 만들면 결측값 처리, 단위 표기, 스크린 리더 지원이 앱마다 달라집니다.

이 모듈은 그 차이를 한 곳에서 정리합니다.

- **어디서나 같은 결과.** 같은 스펙이면 Node(빌드·서버 렌더링)와 브라우저에서 같은 SVG 문자열이 나옵니다.
- **의존성 없음.** 런타임 의존성이 없습니다. React 어댑터는 따로 불러올 때만 씁니다.
- **경계에서 검증.** 잘못된 스펙은 위치를 알려 주는 `ChartSpecError`로 막습니다. 예: `series[0].values[2]: must be a finite number or null`.
- **접근성 기본 포함.** 제목·요약, 데이터 표, 키보드 이동이 따로 설정하지 않아도 들어갑니다.

## 차트 종류

<!-- types:start -->
차트 종류 7가지, 예제 11개입니다. 모든 예제는 소개 사이트 갤러리에서 밝은·어두운 화면과 스펙 JSON으로 볼 수 있습니다.

| type | 설명 | 미리보기 |
|---|---|---|
| `line` | 선 차트 (결측은 끊김). 11/06 값이 없으면 0이 아니라 선이 끊깁니다. | ![선 차트 (결측은 끊김)](https://charts.leeeo.app/images/line.png) |
| `area` | 영역 차트 (누적). 누적 영역, 단위는 원. | ![영역 차트 (누적)](https://charts.leeeo.app/images/area.png) |
| `bar` | 막대 차트 (묶음). 데이터가 없는 칸은 막대가 없습니다. | ![막대 차트 (묶음)](https://charts.leeeo.app/images/bar-grouped.png) |
| `bar` | 막대 차트 (누적).  | ![막대 차트 (누적)](https://charts.leeeo.app/images/bar-stacked.png) |
| `bar` | 가로 막대 (긴 한글 라벨). 긴 라벨은 영역을 계산해 잘리지 않습니다. | ![가로 막대 (긴 한글 라벨)](https://charts.leeeo.app/images/bar-horizontal.png) |
| `bar` | 막대 차트 (100% 누적). 칸마다 합을 100%로 맞추고, 값 상자에는 원래 값도 함께 나옵니다. | ![막대 차트 (100% 누적)](https://charts.leeeo.app/images/bar-percent.png) |
| `bar` | 막대 차트 (양방향). 음수는 0에서 아래로 쌓입니다. 만족도·증감 비교에 씁니다. | ![막대 차트 (양방향)](https://charts.leeeo.app/images/bar-diverging.png) |
| `donut` | 도넛 차트. 결측 슬라이스는 고리에서 빠지고 범례에 표시됩니다. | ![도넛 차트](https://charts.leeeo.app/images/donut.png) |
| `sparkline` | 스파크라인. 표는 스크린 리더에서만 읽힙니다. | ![스파크라인](https://charts.leeeo.app/images/sparkline.png) |
| `multiples` | 작은 다중 차트 (앱별, 데이터 품질 표시). 같은 축을 공유해 앱 규모를 비교할 수 있습니다. | ![작은 다중 차트 (앱별, 데이터 품질 표시)](https://charts.leeeo.app/images/multiples.png) |
| `pie` | 파이 차트. 비율이 한눈에 보여야 할 때. 미집계 항목은 원에서 빠지고 범례에 남습니다. | ![파이 차트](https://charts.leeeo.app/images/pie.png) |
<!-- types:end -->

어두운 화면에서도 같은 스펙으로 그려집니다.

![어두운 화면의 선 차트](https://charts.leeeo.app/images/line-dark.png)

미리보기 이미지는 소개 사이트를 캡처해서 만듭니다(`npm run site && npm run site:shots -- <폴더>`).

## 설치

아직 공개 npm에는 없습니다. 묶음 파일이나 `dist/` 복사로 설치합니다. 방법은 [docs/INSTALL.md](docs/INSTALL.md)를 보세요.

## 빠른 시작

### HTML · 정적 페이지 (`./dom`)

```js
import { mountChart } from '@leeeo/charts/dom';
import '@leeeo/charts/styles.css';   // 또는 <link rel="stylesheet" href=".../chart.css">

const chart = mountChart(document.querySelector('#visits'), {
  type: 'line',
  title: '일간 방문자',
  unit: { label: '명', suffix: '명' },
  labels: ['11/03', '11/04', '11/05'],
  series: [{ id: 'web', name: '웹', values: [320, null, 310] }],   // null = 빠진 값, 끊김으로 표시
});

chart.update(nextSpec);   // 스펙 교체
chart.destroy();          // 정리
```

요소 너비에 맞춰 그리고, 너비가 바뀌면 다시 그립니다. 빌드 도구가 없는 앱은 `dist/` 파일을 앱 안에 복사해 씁니다.

### React · Next.js (`./react`)

```jsx
import { Chart } from '@leeeo/charts/react';
import '@leeeo/charts/styles.css';

export function Visits({ spec }) {
  return <Chart spec={spec} width={480} />;
}
```

서버 렌더링이 되고, 결과 마크업은 `renderChart`와 같습니다. `react`는 선택 peer dependency입니다.

### Node · 빌드 단계 (기본 진입점)

```js
import { renderChart } from '@leeeo/charts';

const html = renderChart(spec);                  // HTML 문자열, 같은 스펙이면 같은 문자열
const wide = renderChart(spec, { width: 720 });  // viewBox 너비 지정
```

빌드 단계에서 만든 문자열을 페이지에 그대로 넣으면 스크립트 없이도 차트가 보입니다.

## 스펙

모든 차트 공통:

| 필드 | 설명 |
|---|---|
| `type` | `line` · `area` · `bar` · `sparkline` · `donut` · `multiples` |
| `title` | 필수. 차트 제목이자 SVG `<title>` |
| `description` | 설명. 제목 아래와 SVG `<desc>`에 들어갑니다 |
| `unit` | `{ label?, prefix?, suffix?, decimals? }`. `label`은 제목 옆에, 나머지는 모든 값·눈금·값 상자·표 칸 형식에 씁니다. `decimals`를 생략하면 데이터에서 추정합니다(최대 2) |
| `width`, `height` | viewBox 크기 |
| `legend` | 범례 표시 여부 |
| `lang` | `ko`(기본) 또는 `en`. 내장 문구 언어 |
| `table` | `details`(기본, 접힌 표) · `hidden`(스크린 리더 전용) · `none` |
| `id` | DOM id 접두사. 생략하면 스펙에서 만듭니다. 한 페이지에 같은 스펙을 두 번 그리면 직접 지정하세요 |

`series[]`: `{ id, name, values: (number|null)[], color?, quality? }`. 라벨마다 값이 정확히 하나 있어야 합니다.
`quality`는 데이터 품질 메모("추정치", "집계 지연")로, 범례·값 상자·표에 함께 나옵니다.

| type | 추가 필드 |
|---|---|
| `line` | `labels`, `xLabel?`, `yMin?`, `yMax?`, `series` |
| `area` | line과 같음 + `stacked?` (누적이면 값은 0 이상) |
| `bar` | line과 같음 + `stacked?`, `horizontal?` |
| `sparkline` | `labels`, `series`(정확히 하나). 기본 160×36, 축 없음 |
| `donut` | `slices: { id, label, value (0 이상 또는 null), color?, quality? }[]`, `centerLabel?` |
| `multiples` | `panelType`(`line`/`area`/`bar`), `labels`, `panels: { id, title, subtitle?, quality?, series }[]`, `columns?`, `sharedY?`(기본 true), `yMin?`, `yMax?` |

알 수 없는 속성은 거부합니다. 글자는 이스케이프하고, 색은 `#hex`, `var(--토큰)`, 색 이름만 받습니다.

### 동작 약속

- **빠진 값은 끊김.** `null`은 선과 영역을 끊고, 막대와 도넛 조각을 만들지 않으며, 0으로 그리지 않습니다. 표에는 "데이터 없음"으로 적습니다. 실제 `0`은 그립니다(막대는 1px 표시를 남깁니다). 값이 모두 없으면 빈 상태를 보여 줍니다.
- **한글 라벨.** 글자 폭을 CJK 1em으로 계산해 여백을 늘리고, 너무 긴 라벨은 말줄임표로 줄입니다(전체 글자는 값 상자와 표에 남습니다). x축 라벨은 겹치지 않게 솎아 내고, 값 상자는 viewBox 안에 머뭅니다. 범례는 HTML이라 줄바꿈됩니다.
- **결정적 출력.** 같은 스펙이면 같은 문자열입니다(`id`가 없으면 스펙에서 해시를 만듭니다).

## 접근성

- **제목과 요약.** `<svg>`는 `role="img"`이고 `<title>`·`<desc>`가 붙습니다. 설명은 자동으로 만들며 시리즈별 최솟값·최댓값·마지막 값, 빠진 값 개수, 품질 메모를 담습니다.
- **데이터 표.** 같은 수치를 담은 진짜 `<table>`이 함께 나옵니다. 기본은 `<details>` 안에 접혀 있고, `table: "hidden"`이면 화면에서 숨기고 스크린 리더에만 읽힙니다.
- **키보드.** 데이터 점마다 `tabindex="0"`과 `aria-label`(예: `1월, 방문: 1,200명 · 추정치`)이 있고, 초점이 가면 마우스를 올렸을 때와 같은 값 상자가 나옵니다. 점이 120개를 넘으면 점별 초점을 생략하고 표로 읽도록 합니다.
- **색과 글자.** 시리즈 이름은 범례·값 상자·표에 글자로 함께 나오므로 색만으로 구분하지 않습니다. 단, 시리즈별 선 무늬·채움 무늬는 0.1에 **아직 없습니다**. 색을 구분하기 어려운 사용자를 위한 다음 버전 후보입니다.
- **움직임.** 그려지는 애니메이션은 `prefers-reduced-motion: no-preference`일 때만 나옵니다.

## 테마

스타일은 CSS 사용자 속성을 씁니다. 앱에 `--ink`, `--muted`, `--surface`, `--line`, `--accent`, `--font`가 있으면
그 값을 읽고(leeeo 공통 테마 이름), 없으면 내장 값을 씁니다. 어두운 화면은 `html[data-theme="dark"]`(`@leeeo/theme`가
설정)를 따르고, `data-theme`이 없으면 `prefers-color-scheme: dark`를 따릅니다. 시리즈 색은 `--lc-s1` … `--lc-s8`로 바꿀 수 있습니다.

## 버전과 변경 기록

- 현재 버전: 0.1.0. 변경 내용은 [CHANGELOG.md](CHANGELOG.md)에 적습니다.
- 0.x 동안에는 스펙에 필드를 더할 수 있고, 바뀌는 동작은 CHANGELOG에 먼저 적습니다.
- 참고한 자료와 고지는 [NOTICE.md](NOTICE.md)에 있습니다.

## 소개 사이트

`site/`는 이 모듈로 직접 그린 소개·갤러리 페이지입니다. 모든 차트를 밝은 화면·어두운 화면에서 스펙과 함께 보여 주고,
스펙을 고쳐 다시 그려 보는 작은 실습 칸이 있습니다. 분석 도구를 쓰지 않습니다. 공개 주소는 https://charts.leeeo.app 입니다.

```bash
npm run site                       # site/dist 생성 (패키지 빌드가 없으면 먼저 빌드)
npm run site:shots -- <폴더>        # 390·1440 × 밝게·어둡게 캡처 + docs/images 갱신
```

`site/dist`는 정적 파일이라 아무 정적 서버로 열 수 있습니다.

## 개발

```bash
npm ci
npm run typecheck && npm test && npm run build
npm run examples                   # examples/index.html (+ specs.json.js) 재생성
npm run preview -- <폴더>           # 예제 화면을 390·1440 × 밝게·어둡게로 캡처
```

`examples/index.html`은 `../dist/dom.js`를 불러오므로 파일을 직접 열지 말고 저장소 루트를 정적 서버로 여세요.

## 0.1에 없는 것

CLI·MCP 서버, 산점도·히트맵 등 다른 차트, 시리즈별 선·채움 무늬, 주석, 확대·구간 선택, canvas 출력.

## 라이선스

MIT. [LICENSE](LICENSE)를 보세요. 참고 자료 고지는 [NOTICE.md](NOTICE.md)에 있습니다.
