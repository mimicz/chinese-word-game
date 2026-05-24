// 字字千金 — admin API 中介層
// 除了 /api/admin/login 之外,所有 admin 路徑都要帶 Authorization: Bearer <token>
import { jsonResponse, verifyAdminToken } from '../../_shared.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === '/api/admin/login') return context.next();

  const auth = context.request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const secret = context.env.ADMIN_TOKEN_SECRET;
  if (!secret) return jsonResponse({ ok: false, error: 'server not configured' }, 500);

  const ok = await verifyAdminToken(secret, token);
  if (!ok) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  return context.next();
}
