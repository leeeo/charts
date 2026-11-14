// 0.8.2 site copy buttons: the text a 복사 button copies is the spec the card renders, and the clipboard fallback works.
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { renderChart } from '../src/index.ts';
import { examples } from '../examples/specs.ts';
import { addCopyButton, copyText, COPIED, COPY_FAILED, specJson, STATUS_MS, type CopyEnv } from '../site/assets/copy.js';

// A DOM just big enough for copy.js: elements with children, attributes, classes, listeners and focus.
class FakeDoc {
  body: FakeEl;
  activeElement: FakeEl | null = null;
  selected = '';
  clipboard: string | null = null;
  execResult = true;
  constructor() { this.body = new FakeEl('body', this); }
  createElement(tag: string): FakeEl { return new FakeEl(tag, this); }
  execCommand(cmd: string): boolean {
    if (cmd === 'copy' && this.execResult) { this.clipboard = this.selected; return true; }
    return false;
  }
}
class FakeEl {
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  attrs = new Map<string, string>();
  classes = new Set<string>();
  listeners = new Map<string, () => unknown>();
  textContent = '';
  value = '';
  type = '';
  tabIndex = 0;
  classList = {
    toggle: (c: string, on: boolean) => { if (on) this.classes.add(c); else this.classes.delete(c); },
    remove: (c: string) => { this.classes.delete(c); },
  };
  tag: string;
  private doc: FakeDoc;
  constructor(tag: string, doc: FakeDoc) { this.tag = tag; this.doc = doc; }
  set className(v: string) { this.classes = new Set(v.split(' ').filter(Boolean)); }
  get className(): string { return [...this.classes].join(' '); }
  setAttribute(k: string, v: string): void { this.attrs.set(k, v); }
  getAttribute(k: string): string | null { return this.attrs.get(k) ?? null; }
  append(...nodes: FakeEl[]): void { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  before(node: FakeEl): void {
    const siblings = (this.parent as FakeEl).children;
    node.parent = this.parent;
    siblings.splice(siblings.indexOf(this), 0, node);
  }
  remove(): void { const s = this.parent?.children; if (s) s.splice(s.indexOf(this), 1); this.parent = null; }
  addEventListener(type: string, fn: () => unknown): void { this.listeners.set(type, fn); }
  select(): void { this.doc.selected = this.value; this.doc.activeElement = this; }
  focus(): void { this.doc.activeElement = this; }
}
const envOf = (doc: FakeDoc, writeText?: (t: string) => Promise<void>): CopyEnv => ({
  document: doc as unknown as Document,
  ...(writeText ? { navigator: { clipboard: { writeText } } } : {}),
});

test('copy text: every gallery spec block parses back to the spec it renders', () => {
  assert.ok(examples.length >= 57);
  for (const e of examples) {
    const shown = specJson(e.spec); // the <code> text of the card and the text the button copies
    assert.deepEqual(JSON.parse(shown), e.spec, e.id);
    // the page renders from assets/specs.js, a JSON round trip of the same spec
    assert.equal(renderChart(JSON.parse(shown), { width: 720 }), renderChart(JSON.parse(JSON.stringify(e.spec)), { width: 720 }), e.id);
  }
});

test('copyText uses the Clipboard API when it is there', async () => {
  const doc = new FakeDoc();
  let written = '';
  assert.equal(await copyText('{"a": 1}', envOf(doc, async (t) => { written = t; })), true);
  assert.equal(written, '{"a": 1}');
  assert.equal(doc.body.children.length, 0, 'no fallback textarea');
});

test('copyText falls back to a textarea + execCommand and gives focus back', async () => {
  const doc = new FakeDoc();
  const button = doc.createElement('button');
  doc.body.append(button);
  button.focus();
  const ok = await copyText('줄 1\n줄 2', envOf(doc, async () => { throw new Error('NotAllowedError'); }));
  assert.equal(ok, true);
  assert.equal(doc.clipboard, '줄 1\n줄 2');
  assert.deepEqual(doc.body.children, [button], 'the textarea is removed');
  assert.equal(doc.activeElement, button);
  assert.equal(await copyText('x', envOf(new FakeDoc())), true, 'no Clipboard API at all');
});

test('copyText reports failure when neither way works', async () => {
  const doc = new FakeDoc();
  doc.execResult = false;
  assert.equal(await copyText('x', envOf(doc, async () => { throw new Error('denied'); })), false);
  assert.equal(doc.body.children.length, 0);
});

test('copy button copies its <pre> text and says 복사했어요 for 1.5s', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const doc = new FakeDoc();
    const pre = doc.createElement('pre');
    pre.textContent = specJson(examples[0]?.spec);
    doc.body.append(pre);
    let written = '';
    const button = addCopyButton(pre as unknown as HTMLElement, '선 차트 스펙 JSON', envOf(doc, async (t) => { written = t; })) as unknown as FakeEl;
    const bar = doc.body.children[0] as FakeEl;
    assert.equal(bar.className, 'code-bar', 'the bar sits right above the code');
    assert.equal(doc.body.children[1], pre);
    const status = bar.children[0] as FakeEl;
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(button.tag, 'button');
    assert.equal(button.type, 'button');
    assert.equal(button.textContent, '복사');
    assert.equal(button.getAttribute('aria-label'), '선 차트 스펙 JSON 복사');
    await (button.listeners.get('click') as () => Promise<void>)();
    assert.equal(written, pre.textContent);
    assert.equal(status.textContent, COPIED);
    mock.timers.tick(STATUS_MS - 1);
    assert.equal(status.textContent, COPIED);
    mock.timers.tick(1);
    assert.equal(status.textContent, '');
  } finally {
    mock.timers.reset();
  }
});

test('copy button says so when copying failed', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const doc = new FakeDoc();
    doc.execResult = false;
    const pre = doc.createElement('pre');
    doc.body.append(pre);
    const button = addCopyButton(pre as unknown as HTMLElement, '코드', envOf(doc)) as unknown as FakeEl;
    const status = (doc.body.children[0] as FakeEl).children[0] as FakeEl;
    await (button.listeners.get('click') as () => Promise<void>)();
    assert.equal(status.textContent, COPY_FAILED);
    assert.ok(status.classes.has('is-error'));
  } finally {
    mock.timers.reset();
  }
});
