const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src');
const exts = ['.js', '.jsx'];
let changed = [];

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file === 'build' || file === 'node_modules') continue;
      walk(full);
    } else if (exts.includes(path.extname(file))) {
      fixFile(full);
    }
  }
}

function fixFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  const orig = s;
  // handle single-quoted duplicate title
  s = s.replace(/showToast\(\{\s*title:\s*'[^']*',\s*title:/g, 'showToast({ title:');
  // handle double-quoted duplicate title
  s = s.replace(/showToast\(\{\s*title:\s*"[^"]*",\s*title:/g, 'showToast({ title:');
  // handle cases where first title uses variable title: msg, title: '...'
  s = s.replace(/showToast\(\{\s*title:\s*[^,}]+,\s*title:/g, 'showToast({ title:');

  if (s !== orig) {
    fs.writeFileSync(filePath, s, 'utf8');
    changed.push(filePath);
  }
}

walk(root);
console.log('Fixed files:', changed.length);
changed.forEach(f => console.log(f));
process.exit(0);
