#!/usr/bin/env node
// 字字珠璣題庫預覽 + 辭典硬驗證
//
// 用法:
//   node scripts/preview-zizhu.mjs                    隨機抽 20 題顯示
//   node scripts/preview-zizhu.mjs --difficulty middle
//   node scripts/preview-zizhu.mjs --all              全部列出
//   node scripts/preview-zizhu.mjs --with-meta        包含 LLM 給的 diversity/rationale

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const SEEDS_JSON = join(ROOT, 'schema', 'seeds-json');
const DICT_PATH = join(ROOT, 'schema', 'dict', 'bigram.txt');
const CANDIDATES_DIR = join(ROOT, 'schema', 'dict', '.candidates');

const args = process.argv.slice(2);
function argVal(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const filterDiff = argVal('--difficulty');
const showAll = args.includes('--all');
const withMeta = args.includes('--with-meta');
const sampleN = parseInt(argVal('--n') || '20', 10);

const bigrams = new Set(readFileSync(DICT_PATH, 'utf-8').normalize('NFC').split(/\r?\n/).map(l => l.trim()).filter(Boolean));
console.log(`字典: ${bigrams.size.toLocaleString()} 個雙字詞`);

function makeWord(answer, position, hint) {
  return position === 'prefix' ? answer + hint : hint + answer;
}

const difficulties = filterDiff ? [filterDiff] : ['elementary', 'middle'];
let totalErrors = 0;
let totalChecked = 0;

for (const diff of difficulties) {
  const path = join(SEEDS_JSON, `zizhu-${diff}.json`);
  if (!existsSync(path)) { console.warn(`(略過 ${diff} — 沒有 JSON)`); continue; }
  const data = JSON.parse(readFileSync(path, 'utf-8'));

  // metadata 從 .candidates/<diff>-with-meta.json (若有)
  const metaPath = join(CANDIDATES_DIR, `${diff}-with-meta.json`);
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf-8')) : [];
  const metaIndex = new Map();
  for (const q of meta) {
    const k = `${q.answer}|${[...q.hints].sort().join('')}|${q.position}`;
    metaIndex.set(k, q);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${diff} (${data.length} 題)`);
  console.log('='.repeat(60));

  // 辭典硬驗證
  let errors = 0;
  for (const q of data) {
    totalChecked++;
    for (const h of q.hints) {
      const w = makeWord(q.answer, q.position, h);
      if (!bigrams.has(w)) {
        console.error(`  ✗ ${w} 不在辭典 (answer=${q.answer}, hint=${h}, position=${q.position})`);
        errors++;
        totalErrors++;
      }
    }
  }
  if (errors === 0) console.log(`  ✓ 全部題目通過辭典硬驗證`);

  // 抽樣顯示
  const display = showAll ? data : [...data].sort(() => Math.random() - 0.5).slice(0, sampleN);
  console.log(`\n--- 顯示 ${display.length} 題 ---`);
  for (const q of display) {
    const words = q.hints.map(h => makeWord(q.answer, q.position, h));
    const posLabel = q.position === 'prefix' ? '前' : '後';
    console.log(`  [${posLabel}] ${words.join(' / ')}  →  「${q.answer}」`);
    if (withMeta) {
      const k = `${q.answer}|${[...q.hints].sort().join('')}|${q.position}`;
      const m = metaIndex.get(k);
      if (m) console.log(`        diversity=${m._diversity} commonness=${m._commonness} :: ${m._rationale}`);
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`總計 ${totalChecked} 題,辭典驗證錯誤 ${totalErrors} 個`);
if (totalErrors > 0) process.exit(1);
