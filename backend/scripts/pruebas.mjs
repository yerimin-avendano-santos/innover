// ========================================
// 🧪 PRUEBAS DE INTEGRACIÓN
// ========================================
// Ejecutar con el servidor ya levantado:
//     node server.js        (en otra terminal)
//     node scripts/pruebas.mjs
//
// Cada prueba comprueba algo que ANTES estaba roto. Si alguna falla,
// el error aparece en rojo con el motivo.
//
// 📌 CASI TODO PASA POR HTTP, CON DOS EXCEPCIONES
//
// El grueso de la suite habla con la API como lo haría el navegador, porque es
// la única forma de probar de verdad la autenticación, los permisos y el
// puente. Pero hay cosas que la API NO PUEDE revelar: que un índice exista y
// que Postgres lo use. Un `Seq Scan` y un `Index Scan` devuelven exactamente
// los mismos datos —uno más despacio— así que ninguna prueba de API puede
// distinguirlos. Esas dos van contra el catálogo de Postgres.

import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL || 'http://localhost:5000';

let pruebasPasadas = 0;
let pruebasFallidas = 0;
const fallos = [];

const verde = (t) => `\x1b[32m${t}\x1b[0m`;
const rojo = (t) => `\x1b[31m${t}\x1b[0m`;
const gris = (t) => `\x1b[90m${t}\x1b[0m`;

function afirmar(condicion, nombre, detalle = '') {
  if (condicion) {
    pruebasPasadas++;
    console.log(`  ${verde('✓')} ${nombre}`);
  } else {
    pruebasFallidas++;
    fallos.push(nombre);
    console.log(`  ${rojo('✗')} ${nombre}`);
    if (detalle) console.log(`      ${gris(detalle)}`);
  }
}

/** La sección en curso. Solo sirve para poder decir DÓNDE se cortó algo. */
let seccionActual = 'inicio';

function seccion(titulo) {
  seccionActual = titulo;
  console.log(`\n${titulo}`);
}

/**
 * Traduce el código del limitador a qué hacer al respecto.
 *
 * Existen TRES limitadores y se agotan por motivos distintos, así que un
 * "reinicia el backend" a secas dejaría al usuario sin entender por qué.
 */
function explicarLimite(codigo) {
  switch (codigo) {
    case 'RATE_LIMIT_AUTH':
      return [
        'Es el límite de intentos de login: 10 FALLOS cada 15 minutos por IP.',
        'La suite provoca 6 a propósito para probar la validación.',
      ];
    case 'RATE_LIMIT_ESCRITURA':
      return [
        'Es el límite de publicaciones: 20 CADA HORA, no cada 15 minutos.',
        'Esta suite gasta 11 por corrida, así que DOS corridas seguidas',
        'suman 22 y la segunda se corta a mitad. Es el límite que más',
        'suele sorprender, porque su ventana dura una hora entera.',
      ];
    case 'RATE_LIMIT':
      return ['Es el límite general: 300 peticiones cada 15 minutos.'];
    default:
      return ['El servidor respondió 429 (demasiadas peticiones).'];
  }
}

/**
 * Hace una petición y devuelve { estado, cuerpo, cookies }.
 * No usa fetch nativo porque queremos manejar las cookies a mano
 * para simular un navegador.
 */
async function pedir(metodo, ruta, { cuerpo, token, cookie } = {}) {
  const cabeceras = {};
  if (cuerpo) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (cookie) cabeceras.Cookie = cookie;

  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  let datos = null;
  try {
    datos = await res.json();
  } catch {
    datos = null;
  }

  // ========================================
  // Un 429 corta la suite, no una prueba
  // ========================================
  //
  // 📌 POR QUÉ SE ABORTA AQUÍ
  //
  // Cuando un limitador se agota, no falla una prueba: fallan TODAS las
  // que vengan detrás que dependan de esa petición, y cada una reporta un
  // fallo distinto y sin relación aparente con las demás. El resumen
  // acaba diciendo "18 pruebas fallaron" y parece que el proyecto se ha
  // roto entero, cuando lo único que pasa es que hay que reiniciar el
  // servidor.
  //
  // Eso ya ocurrió: dos corridas seguidas agotan el límite de escritura
  // (20 por hora, y la suite gasta 11 cada una) y la segunda pierde las
  // pruebas de la mitad final. Se perdieron veinte minutos buscando un
  // bug en el código de propiedades que no existía.
  //
  // Cortar en el PRIMER 429 convierte ese enredo en un mensaje que dice
  // qué pasó, dónde, y qué hacer. Un fallo ruidoso es infinitamente más
  // barato que dieciocho silenciosos.
  if (res.status === 429) {
    const codigo = datos?.codigo || '';
    console.log(rojo(`\n⛔ Un limitador de peticiones cortó la suite.\n`));
    console.log(`   Petición:  ${metodo} ${ruta}`);
    console.log(`   Sección:   ${seccionActual}`);
    console.log(`   Limitador: ${codigo || '(sin código)'}`);
    console.log(`   Superadas hasta aquí: ${pruebasPasadas} pruebas\n`);
    for (const linea of explicarLimite(codigo)) console.log(`   ${linea}`);
    console.log('');
    console.log('   NO es un bug del código: es la protección funcionando.');
    console.log('   Los contadores viven en memoria, así que reiniciar el');
    console.log('   backend los pone a cero:\n');
    console.log('       npm run dev:backend\n');
    console.log(gris('   (o sube el límite en backend/.env si vas a iterar mucho)'));
    console.log('');
    process.exit(2);
  }

  return {
    estado: res.status,
    cuerpo: datos,
    // Extraemos la cookie de sesión si el servidor la envió.
    cookie: res.headers.getSetCookie?.()?.[0] || null,
  };
}

// ========================================
// Datos únicos por ejecución
// ========================================
const sufijo = Date.now();
const emailCliente = `test-cliente-${sufijo}@innover.dev`;
const emailIntruso = `test-intruso-${sufijo}@innover.dev`;
const contrasena = 'ClaveSegura2026';

/**
 * ⚠️ POR QUÉ ESTAS PRUEBAS PUEDEN FALLAR AL REPETIRLAS
 *
 * El servidor tiene TRES limitadores, y la suite se topa con dos:
 *
 *   · Login:      10 FALLOS cada 15 min. La suite provoca 6 a propósito.
 *   · Escritura:  20 CADA HORA. La suite gasta 11 por corrida, así que la
 *                 SEGUNDA corrida seguida se queda sin presupuesto a mitad.
 *
 * El de escritura es el que más engaña: su ventana dura una hora, no
 * quince minutos, y no tiene nada que ver con el login que uno vigila.
 *
 * ⛔ NO es un bug: es la protección funcionando. Los contadores viven en
 * memoria, así que reiniciar el servidor los limpia:
 *
 *     npm run dev:backend
 *
 * Si necesitas correrlas sin parar, sube los límites en backend/.env:
 *
 *     RATE_LIMIT_AUTH=100
 *     RATE_LIMIT_ESCRITURA=200
 *
 * Un 429 ya no se reporta como un fallo suelto: corta la suite con un
 * mensaje que dice qué limitador fue (ver `pedir`).
 */
console.log(gris(`\nProbando contra ${BASE}\n`));

// ========================================
// Presupuesto de intentos de login
// ========================================

/**
 * Cuántos intentos fallidos de login/registro provoca la suite a propósito.
 *
 * ⚠️ ESTE NÚMERO ESTÁ CONTADO, NO ESTIMADO. Si añades una prueba que
 * provoque otro 400/401 en `/login` o `/registro`, SÚBELO. Si se queda
 * corto, el aviso de abajo dejará pasar una corrida que se va a quedar
 * sin presupuesto a mitad — que es justo el problema que este aviso
 * existe para evitar.
 *
 * Las que gastan son la validación de registro (email inválido,
 * contraseña corta, email duplicado dos veces) y las dos de login con
 * credenciales malas. Los demás logins de la suite usan credenciales
 * correctas y NO gastan, porque el limitador tiene
 * `skipSuccessfulRequests: true`.
 */
const INTENTOS_QUE_GASTA = 6;

