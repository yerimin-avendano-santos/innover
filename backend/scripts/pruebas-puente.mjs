// Prueba del puente frontend → backend, como lo vería el navegador.
// Comprueba que la cookie httpOnly viaja en los dos sentidos.
//
// 📌 EL ORDEN DE ESTAS PRUEBAS NO ES CASUAL
//
// Se cuentan en el orden en que las vive una persona: primero llega sin
// cuenta y se encuentra el muro; después se registra; después busca; y al
// final cierra sesión. Poner el logout al principio —como estaba— dejaría
// las pruebas de búsqueda sin sesión, y con el buscador cerrado fallarían
// todas por un motivo que no tiene nada que ver con lo que prueban.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FRONTEND = 'http://localhost:3000';
const BACKEND = 'http://localhost:5000';

let ok = 0;
let fallos = 0;

function afirmar(cond, nombre, detalle = '') {
  if (cond) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nombre}`);
  } else {
    fallos++;
    console.log(`  \x1b[31m✗\x1b[0m ${nombre}`);
    if (detalle) console.log(`      \x1b[90m${detalle}\x1b[0m`);
  }
}

const sufijo = Date.now();
const email = `puente-${sufijo}@innover.dev`;

/**
 * 🔑 COOKIES: la suite se comporta como un navegador.
 *
 * ⛔ ANTES ESTO ERA `cookie.split(';')[0]`, Y FUNCIONABA DE CASUALIDAD.
 *
 * Había una sola cookie, así que quedarse con el primer trozo bastaba — aunque
 * ese trozo salía de la cabecera `Set-Cookie` ENTERA (`innover_token=…;
 * Path=/; HttpOnly; Max-Age=…`), que no es una cabecera `Cookie` válida: el
 * backend la entendía porque `cookie-parser` ignora lo que no reconoce, no
 * porque estuviera bien escrito.
 *
 * Desde que la sesión usa DOS cookies (el pase corto y el token que lo
 * renueva), quedarse con la primera dejaría fuera justo la que mantiene la
 * sesión viva, y las pruebas de renovación no probarían nada. Esto imita a un
 * navegador de verdad: las cookies se acumulan, se reemplazan por nombre, y
 * `Max-Age=0` significa borrar.
 */
function cookiesDe(respuesta, cookieActual = '') {
  const galletas = new Map();

  for (const par of cookieActual.split('; ')) {
    const corte = par.indexOf('=');
    if (corte > 0) galletas.set(par.slice(0, corte), par.slice(corte + 1));
  }

  for (const linea of respuesta.headers.getSetCookie?.() ?? []) {
    const [par, ...atributos] = linea.split('; ');
    const corte = par.indexOf('=');
    if (corte <= 0) continue;

    const nombre = par.slice(0, corte);
    const borrada = atributos.some((a) => /^max-age=0$/i.test(a.trim()));

    if (borrada) galletas.delete(nombre);
    else galletas.set(nombre, par.slice(corte + 1));
  }

  return [...galletas].map(([n, v]) => `${n}=${v}`).join('; ');
}

console.log(`\nProbando el puente ${FRONTEND} → ${BACKEND}\n`);

// --- 1. El muro, a través del puente ---
//
// El buscador exige sesión. Se comprueba por el puente y no contra el
// backend directamente a propósito: lo que tiene que fallar es la ruta que
// usa el navegador. Probar el backend a pelo diría que el candado existe,
// pero no que esté en el camino que recorre el usuario.
{
  const r = await fetch(`${FRONTEND}/api/propiedades?tipo=VENTA`);
  afirmar(
    r.status === 401,
    '⛔ sin sesión, el buscador devuelve 401 también por el puente',
    `status ${r.status}`
  );
}

// --- 2. El puente no filtra la URL del backend ---
{
  const r = await fetch(`${FRONTEND}/`);
  const html = await r.text();
  afirmar(!html.includes('localhost:5000'), '⛔ la URL del backend NO aparece en el HTML');
}

// --- 3. Registro por el puente, con captura de cookie ---
let cookie = '';
{
  const r = await fetch(`${FRONTEND}/api/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Usuario Del Puente',
      email,
      contrasena: 'ClaveSegura2026',
    }),
  });
  const setCookie = r.headers.getSetCookie() ?? [];
  cookie = cookiesDe(r);

  afirmar(r.status === 201, 'registro por el puente', `status ${r.status}`);
  afirmar(
    cookie.includes('innover_token=') && cookie.includes('innover_renovacion='),
    '⛔ las DOS cookies de la sesión llegan al navegador a través del puente',
    cookie.slice(0, 140)
  );
  afirmar(
    setCookie.every((c) => c.includes('HttpOnly')),
    '⛔ y las dos son HttpOnly (ningún script puede leerlas)',
    setCookie.map((c) => c.slice(0, 40)).join(' | ')
  );

  /**
   * ⛔ ESTA ES LA PRUEBA DEL ARREGLO DEL PUENTE.
   *
   * El puente copiaba las cabeceras de respuesta con `get('set-cookie')`, que
   * con DOS cookies devuelve una sola cabecera con las dos pegadas por una
   * coma — y una coma también separa atributos dentro de una cookie
   * (`Expires=Wed, 21 Oct 2026 …`), así que el navegador recibe un texto
   * ambiguo. Que lleguen DOS cabeceras separadas es lo que se comprueba aquí,
   * y es imposible de ver en el uso normal: la sesión funcionaría a medias y
   * sin un solo error.
   */
  afirmar(
    setCookie.length === 2,
    '⛔ el puente reenvía las dos Set-Cookie SEPARADAS (no pegadas con una coma)',
    `llegaron ${setCookie.length}: ${setCookie.map((c) => c.split('=')[0]).join(', ')}`
  );

  afirmar(
    setCookie.some((c) => c.includes('Path=/api/auth')),
    '⛔ el token de renovación solo viaja a /api/auth (no en cada petición)',
    setCookie.find((c) => c.includes('renovacion'))?.slice(0, 80) ?? '(no llegó)'
  );
}

