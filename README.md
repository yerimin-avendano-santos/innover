# 🗺️ INNOVER

**PropTech inmobiliaria peruana.** Mapa interactivo para buscar propiedades y CRM para agentes inmobiliarios.

Proyecto de aprendizaje full-stack: cada decisión técnica está documentada en el código con el *por qué*.

---

## 🚀 Arranque rápido

```bash
# 1. Instalar dependencias (backend, frontend y raíz)
npm install

# 2. Configurar el backend
cp backend/.env.example backend/.env
#    Edita backend/.env y pon tu DATABASE_URL y un JWT_SECRET largo.

# 3. Configurar el frontend
cp frontend/.env.example frontend/.env.local
#    Edita frontend/.env.local y pon tu token público de Mapbox.

# 4. Crear la base de datos y cargar datos de ejemplo
npm run migrate
npm run seed

# 5. Levantar
npm run dev:backend     # http://localhost:5000
npm run dev:frontend    # http://localhost:3000
```

### Cuentas de ejemplo (contraseña: `Demo1234`)

| Correo | Rol | Para ver |
|---|---|---|
| `admin@innover.dev` | Administrador | Panel `/admin`: verificar identidades, aprobar agentes, desactivar cuentas |
| `agente@innover.dev` | Agente | CRM de contactos y leads |
| `propietario@innover.dev` | Propietario | Leads directos sin intermediario |
| `cliente@innover.dev` | Comprador | Búsqueda y contacto |

---

## 🧭 Mapa del proyecto

```
INNOVER/
├── backend/          API Express 5 + Prisma 5 + PostgreSQL/PostGIS
│   ├── prisma/
│   │   ├── schema.prisma      El modelo de datos, comentado
│   │   ├── migrations/        Historial de cambios (SQL versionado)
│   │   └── seed.js            Datos de ejemplo de Huánuco
│   ├── scripts/
│   │   ├── pruebas.mjs        87 pruebas de integración y seguridad
│   │   ├── pruebas-puente.mjs 21 pruebas del puente frontend→backend
│   │   ├── backup-datos.mjs   Volcado de la base a JSON
│   │   ├── listar-usuarios.mjs      Quién está registrado
│   │   ├── verificar-geografia.mjs  Comprueba que cada propiedad cae en su distrito
│   │   └── limpiar-usuarios-prueba.mjs  Borra usuarios creados por las pruebas
│   └── src/
│       ├── config/      env.js (validación de entorno) · db.js (singleton)
│       ├── controllers/ Lógica de negocio
│       ├── middleware/  auth · validación · errores · seguridad
│       ├── routes/      Solo URLs y permisos
│       ├── schemas/     Contratos de entrada (Zod)
│       └── utils/       Errores tipados y utilidades
│
├── frontend/         Next.js 16 (App Router) + Tailwind 4 + Mapbox
│   └── src/
│       ├── app/
│       │   ├── api/[...ruta]/   Puente hacia el backend
│       │   ├── propiedad/[slug]/ Detalle
│       │   ├── publicar/        Alta y edición
│       │   ├── leads/            CRM del agente
│       │   └── admin/            Verificación de identidades y accesos
│       ├── components/ Mapa, ficha, filtros, navegación
│       ├── contextos/  Sesión (cookie httpOnly)
│       └── lib/        Cliente de API y tipos del dominio
│
└── docs/              ROADMAP y documentación conceptual
```

---

## 🔐 Decisiones de seguridad

Estas correcciones Shut el API por completo. Están documentadas en el código porque **el siguiente error suele ser reabrir una de estas puertas**:

| Riesgo | Cómo se cerró |
|---|---|
| Escalada de privilegios | El rol **no** se acepta en el registro. Todas las cuentas nacen `CLIENTE`; `AGENTE` requiere aprobación. |
| `/api/usuarios` abierta | Ahora exige `ADMIN`. Un `CLIENTE` recibe 403. |
| Robo de propiedades ajenas | `verificarDuenio` comprueba el dueño recurso por recurso, no solo el rol. |
| XSS en el mapa | Los popups se construyen con nodos DOM y `textContent`, nunca con `setHTML`. |
| Robo de sesión | Cookie `httpOnly` + `sameSite`. El token ya **no** está en `localStorage`. |
| Fuerza bruta | `express-rate-limit` en login: 10 intentos fallidos por IP cada 15 min. |
| CORS abierto | Lista blanca de orígenes en `CORS_ORIGENES`. |
| Datos sin validar | Zod en **todas** las entradas. Lo no permitido se descarta en silencio. |
| Enumeración de usuarios | El login responde igual para email inexistente y contraseña incorrecta. |
| Borrado destructivo | Baja lógica (`activo = false`), nunca `DELETE`. |
| Migración de datos | Historial versionado en `prisma/migrations/` + `npm run backup`. |

