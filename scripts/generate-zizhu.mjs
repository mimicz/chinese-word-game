#!/usr/bin/env node
// 字字珠璣題目生成器 (bigram 辭典基底 + LLM 語意多樣性 rerank)
//
// 兩階段:
//   1. --enumerate   只跑啟發式,輸出候選 (top-N per char)
//   2. --rerank      用 Anthropic Batches API 篩選最終題目
//   3. --collect     抓 batch 結果整合成 zizhu-{elementary,middle}.json
//
// 用法:
//   node scripts/generate-zizhu.mjs --enumerate --difficulty middle
//   node scripts/generate-zizhu.mjs --enumerate --difficulty middle --chars 華,山,目
//   node scripts/generate-zizhu.mjs --rerank --difficulty middle
//   node scripts/generate-zizhu.mjs --collect --difficulty middle
//   node scripts/generate-zizhu.mjs --collect --difficulty middle --batch-id msgbatch_xxx

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadBigramIndex, hintsOf } from './build-bigram-index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const DICT_DIR = join(ROOT, 'schema', 'dict');
const SEEDS_JSON = join(ROOT, 'schema', 'seeds-json');
const CANDIDATES_DIR = join(DICT_DIR, '.candidates');
const RERANK_CACHE = join(DICT_DIR, '.rerank-cache.json');
const BATCH_STATE = join(DICT_DIR, '.batch-state.json');
const DEFS_PATH = join(DICT_DIR, '.cache', 'concised-defs.json');

let _defs = null;
function loadDefs() {
  if (_defs !== null) return _defs;
  if (!existsSync(DEFS_PATH)) {
    console.warn(`(warn) 找不到 ${DEFS_PATH},LLM 提示與 collect 不會帶釋義`);
    console.warn(`        建議先執行: node scripts/build-concised-defs.mjs`);
    _defs = {};
    return _defs;
  }
  _defs = JSON.parse(readFileSync(DEFS_PATH, 'utf-8'));
  return _defs;
}

if (!existsSync(CANDIDATES_DIR)) mkdirSync(CANDIDATES_DIR, { recursive: true });

const MODEL = 'claude-opus-4-7';

// === args ===
const args = process.argv.slice(2);
const mode = ['--enumerate', '--rerank', '--collect'].find(m => args.includes(m));
if (!mode) {
  console.error('usage: --enumerate | --rerank | --collect');
  process.exit(1);
}
function argVal(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const difficulty = argVal('--difficulty') || 'middle';
if (!['elementary', 'middle'].includes(difficulty)) {
  console.error('--difficulty must be elementary | middle'); process.exit(1);
}
const onlyChars = argVal('--chars')?.split(',').filter(Boolean);
const forceBatchId = argVal('--batch-id');

// === 設定 ===
const TOP_K_PER_CHAR = 12;      // 啟發式留 top-K tuple 給 LLM rerank
const HINT_POOL_SIZE = 60;      // 取每字頻 top-N 的 hint 進入組合枚舉 (擴大涵蓋率)
const MIN_HINT_FREQ = 10;       // hint 字至少要在 N 個 bigram 中出現過 (常用門檻)
const ACCEPT_DIVERSITY = 8;     // 嚴格篩:要求語意多樣性 ≥ 8
const ACCEPT_COMMONNESS = 8;    // 嚴格篩:要求常用度 ≥ 8
const MAX_QUESTIONS_PER_CHAR = 2;

// 地名/人名/外來語常見字 — 預先剃掉避免雜訊
const STOPLIST_CHARS = new Set([
  // 地名行政
  '縣','市','鎮','鄉','區','州','省','洲','街','巷','弄','里','村',
  // 量詞 / 助詞 / 文言虛詞
  '兮','乎','哉','耶','焉','矣','也','而','之','於','於',
  // 西洋音譯常用字
  '茲','諾','斯','拉','爾','拜','薩','札','倫','契','瑟','邁','韋','弗','謨','蓋','薇',
  // 罕用偏旁
  '甎','瓅','璗','奾','姞','婔','婐','嫪','嫷','嫮','嬇','婞','嬕','妁','妏','妢','姌','姎'
]);

function loadCharFreq() {
  // hint 字頻代理: 該字在 bigram dict 中出現的總次數 (prefix + suffix)
  const { prefixIndex, suffixIndex } = loadBigramIndex();
  const freq = new Map();
  for (const [c, set] of prefixIndex) freq.set(c, (freq.get(c) || 0) + set.size);
  for (const [c, set] of suffixIndex) freq.set(c, (freq.get(c) || 0) + set.size);
  return freq;
}

function loadAnswerSeeds(diff) {
  const path = join(DICT_DIR, `answer-seeds-${diff}.txt`);
  if (!existsSync(path)) {
    console.error(`找不到 ${path}`); process.exit(1);
  }
  const lines = readFileSync(path, 'utf-8').normalize('NFC').split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const raw of lines) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [ch, posTag] = line.split(/\s+/);
    if ([...ch].length !== 1) continue;
    if (seen.has(ch)) continue;
    seen.add(ch);
    const positions = posTag === 'prefix' ? ['prefix']
                    : posTag === 'suffix' ? ['suffix']
                    : ['prefix', 'suffix'];
    out.push({ ch, positions });
  }
  return out;
}

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...rest] = arr;
  const withHead = combinations(rest, k - 1).map(c => [head, ...c]);
  const withoutHead = combinations(rest, k);
  return [...withHead, ...withoutHead];
}

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeWord(answer, position, hint) {
  return position === 'prefix' ? answer + hint : hint + answer;
}

