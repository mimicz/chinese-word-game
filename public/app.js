// === 字字千金 — 主程式 ===

const LEVEL_QUESTION_COUNT = 10;
const TIME_PER_QUESTION = 15;
const SCORE_PER_CORRECT = 10;

const state = {
  mode: null,        // 'levels' | 'practice'
  type: null,        // 'jiangcuo' | 'zizhu'
  questions: [],
  currentIndex: 0,
  score: 0,
  correctCount: 0,
  wrongCount: 0,
  timer: null,
  timeLeft: 0,
  answered: false,
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

function pickN(arr, n) {
  return shuffle(arr).slice(0, n);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// === 最高分（localStorage） ===
const STORAGE_KEY = 'zzqj_best_v1';

function getBest(type) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data[type] || 0;
  } catch (e) { return 0; }
}

function saveBest(type, score) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const prev = data[type] || 0;
    if (score > prev) {
      data[type] = score;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    }
    return false;
  } catch (e) { return false; }
}

function renderBestScores() {
  const el = document.getElementById('best-scores');
  const jc = getBest('jiangcuo');
  const zz = getBest('zizhu');
  if (jc === 0 && zz === 0) {
    el.innerHTML = '<div class="best-empty">尚未挑戰過任何關卡</div>';
    return;
  }
  el.innerHTML = `
    <div class="best-row">
      <span class="best-type">將錯糾錯</span>
      <span class="best-score">${jc} 分</span>
    </div>
    <div class="best-row">
      <span class="best-type">字字珠璣</span>
      <span class="best-score">${zz} 分</span>
    </div>
  `;
}

// === 導覽 ===
function bindNav() {
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      const subtitle = document.getElementById('type-subtitle');
      subtitle.textContent = state.mode === 'levels'
        ? '每關 10 題，每題 15 秒，挑戰高分'
        : '無計時、無壓力，答錯顯示解釋';
      showScreen('screen-type');
    });
  });

  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.type = btn.dataset.type;
      startGame();
    });
  });

  document.getElementById('btn-back-from-type').addEventListener('click', goHome);
  document.getElementById('btn-quit').addEventListener('click', () => {
    if (confirm('確定要退出本關嗎？')) {
      stopTimer();
      goHome();
    }
  });
  document.getElementById('btn-retry').addEventListener('click', startGame);
  document.getElementById('btn-home').addEventListener('click', goHome);
}

function goHome() {
  stopTimer();
  renderBestScores();
  showScreen('screen-home');
}

// === 開始遊戲 ===
function startGame() {
  state.currentIndex = 0;
  state.score = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.answered = false;

  const bank = state.type === 'jiangcuo'
    ? window.JIANGCUO_QUESTIONS
    : window.ZIZHU_QUESTIONS;

  if (state.mode === 'levels') {
    state.questions = pickN(bank, LEVEL_QUESTION_COUNT);
  } else {
    state.questions = shuffle(bank);
  }

  // 設定 HUD
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
  renderQuestion();
}

function updateProgressHUD() {
  const progressEl = document.getElementById('hud-progress');
  if (state.mode === 'levels') {
    progressEl.textContent = `${state.currentIndex + 1} / ${LEVEL_QUESTION_COUNT}`;
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
    renderJiangcuo(q);
  } else {
    renderZizhu(q);
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
    <div class="prompt">下列哪個寫法才正確？</div>
    <div class="choice-row">
      <button class="choice" data-choice="${left}">${left}</button>
      <button class="choice" data-choice="${right}">${right}</button>
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
    showFeedback(false, `正確答案：「${q.correct}」。${q.explanation}`);
  }
  updateScoreHUD();
}

