const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const pagesDir = path.join(process.cwd(), 'src', 'pages');
const toastBridgeAbs = path.join(process.cwd(), 'src', 'utils', 'toastBridge.js');

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else if (ent.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

function relImport(fromFile) {
  let rel = path.relative(path.dirname(fromFile), toastBridgeAbs).replace(/\\/g, '/');
  rel = rel.replace(/\.js$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function isClearArg(arg) {
  return !arg || t.isNullLiteral(arg) || t.isIdentifier(arg, { name: 'undefined' }) || (t.isStringLiteral(arg) && arg.value === '');
}

let changed = 0;
let parseFailures = [];

for (const file of walk(pagesDir)) {
  const code = fs.readFileSync(file, 'utf8');
  if (!code.includes('setError(') && !code.includes('setSuccess(') && !code.includes('[error, setError]') && !code.includes('[success, setSuccess]')) continue;

  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    parseFailures.push(`${file}: ${e.message}`);
    continue;
  }

  let needToastImport = code.includes('pushToast(');
  let hasToastImport = false;
  for (const n of ast.program.body) {
    if (t.isImportDeclaration(n) && n.source.value.includes('toastBridge') && n.specifiers.some((s) => t.isImportSpecifier(s) && s.imported.name === 'pushToast')) {
      hasToastImport = true;
    }
  }

  traverse(ast, {
    VariableDeclaration(pathVar) {
      if (pathVar.node.declarations.length !== 1) return;
      const d = pathVar.node.declarations[0];
      if (!t.isArrayPattern(d.id) || !t.isCallExpression(d.init) || !t.isIdentifier(d.init.callee, { name: 'useState' })) return;
      const [a, b] = d.id.elements;
      if (!t.isIdentifier(a) || !t.isIdentifier(b)) return;

      if (a.name === 'error' && b.name === 'setError') {
        pathVar.replaceWith(t.variableDeclaration(pathVar.node.kind, [t.variableDeclarator(t.identifier('error'), t.nullLiteral())]));
      }
      if (a.name === 'success' && b.name === 'setSuccess') {
        pathVar.replaceWith(t.variableDeclaration(pathVar.node.kind, [t.variableDeclarator(t.identifier('success'), t.nullLiteral())]));
      }
    },

    CallExpression(pathCall) {
      if (!t.isIdentifier(pathCall.node.callee)) return;
      const name = pathCall.node.callee.name;
      if (name !== 'setError' && name !== 'setSuccess') return;

      const arg = pathCall.node.arguments[0] || t.nullLiteral();
      if (isClearArg(arg)) {
        if (pathCall.parentPath.isExpressionStatement()) pathCall.parentPath.remove();
        else pathCall.replaceWith(t.unaryExpression('void', t.numericLiteral(0)));
        return;
      }

      needToastImport = true;
      pathCall.replaceWith(
        t.callExpression(t.identifier('pushToast'), [
          t.objectExpression([
            t.objectProperty(t.identifier('title'), t.stringLiteral(name === 'setError' ? 'Thất bại' : 'Thành công')),
            t.objectProperty(t.identifier('message'), arg),
            t.objectProperty(t.identifier('type'), t.stringLiteral(name === 'setError' ? 'error' : 'success')),
          ]),
        ]),
      );
    },

    ExpressionStatement(pathExpr) {
      const e = pathExpr.node.expression;
      if (!t.isCallExpression(e) || !t.isIdentifier(e.callee, { name: 'setTimeout' })) return;
      const cb = e.arguments[0];
      if (t.isArrowFunctionExpression(cb) && t.isUnaryExpression(cb.body, { operator: 'void' })) pathExpr.remove();
    },
  });

  if (needToastImport && !hasToastImport) {
    const importDecl = t.importDeclaration([t.importSpecifier(t.identifier('pushToast'), t.identifier('pushToast'))], t.stringLiteral(relImport(file)));
    let insertAt = 0;
    while (insertAt < ast.program.body.length && t.isImportDeclaration(ast.program.body[insertAt])) insertAt++;
    ast.program.body.splice(insertAt, 0, importDecl);
  }

  const out = generate(ast, { jsescOption: { minimal: true } }, code).code + '\n';
  if (out !== code) {
    fs.writeFileSync(file, out, 'utf8');
    changed++;
  }
}

console.log('Changed files:', changed);
if (parseFailures.length) {
  console.log('Parse failures:');
  for (const p of parseFailures) console.log(p);
}
