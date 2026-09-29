// ============================================
// Proxy autenticado hacia las citas del bot (worker sgc-saas)
//
//   GET  /api/admin/citas-ia               → /api/citas-admin
//   POST /api/admin/citas-ia/<id>/aprobar  → /api/citas-admin/<id>/aprobar
//   POST /api/admin/citas-ia/<id>/rechazar → /api/citas-admin/<id>/rechazar
//   GET  /api/admin/citas-ia/rango         → /api/citas/rango
//
// El navegador solo necesita la sesión de sgc-ordenes (validada por
// _middleware.js); el ADMIN_TOKEN de sgc-saas queda como secret del servidor
// (SGC_SAAS_ADMIN_TOKEN) y nunca llega al cliente.
// ============================================

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.SGC_SAAS_URL || !env.SGC_SAAS_ADMIN_TOKEN) {
    return new Response(JSON.stringify({ success: false, error: 'Falta configurar SGC_SAAS_URL / SGC_SAAS_ADMIN_TOKEN' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
  const parts = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  let target;
  if (parts.length === 0) target = '/api/citas-admin';
  else if (parts.length === 1 && parts[0] === 'rango') target = '/api/citas/rango';
  else if (parts.length === 2 && /^\d+$/.test(parts[0]) && ['aprobar', 'rechazar'].includes(parts[1])) target = `/api/citas-admin/${parts[0]}/${parts[1]}`;
  else return new Response(JSON.stringify({ success: false, error: 'Ruta no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(request.url);
  const upstream = new URL(target, env.SGC_SAAS_URL);
  url.searchParams.forEach((v, k) => { if (k !== 'session') upstream.searchParams.set(k, v); });

  const init = {
    method: request.method,
    headers: { 'Authorization': `Bearer ${env.SGC_SAAS_ADMIN_TOKEN}`, 'Content-Type': 'application/json' }
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.text();
  const res = await fetch(upstream.toString(), init);
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' } });
}
