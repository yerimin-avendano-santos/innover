// ========================================
// 🔑 CONTROLADOR DE AUTENTICACIÓN
// ========================================
// Aquí vive la lógica de registro, login y perfil.
//
// 🔑 Conceptos clave que aprendes aquí:
//
// 1. BCRYPT: cuando un usuario se registra con "hola123", bcrypt lo
//    convierte en "$2b$12$xK8f..." (un hash irreversible).
//    Ni siquiera nosotros podemos ver la contraseña real.
//
// 2. JWT: tras un login correcto damos un "pase VIP" (token) que debe
//    mostrarse en cada petición futura. Como la pulsera de un festival:
//    sin ella, no entras.
//
// ⛔ Corrección de seguridad importante (ver notas en las funciones):
//    - El rol ya NO se toma del cuerpo de la petición.
//    - El token se manda en cookie httpOnly, no en localStorage.
//    - Hay límite de intentos para frenar ataques de fuerza bruta.
//
// 📌 Y una pieza más, que se añadió después: la sesión se apoya en DOS cookies.
// La corta (`innover_token`, 2 h) es el pase que abre cada puerta; la larga
// (`innover_renovacion`, 30 días) solo sirve para pedir otro pase cuando el
// primero vence, y es la única de las dos que se puede revocar. El porqué
// completo está en `utils/renovacion.js`, que es donde vive esa lógica.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import prisma from '../config/db.js';
import {
  ErrorConflicto,
  ErrorNoAutorizado,
  ErrorProhibido,
  ErrorValidacion,
} from '../utils/errores.js';
import { normalizarEmail } from '../utils/utilidades.js';
import { tienePlanPro } from '../utils/plan.js';
import { COOKIE_SESION, COOKIE_RENOVACION } from '../utils/cookies.js';
import {
  abrirTokenRenovacion,
  revocarTokenRenovacion,
  revocarTodosLosTokens,
  rotarTokenRenovacion,
} from '../utils/renovacion.js';

/**
 * Lo que comparten las dos cookies.
 *
 * ⛔ POR QUÉ COOKIE httpOnly Y NO localStorage
 *
 * localStorage es JavaScript, así que CUALQUIER script que corra en tu
 * página puede leer el token:
 *
 *     localStorage.getItem('innover_token')
 *
 * Si mañana alguien mete un XSS (o una dependencia maliciosa), se lleva
 * la sesión de todos los usuarios. Con una cookie httpOnly:
 *
 *     document.cookie  // → no devuelve nada, el navegador la protege
 *
 * La cookie sí viaja sola en cada petición, así que el frontend no
 * tiene que hacer nada especial.
 */
const baseCookie = {
  httpOnly: true,                      // JavaScript no puede leerla
  secure: config.esProduccion,         // solo HTTPS en producción
  sameSite: 'lax',                     // no se envía en peticiones de otros sitios
};

/**
 * La cookie del pase corto.
 *
 * ⚠️ SIN `maxAge`, y es deliberado: es una cookie DE SESIÓN, muere al cerrar el
 * navegador. Antes duraba 7 días y era una promesa que el servidor no podía
 * cumplir — el JWT de dentro vence a las 2 horas, así que durante los seis días
 * y medio siguientes el navegador guardaba un pase que ya no abría nada, y el
 * usuario solo veía "tu sesión expiró". Una credencial no debería sobrevivir al
 * dato que lleva dentro. Quien mantiene la sesión es la cookie de renovación.
 */
const opcionesCookieSesion = {
  ...baseCookie,
  path: '/',
};

/**
 * La cookie del token que se puede revocar.
 *
 * 📌 POR QUÉ SE ACOTA EL `path` SI `httpOnly` YA PROTEGE
 *
 * Son dos defensas contra dos amenazas distintas. `httpOnly` protege de un
 * script que lea `document.cookie`; el `path` decide a QUÉ peticiones se envía
 * la cookie, y eso protege del servidor que la recibe. Este token no hace falta
 * para buscar una casa, ni para ver una ficha, ni para subir una foto: solo
 * para renovar la sesión y para cerrarla. Cuantas menos peticiones lo lleven,
 * menos sitios donde pueda quedar registrado sin necesidad.
 */
