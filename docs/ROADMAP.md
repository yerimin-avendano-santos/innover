# 🗺️ Hoja de Ruta de Desarrollo y Aprendizaje (ROADMAP)

Cada fase tiene dos listas: lo que **hay que aprender** y lo que **hay que construir**. Una casilla marcada significa que está terminado y funcionando.

> 📖 Al terminar cada fase, el *qué* queda en el código y el *por qué* en [`02_ARQUITECTURA_Y_SEGURIDAD.md`](./02_ARQUITECTURA_Y_SEGURIDAD.md).

---

## Fase 1: Fundamentos y arquitectura 🏗️

- [x] **Aprender:** qué es frontend, backend, API y base de datos
- [x] **Aprender:** Git y control de versiones
- [x] **Definición técnica:** JavaScript/TypeScript con Node.js, React y Next.js
- [x] **Diseño de base de datos:** el modelo entidad-relación de INNOVER

## Fase 2: Backend y base de datos ⚙️

- [x] **Aprender:** servidor web con Express
- [x] **Aprender:** PostgreSQL relacional
- [x] **Aprender:** **datos espaciales con PostGIS** (puntos, `ST_DWithin`, índices GIST)
- [x] **Desarrollo:** modelo de propiedades con su migración versionada
- [x] **Desarrollo:** CRUD completo con arquitectura por capas
- [x] **Desarrollo:** **migraciones de Prisma** en vez de `db push`
- [x] **Desarrollo:** búsqueda geográfica por radio en km

## Fase 3: Seguridad y autenticación 🔐

- [x] **Aprender:** qué es un JWT y cómo se verifica
- [x] **Aprender:** encriptación de contraseñas con bcrypt
- [x] **Aprender:** **cookies `httpOnly`** frente a `localStorage`
- [x] **Aprender:** **autorización en tres capas** (sesión → rol → recurso)
- [x] **Aprender:** **mass assignment** y por qué restringir la lista de campos
- [x] **Aprender:** **XSS** y por qué `setHTML()` es una decisión, no un atajo
- [x] **Desarrollo:** registro y login con cookie de sesión
- [x] **Desarrollo:** roles `CLIENTE`, `PROPIETARIO`, `AGENTE` y `ADMIN`
- [x] **Desarrollo:** el rol **nunca** se autoasigna en el registro
- [x] **Desarrollo:** validación de entrada con Zod en todas las rutas
- [x] **Desarrollo:** rate limiting, CORS con lista blanca y cabeceras de seguridad
- [x] **Desarrollo:** renovación de sesión: el pase corto (2 h, cookie `innover_token`) y el token que lo renueva (30 días, cookie `innover_renovacion`, acotada a `/api/auth`, guardada como hash y **revocable**). *El pase corto es autocontenido —se verifica con la firma, sin consultar nada— y por eso NO se puede revocar; el largo existe en la base y por eso sí. La asimetría es el diseño: uno que no se puede revocar tiene que durar poco, y uno que dura mucho tiene que poder revocarse. Antes había lo peor de los dos juntos: una cookie de 7 días con un JWT de 2 horas dentro, cuyo único desenlace posible era "tu sesión expiró" cada dos horas*
- [x] **Aprender:** **rotación de tokens y detección de reutilización.** Cada renovación entrega un token nuevo y marca el usado, así que un token robado deja de servir en cuanto el dueño renueva. *Con una ventana de gracia de 60 s: dos pestañas que renuevan a la vez mandan el mismo token viejo, y sin ese margen el sistema tomaría al dueño por un ladrón y lo echaría de su propia cuenta*
- [x] **Desarrollo:** 281 pruebas de integración y seguridad (226 API + 55 del puente)

## Fase 4: Frontend y mapas interactivos 🎨

