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
| Verificar agrupador del mapa | `npm run verificar:clustering --workspace=frontend` |

### Typecheck — usa esta forma exacta

```bash
cd frontend && .\node_modules\.bin\tsc.cmd --noEmit
```

⛔ **`npx tsc` NO funciona.** Resuelve al paquete npm `tsc@2.0.4` (un squat que no es TypeScript) y falla con `EJSONPARSE`. No existe script `typecheck`: hay que llamar al binario del workspace. En Linux/macOS: `npx tsc` sí funciona porque el paquete local gana.

### Orden de verificación

```bash
npm run lint
cd frontend && .\node_modules\.bin\tsc.cmd --noEmit
npm run verificar:clustering --workspace=frontend  # lógica pura, sin navegador ni build
npm run build
npm run verificar:contraste --workspace=frontend   # paleta legible, lee globals.css
npm run verificar:tokens  --workspace=frontend     # ningún token huérfano (necesita build)
npm run verificar:clases  --workspace=frontend     # ninguna clase muerta (necesita build)
npm run prueba        # requiere el backend levantado
```

`next build` ya incluye typecheck, así que `build` es la prueba definitiva.

Los tres `verificar:*` de diseño son del frontend y cubren lo que ni el linter
ni el compilador pueden ver: un color que no se lee, un token que se renombró y
dejó de pintarse, y una clase escrita mal. Ninguna de las tres cosas da
error — solo se ven mal, y suele ser en una pantalla que casi nadie abre.

`verificar:clustering` es otra cosa: la **primera prueba unitaria** del proyecto.
Prueba `frontend/src/lib/clustering.ts`, que es lógica pura (no toca Mapbox ni
el DOM) y decide qué chinchetas del mapa se agrupan en un número y cuándo ese
número se rompe. Los marcadores son de cliente y no hay forma de automatizarlos
sin un navegador, así que lo que se puede probar sin él se prueba aquí; el
resto se mira a ojo con datos de verdad. Corre con Node a secas (v22.18+ ejecuta
TypeScript borrable), sin compilar nada.

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
npm run prueba                           # terminal 2 → 226 pruebas

