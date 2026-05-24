// === 字字千金 v2 — 主程式 ===

const LEVEL_QUESTION_COUNT = 10;
const SCORE_PER_CORRECT = 10;
const NICKNAME_KEY = 'zzqj_nickname';

function getTimePerQuestion(type, difficulty) {
  if (type === 'zizhu' && difficulty === 'middle') return 180; // 3 分鐘
  return 15;
}

const state = {
  nickname: null,
  mode: null,        // 'levels' | 'practice'
  type: null,        // 'jiangcuo' | 'zizhu'
  difficulty: null,  // 'elementary' | 'middle'
  timePerQuestion: 15,
  online: true,
  questions: [],
  currentIndex: 0,
  score: 0,
  correctCount: 0,
  wrongCount: 0,
  timer: null,
  timeLeft: 0,
  answered: false,
  // 排行榜 tab 當前選取
  lbType: 'jiangcuo',
  lbDiff: 'elementary',
};

// === 工具 ===
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const TYPE_LABEL = { jiangcuo: '將錯糾錯', zizhu: '字字珠璣' };
const DIFF_LABEL = { elementary: '國小以下', middle: '國中以上' };

// === 暱稱 ===
function getNickname() {
  return localStorage.getItem(NICKNAME_KEY) || null;
}
function setNickname(name) {
  localStorage.setItem(NICKNAME_KEY, name);
  state.nickname = name;
  renderNicknameBar();
}
function renderNicknameBar() {
  const el = document.getElementById('nickname-display');
  if (el) el.textContent = state.nickname || '尚未設定';
}

function bindNicknameModal() {
  const modal = document.getElementById('nickname-modal');
  const input = document.getElementById('nickname-input');
  const err = document.getElementById('nickname-error');
  const cancelBtn = document.getElementById('nickname-cancel');
  const saveBtn = document.getElementById('nickname-save');

  function open(allowCancel) {
    err.textContent = '';
    input.value = state.nickname || '';
    cancelBtn.hidden = !allowCancel;
    modal.hidden = false;
    setTimeout(() => input.focus(), 50);
  }
  function close() { modal.hidden = true; }

  saveBtn.addEventListener('click', () => {
    const v = (input.value || '').trim();
    if (!v) { err.textContent = '請輸入暱稱'; return; }
    if (v.length > 16) { err.textContent = '暱稱不能超過 16 字'; return; }
    setNickname(v);
    close();
    if (window._pendingStart) {
      const cb = window._pendingStart;
      window._pendingStart = null;
      cb();
    }
  });
  cancelBtn.addEventListener('click', close);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  document.getElementById('btn-edit-nickname').addEventListener('click', () => open(true));

  window.openNicknameModal = open;
}

function ensureNickname(onReady) {
  if (state.nickname) { onReady(); return; }
  window._pendingStart = onReady;
  window.openNicknameModal(false);
}

// === 排行榜 ===
async function loadLeaderboard(type, difficulty, targetElId) {
  const el = document.getElementById(targetElId);
  el.innerHTML = '<div class="lb-empty">載入中…</div>';
  try {
    const top = await API.fetchLeaderboard(type, difficulty, 50);
    if (!top || top.length === 0) {
      el.innerHTML = '<div class="lb-empty">還沒有人挑戰過 — 來當第一個吧!</div>';
      return;
    }
    el.innerHTML = top.map((row, i) => `
      <div class="lb-row${row.nickname === state.nickname ? ' lb-me' : ''}">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-name">${escapeHtml(row.nickname)}</span>
        <span class="lb-score">${row.score}<small> 分</small></span>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<div class="lb-empty">無法載入排行榜 (${escapeHtml(e.message)})</div>`;
  }
}

function bindHomeLeaderboard() {
  const tabs = document.querySelectorAll('.lb-tab');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      state.lbType = t.dataset.lbType;
      state.lbDiff = t.dataset.lbDiff;
      loadLeaderboard(state.lbType, state.lbDiff, 'lb-list');
    });
  });
  loadLeaderboard(state.lbType, state.lbDiff, 'lb-list');
}

