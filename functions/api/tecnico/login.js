// ============================================
// API: LOGIN DE TÉCNICOS
// POST { telefono, pin } → { tecnico, token }
// El token (sesión "tecnico:<id>") se envía como Authorization: Bearer en
// las demás llamadas de /api/tecnico/* (ver _middleware.js).
// ============================================

import { createSession, jsonResponse, loginThrottled, markLoginFailure } from '../../lib/auth.js';

// Días de validez de la sesión del técnico (PWA en el celular)
const TECNICO_SESSION_HOURS = 24 * 14;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json().catch(() => ({}));
    const telefono = String(data.telefono || '').trim();
    const pin = String(data.pin || '').trim();
    if (!telefono || !pin) return jsonResponse({ success: false, error: 'Faltan datos: teléfono y PIN' }, 400);

    if (await loginThrottled(request, 'tecnico:' + telefono)) {
      return jsonResponse({ success: false, error: 'Demasiados intentos, espera unos segundos' }, 429);
    }

    const tecnico = await env.DB.prepare(
      'SELECT id, nombre, telefono, email FROM sgc_ord_Tecnicos WHERE telefono = ? AND pin = ? AND activo = 1'
    ).bind(telefono, pin).first();
    if (!tecnico) {
      await markLoginFailure(request, 'tecnico:' + telefono);
      return jsonResponse({ success: false, error: 'Credenciales incorrectas o técnico inactivo' }, 401);
    }

    const { token, expira } = await createSession(env, `tecnico:${tecnico.id}`, TECNICO_SESSION_HOURS);
    return jsonResponse({ success: true, tecnico: { ...tecnico, token, expira } });
  } catch (error) {
    console.error('Error en login de técnico:', error);
    return jsonResponse({ success: false, error: 'Error interno' }, 500);
  }
}