npm run dev:frontend                     # terminal 1 (además del backend)
node backend/scripts/pruebas-puente.mjs  # terminal 2 → 55 pruebas
```

**`pruebas-puente.mjs` no tiene script en package.json** — hay que invocarlo con la ruta completa, y necesita frontend **y** backend.

### ⛔ La suite se auto-bloquea, y el que la bloquea no es el que vigilas

Hay **tres** limitadores, y una corrida de la suite toca dos:

| Limitador | Tope | Lo que gasta una corrida |
|---|---|---|
| `limitadorAuth` | 10 **fallos** de login / 15 min | 6 |
| `limitadorEscritura` | `RATE_LIMIT_ESCRITURA`, 20 por defecto | 21 |
| `limitadorGeneral` | 300 peticiones / 15 min | sobra |

El que engaña es **`limitadorEscritura`**: su ventana dura una hora, no quince
minutos, y no tiene nada que ver con el login. Como la suite gasta 21, dos
corridas seguidas suman 42: con el tope de producción (20) la segunda se corta
a mitad. Su síntoma es el peor posible: decenas de pruebas fallan de golpe, sin
relación entre sí, y parece que acabas de romper el código.

No es un bug. Los contadores viven **en memoria**, así que reiniciar el
backend los pone a cero:

```bash
npm run dev:backend
```

⚠️ **Solo se cuentan las escrituras que crean algo.** El limitador va montado
en los `POST` que publican (propiedades, contactos); los `DELETE`, los `PUT` y
los favoritos no pasan por él — los favoritos ni siquiera lo llevan, porque son
privados y la clave única impide repetirlos: no hay nada que limitar.

📌 **Y `RATE_LIMIT_ESCRITURA` NO EXISTÍA.** El tope estaba escrito a mano en el
limitador (`max: 20`) mientras esta guía recomendaba subirlo en `.env`: ponerlo
no hacía absolutamente nada, y seguir cortándose a mitad de suite sin una pista
de por qué. Ahora la variable existe de verdad y `.env.example` trae **60**, que
son dos corridas holgadas (la suite gasta 21; el puente, 1). El valor por
defecto del código sigue siendo 20 (es el tope de producción).

⚠️ **El 40 anterior ya no llegaba.** Al añadir la sección del mapa la suite pasó
de 19 a 21 escrituras, así que dos corridas seguidas suman 42: con un tope de
40 la segunda se cortaba por el mismo sitio de siempre. Si vuelves a subir el
número de pruebas que crean algo, sube este número también — o reinicia el
backend entre corrida y corrida, que es lo que hace el contador a cero.

Dos protecciones para no volver a confundirlo con un bug:

- La suite **avisa antes de empezar** si al limitador de login le quedan menos
  de 6 intentos (lee `RateLimit-Remaining` de un login correcto, que no
  gasta). Sale con código 2 y dice qué hacer.
- La suite **aborta en el primer `429`** y dice qué limitador fue. Antes no lo
  hacía, y por eso el fallo de escritura se manifestaba como 18 fallos sueltos
  en lugar de un mensaje. El de escritura no se puede sondear antes —su
  cabecera solo llega en una respuesta de escritura, y sondearla gastaría una
  escritura—, así que se detecta al chocar.

Ambas suites cubren la API a mano mejor que un archivo de peticiones: incluyen los casos que importan (escalada de privilegios, XSS, ownership) que sería fácil olvidar documentar.

### Las suites se borran a sí mismas (solo si salen verdes)

La base es **compartida**, así que dejar basura no es una molestia local: cada corrida creaba usuarios `test-cliente-*` / `puente-*` y sus propiedades, y esas propiedades **entran en `/sitemap.xml`**. Se llegaron a contar 76 — o sea que la base de desarrollo le estaba enseñando a Google decenas de anuncios de prueba.

Las dos suites llaman al final a `limpiar-usuarios-prueba.mjs --ejecutar`, que es **el único sitio** que decide qué es basura (prefijos `test-cliente-`, `test-intruso-`, `puente-`, `corto-`). Si un día las pruebas crean usuarios con otro prefijo, se añade ahí y las dos suites lo heredan.

- **Con fallos, no se limpia nada.** Los datos son la evidencia (un usuario con el rol mal puesto, una propiedad con el estado raro); borrarlos cambiaría un problema de espacio por uno de depuración, que es peor.
- La limpieza va **directa a la base**, no por la API, así que **no gasta escrituras** del limitador.
- Si a mano quieres limpiar: `node backend/scripts/limpiar-usuarios-prueba.mjs` (simula) y `--ejecutar` (borra).

---

## Arquitectura: lo que no se deduce de los nombres

### El navegador NUNCA habla con el backend

Todo va por rutas relativas `/api/...` → `src/app/api/[...ruta]/route.ts` (catch-all) → `BACKEND_URL`. Por eso:

- no hay `NEXT_PUBLIC_BASE_URL` en el código (verifícalo antes de añadirlo)
- `BACKEND_URL` **no** lleva prefijo `NEXT_PUBLIC_` a propósito: solo la ve el servidor
- el puente reenvía `cookie` y copia `set-cookie` — **todas**, con `getSetCookie()` y `append`. Con una sola cookie, `get('set-cookie')` parecía funcionar; con dos (la sesión tiene pase y renovación) las pega con una coma, y una coma también separa atributos dentro de una cookie. Si tocas eso, rompes la sesión a medias y sin un solo error

**Con una excepción, y es a propósito:** `app/propiedad/[slug]/page.tsx` es un Server Component y llama a `BACKEND_URL` directamente, reenviando la cookie a mano. No es un atajo: es la única forma de que el contenido venga **escrito en el HTML**, que es para lo que esa página existe (es el enlace que se comparte y lo que indexa Google). Pasando por el puente saldría vacía y el contenido lo pintaría JavaScript. Si añades otra llamada directa en un Server Component, mira esa primero: reenvía la cookie —sin ella el dueño no ve su propio `BORRADOR`— y distingue "no existe" de "no me contestó", porque lo primero es un 404 y lo segundo no.

**La otra llamada directa es la del sitemap:** `app/sitemap.ts` pide `GET /api/propiedades/sitemap` y no manda cookie, porque no hay ninguna que mandar — un rastreador no tiene cuenta, y esa es justo la razón de que ese endpoint sea el otro público (devuelve dos campos: ver "Reglas de seguridad"). Ni el puente ni el navegador pintan nada aquí: el resultado es un archivo XML que se genera en el servidor.

### Sesión por cookie httpOnly

El token **no** está en `localStorage`. `contextos/Auth.tsx` guarda solo los datos del usuario; nunca el token. No "simplifiques" a `localStorage`.

Y son **dos cookies**, porque un token solo no puede hacer las dos cosas:

| Cookie | Qué es | Dura | ¿Revocable? |
|---|---|---|---|
| `innover_token` | JWT firmado. Viaja en **cada** petición | 2 h | **No** |
| `innover_renovacion` | Cadena al azar, hash en `TokenRenovacion` | 30 días | **Sí** |

El pase corto es autocontenido (se verifica con la firma, sin tocar la base) y por eso **no se puede apagar** antes de que venza: tiene que durar poco. El largo vive en la base, solo sirve para pedir otro pase, y por eso sí se revoca. Lo que había antes era lo peor de los dos: una cookie de 7 días con un JWT de 2 h dentro, que solo podía terminar en "tu sesión expiró".

- **La rotación vive en `backend/src/utils/renovacion.js`** y no se toca a la ligera: cada renovación entrega un token nuevo, marca el usado con `rotado_en` (**no lo borra**: un token ya usado que reaparece es la señal de que alguien lo copió) y, si reaparece pasado un minuto, **revoca todas las sesiones de esa persona**. Ese minuto es la **ventana de gracia** para que dos pestañas que renuevan a la vez no se tomen por ladrones. La fecha de rotación **no se reescribe** en cada reintento: si se reescribiera, la gracia se podría mantener viva en bucle.
- **`POST /api/auth/renovar` no lleva `verificarToken`** (si el pase valiera, no habría nada que renovar) **ni `limitadorAuth`** (no hay contraseña que adivinar: lo que viaja es un secreto de 256 bits).
- **En el cliente, una sola renovación en vuelo.** `lib/api.ts` reintenta **una vez** tras un 401 y comparte la misma promesa entre todas las peticiones que fallan a la vez: el buscador manda lista y mapa en paralelo, y sin eso la segunda mandaría un token ya rotado. Y no reintenta en `/login`, `/registro`, `/renovar` ni `/logout`: ahí un 401 significa otra cosa.
- **Cambiar la contraseña cierra TODAS las sesiones** (incluida la actual) y abre una nueva en la misma respuesta. Dejarlas abiertas sería cerrar la puerta con el ladrón dentro.
- **`GET /api/favoritos/:id`** existe para que la ficha se corrija sola: el servidor solo ve el pase corto, así que una visita fría (navegador recién abierto, o más de 2 h después) sale como anónima aunque la sesión esté viva. Esa isla pregunta, y ese 401 también es información.

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

De la identidad de Innover: el azul marino y el turquesa **del logo** (`design/nuevo/logoinnover.svg`), sobre las superficies frías de la guía visual (`design/desing.md`).

📌 El **porqué de cada token y la composición de cada pantalla** viven en `design/desing.md`, y desde el bloque de acceso está al día: paleta con el uso de cada color, escala tipográfica, formas, sombras, la pantalla de acceso medida, y las decisiones que quedan abiertas para el rediseño del resto. Este archivo (`AGENTS.md`) dice *cómo no romperlo*; aquel, *por qué es así*.

⚠️ **Donde la guía y el logo no coinciden, manda el logo.** La guía propone un turquesa `#00CED1`/`#008B8B`; el logo trae `#00D2B8`/`#008B9B`. Se usan los del logo porque aparece en cada pantalla: una guía se corrige, una imagen de marca ya difundida no.

