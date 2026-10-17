# AGENTS.md · INNOVER

Instrucciones para agentes que trabajan en este repo. Node ≥ 20, npm workspaces.

`frontend/AGENTS.md` (lo regenera `next dev`) tiene además las reglas de Next.js 16. Léelo antes de tocar el frontend.

---

## Comandos

Todo se ejecuta **desde la raíz** salvo el typecheck.

| Qué | Comando |
|---|---|
| API (con recarga) | `npm run dev:backend` → :5000 |
| Frontend | `npm run dev:frontend` → :3000 |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Tests API | `npm run prueba` |
| Tests del puente | `node backend/scripts/pruebas-puente.mjs` |
| Migraciones | `npm run migrate` |
| Datos de ejemplo | `npm run seed` |
| Copia de seguridad | `npm run backup` |
| Verificar geografía | `npm run verificar:geo` |
| Verificar contraste | `npm run verificar:contraste --workspace=frontend` |
| Verificar tokens | `npm run verificar:tokens --workspace=frontend` (tras `build`) |
| Verificar clases | `npm run verificar:clases --workspace=frontend` (tras `build`) |

### Typecheck — usa esta forma exacta

```bash
cd frontend && .\node_modules\.bin\tsc.cmd --noEmit
```

⛔ **`npx tsc` NO funciona.** Resuelve al paquete npm `tsc@2.0.4` (un squat que no es TypeScript) y falla con `EJSONPARSE`. No existe script `typecheck`: hay que llamar al binario del workspace. En Linux/macOS: `npx tsc` sí funciona porque el paquete local gana.

### Orden de verificación

```bash
npm run lint
cd frontend && .\node_modules\.bin\tsc.cmd --noEmit
npm run build
npm run verificar:contraste --workspace=frontend   # paleta legible, lee globals.css
npm run verificar:tokens  --workspace=frontend     # ningún token huérfano (necesita build)
npm run verificar:clases  --workspace=frontend     # ninguna clase muerta (necesita build)
npm run prueba        # requiere el backend levantado
```

`next build` ya incluye typecheck, así que `build` es la prueba definitiva.

Los tres `verificar:*` son del frontend y cubren lo que ni el linter ni el
compilador pueden ver: un color que no se lee, un token que se renombró y
dejó de pintarse, y una clase escrita mal. Ninguna de las tres cosas da
error — solo se ven mal, y suele ser en una pantalla que casi nadie abre.

---

## ⚠️ La base de datos es REMOTA y COMPARTIDA

`backend/.env` apunta a **Supabase en la nube** (`aws-*.pooler.supabase.com`), no a un Postgres local. Hay un servicio Windows `postgresql-x64-18` instalado pero **detenido**: no lo arranques, no es el que usa el proyecto.

Consecuencias:

- **`npm run seed` BORRA los datos reales.** Hace `deleteMany()` en `SolicitudAgente`, `Contacto`, `Propiedad`, `Distrito` y `Usuario` antes de insertar. Es un reset de desarrollo, no un script idempotente.
- **`prisma migrate dev` corre contra esa base compartida.** Úsalo solo si hace falta de verdad; para aplicar lo ya escrito, `npm run migrate` (que es `migrate deploy`).
- Antes de tocar el esquema: `npm run backup` (descarga todo a `backend/backups/`).

---

## Tests

Dos suites, ambas de integración contra el backend **real** (no hay mocks). Requieren el servidor arriba, si no mueren con `ECONNREFUSED`.

```bash
npm run dev:backend                      # terminal 1
npm run prueba                           # terminal 2 → 153 pruebas

npm run dev:frontend                     # terminal 1 (además del backend)
node backend/scripts/pruebas-puente.mjs  # terminal 2 → 27 pruebas
```

**`pruebas-puente.mjs` no tiene script en package.json** — hay que invocarlo con la ruta completa, y necesita frontend **y** backend.

### ⛔ La suite se auto-bloquea, y el que la bloquea no es el que vigilas

Hay **tres** limitadores, y una corrida de la suite toca dos:

