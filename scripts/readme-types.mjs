// Rewrites the chart-type table in README.md (between the types markers) from the gallery examples.
// Images are the gallery captures published at https://charts.leeeo.app/images/<example id>.png (npm run site:shots).
// usage: node scripts/readme-types.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { examples } from '../examples/specs.ts';

const readme = fileURLToPath(new URL('../README.md', import.meta.url));
const start = '<!-- types:start -->';
const end = '<!-- types:end -->';
const text = readFileSync(readme, 'utf8');
const a = text.indexOf(start);
const b = text.indexOf(end);
if (a < 0 || b < a) throw new Error('README.md needs the types:start / types:end markers');
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const types = new Set(examples.map((e) => e.spec.type));
const rows = examples.map((e) => `| \`${e.spec.type}\` | ${cell(e.heading)}.${e.note ? ' ' + cell(e.note) : ''} | ![${cell(e.heading)}](https://charts.leeeo.app/images/${e.id}.png) |`);
const table = [
  `차트 종류 ${types.size}가지, 예제 ${examples.length}개입니다. 모든 예제는 소개 사이트 갤러리에서 밝은·어두운 화면과 스펙 JSON으로 볼 수 있습니다.`,
  '',
  '| type | 설명 | 미리보기 |',
  '|---|---|---|',
  ...rows,
].join('\n');
writeFileSync(readme, text.slice(0, a + start.length) + '\n' + table + '\n' + text.slice(b));
console.log('README types:', types.size, 'examples:', examples.length);