⚠️ **El logo cambió y los tokens NO.** La entrega nueva trae sus propios azules (`#006DE6`→`#0356C4`) y turquesas (`#0DD1D3`→`#089596`) **para el dibujo del icono**, y esos viven dentro de `components/Logo.tsx`, no en `@theme`. Un dibujo de marca no es un token de interfaz: nadie pinta un botón con el azul de la chincheta, y meterlos en `@theme` crearía utilidades que no usa nadie. Los tokens de la interfaz siguen siendo el marino y el turquesa de siempre, y por eso **ningún contraste cambió** al cambiar el logo.

⚠️ **La guía manda crear un `tailwind.config.js`. Está prohibido.** Se toma la intención visual (paleta, jerarquía, map-first) y se traduce a `@theme`. Shadcn y Material UI también se descartaron.

### El color de acción NO es el turquesa del logo

Parece una contradicción y no lo es. El turquesa claro del logo (`#00D2B8`) da **1,9:1** con texto blanco encima: ilegible. El turquesa hondo (`#008B9B`) tampoco llega — **4,1:1**, por debajo del 4,5:1 que exige WCAG AA para texto normal.

Así que el turquesa de marca se reserva para lo que sí lo soporta —rellenos, franjas, el estado activo sobre azul marino— y `--color-senal` es ese mismo turquesa oscurecido hasta pasar el umbral (5,8:1). El botón de marca (`.btn-turquesa`) gira el par: fondo turquesa y texto en marino, 7,4:1.