| Limitador | Tope | Lo que gasta una corrida |
|---|---|---|
| `limitadorAuth` | 10 **fallos** de login / 15 min | 6 |
| `limitadorEscritura` | 20 escrituras / **hora** | 11 |
| `limitadorGeneral` | 300 peticiones / 15 min | sobra |

El que engaña es **`limitadorEscritura`**: su ventana dura una hora, no quince
minutos, y no tiene nada que ver con el login. Como la suite gasta 11 de 20,
**dos corridas seguidas suman 22 y la segunda se corta a mitad**. Su síntoma
es el peor posible: 18 pruebas fallan de golpe, sin relación entre sí, y
parece que acabas de romper el código.

No es un bug. Los contadores viven **en memoria**, así que reiniciar el
backend los pone a cero:

```bash
npm run dev:backend
```

Si vas a iterar mucho, súbelos en `backend/.env` (y reinicia):

```bash
RATE_LIMIT_AUTH=100
RATE_LIMIT_ESCRITURA=200
```

Dos protecciones para no volver a confundirlo con un bug:

- La suite **avisa antes de empezar** si al limitador de login le quedan menos
  de 6 intentos (lee `RateLimit-Remaining` de un login correcto, que no
  gasta). Sale con código 2 y dice qué hacer.
- La suite **aborta en el primer `429`** y dice qué limitador fue. Antes no lo
  hacía, y por eso el fallo de escritura se manifestaba como 18 fallos sueltos
  en lugar de un mensaje. El de escritura no se puede sondear antes —su
  cabecera solo llega en una respuesta de escritura, y sondearlo gastaría una
  de las 20—, así que se detecta al chocar.

Ambas suites cubren la API a mano mejor que un archivo de peticiones: incluyen los casos que importan (escalada de privilegios, XSS, ownership) que sería fácil olvidar documentar.

---

## Arquitectura: lo que no se deduce de los nombres

### El navegador NUNCA habla con el backend

Todo va por rutas relativas `/api/...` → `src/app/api/[...ruta]/route.ts` (catch-all) → `BACKEND_URL`. Por eso:

- no hay `NEXT_PUBLIC_BASE_URL` en el código (verifícalo antes de añadirlo)
- `BACKEND_URL` **no** lleva prefijo `NEXT_PUBLIC_` a propósito: solo la ve el servidor
- el puente reenvía `cookie` y copia `set-cookie`. Si tocas eso, rompes la sesión

### Sesión por cookie httpOnly

El token **no** está en `localStorage`. `contextos/Auth.tsx` guarda solo los datos del usuario; nunca el token. No "simplifiques" a `localStorage`.

### El plan es un eje aparte del rol

`rol` dice **qué hace** alguien (compra, vende, intermedia). `plan` dice **qué puede pagar**. Son independientes, y eso es deliberado: un `PROPIETARIO` con plan PRO tiene recorrido 3D igual que un `AGENTE` con plan PRO. Si el plan fuera un rol habría que inventar `AGENTE_PRO`, `AGENTE_GRATIS`, `PROPIETARIO_PRO`… y cada combinación nueva multiplicaría los valores.

