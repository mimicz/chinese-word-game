#!/usr/bin/env node
// 為 schema/seeds-json/zizhu-*.json 的每一題注入 payload.definitions,
// 釋義來源:schema/dict/.cache/concised-defs.json (由 build-concised-defs.mjs 產生)。
//
// 用法:
//   node scripts/inject-definitions.mjs              # 倍填全部
//   node scripts/inject-definitions.mjs --dry-run    # 只報告

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const SEEDS_DIR = join(ROOT, 'schema', 'seeds-json');
const DEFS_PATH = join(ROOT, 'schema', 'dict', '.cache', 'concised-defs.json');

const DRY_RUN = process.argv.includes('--dry-run');

if (!existsSync(DEFS_PATH)) {
  console.error(`找不到 ${DEFS_PATH}`);
  console.error(`請先執行: node scripts/build-concised-defs.mjs`);
  process.exit(1);
}
const defs = JSON.parse(readFileSync(DEFS_PATH, 'utf-8'));
console.log(`釋義索引: ${Object.keys(defs).length.toLocaleString()} 個雙字詞`);
console.log();

function wordsOf(q) {
  return q.hints.map(h => (q.position === 'prefix' ? q.answer + h : h + q.answer));
}

const FILES = ['zizhu-elementary.json', 'zizhu-middle.json'];

let grandTotal = 0;
let grandHit = 0;
let grandMiss = 0;

for (const f of FILES) {
  const path = join(SEEDS_DIR, f);
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  let hitWords = 0, missWords = 0, qHit = 0, qMissAny = 0;
  const sampleMisses = [];

  for (const q of data) {
    const words = wordsOf(q);
    const wordDefs = {};
    let missed = false;
    for (const w of words) {
      const key = w.normalize('NFC');
      const d = defs[key];
      if (d) {
        wordDefs[w] = d;
        hitWords++;
      } else {
        missWords++;
        missed = true;
        if (sampleMisses.length < 5) sampleMisses.push(w);
      }
    }
    if (missed) qMissAny++;
    else qHit++;
    q.definitions = wordDefs;
  }

  console.log(`${f}`);
  console.log(`  題數              ${data.length}`);
  console.log(`  全部 3 詞有釋義   ${qHit}`);
  console.log(`  至少 1 詞缺釋義   ${qMissAny}`);
  console.log(`  總詞數命中/缺      ${hitWords}/${missWords}`);
  if (sampleMisses.length > 0) {
    console.log(`  缺釋義樣本:        ${sampleMisses.join('、')}`);
  }
  console.log();

  grandTotal += data.length;
  grandHit += qHit;
  grandMiss += qMissAny;

  if (!DRY_RUN) {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`  ✓ 寫回 ${path}`);
    console.log();
  }
}

console.log(`=== 總計 ===`);
console.log(`  題數              ${grandTotal}`);
console.log(`  全部釋義齊全      ${grandHit}`);
console.log(`  至少 1 詞缺釋義   ${grandMiss}`);
if (DRY_RUN) console.log(`  (--dry-run,未寫檔)`);
