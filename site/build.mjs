// Builds the intro + gallery site into site/dist with the library itself.
// usage: node site/build.mjs   (runs the package build first when dist/ is missing)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderChart } from '../src/index.ts';
import { examples } from '../examples/specs.ts';
import { pluginList } from '../src/charts/index.ts';
import { specJson } from './assets/copy.js';

export { specJson };

const site = dirname(fileURLToPath(import.meta.url));
const root = join(site, '..');
const out = join(site, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (!existsSync(join(root, 'dist', 'dom.js'))) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const typeName = { line: '선', area: '영역', bar: '막대', donut: '도넛', sparkline: '스파크라인', multiples: '작은 다중',
  ...Object.fromEntries(pluginList.map((p) => [p.type, p.names.ko.replace(/ ?(차트|그래프)$/, '')])) };
const types = [...new Set(examples.map((e) => e.spec.type))];

// Gallery cards carry only the heading and, for no-script visitors, the pre-rendered preview image of the same spec
// (docs/images, made by site/shots.mjs). assets/site.js builds the light/dark panes and the spec JSON block from
// assets/specs.js and draws each chart as its card nears the viewport. Inlining every chart twice made the page 1.7 MB.
const pngSize = (file) => { const b = readFileSync(file); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
const preview = (e) => {
  const file = join(root, 'docs', 'images', `${e.id}.png`);
  if (!existsSync(file)) return '';
  const { width, height } = pngSize(file);
  return `<noscript><img class="preview" src="images/${e.id}.png" width="${width}" height="${height}" alt="${esc(e.heading)} 미리보기 이미지" loading="lazy"></noscript>`;
};

const card = (e) => `<article class="card${e.wide || e.spec.type === 'multiples' ? ' wide' : ''}" id="g-${e.id}" aria-labelledby="g-${e.id}-h" data-card="${e.id}">
      <div class="card-head"><h3 id="g-${e.id}-h">${esc(e.heading)}</h3>${e.note ? `<p>${esc(e.note)}</p>` : ''}</div>${preview(e)}
    </article>`;

const hero = examples.find((e) => e.id === 'line');
const play = examples[0];

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://charts.leeeo.app/">
<meta name="theme-color" content="#f7f7f2">
<meta name="description" content="JSON 스펙 하나로 같은 SVG 차트를 그리는 leeeo 앱 공통 차트 모듈. 결측은 끊김으로, 수치는 표로도 읽힙니다.">
<title>공통 차트 — leeeo 앱용 차트 모듈</title>
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<script src="vendor/theme.js"></script>
<link rel="stylesheet" href="vendor/chrome.css">
<link rel="stylesheet" href="lib/chart.css">
<link rel="stylesheet" href="assets/site.css">
<script type="module" src="vendor/chrome.js"></script>
<script type="module" src="assets/site.js"></script>
</head>
<body>
  <a class="skip" href="#main">본문으로 건너뛰기</a>
  <header class="site-header leeeo-chrome leeeo-header" data-leeeo-header>
    <a class="leeeo-app-brand" href="./" aria-label="공통 차트 처음으로"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 4v16.5H20"/><path d="M7 15.5l4-4.5 3 2.5 5-6"/></svg><span>공통 차트</span></a>
    <nav class="site-nav" aria-label="주요 메뉴"><a href="#gallery">갤러리</a><a href="#play">직접 해보기</a><a href="#start">시작하기</a><a href="#a11y">접근성</a><a href="#usage">사용처</a></nav>
    <label class="leeeo-theme"><span class="leeeo-theme-label">테마</span><select data-leeeo-theme disabled><option value="system">시스템</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label>
  </header>
  <main id="main" class="page">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-text">
        <p class="eyebrow">@leeeo/charts ${esc(pkg.version)}</p>
        <h1 id="hero-title">JSON 스펙 하나로<br>어느 앱에서나 같은 차트</h1>
        <p class="lead">leeeo 앱은 React로 만든 것도, 그냥 HTML로 만든 것도 있어요. 이 모듈은 같은 스펙을 받으면 어디서든 같은 SVG를 돌려줘요. 빠진 값은 0이 아니라 끊김으로 그리고, 모든 수치를 표로도 보여 줘요.</p>
        <dl class="facts">
          <div><dt>차트 종류</dt><dd>${types.length}가지</dd></div>
          <div><dt>런타임 의존성</dt><dd>없음</dd></div>
          <div><dt>출력</dt><dd>SVG 문자열</dd></div>
        </dl>
        <p class="actions"><a class="button primary" href="#gallery">갤러리 보기</a><a class="button" href="#play">스펙 직접 고쳐 보기</a></p>
      </div>
      <figure class="hero-chart panel">
        <div class="host" data-example="${hero.id}" data-theme-pane="page">${renderChart({ ...hero.spec, id: 'lc-hero' }, { width: 520 })}</div>
      </figure>
    </section>

    <section class="section" id="gallery" aria-labelledby="gallery-title">
      <div class="section-head"><h2 id="gallery-title">갤러리</h2><noscript><p>JavaScript가 꺼져 있어 미리보기 이미지만 보여요. 차트와 스펙 JSON은 JavaScript를 켜면 보이고, 스펙은 저장소의 examples/specs.ts에도 있어요.</p></noscript><p>${types.map((t) => typeName[t]).join(' · ')} 차트를 밝은 화면과 어두운 화면에서 함께 보여 줘요. 모두 이 페이지에서 지금 그린 차트예요. 점이나 막대에 마우스를 올리거나 Tab 키로 이동하면 값이 나오고, 그 시리즈만 남고 나머지는 옅어져요. 값은 선 끝과 막대 옆에도 적혀 있어요.</p></div>
      <div class="gallery">
    ${examples.map(card).join('\n    ')}
      </div>
    </section>

    <section class="section" id="play" aria-labelledby="play-title">
      <div class="section-head"><h2 id="play-title">직접 해보기</h2><p>스펙을 고치면 잠시 뒤 다시 그려요. 잘못된 값은 어느 위치가 왜 틀렸는지 알려 주고, 마지막으로 그린 차트는 그대로 둬요. 입력은 이 브라우저 안에서만 쓰고 어디로도 보내지 않아요.</p></div>
      <div class="play panel">
        <div class="play-edit">
          <div class="play-tools">
            <label class="field"><span>예제 불러오기</span><select id="play-example">${examples.map((e) => `<option value="${e.id}"${e === play ? ' selected' : ''}>${esc(e.heading)}</option>`).join('')}</select></label>
            <button type="button" class="button" id="play-render">다시 그리기</button>
          </div>
          <label class="field" for="play-input"><span>스펙 JSON</span></label>
          <textarea id="play-input" spellcheck="false" autocomplete="off" autocapitalize="off" rows="18" aria-describedby="play-status">${esc(specJson(play.spec))}</textarea>
          <p id="play-status" class="play-status" role="status" aria-live="polite">예제 스펙을 그렸어요.</p>
        </div>
        <div class="play-out"><div class="host" id="play-host">${renderChart({ ...play.spec, id: 'lc-play' }, { width: 520 })}</div></div>
      </div>
    </section>

    <section class="section" id="start" aria-labelledby="start-title">
      <div class="section-head"><h2 id="start-title">시작하기</h2><p>아직 공개 npm에는 없어요. 설치 방법은 저장소의 <code>docs/INSTALL.md</code>에 있어요.</p></div>
      <div class="cols">
        <div class="panel code-card"><h3>HTML · 정적 페이지</h3><p>요소 너비에 맞춰 그리고, 너비가 바뀌면 다시 그려요.</p><pre tabindex="0" aria-label="HTML 사용 예"><code>${esc(`import { mountChart } from '@leeeo/charts/dom';
import '@leeeo/charts/styles.css';

const chart = mountChart(document.querySelector('#visits'), {
  type: 'line',
  title: '일간 방문자',
  unit: { suffix: '명' },
  labels: ['11/03', '11/04', '11/05'],
  series: [{ id: 'web', name: '웹', values: [320, null, 310] }],
});
// chart.update(nextSpec); chart.destroy();`)}</code></pre></div>
        <div class="panel code-card"><h3>React · Next.js</h3><p>서버 렌더링도 돼요. 결과 마크업은 HTML 방식과 같아요.</p><pre tabindex="0" aria-label="React 사용 예"><code>${esc(`import { Chart } from '@leeeo/charts/react';
import '@leeeo/charts/styles.css';

export function Visits({ spec }) {
  return <Chart spec={spec} width={480} />;
}`)}</code></pre></div>
        <div class="panel code-card"><h3>빌드 단계 · Node</h3><p>문자열을 받아 페이지에 그대로 넣으면 돼요. 스크립트 없이도 보여요.</p><pre tabindex="0" aria-label="Node 사용 예"><code>${esc(`import { renderChart } from '@leeeo/charts';

const html = renderChart(spec);          // 같은 스펙이면 같은 문자열
const wide = renderChart(spec, { width: 720 });`)}</code></pre></div>
      </div>
    </section>

    <section class="section" id="a11y" aria-labelledby="a11y-title">
      <div class="section-head"><h2 id="a11y-title">접근성</h2><p>차트를 볼 수 없는 사람도 같은 내용을 얻을 수 있게 만들었어요.</p></div>
      <ul class="notes">
        <li><h3>제목과 요약</h3><p>SVG에 <code>role="img"</code>와 제목·설명이 붙어요. 설명에는 시리즈별 최솟값·최댓값·마지막 값, 빠진 값 개수, 데이터 품질 메모가 자동으로 들어가요.</p></li>
        <li><h3>데이터 표</h3><p>모든 차트 아래에 같은 수치를 담은 표가 있어요. 기본은 접힌 상태로 보이고, 화면에서 숨기고 스크린 리더에만 읽히게 할 수도 있어요.</p></li>
        <li><h3>키보드</h3><p>점·막대·조각마다 Tab으로 이동할 수 있고, 이동하면 마우스를 올렸을 때와 같은 값 상자와 강조가 나와요. 점이 120개를 넘으면 표로 읽도록 바꿔요.</p></li>
        <li><h3>색에만 기대지 않기</h3><p>시리즈 이름은 범례·값 상자·표에 글자로 함께 나와요. 다만 시리즈마다 다른 선 무늬나 채움 무늬는 0.1에 아직 없어요. 다음 버전 후보로 남겨 뒀어요.</p></li>
        <li><h3>빠진 값</h3><p>값이 없으면 0으로 그리지 않고 선을 끊어요. 표에는 ‘데이터 없음’으로 적어요.</p></li>
        <li><h3>움직임</h3><p>그려지는 애니메이션은 기기에서 ‘동작 줄이기’를 켜지 않았을 때만 나와요.</p></li>
      </ul>
    </section>

    <section class="section" id="usage" aria-labelledby="usage-title">
      <div class="section-head"><h2 id="usage-title">leeeo 앱에서 쓰는 곳</h2></div>
      <div class="panel usage">
        <p>2026년 11월 11일 기준으로 아래 leeeo 화면에서 이 모듈을 써요.</p>
        <ul class="usage-list">
          <li><h3>leeeo 운영 관리 화면</h3><p>관리자 통계 화면의 막대·작은 다중 차트(코어만 복사해 사용, 2026년 11월 11일부터). 로그인한 운영자만 볼 수 있어요.</p></li>
          <li><h3><a href="https://stock.leeeo.app/">주식 위키</a> 기업 페이지</h3><p>‘최근 공시’ 아래 공시 실적 비교(복합 차트, 0.4.0). 서버에서 SVG로 그려 스크립트 없이도 보여요.</p></li>
          <li><h3><a href="https://earnings.leeeo.app/">실적공시</a> 상세 페이지</h3><p>‘한눈에 비교’ 섹션의 공시 수치 비교(복합 차트, 0.4.0). 스크립트가 없으면 아래 표가 그대로 원본이에요.</p></li>
        </ul>
        <p>두 공개 앱은 공식 공시에 적힌 값만 그리고, 빠진 값은 비워 둬요.</p>
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <div class="footer-note"><p>@leeeo/charts ${esc(pkg.version)} · MIT · 이 페이지는 분석 도구를 쓰지 않아요.</p></div>
    <nav class="leeeo-chrome leeeo-footer" aria-label="운영 정보"><a href="https://leeeo.app/">© 2026 leeeo</a><a href="https://leeeo.app/">leeeo의 다른 앱</a><a href="mailto:hello@leeeo.app">문의 hello@leeeo.app</a></nav>
  </footer>
</body>
</html>
`;

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'lib'), { recursive: true });
// the browser build of the library: every .js module and the stylesheet (no type declarations, no React adapter)
cpSync(join(root, 'dist'), join(out, 'lib'), { recursive: true, filter: (src) => !src.endsWith('.d.ts') && !src.endsWith('react.js') });
cpSync(join(site, 'assets'), join(out, 'assets'), { recursive: true, filter: (src) => !src.endsWith('.d.ts') });
cpSync(join(site, 'vendor'), join(out, 'vendor'), { recursive: true });
if (existsSync(join(root, 'docs', 'images'))) cpSync(join(root, 'docs', 'images'), join(out, 'images'), { recursive: true });
writeFileSync(join(out, 'assets', 'specs.js'), 'export const examples = ' + JSON.stringify(examples.map(({ id, heading, spec }) => ({ id, heading, spec }))) + ';\n');
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://charts.leeeo.app/sitemap.xml\n');
writeFileSync(join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://charts.leeeo.app/</loc></url>\n</urlset>\n');
console.log('site built:', join(out, 'index.html'), '| examples:', examples.length);
