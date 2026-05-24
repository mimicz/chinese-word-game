// 載入 schema/dict/bigram.txt,建立 prefix/suffix 索引
// 用法:
//   import { loadBigramIndex } from './build-bigram-index.mjs';
//   const { prefixIndex, suffixIndex, bigrams } = loadBigramIndex();
//
// 或 CLI sanity check:
//   node scripts/build-bigram-index.mjs 華

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const DICT_PATH = join(ROOT, 'schema', 'dict', 'bigram.txt');

let cached = null;

export function loadBigramIndex() {
  if (cached) return cached;

  const text = readFileSync(DICT_PATH, 'utf-8').normalize('NFC');
  const bigrams = new Set();
  const prefixIndex = new Map(); // X → Set<Y> for bigram XY
  const suffixIndex = new Map(); // Y → Set<X> for bigram XY

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const chars = [...line];
    if (chars.length !== 2) continue;
    const [x, y] = chars;
    if (bigrams.has(line)) continue;
    bigrams.add(line);
    if (!prefixIndex.has(x)) prefixIndex.set(x, new Set());
    prefixIndex.get(x).add(y);
    if (!suffixIndex.has(y)) suffixIndex.set(y, new Set());
    suffixIndex.get(y).add(x);
  }

  cached = { prefixIndex, suffixIndex, bigrams };
  return cached;
}

export function hintsOf(answerChar, position) {
  const { prefixIndex, suffixIndex } = loadBigramIndex();
  const map = position === 'prefix' ? prefixIndex : suffixIndex;
  return [...(map.get(answerChar) || [])];
}

export function isBigram(a, b) {
  const { bigrams } = loadBigramIndex();
  return bigrams.has(a + b);
}

// === CLI sanity check ===
if (import.meta.url === `file://${process.argv[1]}`) {
  const ch = process.argv[2] || '華';
  const { prefixIndex, suffixIndex, bigrams } = loadBigramIndex();
  console.log(`Loaded ${bigrams.size} unique bigrams`);
  console.log();
  console.log(`「${ch}」前綴位置 (${ch}_):  ${prefixIndex.get(ch)?.size ?? 0} 個`);
  const pre = [...(prefixIndex.get(ch) || [])].slice(0, 20);
  console.log('  範例:', pre.map(y => ch + y).join('、'));
  console.log();
  console.log(`「${ch}」後綴位置 (_${ch}):  ${suffixIndex.get(ch)?.size ?? 0} 個`);
  const suf = [...(suffixIndex.get(ch) || [])].slice(0, 20);
  console.log('  範例:', suf.map(x => x + ch).join('、'));
}
