// GET /api/questions?type=jiangcuo&difficulty=elementary&count=10
import { jsonResponse, badRequest, methodNotAllowed, serverError, isValidType, isValidDifficulty } from '../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed();

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const difficulty = url.searchParams.get('difficulty');
  const countRaw = parseInt(url.searchParams.get('count') || '10', 10);
  const count = Math.min(Math.max(countRaw, 1), 50);

  if (!isValidType(type)) return badRequest('invalid type');
  if (!isValidDifficulty(difficulty)) return badRequest('invalid difficulty');

  try {
    const stmt = env.DB.prepare(
      `SELECT id, type, difficulty, payload
         FROM questions
        WHERE type = ? AND difficulty = ? AND active = 1
        ORDER BY RANDOM()
        LIMIT ?`,
    ).bind(type, difficulty, count);
    const { results } = await stmt.all();

    const questions = results.map(r => ({
      id: r.id,
      type: r.type,
      difficulty: r.difficulty,
      payload: safeParse(r.payload),
    }));

    return jsonResponse({ ok: true, questions });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