- [x] **Aprender:** React y el ciclo de componentes
- [x] **Aprender:** Next.js y el App Router
- [x] **Aprender:** **Tailwind v4 CSS-first** (tokens con `@theme`, sin config JS)
- [x] **Aprender:** **puente SSR** entre navegador y backend (mismo origen, sin CORS)
- [x] **Desarrollo:** buscador con mapa a pantalla completa
- [x] **Desarrollo:** filtros por tipo, distrito, habitaciones, precio y orden
- [x] **Desarrollo:** marcadores con precio y popup seguro (sin XSS)
- [x] **Desarrollo:** chinchetas agrupadas por cercanía, con tres tamaños y el número dentro, y el mapa enseñando el resultado filtrado **entero** (hasta un tope de 1.000, y confesando cuándo recorta). *Sin agrupar, cuarenta precios repartidos por la conurbación se pisan unos sobre otros y el mapa deja de contestar lo único que tiene que contestar: dónde hay qué. Y con solo la primera página de la lista, alejarse para ver "¿dónde hay?" diría que hay barrios vacíos que no lo están: el mapa y la lista comparten el `where` del backend (`construirWhere`) para que no puedan divergir. La lógica de agrupar vive aparte, en `lib/clustering.ts`, y es lo único del frontend con prueba propia (`verificar:clustering`)*
- [x] **Desarrollo:** ficha de detalle con URL por slug
- [x] **Desarrollo:** ficha como **Server Component**: el contenido y los metadatos (`title`, `description`, `og:`) viajan escritos en el HTML. Antes llegaba vacía y la pintaba JavaScript — servía para una persona y no para lo que la página existe (el enlace que se comparte y lo que indexa Google). *Sin `loading.tsx` a propósito: con streaming, `notFound()` contestaría 200 en vez de 404*
- [x] **Desarrollo:** descubrimiento para buscadores: `/robots.txt` y `/sitemap.xml` generados desde la API. Sin esto, la ficha más indexable del mundo no se encuentra — el buscador está detrás del muro, así que un rastreador no tiene un solo enlace interno hacia una propiedad
- [x] **Desarrollo:** formulario de publicación con vista previa en el mapa
- [x] **Desarrollo:** perfil del usuario y gestión de publicaciones
- [x] **Desarrollo:** favoritos: el corazón de la ficha y la lista en `/favoritos`. *La lista es privada por definición —saber que alguien guardó una casa es saber que está buscando—, así que el `usuario_id` sale del token y el candado de guardar es el mismo que el de la ficha: no se puede guardar lo que no se puede abrir. La tabla es aparte y con clave única `(usuario, propiedad)`, para que el botón sea un interruptor y no un contador: apretarlo dos veces guarda una, no falla*
- [x] **Desarrollo:** pantalla de acceso rediseñada: tarjeta de dos columnas con el formulario a un lado y el panel de marca al otro, campos en pastilla y el ojo para ver la contraseña que se está escribiendo. *Es la puerta del producto y era la única pantalla que no había pasado por el diseño. Se le quitó la barra de navegación, que ofrecía "Buscar" y "Publicar" a quien todavía no tiene sesión; el armazón se partió en dos grupos de rutas —`(sitio)` con barra y pie, `(acceso)` sin nada— y ninguna URL cambió. Un layout hijo no puede quitar lo que dibuja su padre, así que el armazón tenía que subir a un hermano. El panel de la derecha es una maqueta de imágenes, no un mapa: Mapbox se cobra por carga y esa pantalla la ve quien todavía no tiene cuenta*
- [x] **Desarrollo:** logo nuevo en toda la app, con las dos copias sincronizadas: `components/Logo.tsx` (la interfaz) y `app/icon.svg` (el favicon). *El dibujo pasó de chincheta rellena a anillo hexagonal con la casa dentro, sobre la base del mapa. La palabra sigue siendo texto HTML —para que se seleccione y se indexe—, ahora en mayúsculas y espaciadas como en la entrega*
- [x] **Desarrollo:** «Recordar mi correo» en el acceso. *Solo el correo: guardar la contraseña en `localStorage` es dejar una llave bajo el felpudo, porque cualquier script de la página la puede leer. Y la casilla no viene marcada de fábrica —viene marcada si de verdad hay un correo guardado—, porque lo contrario decide por el usuario lo que se guarda en su dispositivo. No promete recordar la sesión: esa duración la fija el servidor (2 h el pase, 30 días la renovación) y el cliente no puede alargarla*
- [x] **Desarrollo:** `?redirect=` validado antes de usarlo. *`router.push` acepta direcciones absolutas, así que `?redirect=//otro-sitio` sacaba al usuario de Innover justo después de escribir su contraseña: el montaje clásico del phishing. Solo pasa una ruta interna, y la barra invertida también se rechaza porque los navegadores la normalizan a `/`*
- [x] **Desarrollo:** la portada manda al acceso, y el acceso ocupa la pantalla entera. *`/` sin sesión rebota a `/login?redirect=/` en vez de quedarse en una portada que explicaba el producto —`components/Invitacion.tsx`, borrada—: Innover es una herramienta, y lo que la presenta es el titular del panel. El rebote va en el cliente y no en un `middleware.ts` porque la sesión se comprueba contra la API: un middleware solo vería si HAY cookies, no si valen, y dejaría fuera justo a quien tiene el pase caducado con la renovación viva, que entra solo. Y quien ya tiene sesión no vuelve a ver el formulario: `/login` y `/registro` lo devuelven a `/` —o al `?redirect=`— en cuanto lo saben. La pantalla dejó de ser una tarjeta flotante (máx. 1080 × mín. 660, radio 12 y sombra ancha) y ahora llena el viewport, con el formulario en un carril de 26 rem centrado en su mitad; `.tarjeta-acceso` pasó a llamarse `.superficie-acceso` y perdió radio y sombra, porque las dos servían para despegarla del papel y ya no hay papel*
- [x] **Desarrollo:** rediseño del panel principal según `design/nuevo/principal/image.png`. *La barra pasa a `senal-hondo`; los filtros, a una sola fila con lupa y pastillas, y el contador se muda a la cabecera de la lista (con la frase corregida: «8 departamentos en venta en Amarilis», no «propiedades en venta departamentos»). La tarjeta es horizontal, con carrusel desde dos fotos, título y foto como enlaces de verdad y el clic de superficie para seleccionar en el mapa. El mapa sube del 53,5 % al 57,5 %, arranca en zoom 13, encuadra un resultado a 15 y varios con `padding: 40`/`maxZoom: 15.5`; «Mi ubicación» usa `GeolocateControl` con una pastilla propia, muestra la precisión y explica que el navegador solo la comparte en HTTPS o localhost. El corazón de favorito sigue fuera de la tarjeta: `es_favorito` no viaja en los listados*

