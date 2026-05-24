// 字字珠璣題庫 — 20 題共通字題目 (離線備援用)
// 資料格式：
//   hints: 3 個提示字
//   answer: 共通字
//   position: "prefix"（共通字在前，如 電+視=電視）
//             "suffix"（共通字在後，如 中+國=中國）
//   explanation: 解釋（列出可組成的詞）
window.ZIZHU_QUESTIONS = [
  // === 前綴：共通字 + 提示字 ===
  { hints: ["視", "影", "燈"], answer: "電", position: "prefix", explanation: "可組成：電視、電影、電燈。" },
  { hints: ["庭", "長", "教"], answer: "家", position: "prefix", explanation: "可組成：家庭、家長、家教。" },
  { hints: ["校", "生", "習"], answer: "學", position: "prefix", explanation: "可組成：學校、學生、學習。" },
  { hints: ["司", "車", "園"], answer: "公", position: "prefix", explanation: "可組成：公司、公車、公園。" },
  { hints: ["果", "手", "管"], answer: "水", position: "prefix", explanation: "可組成：水果、水手、水管。" },
  { hints: ["車", "山", "災"], answer: "火", position: "prefix", explanation: "可組成：火車、火山、火災。" },
  { hints: ["情", "意", "願"], answer: "心", position: "prefix", explanation: "可組成：心情、心意、心願。" },
  { hints: ["學", "家", "海"], answer: "大", position: "prefix", explanation: "可組成：大學、大家、大海。" },
  { hints: ["興", "山", "手"], answer: "高", position: "prefix", explanation: "可組成：高興、高山、高手。" },
  { hints: ["洋", "岸", "邊"], answer: "海", position: "prefix", explanation: "可組成：海洋、海岸、海邊。" },
  { hints: ["景", "光", "雨"], answer: "風", position: "prefix", explanation: "可組成：風景、風光、風雨。" },
  { hints: ["園", "瓶", "朵"], answer: "花", position: "prefix", explanation: "可組成：花園、花瓶、花朵。" },

  // === 後綴：提示字 + 共通字 ===
  { hints: ["中", "美", "英"], answer: "國", position: "suffix", explanation: "可組成：中國、美國、英國。" },
  { hints: ["朋", "親", "男"], answer: "友", position: "suffix", explanation: "可組成：朋友、親友、男友。" },
  { hints: ["球", "廣", "市"], answer: "場", position: "suffix", explanation: "可組成：球場、廣場、市場。" },
  { hints: ["馬", "走", "道"], answer: "路", position: "suffix", explanation: "可組成：馬路、走路、道路。" },
  { hints: ["教", "臥", "浴"], answer: "室", position: "suffix", explanation: "可組成：教室、臥室、浴室。" },
  { hints: ["兒", "孩", "女"], answer: "子", position: "suffix", explanation: "可組成：兒子、孩子、女子。" },
  { hints: ["讀", "看", "古"], answer: "書", position: "suffix", explanation: "可組成：讀書、看書、古書。" },
  { hints: ["泰", "火", "玉"], answer: "山", position: "suffix", explanation: "可組成：泰山、火山、玉山。" }
];
