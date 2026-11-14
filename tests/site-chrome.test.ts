import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));

// The vendored @leeeo/chrome copy is pinned by its VERSION stamp; an edit here means the site ejected it.
test('site vendored @leeeo/chrome files match their pinned VERSION stamp', () => {
  const [header, ...files] = read('site/vendor/leeeo-chrome/VERSION').toString().trim().split('\n');
  assert.match(header, /^@leeeo\/chrome \d+\.\d+\.\d+$/);
  assert.equal(files.length, 3);
  for (const line of files) {
    const [hash, name] = line.split('  ');
    assert.equal(createHash('sha256').update(read(`site/vendor/leeeo-chrome/${name}`)).digest('hex'), hash, name);
  }
});

test('site pages load the vendored package', () => {
  const build = read('site/build.mjs').toString();
  for (const tag of ['<script src="vendor/leeeo-chrome/chrome-boot.js"></script>',
    '<link rel="stylesheet" href="vendor/leeeo-chrome/chrome.css">',
    '<script type="module" src="vendor/leeeo-chrome/chrome.js"></script>']) assert.ok(build.includes(tag), tag);
  assert.doesNotMatch(build, /vendor\/(theme|chrome)\.(js|css)"/);
});
