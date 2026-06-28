const fs = require('fs');
const path = require('path');

const pagesDir = path.join(process.cwd(), 'src', 'pages');
const utilsAbs = path.join(process.cwd(), 'src', 'utils', 'toastBridge.js');

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else if (ent.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

function relImport(file) {
  const rel = path.relative(path.dirname(file), utilsAbs).replace(/\\/g, '/').replace(/\.js$/, '');
  return rel.startsWith('.') ? rel : './' + rel;
}

let changed = 0;
for (const file of walk(pagesDir)) {
  let code = fs.readFileSync(file, 'utf8');
  const hasPushCall = code.includes('pushToast(');

  const lines = code.split(/\r?\n/);
  const filtered = lines.filter((ln) => !/^\s*import\s+\{\s*pushToast\s*\}\s+from\s+['"][^'"]*toastBridge['"]\s*;?\s*$/.test(ln));

  let next = filtered.join('\n');

  if (hasPushCall) {
    const importLine = `import { pushToast } from '${relImport(file)}'`;
    const rows = next.split('\n');
    let insertAt = 0;
    while (insertAt < rows.length && /^\s*import\b/.test(rows[insertAt])) insertAt++;
    rows.splice(insertAt, 0, importLine);
    next = rows.join('\n');
  }

  if (!next.endsWith('\n')) next += '\n';
  if (next !== code) {
    fs.writeFileSync(file, next, 'utf8');
    changed++;
  }
}
console.log('Normalized toast imports in files:', changed);