// === 導覽 ===
function bindNav() {
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      ensureNickname(() => {
        state.mode = btn.dataset.mode;
        const subtitle = document.getElementById('type-subtitle');
        subtitle.textContent = state.mode === 'levels'
          ? '每關 10 題,挑戰高分 (國中珠璣每題 3 分鐘,其餘 15 秒)'
          : '無計時、無壓力,答錯顯示解釋';
        showScreen('screen-type');
      });
    });
  });

  document.querySelectorAll('[data-type][data-difficulty]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.type = btn.dataset.type;
      state.difficulty = btn.dataset.difficulty;
      state.timePerQuestion = getTimePerQuestion(state.type, state.difficulty);
      startGame();
    });
  });

  document.getElementById('btn-back-from-type').addEventListener('click', goHome);
  document.getElementById('btn-quit').addEventListener('click', () => {
    if (confirm('確定要退出本關嗎?')) {
      stopTimer();
      goHome();
    }
  });
  document.getElementById('btn-retry').addEventListener('click', startGame);
  document.getElementById('btn-home').addEventListener('click', goHome);
}

function goHome() {
  stopTimer();
  showScreen('screen-home');
  loadLeaderboard(state.lbType, state.lbDiff, 'lb-list');
}

// === 開始遊戲 ===
async function startGame() {
  state.currentIndex = 0;
  state.score = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.answered = false;

  // HUD 設定
  const timerCell = document.getElementById('hud-timer-cell');
  const scoreLabel = document.getElementById('hud-score-label');
  if (state.mode === 'levels') {
    timerCell.classList.remove('hidden');
    scoreLabel.textContent = '分數';
    document.getElementById('hud-score').textContent = '0';
  } else {
    timerCell.classList.add('hidden');
    scoreLabel.textContent = '答對';
    document.getElementById('hud-score').textContent = '0';
  }

  showScreen('screen-game');
  document.getElementById('game-body').innerHTML = '<div class="loading">載入題目中…</div>';
  document.getElementById('game-feedback').innerHTML = '';

  // 取題
  const count = state.mode === 'levels' ? LEVEL_QUESTION_COUNT : 30;
  const result = await API.fetchQuestions(state.type, state.difficulty, count);
  state.online = result.online;
  state.questions = result.questions;

  const banner = document.getElementById('offline-banner');
  banner.hidden = state.online;

  if (!state.questions || state.questions.length === 0) {
    document.getElementById('game-body').innerHTML = `
      <div class="loading">⚠ 題庫尚未灌入,請聯絡管理員。<br>(${escapeHtml(result.error || '')})</div>
    `;
    return;
  }

  renderQuestion();
}

function updateProgressHUD() {
  const progressEl = document.getElementById('hud-progress');
  if (state.mode === 'levels') {
    progressEl.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;
  } else {
    progressEl.textContent = `第 ${state.currentIndex + 1} 題`;
  }
}

function updateScoreHUD() {
  const el = document.getElementById('hud-score');
  if (state.mode === 'levels') {
    el.textContent = state.score;
  } else {
    const total = state.correctCount + state.wrongCount;
    el.textContent = `${state.correctCount} / ${total}`;
  }
}

function renderQuestion() {
  state.answered = false;
  const q = state.questions[state.currentIndex];

  updateProgressHUD();
  document.getElementById('game-feedback').innerHTML = '';

  if (state.type === 'jiangcuo') {
    renderJiangcuo(q.payload);
  } else {
    renderZizhu(q.payload);
  }

  if (state.mode === 'levels') {
    startTimer();
  }
}

// === 將錯糾錯 ===
function renderJiangcuo(q) {
  const isCorrectLeft = Math.random() < 0.5;
  const left = isCorrectLeft ? q.correct : q.wrong;
  const right = isCorrectLeft ? q.wrong : q.correct;

  const body = document.getElementById('game-body');
  body.innerHTML = `
    <div class="prompt">下列哪個寫法才正確?</div>
    <div class="choice-row">
      <button class="choice" data-choice="${escapeHtml(left)}">${escapeHtml(left)}</button>
      <button class="choice" data-choice="${escapeHtml(right)}">${escapeHtml(right)}</button>
    </div>
  `;

  body.querySelectorAll('.choice').forEach(btn => {
    btn.addEventListener('click', () => handleJiangcuoAnswer(btn, q));
  });
}

