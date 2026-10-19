# Sistema de diseño de Innover

> **Estado:** el sistema está implementado y verificado. La **pantalla de acceso** (`/login`, `/registro`) es la primera rediseñada según el boceto final. El resto de las pantallas usa los mismos tokens, pero su composición todavía es la de la primera versión: este documento es la referencia para rediseñarlas.

---

## 0. Qué manda sobre qué

Cuando dos fuentes se contradicen, el orden es este:

1. **El código.** La verdad del color, la tipografía y el espacio está en `frontend/src/app/globals.css`, dentro de `@theme`. Este documento explica el *porqué*; si divergen, manda el CSS. (Y hay tres comprobadores que lo vigilan: ver §5.)
2. **El logo.** Donde una guía y el logo no coincidan, gana el logo: aparece en cada pantalla, y una imagen de marca ya difundida no se corrige tan fácil como un párrafo.
3. **El boceto de escritorio** (`design/desingfinal.jfif`).
4. **El boceto de móvil** (`design/nuevo/formatoencelular.png`), pero solo en la **composición**. Traía su propia paleta índigo/turquesa de plantilla y otros copys («Bienvenido Innover»); se descartaron: es el mismo diseño estrechado, no una fuente aparte.
5. Lo que diga el resto de este documento.

### Los archivos de diseño

| Archivo | Qué es | ¿Se usa? |
|---|---|---|
| `design/nuevo/logoinnover.svg` | El logo **actual** (entrega del diseñador) | Sí. Sus dos copias en producción son `frontend/src/components/Logo.tsx` y `frontend/src/app/icon.svg` |
| `design/desingfinal.jfif` | Boceto de escritorio: la pantalla de acceso | Sí, es la referencia |
| `design/nuevo/formatoencelular.png` | Boceto de móvil de la misma pantalla | Solo la composición |
| `design/nuevo/mapasinfondore.png`, `design/nuevo/filtrosinfondo re.png` | Renders del buscador con fondo transparente | Sí: son el origen de `frontend/public/acceso/mapa.png` y `filtros.png` |
| `design/logosvg.svg`, `design/logo.png` | El logo **anterior** | No. Se conservan por historia |
| `design/desing.md` | Este documento | — |

⚠️ **Lo que ya NO es cierto de la versión anterior de este documento** (se anota aquí porque lo proponía con seguridad): un turquesa `#00CED1`/`#008B8B`, un archivo `tailwind.config.js`, las librerías Shadcn UI y Material UI, Roboto, y unos colores de «éxito» e «información». Nada de eso se usa, y en §1.2, §1.3 y §5 está el motivo.

---

## 1. Identidad

### 1.1 El logo

Es una **chincheta hexagonal** —anillo azul a la izquierda, turquesa a la derecha— con una casa dibujada dentro, apoyada sobre una **base isométrica que es un mapa**: calles y manzanas en azul, parques en verde. Ese detalle, la chincheta *sobre* un mapa, es lo que dice a qué se dedica el producto antes de leer una sola palabra.

| Parte del dibujo | Valor |
|---|---|
| Anillo izquierdo y casa | Degradado vertical `#006DE6` → `#0356C4` |
| Anillo derecho y casa | Degradado vertical `#0DD1D3` → `#089596` |
| Base del mapa (canto) | Degradado horizontal `#11284A` → `#183863` → `#0E2342` |
| Superficie del mapa | `#F8FAFC`, borde superior `#E2E8F0`/`#CBD5E1` |
| Manzanas azules | `#4A90E2`, `#71B4F8` |
| Parques | `#78C697`, `#5EAD9E` |
| Ventana central | `#006DE6` |

⚠️ **Estos colores NO son tokens de la interfaz.** Viven dentro del componente porque son *del dibujo*: nadie pinta un botón ni un texto con el azul de la chincheta. La interfaz mantiene su propia paleta (§1.2), y esa separación es deliberada — si el logo cambia de tono, la interfaz no debería moverse sola.

