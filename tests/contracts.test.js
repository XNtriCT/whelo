import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const html = read('index.html');
const css = read('src/style.css');
const pkg = JSON.parse(read('package.json'));
const srcFiles = fs.readdirSync(path.join(root, 'src')).filter((file) => file.endsWith('.js'));
const js = srcFiles.map((file) => read(path.join('src', file))).join('\n');

test('every element id queried by the renderer exists in the markup', () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const requested = new Set(
    [...js.matchAll(/getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((match) => match[1])
  );

  assert.ok(requested.size >= 90, `expected the renderer contract to stay broad, saw ${requested.size}`);
  const missing = [...requested].filter((id) => !ids.has(id)).sort();
  assert.deepEqual(missing, [], `missing ids: ${missing.join(', ')}`);
});

test('classes toggled by the renderer are styled', () => {
  const hooks = [
    'active', 'open', 'visible', 'hidden', 'locked', 'boosted', 'completed',
    'idle-hidden', 'dock-hidden', 'cursor-hidden', 'toast-success',
    'btn-speed-opt', 'tab-btn', 'tab-pane', 'dropdown-item', 'speed-preset-menu'
  ];
  const missing = hooks.filter((hook) => !css.includes(`.${hook}`));
  assert.deepEqual(missing, [], `unstyled hooks: ${missing.join(', ')}`);
});

test('design tokens are present', () => {
  for (const token of ['--ink-000', '--brass-2', '--lift-4', '--r-xl', '--ease', '--text-hi']) {
    assert.ok(css.includes(token), `missing design token ${token}`);
  }
  assert.ok(css.includes(':root'), 'design tokens must live on :root');
});

test('the interface stays offline and emoji-free', () => {
  assert.ok(!/@import\s+url\(['"]?https?:/.test(css), 'no remote font imports');
  assert.ok(!/<link[^>]+https?:/i.test(html), 'no remote stylesheets or icons');

  const surfaces = `${html}\n${js}`;
  assert.ok(!/[\u{1F000}-\u{1FAFF}]/u.test(surfaces), 'no pictographic emoji in shipped surfaces');
  for (const glyph of ['⚡', '✅', '❌', '⚠']) {
    assert.ok(!surfaces.includes(glyph), `unexpected glyph ${glyph}`);
  }
});

test('renderer entrypoints and assets exist', () => {
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(scripts.sort(), ['/src/main.js', '/src/ui.js'].sort());

  for (const file of ['public/logo.png', 'build/icon.ico', 'electron-main.cjs', 'preload.cjs', 'src/main.js', 'src/ui.js']) {
    assert.ok(exists(file), `missing ${file}`);
  }
});

test('package metadata is release-ready', () => {
  assert.equal(pkg.main, 'electron-main.cjs');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.license, 'MIT');
  assert.ok(pkg.repository.url.includes('github.com'));
  assert.ok(pkg.scripts.test);
  assert.ok(pkg.scripts.verify);

  assert.equal(pkg.build.win.icon, 'build/icon.ico');
  assert.ok(pkg.build.files.includes('dist/**/*'));
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.ok(pkg.build.fileAssociations.some((item) => item.ext === 'mkv'));
});

test('subtitle fixtures used by the tests stay representative', () => {
  const fixture = read('tests/subtitles.test.js');
  assert.ok(fixture.includes('00:00:01,000 --> 00:00:03,500'));
  assert.ok(fixture.includes('WEBVTT'));
  assert.ok(fixture.includes('Dialogue:'));
});
