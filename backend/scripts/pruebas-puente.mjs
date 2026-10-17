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
  const setCookie = r.headers.getSetCookie();
  cookie = setCookie?.[0] || '';

  afirmar(r.status === 201, 'registro por el puente', `status ${r.status}`);
  afirmar(
    cookie.includes('innover_token') && cookie.includes('HttpOnly'),
    '⛔ la cookie httpOnly llega al navegador a través del puente',
    cookie.slice(0, 100)
  );
}

// --- 4. La cookie autentica las peticiones siguientes ---
{
  const r = await fetch(`${FRONTEND}/api/auth/perfil`, {
    headers: { Cookie: cookie.split(';')[0] },
  });
  const d = await r.json();
  afirmar(r.status === 200, 'la cookie del puente autentica el perfil', `status ${r.status}: ${JSON.stringify(d).slice(0, 120)}`);
  afirmar(d.email === email, 'el perfil corresponde al usuario correcto');
}

// --- 5. Autorización propagada ---
{
  const r = await fetch(`${FRONTEND}/api/usuarios`, {
    headers: { Cookie: cookie.split(';')[0] },
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
    headers: { Cookie: cookie.split(';')[0] },
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
// Se envía SIN cookie a propósito: es lo que ve quien recibe el enlace.
{
  afirmar(slugCompartible !== null, 'se obtuvo un slug del buscador para compartir');

  const r = await fetch(`${FRONTEND}/api/propiedades/${slugCompartible}`);
  const d = await r.json();
  afirmar(
    r.status === 200,
    '⛔ la FICHA abre sin sesión: es el enlace que se comparte y lo que indexa Google',
    `status ${r.status}: ${JSON.stringify(d).slice(0, 120)}`
  );
  afirmar(d.propiedad?.slug === slugCompartible, 'la ficha devuelve la propiedad pedida');
}

// --- 8. Filtrado por el puente ---
{
  const r = await fetch(`${FRONTEND}/api/propiedades?tipo=ALQUILER`, {
    headers: { Cookie: cookie.split(';')[0] },
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
    { headers: { Cookie: cookie.split(';')[0] } }
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
    headers: { Cookie: cookie.split(';')[0] },
  });
  afirmar(r.status === 400, 'los errores de validación conservan su código HTTP', `status ${r.status}`);
}

// --- 11. Logout limpia la cookie ---
//
// Va al final: después de esto ya no hay sesión, y cualquier prueba de
// búsqueda que viniera detrás fallaría por 401 sin que el motivo tenga
// relación con lo que comprueba.
{
  const r = await fetch(`${FRONTEND}/api/auth/logout`, { method: 'POST' });
  const setCookie = r.headers.getSetCookie()?.[0] || '';
  afirmar(r.status === 200, 'logout por el puente');
  afirmar(
    setCookie.includes('Max-Age=0') || setCookie.includes('1970'),
    '⛔ el logout reenvía la cookie de expiración',
    setCookie.slice(0, 100)
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

// --- 12. Páginas del frontend responden ---
for (const ruta of ['/', '/login', '/registro', '/publicar']) {
  const r = await fetch(`${FRONTEND}${ruta}`);
  afirmar(r.status === 200, `la página ${ruta} responde 200`, `status ${r.status}`);
}

// --- 13. Cabeceras de seguridad en el frontend ---
{
  const r = await fetch(`${FRONTEND}/`);
  afirmar(r.headers.get('x-content-type-options') === 'nosniff', 'cabeceras de seguridad activas');
}

console.log(`\n${'='.repeat(50)}`);
console.log(`  ${ok} pruebas pasaron, ${fallos} fallaron`);
console.log(`${'='.repeat(50)}\n`);

process.exit(fallos > 0 ? 1 : 0);