// --- 4. La cookie autentica las peticiones siguientes ---
{
  const r = await fetch(`${FRONTEND}/api/auth/perfil`, {
    headers: { Cookie: cookie },
  });
  const d = await r.json();
  afirmar(r.status === 200, 'la cookie del puente autentica el perfil', `status ${r.status}: ${JSON.stringify(d).slice(0, 120)}`);
  afirmar(d.email === email, 'el perfil corresponde al usuario correcto');
}

// --- 5. Autorización propagada ---
{
  const r = await fetch(`${FRONTEND}/api/usuarios`, {
    headers: { Cookie: cookie },
  });
  afirmar(r.status === 403, '⛔ las rutas protegidas del backend también lo están en el puente', `status ${r.status}`);
}

// --- 6. El buscador, ya con sesión ---
//
// Aquí se guarda un slug para la prueba siguiente, que es la que de verdad
// importa: comprobar que ese enlace abre SIN cuenta.
let slugCompartible = null;
{
  const r = await fetch(`${FRONTEND}/api/propiedades?tipo=VENTA`, {
    headers: { Cookie: cookie },
  });
  const d = await r.json();
  afirmar(r.status === 200, 'con sesión, el buscador responde por el puente', `status ${r.status}`);
  afirmar(Array.isArray(d.datos), 'llega el array de propiedades');
  afirmar(d.datos.length > 0, `hay ${d.datos.length} propiedades en venta`);
  afirmar(
    d.datos.every((p) => typeof p.precio === 'number'),
    'los precios llegan como números'
  );

  slugCompartible = d.datos[0]?.slug ?? null;
}

