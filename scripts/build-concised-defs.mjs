#!/usr/bin/env node
// 從教育部《國語辭典簡編本》原始資料 (c.txt) 抽出所有「雙字詞」的釋義,
// 寫成 schema/dict/.cache/concised-defs.json 供題目生成器與倍填腳本使用。
//
// 格式: { "火山": "由地球內部噴出的高溫岩漿...", "火海": "大片的火;大火。", ... }
//
// 用法:
//   node scripts/build-concised-defs.mjs
//
// 依賴: schema/dict/.cache/c.txt 已存在 (由 build-concised-bigram.mjs --fetch 下載)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const CACHE_DIR = join(ROOT, 'schema', 'dict', '.cache');
const SRC = join(CACHE_DIR, 'c.txt');
const OUT = join(CACHE_DIR, 'concised-defs.json');

const MAX_DEF_LEN = 120; // 釋義超過此長度則截斷加 …

if (!existsSync(SRC)) {
  console.error(`找不到 ${SRC}`);
  console.error(`請先執行: node scripts/build-concised-bigram.mjs --fetch`);
  process.exit(1);
}

function decodeHeadword(encoded) {
  return encoded.replace(/%u([0-9A-Fa-f]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

// 清理辭典 markup:`、~ 是 moedict 的 ruby/word-boundary 標記
function cleanDef(s) {
  return s
    .replace(/[`~]/g, '')   // 移除 ruby 標記
    .replace(/\s+/g, '')    // 中文連續釋義不需空白
    .trim();
}

function extractDef(entry) {
  // 取所有 h[*].d[*].f,用 ;串接 (多音字 + 多義項合在一起)
  const pieces = [];
  for (const h of entry.h || []) {
    for (const d of h.d || []) {
      if (!d.f) continue;
      const cleaned = cleanDef(d.f);
      if (cleaned) pieces.push(cleaned);
    }
  }
  let joined = pieces.join(';');
  if (joined.length > MAX_DEF_LEN) {
    joined = joined.slice(0, MAX_DEF_LEN) + '…';
  }
  return joined;
}

const text = readFileSync(SRC, 'utf-8');
const defs = {};
let total = 0;
let extracted = 0;
let skippedNonBigram = 0;
let skippedNoDef = 0;

for (const raw of text.split('\n')) {
  if (!raw) continue;
  total++;
  const parts = raw.split(' ');
  if (parts.length < 3) continue;
  const encoded = parts[1];
  if (!/^(%u[0-9A-Fa-f]{4})+$/.test(encoded)) continue;
  const word = decodeHeadword(encoded).normalize('NFC');
  if ([...word].length !== 2) {
    skippedNonBigram++;
    continue;
  }
  const jsonStr = parts.slice(2).join(' ');
  let entry;
  try {
    entry = JSON.parse(jsonStr);
  } catch {
    continue;
  }
  const def = extractDef(entry);
  if (!def) {
    skippedNoDef++;
    continue;
  }
  defs[word] = def;
  extracted++;
}

mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(defs, null, 0), 'utf-8');

console.log(`=== 來源統計 ===`);
console.log(`  總詞條       ${total.toLocaleString()}`);
console.log(`  非雙字 (跳過) ${skippedNonBigram.toLocaleString()}`);
console.log(`  無釋義 (跳過) ${skippedNoDef.toLocaleString()}`);
console.log(`\n=== 輸出 ===`);
console.log(`  ${OUT}`);
console.log(`  雙字詞釋義條目: ${extracted.toLocaleString()}`);
console.log(`\n--- sanity check ---`);
for (const w of ['火山', '火海', '學長', '長度', '長輩', '神色', '風雅']) {
  console.log(`  ${w} → ${defs[w] ?? '(找不到)'}`);
}