function scoreTuple({ hints, answer, position, charFreq }) {
  // 簡單啟發式:hint 字頻越高分越高;hint 字互不相同(已在生成時保證);總和為主分數
  const freqSum = hints.reduce((s, h) => s + (charFreq.get(h) || 0), 0);
  // 罕用字懲罰
  const rarePenalty = hints.some(h => (charFreq.get(h) || 0) < MIN_HINT_FREQ) ? -1000 : 0;
  return freqSum + rarePenalty;
}

// === Phase 1: enumerate ===

function enumerateForChar(ch, position, charFreq) {
  const allHints = hintsOf(ch, position);
  // 過濾:不能等於 answer、不在 stoplist、字頻達門檻
  const filtered = allHints.filter(h =>
    h !== ch &&
    !STOPLIST_CHARS.has(h) &&
    (charFreq.get(h) || 0) >= MIN_HINT_FREQ
  );
  if (filtered.length < 3) return [];

  // 取每個 hint 字頻 top-N 後再列舉,避免組合爆炸
  const sortedByFreq = filtered.sort((a, b) =>
    (charFreq.get(b) || 0) - (charFreq.get(a) || 0)
  );
  const pool = sortedByFreq.slice(0, HINT_POOL_SIZE);

  const tuples = combinations(pool, 3).map(hints => ({
    hints,
    answer: ch,
    position,
    score: 0,
  }));
  for (const t of tuples) t.score = scoreTuple({ ...t, charFreq });
  tuples.sort((a, b) => b.score - a.score);

  // === Diverse top-K:同 shortlist 內每對 tuple 重疊 hint 不超過 1 個 ===
  // 嚴格限制 hint 重複:每個 hint 最多在 shortlist 中出現 3 次
  // 這樣 12 tuple × 3 hint = 36 slot,確保至少 12 個不同 hint
  const result = [];
  const hintUsage = new Map();
  const maxUsage = 3;

  for (const t of tuples) {
    if (result.length >= TOP_K_PER_CHAR) break;
    // 規則 1:跟既選 tuple 共用 hint 不能 ≥ 2 個
    const tooSimilar = result.some(r =>
      r.hints.filter(h => t.hints.includes(h)).length >= 2
    );
    if (tooSimilar) continue;
    // 規則 2:單一 hint 字在 shortlist 中至多出現 maxUsage 次
    if (t.hints.some(h => (hintUsage.get(h) || 0) >= maxUsage)) continue;
    result.push(t);
    for (const h of t.hints) hintUsage.set(h, (hintUsage.get(h) || 0) + 1);
  }
  return result;
}

function runEnumerate() {
  const charFreq = loadCharFreq();
  const seeds = loadAnswerSeeds(difficulty);
  const filterChars = onlyChars ? new Set(onlyChars) : null;

  const all = [];
  for (const { ch, positions } of seeds) {
    if (filterChars && !filterChars.has(ch)) continue;
    for (const position of positions) {
      const tuples = enumerateForChar(ch, position, charFreq);
      if (tuples.length === 0) continue;
      all.push({ ch, position, tuples });
    }
  }

  const outPath = join(CANDIDATES_DIR, `${difficulty}.json`);
  writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(`✓ 寫入 ${outPath}`);
  console.log(`  ${all.length} (char × position) 組,共 ${all.reduce((s,x)=>s+x.tuples.length,0)} 個候選 tuple`);

  // 顯示 5 筆樣本
  console.log('\n--- 樣本 (前 5) ---');
  for (const g of all.slice(0, 5)) {
    console.log(`【${g.ch} × ${g.position}】`);
    for (const t of g.tuples.slice(0, 4)) {
      const words = t.hints.map(h => makeWord(g.ch, g.position, h)).join('、');
      console.log(`  ${words}  (score=${t.score})`);
    }
  }
}

// === Phase 2: rerank via Anthropic Batches API ===

function loadCache() {
  if (!existsSync(RERANK_CACHE)) return {};
  return JSON.parse(readFileSync(RERANK_CACHE, 'utf-8'));
}
function saveCache(c) {
  writeFileSync(RERANK_CACHE, JSON.stringify(c, null, 2));
}