**Los tres `verificar:*` existen por esto y no son opcionales.** Ninguno de
los tres fallos posibles da error: solo se ven mal.

- `npm run verificar:contraste --workspace=frontend` — calcula el contraste de 31 combinaciones **leyendo `globals.css`**, no una copia de los valores. Si alguien cambia un color por uno que no se lee, falla. (El panel del acceso cuenta por dos: es un degradado, y un degradado no tiene un contraste único — se comprueba cada punta.)
- `npm run verificar:tokens --workspace=frontend` — comprueba que **todo token declarado se usa** y, sobre todo, que ninguno usado con `var()` se queda sin emitir. Tailwind v4 elimina los tokens que ninguna utilidad usa: si uno se usa solo dentro de `var()`, desaparece y **el color no se pinta, sin ningún error**.
- `npm run verificar:clases --workspace=frontend` — busca en `className` las clases que **no llegan al CSS compilado**: un nombre renombrado que se olvidó en un sitio, una errata, o una utilidad que no existe. ⚠️ Necesita `build` previo, igual que `verificar:tokens`: compara contra lo que Tailwind generó.

  Este comprobador ya encontró un fallo real y escondido: el enlace "Saltar al contenido" usaba `focus:not-solo-lector`, y `not-solo-lector` **no es una variante que Tailwind conozca** —ahí espera el nombre de una variante, no el de una clase—. La utilidad no se generaba nunca, así que el enlace se quedaba recortado a 1 px incluso enfocado: invisible justo para quien navega con teclado. Y sin un solo error que lo delatara.

### Reglas al tocar el sistema

