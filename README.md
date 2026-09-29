# SGC Ordenes Pages

Sistema completo de gestión de órdenes de trabajo. Pensado para talleres mecánicos pero adaptable a cualquier negocio con órdenes de servicio (electrodomésticos, computación, etc.).

## 🏗️ Arquitectura

- **Hosting**: Cloudflare Pages (gratis)
- **Backend**: Pages Functions (55+ endpoints en `/functions/api/`)
- **DB**: Cloudflare D1 (tablas `sgc_ord_*`)
- **Storage**: Cloudflare R2 (bucket para fotos)
- **Auth**: Token simple en memoria (compatible con sesión admin)

## ✨ Funcionalidades

### Crear orden (público)
- Formulario web público `/index.html`
- Búsqueda de cliente por patente
- Multi-servicio por orden
- Carga de fotos del vehículo
- Firma digital del cliente
- Domicilio o taller (con cálculo de distancia)

### Orden express
- Flujo simplificado para servicios rápidos
- Dashboard express para administrar

### Tracking público
- Cliente sigue su orden por URL con token
- Estados: Enviada → En proceso → Completada → Entregada
- Fotos del trabajo en progreso
- Notas del técnico

### Panel admin (55+ endpoints)
- Login con token
- CRUD completo de órdenes
- Asignación de técnicos
- Costos adicionales (mano de obra + repuestos)
- Liquidación de técnicos (comisiones automáticas)
- Gastos del negocio
- Modelos de vehículo
- Catálogo de servicios
- Exportar datos (CSV/JSON)
- Notificaciones WhatsApp (vía UltraMsg)

### App del técnico (PWA)
- `/tecnico/app.html` — instalable en móvil
- Offline-first con Service Worker
- Ver órdenes asignadas
- Cambiar estado
- Subir fotos del trabajo
- Agregar notas
- Cerrar orden con firma del cliente
- Tracking GPS

### Calendario
- Vista mensual de órdenes
- Filtros por técnico / estado

## 📋 Estructura

```
.
├── index.html                # Crear orden (público)
├── orden-express.html        # Orden express
├── tracking.html             # Tracking público
├── calendario.html           # Calendario
├── express-web-dashboard.html # Dashboard express
├── app.js                    # App principal (front-end)
├── tecnico/                  # PWA del técnico
│   ├── app.html
│   ├── app.js
│   ├── manifest.json
│   └── sw.js
├── public/                   # Assets estáticos (logos, icons)
├── functions/
│   └── api/
│       ├── admin/            # 23 endpoints admin
│       │   ├── login.js
│       │   ├── todas-ordenes.js
│       │   ├── asignar-orden.js
│       │   ├── liquidar-tecnicos.js
│       │   └── ...
│       ├── tecnico/          # 11 endpoints técnico
│       │   ├── login.js
│       │   ├── ordenes.js
│       │   ├── subir-foto.js
│       │   └── ...
│       ├── public/           # 2 endpoints públicos
│       │   ├── crear-orden-express.js
│       │   └── listar-ordenes-express.js
│       ├── crear-orden.js
│       ├── buscar-patente.js
│       ├── aprobar-orden.js
│       └── ...               # 55+ total
└── wrangler.toml
```

## 🔧 Configuración

### Variables (wrangler.toml)
| Variable | Descripción | Default |
|---|---|---|
| `ENVIRONMENT` | Ambiente | `production` |

### Bindings
- `DB` — D1 database `citas` (tablas `sgc_ord_*`)
- `FOTOS` — R2 bucket para fotos de trabajos

## 🚀 Deploy

```bash
git clone https://github.com/bboymak3/sgc-ordenes-pages.git
cd sgc-ordenes-pages

# Editar wrangler.toml con tu database_id
nano wrangler.toml

# Deploy
wrangler pages deploy . --project-name=sgc-ordenes --branch=main
```

## 🔐 Login admin default

- Usuario: `admin`
- Password: `admin123`

## 📚 Documentación adicional

- [README técnicos](README-TECNICOS.md) — Manual para técnicos que usan la PWA
- [Instalación](docs/INSTALACION.md) — Setup detallado

## 📚 Repos relacionados

- [sgc-citas-worker](https://github.com/bboymak3/sgc-citas-worker) — Bot WhatsApp con IA
- [sgc-admin-pages](https://github.com/bboymak3/sgc-admin-pages) — Panel admin
- [sgc-recordatorios-worker](https://github.com/bboymak3/sgc-recordatorios-worker) — Recordatorios

## 🔄 Multi-tenant

Para usar con múltiples negocios:

### 1 cuenta por cliente
- Deploya en cuenta Cloudflare del cliente
- Apunta `DB` a su D1
- Apunta `FOTOS` a su R2 bucket (o uno compartido)

### 1 sola cuenta tuya (multi-tenant real)
- Agregar `tenant_id` a todas las tablas `sgc_ord_*`
- Middleware que filtra queries por tenant
- Login con selector de negocio

## 💰 Costo mensual: $0

- Cloudflare Pages: $0 (500 builds/mes)
- D1: $0 (5M reads/día)
- R2: $0 (10GB gratis)

## 📄 Licencia

Propietario — SGC
