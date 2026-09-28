// Writes dist/release-<version>.txt with suggested release notes, pulled from
// the CHANGELOG.md entries logged since the last "VERSION ... RELEASE" marker.
// Leaves an existing file alone (e.g. a retry after a failed release keeps edits).
const fs = require('node:fs');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/draft-release-notes.js <version>');
  process.exit(1);
}

const outPath = `dist/release-${version}.txt`;
if (fs.existsSync(outPath)) {
  process.exit(0);
}

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8').split('\n');
const bullets = [];
for (const line of changelog) {
  const item = /^- \[x\] (.+?)(?:\s*✅.*)?$/.exec(line.trim());
  if (item) {
    bullets.push(item[1]);
    continue;
  }
  if (/^- \[!\] \*\*VERSION\b/.test(line.trim())) break;
}

const notes = [
  `watchsooner v${version}`,
  '',
  '<!-- One or two sentences on what this release is about. -->',
  '',
  '## Changes',
  '',
  ...(bullets.length ? bullets.map((b) => `- ${b}`) : ['- (fill in manually)']),
  '',
].join('\n');

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync(outPath, notes);
