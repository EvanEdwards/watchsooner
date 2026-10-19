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

function build({ frontmatter = baseFrontmatter, body = intro, screenshots = [], privacy = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsoon-site-'));
  const project = path.join(dir, 'project.md');
  const assets = path.join(dir, 'assets');
  const manifest = path.join(dir, 'manifest.json');
  const out = path.join(dir, 'out', 'index.html');
  const privacyMd = path.join(dir, 'PRIVACY.md');
  const privacyOut = path.join(dir, 'out', 'privacy.html');
  if (privacy !== null) fs.writeFileSync(privacyMd, privacy);
  fs.writeFileSync(project, `---\n${frontmatter.join('\n')}\n---\n\n${body}\n\n---\n\n## Later\n\nNot on the page.\n`);
  fs.writeFileSync(manifest, JSON.stringify({ minimum_chrome_version: '111' }));
  fs.mkdirSync(path.join(assets, 'google'), { recursive: true });
  for (const shot of screenshots) {
    const { name, color = '#336699' } = typeof shot === 'string' ? { name: shot } : shot;
    const png = path.join(assets, 'google', name);
    const made = spawnSync('convert', ['-size', '1280x800', `xc:${color}`, `png:${png}`]);
    assert.equal(made.status, 0, String(made.stderr));
  }
  const result = spawnSync('bash', [script, project, out], {
    encoding: 'utf8',
    env: { ...process.env, ASSETS_DIR: assets, MANIFEST: manifest, PRIVACY_MD: privacyMd },
  });
  const html = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  const privacyHtml = fs.existsSync(privacyOut) ? fs.readFileSync(privacyOut, 'utf8') : null;
  return { result, html, privacyHtml, out, privacyOut };
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
  assert.equal(html.includes('<img class="sd-shot__img'), false);
});

test('build-website embeds the screenshot as a WebP data URI', { skip: !hasConvert }, () => {
  const { result, html } = build({ screenshots: ['screenshot-001.png'] });
  assert.equal(result.status, 0, result.stderr);
  assert.match(html, /<img class="sd-shot__img sd-shot__slide is-active" src="data:image\/webp;base64,[A-Za-z0-9+/=]+" alt="Screenshot of Example Title" width="1280" height="800">/);
  assert.equal(html.includes('<div class="sd-shot__empty caption">'), false);
});

