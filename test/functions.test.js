import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FakeD1 } from "./helpers/d1.js";
import { onRequest as middleware } from "../functions/api/_middleware.js";
import * as adminLogin from "../functions/api/admin/login.js";
import * as cambiarPassword from "../functions/api/admin/cambiar-password.js";
import * as tecnicoLogin from "../functions/api/tecnico/login.js";
import * as migrar from "../functions/api/admin/migrar.js";
import { onRequest as citasProxy } from "../functions/api/admin/citas-ia/[[path]].js";
import { sha256, hashPassword, verifyPassword } from "../functions/lib/auth.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function makeDb() {
  const db = new FakeD1();
  db.exec_(`
    CREATE TABLE sgc_ord_AdminUsers (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, nombre TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'admin', activo INTEGER DEFAULT 1, ultimo_login TEXT, fecha_creacion TEXT, tenant_id INTEGER DEFAULT 1);
    CREATE TABLE sgc_ord_SesionesAdmin (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, token TEXT NOT NULL UNIQUE, expira DATETIME NOT NULL, fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id INTEGER DEFAULT 1);
    CREATE TABLE sgc_ord_Tecnicos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, apellido TEXT DEFAULT '', telefono TEXT, email TEXT, especialidad TEXT, zona_cobertura TEXT, activo INTEGER DEFAULT 1, comision_porcentaje REAL NOT NULL DEFAULT 40, fecha_registro TEXT, pin TEXT, tenant_id INTEGER DEFAULT 1);
    CREATE TABLE sgc_ord_OrdenesTrabajo (id INTEGER PRIMARY KEY AUTOINCREMENT, numero_orden INTEGER, token TEXT, tecnico_asignado_id INTEGER, tenant_id INTEGER DEFAULT 1);
    INSERT INTO sgc_ord_Tecnicos (id, nombre, telefono, pin) VALUES (7, 'Pepe', '56911111111', '1234'), (8, 'Ana', '56922222222', '9999');
    INSERT INTO sgc_ord_OrdenesTrabajo (id, numero_orden, tecnico_asignado_id) VALUES (100, 1, 7), (101, 2, 8), (102, 3, NULL);
  `);
  return db;
}

async function adminWithLegacyHash(db, password = "admin123") {
  db.exec_(`INSERT INTO sgc_ord_AdminUsers (username, password_hash, nombre) VALUES ('admin', '${await sha256(password)}', 'Admin')`);
}

