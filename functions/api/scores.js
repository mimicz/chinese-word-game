// GET  /api/scores?type=jiangcuo&difficulty=elementary&limit=50  → top N
// POST /api/scores                                                → submit
import {
  jsonResponse, badRequest, methodNotAllowed, serverError,
  sanitizeNickname, isValidType, isValidDifficulty,
} from '../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'GET')  return handleGet(request, env);
  if (request.method === 'POST') return handlePost(request, env);
  return methodNotAllowed();
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const difficulty = url.searchParams.get('difficulty');
  const limitRaw = parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(limitRaw, 1), 100);

  if (!isValidType(type)) return badRequest('invalid type');
  if (!isValidDifficulty(difficulty)) return badRequest('invalid difficulty');

  try {
    const top = await fetchTop(env, type, difficulty, limit);
    return jsonResponse({ ok: true, top });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}

async function handlePost(request, env) {
  let body;
  try { body = await request.json(); } catch { return badRequest('invalid json'); }

  const nickname = sanitizeNickname(body?.nickname);
  if (!nickname) return badRequest('invalid nickname');
  if (!isValidType(body?.type)) return badRequest('invalid type');
  if (!isValidDifficulty(body?.difficulty)) return badRequest('invalid difficulty');

  const score   = parseInt(body?.score, 10);
  const correct = parseInt(body?.correct, 10);
  const total   = parseInt(body?.total, 10);
  if (!Number.isFinite(score)   || score   < 0 || score   > 9999) return badRequest('invalid score');
  if (!Number.isFinite(correct) || correct < 0 || correct > 100)  return badRequest('invalid correct');
  if (!Number.isFinite(total)   || total   < 1 || total   > 100)  return badRequest('invalid total');
  if (correct > total) return badRequest('correct > total');

  try {
    await env.DB.prepare(
      `INSERT INTO scores (nickname, type, difficulty, score, correct, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(nickname, body.type, body.difficulty, score, correct, total).run();

    const top = await fetchTop(env, body.type, body.difficulty, 50);
    // 名次:同題型/難度,score 高於本次的不同暱稱數量 + 1
    const rank = await calcRank(env, body.type, body.difficulty, score, nickname);

    return jsonResponse({ ok: true, rank, top });
  } catch (err) {
    return serverError(err.message || 'db error');
  }
}

// 同 nickname 取最高分,score DESC, played_at ASC
async function fetchTop(env, type, difficulty, limit) {
  const { results } = await env.DB.prepare(
    `SELECT nickname, MAX(score) AS score,
            (SELECT correct FROM scores s2
              WHERE s2.nickname = s1.nickname AND s2.type = s1.type
                AND s2.difficulty = s1.difficulty
              ORDER BY score DESC, played_at ASC LIMIT 1) AS correct,
            (SELECT total FROM scores s2
              WHERE s2.nickname = s1.nickname AND s2.type = s1.type
                AND s2.difficulty = s1.difficulty
              ORDER BY score DESC, played_at ASC LIMIT 1) AS total,
            (SELECT played_at FROM scores s2
              WHERE s2.nickname = s1.nickname AND s2.type = s1.type
                AND s2.difficulty = s1.difficulty
              ORDER BY score DESC, played_at ASC LIMIT 1) AS played_at
       FROM scores s1
      WHERE type = ? AND difficulty = ?
      GROUP BY nickname
      ORDER BY score DESC, played_at ASC
      LIMIT ?`,
  ).bind(type, difficulty, limit).all();
  return results;
}

async function calcRank(env, type, difficulty, score, nickname) {
  // 比本人最高分高的「不同暱稱」數 + 1
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM (
       SELECT nickname, MAX(score) AS s
         FROM scores
        WHERE type = ? AND difficulty = ?
        GROUP BY nickname
       HAVING s > ?
     )`,
  ).bind(type, difficulty, score).first();
  return (row?.c || 0) + 1;
}