- `tienePlanPro(usuario)` en `backend/src/utils/plan.js` es **el único sitio** que decide. No escribas `usuario.plan === 'PRO'` a mano: el plan **vence** (`plan_vence`), y repartir esa comparación por el código basta para que un punto se olvide de la fecha y alguien que dejó de pagar conserve las ventajas para siempre.
- **En la interfaz, para decidir usa `plan_pro_activo`; `plan` y `plan_vence` son solo para pintar texto.** La API devuelve el veredicto ya calculado justo para que el frontend no repita la comparación sin mirar la fecha. Si la repitiera, el fallo no se vería al renderizar: el formulario del 3D aparecería igual, y el usuario se enteraría de que su PRO venció al guardar y recibir un 403.
- **`tienePlanPro` falla en cerrado si `plan_vence` llega `undefined`.** Prisma devuelve `null` cuando pide la columna y la base tiene NULL (cortesía: no vence), y `undefined` cuando **no la pide**. Ese `undefined` es un error de programación, no un dato, así que se trata como "no vale". Si se tratara como "no vence" el fallo sería mudo y regalaría el producto: basta con añadir un `select` nuevo sin `plan_vence: true`. El precio de fallar en cerrado es un 403 visible para quien sí paga — molesto, se reporta, se arregla.
- **Los campos de pago se escriben en un `select` explícito, y ese `select` se olvida.** Ya pasó: `obtenerMiPerfil` tenía su propia lista de campos y no incluía `plan`/`plan_vence`, así que `plan_pro_activo` habría salido `false` para todo el mundo. Si añades un endpoint que devuelve usuarios, pasa el resultado por `usuarioPublico()` (auth) o por `conPlanActivo()` (admin) en vez de esparcir la fila con `...datos`.
- Las funciones que lo consumen son `resolverTour3D()` y `resolverDestacado()` en `propiedadController.js`. El candado está **en el servidor**: esconder el campo en el formulario no protege nada, cualquiera manda el JSON a mano.
- **El plan no se acepta del usuario en ningún endpoint.** Se cambia con `PATCH /api/usuarios/:id/plan`, que exige `ADMIN`. `actualizarUsuarioAdminSchema` no incluye `plan`: Zod lo descarta en silencio, así que `PUT /api/usuarios/5 { "plan": "PRO" }` no hace nada.
- **El PRO se pierde al vencer, pero el 3D ya publicado se conserva.** `resolverTour3D` compara contra el valor guardado: *reenviar* el recorrido que ya estaba no es usarlo, *cambiarlo* sí. Sin esa distinción, a quien se le vence el plan no le dejaría ni editar el precio de su propia casa — el formulario reenvía todos los campos y recibiría un 403.

### El recorrido 3D vacío significa "bórralo", no "no lo toques"

`tour_3d_url` tiene tres estados, y confundir dos es un bug silencioso: ausente = no tocar; `''` o `null` = quitar; URL = poner. Antes `''` se transformaba a `undefined`, así que **era imposible borrar un recorrido 3D** — el formulario mandaba `''` al vaciar el campo y el valor se quedaba igual, sin error ni aviso.

### La geografía es Huánuco, y solo Huánuco

INNOVER arranca en la **región de Huánuco** (9 zonas: la conurbación Huánuco–Amarilis–Pillco Marca, los distritos rurales del alrededor y Tingo María). No es un mercado de prueba: es el mercado.

Consecuencias al tocar datos o mapas:

- **Los precios no se copian de Lima.** El m² en Huánuco va de S/ 1,800 a S/ 3,500; un departamento de 100 m² a US$ 385,000 es un precio de Miraflores y rompe cualquier filtro. Las cifras del seed salen de anuncios reales de Huánuco.
- **Las coordenadas se verifican, no se escriben de memoria.** Una latitud inventada no falla: el seed corre y el marcador cae en el río Huallaga. Se consultan a OpenStreetMap (Nominatim) pidiendo que el resultado sea `place` o `boundary` — la búsqueda por texto libre devuelve cualquier cosa (pidiendo "Distrito de Huánuco" llegó a devolver un restaurante en Tingo María).
- **`npm run verificar:geo`** comprueba que cada propiedad esté a menos de 6–12 km del centro de su distrito y que los signos sean negativos. Córrelo después de tocar el seed.
- En Mapbox el par es **[longitud, latitud]**; en PostGIS, el backend y el seed es **latitud primero**. Invertirlo no da error, solo centra el mapa en otro continente.

---

## El diseño vive en `globals.css`

**Tailwind v4 es CSS-first.** No hay `tailwind.config.js` y no debes crear uno: un config de v3 se ignora en silencio, compila sin error y **sin estilos**. Los tokens van dentro de `@theme` en `frontend/src/app/globals.css`, y eso se convierte en utilidades (`--color-tinta` → `text-tinta`).

### De dónde salen los colores

De la identidad de Innover: el azul marino y el turquesa **del logo** (`design/logosvg.svg`), sobre las superficies frías de la guía visual (`design/desing.md`).

⚠️ **Donde la guía y el logo no coinciden, manda el logo.** La guía propone un turquesa `#00CED1`/`#008B8B`; el logo trae `#00D2B8`/`#008B9B`. Se usan los del logo porque aparece en cada pantalla: una guía se corrige, una imagen de marca ya difundida no.

