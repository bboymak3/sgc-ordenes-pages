// E2E en Chromium contra `wrangler pages dev` con D1 local.
// Preparación (ver README, sección Pruebas):
//   npx wrangler d1 execute citas --local --file=../sgc-saas/worker/schema/schema.sql
//   (aplicar ../sgc-saas/worker/migrations/*.sql y cargar admin/técnico de prueba)
//   npx wrangler pages dev . --port 8788
//   BASE_URL=http://127.0.0.1:8788 node --test test/e2e/ordenes.e2e.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8788";
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function newPage(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const api = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin === BASE && u.pathname.startsWith("/api/")) api.push({ path: u.pathname, auth: r.headers()["authorization"] || null });
  });
  const responses = [];
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.origin === BASE && u.pathname.startsWith("/api/")) responses.push({ path: u.pathname, status: r.status() });
  });
  page.on("dialog", (d) => d.dismiss());
  return { page, api, responses };
}

test("panel admin: login, todas las llamadas llevan sesión y no hay 401", async (t) => {
  const { page, api, responses } = await newPage(t);
  await page.goto(`${BASE}/index.html`);
  await page.fill("#login-usuario", "admin");
  await page.fill("#login-password", "admin123");
  await page.click("#login-btn");
  await page.waitForSelector("#main-app", { state: "visible" });
  await page.waitForLoadState("networkidle");
  const afterLogin = api.filter((a) => a.path !== "/api/admin/login");
  assert.ok(afterLogin.length > 0, "el panel hace llamadas a la API");
  assert.deepEqual(afterLogin.filter((a) => !a.auth).map((a) => a.path), [], "todas llevan Authorization");
  assert.deepEqual(responses.filter((r) => r.status === 401).map((r) => r.path), [], "ninguna es rechazada");

  await page.reload();
  await page.waitForSelector("#main-app", { state: "visible" });
  await page.evaluate(() => localStorage.setItem("gp_admin_token", "sgc_token_invalido_000000000000000000"));
  await page.reload();
  await page.waitForFunction(() => /sesión expiró/i.test(document.getElementById("login-error")?.textContent || ""));
});

test("app técnico: login con PIN (antes daba 500) y ve su orden", async (t) => {
  const { page, api, responses } = await newPage(t);
  await page.goto(`${BASE}/tecnico/app.html`);
  await page.fill("#telefono-login", "56911111111");
  await page.fill("#pin-login", "1234");
  await page.click("text=Ingresar");
  await page.waitForSelector("#app-screen", { state: "visible" });
  await page.waitForLoadState("networkidle");
  const calls = api.filter((a) => a.path.startsWith("/api/tecnico/") && a.path !== "/api/tecnico/login");
  assert.ok(calls.length > 0);
  assert.ok(calls.every((c) => c.auth && c.auth.startsWith("Bearer sgc_")), "llamadas con token del técnico");
  assert.deepEqual(responses.filter((r) => r.status >= 400).map((r) => `${r.status} ${r.path}`), []);
  assert.match(await page.textContent("body"), /ABCD12|#?0*1\b/);
});

test("páginas públicas del cliente siguen funcionando sin login", async (t) => {
  const { page, responses } = await newPage(t);
  await page.goto(`${BASE}/tracking.html?token=tok-uuid-1`);
  await page.waitForLoadState("networkidle");
  await page.goto(`${BASE}/aprobar?token=tok-uuid-2`);
  await page.waitForLoadState("networkidle");
  assert.match(await page.textContent("body"), /EFGH34|Ana|orden/i);
  assert.deepEqual(responses.filter((r) => r.status === 401).map((r) => r.path), []);
});