function buildPrompt(ch, position, tuples) {
  const defs = loadDefs();
  const tupleList = tuples.map((t, i) => {
    const words = t.hints.map(h => makeWord(ch, position, h));
    const wordsStr = words.join('、');
    const defLines = words.map(w => {
      const d = defs[w];
      return d ? `      - ${w}:${d}` : `      - ${w}:(辭典查無釋義)`;
    }).join('\n');
    return `${i}: ${wordsStr}\n${defLines}`;
  }).join('\n');

  const example = position === 'suffix'
    ? '繁華、中華、華麗 → 華 (繁華=繁盛、中華=中國、華麗=華美) → diversity=9'
    : '火山、靠山、江山 → 山 (火山=地理、靠山=比喻、江山=國土) → diversity=9';

  return `你是中文題目品質審查員,要為「字字珠璣」(共通字) 題目評分。

每組「字字珠璣」題目給玩家 3 個提示詞,共通字 1 個。良好題目的特徵:
1. **commonness**: 3 個詞都是台灣母語者熟悉的辭典詞 (不是冷僻、不是專名地名人名)
2. **diversity**: 共通字在 3 個詞中盡量表達不同意思/語法角色,例如:
   ${example}

下方每組附上教育部《國語辭典簡編本》的官方釋義 — 請依釋義判斷 diversity (3 個釋義在語意上是否區分明顯),依詞本身判斷 commonness。

答案為「${ch}」、位置為「${position === 'prefix' ? '前綴 (' + ch + '_)' : '後綴 (_' + ch + ')'}」的 ${tuples.length} 組候選詞:

${tupleList}

請對每組打分,只回 JSON,不要 markdown 圍欄:
{"results":[{"idx":0,"commonness":0-10,"diversity":0-10,"rationale":"一句話"}, ...]}`;
}

function tuplesCacheKey(ch, position, tuples) {
  const sig = tuples.map(t => t.hints.slice().sort().join('')).sort().join('|');
  return createHash('sha256').update(`${ch}|${position}|${sig}`).digest('hex');
}

async function runRerank() {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.error('需要 ANTHROPIC_API_KEY 環境變數'); process.exit(1);
  }
  const candidatesPath = join(CANDIDATES_DIR, `${difficulty}.json`);
  if (!existsSync(candidatesPath)) {
    console.error(`找不到 ${candidatesPath},請先跑 --enumerate`); process.exit(1);
  }
  const groups = JSON.parse(readFileSync(candidatesPath, 'utf-8'));
  const cache = loadCache();

  // 哪些尚未在 cache 裡的 → 進 batch
  const requests = [];
  const requestMeta = []; // 對應 custom_id

  for (const g of groups) {
    const key = tuplesCacheKey(g.ch, g.position, g.tuples);
    if (cache[key]) continue;
    // custom_id 必須符合 ^[a-zA-Z0-9_-]{1,64}$ (不能含中文)
    const customId = `${g.position}-${key.slice(0, 32)}`;
    requestMeta.push({ customId, key, group: g });
    requests.push({
      custom_id: customId,
      params: {
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt(g.ch, g.position, g.tuples) }],
      },
    });
  }

  console.log(`快取中已有 ${groups.length - requests.length} 個 group;需送 batch: ${requests.length} 個 request`);

  if (requests.length === 0) {
    console.log('全部已在快取,直接執行 --collect');
    return;
  }

  // 提交 Message Batches API
  console.log('→ 提交 Anthropic Message Batches...');
  const res = await fetch('https://api.anthropic.com/v1/messages/batches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    console.error('Batches API error:', res.status, await res.text()); process.exit(1);
  }
  const data = await res.json();
  console.log(`✓ batch_id = ${data.id}`);
  console.log(`  status = ${data.processing_status}`);

  writeFileSync(BATCH_STATE, JSON.stringify({
    batchId: data.id,
    difficulty,
    submittedAt: new Date().toISOString(),
    requestMeta,
  }, null, 2));
  console.log(`✓ batch state 寫入 ${BATCH_STATE}`);
  console.log(`\n稍後執行 \`node scripts/generate-zizhu.mjs --collect --difficulty ${difficulty}\` 來抓結果。`);
}

// === Phase 3: collect ===

