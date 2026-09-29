// ============================================
// API: CAMBIAR CONTRASEÑA DEL ADMIN
// POST { actual, nueva } (requiere sesión admin; ver _middleware.js)
// ============================================

import { jsonResponse, verifyPassword, hashPassword } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env, data: ctx } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const actual = String(body.actual || '');
    const nueva = String(body.nueva || '');
    if (nueva.length < 10) return jsonResponse({ success: false, error: 'La nueva contraseña debe tener al menos 10 caracteres' }, 400);
    if (nueva === actual) return jsonResponse({ success: false, error: 'La nueva contraseña debe ser distinta' }, 400);

    const user = await env.DB.prepare(
      'SELECT id, password_hash FROM sgc_ord_AdminUsers WHERE username = ? AND activo = 1'
    ).bind(ctx.session.username).first();
    if (!user || !(await verifyPassword(actual, user.password_hash)).ok) {
      return jsonResponse({ success: false, error: 'La contraseña actual no es correcta' }, 401);
    }
    await env.DB.prepare('UPDATE sgc_ord_AdminUsers SET password_hash = ? WHERE id = ?').bind(await hashPassword(nueva), user.id).run();
    // Cierra las demás sesiones de este usuario
    await env.DB.prepare('DELETE FROM sgc_ord_SesionesAdmin WHERE username = ? AND token != ?')
      .bind(ctx.session.username, ctx.session.token || '').run();
    return jsonResponse({ success: true, mensaje: 'Contraseña actualizada' });
  } catch (error) {
    console.error('Error cambiar-password:', error);
    return jsonResponse({ success: false, error: 'Error interno' }, 500);
  }
}
