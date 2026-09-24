import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes('.test.')) out.push(p);
  }
  return out;
}

const files = walk('src');
const used = new Set();
const re = /\bt\(\s*'((?:\\'|[^'])*)'/g;
const re2 = /\bt\(\s*"((?:\\"|[^"])*)"/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src))) used.add(m[1].replace(/\\'/g, "'"));
  while ((m = re2.exec(src))) used.add(m[1].replace(/\\"/g, '"'));
}

const ar = readFileSync('src/locales/ar.ts', 'utf8');
const arKeys = new Set();
for (const line of ar.split('\n')) {
  const sq = line.match(/^\s+'((?:\\'|[^'])*)':/);
  if (sq) {
    arKeys.add(sq[1].replace(/\\'/g, "'"));
    continue;
  }
  const dq = line.match(/^\s+"((?:\\"|[^"])*)":/);
  if (dq) {
    arKeys.add(dq[1].replace(/\\"/g, '"'));
    continue;
  }
  const id = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):/);
  if (id) arKeys.add(id[1]);
}

const missing = [...used].filter(k => !arKeys.has(k)).sort();
console.log('t() keys used:', used.size);
console.log('ar keys:', arKeys.size);
console.log('missing:', missing.length);
if (missing.length) console.log(missing.join('\n'));
process.exit(missing.length ? 1 : 0);