⚠️ **Las dos copias y el `viewBox`.** El SVG original mide 1024×1024 y lleva la palabra «INNOVER» debajo, así que el componente **recorta**: usa `viewBox="253 105 518 610"`, que sale de medir el dibujo (x 263…761, y 115…705) más 10 px de margen por lado. Si algún día cambia el dibujo, hay que volver a medirlo: lo que cae fuera del `viewBox` se recorta **en silencio**, sin error y sin aviso. Y si cambia una copia, cambian las dos.

### 1.2 Paleta

Los valores están en `@theme` (`globals.css`) y se usan por nombre (`text-tinta`, `bg-papel`). Aquí, el trabajo de cada uno:

**Superficies** — tres niveles y ninguno más:

| Token | Valor | Para qué |
|---|---|---|
| `papel` | `#F0F2F5` | Fondo de la página. Gris frío, no blanco: sobre blanco puro el mapa (que ya es claro) se come la pantalla |
| `papel-alto` | `#FFFFFF` | Tarjetas que se levantan del fondo |
| `papel-hundido` | `#E6E9EE` | Zonas hundidas: campos, estados deshabilitados |

**Texto sobre superficies claras** — derivan del marino aclarándose; nunca un gris puro, que al lado del marino se ve sucio:

| Token | Valor | Para qué |
|---|---|---|
| `tinta` | `#1A3E62` | Texto principal y títulos |
| `tinta-70` | `#4A5C70` | Párrafos y descripciones |
| `tinta-50` | `#5B6B7D` | Texto de apoyo (4,9:1) |
| `tinta-30` | `#7D8B9C` | Solo placeholders y pistas. **3,1:1: no se usa para texto que haya que leer** |

**Marca oscura** — `marino` `#0F295A` (la barra de navegación, el marcador seleccionado y los grupos de chinchetas del mapa) y `marino-alto` `#16406B` (lo que se aclara al pasar el ratón encima). Encima de ellos, el texto va en `sobre-marino` `#FFFFFF` o `sobre-marino-tenue` `#A9BCD4`.

**Acción** — `senal` `#00707E` con `senal-hondo` `#005A66` (estado al pasar) y `senal-suave` `#E2F1F3` (fondos suaves).

**Turquesa de marca** — `turquesa` `#00D2B8`, `turquesa-claro` `#00E5C9`, `turquesa-hondo` `#008B9B`. Es el color del logo para donde **no** lleva texto blanco encima: franjas, rellenos, el punto activo de la barra, el borde de una tarjeta destacada.

**Estados** — `menta-suave`/`menta-hondo` (confianza: «Verificado», «Dueño directo»), `destacado`/`destacado-suave` (anuncio **pagado**), `aviso`/`aviso-suave` (tarea **pendiente**), `alerta`/`alerta-suave` (error).

#### Por qué el color de acción NO es el turquesa del logo

Parece una contradicción y no lo es. El turquesa claro (`#00D2B8`) da **1,9:1** con texto blanco encima: legible no es. El turquesa hondo (`#008B9B`) tampoco llega — **4,1:1**, por debajo del 4,5:1 que pide WCAG AA para texto normal.

Así que el turquesa de marca se reserva para lo que sí lo soporta, y la acción usa ese mismo turquesa **oscurecido hasta pasar el umbral** (`#00707E`, 5,8:1 con blanco). El ojo lo lee como el mismo color porque lo es, dos pasos más abajo. No es una concesión estética: es la diferencia entre un botón que se lee y uno que no. Y cuando el botón va sobre marino, el par se gira: fondo turquesa y texto marino (`.btn-turquesa`, 7,4:1).

⚠️ **No hay tokens de «éxito» ni de «información», y es a propósito.** La guía anterior proponía `#4CAF50` y `#03A9F4`; ninguno tiene usuario en el producto. Un token sin usuario es peso muerto que hace el archivo más largo y esconde cuáles importan. Cuando exista la primera pantalla que confirme algo, se añaden las dos líneas.

⚠️ **`destacado` y `aviso` son distintos a propósito.** Uno es un anuncio pagado; el otro, una tarea pendiente. Compartían un solo color («latón») y eso era una trampa: el día que se ajustara el color del destaque, cambiarían sin querer los avisos de todo el panel.

