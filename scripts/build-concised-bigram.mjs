#!/usr/bin/env node
// 從教育部《國語辭典簡編本》原始資料 (c.txt) 抽出所有「雙字詞」詞條,
// 寫成 schema/dict/bigram.txt 供 zizhu 題目產生與驗證使用。
//
// 來源:g0v/moedict-webkit 的 c.txt (簡編本完整資料,~52MB,99k 行)
//   https://raw.githubusercontent.com/g0v/moedict-webkit/master/c.txt
//
// 用法:
//   node scripts/build-concised-bigram.mjs           # 從 .cache/c.txt 重建 bigram.txt
//   node scripts/build-concised-bigram.mjs --fetch   # 若 .cache/c.txt 不存在則先下載
//
// c.txt 格式:每行 "<group_id> <url-encoded-headword> <JSON>"
//   例:  "0 %u706B%u5C71 {...}" 代表 "火山" 的詞條

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const CACHE_DIR = join(ROOT, 'schema', 'dict', '.cache');
const SRC = join(CACHE_DIR, 'c.txt');
const OUT = join(ROOT, 'schema', 'dict', 'bigram.txt');
const URL = 'https://raw.githubusercontent.com/g0v/moedict-webkit/master/c.txt';

async function ensureSource() {
  if (existsSync(SRC)) return;
  if (!process.argv.includes('--fetch')) {
    console.error(`找不到 ${SRC}`);
    console.error(`請執行: node scripts/build-concised-bigram.mjs --fetch`);
    console.error(`或手動下載 ${URL} 到該位置。`);
    process.exit(1);
  }
  console.log(`下載 ${URL} ...`);
  mkdirSync(CACHE_DIR, { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`下載失敗: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(SRC, buf);
  console.log(`  -> ${SRC} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

function decodeHeadword(encoded) {
  // %uXXXX → UTF-16 code unit
  return encoded.replace(/%u([0-9A-Fa-f]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

await ensureSource();

const text = readFileSync(SRC, 'utf-8');
const bigrams = new Set();
let total = 0;
let skippedNonEncoded = 0;
let singleChar = 0;
let multiChar = 0;

for (const raw of text.split('\n')) {
  if (!raw) continue;
  total++;
  // 取第二欄 (URL-encoded headword)。
  // 注意:有少數無法編碼的特殊字 (例如「土+夅」這類組合字),第二欄會直接是 JSON 起頭 — 跳過。
  const tabSplit = raw.split(' ');
  if (tabSplit.length < 2) continue;
  const encoded = tabSplit[1];
  if (!/^(%u[0-9A-Fa-f]{4})+$/.test(encoded)) {
    skippedNonEncoded++;
    continue;
  }
  const word = decodeHeadword(encoded).normalize('NFC');
  const charCount = [...word].length;
  if (charCount === 1) {
    singleChar++;
  } else if (charCount === 2) {
    bigrams.add(word);
    multiChar++;
  } else {
    multiChar++;
  }
}

// 排序 (sort 一下,讓 diff 比較穩定)
const sorted = [...bigrams].sort();
writeFileSync(OUT, sorted.join('\n') + '\n', 'utf-8');

console.log(`\n=== 來源統計 (簡編本 c.txt) ===`);
console.log(`  總詞條數         ${total.toLocaleString()}`);
console.log(`  跳過 (特殊組合字) ${skippedNonEncoded.toLocaleString()}`);
console.log(`  單字詞條         ${singleChar.toLocaleString()}`);
console.log(`  多字詞條         ${multiChar.toLocaleString()}`);
console.log(`\n=== 輸出 ===`);
console.log(`  ${OUT}`);
console.log(`  雙字詞 (unique): ${bigrams.size.toLocaleString()}`);
console.log(`\n  前 10 個範例:`);
for (const w of sorted.slice(0, 10)) console.log(`    ${w}`);