function req(method, path, { body, token, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (token) h["Authorization"] = `Bearer ${token}`;
  return new Request(`https://ordenes.test${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}

// Ejecuta el middleware; si deja pasar, responde 200 "NEXT"
async function throughMiddleware(env, request) {
  const context = { request, env, data: {}, next: async () => new Response("NEXT", { status: 200 }) };
  const res = await middleware(context);
  return { status: res.status, passed: (await res.clone().text()) === "NEXT", context };
}

async function loginAdmin(env, password = "admin123") {
  const res = await adminLogin.onRequestPost({ request: req("POST", "/api/admin/login", { body: { usuario: "admin", password } }), env });
  return { status: res.status, data: await res.json() };
}

async function loginTecnico(env, telefono, pin) {
  const res = await tecnicoLogin.onRequestPost({ request: req("POST", "/api/tecnico/login", { body: { telefono, pin } }), env });
  return { status: res.status, data: await res.json() };
}

test("todos los módulos de functions/ cargan sin errores de sintaxis ni imports", async () => {
  const files = [];
  const walk = (d) => readdirSync(d).forEach((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".js")) files.push(p);
  });
  walk(join(ROOT, "functions"));
  assert.ok(files.length > 50);
  for (const f of files) {
    const mod = await import(pathToFileURL(f).href);
    if (!relative(ROOT, f).includes("/lib/")) {
      assert.ok(Object.keys(mod).some((k) => k.startsWith("onRequest")), `${relative(ROOT, f)} exporta un handler`);
    }
  }
});

test("middleware: rutas públicas pasan sin sesión", async () => {
  const env = { DB: makeDb() };
  for (const [m, p] of [["POST", "/api/admin/login"], ["POST", "/api/tecnico/login"], ["GET", "/api/tracking?token=abc"],
    ["POST", "/api/public/crear-orden-express"], ["GET", "/api/imagen?key=ordenes/1/a.jpg"], ["POST", "/api/aprobar-orden"],
    ["POST", "/api/cancelar-orden"], ["GET", "/api/ver-orden?token=uuid"], ["OPTIONS", "/api/admin/tecnicos"]]) {
    const r = await throughMiddleware(env, req(m, p));
    assert.ok(r.passed, `${m} ${p}`);
  }
});

test("middleware: rutas admin exigen sesión (antes estaban abiertas)", async () => {
  const env = { DB: makeDb() };
  for (const [m, p] of [["GET", "/api/admin/todas-ordenes"], ["POST", "/api/admin/eliminar-orden"], ["GET", "/api/admin/exportar-datos"],
    ["POST", "/api/admin/fix-saldos"], ["POST", "/api/crear-orden"], ["PUT", "/api/editar-orden"], ["GET", "/api/buscar-patente?patente=X"],
    ["GET", "/api/ver-orden?id=1"], ["GET", "/api/ver-orden?id=1&token=x"], ["GET", "/api/public/listar-ordenes-express"],
    ["GET", "/api/tecnico/ordenes?tecnico_id=7"], ["GET", "/api/admin/citas-ia"]]) {
    const r = await throughMiddleware(env, req(m, p));
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.equal(r.passed, false);
  }
  const bad = await throughMiddleware(env, req("GET", "/api/admin/todas-ordenes", { token: "sgc_" + "x".repeat(40) }));
  assert.equal(bad.status, 401, "token inventado");
});

test("login admin: token aleatorio, sesión válida y migración de SHA-256 a PBKDF2", async () => {
  const db = makeDb();
  const env = { DB: db };
  await adminWithLegacyHash(db);
  const wrong = await loginAdmin(env, "otra");
  assert.equal(wrong.status, 401);
  assert.equal(wrong.data.error, "Usuario o contraseña incorrectos");

  const ok = await loginAdmin(env);
  assert.equal(ok.status, 200);
  assert.match(ok.data.token, /^sgc_[0-9a-f]{64}$/);
  assert.equal(ok.data.debe_cambiar_password, true);
  assert.match(db.row("SELECT password_hash FROM sgc_ord_AdminUsers").password_hash, /^pbkdf2\$100000\$/);
  assert.equal((await loginAdmin(env)).status, 200, "sigue funcionando con el hash migrado");

  const r = await throughMiddleware(env, req("GET", "/api/admin/todas-ordenes", { token: ok.data.token }));
  assert.ok(r.passed);
  assert.equal(r.context.data.session.username, "admin");
  const viaQuery = await throughMiddleware(env, req("GET", `/api/admin/exportar-datos?session=${ok.data.token}`));
  assert.ok(viaQuery.passed, "descargas con ?session=");

  const verify = await adminLogin.onRequestGet({ request: req("GET", `/api/admin/login?token=${ok.data.token}`), env });
  assert.equal(verify.status, 200);
  await adminLogin.onRequestDelete({ request: req("DELETE", "/api/admin/login", { token: ok.data.token }), env });
  assert.equal((await throughMiddleware(env, req("GET", "/api/admin/todas-ordenes", { token: ok.data.token }))).status, 401, "logout invalida la sesión");
});

test("login admin: ya no recrea admin/admin123 si no hay usuarios", async () => {
  const db = makeDb();
  const r = await loginAdmin({ DB: db });
  assert.equal(r.status, 401);
  assert.equal(db.row("SELECT COUNT(*) AS c FROM sgc_ord_AdminUsers").c, 0);
});

test("sesiones vencidas no autorizan", async () => {
  const db = makeDb();
  db.exec_(`INSERT INTO sgc_ord_SesionesAdmin (username, token, expira) VALUES ('admin', 'sgc_vencido_000000000000000000', '2020-01-01T00:00:00.000Z')`);
  assert.equal((await throughMiddleware({ DB: db }, req("GET", "/api/admin/tecnicos", { token: "sgc_vencido_000000000000000000" }))).status, 401);
});

test("cambiar contraseña: valida la actual, exige largo mínimo y cierra otras sesiones", async () => {
  const db = makeDb();
  const env = { DB: db };
  await adminWithLegacyHash(db);
  const s1 = (await loginAdmin(env)).data.token;
  const s2 = (await loginAdmin(env)).data.token;
  const call = async (token, body) => {
    const { context, passed } = await throughMiddleware(env, req("POST", "/api/admin/cambiar-password", { token, body }));
    assert.ok(passed);
    const res = await cambiarPassword.onRequestPost({ ...context, request: req("POST", "/api/admin/cambiar-password", { token, body }) });
    return { status: res.status, data: await res.json() };
  };
  assert.equal((await call(s1, { actual: "admin123", nueva: "corta" })).status, 400);
  assert.equal((await call(s1, { actual: "mala", nueva: "UnaClaveLarga2026" })).status, 401);
  assert.equal((await call(s1, { actual: "admin123", nueva: "UnaClaveLarga2026" })).status, 200);
  assert.equal((await loginAdmin(env, "admin123")).status, 401);
  assert.equal((await loginAdmin(env, "UnaClaveLarga2026")).status, 200);
  assert.equal((await throughMiddleware(env, req("GET", "/api/admin/tecnicos", { token: s2 }))).status, 401, "otra sesión cerrada");
  assert.ok((await throughMiddleware(env, req("GET", "/api/admin/tecnicos", { token: s1 }))).passed, "la sesión actual sigue");
});

test("login técnico: funciona (antes siempre daba 500) y entrega token", async () => {
  const env = { DB: makeDb() };
  assert.equal((await loginTecnico(env, "56911111111", "0000")).status, 401);
  const ok = await loginTecnico(env, "56911111111", "1234");
  assert.equal(ok.status, 200);
  assert.equal(ok.data.tecnico.id, 7);
  assert.match(ok.data.tecnico.token, /^sgc_/);
});

test("sesión de técnico: solo sus datos y solo /api/tecnico/*", async () => {
  const env = { DB: makeDb() };
  const token = (await loginTecnico(env, "56911111111", "1234")).data.tecnico.token;
  const t = (m, p, body) => throughMiddleware(env, req(m, p, { token, body }));

  assert.ok((await t("GET", "/api/tecnico/ordenes?tecnico_id=7")).passed);
  assert.equal((await t("GET", "/api/tecnico/ordenes?tecnico_id=8")).status, 403, "no puede leer órdenes de otro técnico");
  assert.equal((await t("POST", "/api/tecnico/cambiar-estado", { tecnico_id: 8, orden_id: 101 })).status, 403);
  assert.ok((await t("POST", "/api/tecnico/cambiar-estado", { tecnico_id: 7, orden_id: 100 })).passed);
  assert.ok((await t("GET", "/api/tecnico/fotos?orden_id=100")).passed);
  assert.equal((await t("GET", "/api/tecnico/fotos?orden_id=101")).status, 403, "fotos de una orden ajena");
  assert.ok((await t("GET", "/api/tecnico/orden?id=102&tecnico_id=7")).passed, "órdenes sin asignar (disponibles) visibles");
  assert.equal((await t("GET", "/api/admin/todas-ordenes")).status, 403, "un técnico no entra al panel admin");
});

test("sesión admin puede usar endpoints de técnico (panel)", async () => {
  const db = makeDb();
  const env = { DB: db };
  await adminWithLegacyHash(db);
  const token = (await loginAdmin(env)).data.token;
  assert.ok((await throughMiddleware(env, req("GET", "/api/tecnico/ordenes?tecnico_id=8", { token }))).passed);
});

test("migrar ya no toca el esquema", async () => {
  const db = makeDb();
  const before = db.rows("SELECT name, sql FROM sqlite_master");
  const res = await migrar.onRequestGet({ request: req("GET", "/api/admin/migrar"), env: { DB: db } });
  assert.equal(res.status, 200);
  assert.deepEqual(db.rows("SELECT name, sql FROM sqlite_master"), before);
});

test("proxy citas-ia: mapea rutas, agrega ADMIN_TOKEN del servidor y no filtra ?session", async (t) => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true }); };
  t.after(() => { globalThis.fetch = orig; });
  const env = { SGC_SAAS_URL: "https://saas.test", SGC_SAAS_ADMIN_TOKEN: "tok" };
  const run = (method, path, params, body) => citasProxy({ request: req(method, path, { body }), env, params: { path: params } });

  await run("GET", "/api/admin/citas-ia?estado=pendiente&session=abc", []);
  await run("GET", "/api/admin/citas-ia/rango?inicio=2026-01-01&fin=2026-01-31", ["rango"]);
  await run("POST", "/api/admin/citas-ia/5/rechazar", ["5", "rechazar"], { motivo: "x" });
  const bad = await run("GET", "/api/admin/citas-ia/../../etc", ["..", "etc"]);
  assert.equal(bad.status, 404);
  assert.deepEqual(calls.map((c) => c.url), [
    "https://saas.test/api/citas-admin?estado=pendiente",
    "https://saas.test/api/citas/rango?inicio=2026-01-01&fin=2026-01-31",
    "https://saas.test/api/citas-admin/5/rechazar"
  ]);
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
  assert.equal(calls[2].init.body, JSON.stringify({ motivo: "x" }));
  const noCfg = await citasProxy({ request: req("GET", "/api/admin/citas-ia"), env: {}, params: {} });
  assert.equal(noCfg.status, 503);
});

test("hash de contraseñas: PBKDF2 con salt distinto cada vez", async () => {
  const a = await hashPassword("secreto");
  const b = await hashPassword("secreto");
  assert.notEqual(a, b);
  assert.equal((await verifyPassword("secreto", a)).ok, true);
  assert.equal((await verifyPassword("otro", a)).ok, false);
  assert.deepEqual(await verifyPassword("admin123", await sha256("admin123")), { ok: true, legacy: true });
});
