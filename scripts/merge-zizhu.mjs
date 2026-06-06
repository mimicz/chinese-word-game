#!/usr/bin/env node
// Merge schema/seeds-json/zizhu-*.json (新 rerank 結果)
// 與 schema/seeds-json/zizhu-*.json.before-rerank (舊題備份),
// 去重後寫回 zizhu-*.json。
//
// 去重 key: answer + sorted(hints).join + position
// 衝突時:新版優先 (因為新 prompt 帶釋義,評分更可信)
//
// 用法:
//   node scripts/merge-zizhu.mjs              # 套用 merge
//   node scripts/merge-zizhu.mjs --dry-run    # 只報告

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const SEEDS_DIR = join(ROOT, 'schema', 'seeds-json');

const DRY_RUN = process.argv.includes('--dry-run');

const FILES = ['zizhu-elementary.json', 'zizhu-middle.json'];

function keyOf(q) {
  return `${q.answer}|${[...q.hints].sort().join('')}|${q.position}`;
}

for (const f of FILES) {
  const curPath = join(SEEDS_DIR, f);
  const backupPath = curPath + '.before-rerank';
  if (!existsSync(backupPath)) {
    console.error(`找不到 ${backupPath} — 跳過 ${f} (是不是還沒備份就重跑了?)`);
    continue;
  }
  const newer = JSON.parse(readFileSync(curPath, 'utf-8'));
  const older = JSON.parse(readFileSync(backupPath, 'utf-8'));

  const byKey = new Map();
  // 先放舊題
  for (const q of older) byKey.set(keyOf(q), { q, source: 'old' });
  // 新題覆蓋
  let newAdded = 0, replaced = 0;
  for (const q of newer) {
    const k = keyOf(q);
    if (byKey.has(k)) replaced++;
    else newAdded++;
    byKey.set(k, { q, source: 'new' });
  }

  const merged = [...byKey.values()].map(e => e.q);

  console.log(`${f}`);
  console.log(`  舊題       ${older.length}`);
  console.log(`  新題       ${newer.length}`);
  console.log(`  重疊 (新覆蓋舊) ${replaced}`);
  console.log(`  新增       ${newAdded}`);
  console.log(`  Merge 後   ${merged.length}`);
  console.log();

  if (!DRY_RUN) {
    writeFileSync(curPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    console.log(`  ✓ 寫回 ${curPath}`);
    console.log();
  }
}

if (DRY_RUN) console.log(`(--dry-run,未寫檔)`);