// --- 7. El enlace compartido abre SIN sesión ---
//
// 📌 ESTA ES LA PRUEBA QUE PROTEGE EL SEO DEL PRODUCTO.
//
// Cerrar el buscador es fácil; lo fácil de romper sin querer es lo otro.
// Si alguien "cerrara bien" las propiedades y la ficha pidiera sesión, cada
// enlace compartido por WhatsApp daría contra un muro y Google no tendría
// nada que indexar. El producto perdería su única puerta de entrada
// orgánica, y ninguna prueba de búsqueda se daría cuenta.
//
// Se pregunta dos veces, y no es lo mismo:
//   · por la API    → el dato viaja
//   · por la PÁGINA → el dato llega escrito en el HTML
//
// Lo segundo es lo que un buscador lee sin ejecutar JavaScript, y es
// exactamente lo que estaba mal: la ficha se servía vacía y el contenido
// aparecía después. Estuvo así hasta que se midió.
{
  afirmar(slugCompartible !== null, 'se obtuvo un slug del buscador para compartir');

  // Sin cookie a propósito: es lo que ve quien recibe el enlace.
  const r = await fetch(`${FRONTEND}/api/propiedades/${slugCompartible}`);
  const d = await r.json();
  afirmar(
    r.status === 200,
    '⛔ la API de la ficha abre sin sesión: es el enlace que se comparte',
    `status ${r.status}: ${JSON.stringify(d).slice(0, 120)}`
  );
  afirmar(d.propiedad?.slug === slugCompartible, 'la ficha devuelve la propiedad pedida');
  afirmar(
    typeof d.propiedad?.titulo === 'string' && d.propiedad.titulo.length > 0,
    'la propiedad trae título (hace falta para comprobar el HTML)'
  );

  // --- La PÁGINA, no la API ---
  const pagina = await fetch(`${FRONTEND}/propiedad/${slugCompartible}`);
  const html = await pagina.text();

  afirmar(pagina.status === 200, 'la página de la ficha responde 200 sin sesión');
  afirmar(
    html.includes(d.propiedad.titulo),
    '⛔ el TÍTULO de la propiedad viene en el HTML, no lo pinta JavaScript',
    'un buscador que no ejecute JavaScript no vería nada'
  );

  // Y dentro de un `<h1>`, que es lo que un buscador lee como título de la
  // página. Que el texto esté en un `div` cualquiera no vale lo mismo.
  const abre = html.indexOf('<h1');
  const cierra = html.indexOf('</h1>', abre);
  afirmar(
    abre >= 0 && cierra > abre && html.slice(abre, cierra).includes(d.propiedad.titulo),
    '⛔ y va dentro de un <h1>, no en cualquier parte del HTML'
  );

  // --- Las FOTOS, que también tienen que venir en el HTML ---
  //
  // La foto principal la pinta el servidor en la primera pasada: la isla de
  // cliente sirve para CAMBIARLA, no para que aparezca. Si alguien moviera la
  // galería a un `useEffect`, la ficha se vería igual de bien en un navegador
  // y para un rastreador sería una página sin una sola imagen.
  const fotos = d.propiedad.imagenes ?? [];
  afirmar(
    fotos.length > 0,
    'la propiedad de ejemplo trae fotos (si no, esto no comprueba nada)',
    'las pone el seed: revisa que siga haciéndolo'
  );

  // ⚠️ Las direcciones llevan `&` (los parámetros de la imagen) y React los
  // escribe escapados como `&amp;` dentro del atributo. Buscar la dirección
  // literal fallaría con el HTML perfecto, así que se buscan las dos formas.
  const enHtml = (url) => html.includes(url) || html.includes(url.replace(/&/g, '&amp;'));

  afirmar(
    fotos.every(enHtml),
    '⛔ las direcciones de las fotos vienen escritas en el HTML',
    `de ${fotos.length} fotos, en el HTML: ${fotos.filter(enHtml).length}`
  );

  afirmar(
    html.includes('property="og:image"'),
    '⛔ al compartir el enlace, la previsualización trae la portada',
    'sin og:image, WhatsApp muestra el enlace sin ninguna imagen'
  );

  // --- Guardar: sin sesión, ENLACE; nunca un botón que devuelva 401 ---
  //
  // Esta petición va sin cookie, así que no hay sesión. El servidor no manda
  // `es_favorito` —no hay nadie a quien guardarle nada— y la página responde
  // con un enlace a entrar en vez del interruptor. Ofrecer el corazón a un
  // visitante anónimo sería ofrecerle un 401 al primer clic.
  afirmar(
    html.includes('/login?redirect=/propiedad/'),
    '⛔ sin sesión, "Guardar" lleva a entrar en vez de mandar al muro',
    'la ficha es pública: el botón que exige cuenta no puede aparecer aquí'
  );
}