⚠️ **La guía manda crear un `tailwind.config.js`. Está prohibido.** Se toma la intención visual (paleta, jerarquía, map-first) y se traduce a `@theme`. Shadcn y Material UI también se descartaron.

### El color de acción NO es el turquesa del logo

Parece una contradicción y no lo es. El turquesa claro del logo (`#00D2B8`) da **1,9:1** con texto blanco encima: ilegible. El turquesa hondo (`#008B9B`) tampoco llega — **4,1:1**, por debajo del 4,5:1 que exige WCAG AA para texto normal.

Así que el turquesa de marca se reserva para lo que sí lo soporta —rellenos, franjas, el estado activo sobre azul marino— y `--color-senal` es ese mismo turquesa oscurecido hasta pasar el umbral (5,8:1). El botón de marca (`.btn-turquesa`) gira el par: fondo turquesa y texto en marino, 7,4:1.

**Los tres `verificar:*` existen por esto y no son opcionales.** Ninguno de
los tres fallos posibles da error: solo se ven mal.

- `npm run verificar:contraste --workspace=frontend` — calcula el contraste de 30 combinaciones **leyendo `globals.css`**, no una copia de los valores. Si alguien cambia un color por uno que no se lee, falla.
- `npm run verificar:tokens --workspace=frontend` — comprueba que **todo token declarado se usa** y, sobre todo, que ninguno usado con `var()` se queda sin emitir. Tailwind v4 elimina los tokens que ninguna utilidad usa: si uno se usa solo dentro de `var()`, desaparece y **el color no se pinta, sin ningún error**.
- `npm run verificar:clases --workspace=frontend` — busca en `className` las clases que **no llegan al CSS compilado**: un nombre renombrado que se olvidó en un sitio, una errata, o una utilidad que no existe. ⚠️ Necesita `build` previo, igual que `verificar:tokens`: compara contra lo que Tailwind generó.

  Este comprobador ya encontró un fallo real y escondido: el enlace "Saltar al contenido" usaba `focus:not-solo-lector`, y `not-solo-lector` **no es una variante que Tailwind conozca** —ahí espera el nombre de una variante, no el de una clase—. La utilidad no se generaba nunca, así que el enlace se quedaba recortado a 1 px incluso enfocado: invisible justo para quien navega con teclado. Y sin un solo error que lo delatara.

### Reglas al tocar el sistema

- **Un color suelto en un componente es un fallo.** Ni `#008B9B` en un `.tsx`, ni en JavaScript.
- **Mapbox no es una excepción.** Sus marcadores y globos se construyen desde JavaScript, así que sus colores viven en `globals.css` como clases (`.marcador`, `.marcador-destacado`, `.marcador-seleccionado`, `.globo-*`) y el componente solo enciende y apaga clases. El `background-color` en línea que había antes parecía funcionar y no: **una imagen de fondo se pinta encima del color**, así que un marcador destacado se habría quedado verde al seleccionarlo, sin error.
- **`destacado` y `aviso` son tokens distintos a propósito.** Uno es un anuncio pagado; el otro, una tarea pendiente. Antes compartían un único color ("latón"), y eso significaba que ajustar el color del destaque habría cambiado los avisos de todo el panel sin querer.
- **El logo tiene dos copias y no se generan automáticamente:** `frontend/src/components/Logo.tsx` (el icono, para la interfaz) y `frontend/src/app/icon.svg` (el favicon). Si cambia el dibujo, se cambian las dos. La palabra "Innover" **no** está en el SVG: es texto HTML en Inter, para que se pueda seleccionar, buscar e indexar.
- **El foco por teclado se hereda de `--foco`.** Un anillo de un solo color no vale para fondos claros y oscuros a la vez: el turquesa oscuro se pierde sobre el marino y el claro sobre el blanco. Cada superficie declara `--foco` (`.sobre-marino`, `.superficie-clara`) y los hijos lo recogen. Un selector de descendencia no sirve: el menú del usuario cuelga de la barra oscura pero tiene fondo blanco.
- **La barra de navegación va en azul marino**, como pide la guía. El botón de la barra usa `.btn-turquesa`, no `.btn-principal`: el color de acción sobre marino se queda a 2,4:1 y no se lee como un botón.

