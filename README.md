# SGC Ordenes Pages

Sistema de gestión de órdenes de trabajo del taller mecánico SGC.

## 🏗️ Arquitectura

- **Hosting**: Cloudflare Pages
- **Functions**: Pages Functions (55+ endpoints en `/functions/api/`)
- **DB**: Cloudflare D1 (tablas `sgc_ord_*`)
- **Storage**: Cloudflare R2 (bucket `my-emdash-media` para fotos)
- **Auth**: Token simple en memoria

## 📋 Estructura

```
.
├── index.html                # Crear orden (público)
├── orden-express.html        # Orden express
├── tracking.html             # Tracking de orden
├── calendario.html           # Calendario
├── express-web-dashboard.html # Dashboard express
├── app.js                    # App principal
├── tecnico/                  # App del técnico (PWA)
├── public/                   # Assets estáticos
├── functions/
│   └── api/
│       ├── admin/            # 23 endpoints admin
│       ├── tecnico/          # 11 endpoints técnico
│       ├── public/           # 2 endpoints públicos
│       └── ...               # 55+ total
└── wrangler.toml
```

## 🔧 Configuración

### Bindings
- `DB`: D1 database `citas`
- `FOTOS`: R2 bucket `my-emdash-media`

## 🚀 Deploy

```bash
wrangler pages deploy . --project-name=sgc-ordenes --branch=main
```

## 🔐 Login admin default

- Usuario: `admin`
- Password: `admin123`

## 📚 Documentación

- [README técnicos](README-TECNICOS.md)
- [Instalación](docs/INSTALACION.md)