const opcionesCookieRenovacion = {
  ...baseCookie,
  path: '/api/auth',
  maxAge: config.jwt.renovacionDias * 24 * 60 * 60 * 1000,
};

/**
 * Abre una sesión: firma el pase corto, guarda el largo y manda los dos.
 *
 * Está en una función porque se llama desde tres sitios (registro, login y
 * renovación) y tiene que hacer exactamente lo mismo en los tres. Cuando estos
 * tres caminos se escriben por separado, el día que uno cambia —y cambiará el
 * día que haya que endurecer las cookies— los otros dos se quedan como estaban
 * y nadie se entera, porque todo sigue funcionando.
 */
async function abrirSesion(res, usuario) {
  const token = jwt.sign({ sub: usuario.id }, config.jwt.secreto, {
    expiresIn: config.jwt.expiraEn,
  });

  const renovacion = await abrirTokenRenovacion(usuario.id);

  res.cookie(COOKIE_SESION, token, opcionesCookieSesion);
  res.cookie(COOKIE_RENOVACION, renovacion, opcionesCookieRenovacion);

  return token;
}

/**
 * Arma el objeto de usuario que se devuelve al frontend.
 *
 * ⛔ NUNCA incluir contrasena_hash aquí. Esta función es la única puerta
 * de salida de datos de usuario, y por diseño no tiene forma de incluirlo.
 */
function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    telefono: usuario.telefono ?? null,
    avatar_url: usuario.avatar_url ?? null,
    identidad_verificada: usuario.identidad_verificada,
    activo: usuario.activo,
    fecha_creacion: usuario.fecha_creacion,
    ultimo_acceso: usuario.ultimo_acceso ?? null,

    // --- Plan comercial ---
    // Se exponen los dos campos crudos para que la interfaz pueda MOSTRARLOS
    // ("Plan PRO · vence el 12 de enero").
    plan: usuario.plan,
    plan_vence: usuario.plan_vence ?? null,

    /**
     * Y aparte, el veredicto ya calculado.
     *
     * 📌 POR QUÉ SE MANDA UN BOOLEANO SI YA VAN LOS DATOS
     *
     * Porque si no, el frontend escribiría `usuario.plan === 'PRO'` y
     * repetiría exactamente el bug que `tienePlanPro()` existe para evitar: esa
     * comparación dice que un PRO VENCIDO sigue vigente, porque no mira la
     * fecha. El resultado no sería un error visible — la interfaz mostraría el
     * formulario del recorrido 3D, el usuario lo rellenaría, guardaría, y el
     * servidor lo rechazaría con un 403 que no encaja con lo que acaba de ver.
     *
     * La lógica de vencimiento vive en UN sitio (`backend/src/utils/plan.js`) y
     * el frontend consume su resultado. La regla para quien toque la interfaz
     * es: para DECIDIR, usa `plan_pro_activo`; `plan` y `plan_vence` son solo
     * para pintar texto.
     */
    plan_pro_activo: tienePlanPro(usuario),
  };
}

// ========================================
// REGISTRO (Sign Up)
// ========================================
export const registrarUsuario = async (req, res) => {
  const { nombre, email, contrasena, telefono } = req.body;

  const emailNormalizado = normalizarEmail(email);

  // 1. ¿Ya existe la cuenta?
  const existente = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
    select: { id: true },
  });

  if (existente) {
    throw new ErrorConflicto('Este correo ya está registrado. Prueba con iniciar sesión.');
  }

  // 2. Encriptar la contraseña.
  //    El número 12 es el "costo": cuántas veces se mezcla.
  //    Más alto = más lento de romper y más lento de generar.
  //    12 es el balance razonable en 2025.
  const hash = await bcrypt.hash(contrasena, config.bcrypt.rondas);

  /**
   * 3. Guardar el usuario.
   *
   * ⛔ NOTA DE SEGURIDAD: `rol` NO viene del cuerpo de la petición.
   * Se fuerza a CLIENTE. Antes, el body traía `rol: "ADMIN"` y el
   * backend lo obedecía: cualquiera podía registrarse como administrador
   * con una sola petición.
   */
  const usuario = await prisma.usuario.create({
    data: {
      nombre: nombre.trim(),
      email: emailNormalizado,
      contrasena_hash: hash,
      telefono: telefono || null,
      rol: 'CLIENTE',   // 👈 siempre CLIENTE en registro público
    },
  });

  // 4. Abrir sesión (pase corto + token de renovación).
  //    Al registrarse, la sesión queda abierta: obligar a entrar otra vez
  //    justo después de rellenar el formulario sería pedir los mismos datos
  //    dos veces.
  const token = await abrirSesion(res, usuario);

  res.status(201).json({
    mensaje: 'Cuenta creada. Ya puedes buscar propiedades.',
    usuario: usuarioPublico(usuario),
    // Se devuelve también en el cuerpo para clientes móviles / Postman.
    // El frontend web usa la cookie httpOnly.
    token,
  });
};

