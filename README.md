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
차트 종류 47가지, 예제 57개입니다. 모든 예제는 소개 사이트 갤러리에서 밝은·어두운 화면과 스펙 JSON으로 볼 수 있습니다.

| type | 설명 | 미리보기 |
|---|---|---|
| `line` | 선 차트 (결측은 끊김). 11/06 값이 없으면 0이 아니라 선이 끊깁니다. | ![선 차트 (결측은 끊김)](https://charts.leeeo.app/images/line.png) |
| `area` | 영역 차트 (누적). 누적 영역, 단위는 원. | ![영역 차트 (누적)](https://charts.leeeo.app/images/area.png) |
| `bar` | 막대 차트 (묶음). 데이터가 없는 칸은 막대가 없습니다. | ![막대 차트 (묶음)](https://charts.leeeo.app/images/bar-grouped.png) |
| `bar` | 막대 차트 (누적). | ![막대 차트 (누적)](https://charts.leeeo.app/images/bar-stacked.png) |
| `bar` | 가로 막대 (긴 한글 라벨). 긴 라벨은 영역을 계산해 잘리지 않습니다. | ![가로 막대 (긴 한글 라벨)](https://charts.leeeo.app/images/bar-horizontal.png) |
| `bar` | 막대 차트 (100% 누적). 칸마다 합을 100%로 맞추고, 값 상자에는 원래 값도 함께 나옵니다. | ![막대 차트 (100% 누적)](https://charts.leeeo.app/images/bar-percent.png) |
| `bar` | 막대 차트 (양방향). 음수는 0에서 아래로 쌓입니다. 만족도·증감 비교에 씁니다. | ![막대 차트 (양방향)](https://charts.leeeo.app/images/bar-diverging.png) |
| `donut` | 도넛 차트. 결측 슬라이스는 고리에서 빠지고 범례에 표시됩니다. | ![도넛 차트](https://charts.leeeo.app/images/donut.png) |
| `sparkline` | 스파크라인. 표는 스크린 리더에서만 읽힙니다. | ![스파크라인](https://charts.leeeo.app/images/sparkline.png) |
| `multiples` | 작은 다중 차트 (앱별, 데이터 품질 표시). 같은 축을 공유해 앱 규모를 비교할 수 있습니다. | ![작은 다중 차트 (앱별, 데이터 품질 표시)](https://charts.leeeo.app/images/multiples.png) |
| `waffle` | 와플 차트: 유입 경로 비율. 한 칸 = 1%. 집계가 빠진 경로는 칸 없이 "데이터 없음"으로 표시합니다. | ![와플 차트: 유입 경로 비율](https://charts.leeeo.app/images/waffle.png) |
| `waffle` | 와플 차트: 한 칸 = 100건. 칸 하나가 정해진 단위를 나타내면 행 수가 데이터에 맞게 늘어납니다. | ![와플 차트: 한 칸 = 100건](https://charts.leeeo.app/images/waffle-unit.png) |
| `segmented` | 구성 막대: 매출 구성. 하나의 100% 막대로 비율을 짧게 보여 줍니다. 결측 항목은 막대에서 빠집니다. | ![구성 막대: 매출 구성](https://charts.leeeo.app/images/segmented.png) |
| `funnel` | 퍼널 차트: 방문에서 결제까지. 단계 사이 숫자는 이전 단계 대비 전환율입니다. 결측 단계 앞뒤의 전환율은 계산하지 않습니다. | ![퍼널 차트: 방문에서 결제까지](https://charts.leeeo.app/images/funnel.png) |
| `gauge` | 게이지: 월 매출 목표 달성. 회색 구간은 기준선, 굵은 눈금은 목표입니다. | ![게이지: 월 매출 목표 달성](https://charts.leeeo.app/images/gauge.png) |
| `gauge` | 게이지: 7일 리텐션. 0~100% 범위에 목표선을 함께 표시합니다. | ![게이지: 7일 리텐션](https://charts.leeeo.app/images/gauge-retention.png) |
| `bullet` | 불릿 차트: 이번 달 KPI. 막대는 실제 값, 세로 눈금은 목표, 배경 음영은 부진/보통 구간입니다. 목표 대비 %로 맞춰 한 축에 놓았습니다. | ![불릿 차트: 이번 달 KPI](https://charts.leeeo.app/images/bullet.png) |
| `slope` | 기울기 차트 (분기별 앱 매출 비교). 두 시점 사이 앱별 매출 변화를 한눈에 비교합니다. 결측 항목은 선 없이 표시됩니다. | ![기울기 차트 (분기별 앱 매출 비교)](https://charts.leeeo.app/images/slope.png) |
| `bump` | 순위 변동 차트 (월간 설치 순위). 설치 수로 계산한 앱 순위의 월별 변화입니다. 집계가 없는 달은 선이 끊깁니다. | ![순위 변동 차트 (월간 설치 순위)](https://charts.leeeo.app/images/bump.png) |
| `stream` | 스트림 그래프 (유입 경로별 방문자). 주간 방문자를 유입 경로별로 쌓아 가운데 기준선 둘레로 흐르게 그립니다. | ![스트림 그래프 (유입 경로별 방문자)](https://charts.leeeo.app/images/stream.png) |
| `scatter` | 산점도 (세션 시간과 7일 리텐션). 사용자 코호트별 평균 세션 시간과 7일 리텐션의 관계를 앱별 색으로 구분합니다. | ![산점도 (세션 시간과 7일 리텐션)](https://charts.leeeo.app/images/scatter.png) |
| `bubble` | 버블 차트 (광고 채널 효율). 설치당 비용과 전환율을 축으로, 원 넓이를 매출에 비례시켜 채널을 비교합니다. | ![버블 차트 (광고 채널 효율)](https://charts.leeeo.app/images/bubble.png) |
| `box` | 앱별 세션 길이 분포. 지난주 표본 세션의 분포입니다. 수염은 1.5 IQR, 점은 이상값이며 웹은 집계 요약값만 있습니다. | ![앱별 세션 길이 분포](https://charts.leeeo.app/images/box.png) |
| `histogram` | 첫 구매까지 걸린 일수. 설치 후 첫 결제까지의 일수를 7일 단위로 묶었습니다. 기록이 없는 사용자는 결측으로 따로 셉니다. | ![첫 구매까지 걸린 일수](https://charts.leeeo.app/images/histogram.png) |
| `heatmap` | 설치 주차별 리텐션. 코호트(설치 주)별 N주차 재방문율입니다. 아직 지나지 않은 주차는 데이터 없음으로 표시합니다. | ![설치 주차별 리텐션](https://charts.leeeo.app/images/heatmap.png) |
| `calendar` | 일별 방문자 캘린더. 6월부터 10월까지 상상플레이 일별 방문자입니다. 로그 장애일과 추석 연휴(집계 없음)는 결측으로 표시합니다. | ![일별 방문자 캘린더](https://charts.leeeo.app/images/calendar.png) |
| `treemap` | 앱별 · 채널별 월 매출. 사각형 넓이가 매출에 비례합니다. 상상플레이 광고 매출은 아직 정산 전이라 결측으로 표시됩니다. | ![앱별 · 채널별 월 매출](https://charts.leeeo.app/images/treemap.png) |
| `sankey` | 방문에서 구독까지의 흐름. 띠의 두께가 사용자 수에 비례합니다. 검색 → 체험 경로는 집계 누락으로 결측입니다. | ![방문에서 구독까지의 흐름](https://charts.leeeo.app/images/sankey.png) |
| `sankey` | 매출에서 순이익까지 (의미 색). 예시 데이터입니다. tone으로 매출·이익·비용을 칠하고(비용은 빗금), computed 노드에 *를 붙입니다. align: justify와 relax로 띠가 교차하지 않게 놓습니다. | ![매출에서 순이익까지 (의미 색)](https://charts.leeeo.app/images/sankey-income.png) |
| `pie` | 파이 차트. 비율이 한눈에 보여야 할 때. 미집계 항목은 원에서 빠지고 범례에 남습니다. | ![파이 차트](https://charts.leeeo.app/images/pie.png) |
| `lollipop` | 롤리팝 차트 (앱별 주간 방문자). 방문자가 많은 순으로 정렬했습니다. 집계가 없는 앱은 0이 아닌 결측으로 표시됩니다. | ![롤리팝 차트 (앱별 주간 방문자)](https://charts.leeeo.app/images/lollipop.png) |
| `lollipop` | 롤리팝 차트 (월별 순설치 증감). 0선에서 위아래로 뻗는 막대로 증가와 감소를 함께 보여줍니다. | ![롤리팝 차트 (월별 순설치 증감)](https://charts.leeeo.app/images/lollipop-change.png) |
| `dumbbell` | 덤벨 차트 (앱별 7일 리텐션, 1분기 → 3분기). 두 시점의 값을 선으로 이어 변화 폭을 비교합니다. 변화가 큰 순으로 정렬했습니다. | ![덤벨 차트 (앱별 7일 리텐션, 1분기 → 3분기)](https://charts.leeeo.app/images/dumbbell.png) |
| `waterfall` | 폭포 차트 (10월 → 11월 매출 변화). 시작 매출에서 항목별 증감을 쌓아 최종 매출에 이릅니다. 집계되지 않은 항목은 결측으로 표시하고 합계에서 제외합니다. | ![폭포 차트 (10월 → 11월 매출 변화)](https://charts.leeeo.app/images/waterfall.png) |
| `pareto` | 파레토 차트 (고객 문의 유형). 문의가 많은 유형부터 정렬하고 누적 비율을 오른쪽 축에 표시합니다. 80% 기준선으로 우선 대응할 유형을 찾습니다. | ![파레토 차트 (고객 문의 유형)](https://charts.leeeo.app/images/pareto.png) |
| `marimekko` | 마리메코 차트 (앱별 · 유입 경로별 설치). 열 너비는 앱의 전체 설치 비중, 칸 높이는 앱 안에서 유입 경로 비중입니다. 집계가 없는 칸은 0이 아닌 결측입니다. | ![마리메코 차트 (앱별 · 유입 경로별 설치)](https://charts.leeeo.app/images/marimekko.png) |
| `radar` | 앱별 품질 점수 비교. 6개 품질 축을 0~100점 공통 척도로 비교합니다. 트레이딩의 접근성 점수는 아직 측정 전이라 빈 칸입니다. | ![앱별 품질 점수 비교](https://charts.leeeo.app/images/radar.png) |
| `parallel` | 앱별 핵심 지표 평행 좌표. 축마다 자체 범위를 가집니다. 웹의 설치 수는 해당 없음이라 선이 끊깁니다. | ![앱별 핵심 지표 평행 좌표](https://charts.leeeo.app/images/parallel.png) |
| `ridgeline` | 요일별 세션 길이 분포. 표본 세션의 커널 밀도입니다. 주말로 갈수록 긴 세션이 늘어납니다. 일요일 일부는 수집 누락입니다. | ![요일별 세션 길이 분포](https://charts.leeeo.app/images/ridgeline.png) |
| `beeswarm` | API 응답 시간과 SLO. 점 하나가 요청 표본 하나입니다. 점선은 SLO 300ms이며 넘은 표본은 진하게 표시됩니다. | ![API 응답 시간과 SLO](https://charts.leeeo.app/images/beeswarm.png) |
| `candlestick` | 모의투자 종목 일봉. 상승은 빨강, 하락은 파랑입니다. 11-12는 휴장으로 빈 칸이며 이동평균은 그날을 건너뜁니다. | ![모의투자 종목 일봉](https://charts.leeeo.app/images/candlestick.png) |
| `price` | 주가 차트 (거래량 · 볼린저 밴드). 가상의 예시 데이터입니다. 위는 종가, 아래는 같은 날짜 축의 거래량입니다. 추석 연휴 이틀은 빈 칸이고, 20일 이동평균과 볼린저 밴드는 스펙의 종가로 계산합니다. | ![주가 차트 (거래량 · 볼린저 밴드)](https://charts.leeeo.app/images/price.png) |
| `candlestick` | 캔들 차트 (거래량 · 이동평균). 가상의 예시 데이터입니다. 상승은 빨강, 하락은 파랑이고 거래량 막대도 같은 색을 따릅니다. 5일·20일 이동평균은 빈 날을 건너뜁니다. | ![캔들 차트 (거래량 · 이동평균)](https://charts.leeeo.app/images/candlestick-volume.png) |
| `ohlc` | OHLC 막대 (지수이동평균). 가상의 예시 데이터입니다. 왼쪽 눈금이 시가, 오른쪽 눈금이 종가라 색 없이도 오르고 내린 날을 구분할 수 있습니다. | ![OHLC 막대 (지수이동평균)](https://charts.leeeo.app/images/ohlc.png) |
| `combo` | 분기 매출액 · 영업이익 · 영업이익률. 가상의 예시 데이터입니다. 막대는 왼쪽 축(억원), 점선은 오른쪽 축(%)이며 두 축 모두 제목이 있어야 그려집니다. 영업손실 분기는 0 아래로 그립니다. | ![분기 매출액 · 영업이익 · 영업이익률](https://charts.leeeo.app/images/combo.png) |
| `surprise` | 실적 서프라이즈 (실적 vs 예상치). 가상의 예시 데이터입니다. 막대는 실적, 가로 눈금은 예상치입니다. 예상치가 없는 분기는 0으로 두지 않고 ‘미확인’으로 적고, 아직 발표하지 않은 분기는 막대가 없습니다. | ![실적 서프라이즈 (실적 vs 예상치)](https://charts.leeeo.app/images/surprise.png) |
| `range52` | 52주 범위. 가상의 예시 데이터입니다. 종목마다 자기 52주 최저~최고를 한 줄로 놓고, 현재 값의 위치를 글자(범위의 몇 %)로도 적습니다. | ![52주 범위](https://charts.leeeo.app/images/range52.png) |
| `valuation` | PER 밴드. 가상의 예시 데이터입니다. 각 밴드 선은 그 달의 EPS × 배수로 계산합니다. EPS가 0 이하인 달은 배수가 뜻이 없어 밴드를 그리지 않습니다. | ![PER 밴드](https://charts.leeeo.app/images/valuation.png) |
| `marketmap` | 시가총액 맵 (등락률 색). 가상의 예시 데이터입니다. 넓이는 시가총액, 색은 등락률 구간입니다. 칸 안에 ▲/▼와 부호 있는 숫자를 함께 적고, 범례에 구간 범위를 글자로 적어 색만으로 읽지 않게 했습니다. | ![시가총액 맵 (등락률 색)](https://charts.leeeo.app/images/marketmap.png) |
| `marketmap` | 시가총액 맵 (해외 표기: 상승 초록). 같은 데이터를 convention: "global"로 그렸습니다. 상승은 초록, 하락은 빨강이고 ▲/▼ 표시는 그대로입니다. 페이지 전체는 data-chart-convention="global"로 바꿀 수 있습니다. | ![시가총액 맵 (해외 표기: 상승 초록)](https://charts.leeeo.app/images/marketmap-global.png) |
| `timeline` | 4분기 앱 출시 일정. 같은 레인에서 겹치는 작업은 아래 줄로 쌓입니다. 상상플레이 정식 출시일은 아직 미정이라 결측입니다. | ![4분기 앱 출시 일정](https://charts.leeeo.app/images/timeline.png) |
| `skyline` | 1년 일별 방문자. 하루 한 칸씩 이어 붙인 실루엣입니다. 8월 로그 수집 장애 사흘은 0이 아니라 결측(음영)으로 표시됩니다. | ![1년 일별 방문자](https://charts.leeeo.app/images/skyline.png) |
| `sunburst` | 설치 경로 구성. 안쪽 고리가 앱, 바깥으로 갈수록 플랫폼·유입 채널입니다. 상상플레이 iOS 검색 유입은 집계 전이라 결측입니다. | ![설치 경로 구성](https://charts.leeeo.app/images/sunburst.png) |
| `tree` | 월간 활성 사용자 분해. 전체 활성 사용자를 앱과 플랫폼으로 나눈 계층입니다. 상상플레이 iOS는 아직 집계 전이라 결측입니다. | ![월간 활성 사용자 분해](https://charts.leeeo.app/images/tree.png) |
| `network` | 앱 간 사용자 이동. 한 달 동안 두 앱을 함께 쓴 사용자 수입니다. 선 두께가 공유 사용자 수, 점 크기가 연결 합계입니다. 집계가 끝나지 않은 연결은 점선입니다. | ![앱 간 사용자 이동](https://charts.leeeo.app/images/network.png) |
| `chord` | 유입 경로 사이의 이동. 첫 방문 채널에서 두 번째 방문 채널로 옮겨 간 방문자 수입니다. 리본은 출발 채널 색이고 도착 쪽 끝이 뾰족합니다. 추적이 빠진 구간은 데이터 없음입니다. | ![유입 경로 사이의 이동](https://charts.leeeo.app/images/chord.png) |
| `map` | 시도별 신규 설치. 10월 시도별 신규 설치 수입니다. 위치 권한을 거부해 집계하지 못한 시도는 빗금(데이터 없음)으로 표시합니다. | ![시도별 신규 설치](https://charts.leeeo.app/images/map.png) |
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

### 필요한 종류만 묶기 (`./core` + `./charts/<type>`, 0.5.0)

```js
import { createCharts } from '@leeeo/charts/core';
import { plugin as sankey } from '@leeeo/charts/charts/sankey';
import { plugin as combo } from '@leeeo/charts/charts/combo';

const { mountChart, renderChart } = createCharts([sankey, combo]);
```

`core`에는 기본 6종(line·area·bar·sparkline·donut·multiples)만 들어 있고, 나머지는 넘겨 준 종류만 묶입니다.
같은 스펙이면 기본 진입점과 같은 문자열을 내고, 등록하지 않은 종류는 없는 종류처럼 `ChartSpecError`(`type`)로 막힙니다.
예: sankey+combo만 묶으면 esbuild minify 기준 gzip 약 16 KB(전체 약 85 KB)입니다. 기존 `.`·`./dom`·`./react`는 그대로 전체 종류를 씁니다.

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

주식 차트(0.4.0). 지표는 모두 스펙에 넣은 값으로만 계산하고, 빈 날(`null`)은 건너뛰며 선을 끊습니다.

| type | 추가 필드 |
|---|---|
| `candlestick` · `ohlc` | `dates`, `ohlc: ({ open, high, low, close } \| null)[]`, `ma?: number[]`, `overlays?`, `volume?: (number\|null)[]`(가격 아래 거래량 판, 같은 x축), `convention?`, `yLabel?` |
| `price` | `dates`, `close: (number\|null)[]`, `volume?`, `style?`(`line`/`area`), `overlays?`, `convention?`, `yLabel?` |
| `combo` | `labels`, `bars: series[]`(1~4), `lines?: (series & { axis?: 'left'\|'right' })[]`(최대 3), `unit2?`(오른쪽 축 형식), `yLabel?`, `y2Label?`, `xLabel?`. 오른쪽 축 선이 있으면 `yLabel`·`y2Label` 둘 다 필수 |
| `surprise` | `labels`, `actual`, `estimate`(각각 `(number\|null)[]`), `actualName?`, `estimateName?`, `convention?`, `yLabel?`. 예상치가 `null`이면 ‘미확인’ |
| `range52` | `items: { id, label, low, high, current (low~high 또는 null), quality? }[]`, `period?`(기본 ‘52주’) |
| `valuation` | `dates`, `price`, `base`(EPS 또는 BPS, 0 이하·null이면 그날 밴드 없음), `multiples`(오름차순 2~6개), `metric?`(`PER`/`PBR`), `yLabel?` |
| `marketmap` | `items`: `{ id, label, value(시가총액), change(%, null 가능), quality? }` 또는 `{ id, label, children }`, `steps?: [a, b]`(기본 [1, 3]), `convention?` |

`overlays`: `{ kind: 'sma' | 'ema' | 'bollinger', window (2~250 정수), k? (볼린저 폭, 기본 2) }[]`, 최대 4개.
`convention`: `kr`(기본, 상승 빨강·하락 파랑) 또는 `global`(상승 초록·하락 빨강). 등락은 ▲/▼·부호 있는 숫자·모양(OHLC 눈금)으로도 읽힙니다.

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

스타일은 CSS 사용자 속성을 씁니다. 앱에 `--ink`, `--muted`, `--surface`, `--line`, `--font`가 있으면
그 값을 읽고(leeeo 공통 테마 이름), 없으면 내장 값을 씁니다. 어두운 화면은 `html[data-theme="dark"]`(`@leeeo/theme`가
설정)를 따르고, `data-theme`이 없으면 `prefers-color-scheme: dark`를 따릅니다.

### 색 (팔레트 v2, 0.6.0)

시리즈 색은 파랑을 먼저, 주황을 두 번째로 씁니다. 두 계열 차트는 늘 파랑·주황 짝이 되고, 이 짝은 적록·청황 색각 이상에서도
잘 갈립니다. 8색은 색각 이상 시뮬레이션(1·2·3형)에서 서로 멀도록 명도를 나눴고, 밝은 면에서 3.3:1, 어두운 면에서 3.5:1 이상입니다.

| 순서 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 이름 | 파랑 | 주황 | 청록 | 장미 | 보라 | 녹색 | 황토 | 회청 |
| 밝게 | `#3c4dba` | `#dd5f1d` | `#2b93a1` | `#943351` | `#4e2175` | `#275e08` | `#92865a` | `#647587` |
| 어둡게 | `#72aaf2` | `#feab73` | `#5cecf0` | `#df5e7a` | `#9966ce` | `#bcf7bc` | `#fedb62` | `#8193b3` |

- 앱에서 바꾸려면 `--chart-1` … `--chart-8`을 정합니다(`--lc-s1` … `--lc-s8`을 직접 정해도 됩니다). 0.5까지는 1번 색이
  앱의 `--accent`를 따랐지만 0.6부터는 따르지 않습니다. 앱 강조색이 차트 1번 색이 되면 앱마다 같은 차트가 다르게 보이기 때문입니다.
- 의미 색(sankey `tone`): 매출 `--lc-tone-revenue` = 1번 파랑, 이익 `-profit` = 3번 청록, 비용 `-cost` = 2번 주황(늘 빗금),
  중립 `-neutral` = 8번 회청. 앱은 `--chart-revenue`·`--chart-profit`·`--chart-cost`·`--chart-neutral`로 바꿀 수 있습니다.
- 넓은 반투명 면은 옅게 칠합니다. sankey 띠 `--lc-band-opacity`(밝게 0.22, 어둡게 0.3), 영역 `--lc-area-opacity`(0.14, 0.18).
- 주식 지표선(이동평균·볼린저)은 1번 파랑·4번 장미를 건너뛰어 상승·하락 색으로 읽히지 않게 합니다.

주식 차트의 상승·하락 색은 `--lc-up`·`--lc-down`입니다. 기본은 한국식(상승 빨강, 하락 파랑)이고, 앱에서
`--chart-up`·`--chart-down`을 정하면 그 값을 씁니다. 페이지 전체를 해외식(상승 초록, 하락 빨강)으로 바꾸려면 조상 요소에
`data-chart-convention="global"`을, 차트 하나만 바꾸려면 스펙에 `convention: "global"`을 넣습니다. 스타일 속성(`style="…"`)은
`color` 같은 색 지정 필드를 쓸 때만 나오므로, 주식 차트를 기본값으로 쓰면 CSP에 `style-src-attr 'unsafe-inline'`이 필요 없습니다.

## 버전과 변경 기록

- 현재 버전: 0.6.0. 변경 내용은 [CHANGELOG.md](CHANGELOG.md)에 적습니다.
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
