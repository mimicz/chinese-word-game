# 字字千金 — Chinese Word Game

> 仿台灣公視綜藝節目《一字千金》的陽春版中文文字挑戰 web app

[![Live Site](https://img.shields.io/badge/play-live-B91C1C?style=flat-square)](https://zi-zi-qian-jin.pages.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

## 🎮 立即試玩

👉 **<https://zi-zi-qian-jin.pages.dev>**

手機開站後選「加到主畫面」，可當原生 app 用、離線也能玩。

## 題型

### 📝 將錯糾錯（30 題）
給定兩個寫法，選出正確的成語/詞彙寫法。

> 「莫名其妙」vs「莫明其妙」？ → 答對：莫名其妙

### 🧩 字字珠璣（20 題）
給 4 個提示字，找出能與每一個分別組成常見詞彙的「共通字」。

> 視 / 影 / 燈 / 線 → 共通字「電」(電視、電影、電燈、電線)

## 玩法

- **關卡模式**：每關 10 題，每題 15 秒倒數，計分；挑戰高分
- **練習模式**：無計時、無壓力；答錯顯示正確答案與字源解釋

## 技術

純靜態 HTML + CSS + JS，零框架、零後端、零依賴（除 qrcode.js）。

- **PWA**：service worker 離線快取，手機可「加到主畫面」
- **QR Code 分享**：首頁掃碼直接給朋友
- **localStorage 最高分**
- **CSP / HSTS / X-Frame-Options** 等安全標頭全套用

## 專案結構

```
.
├── public/                ← 部署到 Cloudflare Pages 的內容
│   ├── index.html
│   ├── style.css
│   ├── app.js             ← 遊戲主邏輯
│   ├── register-sw.js     ← Service Worker 註冊
│   ├── sw.js              ← Service Worker（cache-first）
│   ├── manifest.json      ← PWA manifest
│   ├── qrcode.min.js      ← QR code 函式庫
│   ├── icon.svg/png       ← 圖示
│   ├── _headers           ← Cloudflare Pages 安全標頭設定
│   └── data/
│       ├── jiangcuo.js    ← 將錯糾錯題庫
│       └── zizhu.js       ← 字字珠璣題庫
├── deploy.sh              ← 一鍵部署到 Cloudflare Pages
├── setup-token.sh         ← 設定 Cloudflare API token
└── README.md
```

## 開發 / 在本機試玩

```bash
git clone https://github.com/mimicz/chinese-word-game.git
cd chinese-word-game/public

# 用任何靜態檔伺服器，例如：
python3 -m http.server 8000
# 或
npx serve .
```

然後開瀏覽器到 http://localhost:8000

## 部署到 Cloudflare Pages

```bash
# 一次性設定 API token
bash setup-token.sh    # 跟著提示貼上 Cloudflare API token

# 之後每次更新 code
./deploy.sh
```

### Cloudflare API token 需要的權限

建立 Custom Token（<https://dash.cloudflare.com/profile/api-tokens>）：

- **Permissions**：`Account > Cloudflare Pages > Edit`
- **Account Resources**：限定到你的帳號（不要 All accounts）
- **TTL**：建議 1 年

## 加題 / 改題

題庫是純 JS 物件，直接編輯 `public/data/` 下的檔案即可。

**將錯糾錯**（`jiangcuo.js`）：
```js
{
  correct: "正確寫法",
  wrong: "常見錯字",
  explanation: "字源/解釋"
}
```

**字字珠璣**（`zizhu.js`）：
```js
{
  hints: ["字1", "字2", "字3", "字4"],
  answer: "共通字",
  position: "prefix",       // 或 "suffix"
  explanation: "可組成的詞..."
}
```

改完跑 `./deploy.sh` 重新部署，**並將 `sw.js` 內的 `CACHE_VERSION` 自增**（否則使用者瀏覽器會繼續用舊 cache）。

## License

[MIT](LICENSE) — 你可以自由使用、修改、散布這個專案的程式碼。

## 致謝

- **公視《一字千金》節目** — 玩法靈感來源（本專案非官方、無關聯，純致敬作品）
- **教育部《重編國語辭典修訂本》** — 字義與寫法依據
- **[qrcodejs](https://github.com/davidshimjs/qrcodejs)** — QR code 產生（MIT License，© Sangmin Shim）
