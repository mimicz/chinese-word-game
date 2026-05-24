#!/usr/bin/env node
// 把 schema/seeds-json/<type>-<difficulty>.json 轉成 schema/seeds/<...>.sql
// 用法:  node scripts/json-to-sql.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const SRC_DIR = join(ROOT, 'schema', 'seeds-json');
const OUT_DIR = join(ROOT, 'schema', 'seeds');
const DICT_PATH = join(ROOT, 'schema', 'dict', 'bigram.txt');

// 載入辭典作為 zizhu 題目的硬驗證 (若 dict 不存在,跳過此檢查 — 例如老 jiangcuo seed 流程)
let BIGRAM_SET = null;
function loadBigrams() {
  if (BIGRAM_SET !== null) return BIGRAM_SET;
  if (!existsSync(DICT_PATH)) { BIGRAM_SET = new Set(); return BIGRAM_SET; }
  const text = readFileSync(DICT_PATH, 'utf-8').normalize('NFC');
  BIGRAM_SET = new Set(text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0));
  return BIGRAM_SET;
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const FILES = readdirSync(SRC_DIR).filter(f => f.endsWith('.json'));

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

function parseName(filename) {
  // e.g. jiangcuo-elementary.json → { type, difficulty }
  const m = filename.match(/^(jiangcuo|zizhu)-(elementary|middle)\.json$/);
  if (!m) throw new Error(`bad filename: ${filename}`);
  return { type: m[1], difficulty: m[2] };
}

function validate(type, payload, idx) {
  if (type === 'jiangcuo') {
    if (!payload.correct || !payload.wrong || !payload.explanation) {
      throw new Error(`#${idx} jiangcuo missing fields: ${JSON.stringify(payload)}`);
    }
    if (payload.correct === payload.wrong) {
      throw new Error(`#${idx} jiangcuo correct == wrong: ${payload.correct}`);
    }
  } else if (type === 'zizhu') {
    if (!Array.isArray(payload.hints) || payload.hints.length !== 3) {
      throw new Error(`#${idx} zizhu hints must be 3 chars`);
    }
    if (!payload.answer || [...payload.answer].length !== 1) {
      throw new Error(`#${idx} zizhu answer must be 1 char`);
    }
    if (!['prefix', 'suffix'].includes(payload.position)) {
      throw new Error(`#${idx} zizhu position must be prefix|suffix`);
    }
    if (!payload.explanation) {
      throw new Error(`#${idx} zizhu missing explanation`);
    }
    if (payload.hints.some(h => [...h].length !== 1)) {
      throw new Error(`#${idx} zizhu each hint must be single char: ${JSON.stringify(payload.hints)}`);
    }
    // 答案不應出現在 hints 裡
    if (payload.hints.includes(payload.answer)) {
      throw new Error(`#${idx} zizhu answer is in hints: ${payload.answer}`);
    }
    // hint 不能重複
    if (new Set(payload.hints).size !== payload.hints.length) {
      throw new Error(`#${idx} zizhu hints have duplicates: ${JSON.stringify(payload.hints)}`);
    }
    // 辭典硬驗證:每組 hint+answer 必須是 bigram.txt 內的雙字詞
    const bigrams = loadBigrams();
    if (bigrams.size > 0) {
      for (const h of payload.hints) {
        const word = payload.position === 'prefix' ? payload.answer + h : h + payload.answer;
        if (!bigrams.has(word)) {
          throw new Error(`#${idx} zizhu word not in dictionary: "${word}" (answer=${payload.answer}, hint=${h}, position=${payload.position})`);
        }
      }
    }
  }
}

let totalWritten = 0;
for (const f of FILES) {
  const { type, difficulty } = parseName(f);
  const data = JSON.parse(readFileSync(join(SRC_DIR, f), 'utf-8'));
  if (!Array.isArray(data)) throw new Error(`${f} should be a JSON array`);

  const lines = [];
  lines.push(`-- ${f} — ${data.length} 題`);
  lines.push(`-- type: ${type}, difficulty: ${difficulty}`);
  // 不用 BEGIN TRANSACTION / COMMIT — D1 不支援,wrangler d1 execute 自己會包 transaction
  for (let i = 0; i < data.length; i++) {
    validate(type, data[i], i + 1);
    const payload = sqlEscape(JSON.stringify(data[i]));
    lines.push(`INSERT INTO questions (type, difficulty, payload) VALUES ('${type}', '${difficulty}', '${payload}');`);
  }
  const out = join(OUT_DIR, f.replace(/\.json$/, '.sql'));
  writeFileSync(out, lines.join('\n') + '\n', 'utf-8');
  console.log(`✓ ${out}  (${data.length} 題)`);
  totalWritten += data.length;
}
console.log(`\n總共輸出 ${totalWritten} 題到 ${OUT_DIR}`);