// 📌 POR QUÉ ESTE AVISO EXISTE
//
// `limitadorAuth` permite 10 FALLOS en /registro y /login cada 15 minutos
// por IP. Sin el aviso, dos ejecuciones seguidas agotan el contador y a
// partir de ahí todo devuelve 429: la suite reportaba decenas de fallos
// sin relación entre sí y parecía que el proyecto se había roto entero.
//
// Un login CORRECTO no consume presupuesto (`skipSuccessfulRequests`), así
// que sirve para LEER cuánto queda en la cabecera `RateLimit-Remaining` y
// avisar antes de empezar, en vez de dejar que cada cual adivine qué pasó.
//
// ⚠️ ESTE AVISO SOLO CUBRE EL LÍMITE DE LOGIN.
//
// El de ESCRITURA (20 por hora) no se puede consultar gratis: su cabecera
// solo llega en una respuesta de escritura, y sondearlo gastaría una de las
// 20. Para ese está la red de seguridad de abajo: un 429 aborta la suite con
// un mensaje que dice cuál fue (ver `pedir`), en vez de dejar un reguero de
// fallos que parecen del código.
//
// Si la base no está sembrada, este login falla y gasta 1 intento. Es un
// coste aceptable: sin base sembrada la suite no puede pasar de todas formas.
{
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cliente@innover.dev', contrasena: 'Demo1234' }),
  });

  const cabecera = r.headers.get('ratelimit-remaining');
  const restantes = cabecera === null ? null : Number(cabecera);

  // 📌 La cabecera cuenta la petición EN CURSO, así que un backend recién
  // reiniciado informa de 9 y no de 10: la décima ranura es este mismo
  // login, que no llega a gastarla. No hay nada consumido ni está mal
  // contado — el aviso es conservador por uno, que es la dirección segura.

  if (restantes !== null && !Number.isNaN(restantes)) {
    if (restantes < INTENTOS_QUE_GASTA) {
      console.log(rojo('\n⛔ Quedan muy pocos intentos de login antes del bloqueo automático.\n'));
      console.log(`   Disponibles: ${restantes}. La suite necesita ${INTENTOS_QUE_GASTA} para`);
      console.log('   probar la validación de registro y de login.');
      console.log('');
      console.log('   NO es un bug del código: es el limitador de fuerza bruta haciendo');
      console.log('   su trabajo. Los contadores viven en memoria, así que reiniciar el');
      console.log('   backend los pone a cero:');
      console.log('');
      console.log('       npm run dev:backend');
      console.log('');
      console.log(gris('   (o sube RATE_LIMIT_AUTH en backend/.env si vas a iterar mucho)'));
      console.log('');
      process.exit(2);
    }

    console.log(gris(`Intentos de login disponibles antes del bloqueo: ${restantes}\n`));
  }
}

// ========================================
seccion('1. Healthcheck y raíz');
// ========================================
{
  const r = await pedir('GET', '/');
  afirmar(r.estado === 200, 'GET / responde 200', `recibido ${r.estado}`);
  afirmar(r.cuerpo?.estado === 'operativo', 'reporta estado operativo');

  const h = await pedir('GET', '/api/health');
  afirmar(h.estado === 200, 'GET /api/health responde 200');
  afirmar(h.cuerpo?.baseDatos === 'conectada', 'la base de datos está conectada');
}