// ========================================
// LOGIN (Sign In)
// ========================================
export const loginUsuario = async (req, res) => {
  const { email, contrasena } = req.body;
  const emailNormalizado = normalizarEmail(email);

  const usuario = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
  });

  /**
   * 1. Mismo mensaje para email inexistente y contraseña incorrecta.
   *
   * Si diéramos "ese email no existe", un atacante podría listar todos los
   * correos registrados probando uno por uno. Con un mensaje genérico no
   * puede distinguir un caso del otro.
   */
  const credencialesIncorrectas = new ErrorNoAutorizado(
    'Correo o contraseña incorrectos.'
  );

  if (!usuario) {
    // Aunque el usuario no exista, hashear igual.
    // Si no, el tiempo de respuesta revelaría qué correos existen:
    // "no existe" responde en 2ms, "existe pero falló" en 200ms.
    await bcrypt.compare(contrasena, '$2b$12$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdu');
    throw credencialesIncorrectas;
  }

  // 2. Comparar la contraseña.
  const contrasenaCorrecta = await bcrypt.compare(contrasena, usuario.contrasena_hash);

  if (!contrasenaCorrecta) {
    throw credencialesIncorrectas;
  }

  // 3. Cuenta desactivada: el password es correcto pero no puede entrar.
  if (!usuario.activo) {
    throw new ErrorProhibido(
      'Tu cuenta está desactivada. Escríbenos para reactivarla.'
    );
  }

  // 4. Registrar el acceso.
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimo_acceso: new Date() },
  });

  // 5. Abrir sesión: el pase corto en una cookie, y el token que la renueva
  //    —el que sí se puede revocar— en la otra.
  const token = await abrirSesion(res, usuario);

  res.json({
    mensaje: `Hola de nuevo, ${usuario.nombre.split(' ')[0]}.`,
    usuario: usuarioPublico(usuario),
    token,
  });
};

// ========================================
// RENOVAR LA SESIÓN
// ========================================
/**
 * Cambia el token de renovación por un pase nuevo.
 *
 * 📌 ESTA ES LA RUTA QUE HACE QUE LA SESIÓN NO SE CAIGA
 *
 * El pase corto vence a las 2 horas. Antes eso era un cierre de sesión: el
 * usuario volvía al login aunque estuviera navegando, y en una web que se abre
 * una vez al día eso pasa SIEMPRE. Ahora, cuando una petición vuelve con 401,
 * el cliente llama aquí y reintenta: el usuario no ve nada.
 *
 * ⛔ NO lleva `verificarToken`, y es justo su razón de existir: si el pase
 * corto fuera válido, no habría nada que renovar. Lo que protege esta ruta es
 * el token de la cookie de renovación, que es un secreto de 256 bits que solo
 * tiene el navegador de su dueño. Tampoco lleva `limitadorAuth`: ese mide
 * intentos de ADIVINAR una contraseña, y aquí no hay contraseña que adivinar
 * —probar tokens al azar es como buscar una aguja en un pajar del tamaño del
 * universo—. El límite general de peticiones se aplica igual.
 */