---

## Trampas del stack (verificadas, no las desactives)

**Express 5** — `req.query` es un getter sin setter.
`req.query = x` lanza `Cannot set property query… which has only a getter`. Por eso `middleware/validacion.js` usa `Object.defineProperty`.

**Zod 4** — dos cambios respecto a Zod 3:
- `error.errors` → **`error.issues`**. Los dos middlewares usan `error.issues || error.errors`.
- `.partial()` **falla** sobre objetos con `.refine()` (*"cannot be used on object schemas containing refinements"*). Los schemas separan el esqueleto (`filtrosPropiedadBaseSchema`, `camposPropiedad`) de los refinements por esto.
- `.partial()` **conserva los `.default()`**. Por eso los campos comunes están SIN default y los defaults solo se aplican en el schema de creación: si no, actualizar sin mandar `tipo` pisaría el tipo real con `'VENTA'`.
- Los campos desconocidos se **descartan en silencio** (lista blanca). Es deliberado contra mass assignment.

**Prisma + `Decimal`** — sale como **string** en JSON (`"275000.00"`). Toda respuesta usa `decimalANumero()`. En `$queryRaw`, `numeric` también vuelve como texto: castea a `float8`.

**PostGIS** — la columna `locacion geography(Point,4326)` la mantiene un **trigger** (`sync_propiedad_locacion`) a partir de `latitud`/`longitud`. `locacion` es `Unsupported`, así que Prisma no la escribe: solo `$queryRaw`. Si escribes a mano, el trigger igual la sincroniza.

**El índice GIST lo quiere borrar Prisma.** `Propiedad_locacion_gist_idx` lo creó a mano la migración `20260101000001_ficha_tecnica_postgis`, y como `locacion` es `Unsupported` no está en el modelo: Prisma no lo ve, concluye que sobra y **propone `DROP INDEX` en toda migración que generes**. Ver la sección de migraciones — es un desastre silencioso y tiene una prueba que lo protege.

**Tailwind v4** — **no hay `tailwind.config.js` y no debes crear uno**. Los tokens viven en `@theme` dentro de `src/app/globals.css`. Un config JS v3 se ignora en silencio: compila sin error y **sin estilos**.

**Rutas parametrizadas y orden** — en `propiedadRoutes.js`, `/mias` y `/cercanas` van **antes** de `/:id`. Si no, Express los interpreta como id y devuelven 404.

**Login vs registro** — el campo se llama `contrasena` (sin ñ), no `password`. Mandar `password` da 500.

**Slugify duplicado** — la expresión de validación en `schemas/index.js` (`idOSlugParamSchema`) debe coincidir con `slugify()` en `utils/utilidades.js`. Si divergen, aparece un 400 en enlaces que sí existen.

---

## Convenciones

- **ESM en backend** (`"type": "module"`). Extensiones `.js` explícitas en los imports.
- **Comentarios en español**, y el *por qué* importa más que el *qué*. El proyecto es material de aprendizaje: explicar el motivo de una decisión es el objetivo, no el relleno.
- El frontend es **TypeScript estricto**. No reintroducir archivos `.jsx`.
- **No hay CI, ni husky, ni lint-staged.** La verificación es manual; ejecuta los comandos de arriba tú mismo.
- La API devuelve `{ datos, paginacion }` en listados; los errores `{ error, codigo, detalles? }`.
- No hay tests unitarios (solo de integración). La lógica compartida vive en `backend/src/utils/` y `frontend/src/lib/`.

---

## Antes de cambiar el esquema

1. `npm run backup`
2. Edita `backend/prisma/schema.prisma`
3. `cd backend && npx prisma migrate dev --name <nombre>` (**lee el SQL que genera**: comprueba que no haya `DROP` sobre datos existentes)
4. `npm run migrate`
5. `cd backend && npm run generate` — regenera el cliente de Prisma tras cambiar el esquema

⚠️ `generate` y `migrate:dev` **solo existen en el workspace del backend**. En la raíz no están: hay que hacer `cd backend`.

### ⛔ Prisma SIEMPRE propondrá borrar el índice espacial