function slideTags(html) {
  return html.match(/<img class="sd-shot__img sd-shot__slide[^>]*>/g) || [];
}

// The dominant colour of a slide's embedded WebP, as [r, g, b].
function slideColor(tag) {
  const data = /base64,([A-Za-z0-9+/=]+)/.exec(tag)[1];
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wsoon-slide-')), 'slide.webp');
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  const read = spawnSync('convert', [file, '-format', '%[fx:int(255*p{20,20}.r)],%[fx:int(255*p{20,20}.g)],%[fx:int(255*p{20,20}.b)]', 'info:'], { encoding: 'utf8' });
  return read.stdout.split(',').map(Number);
}

test('build-website embeds every screenshot as a slide, in name order', { skip: !hasConvert }, () => {
  const { result, html } = build({
    screenshots: [
      { name: 'screenshot-002.png', color: '#cc0000' },
      { name: 'screenshot-001.png', color: '#0000cc' },
    ],
  });
  assert.equal(result.status, 0, result.stderr);
  const slides = slideTags(html);
  assert.equal(slides.length, 2);
  const [first, second] = slides.map(slideColor);
  assert.ok(first[2] > first[0], `slide 1 should be the blue screenshot-001, got ${first}`);
  assert.ok(second[0] > second[2], `slide 2 should be the red screenshot-002, got ${second}`);
});

test('build-website marks only the first slide active and hides the rest from screen readers', { skip: !hasConvert }, () => {
  const slides = slideTags(build({ screenshots: ['screenshot-001.png', 'screenshot-002.png', 'screenshot-003.png'] }).html);
  assert.equal(slides.length, 3);
  assert.match(slides[0], /sd-shot__slide is-active"/);
  assert.equal(slides[0].includes('aria-hidden'), false);
  for (const tag of slides.slice(1)) {
    assert.equal(tag.includes('is-active'), false);
    assert.match(tag, /aria-hidden="true"/);
  }
});

test('build-website numbers the alt text when there are several screenshots', { skip: !hasConvert }, () => {
  const several = slideTags(build({ screenshots: ['screenshot-001.png', 'screenshot-002.png'] }).html);
  assert.match(several[0], /alt="Screenshot of Example Title \(1 of 2\)"/);
  assert.match(several[1], /alt="Screenshot of Example Title \(2 of 2\)"/);
  const one = slideTags(build({ screenshots: ['screenshot-001.png'] }).html);
  assert.match(one[0], /alt="Screenshot of Example Title"/);
});

test('build-website embeds at most 5 screenshots, the Web Store limit', { skip: !hasConvert }, () => {
  const names = [1, 2, 3, 4, 5, 6, 7].map((n) => `screenshot-00${n}.png`);
  assert.equal(slideTags(build({ screenshots: names }).html).length, 5);
});

test('build-website ships the slideshow, the full-screen view and its close controls', () => {
  const { html } = build();
  assert.match(html, /<div class="sd-shot__stage">/);
  assert.match(html, /<script>[\s\S]*setInterval\([\s\S]*4000\)[\s\S]*<\/script>/);
  assert.match(html, /\.sd-lightbox__close/);
  assert.match(html, /event\.key === 'Escape'/);
  assert.match(html, /prefers-reduced-motion/);
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

const policy = '# Privacy policy\n\n[Back](index.html)\n\nWe collect **nothing** & keep nothing.\n\n## Sharing\n\nNone.';

test('build-website builds privacy.html from PRIVACY.md, next to the index', () => {
  const { result, privacyHtml } = build({ privacy: policy });
  assert.equal(result.status, 0, result.stderr);
  assert.match(privacyHtml, /<title>Privacy policy — Example Title<\/title>/);
  assert.match(privacyHtml, /<h1 id="privacy-policy">Privacy policy<\/h1>/);
  assert.match(privacyHtml, /We collect <strong>nothing<\/strong> &amp; keep nothing\./);
  assert.match(privacyHtml, /<h2 id="sharing">Sharing<\/h2>/);
});

test('build-website keeps the link back to index.html in the policy', () => {
  const { privacyHtml } = build({ privacy: policy });
  assert.match(privacyHtml, /<a href="index\.html">Back<\/a>/);
  assert.match(privacyHtml, /<a class="sd-link caption" href="index\.html">Home<\/a>/);
});

test('build-website links the index footer to the privacy page when PRIVACY.md exists', () => {
  const { html, privacyHtml } = build({ privacy: policy });
  assert.match(html, /<a class="sd-link" href="privacy\.html">Privacy<\/a>/);
  assert.match(privacyHtml, /<a class="sd-link" href="privacy\.html">Privacy<\/a>/);
});

test('build-website has no Privacy link and builds no privacy page without PRIVACY.md', () => {
  const { result, html, privacyHtml } = build();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(html.includes('privacy.html'), false);
  assert.equal(privacyHtml, null);
});

test('build-website leaves no unfilled placeholder in the privacy page', () => {
  const { privacyHtml } = build({ privacy: policy });
  assert.equal(/@@[A-Z_]+@@/.test(privacyHtml), false);
  assert.equal(privacyHtml.includes('{{'), false);
});

test('build-website fails, publishing neither page, on a {{placeholder}} in PRIVACY.md', () => {
  const { result, html, privacyHtml } = build({ privacy: 'Version {{version}}.' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\{\{version\}\}/);
  assert.equal(privacyHtml, null);
  assert.equal(html, null);
});

test('build-website writes pages that a web server can read (not owner-only)', () => {
  const { result, out, privacyOut } = build({ privacy: policy });
  assert.equal(result.status, 0, result.stderr);
  for (const file of [out, privacyOut]) {
    const mode = fs.statSync(file).mode & 0o777;
    assert.equal(mode & 0o044, 0o044, `${path.basename(file)} is mode ${mode.toString(8)}, expected group/other read`);
  }
});