// ========================================
seccion('2. Registro (validación y rol)');
// ========================================
let tokenCliente = null;
let cookieCliente = null;
{
  const r = await pedir('POST', '/api/auth/registro', {
    cuerpo: { nombre: 'Ana Cliente Prueba', email: emailCliente, contrasena },
  });
  afirmar(r.estado === 201, 'registro válido devuelve 201', `recibido ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  afirmar(r.cuerpo?.usuario?.rol === 'CLIENTE', 'el rol por defecto es CLIENTE');
  afirmar(r.cuerpo?.usuario?.contrasena_hash === undefined, 'NO devuelve el hash de la contraseña');
  tokenCliente = r.cuerpo?.token;
  cookieCliente = r.cuerpo?.cookie;
}

{
  // El ataque que existía antes: auto-asignarse ADMIN.
  const r = await pedir('POST', '/api/auth/registro', {
    cuerpo: { nombre: 'Intruso Malicioso', email: emailIntruso, contrasena, rol: 'ADMIN' },
  });
  afirmar(r.estado === 201, 'registro con rol=ADMIN en el body es aceptado como petición');
  afirmar(
    r.cuerpo?.usuario?.rol === 'CLIENTE',
    '⛔ el rol ADMIN en el body se IGNORA (queda CLIENTE)',
    `rol recibido: ${r.cuerpo?.usuario?.rol}`
  );
}

{
  // Email inválido
  const r = await pedir('POST', '/api/auth/registro', {
    cuerpo: { nombre: 'Test Inválido', email: 'esto-no-es-un-email', contrasena },
  });
  afirmar(r.estado === 400, 'email inválido devuelve 400', `recibido ${r.estado}`);
  afirmar(Array.isArray(r.cuerpo?.detalles), 'devuelve el detalle del campo que falló');
}

{
  // Contraseña corta
  const r = await pedir('POST', '/api/auth/registro', {
    cuerpo: { nombre: 'Test Corto', email: `corto-${sufijo}@innover.dev`, contrasena: '123' },
  });
  afirmar(r.estado === 400, 'contraseña de 3 caracteres devuelve 400');
}

{
  // Email duplicado
  const r = await pedir('POST', '/api/auth/registro', {
    cuerpo: { nombre: 'Duplicado', email: emailCliente, contrasena },
  });
  afirmar(r.estado === 409, 'email duplicado devuelve 409');
}

{
  // Normalización de email
  const r = await pedir('POST', '/api/auth/registro', {
    cuerpo: { nombre: 'Mayusculas Test', email: emailCliente.toUpperCase(), contrasena },
  });
  afirmar(r.estado === 409, 'el email se normaliza a minúsculas (no duplica cuentas)');
}

// ========================================
seccion('3. Login');
// ========================================
let cookieSesion = null;
{
  const r = await pedir('POST', '/api/auth/login', {
    cuerpo: { email: emailCliente, contrasena },
  });
  afirmar(r.estado === 200, 'login con credenciales correctas devuelve 200', `recibido ${r.estado}`);
  afirmar(!!r.cuerpo?.token, 'devuelve token');

  // La cookie httpOnly es la defensa contra XSS.
  const cabeceras = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailCliente, contrasena }),
  });
  const setCookie = cabeceras.headers.getSetCookie();
  cookieSesion = setCookie?.[0] || '';
  afirmar(
    cookieSesion.includes('HttpOnly'),
    '⛔ la cookie de sesión es HttpOnly (JS no puede leerla)',
    `cookie: ${cookieSesion.slice(0, 80)}`
  );
}

{
  const r = await pedir('POST', '/api/auth/login', {
    cuerpo: { email: emailCliente, contrasena: 'ClaveIncorrecta' },
  });
  afirmar(r.estado === 401, 'contraseña incorrecta devuelve 401');
}

{
  const r = await pedir('POST', '/api/auth/login', {
    cuerpo: { email: 'nadie-aqui@innover.dev', contrasena },
  });
  afirmar(r.estado === 401, 'email inexistente devuelve 401');
  afirmar(
    r.cuerpo?.error === 'Correo o contraseña incorrectos.',
    '⛔ el mismo mensaje para email inexistente y contraseña mala',
    `mensaje recibido: ${r.cuerpo?.error}`
  );
}

// ========================================
seccion('4. Escalada de privilegios (el fallo más grave)');
// ========================================
{
  // ANTES: estas rutas eran públicas y cualquiera se hacía ADMIN.
  const r = await pedir('PUT', '/api/usuarios/1', {
    cuerpo: { rol: 'ADMIN' },
    token: tokenCliente,
  });
  afirmar(
    r.estado === 403,
    '⛔ un CLIENTE no puede cambiar roles de usuarios',
    `recibido ${r.estado}`
  );
}

{
  const r = await pedir('GET', '/api/usuarios');
  afirmar(r.estado === 401, 'sin token, /api/usuarios devuelve 401', `recibido ${r.estado}`);
}

{
  const r = await pedir('GET', '/api/usuarios', { token: tokenCliente });
  afirmar(r.estado === 403, '⛔ un CLIENTE no puede listar usuarios', `recibido ${r.estado}`);
}

{
  const r = await pedir('DELETE', '/api/usuarios/1', { token: tokenCliente });
  afirmar(r.estado === 403, '⛔ un CLIENTE no puede desactivar usuarios', `recibido ${r.estado}`);
}

// ========================================
seccion('5. Perfil y sesión por cookie');
// ========================================
{
  const r = await pedir('GET', '/api/auth/perfil', { token: tokenCliente });
  afirmar(r.estado === 200, 'perfil accesible con token');
  afirmar(r.cuerpo?.email === emailCliente, 'el perfil trae los datos correctos');
  afirmar(r.cuerpo?.contrasena_hash === undefined, 'el perfil NO incluye el hash');
}

{
  // La cookie httpOnly debe servir para autenticarse, igual que el token.
  const r = await pedir('GET', '/api/auth/perfil', { cookie: cookieSesion });
  afirmar(r.estado === 200, '⛔ la cookie httpOnly autentica sin necesidad de token JS', `recibido ${r.estado}`);
}

{
  const r = await pedir('GET', '/api/auth/perfil');
  afirmar(r.estado === 401, 'sin token ni cookie devuelve 401');
}

{
  const r = await pedir('GET', '/api/auth/perfil', { token: 'token.inventado.aqui' });
  afirmar(r.estado === 401, 'token falso devuelve 401 (no 500)');
}

// ========================================
seccion('6. Propiedades: autorización por recurso');
// ========================================
let idPropiedadAjena = null;
let idPropiedadPropia = null;
{
  // Crear una propiedad con el cliente.
  const r = await pedir('POST', '/api/propiedades', {
    token: tokenCliente,
    cuerpo: {
      titulo: 'Departamento de prueba con título largo',
      descripcion: 'Esta es una descripción de prueba que supera los 30 caracteres exigidos.',
      precio: 150000,
      tipo: 'VENTA',
      tipo_inmueble: 'DEPARTAMENTO',
      area_m2: 85,
      habitaciones: 3,
      banos: 2,
      // Coordenadas del centro de Huánuco. Antes eran de Lima (-12.11, -77.03)
      // y el efecto era que la búsqueda geográfica de la sección 9 no
      // encontraba NUNCA esta propiedad: la prueba pasaba sin comprobar que
      // `distancia_km` fuera un número, porque el array venía vacío.
      latitud: -9.9299,
      longitud: -76.2401,
    },
  });
  afirmar(r.estado === 201, 'crear propiedad devuelve 201', `recibido ${r.estado}: ${JSON.stringify(r.cuerpo?.detalles || r.cuerpo?.error)}`);
  afirmar(typeof r.cuerpo?.propiedad?.precio === 'number', '⛔ el precio se devuelve como NÚMERO, no como texto', `tipo: ${typeof r.cuerpo?.propiedad?.precio}`);
  afirmar(!!r.cuerpo?.propiedad?.slug, 'genera un slug para la URL');
  idPropiedadPropia = r.cuerpo?.propiedad?.id;
}

{
  // Propiedad del intruso (segundo cliente).
  const r = await pedir('POST', '/api/propiedades', {
    token: (await pedir('POST', '/api/auth/login', { cuerpo: { email: emailIntruso, contrasena } })).cuerpo?.token,
    cuerpo: {
      titulo: 'Casa de prueba del segundo usuario',
      descripcion: 'Descripción de prueba con más de treinta caracteres para pasar la validación.',
      precio: 320000,
      tipo: 'ALQUILER',
    },
  });
  idPropiedadAjena = r.cuerpo?.propiedad?.id;
  afirmar(r.estado === 201, 'el segundo usuario crea su propia propiedad');
}

{
  // El ataque: editar la propiedad de OTRO.
  const r = await pedir('PUT', `/api/propiedades/${idPropiedadAjena}`, {
    token: tokenCliente,
    cuerpo: { precio: 1 },
  });
  afirmar(
    r.estado === 403,
    '⛔ no puedes editar la propiedad de otro usuario',
    `recibido ${r.estado}`
  );
}

{
  const r = await pedir('DELETE', `/api/propiedades/${idPropiedadAjena}`, { token: tokenCliente });
  afirmar(r.estado === 403, '⛔ no puedes borrar la propiedad de otro', `recibido ${r.estado}`);
}

{
  // El dueño sí puede editar la suya.
  const r = await pedir('PUT', `/api/propiedades/${idPropiedadPropia}`, {
    token: tokenCliente,
    cuerpo: { precio: 160000 },
  });
  afirmar(r.estado === 200, 'el dueño sí puede editar su propiedad', `recibido ${r.estado}`);
  afirmar(r.cuerpo?.propiedad?.precio === 160000, 'el precio se actualizó');
}

{
  // Actualizar sin mandar `tipo` no debe pisar el tipo existente.
  const r = await pedir('PUT', `/api/propiedades/${idPropiedadPropia}`, {
    token: tokenCliente,
    cuerpo: { banos: 3 },
  });
  afirmar(r.estado === 200, 'actualizar un solo campo responde 200', `recibido ${r.estado}`);
  afirmar(
    r.cuerpo?.propiedad?.tipo === 'VENTA',
    '⛔ actualizar sin `tipo` NO lo pisa con el default VENTA',
    `tipo ahora: ${r.cuerpo?.propiedad?.tipo}`
  );
  afirmar(r.cuerpo?.propiedad?.banos === 3, 'el campo enviado sí se actualizó');
}

{
  // Intento de tocar `usuario_id` (mass assignment).
  //
  // Zod descarta en silencio los campos que no están en el esquema, así que
  // la petición FUNCIONA (200) pero `usuario_id` se ignora. Eso es mejor que
  // un 400: el cliente no rompe, y el campo peligroso nunca se escribe.
  const antes = await pedir('GET', `/api/propiedades/${idPropiedadPropia}`);
  const propietarioAntes = antes.cuerpo?.propiedad?.propietario?.id;

  const r = await pedir('PUT', `/api/propiedades/${idPropiedadPropia}`, {
    token: tokenCliente,
    cuerpo: { usuario_id: 1, id: 4242, precio: 161000 },
  });
  afirmar(r.estado === 200, 'un campo desconocido no rompe la petición', `recibido ${r.estado}`);
  afirmar(
    r.cuerpo?.propiedad?.propietario?.id === propietarioAntes,
    '⛔ mandar usuario_id NO cambia el dueño de la propiedad',
    `dueño antes: ${propietarioAntes}, ahora: ${r.cuerpo?.propiedad?.propietario?.id}`
  );
  afirmar(r.cuerpo?.propiedad?.id === idPropiedadPropia, '⛔ mandar id NO cambia el identificador');
  afirmar(r.cuerpo?.propiedad?.precio === 161000, 'los campos legítimos sí se guardan');
}

{
  // Intento de auto-destacarse (campo de pago).
  //
  // ⛔ Esta prueba era VACUA y no se notaba: afirmaba
  // `r.cuerpo?.propiedad?.destacado !== true`, y desde que el candado del plan
  // devuelve un 403 la respuesta no trae `propiedad`, así que `undefined !== true`
  // se cumplía por accidente. Habría pasado igual si el endpoint devolviera
  // cualquier cosa que no fuera una propiedad destacada. Ahora se comprueba el
  // código de estado, que es lo que de verdad importa.
  const r = await pedir('PUT', `/api/propiedades/${idPropiedadPropia}`, {
    token: tokenCliente,
    cuerpo: { destacado: true },
  });
  afirmar(
    r.estado === 403,
    '⛔ un usuario sin plan no puede marcarse destacado',
    `recibido ${r.estado}`
  );
  afirmar(
    /PRO/.test(r.cuerpo?.error || ''),
    'el 403 explica que el destaque es del plan PRO',
    `error: ${r.cuerpo?.error}`
  );
}

// ========================================
seccion('7. Validación de entrada');
// ========================================
{
  const r = await pedir('POST', '/api/propiedades', {
    token: tokenCliente,
    cuerpo: { titulo: 'Corto', descripcion: 'Corta', precio: 'mucho', tipo: 'BANANA' },
  });
  afirmar(r.estado === 400, 'datos inválidos devuelven 400');
  afirmar(Array.isArray(r.cuerpo?.detalles), 'la respuesta lista los campos que fallaron');
}

{
  const r = await pedir('GET', '/api/propiedades/precioMin=abc');
  afirmar(r.estado === 400, 'filtro no numérico devuelve 400 (antes NaN rompía Prisma)');
}

{
  const r = await pedir('GET', '/api/propiedades?precioMin=500&precioMax=100', {
    token: tokenCliente,
  });
  afirmar(r.estado === 400, 'precioMin > precioMax devuelve 400');

  // 📌 El ORDEN de los middlewares también es contrato.
  //
  // `verificarToken` va ANTES de `validar`, así que una petición sin sesión
  // se rechaza por sesión aunque además traiga los filtros mal: 401, no 400.
  // Si algún día se invirtiera el orden, esta prueba lo diría. Sin ella,
  // nadie se enteraría de que cambió.
  const sinSesion = await pedir('GET', '/api/propiedades?precioMin=500&precioMax=100');
  afirmar(
    sinSesion.estado === 401,
    'sin sesión manda el 401: se comprueba la sesión antes que los filtros',
    `recibido ${sinSesion.estado}`
  );
}

{
  // La ruta `/:id` acepta DOS formatos a propósito:
  //   /api/propiedades/12                      → por id numérico
  //   /api/propiedades/depa-vista-al-mar       → por slug legible
  const porSlug = await pedir('GET', '/api/propiedades/departamento-de-prueba-con-titulo-largo');
  afirmar(porSlug.estado === 200, '⛔ la ruta acepta slugs, no solo ids', `recibido ${porSlug.estado}`);
  afirmar(porSlug.cuerpo?.propiedad?.slug !== undefined, 'el slug devuelve la propiedad correcta');

  const porId = await pedir('GET', `/api/propiedades/${idPropiedadPropia}`);
  afirmar(porId.estado === 200, 'la ruta sigue aceptando ids numéricos', `recibido ${porId.estado}`);

  // Pero un identificador con caracteres inválidos sí se rechaza.
  const basura = await pedir('GET', '/api/propiedades/abc$def');
  afirmar(basura.estado === 400, 'un identificador con caracteres inválidos devuelve 400', `recibido ${basura.estado}`);
}

{
  const r = await pedir('GET', '/api/ruta/que/no/existe');
  afirmar(r.estado === 404, 'ruta inexistente devuelve 404');
}

// ========================================
seccion('8. Búsqueda y filtros');
// ========================================
//
// 📌 EL BUSCADOR EXIGE SESIÓN, Y LA FICHA NO
//
// Son dos rutas distintas y la diferencia es deliberada: la ficha es el
// enlace que se comparte por WhatsApp y lo que indexa Google, así que tiene
// que abrirse sin cuenta (ver `propiedadRoutes.js`).
//
// El candado se comprueba PRIMERO. Si se cayera, el resto de esta sección
// seguiría pasando tan contenta —los filtros funcionan igual con token que
// sin él— y nadie se enteraría de que el mercado quedó abierto.
{
  const sinToken = await pedir('GET', '/api/propiedades');
  afirmar(
    sinToken.estado === 401,
    '⛔ el buscador NO se puede usar sin sesión',
    `recibido ${sinToken.estado}: ${JSON.stringify(sinToken.cuerpo)}`
  );

  const cercanas = await pedir(
    'GET',
    '/api/propiedades/cercanas?latitud=-9.9299&longitud=-76.2401'
  );
  afirmar(
    cercanas.estado === 401,
    '⛔ /cercanas tampoco: devuelve lo mismo, así que dejar una abierta abriría la otra',
    `recibido ${cercanas.estado}`
  );

  // Y la contraparte, que es lo que impide "arreglar" esto de más.
  const ficha = await pedir('GET', `/api/propiedades/${idPropiedadPropia}`);
  afirmar(
    ficha.estado === 200,
    '⛔ la FICHA sigue abierta sin sesión (es el enlace que se comparte)',
    `recibido ${ficha.estado}`
  );
}

// --- Un token caducado NO cierra la ficha pública ---
//
// 📌 ESTA PRUEBA PROTEGE LA PALABRA "OPCIONAL".
//
// La ruta usa `usuarioOpcional`, que identifica a quien pueda y deja pasar al
// resto. Si alguien la "asegurara" poniendo `verificarToken` —que es lo que
// parece natural al ver `user` en el controlador— el enlace compartido se
// rompería para cualquiera con la sesión caducada: le saldría un 401 en vez de
// su propiedad. Y ese es un fallo que no se ve probando con el navegador
// limpio, porque el navegador limpio no manda cookie.
{
  const r = await pedir('GET', `/api/propiedades/${idPropiedadPropia}`, {
    token: 'esto.no.es.un.token',
  });
  afirmar(
    r.estado === 200,
    '⛔ con un token inválido la FICHA sigue abriéndose (no 401)',
    `recibido ${r.estado}: si es 401, alguien cambió usuarioOpcional por verificarToken`
  );
}

// --- El dueño ve su propio BORRADOR, y nadie más ---
//
// 📌 ESTO CUBRE UN AGUJERO QUE ESTUVO ABIERTO SIN QUE NADIE LO VIERA.
//
// `obtenerPropiedadPorId` decide la visibilidad de un BORRADOR con
// `esVisiblePara(req.usuario, ...)`, y la ruta no tenía NINGÚN middleware que
// rellenara `req.usuario`: era siempre `undefined`, así que el 403 caía
// también sobre el dueño. El dueño no podía abrir su propio anuncio sin
// publicar, y su propia visita le subía el contador — el controlador compara
// con `req.usuario?.id !== propiedad.usuario_id`, o sea que esperaba que a
// veces viniera.
//
// Lo arregla `usuarioOpcional`. Y ojo con el 403 de abajo: NO es un descuido
// que un borrador ajeno no diga "no existe". La página sí contesta 404 hacia
// fuera (para no convertirse en un oráculo de lo que está sin publicar), y esa
// traducción se hace allí, no aquí.
{
  const creada = await pedir('POST', '/api/propiedades', {
    token: tokenCliente,
    cuerpo: {
      titulo: 'Borrador de prueba (visibilidad del dueño)',
      descripcion: 'Borrador que existe solo para comprobar quién puede verlo y quién no.',
      precio: 120000,
      tipo: 'VENTA',
      tipo_inmueble: 'DEPARTAMENTO',
      area_m2: 90,
      habitaciones: 3,
      banos: 2,
      latitud: -9.9299,
      longitud: -76.2401,
      estado: 'BORRADOR',
    },
  });
  afirmar(creada.estado === 201, 'se crea un BORRADOR para la prueba', `recibido ${creada.estado}`);
  const idBorrador = creada.cuerpo?.propiedad?.id;
  const vistasIniciales = creada.cuerpo?.propiedad?.vistas;

  const anonimo = await pedir('GET', `/api/propiedades/${idBorrador}`);
  afirmar(
    anonimo.estado === 403,
    '⛔ sin sesión, un BORRADOR NO se ve',
    `recibido ${anonimo.estado}`
  );

  const dueno = await pedir('GET', `/api/propiedades/${idBorrador}`, { token: tokenCliente });
  afirmar(
    dueno.estado === 200,
    '⛔ el DUEÑO sí ve su propio BORRADOR',
    `recibido ${dueno.estado}: si es 403, falta usuarioOpcional en la ruta`
  );

  // Verlo no se cuenta como visita: el contador sirve para saber si alguien
  // está mirando la casa, y el dueño mirando la suya no es un interesado.
  afirmar(
    dueno.cuerpo?.propiedad?.vistas === vistasIniciales,
    '⛔ la visita del dueño NO le sube el contador',
    `esperado ${vistasIniciales}, recibido ${dueno.cuerpo?.propiedad?.vistas}`
  );

  // --- El sitemap: la otra lectura pública, y la más delicada ---
  //
  // Es la lista que se le entrega a Google, así que un borrador filtrándose
  // aquí no sería "un enlace de más": sería publicar lo que su dueño todavía
  // no ha decidido enseñar, y además dejarlo apuntado.
  {
    const sitemap = await pedir('GET', '/api/propiedades/sitemap');
    afirmar(
      sitemap.estado === 200,
      'el sitemap se puede pedir sin sesión (un rastreador no tiene cuenta)',
      `recibido ${sitemap.estado}`
    );

    const campos = Object.keys(sitemap.cuerpo?.datos?.[0] ?? {});
    afirmar(
      campos.length === 2 && campos.includes('slug') && campos.includes('fecha_actualizacion'),
      '⛔ el sitemap devuelve SOLO slug y fecha',
      `campos: [${campos.join(', ')}] — detrás de una puerta abierta, cuanto menos haya, mejor`
    );

    afirmar(
      !sitemap.cuerpo?.datos?.some((p) => p.slug === creada.cuerpo?.propiedad?.slug),
      '⛔ un BORRADOR NO aparece en el sitemap',
      `buscaba ${creada.cuerpo?.propiedad?.slug}`
    );
  }

  // Se borra porque la suite no limpia lo que crea, y esta prueba la correrá
  // gente muchas veces.
  const borrada = await pedir('DELETE', `/api/propiedades/${idBorrador}`, {
    token: tokenCliente,
  });
  afirmar(borrada.estado === 200, 'y el borrador de la prueba se limpia solo');
}

{
  const r = await pedir('GET', '/api/propiedades', { token: tokenCliente });
  afirmar(r.estado === 200, 'con sesión, el buscador responde 200');
  afirmar(Array.isArray(r.cuerpo?.datos), 'devuelve el array en `datos`');
  afirmar(!!r.cuerpo?.paginacion, 'incluye metadatos de paginación');
  afirmar(!!r.cuerpo?.rangoPrecios, 'incluye el rango de precios para los filtros');
  afirmar(
    !r.cuerpo?.datos?.some((p) => p.estado === 'BORRADOR'),
    '⛔ los BORRADOR no aparecen en el buscador aunque tengas sesión'
  );
}

{
  const r = await pedir('GET', '/api/propiedades?tipo=ALQUILER', { token: tokenCliente });
  afirmar(
    r.cuerpo?.datos?.every((p) => p.tipo === 'ALQUILER'),
    'el filtro por tipo funciona'
  );
}

{
  const r = await pedir('GET', '/api/propiedades?precioMin=100000&precioMax=200000', {
    token: tokenCliente,
  });
  afirmar(
    r.cuerpo?.datos?.every((p) => p.precio >= 100000 && p.precio <= 200000),
    'el filtro por rango de precio funciona'
  );
}

// ========================================
seccion('9. Búsqueda geográfica con PostGIS');
// ========================================
{
  const r = await pedir(
    'GET',
    '/api/propiedades/cercanas?latitud=-9.9299&longitud=-76.2401&radioKm=5',
    { token: tokenCliente }
  );
  afirmar(r.estado === 200, 'la búsqueda por cercanía responde 200');
  afirmar(Array.isArray(r.cuerpo?.datos), 'devuelve el array en `datos`');

  const conDistancia = r.cuerpo?.datos?.find((p) => p.distancia_km !== undefined);
  afirmar(
    conDistancia !== undefined,
    '⛔ la propiedad de prueba aparece en el radio (si no, no se prueba nada)',
    `resultados: ${r.cuerpo?.datos?.length}`
  );
  afirmar(
    conDistancia === undefined || typeof conDistancia.distancia_km === 'number',
    '⛔ calcula la distancia real en km con PostGIS'
  );
}

{
  const r = await pedir('GET', '/api/propiedades?tipo=VENTA&latitud=-9.9299&longitud=-76.2401&radioKm=3', {
    token: tokenCliente,
  });
  afirmar(r.estado === 200, 'el filtro por radio dentro del buscador principal funciona');
}

// ========================================
seccion('10. CORS y cabeceras de seguridad');
// ========================================
{
  const permitido = await fetch(`${BASE}/api/propiedades`, {
    headers: { Origin: 'http://localhost:3000' },
  });
  afirmar(
    permitido.headers.get('access-control-allow-origin') === 'http://localhost:3000',
    'CORS permite el origen configurado'
  );

  const prohibido = await fetch(`${BASE}/api/propiedades`, {
    headers: { Origin: 'https://sitio-malicioso.example' },
  });
  afirmar(
    prohibido.headers.get('access-control-allow-origin') === null,
    '⛔ CORS rechaza un origen no permitido'
  );

  const conHeaders = await fetch(`${BASE}/`);
  afirmar(
    conHeaders.headers.get('x-content-type-options') === 'nosniff',
    'helpet activa X-Content-Type-Options'
  );
  afirmar(
    conHeaders.headers.get('x-frame-options') !== null,
    'helmet activa protección contra clickjacking'
  );
}

// ========================================
seccion('11. CRM de contactos (leads)');
// ========================================
{
  // El intruso intenta escribirle al dueño.
  const tokenIntruso = (await pedir('POST', '/api/auth/login', {
    cuerpo: { email: emailIntruso, contrasena },
  })).cuerpo?.token;

  const r = await pedir('POST', '/api/contactos', {
    token: tokenIntruso,
    cuerpo: {
      propiedad_id: idPropiedadPropia,
      mensaje: 'Me interesa mucho esta propiedad, ¿puedo visitarla?',
      telefono: '987654321',
    },
  });
  afirmar(r.estado === 201, 'crear lead devuelve 201', `recibido ${r.estado}: ${JSON.stringify(r.cuerpo?.error)}`);
}

{
  // El dueño NO puede escribirse a sí mismo.
  const r = await pedir('POST', '/api/contactos', {
    token: tokenCliente,
    cuerpo: {
      propiedad_id: idPropiedadPropia,
      mensaje: 'Quiero contactarme a mí mismo para probar el sistema',
    },
  });
  afirmar(r.estado === 400, '⛔ no puedes crear un lead sobre tu propia propiedad');
}

{
  const r = await pedir('POST', '/api/contactos', {
    cuerpo: { propiedad_id: 1, mensaje: 'Mensaje sin sesión iniciada' },
  });
  afirmar(r.estado === 401, 'crear lead exige sesión');
}

{
  // El dueño ve sus leads, con los datos de contacto del cliente.
  const r = await pedir('GET', '/api/contactos/mis-leads', { token: tokenCliente });
  afirmar(r.estado === 200, 'el dueño ve su bandeja de leads');
  afirmar(r.cuerpo?.datos?.length > 0, 'el lead creado aparece en la bandeja');

  const lead = r.cuerpo?.datos?.[0];
  afirmar(!!lead?.contacto?.telefono, '⛔ el lead congela el teléfono del cliente');
}

{
  // El cliente NO puede ver los leads del dueño.
  const tokenIntruso = (await pedir('POST', '/api/auth/login', {
    cuerpo: { email: emailIntruso, contrasena },
  })).cuerpo?.token;

  const r = await pedir('GET', '/api/contactos/mis-leads', { token: tokenIntruso });
  afirmar(r.estado === 200, 'el cliente también puede consultar su bandeja');
  afirmar(
    !r.cuerpo?.datos?.some((l) => l.propiedad?.id === idPropiedadPropia),
    '⛔ no ves los leads que le pertenecen a otro agente/propietario'
  );
}

{
  const r = await pedir('GET', '/api/contactos/estadisticas', { token: tokenCliente });
  afirmar(r.estado === 200, 'las métricas del CRM responden');
  afirmar(typeof r.cuerpo?.total === 'number', 'devuelve el total de leads');
}

// ========================================
seccion('12. Mis propiedades y distritos');
// ========================================
{
  const r = await pedir('GET', '/api/propiedades/mias', { token: tokenCliente });
  afirmar(r.estado === 200, '"/mias" responde 200');
  afirmar(
    r.cuerpo?.datos?.every((p) => p.propietario?.id === r.cuerpo.datos[0]?.propietario?.id),
    'solo devuelve tus propias propiedades'
  );
}

{
  const r = await pedir('GET', '/api/distritos');
  afirmar(r.estado === 200, 'la lista de distritos responde 200');
  afirmar(Array.isArray(r.cuerpo?.datos), 'devuelve el array en `datos`');
}

{
  const r = await pedir('POST', '/api/distritos', {
    token: tokenCliente,
    cuerpo: { nombre: 'Distrito Inventado' },
  });
  afirmar(r.estado === 403, '⛔ un CLIENTE no puede crear distritos');
}

// ========================================
seccion('13. Solicitudes de agente (la cola que antes no existía)');
// ========================================
//
// ANTES DE ESTE BLOQUE:
//
//   `POST /api/auth/solicitar-agente` guardaba el documento en el usuario y
//   respondía `estado: 'PENDIENTE'` — un literal escrito a mano en el JSON.
//   No existía ninguna fila: sin cola que revisar, sin forma de rechazar con
//   un motivo, y el `mensaje` del solicitante acababa en la basura.
//
// Estas pruebas comprueban que la solicitud es ahora un dato de verdad.

let tokenAdmin = null;
let idSolicitud = null;
let idUsuarioPrueba = null;
{
  const r = await pedir('POST', '/api/auth/login', {
    cuerpo: { email: 'admin@innover.dev', contrasena: 'Demo1234' },
  });
  afirmar(r.estado === 200, 'login del admin demo funciona', `recibido ${r.estado}`);
  tokenAdmin = r.cuerpo?.token;
}

{
  const perfil = await pedir('GET', '/api/auth/perfil', { token: tokenCliente });
  idUsuarioPrueba = perfil.cuerpo?.id;
  afirmar(typeof idUsuarioPrueba === 'number', 'se obtuvo el id del usuario de prueba');
}

{
  const r = await pedir('GET', '/api/auth/mi-solicitud', { token: tokenCliente });
  afirmar(r.estado === 200, 'el estado de mi solicitud responde 200');
  afirmar(
    r.cuerpo?.solicitud === null,
    'sin haber solicitado nada devuelve null, no un 404',
    `recibido: ${JSON.stringify(r.cuerpo)}`
  );
}

{
  const r = await pedir('POST', '/api/auth/solicitar-agente', {
    token: tokenCliente,
    cuerpo: { documento: '12345678', mensaje: 'Tengo cartera de clientes en Huánuco y Amarilis.' },
  });
  afirmar(r.estado === 201, 'solicitar ser agente devuelve 201', `recibido ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  afirmar(
    typeof r.cuerpo?.solicitud?.id === 'number',
    '⛔ la solicitud es una FILA con id, no un literal en la respuesta'
  );
  afirmar(r.cuerpo?.solicitud?.estado === 'PENDIENTE', 'la solicitud nace PENDIENTE');
  idSolicitud = r.cuerpo?.solicitud?.id;
}

{
  const r = await pedir('GET', '/api/auth/mi-solicitud', { token: tokenCliente });
  afirmar(
    r.cuerpo?.solicitud?.mensaje === 'Tengo cartera de clientes en Huánuco y Amarilis.',
    '⛔ el mensaje del solicitante SE GUARDA (antes se tiraba a la basura)',
    `mensaje: ${r.cuerpo?.solicitud?.mensaje}`
  );
}

{
  const r = await pedir('POST', '/api/auth/solicitar-agente', {
    token: tokenCliente,
    cuerpo: { documento: '12345678' },
  });
  afirmar(
    r.estado === 409,
    '⛔ no se puede encolar dos veces la misma solicitud',
    `recibido ${r.estado}`
  );
}

{
  const login = await pedir('POST', '/api/auth/login', {
    cuerpo: { email: 'agente@innover.dev', contrasena: 'Demo1234' },
  });
  const r = await pedir('POST', '/api/auth/solicitar-agente', {
    token: login.cuerpo?.token,
    cuerpo: { documento: '12345678' },
  });
  afirmar(r.estado === 409, 'un AGENTE no puede solicitar ser agente', `recibido ${r.estado}`);
}

{
  const r = await pedir('POST', '/api/auth/solicitar-agente', { cuerpo: { documento: '12345678' } });
  afirmar(r.estado === 401, 'sin token no se puede solicitar ser agente');
}

{
  const r = await pedir('GET', '/api/solicitudes');
  afirmar(r.estado === 401, 'la cola de solicitudes exige token', `recibido ${r.estado}`);

  const s = await pedir('GET', '/api/solicitudes', { token: tokenCliente });
  afirmar(s.estado === 403, '⛔ un CLIENTE no puede ver la cola de solicitudes', `recibido ${s.estado}`);
}

{
  const r = await pedir('GET', '/api/solicitudes', { token: tokenAdmin });
  afirmar(r.estado === 200, 'el ADMIN sí ve la cola', `recibido ${r.estado}`);

  const mia = r.cuerpo?.datos?.find((s) => s.id === idSolicitud);
  afirmar(!!mia, 'la solicitud recién creada aparece en la cola');
  afirmar(mia?.usuario?.email === emailCliente, 'la cola trae los datos del solicitante');
  afirmar(
    mia?.usuario && !('contrasena_hash' in mia.usuario),
    '⛔ la cola NO filtra el hash de la contraseña',
    `claves: ${Object.keys(mia?.usuario || {}).join(', ')}`
  );
}

{
  // Rechazar sin motivo es lo que deja al usuario sin saber qué corregir.
  const r = await pedir('PATCH', `/api/solicitudes/${idSolicitud}`, {
    token: tokenAdmin,
    cuerpo: { estado: 'RECHAZADA' },
  });
  afirmar(r.estado === 400, '⛔ rechazar sin motivo devuelve 400', `recibido ${r.estado}`);
}

{
  // Y ahora el rechazo de verdad, con motivo: es la mitad del trámite que la
  // interfaz enseña en el perfil. Si `mi-solicitud` no devolviera el motivo, la
  // pantalla diría "rechazada" y nada más — el caso exacto que deja a alguien
  // sin saber qué corregir, así que vuelve a mandar lo mismo.
  const r = await pedir('PATCH', `/api/solicitudes/${idSolicitud}`, {
    token: tokenAdmin,
    cuerpo: {
      estado: 'RECHAZADA',
      motivo_rechazo: 'El documento no se lee. Vuelve a subirlo.',
    },
  });
  afirmar(r.estado === 200, 'el ADMIN rechaza con motivo', `recibido ${r.estado}`);
}

{
  const r = await pedir('GET', '/api/auth/mi-solicitud', { token: tokenCliente });
  afirmar(
    r.cuerpo?.solicitud?.estado === 'RECHAZADA',
    'el solicitante ve que lo rechazaron'
  );
  afirmar(
    r.cuerpo?.solicitud?.motivo_rechazo === 'El documento no se lee. Vuelve a subirlo.',
    '⛔ y ve POR QUÉ: sin el motivo, reintentar es adivinar',
    `motivo: ${r.cuerpo?.solicitud?.motivo_rechazo}`
  );
  afirmar(
    typeof r.cuerpo?.solicitud?.revisor?.id === 'number',
    '⛔ y ve quién lo revisó: una decisión sobre una persona no es anónima'
  );
}

{
  // Y puede volver a intentarlo —es lo que ofrece el botón del perfil—, con una
  // fila NUEVA: la rechazada se queda como historial y no se reescribe.
  const r = await pedir('POST', '/api/auth/solicitar-agente', {
    token: tokenCliente,
    cuerpo: { documento: '12345678', mensaje: 'El documento nuevo ya se lee bien.' },
  });
  afirmar(
    r.estado === 201,
    '⛔ un rechazado puede volver a intentarlo',
    `recibido ${r.estado}: ${JSON.stringify(r.cuerpo)}`
  );
  afirmar(
    typeof r.cuerpo?.solicitud?.id === 'number' && r.cuerpo.solicitud.id !== idSolicitud,
    '⛔ el reintento es una solicitud nueva, no la vieja resucitada'
  );
  idSolicitud = r.cuerpo?.solicitud?.id;
}

{
  const r = await pedir('PATCH', `/api/solicitudes/${idSolicitud}`, {
    token: tokenCliente,
    cuerpo: { estado: 'APROBADA' },
  });
  afirmar(r.estado === 403, '⛔ nadie aprueba su propia solicitud', `recibido ${r.estado}`);
}

{
  const r = await pedir('PATCH', `/api/solicitudes/${idSolicitud}`, {
    token: tokenAdmin,
    cuerpo: { estado: 'APROBADA' },
  });
  afirmar(r.estado === 200, 'el ADMIN aprueba la solicitud', `recibido ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  afirmar(r.cuerpo?.solicitud?.estado === 'APROBADA', 'la solicitud queda APROBADA');
  afirmar(
    typeof r.cuerpo?.solicitud?.revisor?.id === 'number',
    '⛔ queda registrado QUÉ admin la resolvió (auditoría)'
  );
  afirmar(
    typeof r.cuerpo?.solicitud?.fecha_resolucion === 'string',
    'la fecha de resolución se guarda'
  );
}

{
  const perfil = await pedir('GET', '/api/auth/perfil', { token: tokenCliente });
  afirmar(
    perfil.cuerpo?.rol === 'AGENTE',
    '⛔ aprobar la solicitud convierte al usuario en AGENTE de verdad',
    `rol: ${perfil.cuerpo?.rol}`
  );
}

{
  const r = await pedir('PATCH', `/api/solicitudes/${idSolicitud}`, {
    token: tokenAdmin,
    cuerpo: { estado: 'RECHAZADA', motivo_rechazo: 'Ahora ya no.' },
  });
  afirmar(
    r.estado === 409,
    '⛔ una solicitud resuelta no se puede resolver otra vez',
    `recibido ${r.estado}`
  );
}

// ========================================
seccion('14. Plan PRO: el candado del recorrido 3D');
// ========================================
//
// El candado tiene que estar en el SERVIDOR. Esconder el campo en el formulario
// no protege nada: cualquiera manda el JSON a mano y lo salta. Estas pruebas
// hablan directamente con la API, que es justo lo que haría quien intentara
// saltárselo.

const TOUR = 'https://my.matterport.com/show/?m=SxQL3iGyoDo';
// Una URL distinta para probar el caso del PRO vencido. No hace falta que
// exista: la petición se rechaza ANTES de que nadie la visite.
const TOUR_DISTINTO = 'https://my.matterport.com/show/?m=OtroRecorridoDistinto';

const cuerpoPropiedad = (extra = {}) => ({
  titulo: 'Propiedad creada por la suite de pruebas',
  descripcion: 'Descripción de prueba con más de treinta caracteres para pasar la validación.',
  precio: 250000,
  tipo: 'VENTA',
  tipo_inmueble: 'DEPARTAMENTO',
  ...extra,
});

{
  // Ojo: el usuario acaba de ser ascendido a AGENTE en la sección anterior.
  // Ser agente NO da PRO. Son dos ejes distintos, y esta es la prueba.
  const r = await pedir('POST', '/api/propiedades', {
    token: tokenCliente,
    cuerpo: cuerpoPropiedad({ tour_3d_url: TOUR }),
  });
  afirmar(
    r.estado === 403,
    '⛔ ser AGENTE no basta: sin plan PRO, el recorrido 3D da 403',
    `recibido ${r.estado}: ${JSON.stringify(r.cuerpo)}`
  );
  afirmar(
    /PRO/.test(r.cuerpo?.error || ''),
    'el error explica que hace falta el plan PRO',
    `error: ${r.cuerpo?.error}`
  );
}

{
  const r = await pedir('POST', '/api/propiedades', {
    token: tokenCliente,
    cuerpo: cuerpoPropiedad({ destacado: true }),
  });
  afirmar(r.estado === 403, '⛔ el destaque tampoco se regala sin PRO', `recibido ${r.estado}`);
}

{
  // El plan NO se acepta de quien lo pide. Igual que el rol.
  const r = await pedir('PATCH', `/api/usuarios/${idUsuarioPrueba}/plan`, {
    token: tokenCliente,
    cuerpo: { plan: 'PRO' },
  });
  afirmar(r.estado === 403, '⛔ un usuario no puede darse el plan PRO a sí mismo', `recibido ${r.estado}`);
}

{
  // Y tampoco se cuela por el PUT genérico de administración: Zod tiene lista
  // blanca, así que `plan` se descarta en silencio.
  const r = await pedir('PUT', `/api/usuarios/${idUsuarioPrueba}`, {
    token: tokenAdmin,
    cuerpo: { nombre: 'Ana Cliente Prueba', plan: 'PRO' },
  });
  afirmar(r.estado === 200, 'el PUT de admin actualiza lo que sí está permitido');

  const despues = await pedir('GET', `/api/usuarios/${idUsuarioPrueba}`, { token: tokenAdmin });
  afirmar(
    despues.cuerpo?.plan === 'GRATIS' || despues.cuerpo?.usuario?.plan === 'GRATIS',
    '⛔ el plan NO se puede colar por PUT /api/usuarios/:id (lista blanca de Zod)',
    `plan: ${despues.cuerpo?.plan ?? despues.cuerpo?.usuario?.plan}`
  );
}

{
  const r = await pedir('PATCH', `/api/usuarios/${idUsuarioPrueba}/plan`, {
    token: tokenAdmin,
    cuerpo: { plan: 'PRO', plan_vence: new Date(Date.now() + 90 * 864e5).toISOString() },
  });
  afirmar(r.estado === 200, 'el ADMIN concede el plan PRO', `recibido ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
}

{
  /**
   * ⛔ ESTA PRUEBA EXISTE POR UN BUG QUE SE ESCAPÓ.
   *
   * `obtenerMiPerfil` tenía su propio `select` de Prisma, distinto del de
   * `verificarToken`, y no pedía `plan` ni `plan_vence`. El resultado era
   * silencioso y de los peores: `usuarioPublico()` recibía `undefined`,
   * `plan_pro_activo` salía SIEMPRE `false`, y la interfaz habría escondido el
   * recorrido 3D a quien lo había pagado — sin ningún error visible.
   *
   * El candado del servidor funcionaba (por eso las pruebas de arriba pasaban),
   * pero el dato con el que el frontend DECIDE no llegaba. Ninguna prueba de
   * escritura podía detectarlo: hacía falta leer el perfil y mirarlo.
   */
  const perfil = await pedir('GET', '/api/auth/perfil', { token: tokenCliente });
  afirmar(perfil.cuerpo?.plan === 'PRO', 'el perfil expone el plan', `plan: ${perfil.cuerpo?.plan}`);
  afirmar(
    typeof perfil.cuerpo?.plan_vence === 'string',
    '⛔ y la fecha de vencimiento (sin ella no se puede saber si vale)',
    `plan_vence: ${perfil.cuerpo?.plan_vence}`
  );
  afirmar(
    perfil.cuerpo?.plan_pro_activo === true,
    '⛔ el perfil expone el veredicto YA CALCULADO, para que el frontend no repita la comparación sin mirar la fecha',
    `plan_pro_activo: ${perfil.cuerpo?.plan_pro_activo}`
  );
}

let idPropiedadPro = null;
{
  const r = await pedir('POST', '/api/propiedades', {
    token: tokenCliente,
    cuerpo: cuerpoPropiedad({ tour_3d_url: TOUR }),
  });
  afirmar(
    r.estado === 201,
    'con PRO vigente el recorrido 3D sí se guarda',
    `recibido ${r.estado}: ${JSON.stringify(r.cuerpo?.detalles || r.cuerpo?.error)}`
  );
  afirmar(r.cuerpo?.propiedad?.tour_3d_url === TOUR, 'la URL del 3D quedó guardada tal cual');
  idPropiedadPro = r.cuerpo?.propiedad?.id;
}

{
  const r = await pedir('POST', '/api/propiedades', {
    token: tokenCliente,
    cuerpo: cuerpoPropiedad({ titulo: 'Propiedad destacada por la suite', destacado: true }),
  });
  afirmar(r.estado === 201, 'con PRO el destaque sí se acepta', `recibido ${r.estado}`);
  afirmar(r.cuerpo?.propiedad?.destacado === true, 'la propiedad nace destacada');
}

{
  // Tope de destacados. Ya hay 1, así que el 6º debe ser rechazado.
  // El número está atado a MAX_DESTACADOS_POR_USUARIO en
  // src/controllers/propiedadController.js; si alguien lo cambia, esta prueba
  // lo dice en vez de dejar el tope sin cubrir.
  let creadas = 0;
  let rechazo = null;
  for (let i = 0; i < 8; i++) {
    const r = await pedir('POST', '/api/propiedades', {
      token: tokenCliente,
      cuerpo: cuerpoPropiedad({
        titulo: `Propiedad destacada de prueba número ${i + 1}`,
        destacado: true,
      }),
    });
    if (r.estado === 201) creadas++;
    else {
      rechazo = r;
      break;
    }
  }
  afirmar(
    rechazo?.estado === 403,
    '⛔ hay un tope de propiedades destacadas por usuario',
    `recibido ${rechazo?.estado}`
  );
  afirmar(
    creadas === 4,
    'el tope son 5 destacados en total (había 1, dejó crear 4)',
    `creadas antes del rechazo: ${creadas}`
  );
  afirmar(
    /destacad/i.test(rechazo?.cuerpo?.error || ''),
    'el error del tope lo explica',
    `error: ${rechazo?.cuerpo?.error}`
  );
}

{
  // PRO VENCIDO: manda la fecha al pasado.
  const r = await pedir('PATCH', `/api/usuarios/${idUsuarioPrueba}/plan`, {
    token: tokenAdmin,
    cuerpo: { plan: 'PRO', plan_vence: new Date(Date.now() - 864e5).toISOString() },
  });
  afirmar(r.estado === 200, 'se puede registrar un PRO ya vencido', `recibido ${r.estado}`);

  // La prueba clave del vencimiento: el plan SIGUE diciendo PRO, pero ya no vale.
  const perfil = await pedir('GET', '/api/auth/perfil', { token: tokenCliente });
  afirmar(perfil.cuerpo?.plan === 'PRO', 'el campo `plan` sigue diciendo PRO');
  afirmar(
    perfil.cuerpo?.plan_pro_activo === false,
    '⛔ pero plan_pro_activo es false: la fecha es la que manda',
    `plan_pro_activo: ${perfil.cuerpo?.plan_pro_activo}`
  );
}

{
  /**
   * ⛔ EL CASO QUE HACE QUE EL CANDADO SIRVA Y NO SEA UNA TRAMPA.
   *
   * El formulario de edición reenvía todos los campos, incluido el 3D que ya
   * estaba. Si la regla fuera "no tienes PRO → 403", este usuario no podría ni
   * cambiar el precio de su propia casa: quedaría encerrado con sus datos.
   *
   * Por eso la comprobación es sobre el CAMBIO, no sobre el campo.
   */
  const r = await pedir('PUT', `/api/propiedades/${idPropiedadPro}`, {
    token: tokenCliente,
    cuerpo: { precio: 255000, tour_3d_url: TOUR },
  });
  afirmar(
    r.estado === 200,
    '⛔ con el PRO vencido SÍ puede editar su propiedad reenviando el mismo 3D',
    `recibido ${r.estado}: ${JSON.stringify(r.cuerpo?.error)}`
  );
  afirmar(r.cuerpo?.propiedad?.precio === 255000, 'el precio se actualizó');
  afirmar(
    r.cuerpo?.propiedad?.tour_3d_url === TOUR,
    'y el recorrido 3D que ya tenía se conserva',
    `tour: ${r.cuerpo?.propiedad?.tour_3d_url}`
  );
}

{
  // Pero poner uno NUEVO sí exige el plan vigente.
  const r = await pedir('PUT', `/api/propiedades/${idPropiedadPro}`, {
    token: tokenCliente,
    cuerpo: { tour_3d_url: TOUR_DISTINTO },
  });
  afirmar(r.estado === 403, '⛔ con el PRO vencido no puede poner un 3D NUEVO', `recibido ${r.estado}`);
  afirmar(
    /venci/i.test(r.cuerpo?.error || ''),
    'el mensaje distingue "venció" de "no lo tienes"',
    `error: ${r.cuerpo?.error}`
  );
}

{
  // Y borrarlo siempre se puede: es su propio contenido.
  const r = await pedir('PUT', `/api/propiedades/${idPropiedadPro}`, {
    token: tokenCliente,
    cuerpo: { tour_3d_url: '' },
  });
  afirmar(r.estado === 200, 'quitar el recorrido 3D siempre está permitido', `recibido ${r.estado}`);
  afirmar(
    r.cuerpo?.propiedad?.tour_3d_url === null,
    '⛔ mandar cadena vacía BORRA el 3D (antes era imposible: se confundía con "no lo toques")',
    `tour: ${JSON.stringify(r.cuerpo?.propiedad?.tour_3d_url)}`
  );
}

{
  const r = await pedir('PATCH', `/api/usuarios/${idUsuarioPrueba}/plan`, {
    token: tokenAdmin,
    cuerpo: { plan: 'GRATIS' },
  });
  afirmar(r.estado === 200, 'el ADMIN baja al usuario a GRATIS', `recibido ${r.estado}`);
  afirmar(
    r.cuerpo?.destacados_retirados === 5,
    '⛔ al bajar de plan se retiran sus destaques (si no, el plan vencido conservaría las ventajas)',
    `retirados: ${r.cuerpo?.destacados_retirados}`
  );

  const despues = await pedir('GET', `/api/usuarios/${idUsuarioPrueba}`, { token: tokenAdmin });
  afirmar(
    (despues.cuerpo?.plan ?? despues.cuerpo?.usuario?.plan) === 'GRATIS',
    'el plan quedó en GRATIS'
  );
  afirmar(
    (despues.cuerpo?.plan_vence ?? despues.cuerpo?.usuario?.plan_vence) === null,
    'al volver a GRATIS se limpia la fecha de vencimiento'
  );
}

{
  const r = await pedir('GET', `/api/propiedades/${idPropiedadPro}`);
  afirmar(r.estado === 200, 'la ficha de la propiedad sigue accesible');
  afirmar(
    r.cuerpo?.propiedad?.destacado === false || r.cuerpo?.destacado === false,
    'la propiedad ya no está destacada',
    `destacado: ${r.cuerpo?.propiedad?.destacado ?? r.cuerpo?.destacado}`
  );
}

// ========================================
seccion('15. El índice espacial sigue existiendo');
// ========================================
//
// 📌 POR QUÉ ESTA PRUEBA ES DE BASE DE DATOS Y NO DE API
//
// Prisma propone SIEMPRE `DROP INDEX "Propiedad_locacion_gist_idx"` en cada
// migración que se genere, porque `locacion` está declarada como `Unsupported`
// y el índice lo creó a mano la migración de PostGIS. Al no estar en el
// modelo, Prisma cree que sobra.
//
// Aplicarlo sería un desastre SILENCIOSO: `/api/propiedades/cercanas` seguiría
// devolviendo los resultados correctos, solo que recorriendo la tabla entera.
// Ninguna prueba de API puede distinguir un `Index Scan` de un `Seq Scan`: las
// dos devuelven lo mismo, una más despacio. La única forma de que esto no pase
// inadvertido es mirar el catálogo de Postgres.
{
  const prisma = new PrismaClient();
  try {
    const [indice] = await prisma.$queryRawUnsafe(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'Propiedad' AND indexdef ILIKE '%USING gist%'
    `);
    afirmar(
      !!indice,
      '⛔ el índice GIST de PostGIS existe (una migración generada por Prisma propondrá borrarlo)',
      'sin él, /cercanas recorre la tabla entera sin fallar ni avisar'
    );

    // Y que Postgres lo use de verdad, no solo que exista.
    const plan = await prisma.$queryRawUnsafe(`
      EXPLAIN
      SELECT id FROM "Propiedad"
      WHERE ST_DWithin(locacion, ST_SetSRID(ST_MakePoint(-76.2395, -9.9293), 4326)::geography, 2000)
    `);
    const texto = plan.map((l) => Object.values(l)[0]).join(' ');
    afirmar(
      /Index Scan|Bitmap Index Scan/i.test(texto),
      '⛔ Postgres USA el índice para la búsqueda por radio (no un Seq Scan)',
      texto.slice(0, 160)
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ========================================
seccion('16. Logout');
// ========================================
{
  const r = await pedir('POST', '/api/auth/logout');
  afirmar(r.estado === 200, 'logout responde 200');
  afirmar(
    r.cookie?.includes('Max-Age=0') || r.cookie?.includes('Expires=Thu, 01 Jan 1970'),
    '⛔ el logout borra la cookie del navegador',
    `cookie: ${r.cookie}`
  );
}

// ========================================
// Resumen
// ========================================
console.log(`\n${'='.repeat(50)}`);
console.log(`  ${pruebasPasadas} pruebas pasaron, ${pruebasFallidas} fallaron`);
if (fallos.length) {
  console.log(`\n  ${rojo('Fallaron:')}`);
  fallos.forEach((f) => console.log(`    · ${f}`));
}
console.log(`${'='.repeat(50)}\n`);

// ========================================
// Limpieza — solo si todo pasó
// ========================================
//
// 📌 POR QUÉ LA SUITE SE LIMPIA A SÍ MISMA, Y SOLO CUANDO SALE BIEN
//
// La base es REMOTA y COMPARTIDA, y esta suite crea usuarios y propiedades en
// cada corrida. Sin limpieza cada corrida deja ~8 propiedades publicadas
// colgando de usuarios que ya no existen. Eso siempre fue basura, pero desde
// que existe `/sitemap.xml` es algo peor: esas propiedades entran en el
// sitemap, o sea que la base de desarrollo le estaría enseñando a Google
// decenas de anuncios de prueba. Se contaron 76.
//
// ⚠️ El criterio de qué es basura NO se reescribe aquí: se llama al limpiador
// que ya existe. Es importante que sea uno solo — si mañana las pruebas crean
// usuarios con otro prefijo, hay un único sitio donde añadirlo, y esta llamada
// lo hereda sola.
//
// ⚠️ Y solo se limpia si NO hubo fallos, a propósito. Cuando algo falla, los
// datos son la evidencia: un usuario con el rol mal puesto, una propiedad con
// el estado raro. Borrar la escena para dejar la base bonita cambiaría un
// problema de espacio por uno de depuración, que es bastante peor.
if (pruebasFallidas === 0) {
  try {
    const salida = execFileSync(
      process.execPath, // el mismo Node que está corriendo esto
      ['scripts/limpiar-usuarios-prueba.mjs', '--ejecutar'],
      { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' }
    );

    // El limpiador escribe un resumen largo; interesa la última línea, que es
    // la que dice cuántos borró (o que no había nada).
    const resumen = salida
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('✓'))
      .pop();

    console.log(`  ${gris('Limpieza automática (base compartida):')}`);
    console.log(`  ${gris(resumen ?? 'sin cambios')}\n`);
  } catch (error) {
    // Que la limpieza falle no puede cambiar el resultado de las pruebas: si
    // pasaron, pasaron. Se avisa y se sigue.
    console.log(`  ${rojo('La limpieza automática falló:')} ${error.message}\n`);
  }
} else {
  console.log(`  ${gris('Con fallos, no se limpia nada: los datos son la evidencia.')}\n`);
}

process.exit(pruebasFallidas > 0 ? 1 : 0);
