const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src');
const exts = ['.js', '.jsx'];
let changedFiles = [];

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file === 'build' || file === 'node_modules') continue;
      walk(full);
    } else if (exts.includes(path.extname(file))) {
      processFile(full);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  // Replace `showToast({ message:` -> `showToast({ title:`
  content = content.replace(/showToast\(\{\s*message:/g, 'showToast({ title:');
  // Also replace `, message:` occurrences inside showToast calls
  content = content.replace(/showToast\(\{([^}]*)\bmessage:/g, 'showToast({$1title:');
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    changedFiles.push(filePath);
  }
}

walk(root);

console.log('Files changed:', changedFiles.length);
changedFiles.forEach(f => console.log(f));

if (changedFiles.length === 0) process.exit(0);
process.exit(0);
