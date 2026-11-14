# 설치 안내

`@leeeo/charts`는 아직 공개 npm에 올리지 않았습니다(준비 상태는 [PUBLIC-NPM.md](PUBLIC-NPM.md)). leeeo 앱은 사설 레지스트리에서
`npm i @leeeo/charts`로 받고, 그 밖에는 아래 두 방법 중 하나로 씁니다.

## 1. 묶음 파일

```bash
# 이 저장소에서
npm ci && npm run build && npm pack          # leeeo-charts-0.1.0.tgz 생성
# 쓰는 앱에서
npm i ../charts/leeeo-charts-0.1.0.tgz
```

## 2. 빌드 도구 없는 정적 앱

`npm run build` 후 `dist/`의 `index.js`, `dom.js`, `render.js`, `validate.js`, `format.js`, `types.js`, `chart.css`를
앱 안(예: `src/vendor/leeeo-charts/`)으로 복사하고 `dom.js`를 모듈로 불러옵니다. 복사한 버전은 앱 쪽 기록에 남깁니다.

```html
<link rel="stylesheet" href="./src/vendor/leeeo-charts/chart.css">
<script type="module">
  import { mountChart } from './src/vendor/leeeo-charts/dom.js';
  mountChart(document.querySelector('#chart'), spec);
</script>
```

## 버전

`npm pack`과 게시 전에는 `prepublishOnly`(타입 검사·테스트·빌드)가 돕니다. 버전을 올리면 `CHANGELOG.md`를 먼저 갱신합니다.
