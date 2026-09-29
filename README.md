# SGC Ordenes Pages — Sistema de órdenes de trabajo (legacy single-tenant)

![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)
![Pages Functions](https://img.shields.io/badge/Pages-Functions-F38020?logo=cloudflare&logoColor=white)
![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1-F38020?logo=cloudflare&logoColor=white)
![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2-F38020?logo=cloudflare&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)

> ⚠️ **Nota — Legacy single-tenant.**
> Este repositorio es una implementación legacy single-tenant (un negocio = un deploy).
> Para arquitectura multi-tenant real, usar [`sgc-saas`](https://github.com/bboymak3/sgc-saas).

Sistema completo de gestión de órdenes de trabajo orientado a talleres mecánicos,
pero adaptable a cualquier negocio con órdenes de servicio (electrodomésticos,
computación, etc.). Desplegado en producción en
**<https://sgc-ordenes-di7.pages.dev>**.

---

## 🏗️ Arquitectura

```
                ┌─────────────────────────────────────────────┐
                │              Cloudflare Pages               │
   Browser ───► │  index.html · app.js · tracking.html · PWA  │
   (cliente /   │  express-web-dashboard.html · calendario    │
    admin /     │            ▲                                 │
    técnico)    │            │ Pages Functions                 │
                │  ┌─────────┴──────────┐                     │
                │  │  /functions/api/*  │  (55+ endpoints)     │
                │  └──────┬─────┬───────┘                     │
                └─────────┼─────┼─────────────────────────────┘
                          │     │
              ┌───────────▼─┐ ┌─▼──────────┐  ┌──────────────────┐
              │  D1 (DB)    │ │  R2 (FOTOS)│  │ UltraMsg / Evo   │
              │  citas      │ │ my-emdash- │  │ (WhatsApp)       │
              │ sgc_ord_*   │ │  media     │  └──────────────────┘
              └─────────────┘ └────────────┘
```

---

## 🧰 Tech Stack

| Capa              | Tecnología                                              |
|-------------------|---------------------------------------------------------|
| Hosting           | Cloudflare Pages                                        |
| Backend           | Pages Functions (55+ endpoints en `/functions/api/`)    |
| Base de datos     | Cloudflare D1 (database `citas`, tablas `sgc_ord_*`)    |
| Storage objetos   | Cloudflare R2 (bucket `my-emdash-media`)               |
| Auth              | Token simple en memoria (sesión admin)                 |
| PWA               | Service Worker + Web App Manifest (app del técnico)    |
| Frontend          | HTML / CSS / JavaScript vanilla                         |
| WhatsApp notif.   | UltraMsg API (legacy) o Evolution API                   |
| Geocoding         | Nominatim OpenStreetMap (cálculo de distancia)          |

---

## 📡 APIs y Endpoints (55+)

### 🔐 Admin — `/api/admin/*` (23 rutas)

| Método               | Ruta                                  | Descripción                                |
|----------------------|---------------------------------------|--------------------------------------------|
| POST                 | `/api/admin/login`                    | Autenticación admin (user `admin` / `admin123`) |
| GET                  | `/api/admin/todas-ordenes`            | Listado completo de órdenes                |
| GET                  | `/api/admin/ordenes-asignadas`        | Órdenes ya asignadas a un técnico          |
| GET                  | `/api/admin/ordenes-disponibles`      | Órdenes sin asignar                        |
| GET                  | `/api/admin/ordenes-aprobadas`        | Órdenes aprobadas por el cliente           |
| GET                  | `/api/admin/ordenes-express`          | Órdenes express                            |
| POST                 | `/api/admin/asignar-orden`            | Asignar orden a técnico                    |
| POST                 | `/api/admin/liberar-orden`            | Liberar orden de un técnico                |
| POST                 | `/api/admin/eliminar-orden`           | Eliminar orden                             |
| GET/POST/PUT/DELETE  | `/api/admin/tecnicos`                 | CRUD de técnicos                           |
| GET/POST             | `/api/admin/modelos-vehiculo`         | Listar / crear modelos de vehículo         |
| GET/POST             | `/api/admin/servicios-catalogo`       | Catálogo de servicios                      |
| GET/POST/PUT/DELETE  | `/api/admin/costos-adicionales`       | Costos adicionales (MO + repuestos)        |
| GET/POST/PUT/DELETE  | `/api/admin/gastos`                   | Gastos del negocio                         |
| GET/POST             | `/api/admin/adelantos-tecnico`        | Adelantos pagados a técnicos               |
| POST                 | `/api/admin/liquidar-ordenes`         | Liquidar órdenes                           |
| POST                 | `/api/admin/liquidar-tecnicos`        | Liquidar comisiones de técnicos            |
| GET                  | `/api/admin/liquidacion-canceladas`   | Liquidaciones canceladas                   |
| GET                  | `/api/admin/resumen-pagos`            | Resumen de pagos                           |
| GET                  | `/api/admin/dashboard-negocio`        | KPIs del negocio                           |
| GET                  | `/api/admin/notificaciones`           | Notificaciones WhatsApp enviadas           |
| POST                 | `/api/admin/config-domicilio`         | Configuración de cargo por domicilio       |
| POST                 | `/api/admin/fix-saldos`               | Reparar saldos inconsistentes              |
| POST                 | `/api/admin/migrar`                   | Migraciones de esquema                     |
| GET                  | `/api/admin/exportar-datos`           | Exportar datos (CSV/JSON)                  |
| POST                 | `/api/admin/ultramsg`                 | Envío manual de WhatsApp vía UltraMsg      |
| GET                  | `/api/admin/calendario`               | Órdenes para vista calendario              |
| GET                  | `/api/admin/test-r2`                  | Diagnóstico de conexión a R2               |

### 👷 Técnico — `/api/tecnico/*` (11 rutas)

| Método | Ruta                                    | Descripción                          |
|--------|-----------------------------------------|--------------------------------------|
| POST   | `/api/tecnico/login`                    | Autenticación técnico                |
| GET    | `/api/tecnico/ordenes`                  | Órdenes asignadas al técnico         |
| GET    | `/api/tecnico/orden/:id`                | Detalle de una orden                 |
| POST   | `/api/tecnico/cambiar-estado`           | Cambiar estado (en proceso, etc.)    |
| POST   | `/api/tecnico/cerrar-orden`             | Cerrar orden con firma del cliente   |
| POST   | `/api/tecnico/subir-foto`               | Subir foto del trabajo a R2          |
| GET    | `/api/tecnico/fotos`                    | Listar fotos de una orden            |
| POST   | `/api/tecnico/agregar-nota`             | Agregar nota del técnico             |
| GET    | `/api/tecnico/notas`                    | Listar notas de una orden            |
| GET    | `/api/tecnico/historial`                | Historial de órdenes del técnico     |
| POST   | `/api/tecnico/generar-token-firma`      | Generar token para firma digital     |
| GET    | `/api/tecnico/tracking`                 | Tracking GPS del técnico             |

### 🌐 Públicos — `/api/*` y `/api/public/*`

| Método | Ruta                                       | Descripción                              |
|--------|--------------------------------------------|------------------------------------------|
| POST   | `/api/crear-orden`                         | Crear orden desde el form web público    |
| GET    | `/api/buscar-patente?patente=`             | Buscar cliente/vehículo por patente      |
| GET    | `/api/buscar-ordenes?patente=`             | Buscar órdenes por patente               |
| GET    | `/api/proximo-numero-orden`                | Próximo número de orden disponible       |
| POST   | `/api/aprobar-orden`                       | Cliente aprueba la orden                 |
| POST   | `/api/cancelar-orden`                      | Cancelar orden                           |
| GET    | `/api/ver-orden`                           | Ver orden por token (público)            |
| GET    | `/api/tracking`                            | Tracking público de la orden             |
| POST   | `/api/editar-orden`                        | Editar orden                             |
| GET    | `/api/imagen`                              | Servir imagen almacenada en R2           |
| POST   | `/api/public/crear-orden-express`          | Crear orden express (público)            |
| GET    | `/api/public/listar-ordenes-express`       | Listar órdenes express                    |

### 🔌 Connectores externos

- **D1 (`DB`)** — tablas `sgc_ord_*` (ver [tablas](#-tablas-d1-utilizadas)).
- **R2 (`FOTOS`)** — bucket `my-emdash-media`, guarda fotos de los trabajos.
- **UltraMsg API** — envío de notificaciones WhatsApp (legacy).
- **Nominatim / OpenStreetMap** — geocoding inverso para cálculo de distancia y cargo por domicilio.

---

## 🧩 Funciones principales (helpers)

Ubicados en `functions/lib/`:

| Archivo                  | Función                                                              |
|--------------------------|----------------------------------------------------------------------|
| `db-helpers.js`          | Helpers SQL comunes (queries parametrizadas, paginación, etc.)       |
| `s3-client.js`           | Cliente R2 (S3 compatible) para subir/listar fotos                   |
| `notificaciones.js`      | Envío de WhatsApp vía UltraMsg / Evolution                           |
| `calculo-distancia.js`   | Cálculo de distancia y cargo por servicios a domicilio               |

---

## 🎨 Frontend (`app.js` ~459 KB)

Front-end principal en HTML/CSS/JS vanilla. Incluye:

- Gestión completa de órdenes (crear, editar, aprobar, cancelar).
- Asignación de técnicos.
- Carga de fotos del vehículo / trabajo.
- Firma digital del cliente.
- Tracking GPS.
- Cálculo de distancia y cargo por domicilio.
- Calendario mensual de órdenes con filtros.

Páginas HTML:

| Archivo                      | Rol                                            |
|------------------------------|------------------------------------------------|
| `index.html`                 | Crear orden (form público)                     |
| `orden-express.html`         | Orden express                                  |
| `tracking.html`              | Tracking público de la orden                   |
| `calendario.html`            | Vista calendario                               |
| `express-web-dashboard.html` | Dashboard de órdenes express                   |

---

## 📱 PWA del técnico (`tecnico/`)

| Archivo          | Rol                                            |
|------------------|------------------------------------------------|
| `app.html`       | UI de la PWA                                   |
| `app.js`         | Lógica de la app del técnico                   |
| `manifest.json`  | Web App Manifest (instalable)                  |
| `sw.js`          | Service Worker (offline-first)                 |

Funcionalidades:

- Instalable en móvil (Add to Home Screen).
- Offline-first con Service Worker.
- Ver órdenes asignadas.
- Cambiar estado (en proceso, completada).
- Subir fotos del trabajo.
- Agregar notas.
- Cerrar orden con firma del cliente.
- Tracking GPS.

---

## 🗄️ Tablas D1 utilizadas

Esquema con prefijo `sgc_ord_`:

- `sgc_ord_OrdenesTrabajo`, `sgc_ord_Vehiculos`, `sgc_ord_Clientes`, `sgc_ord_Tecnicos`
- `sgc_ord_AdminUsers`, `sgc_ord_SesionesAdmin`
- `sgc_ord_AdelantosTecnico`, `sgc_ord_AgendaTecnicos`
- `sgc_ord_CostosAdicionales`, `sgc_ord_FotosTrabajo`, `sgc_ord_GastosNegocio`
- `sgc_ord_LiquidacionCanceladas`, `sgc_ord_LiquidacionOrden`
- `sgc_ord_ModelosVehiculo`, `sgc_ord_NotasTrabajo`, `sgc_ord_NotificacionesWhatsApp`
- `sgc_ord_Pagos`, `sgc_ord_ServiciosCatalogo`
- `sgc_ord_ConfigKV`, `sgc_ord_Configuracion`

---

## ⚙️ Configuración

### `wrangler.toml`

| Variable       | Descripción        | Default       |
|----------------|--------------------|---------------|
| `ENVIRONMENT`  | Ambiente de deploy | `production`  |

### Bindings

- `DB` — D1 database `citas` (id `678b4adc-232d-43db-86ec-230828268161`).
- `FOTOS` — R2 bucket `my-emdash-media`.

> Sin secrets gestionados en este repo. El token de UltraMsg se hardcodea o se
> pasa vía `vars` (legacy). Para producción se recomienda moverlo a un secret.

---

## 🚀 Deploy

```bash
git clone https://github.com/bboymak3/sgc-ordenes-pages.git
cd sgc-ordenes-pages

# (Opcional) editar wrangler.toml con tu database_id y bucket
# nano wrangler.toml

# Deploy a Cloudflare Pages
wrangler pages deploy . --project-name=sgc-ordenes --branch=main
```

URL de producción: **<https://sgc-ordenes-di7.pages.dev>**

### 🔐 Login admin default

- Usuario: `admin`
- Password: `admin123`

---

## 📚 Documentación adicional

- [README-TECNICOS.md](README-TECNICOS.md) — Manual para técnicos que usan la PWA.
- [docs/INSTALACION.md](docs/INSTALACION.md) — Setup detallado.

---

## 🔗 Repos relacionados

- [`sgc-saas`](https://github.com/bboymak3/sgc-saas) — Versión multi-tenant.
- [`sgc-citas-worker`](https://github.com/bboymak3/sgc-citas-worker) — Bot WhatsApp con IA para citas.
- [`sgc-admin-pages`](https://github.com/bboymak3/sgc-admin-pages) — Panel admin global.
- [`sgc-recordatorios-worker`](https://github.com/bboymak3/sgc-recordatorios-worker) — Recordatorios automáticos.

---

## 💰 Costo mensual: $0

- Cloudflare Pages: $0 (500 builds/mes).
- D1: $0 (5M reads/día).
- R2: $0 (10 GB gratis).

---

## 📄 Licencia

Propietario — SGC. Todos los derechos reservados.

---

## Seguridad y pruebas (2026-09-29)

- **Autenticación en todas las rutas `/api/*`** (`functions/api/_middleware.js`):
  - Públicas: `POST /api/admin/login`, `POST /api/tecnico/login`, `GET /api/tracking?token=`, `GET /api/ver-orden?token=`,
    `POST /api/aprobar-orden`, `POST /api/cancelar-orden` (por token UUID de la orden), `POST /api/public/crear-orden-express`, `GET /api/imagen`.
  - Técnico: `/api/tecnico/*` con sesión de técnico; solo puede operar sus propias órdenes.
  - Admin: todo lo demás. El panel envía `Authorization: Bearer <token>` automáticamente.
- Sesiones en `sgc_ord_SesionesAdmin` con token aleatorio (`crypto.randomUUID`) y expiración UTC; logout con `DELETE /api/admin/login`.
- Contraseñas con PBKDF2 + salt; los hashes SHA-256 antiguos se migran solos al iniciar sesión. Ya no se recrea `admin/admin123`.
  **Cambia la contraseña por defecto** desde el menú "Cambiar contraseña" (el panel lo pide al entrar con `admin123`).
- `/api/admin/migrar` desactivado (podía reconstruir `sgc_ord_OrdenesTrabajo` en una tabla sin prefijo). El esquema se gestiona con
  las migraciones de `sgc-saas/worker/migrations`.
- Citas del bot: el panel usa el proxy `/api/admin/citas-ia/*` hacia `sgc-saas` (secret `SGC_SAAS_ADMIN_TOKEN`), en lugar del
  worker viejo `sgc-citas.correo36000.workers.dev`.

### Pruebas

```bash
npm test                      # middleware, logins, sesiones, proxy y carga de los 60 módulos de functions/
# E2E (requiere: npm i -D playwright wrangler)
npx wrangler d1 execute citas --local --file=../sgc-saas/worker/schema/schema.sql
for f in ../sgc-saas/worker/migrations/*.sql; do npx wrangler d1 execute citas --local --file=$f; done
npx wrangler pages dev . --port 8788 &
BASE_URL=http://127.0.0.1:8788 node --test test/e2e/ordenes.e2e.js
```
