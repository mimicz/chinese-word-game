// GET /api/admin/stats — 題庫總覽 (各類別 active / inactive 題數)
import { jsonResponse, methodNotAllowed, serverError } from '../../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  try {
    const { results } = await env.DB.prepare(
      `SELECT type, difficulty, active, COUNT(*) AS n
         FROM questions
         GROUP BY type, difficulty, active`,
    ).all();

    const pending = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM question_reports WHERE status = 'pending'`,
    ).first();

    return jsonResponse({
      ok: true,
      buckets: results,
      pending_reports: pending?.c || 0,
    });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}
