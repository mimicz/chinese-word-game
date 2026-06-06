# 字字千金 — Chinese Word Game

> 仿台灣公視綜藝節目《一字千金》的中文文字挑戰 web app — v2 加入後端、雙難度、全域排行榜

[![Live Site](https://img.shields.io/badge/play-live-B91C1C?style=flat-square)](https://zi-zi-qian-jin.pages.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

## 🎮 立即試玩

👉 **<https://zi-zi-qian-jin.pages.dev>**

手機開站後選「加到主畫面」,可當原生 app 用、離線也能玩 (使用備援題庫,但無排行榜)。

## 玩法特色

- **兩種題型 × 兩種難度** — 共四個獨立計分組合
- **免註冊暱稱** — 輸入暱稱即可上排行榜
- **全域排行榜 Top 50** — 每個 (題型 × 難度) 各有獨立榜單
- **每題答完可回報題目有誤** — 系統會送進管理後台等待校對
- **時限與計分**
  - 關卡模式總分滿分皆為 **100 分**;單題上限 = `100 / 每關題數`
  - 答對得分採剩餘時間線性計分:`round(剩餘時間 / 該題總時間 × 單題上限)`,答錯 / 超時 = 0 分
  - 將錯糾錯:每題 15 秒、每關 10 題 (單題滿分 10 分)
  - 字字珠璣:每關 5 題 (單題滿分 20 分)
    - 國小以下每題 1 分鐘
    - 國中以上每題 3 分鐘

## 題型

### 📝 將錯糾錯
給定兩個寫法,選出正確的成語/詞彙寫法。

- **國小以下** — 常見錯別字 (的/得/地、再/在、做/作)
- **國中以上** — 成語錯字 (莫名其妙、再接再厲、川流不息…)

### 🧩 字字珠璣
給 3 個提示字,找出能與每一個分別組成常見詞彙的「共通字」。

- **國小以下** — 生活常見共通字 (水、火、心、學…)
- **國中以上** — 抽象/文雅常用字 (神、意、氣、風、雅、清…),每題 3 分鐘深思

## 模式

- **關卡模式**:每關 10 題,計分;挑戰高分上排行榜
- **練習模式**:無計時、無壓力;答錯顯示正確答案與字源解釋

---

## 技術架構 (v2)

| 層 | 技術 |
|---|---|
| 前端 | 原生 HTML + CSS + JS (PWA) |
| 後端 | Cloudflare Pages Functions |
| 資料庫 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Pages (`./deploy.sh`) |

- **同 origin API** — CSP 不需要放寬
- **離線備援** — API 不通時退回本地題庫 (`public/data/*.js`,不上傳分數)
- **PWA / Service Worker** — 靜態資源 cache-first;`/api/*` 永遠 network-only

### 資料庫 schema

三張表:
- `questions` — 題庫 (type + difficulty + payload JSON + active flag)
- `scores` — 玩家分數
- `question_reports` — 玩家回報

詳見 `schema/0001_init.sql`。

### API 路由

| Method | Path | 用途 |
|---|---|---|
| GET  | `/api/questions?type=…&difficulty=…&count=10` | 隨機取題 |
| GET  | `/api/scores?type=…&difficulty=…&limit=50` | 排行榜 Top N |
| POST | `/api/scores` | 上傳分數,回傳排名 |
| POST | `/api/reports` | 玩家回報題目有誤 (rate-limit by IP hash) |
| POST | `/api/admin/login` | 後台登入 |
| GET  | `/api/admin/reports?status=pending` | 後台列出回報 |
| PATCH | `/api/admin/reports/:id` | 標記回報已處理 / 駁回 |
| PATCH | `/api/admin/questions/:id` | 下架題目 / 修改 payload |
| GET  | `/api/admin/stats` | 題庫總覽 |

---

## 專案結構

```
.
├── public/                    # Cloudflare Pages 部署內容
│   ├── index.html, app.js, style.css, api.js
│   ├── sw.js, register-sw.js, manifest.json
│   ├── qrcode.min.js, icon.svg/png
│   ├── data/                  # 離線備援題庫
│   ├── _headers               # 安全標頭
│   └── admin/                 # 管理後台 SPA
├── functions/                 # Cloudflare Pages Functions (後端)
│   ├── _shared.js
│   └── api/
│       ├── questions.js, scores.js, reports.js
│       └── admin/
│           ├── _middleware.js, login.js
│           ├── reports.js, reports/[id].js
│           ├── questions/[id].js, stats.js
├── schema/
│   ├── 0001_init.sql
│   ├── seeds-json/            # 題庫原始 JSON
│   └── seeds/                 # 由 json-to-sql 產生的 SQL
├── scripts/
│   ├── generate-questions.mjs # 用 Anthropic API 批次生 (選用)
│   ├── json-to-sql.mjs        # JSON → SQL
│   └── seed-d1.sh             # 灌資料到 D1
├── wrangler.toml              # D1 binding
└── deploy.sh
```

---

## 本機開發

```bash
# 1) 安裝 wrangler
npm install -g wrangler

# 2) 建立本機 D1
wrangler d1 create zzqj-db
# 把回傳的 database_id 填進 wrangler.toml

# 3) 灌入 schema + seed (本機)
./scripts/seed-d1.sh local

# 4) 啟動 Pages dev (含 Functions)
wrangler pages dev public

# 開 http://localhost:8788
```

## 部署到正式環境

```bash
# 灌正式 D1
./scripts/seed-d1.sh remote

# 設定後台密碼與 token 密鑰
wrangler pages secret put ADMIN_PASSWORD --project-name zi-zi-qian-jin
wrangler pages secret put ADMIN_TOKEN_SECRET --project-name zi-zi-qian-jin

# 部署
./deploy.sh
```

### 後台登入

`/admin` 路徑下提供密碼登入。Token 24 小時失效,儲存在 `sessionStorage`。

---

## 加題 / 改題

### 方式 1:從後台直接編輯
登入 `/admin` → 找到要改的題 → 點「✎ 編輯內容」貼上新 payload (JSON)。

### 方式 2:批次匯入

1. 編輯 `schema/seeds-json/<type>-<difficulty>.json`
2. `node scripts/json-to-sql.mjs` — 產生 `schema/seeds/*.sql`
3. `./scripts/seed-d1.sh remote` — 灌入 D1

題目 schema:

```jsonc
// jiangcuo (將錯糾錯)
{"correct":"正確寫法","wrong":"常見錯字","explanation":"解釋"}

// zizhu (字字珠璣)
{
  "hints":["字1","字2","字3"],
  "answer":"共通字",
  "position":"prefix",      // 或 "suffix"
  "explanation":"可組成的詞..."
}
```

### 方式 3:jiangcuo AI 自動生成

```bash
export ANTHROPIC_API_KEY='sk-ant-…'
node scripts/generate-questions.mjs jiangcuo middle 50
node scripts/json-to-sql.mjs
./scripts/seed-d1.sh remote
```

每次生成會 append 到既有 JSON 並去重。

### 方式 4:zizhu 辭典基底生成

zizhu (字字珠璣) 題目改採辭典基底 + LLM 語意篩選的管線:

```bash
# 1. 列舉候選 (從 54,672 個辭典雙字詞)
node scripts/generate-zizhu.mjs --enumerate --difficulty middle

# 2. 提交 LLM rerank (Anthropic Message Batches API,~$5-8)
export ANTHROPIC_API_KEY='sk-ant-…'
node scripts/generate-zizhu.mjs --rerank --difficulty middle

# 3. 等 batch 完成後 collect 結果
node scripts/generate-zizhu.mjs --collect --difficulty middle

# 4. 抽樣校對
node scripts/preview-zizhu.mjs --with-meta --n 20

# 5. 灌 D1 (FK-safe:軟刪舊的 + insert 新的)
node scripts/json-to-sql.mjs    # 含辭典硬驗證,每組詞必須存在於 bigram.txt
./scripts/reseed-zizhu.sh remote
```

辭典在 `schema/dict/bigram.txt`(來自教育部《國語辭典簡編本》, 54,672 個雙字詞,
透過 `scripts/build-concised-bigram.mjs` 從 g0v moedict-webkit 的 c.txt 抽取),
候選字清單在 `schema/dict/answer-seeds-{elementary,middle}.txt`。

---

## 題庫現況

| 題型 | 國小以下 | 國中以上 |
|---|---|---|
| 將錯糾錯 | 227 題 | 225 題 |
| 字字珠璣 | 49 題  | 96 題  |

**共 597 題** (透過 admin 頁可繼續擴充或下架)。

字字珠璣題庫以教育部《國語辭典簡編本》54,672 個雙字詞為基底,經 LLM 篩選只留下「共通字在 3 詞中意義不同」且 3 詞皆常用的高品質題目 — 寧缺勿濫。

---

## 加題 / 改題完成後

⚠️ 修改 `public/` 內任何檔案後,需 `./deploy.sh`。
⚠️ 修改 `sw.js` 或 `app.js` 等前端資源後,要**手動 bump `sw.js` 內的 `CACHE_VERSION`**,否則使用者瀏覽器繼續用舊 cache。

---

## License

[MIT](LICENSE) — 你可以自由使用、修改、散布這個專案的程式碼。

## 致謝

- **公視《一字千金》節目** — 玩法靈感來源 (本專案非官方、無關聯,純致敬作品)
- **教育部《國語辭典簡編本》** — 字字珠璣題庫的雙字詞基底
- **[qrcodejs](https://github.com/davidshimjs/qrcodejs)** — QR code 產生 (MIT License,© Sangmin Shim)