📌 **Decisión abierta.** El turquesa de la interfaz viene del logo **anterior**. La entrega nueva trae `#0DD1D3`/`#089596`, un punto más cian. No se movió al cambiar el logo para no tocar la interfaz entera sin revisarla; decidirlo es trabajo del próximo bloque.

### 1.3 Tipografía

**Inter, y para todo el producto.** La guía la pide por una razón concreta: está diseñada para interfaces y para leer cifras —precios, metros cuadrados, habitaciones—, y en Innover la mitad de la pantalla son cifras.

| Token | Tamaño | Para qué |
|---|---|---|
| `text-micro` | 11 px | Metadatos y unidades |
| `text-menor` | 13 px | Texto de apoyo, etiquetas de campo |
| `text-cuerpo` | 15 px | Cuerpo del texto |
| `text-normal` | 17 px | Texto de lectura larga, marca de la barra |
| `text-grande` | 22 px | Títulos de tarjeta |
| `text-titulo` | 30 px | Títulos de sección |
| `text-display` | 44 px | Portada |

La escala sigue *Elements of Typographic Style* (ratio 1,25) y los nombres son semánticos, no numéricos: `text-cuerpo` sobrevive a un rediseño, `text-4xl` no. Los titulares van con `leading-apretado` (1,15) y un `letter-spacing` de −0,015 em; el cuerpo, con `leading-cuerpo` (1,6).

**Y una excepción, contada:** `font-display` (Playfair Display, una serif de alto contraste) existe para **una sola frase** —el titular del panel de acceso— porque va sobre fondo oscuro, sin cifras y sin campos. No se usa en ninguna otra pantalla. Antes de añadir una segunda familia, mira si esa frase vale dos archivos de fuente que alguien descarga.

⚠️ La palabra «INNOVER» **no** es parte del SVG: es texto HTML. Un texto SVG no se puede seleccionar, ni buscar, ni leer un lector de pantalla, y un buscador no lo indexa. Va en mayúsculas y con `tracking-[0.07em]`, que es el espaciado del archivo original (10 unidades sobre un tamaño de 130).

### 1.4 Forma, espacio y sombra

- **Espaciado:** escala de 4 px (`--spacing`). Un solo número raro que aparezca en el sistema hace que dos personas discrepen.
- **Radios:** tres, con tres trabajos — `radius-chico` 3 px (campos pequeños, chips, distintivos), `radius-medio` 6 px (botones y tarjetas del producto), `radius-grande` 12 px (paneles grandes y la tarjeta de acceso).
- **Pastilla (`rounded-full`):** la forma del acceso —campos y botón—. Es la única pantalla que la usa. El resto del producto va a 6 px. **Qué gana en las demás pantallas es una decisión abierta**: no se copia la pastilla a una pantalla sin decidirlo.
- **Sombras:** siempre el marino con alfa, nunca negro. Una ficha levanta poco al pasar por encima (`rgb(15 41 90 / 0,07)`); la tarjeta de acceso se levanta más (`rgb(15 41 90 / 0,14)`) porque no está *sobre* la página, está *delante* de ella.
- **Foco por teclado:** se hereda de `--foco`. Un anillo de un solo color no sirve para fondos claros y oscuros a la vez —el turquesa oscuro se pierde sobre marino (1,8:1) y el claro sobre blanco (1,9:1)—, así que cada superficie declara `--foco` (`.sobre-marino`, `.superficie-clara`) y los hijos lo recogen.

---

## 2. Cómo se compone una pantalla

Reglas que valen para cualquier pantalla nueva:

