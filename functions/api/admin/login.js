// ============================================
// API: LOGIN ADMIN (sgc-ordenes)
// POST   { usuario|username, password } → { token, expira }
// GET    ?token=...   (o Authorization: Bearer) → verifica la sesión
// DELETE Authorization: Bearer → cierra la sesión
// ============================================

import {
  createSession, validateSession, deleteSession, getSessionToken, jsonResponse,
  verifyPassword, hashPassword, loginThrottled, markLoginFailure
} from '../../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json().catch(() => ({}));
    const usuario = String(data.usuario || data.username || '').trim();
    const password = String(data.password || '');
    if (!usuario || !password) return jsonResponse({ success: false, error: 'Usuario y contraseña requeridos' }, 400);

    if (await loginThrottled(request, 'admin:' + usuario)) {
      return jsonResponse({ success: false, error: 'Demasiados intentos, espera unos segundos' }, 429);
    }

    const user = await env.DB.prepare(
      'SELECT id, username, password_hash, nombre, rol, activo FROM sgc_ord_AdminUsers WHERE username = ? AND activo = 1'
    ).bind(usuario).first();
    const check = user ? await verifyPassword(password, user.password_hash) : { ok: false };
    if (!check.ok) {
      await markLoginFailure(request, 'admin:' + usuario);
      // Mismo mensaje para usuario inexistente o contraseña incorrecta
      return jsonResponse({ success: false, error: 'Usuario o contraseña incorrectos' }, 401);
    }

    // Migrar hashes SHA-256 antiguos a PBKDF2 con salt
    const newHash = check.legacy ? await hashPassword(password) : null;
    await env.DB.prepare(
      "UPDATE sgc_ord_AdminUsers SET ultimo_login = datetime('now', '-3 hours')" + (newHash ? ', password_hash = ?' : '') + ' WHERE id = ?'
    ).bind(...(newHash ? [newHash, user.id] : [user.id])).run();

    const { token, expira } = await createSession(env, user.username);
    return jsonResponse({
      success: true,
      token,
      nombre: user.nombre || user.username,
      usuario: user.username,
      expira,
      // La contraseña por defecto debe cambiarse
      debe_cambiar_password: password === 'admin123'
    });
  } catch (error) {
    console.error('Error login:', error);
    return jsonResponse({ success: false, error: 'Error interno' }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || getSessionToken(request);
  if (!token) return jsonResponse({ success: false, error: 'Token requerido' }, 400);
  const session = await validateSession(env, token);
  if (!session || !session.isAdmin) return jsonResponse({ success: false, error: 'Sesión expirada' }, 401);
  return jsonResponse({ success: true, usuario: session.username, username: session.username });
}

export async function onRequestDelete(context) {
  await deleteSession(context.env, getSessionToken(context.request));
  return jsonResponse({ success: true });
}