// --- 7b. Una propiedad que no existe responde 404, no 200 ---
//
// 📌 ESTA PRUEBA VIGILA UN `loading.tsx` QUE ALGUIEN AÑADA MAÑANA.
//
// Añadirlo es lo natural para enseñar un esqueleto mientras carga, y
// convierte esta ruta en una respuesta en streaming — y Next contesta 200
// cuando envía en streaming, incluso si la propiedad no existe. Eso es un
// "soft 404": Google indexaría como válidas URLs inventadas.
//
// El fallo no rompe nada visible: la página se ve bien y contesta un código
// equivocado. Solo se nota aquí.
{
  const r = await fetch(`${FRONTEND}/propiedad/esta-propiedad-no-existe-000`);
  afirmar(
    r.status === 404,
    '⛔ una ficha inexistente responde 404 (¿alguien añadió un loading.tsx?)',
    `status ${r.status} — con streaming, Next contesta 200`
  );
}

// --- 8. Filtrado por el puente ---
{
  const r = await fetch(`${FRONTEND}/api/propiedades?tipo=ALQUILER`, {
    headers: { Cookie: cookie },
  });
  const d = await r.json();
  afirmar(
    d.datos.every((p) => p.tipo === 'ALQUILER'),
    'el filtro por tipo funciona por el puente'
  );
}

// --- 9. PostGIS por el puente ---
{
  // Coordenadas del centro de Huánuco. Antes estaban en Lima (-12.11, -77.03),
  // así que el radio no abarcaba ninguna propiedad sembrada: la comprobación de
  // `distancia_km` no llegaba a ejercitarse.
  const r = await fetch(
    `${FRONTEND}/api/propiedades/cercanas?latitud=-9.9299&longitud=-76.2401&radioKm=5`,
    { headers: { Cookie: cookie } }
  );
  const d = await r.json();
  afirmar(r.status === 200, 'la búsqueda por cercanía funciona por el puente');
  const conDistancia = d.datos.find((p) => p.distancia_km !== undefined);
  afirmar(
    conDistancia !== undefined,
    '⛔ el radio devuelve resultados con distancia calculada',
    `resultados: ${d.datos?.length}`
  );
  afirmar(
    !conDistancia || typeof conDistancia.distancia_km === 'number',
    '⛔ la distancia llega como número, no como texto'
  );
}

// --- 10. Errores del backend se propagan con su código ---
{
  const r = await fetch(`${FRONTEND}/api/propiedades?precioMin=abc`, {
    headers: { Cookie: cookie },
  });
  afirmar(r.status === 400, 'los errores de validación conservan su código HTTP', `status ${r.status}`);
}