- **Un color suelto en un componente es un fallo.** Ni `#008B9B` en un `.tsx`, ni en JavaScript.
- **Mapbox no es una excepción.** Sus marcadores y globos se construyen desde JavaScript, así que sus colores viven en `globals.css` como clases (`.marcador`, `.marcador-destacado`, `.marcador-seleccionado`, `.marcador-grupo*`, `.globo-*`) y el componente solo enciende y apaga clases. El `background-color` en línea que había antes parecía funcionar y no: **una imagen de fondo se pinta encima del color**, así que un marcador destacado se habría quedado verde al seleccionarlo, sin error.
- **El grupo de chinchetas va en marino, no en turquesa.** Un grupo es un *resumen* de lo que hay en una zona; el turquesa brillante está reservado para la propiedad **destacada**, que es un anuncio pagado. Pintar los dos igual convertiría cualquier racimo en un anuncio. Y el grupo no tiene estado "seleccionado" a propósito: lo que se selecciona es una propiedad, y una propiedad no *está* en un grupo —está debajo—, así que al elegirla el mapa se acerca hasta que sale suelta. Los tres tamaños (`.marcador-grupo-chico/medio/grande`, por debajo de 10 / de 100 / a partir de 100) los decide `claseDeGrupo()` en `lib/clustering.ts`.
- **`destacado` y `aviso` son tokens distintos a propósito.** Uno es un anuncio pagado; el otro, una tarea pendiente. Antes compartían un único color ("latón"), y eso significaba que ajustar el color del destaque habría cambiado los avisos de todo el panel sin querer.
- **El logo tiene dos copias y no se generan automáticamente:** `frontend/src/components/Logo.tsx` (el icono, para la interfaz) y `frontend/src/app/icon.svg` (el favicon). Si cambia el dibujo, se cambian las dos. La palabra «Innover» **no** está en el SVG: es texto HTML en Inter —ahora en mayúsculas y con el espaciado de la entrega—, para que se pueda seleccionar, buscar e indexar.

  ⚠️ **El `viewBox` del componente NO es un número al azar.** El original mide 1024×1024 y lleva la palabra debajo; el componente recorta con `253 105 518 610`, que sale de **medir** el dibujo (x 263…761, y 115…705) más 10 px de margen. Todo lo que caiga fuera del `viewBox` se recorta **en silencio**: ni error, ni aviso, solo un logo al que le falta un trozo. Si se cambia el dibujo, hay que volver a medirlo.
- **El foco por teclado se hereda de `--foco`.** Un anillo de un solo color no vale para fondos claros y oscuros a la vez: el turquesa oscuro se pierde sobre el marino y el claro sobre el blanco. Cada superficie declara `--foco` (`.sobre-marino`, `.superficie-clara`) y los hijos lo recogen. Un selector de descendencia no sirve: el menú del usuario cuelga de la barra oscura pero tiene fondo blanco.
- **La barra de navegación va en azul marino**, como pide la guía. El botón de la barra usa `.btn-turquesa`, no `.btn-principal`: el color de acción sobre marino se queda a 2,4:1 y no se lee como un botón.
- **Inter es la letra de todo el producto, con una excepción contada.** `--font-display` existe para **una frase**: el titular del panel de acceso (`components/PanelAcceso.tsx`), que va sobre el fondo oscuro, sin cifras y sin campos. Es una serif de alto contraste y no se usa en ninguna otra pantalla. Antes de añadir una segunda familia, mira si la frase vale dos archivos de fuente que alguien descarga.

---

## El acceso tiene su propio armazón

`/login` y `/registro` viven en `app/(acceso)/`; el resto del producto, en `app/(sitio)/`. Los paréntesis son un **grupo de rutas**: organizan sin aparecer en la URL, así que `/`, `/leads`, `/publicar` o `/login` siguen siendo exactamente las mismas direcciones.

⚠️ **Un layout hijo no puede quitar lo que dibuja su padre.** Para que la pantalla de acceso no llevara la barra de navegación no bastaba con meter un `layout.tsx` dentro de `/login`: había que partir el armazón en dos hermanos y dejar el layout raíz con lo mínimo (`<html>`, `<body>`, el proveedor de sesión y el enlace de salto). **Si vuelves a meter algo en `app/layout.tsx`, aparecerá también en la pantalla de acceso.**

- **El enlace de salto vive en el raíz** y apunta a `#contenido`; cada armazón pone ese `id` en su propio `<main>`. No es un problema que haya dos `<main>` en el proyecto: en cada pantalla hay uno.
- **Cada página del acceso tiene su `layout.tsx`, y solo para el título** (`Entrar · Innover`). No es capricho: `metadata` solo se exporta desde el servidor y esas páginas son de cliente, así que un layout que se limita a dejar pasar a sus hijos es la forma más corta de titularlas.
- **La barra se fue por un motivo de producto, no estético:** ofrecía «Buscar» y «Publicar» a quien todavía no tiene sesión, es decir, una puerta cerrada.

