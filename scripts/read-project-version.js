// Prints the `version:` value from project.md's YAML frontmatter.
const fs = require('node:fs');

const text = fs.readFileSync('project.md', 'utf8');
const match = /^version:\s*(\S+)\s*$/m.exec(text);
if (!match) {
  console.error('Could not find a version field in project.md');
  process.exit(1);
}
process.stdout.write(match[1]);
