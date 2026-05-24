// 字字千金 — 前端 API wrapper
// 統一處理 fetch,離線時自動 fallback 到 window.JIANGCUO_QUESTIONS / ZIZHU_QUESTIONS

const API = {
  async fetchQuestions(type, difficulty, count = 10) {
    try {
      const res = await fetch(`/api/questions?type=${type}&difficulty=${difficulty}&count=${count}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'api error');
      if (!data.questions || data.questions.length === 0) {
        throw new Error('題庫尚未灌入');
      }
      return { online: true, questions: data.questions };
    } catch (e) {
      const fb = fallbackQuestions(type, count);
      return { online: false, questions: fb, error: e.message };
    }
  },

  async submitScore(payload) {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'submit failed');
    return data; // { rank, top }
  },

  async fetchLeaderboard(type, difficulty, limit = 50) {
    const res = await fetch(`/api/scores?type=${type}&difficulty=${difficulty}&limit=${limit}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'fetch failed');
    return data.top || [];
  },

  async reportQuestion(questionId, reason, nickname) {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, reason, nickname }),
    });
    const data = await res.json();
    if (res.status === 429) throw new Error('rate_limit');
    if (!data.ok) throw new Error(data.error || 'report failed');
    return data;
  },
};

// 離線 fallback:把 window 全域題庫包成 API 形式
// 注意:fallback 題目沒有 D1 id,不能上傳分數、不能回報
function fallbackQuestions(type, count) {
  const bank = type === 'jiangcuo' ? window.JIANGCUO_QUESTIONS : window.ZIZHU_QUESTIONS;
  if (!bank || bank.length === 0) return [];
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((payload, i) => ({
    id: null,             // 標記 offline
    type,
    difficulty: 'elementary',
    payload,
  }));
}

window.API = API;