- **El fondo es `papel`; el contenido que importa va sobre `papel-alto`.** Nada de cajas dentro de cajas: una tarjeta sobre el papel, y dentro de la tarjeta se separa con líneas (`linea`), no con más sombras.
- **Un solo color de acción por pantalla.** Si dos elementos compiten por la mirada, ninguno la tiene.
- **El turquesa brillante está reservado**: es de la propiedad destacada (un anuncio pagado) y del punto activo de la barra. Un racimo de chinchetas, por ejemplo, va en marino: un grupo es un *resumen*, no un anuncio.
- **Los precios y las cifras van en `tabular-nums`** (clase `.cifra`): una columna de precios se lee como columna, no como un temblor de dígitos.
- **Los textos que importan van escritos en el HTML**, no pintados por JavaScript: es lo que hace que una ficha se comparta y se indexe.
- **Nada de cargar Mapbox en una pantalla pública.** Se cobra por carga de mapa, y una pantalla que se ve antes de tener cuenta (o la ve un rastreador) no puede pagarlo. El panel del acceso es la prueba de que se puede decir «aquí se busca viendo el mapa» sin un mapa de verdad.

### 2.1 La pantalla de acceso (hecha: es la referencia)

Una tarjeta de dos columnas sobre el gris del fondo:

| | |
|---|---|
| Tarjeta | Máx. **1080 px**, mínimo **660 px** de alto desde `lg`, radio 12 px, sombra ancha |
| Columna del formulario | La mitad izquierda, con el aire repartido: marca arriba, título y campos centrados, pie abajo |
| Campos | Pastilla, 16 px de relleno horizontal y 12 vertical, etiqueta arriba en `text-menor`, error debajo en `alerta` |
| Botón | `.btn-principal` en pastilla, ancho completo |
| Columna de marca | Degradado `210deg` de `senal-hondo` a `marino`; curvas de nivel al 13 % en turquesa; titular en serif; maqueta del buscador |

**En móvil** la tarjeta va **a sangre**: sin margen, sin esquinas y a pantalla completa, con la marca apilada y centrada (en el diseño, un marco alrededor del marco es un borde que no pinta nada). Desde `sm` flota; desde `lg` aparece la columna oscura.

**El panel oscuro no es un mapa:** son dos PNG (`frontend/public/acceso/`) más unas curvas de nivel en SVG. El buscador entra sangrando por el borde derecho y por abajo, y la tarjeta de filtros va delante, abajo a la izquierda, como si estuviera desplegada encima. Todo el panel es decorativo (`aria-hidden`, imágenes con `alt=""`); lo que importa —el titular— es texto de verdad, y por eso se lee y se indexa.

⚠️ Los recortes de `public/acceso/` llevan 12 px de margen transparente alrededor del dibujo y **`h-auto` obligatorio** en el `<img>`: con `width`/`height` puestos, el navegador aplica los dos atributos como estilos, así que una anchura en `%` por encima de ellos deja la altura clavada en píxeles y el dibujo sale aplastado.

#### Lo que el acceso dejó asentado

1. **Un degradado se comprueba por sus dos puntas.** El panel lleva texto blanco sobre `senal-hondo` (7,9:1) y sobre `marino` (14,1:1). «Comprobar el degradado» no existe: un degradado no tiene un contraste único.
2. **La forma pastilla es del acceso, no del sistema** (ver §1.4).
3. **Lo que no se pone también es diseño.** No hay botones de Google o Apple (sin OAuth en el backend, solo pueden fallar en la pantalla de entrada), ni «¿olvidaste tu contraseña?» (no hay endpoint de recuperación, ni correo saliente, ni forma de que un administrador te ponga una contraseña). Un enlace que lleva a una pantalla que no existe es peor que su ausencia.

### 2.2 El buscador (por rediseñar)

La intención, que ya está construida y no cambia: **map-first**. Lista de tarjetas y mapa a la vez —el mapa ocupa la mayor parte—, filtros por tipo, distrito, habitaciones, precio y orden en una franja superior, y el mapa enseñando **el resultado filtrado entero** (hasta un tope de 1.000, y confesando cuándo recorta). Las chinchetas se agrupan al alejar el zoom y el grupo dice cuántas hay dentro.

Lo que falta es la **composición visual** según el boceto que venga: jerarquía de la franja de filtros, forma de las tarjetas, peso del mapa. Lo que no se toca: que la lista y el mapa compartan los mismos filtros, que el mapa no mienta por recorte, y los colores de los marcadores (viven en `globals.css` como clases, porque Mapbox los construye desde JavaScript).

