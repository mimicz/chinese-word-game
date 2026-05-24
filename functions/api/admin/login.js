// POST /api/admin/login  Body: { password } → { ok, token }
import { jsonResponse, badRequest, methodNotAllowed, serverError, signAdminToken } from '../../_shared.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed();
  if (!env.ADMIN_PASSWORD || !env.ADMIN_TOKEN_SECRET) {
    return serverError('admin secrets not configured');
  }

  let body;
  try { body = await request.json(); } catch { return badRequest('invalid json'); }
  const pw = typeof body?.password === 'string' ? body.password : '';

  // 簡易常數時間比對
  if (!constantTimeEqualStr(pw, env.ADMIN_PASSWORD)) {
    // 故意延遲一點點降低 brute force
    await new Promise(r => setTimeout(r, 200));
    return jsonResponse({ ok: false, error: 'invalid password' }, 401);
  }

  const token = await signAdminToken(env.ADMIN_TOKEN_SECRET, 86400);
  return jsonResponse({ ok: true, token, expires_in: 86400 });
}

function constantTimeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}
