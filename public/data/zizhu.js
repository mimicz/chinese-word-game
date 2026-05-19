// 字字珠璣題庫 — 20 題共通字題目
// 資料格式：
//   hints: 4 個提示字
//   answer: 共通字
//   position: "prefix"（共通字在前，如 電+視=電視）
//             "suffix"（共通字在後，如 中+國=中國）
//   explanation: 解釋（列出可組成的詞）
window.ZIZHU_QUESTIONS = [
  // === 前綴：共通字 + 提示字 ===
  {
    hints: ["視", "影", "燈", "線"],
    answer: "電",
    position: "prefix",
    explanation: "可組成：電視、電影、電燈、電線。"
  },
  {
    hints: ["庭", "長", "教", "鄉"],
    answer: "家",
    position: "prefix",
    explanation: "可組成：家庭、家長、家教、家鄉。"
  },
  {
    hints: ["校", "生", "習", "費"],
    answer: "學",
    position: "prefix",
    explanation: "可組成:學校、學生、學習、學費。"
  },
  {
    hints: ["司", "車", "園", "平"],
    answer: "公",
    position: "prefix",
    explanation: "可組成：公司、公車、公園、公平。"
  },
  {
    hints: ["果", "手", "管", "晶"],
    answer: "水",
    position: "prefix",
    explanation: "可組成：水果、水手、水管、水晶。"
  },
  {
    hints: ["車", "山", "災", "花"],
    answer: "火",
    position: "prefix",
    explanation: "可組成：火車、火山、火災、火花。"
  },
  {
    hints: ["情", "意", "思", "願"],
    answer: "心",
    position: "prefix",
    explanation: "可組成：心情、心意、心思、心願。"
  },
  {
    hints: ["學", "家", "海", "地"],
    answer: "大",
    position: "prefix",
    explanation: "可組成：大學、大家、大海、大地。"
  },
  {
    hints: ["興", "山", "手", "樓"],
    answer: "高",
    position: "prefix",
    explanation: "可組成：高興、高山、高手、高樓。"
  },
  {
    hints: ["洋", "岸", "邊", "灘"],
    answer: "海",
    position: "prefix",
    explanation: "可組成：海洋、海岸、海邊、海灘。"
  },
  {
    hints: ["景", "光", "雨", "格"],
    answer: "風",
    position: "prefix",
    explanation: "可組成：風景、風光、風雨、風格。"
  },
  {
    hints: ["園", "瓶", "草", "朵"],
    answer: "花",
    position: "prefix",
    explanation: "可組成：花園、花瓶、花草、花朵。"
  },

  // === 後綴：提示字 + 共通字 ===
  {
    hints: ["中", "美", "英", "法"],
    answer: "國",
    position: "suffix",
    explanation: "可組成：中國、美國、英國、法國。"
  },
  {
    hints: ["朋", "親", "女", "男"],
    answer: "友",
    position: "suffix",
    explanation: "可組成：朋友、親友、女友、男友。"
  },
  {
    hints: ["球", "廣", "市", "農"],
    answer: "場",
    position: "suffix",
    explanation: "可組成：球場、廣場、市場、農場。"
  },
  {
    hints: ["馬", "走", "道", "迷"],
    answer: "路",
    position: "suffix",
    explanation: "可組成：馬路、走路、道路、迷路。"
  },
  {
    hints: ["教", "臥", "浴", "暗"],
    answer: "室",
    position: "suffix",
    explanation: "可組成：教室、臥室、浴室、暗室。"
  },
  {
    hints: ["兒", "孩", "女", "男"],
    answer: "子",
    position: "suffix",
    explanation: "可組成：兒子、孩子、女子、男子。"
  },
  {
    hints: ["念", "讀", "看", "古"],
    answer: "書",
    position: "suffix",
    explanation: "可組成：念書、讀書、看書、古書。"
  },
  {
    hints: ["高", "泰", "火", "玉"],
    answer: "山",
    position: "suffix",
    explanation: "可組成：高山、泰山、火山、玉山。"
  }
];
