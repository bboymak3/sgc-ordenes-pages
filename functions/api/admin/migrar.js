// ============================================
// API: MIGRAR (desactivado)
// Antes se ejecutaba en cada carga del panel y podía reconstruir
// sgc_ord_OrdenesTrabajo dejando los datos en una tabla sin prefijo.
// El esquema de la base compartida se gestiona ahora con migraciones D1
// versionadas en sgc-saas/worker/migrations (wrangler d1 migrations apply).
// ============================================

export async function onRequestGet() {
  return new Response(JSON.stringify({
    success: true,
    mensaje: 'Sin cambios: el esquema se gestiona con migraciones D1 (sgc-saas/worker/migrations)'
  }), { headers: { 'Content-Type': 'application/json' } });
}
