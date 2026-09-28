// Appends a "- [!] **VERSION <version> RELEASE** ✅ <date>" marker to the top of
// today's entries in CHANGELOG.md, matching the format used by prior releases.
const fs = require('node:fs');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/changelog-append-release.js <version>');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const year = date.slice(0, 4);
const yearMonth = date.slice(0, 7);
const entry = `- [!] **VERSION ${version} RELEASE** ✅ ${date}`;

const lines = fs.readFileSync('CHANGELOG.md', 'utf8').split('\n');

function insertAfterBlank(index) {
  let insertAt = index + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
  return insertAt;
}

const monthHeadingIdx = lines.findIndex((l) => l.trim() === `## ${yearMonth}`);
if (monthHeadingIdx !== -1) {
  lines.splice(insertAfterBlank(monthHeadingIdx), 0, entry);
} else {
  const yearHeadingIdx = lines.findIndex((l) => l.trim() === `# ${year}`);
  if (yearHeadingIdx !== -1) {
    lines.splice(insertAfterBlank(yearHeadingIdx), 0, `## ${yearMonth}`, '', entry, '');
  } else {
    lines.unshift(`# ${year}`, '', `## ${yearMonth}`, '', entry, '');
  }
}

fs.writeFileSync('CHANGELOG.md', lines.join('\n'));
