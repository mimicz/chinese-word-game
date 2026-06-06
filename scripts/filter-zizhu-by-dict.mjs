#!/usr/bin/env node
// 用 schema/dict/bigram.txt 過濾 schema/seeds-json/zizhu-*.json,
// 保留「三個雙字詞都在辭典中」的題目;其餘移除並寫入棄置清單。
//
// 用法:
//   node scripts/filter-zizhu-by-dict.mjs                # 寫回原檔 (含備份)
//   node scripts/filter-zizhu-by-dict.mjs --dry-run      # 只報告,不寫檔

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const SEEDS_DIR = join(ROOT, 'schema', 'seeds-json');
const DICT_PATH = join(ROOT, 'schema', 'dict', 'bigram.txt');
const DROPPED_DIR = join(ROOT, 'schema', 'dict', '.dropped');

const DRY_RUN = process.argv.includes('--dry-run');

const bigrams = new Set(
  readFileSync(DICT_PATH, 'utf-8')
    .normalize('NFC')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
);
console.log(`辭典: ${bigrams.size.toLocaleString()} 個雙字詞 (${DICT_PATH})`);
console.log();

const FILES = ['zizhu-elementary.json', 'zizhu-middle.json'];

function wordsOf(q) {
  return q.hints.map(h => (q.position === 'prefix' ? q.answer + h : h + q.answer));
}

let grandKept = 0;
let grandDropped = 0;

for (const f of FILES) {
  const path = join(SEEDS_DIR, f);
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const kept = [];
  const dropped = [];

  for (const q of data) {
    const words = wordsOf(q);
    const missing = words.filter(w => !bigrams.has(w.normalize('NFC')));
    if (missing.length === 0) {
      kept.push(q);
    } else {
      dropped.push({ ...q, _missing: missing });
    }
  }

  console.log(`${f}`);
  console.log(`  原數量: ${data.length}`);
  console.log(`  保留:   ${kept.length}`);
  console.log(`  移除:   ${dropped.length}`);
  if (dropped.length > 0) {
    console.log(`  移除樣本 (前 5 題):`);
    for (const q of dropped.slice(0, 5)) {
      const words = wordsOf(q);
      const marked = words.map(w => (bigrams.has(w.normalize('NFC')) ? w : `${w}✗`)).join('、');
      console.log(`    ${q.answer} (${q.position}) hints=${q.hints.join(',')} → ${marked}`);
    }
  }
  console.log();

  grandKept += kept.length;
  grandDropped += dropped.length;

  if (!DRY_RUN) {
    // 備份原檔
    const backup = path + '.before-concised-filter';
    if (!existsSync(backup)) copyFileSync(path, backup);
    // 寫回過濾結果
    writeFileSync(path, JSON.stringify(kept, null, 2) + '\n', 'utf-8');
    // 寫棄置清單以利人工檢視
    if (!existsSync(DROPPED_DIR)) mkdirSync(DROPPED_DIR, { recursive: true });
    const dropPath = join(DROPPED_DIR, f);
    writeFileSync(dropPath, JSON.stringify(dropped, null, 2) + '\n', 'utf-8');
    console.log(`  ✓ 寫回 ${path}`);
    console.log(`  ✓ 棄置清單 ${dropPath} (含 _missing 欄位)`);
    console.log();
  }
}

console.log(`=== 總計 ===`);
console.log(`  保留: ${grandKept}`);
console.log(`  移除: ${grandDropped}`);
if (DRY_RUN) console.log(`  (--dry-run 模式,未寫檔)`);