function handleJiangcuoAnswer(btn, q) {
  if (state.answered) return;
  state.answered = true;
  stopTimer();

  const picked = btn.dataset.choice;
  const isRight = picked === q.correct;

  document.querySelectorAll('.choice').forEach(b => {
    b.disabled = true;
    if (b.dataset.choice === q.correct) {
      b.classList.add('choice-correct');
    } else if (b === btn && !isRight) {
      b.classList.add('choice-wrong');
    }
  });

  if (isRight) {
    state.correctCount++;
    state.score += SCORE_PER_CORRECT;
    showFeedback(true, q.explanation);
  } else {
    state.wrongCount++;
    showFeedback(false, `正確答案:「${q.correct}」。${q.explanation}`);
  }
  updateScoreHUD();
}

// === 字字珠璣 ===
function renderZizhu(q) {
  const blanks = q.hints.map(h => {
    if (q.position === 'suffix') {
      return `<span class="hint-pair">${escapeHtml(h)}<span class="blank">?</span></span>`;
    } else {
      return `<span class="hint-pair"><span class="blank">?</span>${escapeHtml(h)}</span>`;
    }
  }).join('');

  const positionHint = q.position === 'suffix'
    ? '(共通字在每組的後面)'
    : '(共通字在每組的前面)';

  const body = document.getElementById('game-body');
  body.innerHTML = `
    <div class="prompt">填入一個共通字,使下列三組都成為常見詞彙:</div>
    <div class="hint-row">${blanks}</div>
    <div class="position-hint">${positionHint}</div>
    <div class="input-row">
      <input type="text" id="answer-input" maxlength="2" autocomplete="off" placeholder="輸入一字">
      <button id="btn-submit">送出</button>
    </div>
  `;

  const input = document.getElementById('answer-input');
  setTimeout(() => input.focus(), 50);

  const submit = () => handleZizhuAnswer(input.value, q);
  document.getElementById('btn-submit').addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });
}

function handleZizhuAnswer(raw, q) {
  if (state.answered) return;
  if (!raw || raw.trim().length === 0) return;
  state.answered = true;
  stopTimer();

  const trimmed = raw.trim().charAt(0);
  const isRight = trimmed === q.answer;

  document.getElementById('answer-input').disabled = true;
  document.getElementById('btn-submit').disabled = true;

  document.querySelectorAll('.blank').forEach(el => {
    el.textContent = q.answer;
    el.classList.add(isRight ? 'blank-correct' : 'blank-revealed');
  });

  if (isRight) {
    state.correctCount++;
    state.score += SCORE_PER_CORRECT;
    showFeedback(true, q.explanation);
  } else {
    state.wrongCount++;
    showFeedback(false, `正確答案:「${q.answer}」。${q.explanation}`);
  }
  updateScoreHUD();
}

// === 回饋 / 下一題 / 回報連結 ===
function showFeedback(isRight, explanation) {
  const inPractice = state.mode === 'practice';
  const showExplain = inPractice || !isRight;
  const currentQ = state.questions[state.currentIndex];
  const canReport = state.online && currentQ?.id != null;

  let html = `
    <div class="feedback ${isRight ? 'feedback-correct' : 'feedback-wrong'}">
      <div class="feedback-icon">${isRight ? '✓ 答對' : '✗ 答錯'}</div>
  `;
  if (showExplain && explanation) {
    html += `<div class="feedback-text">${escapeHtml(explanation)}</div>`;
  }
  html += `
    <div class="feedback-actions">
      ${canReport ? `<button class="link-report" id="btn-report">⚠ 回報題目有誤</button>` : ''}
      <button class="btn-next" id="btn-next">下一題 →</button>
    </div>
  </div>`;

  const fb = document.getElementById('game-feedback');
  fb.innerHTML = html;
  document.getElementById('btn-next').addEventListener('click', goNext);
  if (canReport) {
    document.getElementById('btn-report').addEventListener('click', () => openReportModal(currentQ.id));
  }
}