### 2.3 El resto de las pantallas (por rediseñar)

Ficha de la propiedad, publicación, perfil, contactos (leads), administración y favoritos. Hoy usan el sistema de tokens con la composición de la primera versión.

Intenciones de producto que ya están construidas y que un rediseño **no debe romper**: la ficha es pública y su contenido viaja escrito en el HTML (es el enlace que se comparte); las fotos se pintan con `<img>` y **nunca** con `next/image`, porque el optimizador de Next descarga la imagen en el servidor y las direcciones las escribe quien publica (sería un SSRF de manual); los popups del mapa se construyen con `textContent`.

Del panel B2B, lo que la guía pedía sigue en pie como horizonte: métricas arriba, tabla de contactos con su estado, y gestión de inmuebles. Lo que **no** existe todavía: las tarjetas de KPI de las que hablaba la guía —vistas del inmueble, mensajes no leídos— porque no hay ni el dato que las alimente, y el asistente de IA con su burbuja flotante (Fase 7).

---

## 3. Componentes con nombre propio

Los que ya existen en `globals.css` (`.btn`, `.campo`, `.etiqueta`, `.ficha`, `.distintivo`, `.marcador*`, `.globo-*`, `.franja-marca`, `.tarjeta-acceso`, `.panel-acceso`, `.contornos`) y los que la guía proponía y siguen pendientes:

1. **`Tour3DViewer`** — el recorrido 3D se abre hoy en un contenedor incrustado; falta el aislamiento a pantalla completa del que hablaba la guía.
2. **Tarjeta de propiedad con carrusel** — hoy la tarjeta del buscador enseña la portada y la galería vive en la ficha.
3. **Asistente de IA** — no empezado (Fase 7 del roadmap).

---

## 4. Las dos vistas del producto

- **B2C (buscador):** mapa primero, tarjetas después. El mapa es el que contesta «¿dónde hay?»; la lista, «¿qué hay?».
- **B2B (panel):** analítico, orientado a la conversión. Menos decoración, más cifras y estados — que es justo donde Inter y `.cifra` hacen su trabajo.

---

## 5. Reglas que no se negocian

- **Un color suelto en un componente es un fallo.** Ni `#008B9B` dentro de un `.tsx`, ni en JavaScript. Mapbox tampoco es una excepción: sus colores viven en `globals.css`.
- **No hay `tailwind.config.js` y no se crea.** Tailwind v4 es CSS-first: los tokens van en `@theme`, y un config de la v3 se ignora en silencio — compila sin error y **sin estilos**.
- **Ni Shadcn UI ni Material UI.** El sistema es propio y son ~40 clases.
- **Cada token tiene un usuario**, y los tres comprobadores lo vigilan:
  - `npm run verificar:contraste --workspace=frontend` — 31 combinaciones de texto y fondo, calculadas **leyendo `globals.css`**. Si un color deja de leerse, falla.
  - `npm run verificar:tokens --workspace=frontend` — ningún token declarado se queda sin emitir. Tailwind borra los que ninguna utilidad usa, y si uno se usara solo dentro de un `var()`, **el color no se pintaría, sin ningún error**.
  - `npm run verificar:clases --workspace=frontend` — ninguna clase escrita en un componente se queda sin CSS: un nombre renombrado, una errata o una utilidad que no existe.
- **El foco por teclado no se quita.** Es un fallo de accesibilidad, no una preferencia.
- **Un token de color no se inventa para una pantalla.** Si una pantalla necesita un color nuevo, primero se mira si el problema es la pantalla.

---

## 6. Pendientes de decisión

Cosas que el rediseño del resto del frontend tendrá que cerrar, y que hoy están a propósito sin cerrar:

- [ ] El **turquesa de la interfaz** frente al de la entrega nueva (§1.2).
- [ ] Si la forma **pastilla** del acceso se queda solo ahí o pasa a las demás pantallas (§1.4).
- [ ] Si la **serif** sigue siendo exclusiva del panel de acceso (§1.3).
- [ ] Los **bocetos** de las pantallas que faltan: hoy solo hay diseño terminado de la pantalla de acceso.