### El panel de la derecha no es un mapa

Es una maqueta: dos PNG en `frontend/public/acceso/` (recortados a su dibujo desde los renders de `design/nuevo/`) más unas curvas de nivel en SVG. **Mapbox se cobra por carga de mapa** y esa pantalla la ve quien todavía no tiene cuenta, y la ve cada rastreador que pasa. El panel entero es decorativo —`aria-hidden`, con `alt=""` en las imágenes—; lo que importa, el titular, es texto de verdad, y por eso se lee y se indexa.

⚠️ Los `<img>` del panel llevan `h-auto` y no es opcional: con `width`/`height` puestos, el navegador aplica los dos atributos como estilos del elemento, así que una anchura en `%` por encima de ellos deja la altura clavada en los píxeles del atributo y el dibujo sale aplastado. `h-auto` deja que la altura salga de la proporción real del archivo.

### «Recordar mi correo» guarda el correo, y nada más

- **Nunca la contraseña.** En `localStorage` la lee cualquier script de la página, así que es una llave bajo el felpudo.
- **No recuerda la sesión**, aunque el nombre lo sugiera: eso lo decide el servidor (2 h el pase, 30 días la renovación). Prometerlo sería mentir en la misma casilla que lo pide.
- La casilla viene marcada **solo si de verdad hay un correo guardado**, y el correo se guarda **después** de que la sesión se abra: uno que no entró no se recuerda.
- Se lee con **`useSyncExternalStore`**, y las dos alternativas están descartadas por motivos distintos: `useEffect` + `setState` encadena un segundo render (y el linter lo prohíbe con razón), y `useState(() => localStorage…)` rompe la hidratación —el servidor no tiene `localStorage`: pintaría el campo vacío y el navegador lo pintaría con el correo dentro—.

### `?redirect=` solo acepta rutas internas

