#!/usr/bin/env node
// 把 schema/seeds-json/zizhu-*.json 從 4 提示縮成 3 提示
// 策略:
//   1. 解析 explanation 中標 (註) / (註:罕) 的字 → 視為「弱 hint」優先丟掉
//   2. 弱 hint 數 ≥ 1 → 丟掉最後一個弱 hint;其餘 hint 保留(維持原順序)
//   3. 沒有弱 hint → 直接砍最後一個
//   4. 重寫 explanation 為「可組成:詞1、詞2、詞3。」
//
// 用法:  node scripts/zizhu-4to3.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const SRC = join(ROOT, 'schema', 'seeds-json');

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function makeWord(answer, position, hint) {
  return position === 'prefix' ? answer + hint : hint + answer;
}

function transform(q) {
  if (!Array.isArray(q.hints)) return q;
  if (q.hints.length === 3) return q; // 已是 3 提示
  if (q.hints.length < 3) {
    console.warn(`  ⚠ 提示少於 3:${JSON.stringify(q)}`);
    return q;
  }

  const expl = q.explanation || '';
  // 哪些 hint 在 explanation 裡被標 (註...)
  const weak = new Set();
  for (const h of q.hints) {
    const w = makeWord(q.answer, q.position, h);
    const re = new RegExp(escapeRegex(w) + '\\(註');
    if (re.test(expl)) weak.add(h);
  }

  // 從尾巴往前刪:優先刪 weak,刪到剩 3
  const hints = [...q.hints];
  while (hints.length > 3) {
    let removeIdx = -1;
    for (let i = hints.length - 1; i >= 0; i--) {
      if (weak.has(hints[i])) { removeIdx = i; break; }
    }
    if (removeIdx === -1) removeIdx = hints.length - 1;
    hints.splice(removeIdx, 1);
  }

  const newExpl = '可組成:' + hints.map(h => makeWord(q.answer, q.position, h)).join('、') + '。';

  return { ...q, hints, explanation: newExpl };
}

for (const fname of ['zizhu-elementary.json', 'zizhu-middle.json']) {
  const path = join(SRC, fname);
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  let weakDropped = 0;
  const out = data.map(q => {
    const had4 = Array.isArray(q.hints) && q.hints.length === 4;
    const t = transform(q);
    if (had4 && /\(註/.test(q.explanation || '')) weakDropped++;
    return t;
  });
  // 去重 (sortedHints + answer 為 key)
  const seen = new Map();
  const deduped = [];
  for (const q of out) {
    const key = `${q.answer}|${[...q.hints].sort().join('')}`;
    if (seen.has(key)) continue;
    seen.set(key, true);
    deduped.push(q);
  }
  writeFileSync(path, JSON.stringify(deduped, null, 2) + '\n', 'utf-8');
  console.log(`✓ ${fname}: ${data.length} → ${deduped.length} (含 (註) 而優先刪除: ${weakDropped})`);
}
