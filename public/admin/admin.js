// 字字千金 管理後台

const TOKEN_KEY = 'zzqj_admin_token';
let token = sessionStorage.getItem(TOKEN_KEY) || null;
let currentTab = 'reports';
let currentStatus = 'pending';

const TYPE_LABEL = { jiangcuo: '將錯糾錯', zizhu: '字字珠璣' };
const DIFF_LABEL = { elementary: '國小以下', middle: '國中以上' };

// === 啟動 ===
document.addEventListener('DOMContentLoaded', () => {
  bindLogin();
  bindMain();
  if (token) {
    showMain();
    refreshAll();
  } else {
    showLogin();
  }
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showLogin() { showScreen('screen-login'); }
function showMain()  { showScreen('screen-main'); }

// === Login ===
function bindLogin() {
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = document.getElementById('password').value;
    const err = document.getElementById('login-error');
    err.textContent = '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!data.ok) {
        err.textContent = data.error === 'invalid password' ? '密碼錯誤' : ('登入失敗:' + (data.error || res.status));
        return;
      }
      token = data.token;
      sessionStorage.setItem(TOKEN_KEY, token);
      document.getElementById('password').value = '';
      showMain();
      refreshAll();
    } catch (e) {
      err.textContent = '連線失敗:' + e.message;
    }
  });
}

// === API helper ===
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    // token 失效 → 重新登入
    sessionStorage.removeItem(TOKEN_KEY);
    token = null;
    showLogin();
    throw new Error('未授權');
  }
  return res.json();
}

// === Main bind ===
function bindMain() {
  document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    token = null;
    showLogin();
  });

  document.getElementById('btn-refresh').addEventListener('click', refreshAll);

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      currentTab = t.dataset.tab;
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('tab-' + currentTab).classList.add('active');
      refreshAll();
    });
  });

  document.getElementById('status-filter').addEventListener('change', e => {
    currentStatus = e.target.value;
    loadReports();
  });

  // Sample tab controls
  document.getElementById('sample-refresh').addEventListener('click', loadSample);
  ['sample-type', 'sample-difficulty', 'sample-active', 'sample-count'].forEach(id => {
    document.getElementById(id).addEventListener('change', loadSample);
  });

  // edit modal
  const modal = document.getElementById('edit-modal');
  document.getElementById('edit-close').addEventListener('click', () => modal.hidden = true);
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  document.getElementById('edit-save').addEventListener('click', saveEdit);
}

async function refreshAll() {
  await loadStats();
  if (currentTab === 'reports') await loadReports();
  if (currentTab === 'library') await loadLibrary();
  if (currentTab === 'sample') await loadSample();
}

// === Stats ===
async function loadStats() {
  try {
    const data = await api('/api/admin/stats');
    if (!data.ok) return;
    document.getElementById('badge-reports').textContent = data.pending_reports || 0;
    document.getElementById('badge-reports').setAttribute('data-count', data.pending_reports || 0);
    const summary = `題庫 ${sumActive(data.buckets)} 題 · 待處理回報 ${data.pending_reports}`;
    document.getElementById('stats-summary').textContent = summary;
    window._libBuckets = data.buckets;
  } catch (e) { /* noop */ }
}

function sumActive(buckets) {
  return (buckets || []).filter(b => b.active === 1).reduce((s, b) => s + b.n, 0);
}

// === Reports ===
async function loadReports() {
  const list = document.getElementById('reports-list');
  list.innerHTML = '<div class="loading-state">載入中…</div>';
  try {
    const data = await api(`/api/admin/reports?status=${encodeURIComponent(currentStatus)}&limit=300`);
    if (!data.ok) {
      list.innerHTML = `<div class="empty-state">載入失敗:${data.error}</div>`;
      return;
    }
    if (!data.groups || data.groups.length === 0) {
      list.innerHTML = `<div class="empty-state">目前沒有 ${statusLabel(currentStatus)} 的回報</div>`;
      return;
    }
    list.innerHTML = data.groups.map(renderReportCard).join('');
    bindReportActions();
  } catch (e) {
    list.innerHTML = `<div class="empty-state">${e.message}</div>`;
  }
}

function statusLabel(s) {
  return ({ pending: '待處理', resolved: '已處理', dismissed: '已駁回', all: '' })[s] || '';
}