`router.push` acepta direcciones absolutas, así que `?redirect=//otro-sitio` sacaba al usuario de Innover **justo después de escribir su contraseña**: el montaje clásico del phishing. `esRutaInterna()` en `app/(acceso)/login/page.tsx` es la lista blanca (una barra y no dos, y tampoco `/\`, porque los navegadores lo normalizan a `//`). Si otro sitio lee `redirect`, usa esa misma función.

⚠️ **No hay «¿olvidaste tu contraseña?», y no es un olvido.** No existe endpoint de recuperación, ni correo saliente, ni forma de que un ADMIN restablezca la contraseña de nadie (`actualizarUsuarioAdminSchema` no acepta `contrasena`). El enlace llevaría a una pantalla que no existe. Tampoco hay botones de Google o Apple: sin OAuth en el backend, un botón así solo puede fallar.

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

**npm iza las dependencias nuevas y Turbopack no mira fuera de su `root`.** Al instalar un paquete en un workspace (`npm install x --workspace=frontend`), npm lo sube al `node_modules` de la **raíz** del monorepo, no a `frontend/node_modules` —donde viven los ~290 paquetes que ya había—. Y Turbopack resuelve los módulos **dentro de su `root`**: lo que quede fuera no existe para él (documentado en la guía de Turbopack, *"Files outside of the project root are not resolved"*). El síntoma es un `Module not found: Can't resolve 'x'` **al compilar**, nunca al instalar: `supercluster` se quedó sin resolver y la única pantalla rota era el mapa del buscador. Por eso `turbopack.root` en `next.config.ts` apunta a la raíz del monorepo, que engloba los dos `node_modules`. ⛔ No lo devuelvas a `frontend/`.

⚠️ Y si cambias `turbopack.root`, **borra `frontend/.next`** antes de levantar otra vez el dev server. La caché de disco se queda con el manifiesto de rutas de la raíz anterior y todas las rutas `/api/...` del puente empiezan a devolver 404 —con la página de "no encontrado" de Next, sin un solo error en la consola, y con el backend respondiendo perfectamente si lo llamas directo—.

**Rutas parametrizadas y orden** — en `propiedadRoutes.js`, `/mias`, `/cercanas` y `/mapa` van **antes** de `/:id`. Si no, Express los interpreta como id y devuelven 404. Con `/mapa` el síntoma sería de los que engañan: la petición acabaría en la ficha buscando una propiedad llamada "mapa" y el mapa del buscador se quedaría vacío, sin un solo error en la consola.

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

⚠️ **`generate` falla si el backend está levantado.** En Windows, el proceso que
tiene cargado el cliente bloquea `query_engine-windows.dll.node` y Prisma no
puede reescribirlo: el comando sale con código 1, el mensaje real se pierde
entre líneas y lo que queda es un cliente **a medias** —el modelo nuevo no
existe para el código y las peticiones revientan raro—. Antes de regenerar:

```bash
# parar el backend, regenerar, y volver a levantarlo
cd backend && npm run generate
```

### ⛔ Prisma SIEMPRE propondrá borrar el índice espacial

En **cualquier** migración que generes va a aparecer esta línea:

```sql
DROP INDEX "Propiedad_locacion_gist_idx";
```

**Bórrala antes de aplicar.** No es un descuido de Prisma: `locacion` está declarada como `Unsupported` (Prisma sabe que existe pero no la administra) y el índice lo creó a mano la migración de PostGIS. Al no estar en el modelo, Prisma lo interpreta como sobrante.

Aplicarlo sería un desastre **silencioso**: `/api/propiedades/cercanas` seguiría devolviendo resultados correctos, solo que recorriendo la tabla entera en lugar de usar el índice. Nada falla, nada avisa, solo se vuelve lento cuando haya propiedades de verdad.

Comprobado con `EXPLAIN`: el plan dice `Index Scan using "Propiedad_locacion_gist_idx"`. Si algún día dice `Seq Scan`, el índice se perdió.

Dos protecciones y ninguna es opcional:

- La prueba **"el índice espacial sigue existiendo"** de `scripts/pruebas.mjs` (sección 16) consulta `pg_indexes` y pide el `EXPLAIN`. Ninguna prueba de API puede sustituirla: un `Seq Scan` y un `Index Scan` devuelven exactamente los mismos datos, uno más despacio.
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
- **La búsqueda exige sesión; la ficha no.** `GET /api/propiedades`, `GET /api/propiedades/cercanas` y `GET /api/propiedades/mapa` llevan `verificarToken`; `GET /api/propiedades/:id` (que acepta id o slug) es la lectura pública de propiedades. Es el enlace que se comparte por WhatsApp y lo que indexa Google: si cerrara, cada enlace compartido daría contra un muro y el producto se quedaría sin puerta de entrada orgánica. Las dos mitades son igual de importantes y las dos están probadas —cerrar la búsqueda "del todo" parece más seguro y rompe el producto. En el frontend, `components/Buscador.tsx` no se monta sin sesión por un motivo aparte: **Mapbox se cobra por carga de mapa**.

  📌 **`/mapa` es la búsqueda, no la ficha.** Devuelve el resultado filtrado **entero** —no una página: si el mapa enseñara solo los 50 primeros, alejarse para ver "¿dónde hay?" diría que hay barrios vacíos que no lo están— y con los mismos filtros que la lista, porque comparten `construirWhere()`. Por eso exige token igual que ella: el mapa *es* el buscador con otra forma. Y por eso también lleva tope (`MAX_PUNTOS_MAPA = 1000`) y lo confiesa: cuando recorta, lo dice en la respuesta (`recortado`) y la interfaz lo avisa. Un mapa que calla que le faltan puntos es peor que uno que lo admite.
- **Hay una segunda lectura pública y devuelve DOS campos:** `GET /api/propiedades/sitemap` → `{ slug, fecha_actualizacion }` de las `PUBLICADA`, que es lo que se convierte en `/sitemap.xml`. Existe porque *pública* no es *encontrable*: con el buscador detrás del muro, un rastreador no tenía un solo enlace interno hacia una ficha, así que el SEO de la ficha no se cobraba. ⛔ Si alguien le añade campos "por comodidad", eso deja de ser una lista de URLs y pasa a ser el catálogo abierto —con precios y todo— que es justo lo que el muro evita. Tiene prueba: un `BORRADOR` no aparece.
- **`usuarioOpcional` NO protege: identifica.** Solo puede ir en rutas que ya son públicas — hoy, solo la ficha. Es un recepcionista, no un guardia: si no reconoce el token, deja pasar **sin usuario** en lugar de cortar. Ponerlo donde iba `verificarToken` no da ningún error: deja la ruta abierta y en silencio. Al revés, poner `verificarToken` en la ficha tampoco da error y rompe el enlace compartido para quien tenga la sesión caducada — hay una prueba para cada dirección.
- Los popups del mapa se construyen con `textContent`, **nunca** `setHTML`
- El `usuario_id` de una propiedad sale del **token**, nunca del body
- `destacado` y `tour_3d_url` son campos de pago: los escribe un `ADMIN` o alguien con **plan PRO vigente**, nunca un usuario cualquiera. *(`destacado` era `ADMIN`-only; se abrió al plan PRO porque el destaque va incluido en él. La comprobación está en `resolverDestacado()`, en el servidor. Al bajar de plan se retiran los destaques con `sincronizarDestacados()`: si no, un plan vencido conservaría las ventajas.)*
- Los borrados de usuario son **baja lógica** (`activo = false`), nunca `DELETE`
- **Los favoritos son privados: cada quien ve la suya y solo la suya.** No hay endpoint para preguntar "quién guardó esto" — saber que alguien guardó una casa es saber que está buscando, y eso es información suya. El `usuario_id` sale **siempre del token**, nunca del cuerpo; la lista se filtra por la misma regla de visibilidad que la ficha (lo publicado, más lo mío), de modo que un anuncio retirado desaparece de la lista en vez de quedarse como un enlace que devuelve 403. Guardar algo que no se puede abrir también da 403: guardar es la antesala de volver a mirarlo.
- **`es_favorito` solo viaja en la ficha, y solo si hay sesión.** Es el estado de *quien mira*, no un dato del anuncio (el mismo anuncio es favorito para uno y no para otro), así que no vive en `propiedadPublica`. Y es **tri-estado a propósito**: su ausencia significa "el servidor no me reconoció", que no es lo mismo que "no lo tienes guardado". Con `false` para los anónimos, la ficha ofrecería un corazón que devuelve 401 al primer clic; con la ausencia, ofrece un enlace a `login` y guarda el interés. Devuelve `undefined` = no hay quien lo tenga guardado, y la interfaz no adivina mirando una cookie que no puede leer (es httpOnly). ⚠️ Y "no me reconoció" tampoco es exactamente "no hay sesión": el servidor solo ve el pase corto (2 h), así que una visita fría con la sesión viva sale anónima. Por eso la isla del corazón se corrige sola preguntando `GET /api/favoritos/:id`, que devuelve el estado o un 401.
- **Las fotos se pintan con `<img>`, nunca con `next/image`.** Las direcciones las escribe quien publica, y el optimizador de Next **descarga la imagen en el servidor** para redimensionarla: con `next/image`, pegar `http://169.254.169.254/latest/meta-data/` convierte la ficha en una puerta hacia la red interna — un SSRF de manual, y basta con tener cuenta para publicar. Con `<img>` la descarga la hace el navegador de quien mira, que no alcanza nada que no alcanzara ya. Un `next/image` "para optimizar" reabre esto sin que ningún test se ponga en rojo. El otro candado es el esquema: `imagenes` valida cada dirección con el esquema `url` de Zod (`http://` o `https://`), y `javascript:alert(1)` tiene prueba propia.
