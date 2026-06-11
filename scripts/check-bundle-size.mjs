import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = join(process.cwd(), 'apps/web/dist/assets');
const MAX_GZIP_KB = 400;

function gzipSize(bytes) {
  return gzipSync(bytes).length;
}

const files = readdirSync(DIST).filter((f) => f.endsWith('.js'));
let largest = { name: '', gzip: 0 };

for (const file of files) {
  const buf = readFileSync(join(DIST, file));
  const gz = gzipSize(buf);
  if (gz > largest.gzip) largest = { name: file, gzip: gz };
}

const gzipKb = (largest.gzip / 1024).toFixed(1);
console.log(`Largest JS chunk: ${largest.name} — ${gzipKb} KB gzip`);

if (largest.gzip > MAX_GZIP_KB * 1024) {
  console.error(`Bundle exceeds budget: ${gzipKb} KB > ${MAX_GZIP_KB} KB`);
  process.exit(1);
}

console.log('Bundle size check passed.');
