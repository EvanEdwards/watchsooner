// Regenerates README.md from project.md: strips the YAML frontmatter, then
// substitutes {{key}} / {{nested.key}} placeholders in the remaining Markdown
// with values read from that frontmatter.
const fs = require('node:fs');

function unquote(value) {
  const trimmed = value.trim();
  const quoted = /^(['"])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
}

// Minimal parser for this project's frontmatter shape: flat or one level of
// nested `key:` blocks, 2-space indentation, scalar string values. No lists,
// multi-line scalars, or flow-style (`{...}`/`[...]`) YAML.
function parseFrontmatter(yamlText) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];

  for (const rawLine of yamlText.split('\n')) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const match = /^(\s*)([\w-]+):\s*(.*)$/.exec(rawLine);
    if (!match) continue;

    const [, indentStr, key, rawValue] = match;
    const indent = indentStr.length;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    if (rawValue === '') {
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      parent[key] = unquote(rawValue);
    }
  }

  return root;
}

function lookup(data, path) {
  return path.split('.').reduce((value, part) => {
    return value && typeof value === 'object' ? value[part] : undefined;
  }, data);
}

function substitute(body, data) {
  return body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, path) => {
    const value = lookup(data, path);
    if (value === undefined || typeof value === 'object') {
      console.error(`build-readme: no frontmatter value for {{${path}}}, leaving as-is`);
      return whole;
    }
    return String(value);
  });
}

const source = fs.readFileSync('project.md', 'utf8');
const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(source);
const frontmatter = frontmatterMatch ? parseFrontmatter(frontmatterMatch[1]) : {};
const body = source.slice(frontmatterMatch ? frontmatterMatch[0].length : 0).replace(/^\n+/, '');

fs.writeFileSync('README.md', substitute(body, frontmatter));