function goNext() {
  state.currentIndex++;
  if (state.mode === 'levels' && state.currentIndex >= state.questions.length) {
    finishLevel();
    return;
  }
  if (state.mode === 'practice' && state.currentIndex >= state.questions.length) {
    state.questions = shuffle(state.questions);
    state.currentIndex = 0;
  }
  renderQuestion();
}

// === 計時器 ===
function startTimer() {
  state.timeLeft = state.timePerQuestion;
  const el = document.getElementById('hud-timer');
  el.textContent = formatTime(state.timeLeft);
  el.classList.remove('timer-warning');

  state.timer = setInterval(() => {
    state.timeLeft--;
    el.textContent = formatTime(state.timeLeft);
    const threshold = state.timePerQuestion >= 60 ? 15 : 5;
    if (state.timeLeft <= threshold) el.classList.add('timer-warning');
    if (state.timeLeft <= 0) {
      stopTimer();
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function formatTime(sec) {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return String(sec);
}

function handleTimeout() {
  if (state.answered) return;
  state.answered = true;
  state.wrongCount++;

  const q = state.questions[state.currentIndex].payload;
  if (state.type === 'jiangcuo') {
    document.querySelectorAll('.choice').forEach(b => {
      b.disabled = true;
      if (b.dataset.choice === q.correct) b.classList.add('choice-correct');
    });
    showFeedback(false, `時間到!正確答案:「${q.correct}」。${q.explanation}`);
  } else {
    const input = document.getElementById('answer-input');
    const submit = document.getElementById('btn-submit');
    if (input) input.disabled = true;
    if (submit) submit.disabled = true;
    document.querySelectorAll('.blank').forEach(el => {
      el.textContent = q.answer;
      el.classList.add('blank-revealed');
    });
    showFeedback(false, `時間到!正確答案:「${q.answer}」。${q.explanation}`);
  }
  updateScoreHUD();
}

// === 結算 ===
async function finishLevel() {
  stopTimer();
  document.getElementById('result-score').textContent = state.score;
  document.getElementById('result-correct').textContent = `${state.correctCount} / ${state.questions.length}`;
  document.getElementById('result-rank').textContent = '計算中…';
  document.getElementById('result-message').textContent = '';
  document.getElementById('result-lb-list').innerHTML = '<div class="lb-empty">載入中…</div>';

  showScreen('screen-result');

  // 滿分判定 (放這邊先給訊息)
  let baseMsg;
  if (state.correctCount === state.questions.length) baseMsg = '滿分!文字大師!';
  else if (state.correctCount >= 8) baseMsg = '表現優秀,再戰一回!';
  else if (state.correctCount >= 5) baseMsg = '不錯不錯,繼續加油!';
  else if (state.correctCount >= 1) baseMsg = '練習模式可以查解釋哦~';
  else baseMsg = '再接再厲,下次更好!';

  if (!state.online) {
    document.getElementById('result-rank').textContent = '—';
    document.getElementById('result-message').textContent = `${baseMsg} (離線模式不上傳分數)`;
    document.getElementById('result-lb-list').innerHTML = '<div class="lb-empty">離線中</div>';
    return;
  }

  try {
    const data = await API.submitScore({
      nickname: state.nickname,
      type: state.type,
      difficulty: state.difficulty,
      score: state.score,
      correct: state.correctCount,
      total: state.questions.length,
    });
    document.getElementById('result-rank').textContent = `第 ${data.rank} 名`;
    let msg = baseMsg;
    if (data.rank === 1) msg = '🏆 全域第一名!太強了!';
    else if (data.rank <= 3) msg = `🥈 全域第 ${data.rank} 名!`;
    else if (data.rank <= 10) msg = `🎉 擠進前 10 名!(第 ${data.rank} 名)`;
    document.getElementById('result-message').textContent = msg;
    renderResultLeaderboard(data.top || []);
  } catch (e) {
    document.getElementById('result-rank').textContent = '—';
    document.getElementById('result-message').textContent = `${baseMsg} (分數上傳失敗:${e.message})`;
    document.getElementById('result-lb-list').innerHTML = '<div class="lb-empty">無法載入排行榜</div>';
  }
}

function renderResultLeaderboard(top) {
  const el = document.getElementById('result-lb-list');
  if (!top || top.length === 0) {
    el.innerHTML = '<div class="lb-empty">無資料</div>';
    return;
  }
  el.innerHTML = top.slice(0, 10).map((row, i) => `
    <div class="lb-row${row.nickname === state.nickname ? ' lb-me' : ''}">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${escapeHtml(row.nickname)}</span>
      <span class="lb-score">${row.score}<small> 分</small></span>
    </div>
  `).join('');
}

// === 回報題目 modal ===
function bindReportModal() {
  const modal = document.getElementById('report-modal');
  const detail = document.getElementById('report-detail');
  const err = document.getElementById('report-error');
  const closeBtn = document.getElementById('report-close');
  const cancelBtn = document.getElementById('report-cancel');
  const submitBtn = document.getElementById('report-submit');

  function close() { modal.hidden = true; submitBtn.disabled = false; submitBtn.textContent = '送出'; }
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  submitBtn.addEventListener('click', async () => {
    const cat = document.querySelector('input[name="report-reason-cat"]:checked')?.value || '其他';
    const detailText = detail.value.trim();
    const reason = detailText ? `${cat}:${detailText}` : cat;
    const qid = parseInt(modal.dataset.qid, 10);

    err.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';

    try {
      await API.reportQuestion(qid, reason, state.nickname);
      submitBtn.textContent = '✓ 已送出,謝謝!';
      // 也 disable 該題的回報按鈕
      const reportBtn = document.getElementById('btn-report');
      if (reportBtn) {
        reportBtn.textContent = '✓ 已回報';
        reportBtn.disabled = true;
      }
      setTimeout(close, 1200);
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.textContent = '送出';
      if (e.message === 'rate_limit') {
        err.textContent = '已回報過此題,稍後再試';
      } else {
        err.textContent = '送出失敗:' + e.message;
      }
    }
  });
}

function openReportModal(qid) {
  const modal = document.getElementById('report-modal');
  modal.dataset.qid = qid;
  document.getElementById('report-qid').textContent = qid;
  document.getElementById('report-detail').value = '';
  document.getElementById('report-error').textContent = '';
  document.querySelector('input[name="report-reason-cat"][value="錯字"]').checked = true;
  modal.hidden = false;
}

// === 分享 / QR Code ===
function bindShare() {
  const btnShare = document.getElementById('btn-share');
  const modal = document.getElementById('share-modal');
  const closeBtn = document.getElementById('share-close');
  const copyBtn = document.getElementById('btn-copy');
  const qrBox = document.getElementById('qr-box');
  const urlEl = document.getElementById('share-url');

  let qrRendered = false;

  function openShare() {
    const url = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
    urlEl.textContent = url;
    if (!qrRendered) {
      qrBox.innerHTML = '';
      try {
        new QRCode(qrBox, {
          text: url,
          width: 184, height: 184,
          colorDark: '#1F2937', colorLight: '#FFFFFF',
          correctLevel: QRCode.CorrectLevel.M
        });
        qrRendered = true;
      } catch (e) {
        qrBox.textContent = '⚠ 無法產生 QR 碼';
      }
    }
    modal.hidden = false;
  }
  function closeShare() { modal.hidden = true; }

  btnShare.addEventListener('click', openShare);
  closeBtn.addEventListener('click', closeShare);
  modal.addEventListener('click', e => { if (e.target === modal) closeShare(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeShare();
  });

  copyBtn.addEventListener('click', async () => {
    const url = urlEl.textContent;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = '✓ 已複製';
      setTimeout(() => { copyBtn.textContent = '複製網址'; }, 1500);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = '✓ 已複製';
      setTimeout(() => { copyBtn.textContent = '複製網址'; }, 1500);
    }
  });
}

// === 啟動 ===
document.addEventListener('DOMContentLoaded', () => {
  state.nickname = getNickname();
  renderNicknameBar();
  bindNicknameModal();
  bindNav();
  bindShare();
  bindReportModal();
  bindHomeLeaderboard();
});