export const renovarSesion = async (req, res) => {
  const tokenCrudo = req.cookies?.[COOKIE_RENOVACION];

  if (!tokenCrudo) {
    throw new ErrorNoAutorizado('No hay ninguna sesión que renovar. Inicia sesión.');
  }

  const resultado = await rotarTokenRenovacion(tokenCrudo);

  if (resultado.motivo) {
    /**
     * ⛔ TODOS LOS MOTIVOS RESPONDEN LO MISMO (menos uno), y es a propósito.
     *
     * "No existe", "venció" y "lo apagaste tú" son información que a quien
     * pregunta con un token robado no se le da: le sirve para saber si el token
     * es de verdad y qué le falta. El que tiene el token bueno no necesita la
     * distinción: en los tres casos el arreglo es el mismo, volver a entrar.
     *
     * La excepción es `reutilizado`, y es para el DUEÑO, no para el otro: si de
     * verdad se copió el token, a esta persona le acabamos de cerrar todas sus
     * sesiones y merece saber por qué y qué hacer. Al que copió el token no le
     * cuenta nada que no sepa ya — su petición acaba de ser rechazada.
     */
    if (resultado.motivo === 'inactivo') {
      throw new ErrorProhibido('Tu cuenta está desactivada. Contacta al soporte.');
    }

    if (resultado.motivo === 'reutilizado') {
      throw new ErrorNoAutorizado(
        'Por seguridad cerramos todas tus sesiones. Vuelve a iniciar sesión.'
      );
    }

    throw new ErrorNoAutorizado('Tu sesión ya no es válida. Vuelve a iniciar sesión.');
  }

  // Rotación correcta: el token usado queda marcado y el navegador se lleva uno
  // nuevo, además de un pase fresco. Se devuelve el usuario porque sus datos
  // pueden haber cambiado desde la última vez (rol, plan) y este es justo el
  // momento en que el cliente los va a mirar.
  const token = await abrirSesion(res, resultado.usuario);

  res.json({
    mensaje: 'Sesión renovada.',
    usuario: usuarioPublico(resultado.usuario),
    token,
  });
};

// ========================================
// LOGOUT
// ========================================
export const cerrarSesion = async (req, res) => {
  /**
   * ⛔ APAGAR EL TOKEN EN LA BASE, NO SOLO BORRAR LA COOKIE.
   *
   * Borrar la cookie solo le dice al navegador "deja de mandarla". El token
   * sigue siendo válido para cualquiera que lo tenga: el ordenador compartido
   * donde alguien no borró bien su sesión, el portátil que se prestó, la copia
   * que hizo una extensión. Cerrar sesión tiene que significar que ese token no
   * vale más, y eso se decide en el servidor.
   */
  await revocarTokenRenovacion(req.cookies?.[COOKIE_RENOVACION]);

  // `clearCookie` necesita las MISMAS opciones con las que se creó la cookie
  // —camino incluido—, si no el navegador busca en otro sitio y no la encuentra.
  res.clearCookie(COOKIE_SESION, {
    httpOnly: opcionesCookieSesion.httpOnly,
    secure: opcionesCookieSesion.secure,
    sameSite: opcionesCookieSesion.sameSite,
    path: opcionesCookieSesion.path,
  });

  res.clearCookie(COOKIE_RENOVACION, {
    httpOnly: opcionesCookieRenovacion.httpOnly,
    secure: opcionesCookieRenovacion.secure,
    sameSite: opcionesCookieRenovacion.sameSite,
    path: opcionesCookieRenovacion.path,
  });

  res.json({ mensaje: 'Sesión cerrada.' });
};

// ========================================
// MI PERFIL
// ========================================
export const obtenerMiPerfil = async (req, res) => {
  // req.usuario lo pone verificarToken. Como el middleware ya validó que el
  // usuario existe y está activo, aquí solo necesitamos sus datos frescos.
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      telefono: true,
      avatar_url: true,
      identidad_verificada: true,
      activo: true,
      fecha_creacion: true,
      ultimo_acceso: true,
      // ⛔ Sin estas dos líneas, `usuarioPublico()` recibiría `undefined` y
      // `plan_pro_activo` saldría SIEMPRE `false`, incluso para un PRO vigente.
      // Es un fallo silencioso de los peores: la interfaz escondería el
      // recorrido 3D a quien lo ha pagado y no habría ningún error por ningún
      // lado. Se detectó comprobando los tres planes contra el seed real.
      plan: true,
      plan_vence: true,
      _count: {
        select: {
          propiedades: true,
          contactosComoAgente: true,
          contactosComoPropietario: true,
        },
      },
    },
  });

  if (!usuario) {
    throw new ErrorNoAutorizado('Tu sesión ya no es válida.');
  }

  const { _count, ...datos } = usuario;

  res.json({
    /**
     * Se pasa por `usuarioPublico()` en vez de esparcir la fila directamente.
     *
     * Antes esto hacía `...datos`, y ese atajo es justo lo que se saltó el
     * plan: la función que se declara "única puerta de salida de datos de
     * usuario" no se estaba usando, así que añadir un campo a la lista blanca
     * no llegaba a esta respuesta. Una sola puerta, un solo sitio donde mirar.
     */
    ...usuarioPublico(datos),
    resumen: {
      propiedades_publicadas: _count.propiedades,
      leads_recibidos: _count.contactosComoAgente + _count.contactosComoPropietario,
    },
  });
};

