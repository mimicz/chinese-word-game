// PATCH /api/admin/reports/:id  Body: { status: 'resolved' | 'dismissed' | 'pending' }
import { jsonResponse, badRequest, methodNotAllowed, serverError } from '../../../_shared.js';

export async function onRequest({ request, env, params }) {
  if (request.method !== 'PATCH') return methodNotAllowed();

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id < 1) return badRequest('invalid id');

  let body;
  try { body = await request.json(); } catch { return badRequest('invalid json'); }
  const status = body?.status;
  if (!['resolved', 'dismissed', 'pending'].includes(status)) return badRequest('invalid status');

  try {
    const res = await env.DB.prepare(
      `UPDATE question_reports SET status = ? WHERE id = ?`,
    ).bind(status, id).run();
    if (!res.meta?.changes) return jsonResponse({ ok: false, error: 'not found' }, 404);
    return jsonResponse({ ok: true });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}