## Fase 5: CRM para agentes (B2B) 🤝

- [x] **Desarrollo:** modelo de contactos (leads) con estado
- [x] **Desarrollo:** crear lead desde la ficha de una propiedad
- [x] **Desarrollo:** bandeja de leads del agente y del propietario directo
- [x] **Desarrollo:** métricas de conversión (total, cerrados, tasa de cierre)
- [x] **Desarrollo:** panel de administración (verificar identidades, gestionar roles y accesos)
- [x] **Desarrollo:** flujo de solicitud de agente con estado (aprobada / rechazada) — *backend: cola, historial, motivo de rechazo y auditoría de quién resolvió*
- [x] **Desarrollo:** pantalla de solicitud de agente: el formulario en `/perfil` y la cola en `/admin`. La API llevaba tiempo hecha y **no había forma de usarla** — se podía pedir ser agente con `curl`, que es como decir que no se podía. La mitad que importa es la de vuelta: el solicitante ve en su perfil si está en revisión, si lo aprobaron y, si lo rechazaron, **por qué** y quién lo revisó
- [x] **Desarrollo:** modelo del plan comercial (`GRATIS` / `PRO`) con vencimiento — *independiente del rol*
- [x] **Desarrollo:** candado del recorrido 3D y del destaque por plan, verificado **en el servidor** — *y preguntado en la interfaz por `plan_pro_activo`, nunca por `plan === 'PRO'`: el plan vence, y compararlo a mano en el formulario ofrece un campo que el servidor va a rechazar al guardar. Cuando el plan vence y ya había un recorrido publicado, el campo se sigue mostrando: el servidor deja conservarlo o quitarlo, y esconderlo dejaría al dueño sin poder limpiarlo*
- [ ] **Desarrollo:** cobro de la suscripción (el plan se asigna a mano desde el panel; falta la pasarela de pago)
- [ ] **Desarrollo:** créditos de contacto por plan

## Fase 6: Multimedia y 3D 🏠

