const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'scripts', 'build-manifest.sh');

const template = {
  manifest_version: 3,
  name: '(from project.md)',
  short_name: '(from project.md)',
  version: '0.0.0',
  minimum_chrome_version: '111',
  description: '(from project.md)',
  homepage_url: 'https://example.invalid/(from project.md)',
  icons: { 128: 'assets/identity/icon-128.png' },
  content_scripts: [{ matches: ['https://www.youtube.com/*'], js: ['src/content.js'] }],
};

const frontmatter = [
  'version: 1.2.3',
  'name: "Example"',
  'titleshort: "Example Short"',
  'url: https://example.com/project/',
  'description: "A description with \\"quotes\\" & an ampersand."',
  'author: "Someone"',
  'category: uncategorized',
];

function run(frontmatterLines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsoon-manifest-'));
  const project = path.join(dir, 'project.md');
  const tpl = path.join(dir, 'manifest.json');
  const out = path.join(dir, 'nested', 'out', 'manifest.json');
  fs.writeFileSync(project, `---\n${frontmatterLines.join('\n')}\n---\n\n# Body\n`);
  fs.writeFileSync(tpl, JSON.stringify(template, null, 2));
  const result = spawnSync('bash', [script, project, tpl, out], { encoding: 'utf8' });
  const manifest = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  return { result, manifest, out };
}

test('build-manifest copies the mapped project.md fields into the manifest', () => {
  const { result, manifest } = run(frontmatter);
  assert.equal(result.status, 0, result.stderr);
  const m = JSON.parse(manifest);
  assert.equal(m.name, 'Example');
  assert.equal(m.short_name, 'Example Short');
  assert.equal(m.version, '1.2.3');
  assert.equal(m.homepage_url, 'https://example.com/project/');
  assert.equal(m.description, 'A description with "quotes" & an ampersand.');
});

test('build-manifest leaves every other template field untouched', () => {
  const m = JSON.parse(run(frontmatter).manifest);
  assert.equal(m.manifest_version, 3);
  assert.equal(m.minimum_chrome_version, '111');
  assert.deepEqual(m.icons, template.icons);
  assert.deepEqual(m.content_scripts, template.content_scripts);
});

test('build-manifest does not copy unmapped keys such as author', () => {
  const m = JSON.parse(run(frontmatter).manifest);
  assert.equal('author' in m, false);
  assert.equal('category' in m, false);
});

test('build-manifest output is deterministic', () => {
  assert.equal(run(frontmatter).manifest, run(frontmatter).manifest);
});

test('build-manifest fails, and writes nothing, when a mapped field is missing', () => {
  const without = frontmatter.filter((line) => !line.startsWith('titleshort:'));
  const { result, manifest } = run(without);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /titleshort/);
  assert.match(result.stderr, /short_name/);
  assert.equal(manifest, null);
});

test('build-manifest fails when a mapped field is empty', () => {
  const blank = frontmatter.map((line) => (line.startsWith('description:') ? 'description: ""' : line));
  const { result, manifest } = run(blank);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /description/);
  assert.equal(manifest, null);
});
