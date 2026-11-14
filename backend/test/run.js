// Ejecuta cada test/**/*.test.js en su propio proceso (node:test, sin dependencias).
// Se lanzan por separado porque el runner de `node --test` de algunas versiones de Node 18 falla con
// tildes en los nombres de las pruebas.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (f !== 'fixtures') walk(p); } else if (f.endsWith('.test.js')) files.push(p);
  }
})(__dirname);

let failed = 0;
for (const f of files.sort()) {
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
  if (r.status !== 0) { failed++; console.error(`✗ ${path.relative(process.cwd(), f)}`); }
}
console.log(failed ? `\n${failed} fichero(s) con fallos` : `\n${files.length} fichero(s) de pruebas: todo correcto`);
process.exit(failed ? 1 : 0);
