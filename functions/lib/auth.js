// ============================================
// Sesiones (admin y técnicos) guardadas en sgc_ord_SesionesAdmin
//  - Admin:   username = <usuario admin>
//  - Técnico: username = "tecnico:<id>"
// Token aleatorio (crypto.randomUUID) con expiración en UTC.
// ============================================

export const SESSION_HOURS = 24;

export function newToken() {
  return 'sgc_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

export function expiresAt(hours = SESSION_HOURS) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export async function createSession(env, username, hours = SESSION_HOURS) {
  const token = newToken();
  const expira = expiresAt(hours);
  await env.DB.prepare(
    'INSERT INTO sgc_ord_SesionesAdmin (username, token, expira) VALUES (?, ?, ?)'
  ).bind(username, token, expira).run();
  // Limpieza oportunista de sesiones vencidas
  await env.DB.prepare('DELETE FROM sgc_ord_SesionesAdmin WHERE expira < ?').bind(new Date().toISOString()).run();
  return { token, expira };
}

export function getSessionToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  const h = request.headers.get('X-Session-Token');
  if (h) return h.trim();
  // Descargas abiertas con window.open (sin headers): ?session=<token>
  const url = new URL(request.url);
  return url.searchParams.get('session');
}

// Devuelve { username, tecnicoId|null } o null si la sesión no existe o venció
export async function validateSession(env, token) {
  if (!token || token.length < 20) return null;
  const row = await env.DB.prepare(
    'SELECT username, expira FROM sgc_ord_SesionesAdmin WHERE token = ? AND expira > ?'
  ).bind(token, new Date().toISOString()).first();
  if (!row) return null;
  const m = String(row.username).match(/^tecnico:(\d+)$/);
  return { username: row.username, tecnicoId: m ? parseInt(m[1], 10) : null, isAdmin: !m };
}

export async function deleteSession(env, token) {
  if (token) await env.DB.prepare('DELETE FROM sgc_ord_SesionesAdmin WHERE token = ?').bind(token).run();
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------- Contraseñas: PBKDF2-SHA256 con salt ----------
// Formato: pbkdf2$<iteraciones>$<salt hex>$<hash hex>
// Los hashes SHA-256 antiguos (64 hex) se aceptan y se migran al iniciar sesión.
const PBKDF2_ITER = 100000;

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)));
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${toHex(salt)}$${await pbkdf2(password, salt, PBKDF2_ITER)}`;
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Devuelve { ok, legacy } — legacy=true si el hash guardado es SHA-256 sin salt
export async function verifyPassword(password, stored) {
  if (!stored) return { ok: false };
  if (stored.startsWith('pbkdf2$')) {
    const [, iter, saltHex, hash] = stored.split('$');
    return { ok: safeEqual(await pbkdf2(password, fromHex(saltHex), parseInt(iter, 10)), hash), legacy: false };
  }
  return { ok: safeEqual(await sha256(password), stored), legacy: true };
}

// Límite de intentos fallidos (best effort, Cache API por colo)
export async function loginThrottled(request, key) {
  if (typeof caches === 'undefined' || !caches.default) return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return !!(await caches.default.match(new Request(`https://throttle.internal/${encodeURIComponent(key)}/${ip}`)));
}
export async function markLoginFailure(request, key, seconds = 3) {
  if (typeof caches === 'undefined' || !caches.default) return;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await caches.default.put(new Request(`https://throttle.internal/${encodeURIComponent(key)}/${ip}`),
    new Response('1', { headers: { 'Cache-Control': `max-age=${seconds}` } }));
}