async function runCollect() {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const candidatesPath = join(CANDIDATES_DIR, `${difficulty}.json`);
  const groups = JSON.parse(readFileSync(candidatesPath, 'utf-8'));
  const cache = loadCache();

  let batchId = forceBatchId;
  let requestMeta = null;
  // 優先用 .batch-state.<difficulty>.json,若無則 fallback 到 .batch-state.json
  const perDiffState = join(DICT_DIR, `.batch-state.${difficulty}.json`);
  const stateFile = existsSync(perDiffState) ? perDiffState : BATCH_STATE;
  if (existsSync(stateFile)) {
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    if (state.difficulty !== difficulty) {
      if (!batchId) {
        console.error(`state file ${stateFile} 是 ${state.difficulty},不是 ${difficulty}`); process.exit(1);
      }
    } else {
      if (!batchId) batchId = state.batchId;
      requestMeta = state.requestMeta;
    }
  }

  // 抓 batch 結果
  if (batchId) {
    if (!ANTHROPIC_API_KEY) { console.error('需要 ANTHROPIC_API_KEY'); process.exit(1); }
    console.log(`→ 查 batch ${batchId} 狀態`);
    const statusRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    });
    const statusData = await statusRes.json();
    console.log(`  status: ${statusData.processing_status}`);
    if (statusData.processing_status !== 'ended') {
      console.log('batch 尚未完成,稍後再來。');
      console.log(`  counts:`, statusData.request_counts);
      return;
    }
    if (!statusData.results_url) {
      console.error('batch ended 但沒有 results_url'); console.error(statusData); process.exit(1);
    }
    console.log(`→ 下載結果 ${statusData.results_url}`);
    const resultsRes = await fetch(statusData.results_url, {
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    });
    const text = await resultsRes.text();
    // JSONL 一行一筆
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const meta = requestMeta?.find(m => m.customId === row.custom_id);
      if (!meta) continue;
      if (row.result?.type !== 'succeeded') {
        console.warn(`  跳過 ${row.custom_id}: ${row.result?.type}`);
        continue;
      }
      const content = row.result.message?.content?.[0]?.text || '';
      try {
        const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ''));
        cache[meta.key] = { ch: meta.group.ch, position: meta.group.position, tuples: meta.group.tuples, results: parsed.results };
      } catch (e) {
        console.warn(`  parse fail ${row.custom_id}:`, content.slice(0, 200));
      }
    }
    saveCache(cache);
    console.log(`✓ cache 更新,size = ${Object.keys(cache).length}`);
  }

  // 整合:從快取挑題,寫 JSON
  const finalQuestions = [];
  let charsAccepted = 0;
  let charsDropped = 0;
  for (const g of groups) {
    const key = tuplesCacheKey(g.ch, g.position, g.tuples);
    const entry = cache[key];
    if (!entry) { charsDropped++; continue; }
    const accepted = entry.results
      .filter(r => r.commonness >= ACCEPT_COMMONNESS && r.diversity >= ACCEPT_DIVERSITY)
      .sort((a, b) => b.diversity - a.diversity)
      .slice(0, MAX_QUESTIONS_PER_CHAR);
    if (accepted.length === 0) { charsDropped++; continue; }
    charsAccepted++;
    const defs = loadDefs();
    for (const r of accepted) {
      const t = g.tuples[r.idx];
      if (!t) continue;
      const words = t.hints.map(h => makeWord(g.ch, g.position, h));
      const definitions = {};
      for (const w of words) {
        if (defs[w]) definitions[w] = defs[w];
      }
      finalQuestions.push({
        hints: t.hints,
        answer: g.ch,
        position: g.position,
        explanation: `可組成:${words.join('、')}。`,
        ...(Object.keys(definitions).length > 0 ? { definitions } : {}),
        _diversity: r.diversity,
        _commonness: r.commonness,
        _rationale: r.rationale,
      });
    }
  }

  // 去重 (key = answer + sortedHints + position)
  const seen = new Set();
  const deduped = [];
  for (const q of finalQuestions) {
    const k = `${q.answer}|${[...q.hints].sort().join('')}|${q.position}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(q);
  }

  const outPath = join(SEEDS_JSON, `zizhu-${difficulty}.json`);
  // 把 LLM 評分跟 rationale 收進 _meta,留在 payload 中讓後台預覽可看
  const cleanQuestions = deduped.map(q => {
    const { _diversity, _commonness, _rationale, ...rest } = q;
    return {
      ...rest,
      _meta: { diversity: _diversity, commonness: _commonness, rationale: _rationale },
    };
  });
  writeFileSync(outPath, JSON.stringify(cleanQuestions, null, 2) + '\n');
  console.log(`✓ 寫入 ${outPath}: ${cleanQuestions.length} 題`);
  console.log(`  接受 char × position: ${charsAccepted};放棄: ${charsDropped}`);

  // meta 版本
  const metaPath = join(CANDIDATES_DIR, `${difficulty}-with-meta.json`);
  writeFileSync(metaPath, JSON.stringify(deduped, null, 2));
  console.log(`  meta 版本 (含 diversity/rationale): ${metaPath}`);
}

// === main ===

if (mode === '--enumerate') runEnumerate();
else if (mode === '--rerank') await runRerank();
else if (mode === '--collect') await runCollect();