En **cualquier** migración que generes va a aparecer esta línea:

```sql
DROP INDEX "Propiedad_locacion_gist_idx";
```

**Bórrala antes de aplicar.** No es un descuido de Prisma: `locacion` está declarada como `Unsupported` (Prisma sabe que existe pero no la administra) y el índice lo creó a mano la migración de PostGIS. Al no estar en el modelo, Prisma lo interpreta como sobrante.

Aplicarlo sería un desastre **silencioso**: `/api/propiedades/cercanas` seguiría devolviendo resultados correctos, solo que recorriendo la tabla entera en lugar de usar el índice. Nada falla, nada avisa, solo se vuelve lento cuando haya propiedades de verdad.

Comprobado con `EXPLAIN`: el plan dice `Index Scan using "Propiedad_locacion_gist_idx"`. Si algún día dice `Seq Scan`, el índice se perdió.

Dos protecciones y ninguna es opcional:

- La prueba **"el índice espacial sigue existiendo"** de `scripts/pruebas.mjs` (sección 15) consulta `pg_indexes` y pide el `EXPLAIN`. Ninguna prueba de API puede sustituirla: un `Seq Scan` y un `Index Scan` devuelven exactamente los mismos datos, uno más despacio.
- Si la base ya es Supabase, puede que no tengas permiso para crear la *shadow database* que necesita `migrate dev`. `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` genera el SQL sin shadow database — y con el `DROP INDEX` dentro, así que revísalo igual.

Las migraciones aplicadas **no se editan**. Si una ya corrió, crea otra.

`prisma/migrations/20260101000000_baseline` está marcada como aplicada con
`prisma migrate resolve --applied 20260101000000_baseline` (la base ya existía
de antes). No la borres ni la regeneres. Si alguna vez hay que deshacer una
migración a medias, es `prisma migrate resolve --rolled-back <nombre>`.

---

## Documentación

- `docs/ROADMAP.md` — estado real por fases
- `docs/02_ARQUITECTURA_Y_SEGURIDAD.md` — por qué de cada decisión de seguridad
- `backend/.env.example`, `frontend/.env.example` — contrato de variables
- `context.txt` — contexto de negocio y modelo de monetización

## Reglas de seguridad que no se deben abrir

Son errores ya corregidos. Reabrirlos reintroduce agujeros explotables:

- El **rol nunca** se acepta del cuerpo en el registro; todo nace `CLIENTE`
- El **plan nunca** se acepta del propio usuario: lo escribe un `ADMIN` vía `PATCH /api/usuarios/:id/plan`
- `/api/usuarios` exige `ADMIN`; los usuarios editan su perfil vía `/api/auth`
- `verificarDuenio` va siempre **después** de `verificarToken`
- **La búsqueda exige sesión; la ficha no.** `GET /api/propiedades` y `GET /api/propiedades/cercanas` llevan `verificarToken`; `GET /api/propiedades/:id` (que acepta id o slug) es la **única** lectura pública de propiedades. Es el enlace que se comparte por WhatsApp y lo que indexa Google: si cerrara, cada enlace compartido daría contra un muro y el producto se quedaría sin puerta de entrada orgánica. Las dos mitades son igual de importantes y las dos están probadas —cerrar la búsqueda "del todo" parece más seguro y rompe el producto. En el frontend, `components/Buscador.tsx` no se monta sin sesión por un motivo aparte: **Mapbox se cobra por carga de mapa**.
- Los popups del mapa se construyen con `textContent`, **nunca** `setHTML`
- El `usuario_id` de una propiedad sale del **token**, nunca del body
- `destacado` y `tour_3d_url` son campos de pago: los escribe un `ADMIN` o alguien con **plan PRO vigente**, nunca un usuario cualquiera. *(`destacado` era `ADMIN`-only; se abrió al plan PRO porque el destaque va incluido en él. La comprobación está en `resolverDestacado()`, en el servidor. Al bajar de plan se retiran los destaques con `sincronizarDestacados()`: si no, un plan vencido conservaría las ventajas.)*
- Los borrados de usuario son **baja lógica** (`activo = false`), nunca `DELETE`