function renderReportCard(g) {
  const cls = g.reports?.[0]?.status || 'pending';
  const inactive = g.active === 0 ? '<span class="inactive-tag">已下架</span>' : '';
  return `
    <div class="card ${cls}" data-qid="${g.question_id}">
      <div class="card-head">
        <div>
          <span class="card-tag ${g.difficulty}">${DIFF_LABEL[g.difficulty] || g.difficulty}</span>
          <span class="card-tag">${TYPE_LABEL[g.type] || g.type}</span>
          <span>#${g.question_id}</span>${inactive}
        </div>
        <div class="card-count">回報 ${g.count} 次</div>
      </div>
      <div class="card-payload">${renderPayload(g.type, g.payload)}</div>
      <div class="card-reports">
        <h4>玩家回報原因</h4>
        ${g.reports.map(r => `
          <div class="report-item">
            <span class="report-reason">${r.reason ? escapeHtml(r.reason) : '<i style="color:#9CA3AF">(未填原因)</i>'}</span>
            <span class="report-meta">— ${escapeHtml(r.nickname || '訪客')}, ${fmtTime(r.reported_at)}, ${statusLabel(r.status) || r.status}</span>
          </div>
        `).join('')}
      </div>
      <div class="card-actions">
        <button class="btn-success" data-action="resolve-all">✓ 全部標記已處理</button>
        <button data-action="dismiss-all">✗ 全部駁回</button>
        ${g.active === 1
          ? '<button class="btn-danger" data-action="deactivate">⛔ 下架此題</button>'
          : '<button class="btn-primary" data-action="activate">↑ 重新上架</button>'}
        <button class="btn-primary" data-action="edit">✎ 編輯內容</button>
      </div>
    </div>
  `;
}

function renderPayload(type, p) {
  if (!p) return '<i>(無資料)</i>';
  if (type === 'jiangcuo') {
    return `
      <div class="row"><span class="label">正解</span><span class="correct">${escapeHtml(p.correct)}</span></div>
      <div class="row"><span class="label">錯字版</span><span class="wrong">${escapeHtml(p.wrong)}</span></div>
      <div class="row"><span class="label">解釋</span>${escapeHtml(p.explanation || '')}</div>
    `;
  }
  if (type === 'zizhu') {
    const pos = p.position === 'suffix' ? '共通字在後' : '共通字在前';
    return `
      <div class="row"><span class="label">提示</span>${(p.hints || []).map(h => escapeHtml(h)).join(' / ')}</div>
      <div class="row"><span class="label">答案</span><span class="correct">${escapeHtml(p.answer)}</span> <span class="label">(${pos})</span></div>
      <div class="row"><span class="label">解釋</span>${escapeHtml(p.explanation || '')}</div>
    `;
  }
  return escapeHtml(JSON.stringify(p));
}

function bindReportActions() {
  document.querySelectorAll('.card').forEach(card => {
    const qid = parseInt(card.dataset.qid, 10);
    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => onReportAction(qid, btn.dataset.action, card));
    });
  });
}

