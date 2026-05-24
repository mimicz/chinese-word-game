// PATCH /api/admin/questions/:id  Body: { active?: 0|1, payload?: object }
// 同時可批次標記該題的所有 pending 回報為 resolved (?resolve_reports=1)
import { jsonResponse, badRequest, methodNotAllowed, serverError } from '../../../_shared.js';

export async function onRequest({ request, env, params }) {
  if (request.method !== 'PATCH') return methodNotAllowed();

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id < 1) return badRequest('invalid id');

  let body;
  try { body = await request.json(); } catch { return badRequest('invalid json'); }

  const fields = [];
  const binds = [];
  if (body?.active === 0 || body?.active === 1) {
    fields.push('active = ?');
    binds.push(body.active);
  }
  if (body?.payload && typeof body.payload === 'object') {
    fields.push('payload = ?');
    binds.push(JSON.stringify(body.payload));
  }
  if (fields.length === 0) return badRequest('nothing to update');
  binds.push(id);

  try {
    const res = await env.DB.prepare(
      `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`,
    ).bind(...binds).run();
    if (!res.meta?.changes) return jsonResponse({ ok: false, error: 'not found' }, 404);

    const url = new URL(request.url);
    if (url.searchParams.get('resolve_reports') === '1') {
      await env.DB.prepare(
        `UPDATE question_reports SET status = 'resolved'
          WHERE question_id = ? AND status = 'pending'`,
      ).bind(id).run();
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}