// ========================================
// EDITAR MI PERFIL
// ========================================
export const actualizarMiPerfil = async (req, res) => {
  const { nombre, telefono, avatar_url, contrasenaActual, nuevaContrasena } = req.body;

  const datos = {};
  if (nombre !== undefined) datos.nombre = nombre.trim();
  if (telefono !== undefined) datos.telefono = telefono || null;
  if (avatar_url !== undefined) datos.avatar_url = avatar_url || null;

  // Cambiar la contraseña exige confirmar la actual (validado en el schema).
  if (nuevaContrasena) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { contrasena_hash: true },
    });

    const coincide = await bcrypt.compare(contrasenaActual, usuario.contrasena_hash);

    if (!coincide) {
      throw new ErrorValidacion([
        { campo: 'contrasenaActual', mensaje: 'La contraseña actual no es correcta' },
      ]);
    }

    datos.contrasena_hash = await bcrypt.hash(nuevaContrasena, config.bcrypt.rondas);
  }

  const actualizado = await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: datos,
  });

  /**
   * 📌 CAMBIAR LA CONTRASEÑA CIERRA LAS DEMÁS SESIONES.
   *
   * Es la razón por la que mucha gente cambia la contraseña: "creo que alguien
   * entró en mi cuenta". Cambiarla y dejar las otras sesiones abiertas sería
   * cerrar la puerta con el ladrón dentro, y no daría ningún error: el dueño
   * cambiaría su clave, vería "listo", y la otra sesión seguiría navegando con
   * su token de renovación durante un mes.
   *
   * Y se le abre una sesión nueva AQUÍ MISMO, en la misma respuesta. Se cierran
   * todas —esta incluida— y se le da otra: así sigue donde estaba (acaba de
   * demostrar que sabe la contraseña vieja, no hay nada que dudar) y todos los
   * demás dispositivos se quedan fuera.
   */
  if (datos.contrasena_hash) {
    await revocarTodosLosTokens(req.usuario.id);
    await abrirSesion(res, actualizado);
  }

  res.json({
    mensaje: 'Perfil actualizado.',
    usuario: usuarioPublico(actualizado),
  });
};

// ========================================
// SOLICITAR SER AGENTE
// ========================================
// ROL: NO SE AUTO-ASIGNA.
//
// El modelo de negocio cobra por herramientas a agentes inmobiliarios, así que
// "ser agente" tiene que ser una decisión, no un casillero que el usuario marca
// al registrarse.
//
// 📌 QUÉ CAMBIÓ Y POR QUÉ (esto era un agujero funcional, no de seguridad)
//
// La versión anterior recibía `documento` y `mensaje`, guardaba el documento en
// el usuario y respondía esto:
//
//     detalles: { documento, mensaje: mensaje || '(sin notas)', estado: 'PENDIENTE' }
//
// Ese `estado: 'PENDIENTE'` NO era un dato: era un literal escrito a mano en el
// JSON de respuesta. No existía ninguna fila que guardara la solicitud, así que:
//
//   - el panel de admin no tenía cola que mostrar (infería "pendiente" de
//     `documento_identidad && !identidad_verificada`, que es una corazonada,
//     no un estado),
//   - el `mensaje` del solicitante se TIRABA a la basura,
//   - aprobar y rechazar no existían como acciones.
//
// Ahora cada intento crea una fila en `SolicitudAgente`. Eso da cola,
// historial, motivo de rechazo y auditoría de quién decidió qué.

