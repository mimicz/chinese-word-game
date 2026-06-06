# 辭典資料來源

`bigram.txt` 為 **54,672 個繁體中文雙字詞**,擷取自:

- **教育部《國語辭典簡編本》** (dict.concised.moe.edu.tw)
- 透過 g0v 開源專案 [moedict-webkit](https://github.com/g0v/moedict-webkit) 的 `c.txt` 取得 (簡編本完整資料鏡像)

抽取程序見 `scripts/build-concised-bigram.mjs`。

本資料依教育部之公眾授權條款使用,僅作為遊戲題庫之語料基底,本專案不對辭典內容主張任何權利。

如需查詢權威詞義,請至:

- [教育部《國語辭典簡編本》](https://dict.concised.moe.edu.tw/)

## 備檔

- `bigram-revised.txt` — 舊版以《重編國語辭典 修訂本》為基底的 87,410 個雙字詞 (備存,生成器不再使用)