async function onReportAction(qid, action, card) {
  if (action === 'edit') {
    openEditModal(qid, card);
    return;
  }
  if (action === 'deactivate') {
    if (!confirm(`確定下架題目 #${qid}?玩家將不再抽到此題。`)) return;
    await patchQuestion(qid, { active: 0 }, true);
    await refreshAll();
    return;
  }
  if (action === 'activate') {
    await patchQuestion(qid, { active: 1 }, false);
    await refreshAll();
    return;
  }
  if (action === 'resolve-all' || action === 'dismiss-all') {
    const status = action === 'resolve-all' ? 'resolved' : 'dismissed';
    const ids = [...card.querySelectorAll('.report-item')].map((_, i) => i); // 不需要,直接拿全部
    // 用 group 的 reports id (從 DOM 取不到 id,得從 cache 拿;簡化:重新呼叫 API 取得 ids)
    const data = await api(`/api/admin/reports?status=${currentStatus}&limit=300`);
    if (!data.ok) return;
    const group = data.groups.find(g => g.question_id === qid);
    if (!group) return;
    for (const r of group.reports) {
      await api(`/api/admin/reports/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    }
    await refreshAll();
  }
}

async function patchQuestion(qid, body, resolveReports) {
  const qs = resolveReports ? '?resolve_reports=1' : '';
  return api(`/api/admin/questions/${qid}${qs}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// === Edit modal ===
let editingQid = null;
function openEditModal(qid, card) {
  editingQid = qid;
  document.getElementById('edit-qid').textContent = qid;
  // 從 DOM 已經拿不到 raw payload,簡單做法:再 fetch 一次或用 cache
  // 這邊保留欄位讓使用者貼新 payload;也可載入現有 payload
  // 直接從 reports API 取一份新的就好
  document.getElementById('edit-payload').value = '';
  document.getElementById('edit-error').textContent = '';
  document.getElementById('edit-modal').hidden = false;
  loadCurrentPayload(qid);
}

async function loadCurrentPayload(qid) {
  try {
    const data = await api(`/api/admin/reports?status=all&limit=500`);
    if (!data.ok) return;
    const g = data.groups.find(x => x.question_id === qid);
    if (g?.payload) {
      document.getElementById('edit-payload').value = JSON.stringify(g.payload, null, 2);
    }
  } catch { /* noop */ }
}

async function saveEdit() {
  const err = document.getElementById('edit-error');
  err.textContent = '';
  let payload;
  try {
    payload = JSON.parse(document.getElementById('edit-payload').value);
  } catch (e) {
    err.textContent = 'JSON 格式錯誤:' + e.message;
    return;
  }
  const resolveReports = document.getElementById('edit-resolve-reports').checked;
  try {
    const res = await patchQuestion(editingQid, { payload }, resolveReports);
    if (!res.ok) {
      err.textContent = '儲存失敗:' + res.error;
      return;
    }
    document.getElementById('edit-modal').hidden = true;
    await refreshAll();
  } catch (e) {
    err.textContent = e.message;
  }
}

// === Library ===
async function loadLibrary() {
  const list = document.getElementById('library-list');
  const buckets = window._libBuckets || [];
  const counts = {};
  for (const b of buckets) {
    const key = `${b.type}_${b.difficulty}`;
    if (!counts[key]) counts[key] = { active: 0, inactive: 0 };
    if (b.active === 1) counts[key].active = b.n;
    else counts[key].inactive = b.n;
  }
  const items = [];
  for (const type of ['jiangcuo', 'zizhu']) {
    for (const diff of ['elementary', 'middle']) {
      const k = counts[`${type}_${diff}`] || { active: 0, inactive: 0 };
      items.push(`
        <div class="lib-cell">
          <h3>${DIFF_LABEL[diff]} × ${TYPE_LABEL[type]}</h3>
          <div class="count">${k.active}<span class="small">/${k.active + k.inactive} 題</span></div>
          ${k.inactive > 0 ? `<div class="small" style="color:#9CA3AF;font-size:12px;margin-top:6px">已下架 ${k.inactive} 題</div>` : ''}
        </div>
      `);
    }
  }
  list.innerHTML = `<div class="lib-grid">${items.join('')}</div>`;
}

// === Sample ===
async function loadSample() {
  const list = document.getElementById('sample-list');
  const type = document.getElementById('sample-type').value;
  const difficulty = document.getElementById('sample-difficulty').value;
  const active = document.getElementById('sample-active').value;
  const count = document.getElementById('sample-count').value;
  list.innerHTML = '<div class="loading-state">抽樣中…</div>';
  try {
    const data = await api(`/api/admin/sample?type=${type}&difficulty=${difficulty}&active=${active}&count=${count}`);
    if (!data.ok) { list.innerHTML = `<div class="empty-state">錯誤:${escapeHtml(data.error || '')}</div>`; return; }
    if (!data.questions.length) { list.innerHTML = '<div class="empty-state">無題目</div>'; return; }
    list.innerHTML = data.questions.map(q => renderSampleCard(q)).join('');
    bindSampleActions();
  } catch (e) {
    list.innerHTML = `<div class="empty-state">載入失敗:${escapeHtml(e.message || '')}</div>`;
  }
}

function renderSampleCard(q) {
  const p = q.payload || {};
  const meta = p._meta;
  let body = '';
  if (q.type === 'zizhu') {
    const words = (p.hints || []).map(h =>
      p.position === 'prefix' ? `${p.answer}<strong class="ans">${escapeHtml(h)}</strong>` : `<strong class="ans">${escapeHtml(h)}</strong>${p.answer}`
    );
    // 題目區只顯示 hint + ?,答案區顯示完整詞
    const blanks = (p.hints || []).map(h =>
      p.position === 'prefix' ? `<span class="hint-blank">?${escapeHtml(h)}</span>` : `<span class="hint-blank">${escapeHtml(h)}?</span>`
    ).join(' ');
    body = `
      <div class="sample-line"><span class="label">提示</span>${blanks}</div>
      <div class="sample-line"><span class="label">答案</span><span class="correct big">${escapeHtml(p.answer)}</span>
        → ${(p.hints || []).map(h => p.position === 'prefix' ? p.answer + h : h + p.answer).map(escapeHtml).join(' · ')}</div>
    `;
  } else if (q.type === 'jiangcuo') {
    body = `
      <div class="sample-line"><span class="label">正解</span><span class="correct">${escapeHtml(p.correct)}</span>
        / <span class="label">錯字</span><span class="wrong">${escapeHtml(p.wrong)}</span></div>
      <div class="sample-line"><span class="label">解釋</span>${escapeHtml(p.explanation || '')}</div>
    `;
  }
  const metaLine = meta
    ? `<div class="sample-meta">語意多樣性 <b>${meta.diversity}</b>  ·  常用度 <b>${meta.commonness}</b>  ·  ${escapeHtml(meta.rationale || '')}</div>`
    : '';
  return `
    <div class="card sample-card" data-qid="${q.id}">
      <div class="card-header">
        <span class="qid">#${q.id}</span>
        <div class="card-actions">
          <button data-action="deactivate-sample" class="btn-warn">⛔ 下架</button>
        </div>
      </div>
      ${body}
      ${metaLine}
    </div>
  `;
}

function bindSampleActions() {
  document.querySelectorAll('.sample-card').forEach(card => {
    const qid = parseInt(card.dataset.qid, 10);
    card.querySelector('[data-action="deactivate-sample"]')?.addEventListener('click', async () => {
      if (!confirm(`下架題目 #${qid}?`)) return;
      await patchQuestion(qid, { active: 0 }, false);
      card.style.opacity = 0.4;
      card.querySelector('[data-action="deactivate-sample"]').textContent = '✓ 已下架';
    });
  });
}

// === Utils ===
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtTime(unix) {
  const d = new Date(unix * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