export const solicitarAgente = async (req, res) => {
  const { documento, mensaje } = req.body;
  const usuarioId = req.usuario.id;

  // Un AGENTE ya lo es: no tiene sentido pedirlo.
  if (req.usuario.rol === 'AGENTE') {
    throw new ErrorConflicto('Tu cuenta ya es de agente.');
  }

  /**
   * ⛔ SOLO UNA SOLICITUD PENDIENTE A LA VEZ.
   *
   * Sin esta comprobación, pulsar "enviar" tres veces mete tres filas en la
   * cola del admin y este revisa el mismo caso tres veces. Peor: al aprobar
   * una, las otras dos quedan PENDIENTE para siempre y la cola nunca se vacía.
   *
   * Un RECHAZADO sí puede volver a intentarlo: para eso está el motivo de
   * rechazo. Lo que no se puede es encolar en paralelo.
   */
  const pendiente = await prisma.solicitudAgente.findFirst({
    where: { usuario_id: usuarioId, estado: 'PENDIENTE' },
    select: { id: true, fecha_creacion: true },
  });

  if (pendiente) {
    throw new ErrorConflicto(
      'Ya tienes una solicitud en revisión. Te avisaremos cuando se resuelva.'
    );
  }

  /**
   * El documento se guarda en los DOS sitios, y es a propósito:
   *
   *   - En `Usuario.documento_identidad` porque es el dato vigente de la
   *     persona: el panel de admin lo muestra en el listado general.
   *   - En `SolicitudAgente.documento` porque es la fotocopia de lo que se
   *     presentó EN ESTE INTENTO. Si alguien corrige el DNI y vuelve a
   *     solicitarlo, hay que poder saber qué documento se revisó la primera vez.
   *
   * Los datos duplicados suelen ser un error de diseño; aquí son deliberados
   * porque responden a dos preguntas distintas ("¿cuál es su documento?" y
   * "¿qué documento revisamos entonces?").
   */
  const [solicitud] = await prisma.$transaction([
    prisma.solicitudAgente.create({
      data: {
        usuario_id: usuarioId,
        documento,
        // Antes esto se descartaba. Ahora el admin lo lee.
        mensaje: mensaje?.trim() || null,
      },
      select: {
        id: true,
        documento: true,
        mensaje: true,
        estado: true,
        fecha_creacion: true,
      },
    }),
    prisma.usuario.update({
      where: { id: usuarioId },
      data: { documento_identidad: documento },
      select: { id: true },
    }),
  ]);

  res.status(201).json({
    // ⛔ Aquí decía "te avisaremos por correo", y era falso: el proyecto no
    // manda correos (no hay nodemailer ni SMTP, comprobado). Prometer un aviso
    // que no llega es peor que no prometerlo —quien solicita se queda
    // esperando un correo que nunca va a ver—. El estado se consulta en el
    // perfil, que es donde está `mi-solicitud`.
    mensaje:
      'Solicitud registrada. Un administrador la revisará; puedes seguir el estado en tu perfil.',
    solicitud,
  });
};

// ========================================
// ESTADO DE MI SOLICITUD
// ========================================
// Sin esto el usuario no tiene forma de saber si le aprobaron, le rechazaron
// ni por qué. Manda la solicitud y se queda a oscuras.

export const obtenerMiSolicitud = async (req, res) => {
  const solicitud = await prisma.solicitudAgente.findFirst({
    where: { usuario_id: req.usuario.id },
    orderBy: { fecha_creacion: 'desc' },
    select: {
      id: true,
      documento: true,
      mensaje: true,
      estado: true,
      motivo_rechazo: true,
      fecha_creacion: true,
      fecha_resolucion: true,
      // Se expone el nombre del admin que resolvió: el usuario tiene derecho a
      // saber quién tomó la decisión sobre su cuenta.
      revisor: { select: { id: true, nombre: true } },
    },
  });

  // `null` y no 404: "no has solicitado nada" es una respuesta legítima, no un
  // error. El frontend pinta el formulario en vez de una pantalla de fallo.
  res.json({ solicitud: solicitud ?? null });
};
