// POST /api/reports — 玩家回報題目有誤
import { jsonResponse, badRequest, methodNotAllowed, serverError, sanitizeNickname, ipHash } from '../_shared.js';

const REASON_MAX = 200;
const RATE_LIMIT_WINDOW_SEC = 600;  // 10 分鐘
const RATE_LIMIT_MAX = 1;            // 同 IP 對同題 10 分鐘 1 次

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed();

  let body;
  try { body = await request.json(); } catch { return badRequest('invalid json'); }

  const questionId = parseInt(body?.question_id, 10);
  if (!Number.isFinite(questionId) || questionId < 1) return badRequest('invalid question_id');

  let reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (reason.length > REASON_MAX) reason = reason.slice(0, REASON_MAX);

  const nickname = body?.nickname ? sanitizeNickname(body.nickname) : null;

  try {
    // 確認題目存在
    const q = await env.DB.prepare(`SELECT id FROM questions WHERE id = ?`).bind(questionId).first();
    if (!q) return badRequest('question not found');

    const hash = await ipHash(request);
    const since = Math.floor(Date.now() / 1000) - RATE_LIMIT_WINDOW_SEC;

    const dup = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM question_reports
        WHERE question_id = ? AND ip_hash = ? AND reported_at >= ?`,
    ).bind(questionId, hash, since).first();
    if ((dup?.c || 0) >= RATE_LIMIT_MAX) {
      return jsonResponse({ ok: false, error: 'too many reports' }, 429);
    }

    await env.DB.prepare(
      `INSERT INTO question_reports (question_id, reason, nickname, ip_hash)
       VALUES (?, ?, ?, ?)`,
    ).bind(questionId, reason || null, nickname, hash).run();

    return jsonResponse({ ok: true });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}