- [ ] **Aprender:** almacenamiento de archivos en la nube (S3 / Cloudinary)
- [x] **Desarrollo:** fotos del anuncio: se publican pegando direcciones en `/publicar` y la ficha las enseña en una galería, con la portada escrita en el HTML y como `og:image` al compartir el enlace. *El campo `imagenes` ya guardaba direcciones, así que no hizo falta tocar la base ni esperar a Cloudinary — y por eso tampoco hace falta volver atrás: cuando llegue la subida, guardará la dirección que devuelva el almacenamiento y ni la ficha ni la tarjeta del buscador cambian una línea*
- [ ] **Desarrollo:** subida de archivos desde el formulario (lo que falta de verdad: almacenamiento y credenciales)
- [x] **Desarrollo:** galería en la ficha
- [x] **Desarrollo:** campo e incrustación del recorrido 3D
- [ ] **Desarrollo:** recorrido 360° con Matterport

## Fase 7: Inteligencia artificial 🤖

- [ ] **Aprender:** consumo de APIs de IA
- [ ] **Desarrollo:** asistente de "zona ideal" con test de necesidades
- [ ] **Desarrollo:** estimación de precio por zona
- [ ] **Desarrollo:** validación de identidad de propietarios (RENIEC)

## Fase 8: Producción 🚀

- [ ] **Aprender:** hosting de base de datos, backend y frontend
- [ ] **Aprender:** dominios, DNS y certificados HTTPS
- [ ] **Aprender:** CI/CD y despliegue automático
- [ ] **Desarrollo:** despliegue de INNOVER en producción
- [ ] **Desarrollo:** monitoreo y alertas

---

## 📌 Deuda técnica conocida

Lo que queda pendiente y conviene no olvidar:

- [ ] **Tests de componentes** (hay 281 de integración —226 de API y 55 del puente— y una unitaria, `verificar:clustering`, que prueba la lógica de agrupar del mapa; lo que no hay es forma de probar un componente de React sin navegador, y los marcadores del mapa son justo eso)
- [ ] **Subida de fotos** (hoy se pegan direcciones y la ficha las enseña; falta el botón de subir, que necesita almacenamiento y credenciales. El dato que se guarda es el mismo, así que no hay que rehacer nada)
- [ ] **Verificación contra RENIEC** (hoy el admin valida a ojo el documento)
- [ ] **Rate limiting distribuido** (el actual guarda contadores en memoria; con varias instancias hace falta Redis)
- [ ] **Búsqueda de texto completo** (PostgreSQL `tsvector` o Meilisearch)
- [ ] **Quitar un guardado sin entrar en el anuncio** (desde la lista de favoritos, el corazón no está: hay que abrir la ficha. Ponerlo en la tarjeta obliga a decidir qué pasa con el hueco —¿desaparece?, ¿se puede deshacer?—: es una decisión de diseño, no una línea de código)
- [ ] **Auditoría de cambios** (bitácora de quién editó qué)
- [ ] **Recuperación de contraseña** (no hay endpoint, ni correo saliente, ni forma de que un ADMIN restablezca la contraseña de nadie: `actualizarUsuarioAdminSchema` no acepta el campo. Por eso el acceso NO tiene el enlace «¿olvidaste tu contraseña?» — llevaría a una pantalla que no existe. Un ADMIN puede desactivar la cuenta y crear otra, pero eso no es recuperar nada)
- [ ] **Entrar con Google o Apple** (necesita backend de OAuth y credenciales de los proveedores. Los botones no se pusieron en el acceso a propósito: un botón que solo puede fallar en la pantalla de entrada es peor que no tenerlo)
- [ ] **Página 404 propia** (hoy se usa la de Next, que está en inglés y sin la marca. Antes la envolvía la barra de navegación y ahora no, porque el armazón pasó a los grupos de rutas: una página de `app/not-found.tsx` con una salida hacia el buscador lo arregla en un archivo)
- [ ] **El destaque no recuerda su origen** (al bajar a GRATIS se retiran *todos* los destaques del usuario, incluidos los que puso un admin a mano. Se arregla con una columna `destacado_origen`, pero hoy no hay forma de distinguirlos)

### Lo que se rompió al principio y conviene no repetir

- **`next dev` activa React StrictMode**: los efectos corren dos veces. Si un `cleanup` cancela una petición, su `.catch()` NO debe tocar el estado, o se provoca un "logout falso" que expulsa al usuario de las páginas protegidas. Ver el comentario en `contextos/Auth.tsx`.