// --- 11. La sesión se renueva por el puente ---
//
// 📌 POR QUÉ ESTO SE PRUEBA AQUÍ Y NO SOLO EN LA SUITE DE LA API
//
// Porque el camino real pasa por el puente, y el puente era justo donde estaba
// el fallo silencioso: copiaba UNA cabecera `set-cookie`, y con dos cookies el
// navegador recibe media sesión. Aquí se recorre el ciclo entero como lo vive
// el navegador: se manda el token de renovación, llegan cookies nuevas, y el
// pase nuevo sirve para seguir pidiendo.
let cookieRenovada = '';
{
  const r = await fetch(`${FRONTEND}/api/auth/renovar`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const setCookie = r.headers.getSetCookie() ?? [];
  cookieRenovada = cookiesDe(r, cookie);

  afirmar(r.status === 200, 'la renovación responde por el puente', `status ${r.status}`);
  afirmar(
    setCookie.length === 2,
    '⛔ la respuesta de renovación trae las dos cookies nuevas',
    `llegaron ${setCookie.length}`
  );

  const paseViejo = /(?:^|; )innover_token=([^;]+)/.exec(cookie)?.[1];
  const paseNuevo = /(?:^|; )innover_token=([^;]+)/.exec(cookieRenovada)?.[1];
  afirmar(
    !!paseNuevo && paseNuevo !== paseViejo,
    '⛔ el pase corto es OTRO (se renovó, no se reenvió el mismo)',
    paseViejo ? `viejo: ${paseViejo.slice(0, 12)}…` : '(no se encontró el viejo)'
  );

  const perfil = await fetch(`${FRONTEND}/api/auth/perfil`, {
    headers: { Cookie: cookieRenovada },
  });
  afirmar(
    perfil.status === 200,
    '⛔ el pase nuevo autentica: la sesión sigue viva sin volver a entrar',
    `status ${perfil.status}`
  );

  // Un token inventado no renueva nada, y un fallo aquí no puede ser un 500:
  // es el caso más probable de todos (navegador con una cookie basura).
  const inventado = await fetch(`${FRONTEND}/api/auth/renovar`, {
    method: 'POST',
    headers: { Cookie: 'innover_renovacion=esto-no-lo-ha-emitido-nadie' },
  });
  afirmar(
    inventado.status === 401,
    '⛔ un token de renovación inventado devuelve 401 (no 500)',
    `status ${inventado.status}`
  );

  // Y sin cookie ninguna, tampoco. Esta es la petición que hace el navegador de
  // un visitante cualquiera si algún día se llama a renovar sin sesión.
  const sinNada = await fetch(`${FRONTEND}/api/auth/renovar`, { method: 'POST' });
  afirmar(
    sinNada.status === 401,
    '⛔ sin cookie de renovación, 401',
    `status ${sinNada.status}`
  );

  // El token bueno sigue funcionando después de los dos intentos fallidos: un
  // token basura no puede apagar la sesión de nadie.
  const sigueViva = await fetch(`${FRONTEND}/api/auth/perfil`, {
    headers: { Cookie: cookieRenovada },
  });
  afirmar(
    sigueViva.status === 200,
    '⛔ los intentos fallidos NO tumban la sesión que sí vale',
    `status ${sigueViva.status}`
  );
}

// --- 12. Logout limpia las cookies y apaga el token ---
//
// Va al final: después de esto ya no hay sesión, y cualquier prueba de
// búsqueda que viniera detrás fallaría por 401 sin que el motivo tenga
// relación con lo que comprueba.
{
  const r = await fetch(`${FRONTEND}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookieRenovada },
  });
  const setCookie = r.headers.getSetCookie() ?? [];
  afirmar(r.status === 200, 'logout por el puente');
  afirmar(
    setCookie.length === 2 &&
      setCookie.every((c) => c.includes('Max-Age=0') || c.includes('1970')),
    '⛔ el logout borra LAS DOS cookies del navegador',
    setCookie.map((c) => c.split(';')[0]).join(' | ')
  );

  /**
   * ⛔ Y ADEMÁS EL TOKEN QUEDA MUERTO EN EL SERVIDOR.
   *
   * Borrar la cookie solo le dice al navegador "deja de mandarla"; el token
   * seguiría sirviendo para cualquiera que lo tuviera guardado — el ordenador
   * compartido, el portátil que se prestó, la copia que hizo una extensión.
   * Esto comprueba que cerrar sesión significa algo de verdad.
   */
  const revive = await fetch(`${FRONTEND}/api/auth/renovar`, {
    method: 'POST',
    headers: { Cookie: cookieRenovada },
  });
  afirmar(
    revive.status === 401,
    '⛔ tras cerrar sesión, el token de renovación no revive la sesión',
    `status ${revive.status}`
  );

  // Y ahora sí: sin sesión, el buscador vuelve a cerrarse. Cierra el círculo
  // con la primera prueba del archivo.
  const buscador = await fetch(`${FRONTEND}/api/propiedades`);
  afirmar(
    buscador.status === 401,
    '⛔ tras cerrar sesión vuelve el 401 (el muro no se quedó abierto)',
    `status ${buscador.status}`
  );
}

// --- 13. Páginas del frontend responden ---
for (const ruta of ['/', '/login', '/registro', '/publicar']) {
  const r = await fetch(`${FRONTEND}${ruta}`);
  afirmar(r.status === 200, `la página ${ruta} responde 200`, `status ${r.status}`);
}

// --- 14. Cabeceras de seguridad en el frontend ---
{
  const r = await fetch(`${FRONTEND}/`);
  afirmar(r.headers.get('x-content-type-options') === 'nosniff', 'cabeceras de seguridad activas');
}

// --- 15. Descubrimiento para buscadores: sitemap y robots ---
//
// 📌 POR QUÉ ESTA PRUEBA MIRA EL TEXTO Y NO SOLO EL CÓDIGO
//
// Un sitemap puede responder 200 y estar vacío, o peor: apuntar a otro
// dominio. No hay ningún error que lo delate — solo un buscador que no indexa
// nada y un dueño que no entiende por qué—. Lo que importa es que haya FICHAS
// dentro y que las URLs sean ABSOLUTAS: el formato de sitemap no admite rutas
// relativas, porque quien lo lee no está navegando el sitio, está leyendo una
// lista.
//
// Y esto es la mitad que faltaba del SEO: la ficha lleva meses siendo pública
// e indexable, pero el buscador está detrás del muro, así que un rastreador no
// tenía por dónde llegar a ninguna.
{
  const r = await fetch(`${FRONTEND}/sitemap.xml`);
  const xml = await r.text();
  afirmar(r.status === 200, '/sitemap.xml responde 200', `status ${r.status}`);
  afirmar(xml.includes('<urlset'), 'el sitemap es XML de verdad', xml.slice(0, 100));

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  afirmar(
    locs.length > 1,
    '⛔ el sitemap trae más de una URL (portada + fichas)',
    `urls: ${locs.length}`
  );
  afirmar(
    locs.every((u) => u.startsWith('http')),
    '⛔ todas las URLs del sitemap son absolutas',
    locs.find((u) => !u.startsWith('http')) ?? ''
  );
  afirmar(
    locs.some((u) => u.includes('/propiedad/')),
    '⛔ hay fichas en el sitemap (es para lo que existe)',
    `urls: ${locs.length}`
  );

  const r2 = await fetch(`${FRONTEND}/robots.txt`);
  const txt = await r2.text();
  afirmar(r2.status === 200, '/robots.txt responde 200', `status ${r2.status}`);
  afirmar(txt.includes('Sitemap:'), 'robots.txt anuncia el sitemap', txt.slice(0, 160));
  afirmar(
    txt.includes('Disallow: /api/'),
    'robots.txt deja fuera el puente (/api duplica el contenido de las fichas)'
  );
}

console.log(`\n${'='.repeat(50)}`);
console.log(`  ${ok} pruebas pasaron, ${fallos} fallaron`);
console.log(`${'='.repeat(50)}\n`);

// La misma limpieza que la suite de API, y por el mismo motivo: la base es
// compartida y esta suite crea un usuario `puente-*` en cada corrida. El
// criterio de qué es basura vive en un solo script, que es el que se llama.
if (fallos === 0) {
  try {
    const salida = execFileSync(
      process.execPath,
      ['scripts/limpiar-usuarios-prueba.mjs', '--ejecutar'],
      { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' }
    );
    const resumen = salida
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('✓'))
      .pop();
    console.log(`  Limpieza automática: ${resumen ?? 'sin cambios'}\n`);
  } catch (error) {
    console.log(`  La limpieza automática falló: ${error.message}\n`);
  }
}

process.exit(fallos > 0 ? 1 : 0);