### Roles y permisos

```
PÚBLICO     GET /api/propiedades · /cercanas · /api/distritos
CLIENTE     + crear contactos, ver su perfil
AGENTE      + /propiedades/mias · /contactos/mis-leads · /publicar
PROPIETARIO + /contactos/mis-leads (leads directos, sin intermediario)
ADMIN       + /api/usuarios · panel /admin · verificar identidades · marcar destacado
```

---

## 🗺️ PostGIS

La base de datos usa la extensión PostGIS con un **trigger** que mantiene sincronizada la columna `locacion` a partir de `latitud`/`longitud`:

```sql
ST_DWithin(locacion, punto, radio)   -- ¿está dentro de 500 m?
locacion <-> punto                   -- ordenar por cercanía (índice KNN)
ST_Distance(locacion, punto)         -- distancia real en km
```

El OPERADOR `<->` usa el índice GIST, así que la búsqueda por cercanía es **tiempo constante** aunque haya cientos de miles de propiedades.

```bash
curl "http://localhost:5000/api/propiedades/cercanas?latitud=-9.9293&longitud=-76.2395&radioKm=2"
```

---

## 🧪 Pruebas

Con ambos servidores levantados:

```bash
npm run prueba              # 87 pruebas · backend
node backend/scripts/pruebas-puente.mjs   # 21 pruebas · puente completo
```

Cubren: autorización, XSS, validación, CORS, cookies, PostGIS, paginación, CRM y propagación de errores.

⚠️ Cada corrida crea usuarios de prueba. Para limpiarlo sin tocar las cuentas demo:

```bash
node backend/scripts/listar-usuarios.mjs                  # ver quién hay
node backend/scripts/limpiar-usuarios-prueba.mjs --ejecutar # borrar
```

---

## 🎨 Sistema de diseño

Tailwind v4 **CSS-first**: los tokens viven en `src/app/globals.css` dentro de `@theme`, no en un `tailwind.config.js`.

- **Tinta y papel** — grafito sobre papel técnico, no blanco puro
- **Señal** — un único color para acciones y selección
- **Latón** — color exclusivo del "destacado" pagado, separado de la señal
- **Cifras tabulares** — `font-variant-numeric: tabular-nums` para que los precios se alineen en columna
- **Accesibilidad** — foco visible, `aria-label` en marcadores, `role="alert"` en errores, `prefers-reduced-motion` respetado

El mapa es la página, no una tarjeta: ocupa media pantalla desde el primer segundo y los filtros son una barra horizontal.

---

## 📚 Documentación

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Fases 1 a 7 con su estado
- [`docs/01_CONCEPTOS_Y_MODELO_DATOS.md`](docs/01_CONCEPTOS_Y_MODELO_DATOS.md) — Fundamentos y modelo de datos
- [`docs/02_ARQUITECTURA_Y_SEGURIDAD.md`](docs/02_ARQUITECTURA_Y_SEGURIDAD.md) — Cómo encaja todo y por qué
- [`context.txt`](context.txt) — Contexto del negocio y monetización

---

## 🧰 Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev:backend` | Levanta la API con recarga automática |
| `npm run dev:frontend` | Levanta el frontend |
| `npm run build` | Compila el frontend para producción |
| `npm run lint` | Revisa el frontend |
| `npm run prueba` | Ejecuta las pruebas del backend |
| `npm run migrate` | Aplica las migraciones pendientes |
| `npm run seed` | Borra y recarga los datos de ejemplo |
| `npm run backup` | Descarga los datos a un JSON |

---

## ⚠️ Antes de desplegar

- [ ] `JWT_SECRET` propio y aleatorio (nunca el de desarrollo)
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGENES` con el dominio real, no `*`
- [ ] `DATABASE_URL` apuntando a la base de producción
- [ ] HTTPS obligatorio (la cookie usa `secure` en producción)
