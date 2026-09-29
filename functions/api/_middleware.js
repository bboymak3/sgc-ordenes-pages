// ============================================
// Middleware de autenticación para /api/*
//
//  Público:  login admin/técnico, tracking y aprobación del cliente (por token
//            UUID de la orden), formulario público de orden express, imágenes.
//  Técnico:  /api/tecnico/* con sesión de técnico (solo sus propias órdenes)
//            o sesión admin.
//  Admin:    todo lo demás.
// ============================================

import { getSessionToken, validateSession, jsonResponse } from '../lib/auth.js';

const PUBLIC_ROUTES = [
  ['POST', '/api/admin/login'],
  ['GET', '/api/admin/login'],
  ['POST', '/api/tecnico/login'],
  ['GET', '/api/tracking'],
  ['POST', '/api/public/crear-orden-express'],
  ['GET', '/api/imagen'],
  ['POST', '/api/aprobar-orden'],
  ['POST', '/api/cancelar-orden']
];

function isPublic(method, path, url) {
  if (method === 'OPTIONS') return true;
  if (PUBLIC_ROUTES.some(([m, p]) => m === method && p === path)) return true;
  // Vista de la orden para el cliente: solo por token (UUID), nunca por id
  if (method === 'GET' && path === '/api/ver-orden' && url.searchParams.get('token') && !url.searchParams.get('id')) return true;
  return false;
}

async function readTecnicoId(request, url) {
  const fromQuery = url.searchParams.get('tecnico_id');
  if (fromQuery) return fromQuery;
  if (request.method === 'GET' || request.method === 'HEAD') return null;
  const type = request.headers.get('Content-Type') || '';
  try {
    if (type.includes('application/json')) {
      const body = await request.clone().json();
      return body && body.tecnico_id != null ? String(body.tecnico_id) : null;
    }
    if (type.includes('form')) {
      const form = await request.clone().formData();
      return form.get('tecnico_id');
    }
  } catch (e) { /* body inválido: lo rechazará el endpoint */ }
  return null;
}

// Verifica que la orden consultada esté asignada al técnico de la sesión
async function ordenDelTecnico(env, url, tecnicoId) {
  const ordenId = url.searchParams.get('orden_id') || url.searchParams.get('id');
  if (!ordenId) return true;
  const orden = await env.DB.prepare(
    'SELECT tecnico_asignado_id FROM sgc_ord_OrdenesTrabajo WHERE id = ?'
  ).bind(ordenId).first();
  return !orden || orden.tecnico_asignado_id == null || Number(orden.tecnico_asignado_id) === tecnicoId;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (isPublic(request.method, path, url)) return context.next();

  const session = await validateSession(env, getSessionToken(request));
  if (!session) return jsonResponse({ success: false, error: 'No autorizado', code: 'AUTH_REQUIRED' }, 401);
  context.data.session = { ...session, token: getSessionToken(request) };

  if (session.isAdmin) return context.next();

  // Sesión de técnico: solo /api/tecnico/* y solo sus datos
  if (!path.startsWith('/api/tecnico/')) {
    return jsonResponse({ success: false, error: 'Acceso solo para administradores' }, 403);
  }
  const tecnicoParam = await readTecnicoId(request, url);
  if (tecnicoParam != null && Number(tecnicoParam) !== session.tecnicoId) {
    return jsonResponse({ success: false, error: 'No puedes operar como otro técnico' }, 403);
  }
  if (request.method === 'GET' && !(await ordenDelTecnico(env, url, session.tecnicoId))) {
    return jsonResponse({ success: false, error: 'La orden no está asignada a ti' }, 403);
  }
  return context.next();
}
