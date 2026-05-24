#!/usr/bin/env node
// 用 Anthropic API 批次生成題目。
// 環境變數: ANTHROPIC_API_KEY
// 用法:
//   node scripts/generate-questions.mjs jiangcuo elementary 50
//   node scripts/generate-questions.mjs zizhu middle 50
//
// 輸出會 append 到 schema/seeds-json/<type>-<difficulty>.json
// 然後再執行 node scripts/json-to-sql.mjs 轉成 SQL

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const SRC_DIR = join(ROOT, 'schema', 'seeds-json');
if (!existsSync(SRC_DIR)) mkdirSync(SRC_DIR, { recursive: true });

const MODEL = 'claude-opus-4-7';
const API_URL = 'https://api.anthropic.com/v1/messages';

const [, , type, difficulty, countArg] = process.argv;
const count = parseInt(countArg || '50', 10);

if (!['jiangcuo', 'zizhu'].includes(type) || !['elementary', 'middle'].includes(difficulty)) {
  console.error('Usage: node scripts/generate-questions.mjs <jiangcuo|zizhu> <elementary|middle> <count>');
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('請設定 ANTHROPIC_API_KEY 環境變數');
  process.exit(1);
}

const PROMPTS = {
  'jiangcuo-elementary': `請生成 N 道中文「將錯糾錯」題目,目標讀者是台灣國小學生 (含以下年級)。每題給一組「正確 vs 常見錯字」的中文寫法二選一,並用淺顯白話解釋。
題目應涵蓋:
- 「的/得/地」、「再/在」、「做/作」等常見小學生混淆
- 同音字、形似字錯誤 (例:「座位」vs「坐位」)
- 簡單成語錯字 (例:「不可思議」、「興高采烈」)

請輸出純 JSON 陣列,不要 markdown 圍欄,每題格式:
{"correct":"正確寫法","wrong":"常見錯字寫法","explanation":"淺白解釋,80 字內"}`,

  'jiangcuo-middle': `請生成 N 道中文「將錯糾錯」題目,目標讀者是台灣國中以上學生與成人。每題給一組「正確 vs 常見錯字」的中文寫法二選一,並解釋字源/字義。
題目應涵蓋:
- 高頻成語錯字 (例:莫名其妙、再接再厲、川流不息、變本加厲、罄竹難書)
- 形似/同音字混淆 (例:斐然/裴然、矯枉過正/嬌枉過正)
- 文白用字差異 (例:不脛而走、披星戴月)

請輸出純 JSON 陣列,不要 markdown 圍欄,每題格式:
{"correct":"正確寫法","wrong":"常見錯字寫法","explanation":"字源/字義說明,120 字內"}`,

  'zizhu-elementary': `請生成 N 道中文「字字珠璣」(共通字) 題目,目標讀者是台灣國小學生。每題給一個共通字,以及 3 個提示字,共通字加上每個提示字都能組成一個常見的雙字詞。
要求:
- 共通字為「常用日常字」(例:水、火、大、學、家、心、車、花)
- 3 個詞都要是「國小生熟悉的」雙字詞 (例:水果、水手,而非水煮、水患)
- position: "prefix" 表示共通字在前 (電+視=電視);"suffix" 表示共通字在後 (中+國=中國)
- 共通字不可出現在 hints 中
- 解釋只列出可組成的 3 個詞,務求自然常用,避免冷僻

請輸出純 JSON 陣列,不要 markdown 圍欄,每題格式:
{"hints":["字1","字2","字3"],"answer":"共通字","position":"prefix" 或 "suffix","explanation":"可組成:詞1、詞2、詞3。"}`,

  'zizhu-middle': `請生成 N 道中文「字字珠璣」(共通字) 題目,目標讀者是台灣國中以上學生與成人。每題給一個共通字,以及 3 個提示字,共通字加上每個提示字都能組成一個雙字詞或固定搭配。
要求:
- 共通字可包含較抽象/文雅的常用字 (例:意、神、氣、雅、清、玄、襟、頌)
- 3 個詞要包含成語、雅語、書面用語為佳 (例:神+采=神采、神+往=神往)
- position: "prefix" 共通字在前;"suffix" 共通字在後
- 共通字不可出現在 hints 中
- 解釋只列出可組成的 3 個詞;3 詞都應是辭典可查、母語人會使用的搭配,不要硬湊

請輸出純 JSON 陣列,不要 markdown 圍欄,每題格式:
{"hints":["字1","字2","字3"],"answer":"共通字","position":"prefix" 或 "suffix","explanation":"可組成:詞1、詞2、詞3。"}`,
};

const key = `${type}-${difficulty}`;
const prompt = PROMPTS[key].replace('N', count);

console.log(`→ 向 ${MODEL} 請求 ${count} 題 ${key} ...`);

const res = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  }),
});

if (!res.ok) {
  console.error('API error', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const text = data.content?.[0]?.text || '';
const jsonMatch = text.match(/\[[\s\S]*\]/);
if (!jsonMatch) {
  console.error('未從回覆抓到 JSON 陣列');
  console.error(text);
  process.exit(1);
}

let generated;
try {
  generated = JSON.parse(jsonMatch[0]);
} catch (e) {
  console.error('JSON parse 失敗:', e.message);
  process.exit(1);
}

console.log(`✓ 收到 ${generated.length} 題`);

const outPath = join(SRC_DIR, `${key}.json`);
let existing = [];
if (existsSync(outPath)) {
  existing = JSON.parse(readFileSync(outPath, 'utf-8'));
}

// 去重:對 jiangcuo 看 correct,對 zizhu 看 answer+hints
const seen = new Set();
const dedupKey = (q) => type === 'jiangcuo' ? q.correct : `${q.answer}|${[...q.hints].sort().join('')}`;
for (const q of existing) seen.add(dedupKey(q));

let added = 0;
for (const q of generated) {
  const k = dedupKey(q);
  if (seen.has(k)) continue;
  seen.add(k);
  existing.push(q);
  added++;
}

writeFileSync(outPath, JSON.stringify(existing, null, 2), 'utf-8');
console.log(`✓ 新增 ${added} 題到 ${outPath} (現累計 ${existing.length} 題)`);
console.log(`下一步:node scripts/json-to-sql.mjs`);
