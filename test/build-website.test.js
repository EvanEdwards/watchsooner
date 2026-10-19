const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const script = path.join(root, 'scripts', 'build-website.sh');
const hasConvert = spawnSync('bash', ['-c', 'command -v convert'], { encoding: 'utf8' }).status === 0;

const baseFrontmatter = [
  'version: 1.2.3',
  'name: "Example"',
  'title: "Example Title"',
  'description: "Does one useful thing."',
  'author: "Some Author"',
  'links:',
  '  support: https://github.com/example/example/',
  '  author: https://author.example/',
];

const intro = 'The **intro** paragraph.\n\nA second paragraph.';

function build({ frontmatter = baseFrontmatter, body = intro, screenshots = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsoon-site-'));
  const project = path.join(dir, 'project.md');
  const assets = path.join(dir, 'assets');
  const manifest = path.join(dir, 'manifest.json');
  const out = path.join(dir, 'out', 'index.html');
  fs.writeFileSync(project, `---\n${frontmatter.join('\n')}\n---\n\n${body}\n\n---\n\n## Later\n\nNot on the page.\n`);
  fs.writeFileSync(manifest, JSON.stringify({ minimum_chrome_version: '111' }));
  fs.mkdirSync(path.join(assets, 'google'), { recursive: true });
  for (const name of screenshots) {
    const png = path.join(assets, 'google', name);
    const made = spawnSync('convert', ['-size', '1280x800', 'xc:#336699', `png:${png}`]);
    assert.equal(made.status, 0, String(made.stderr));
  }
  const result = spawnSync('bash', [script, project, out], {
    encoding: 'utf8',
    env: { ...process.env, ASSETS_DIR: assets, MANIFEST: manifest },
  });
  const html = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  return { result, html };
}

test('build-website fills the page from the frontmatter and the intro prose', () => {
  const { result, html } = build();
  assert.equal(result.status, 0, result.stderr);
  assert.match(html, /<h1 class="display">Example Title<\/h1>/);
  assert.match(html, /<p class="lede">Does one useful thing\.<\/p>/);
  assert.match(html, /Version 1\.2\.3 · Chrome 111 or later · Free and open source/);
  assert.match(html, /<strong>intro<\/strong> paragraph/);
  assert.match(html, /© Some Author/);
  assert.match(html, /href="https:\/\/author\.example\/">author\.example<\/a>/);
  assert.match(html, /href="https:\/\/github\.com\/example\/example\/blob\/main\/CHANGELOG\.md"/);
});

test('build-website puts only the intro on the page, not the sections after the first rule', () => {
  const { html } = build();
  assert.equal(html.includes('Not on the page'), false);
});

test('build-website leaves no unfilled placeholder behind', () => {
  const { html } = build();
  assert.equal(/@@[A-Z_]+@@/.test(html), false);
  assert.equal(html.includes('{{'), false);
});

test('build-website links the download button to the latest release until there is a store listing', () => {
  const { html } = build();
  assert.match(html, /href="https:\/\/github\.com\/example\/example\/releases\/latest"><svg[^>]*>.*Download for Chrome/);
  assert.equal(html.includes('Add to Chrome'), false);
});

test('build-website uses links.store for "Add to Chrome" when it is set', () => {
  const { html } = build({ frontmatter: [...baseFrontmatter, '  store: https://chromewebstore.google.com/detail/example'] });
  assert.match(html, /href="https:\/\/chromewebstore\.google\.com\/detail\/example">Add to Chrome</);
  assert.equal(html.includes('releases/latest'), false);
});

test('build-website escapes HTML in frontmatter text', () => {
  const fm = baseFrontmatter.map((l) => (l.startsWith('description:') ? 'description: "Fish & <chips> \\"quoted\\""' : l));
  const { html } = build({ frontmatter: fm });
  assert.match(html, /<p class="lede">Fish &amp; &lt;chips&gt; &quot;quoted&quot;<\/p>/);
});

test('build-website uses the design\'s empty slot when there is no screenshot', () => {
  const { html } = build();
  assert.match(html, /<div class="sd-shot__empty caption">/);
  assert.equal(html.includes('<img class="sd-shot__img"'), false);
});

test('build-website embeds the screenshot as a WebP data URI', { skip: !hasConvert }, () => {
  const { result, html } = build({ screenshots: ['screenshot-001.png'] });
  assert.equal(result.status, 0, result.stderr);
  assert.match(html, /<img class="sd-shot__img" src="data:image\/webp;base64,[A-Za-z0-9+/=]+" alt="Screenshot of Example Title" width="1280" height="800">/);
  assert.equal(html.includes('<div class="sd-shot__empty caption">'), false);
});

test('build-website shows exactly one screenshot, the first by name', { skip: !hasConvert }, () => {
  const { html } = build({ screenshots: ['screenshot-002.png', 'screenshot-001.png'] });
  assert.equal((html.match(/<img class="sd-shot__img"/g) || []).length, 1);
});

test('build-website output is deterministic', { skip: !hasConvert }, () => {
  const opts = { screenshots: ['screenshot-001.png'] };
  assert.equal(build(opts).html, build(opts).html);
});

test('build-website fails, writing nothing, when a required frontmatter key is missing', () => {
  const { result, html } = build({ frontmatter: baseFrontmatter.filter((l) => !l.startsWith('title:')) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /title/);
  assert.equal(html, null);
});

test('build-website fails when there is no intro text before the first rule', () => {
  const { result, html } = build({ body: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /intro text/);
  assert.equal(html, null);
});

test('build-website fails on an unresolved {{placeholder}} instead of publishing it', () => {
  const { result, html } = build({ body: 'Version {{version}} is out.' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\{\{version\}\}/);
  assert.equal(html, null);
});
