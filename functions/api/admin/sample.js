// GET /api/admin/sample?type=zizhu&difficulty=middle&count=10&active=1
// 從題庫隨機抽 N 題給後台預覽用
import {
  jsonResponse, methodNotAllowed, badRequest, serverError,
  isValidType, isValidDifficulty,
} from '../../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const difficulty = url.searchParams.get('difficulty');
  const countRaw = parseInt(url.searchParams.get('count') || '10', 10);
  const count = Math.max(1, Math.min(50, isNaN(countRaw) ? 10 : countRaw));
  const activeParam = url.searchParams.get('active');
  // active=1 → 只看 active;active=0 → 只看 inactive;active=all 或省略 → active=1 預設
  let activeClause = 'AND active = 1';
  if (activeParam === '0') activeClause = 'AND active = 0';
  else if (activeParam === 'all') activeClause = '';

  if (!isValidType(type)) return badRequest('invalid type');
  if (!isValidDifficulty(difficulty)) return badRequest('invalid difficulty');

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, payload
         FROM questions
        WHERE type = ? AND difficulty = ? ${activeClause}
        ORDER BY RANDOM()
        LIMIT ?`,
    ).bind(type, difficulty, count).all();

    const questions = results.map(r => {
      let payload;
      try { payload = JSON.parse(r.payload); }
      catch { payload = { raw: r.payload }; }
      return { id: r.id, type, difficulty, payload };
    });

    return jsonResponse({ ok: true, questions });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}