// === 字字珠璣 ===
function renderZizhu(q) {
  const blanks = q.hints.map(h => {
    if (q.position === 'suffix') {
      return `<span class="hint-pair">${h}<span class="blank">？</span></span>`;
    } else {
      return `<span class="hint-pair"><span class="blank">？</span>${h}</span>`;
    }
  }).join('');

  const positionHint = q.position === 'suffix'
    ? '（共通字在每組的後面）'
    : '（共通字在每組的前面）';

  const body = document.getElementById('game-body');
  body.innerHTML = `
    <div class="prompt">填入一個共通字，使下列四組都成為常見詞彙：</div>
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
    showFeedback(false, `正確答案：「${q.answer}」。${q.explanation}`);
  }
  updateScoreHUD();
}

// === 回饋 / 下一題 ===
function showFeedback(isRight, explanation) {
  const inPractice = state.mode === 'practice';
  const showExplain = inPractice || !isRight;  // 答錯一定顯示；答對只在練習模式顯示

  let html = `
    <div class="feedback ${isRight ? 'feedback-correct' : 'feedback-wrong'}">
      <div class="feedback-icon">${isRight ? '✓ 答對' : '✗ 答錯'}</div>
  `;
  if (showExplain && explanation) {
    html += `<div class="feedback-text">${explanation}</div>`;
  }
  html += `<button class="btn-next" id="btn-next">下一題 →</button></div>`;

  const fb = document.getElementById('game-feedback');
  fb.innerHTML = html;
  document.getElementById('btn-next').addEventListener('click', goNext);
}

function goNext() {
  state.currentIndex++;
  if (state.mode === 'levels' && state.currentIndex >= LEVEL_QUESTION_COUNT) {
    finishLevel();
    return;
  }
  if (state.mode === 'practice' && state.currentIndex >= state.questions.length) {
    // 題庫跑完，重新洗牌循環
    state.questions = shuffle(state.questions);
    state.currentIndex = 0;
  }
  renderQuestion();
}

// === 計時器 ===
function startTimer() {
  state.timeLeft = TIME_PER_QUESTION;
  const el = document.getElementById('hud-timer');
  el.textContent = state.timeLeft;
  el.classList.remove('timer-warning');

  state.timer = setInterval(() => {
    state.timeLeft--;
    el.textContent = state.timeLeft;
    if (state.timeLeft <= 5) {
      el.classList.add('timer-warning');
    }
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

function handleTimeout() {
  if (state.answered) return;
  state.answered = true;
  state.wrongCount++;

  const q = state.questions[state.currentIndex];
  if (state.type === 'jiangcuo') {
    document.querySelectorAll('.choice').forEach(b => {
      b.disabled = true;
      if (b.dataset.choice === q.correct) b.classList.add('choice-correct');
    });
    showFeedback(false, `時間到！正確答案：「${q.correct}」。${q.explanation}`);
  } else {
    const input = document.getElementById('answer-input');
    const submit = document.getElementById('btn-submit');
    if (input) input.disabled = true;
    if (submit) submit.disabled = true;
    document.querySelectorAll('.blank').forEach(el => {
      el.textContent = q.answer;
      el.classList.add('blank-revealed');
    });
    showFeedback(false, `時間到！正確答案：「${q.answer}」。${q.explanation}`);
  }
  updateScoreHUD();
}

// === 結算 ===
function finishLevel() {
  stopTimer();
  document.getElementById('result-score').textContent = state.score;
  document.getElementById('result-correct').textContent = `${state.correctCount} / ${LEVEL_QUESTION_COUNT}`;

  const isNew = saveBest(state.type, state.score);
  document.getElementById('result-best').textContent = getBest(state.type);

  let msg;
  if (isNew && state.score > 0) msg = '🎉 創下新紀錄！';
  else if (state.correctCount === LEVEL_QUESTION_COUNT) msg = '滿分！文字大師！';
  else if (state.correctCount >= 8) msg = '表現優秀，再戰一回！';
  else if (state.correctCount >= 5) msg = '不錯不錯，繼續加油！';
  else if (state.correctCount >= 1) msg = '練習模式可以查解釋哦～';
  else msg = '再接再厲，下次更好！';
  document.getElementById('result-message').textContent = msg;

  showScreen('screen-result');
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
          width: 184,
          height: 184,
          colorDark: '#1F2937',
          colorLight: '#FFFFFF',
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
  modal.addEventListener('click', e => {
    if (e.target === modal) closeShare();
  });
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
      // Fallback for older browsers
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
  bindNav();
  bindShare();
  renderBestScores();
});
