// Mounts every gallery chart at its container width and runs the spec playground.
import { mountChart } from '../lib/dom.js';
import { validateSpec, ChartSpecError } from '../lib/index.js';
import { examples } from './specs.js';

const MAX_INPUT = 20000;
const byId = new Map(examples.map((e) => [e.id, e]));
const specJson = (spec) => JSON.stringify(spec, null, 2)
  .replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner) => '[' + inner.split(/,\s+/).join(', ') + ']');

for (const host of document.querySelectorAll('[data-example]')) {
  const e = byId.get(host.dataset.example);
  if (!e) continue;
  const pane = host.dataset.themePane;
  mountChart(host, { ...e.spec, id: pane === 'page' ? 'lc-hero' : `${e.id}-${pane}` });
}

const input = document.getElementById('play-input');
const status = document.getElementById('play-status');
const picker = document.getElementById('play-example');
const host = document.getElementById('play-host');
const play = mountChart(host, { ...JSON.parse(input.value), id: 'lc-play' });
let timer = 0;

// Korean wording for the validator's messages; anything unmatched is shown as-is.
const KO = [
  [/^is required$/, '값이 필요해요'],
  [/^unknown property$/, '알 수 없는 속성이에요'],
  [/^must be a finite number or null \(missing\)$/, '숫자 또는 null(빠진 값)이어야 해요'],
  [/^must be a finite number >= 0 or null \(missing\)$/, '0 이상의 숫자 또는 null(빠진 값)이어야 해요'],
  [/^must be a finite number in \[(.+), (.+)\]$/, '$1에서 $2 사이의 숫자여야 해요'],
  [/^must be a non-empty string$/, '비어 있지 않은 글자여야 해요'],
  [/^must be a non-empty array of strings$/, '글자 항목이 하나 이상 있는 배열이어야 해요'],
  [/^must be a non-empty array$/, '항목이 하나 이상 있는 배열이어야 해요'],
  [/^must be an array$/, '배열이어야 해요'],
  [/^must be an object$/, '객체여야 해요'],
  [/^must be a boolean$/, 'true 또는 false여야 해요'],
  [/^must be an integer$/, '정수여야 해요'],
  [/^must be one of (.+)$/, '다음 중 하나여야 해요: $1'],
  [/^must have (\d+) entries \(one per label\), got (\d+)$/, '라벨 수와 같은 $1개가 필요한데 $2개예요'],
  [/^must have at most (\d+) (?:entries|series)$/, '최대 $1개까지 넣을 수 있어요'],
  [/^must be at most (\d+) characters$/, '$1자 이하여야 해요'],
  [/^must be #hex, var\(--token\) or a colour keyword$/, '#hex, var(--토큰), 색 이름 중 하나여야 해요'],
  [/^must be greater than (\w+)$/, '$1보다 커야 해요'],
  [/^must not be negative for this chart$/, '이 차트에서는 음수를 쓸 수 없어요'],
  [/^duplicate id$/, '같은 id가 이미 있어요'],
  [/^sparkline takes exactly one series$/, '스파크라인은 시리즈를 하나만 받아요'],
  [/^must match .+$/, '영문자로 시작하는 영문·숫자·_·- 64자 이내여야 해요'],
  [/^requires (\w+): true$/, '$1: true가 함께 있어야 해요'],
  [/^is too small for the data \(more than (\d+) cells\)$/, '데이터에 비해 너무 작아요 (칸이 $1개를 넘어요)'],
  [/^must be the id of a node$/, '노드 id 중 하나여야 해요'],
  [/^would create a cycle$/, '링크가 순환을 만들어요'],
  [/^must have at least (\d+) entries$/, '$1개 이상 항목이 있어야 해요'],
  [/^must differ from source$/, '출발 노드와 달라야 해요'],
  [/^duplicate link$/, '같은 연결이 이미 있어요'],
  [/^must not be combined with (\w+)$/, '$1와 함께 쓸 수 없어요'],
  [/^must mirror the matrix when directed is false$/, 'directed가 false이면 행렬이 대칭이어야 해요'],
  [/^must be the id of a group$/, '그룹 id 중 하나여야 해요'],
  [/^cannot be used together with (\w+)$/, '$1와 함께 쓸 수 없어요'],
  [/^is too small for the data \(more than (\d+) bins\)$/, '데이터에 비해 너무 작아요 (구간이 $1개를 넘어요)'],
  [/^must be a date YYYY-MM-DD$/, 'YYYY-MM-DD 형식의 날짜여야 해요'],
  [/^duplicate date$/, '같은 날짜가 이미 있어요'],
  [/^must be between start and end$/, 'start와 end 사이여야 해요'],
  [/^must not be before start$/, 'start보다 이르면 안 돼요'],
  [/^must span at most (\d+) days$/, '최대 $1일까지 넣을 수 있어요'],
];
function specMessage(err) {
  const raw = err.message.startsWith(err.path + ': ') ? err.message.slice(err.path.length + 2) : err.message;
  const rule = KO.find(([re]) => re.test(raw));
  return `${err.path || '스펙'} — ${rule ? raw.replace(rule[0], rule[1]) : raw}`;
}

function report(message, isError) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
  if (isError) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function draw() {
  clearTimeout(timer);
  const text = input.value;
  if (text.length > MAX_INPUT) { report(`입력이 너무 길어요. ${MAX_INPUT.toLocaleString('ko-KR')}자 이하로 줄여 주세요. 마지막 차트를 그대로 두었어요.`, true); return; }
  let spec;
  try { spec = JSON.parse(text); } catch (err) {
    report(`JSON 형식이 맞지 않아요. 쉼표·따옴표·괄호를 확인해 주세요. (브라우저 메시지: ${err.message})`, true); return;
  }
  if (spec && typeof spec === 'object' && !Array.isArray(spec) && spec.id === undefined) spec = { ...spec, id: 'lc-play' };
  try { validateSpec(spec); } catch (err) {
    if (err instanceof ChartSpecError) report(`스펙을 고쳐 주세요. ${specMessage(err)}`, true);
    else report(`그릴 수 없어요. ${err.message}`, true);
    return;
  }
  play.update(spec);
  report('새 스펙으로 다시 그렸어요.', false);
}

input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 400); });
document.getElementById('play-render').addEventListener('click', draw);
picker.addEventListener('change', () => {
  const e = byId.get(picker.value);
  if (!e) return;
  input.value = specJson(e.spec);
  draw();
  report(`‘${e.heading}’ 예제를 불러와 그렸어요.`, false);
});
document.documentElement.dataset.ready = '1';
