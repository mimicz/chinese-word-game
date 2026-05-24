// GET /api/admin/reports?status=pending&limit=200
//   → 依「同 question_id 聚合」回傳;含題目 payload 與該題各別 report 明細
import { jsonResponse, methodNotAllowed, serverError } from '../../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 500);
  const validStatus = ['pending', 'resolved', 'dismissed', 'all'].includes(status) ? status : 'pending';

  try {
    const where = validStatus === 'all' ? '' : 'WHERE r.status = ?';
    const binds = validStatus === 'all' ? [limit] : [validStatus, limit];

    const { results } = await env.DB.prepare(
      `SELECT r.id, r.question_id, r.reason, r.nickname, r.reported_at, r.status,
              q.type, q.difficulty, q.payload, q.active
         FROM question_reports r
         LEFT JOIN questions q ON q.id = r.question_id
         ${where}
         ORDER BY r.reported_at DESC
         LIMIT ?`,
    ).bind(...binds).all();

    // 依 question_id 聚合
    const map = new Map();
    for (const r of results) {
      const key = r.question_id;
      if (!map.has(key)) {
        map.set(key, {
          question_id: r.question_id,
          type: r.type,
          difficulty: r.difficulty,
          payload: safeParse(r.payload),
          active: r.active,
          count: 0,
          reports: [],
        });
      }
      const entry = map.get(key);
      entry.count++;
      entry.reports.push({
        id: r.id,
        reason: r.reason,
        nickname: r.nickname,
        reported_at: r.reported_at,
        status: r.status,
      });
    }

    const groups = [...map.values()].sort((a, b) => b.count - a.count);
    return jsonResponse({ ok: true, groups });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
