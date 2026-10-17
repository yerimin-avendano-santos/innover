// ========================================
// 🔄 RENOVACIÓN DE SESIÓN: el token que sí se puede apagar
// ========================================
//
// La sesión se apoya en DOS tokens, y cada uno hace lo que el otro no puede:
//
//   `innover_token`        JWT firmado, 2 horas. Viaja en CADA petición. El
//                          servidor lo verifica con la firma y no consulta
//                          nada: por eso es rápido y por eso es irreversible
//                          — mientras esté vigente, no hay manera de pararlo.
//
//   `innover_renovacion`   Cadena al azar, 30 días. Vive en la base. No sirve
//                          para pedir nada: solo sirve para pedir OTRO token
//                          de los cortos cuando el de la firma vence.
//
// Y esa asimetría es exactamente el motivo de que existan los dos. Un token que
// no se puede revocar tiene que durar poco; uno que dura mucho tiene que
// poder revocarse. Lo que nunca funciona es un token que dure mucho Y no se
// pueda revocar, que es lo que había hasta hoy: una cookie de 7 días con un
// JWT de 2 horas dentro, cuyo único desenlace posible era "tu sesión expiró,
// vuelve a entrar" cada dos horas. La gente no cierra sesión: se va. Y volver
// a entrar por obligación, cada dos horas, es la clase de detalle que hace que
// un producto parezca de juguete.
//
// 📌 POR QUÉ EL TOKEN DE RENOVACIÓN ES OPACO Y NO OTRO JWT
//
// Un JWT lleva dentro quién eres y hasta cuándo vale, y eso es cómodo cuando no
// quieres consultar la base. Aquí justo lo que se quiere es consultarla: es la
// única forma de saber si el token sigue vigente o alguien lo apagó. Un JWT
// podría llevar su propia fecha de vencimiento, pero no podría llevar su propia
// anulación — y sin anulación no hay cierre de sesión de verdad.
//
// (Por eso el hash en la base y no el token: si alguien lee la tabla, no puede
// entrar en ninguna cuenta con lo que ve.)
//
// 📌 ¿Y LA ROTACIÓN? — EL PROBLEMA DE LAS DOS PESTAÑAS
//
// Cada renovación entrega un token nuevo y marca el usado, así que un token
// robado solo sirve hasta que el dueño renueve. Pero eso esconde una trampa
// real: si dos pestañas renuevan a la vez, las dos mandan el MISMO token viejo,
// la segunda llega cuando el primero ya rotó... y un sistema riguroso la
// tomaría por un ladrón y echaría al dueño de su propia cuenta. Un falso
// positivo que se lleva por delante a quien no hizo nada.
//
// De ahí la VENTANA DE GRACIA: un token rotado hace menos de un minuto se
// acepta y se rota otra vez (las pestañas son lo más probable). Pasado ese
// minuto ya no hay explicación inocente, y entonces sí se apaga todo.

import crypto from 'node:crypto';
import prisma from '../config/db.js';
import config from '../config/env.js';

/**
 * Cuánto vale un token ya rotado para pedir otro (ventana de gracia).
 *
 * Se cuenta desde la PRIMERA rotación, no desde la última: si se refrescara con
 * cada reintento, quien tuviera el token podría mantenerlo vivo para siempre
 * usándolo en bucle, y la gracia se convertiría en una puerta abierta.
 */
const SEGUNDOS_DE_GRACIA = 60;

/** Días que se guardan las filas muertas antes de barrerlas. */
const DIAS_DE_HISTORIAL = 30;

/** El hash que se guarda en la base. Es lo único que se persiste del token. */
export function hashDeToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Un token nuevo: 32 bytes al azar (256 bits) en base64url.
 *
 * ⚠️ `Math.random()` NO vale para esto, y el error no se ve: devuelve números
 * predecibles a partir de una semilla, así que un atacante que adivine la
 * semilla puede calcular los tokens siguientes. `crypto.randomBytes` es el del
 * sistema operativo, que es justo lo que se necesita aquí.
 */
export function generarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function vencimiento() {
  return new Date(Date.now() + config.jwt.renovacionDias * 24 * 60 * 60 * 1000);
}

/**
 * Abre una sesión nueva: guarda un token de renovación y devuelve el original.
 *
 * El original NO se guarda en ningún sitio: sale de aquí y termina en una
 * cookie. Lo que queda en la base es su hash.
 */
export async function abrirTokenRenovacion(usuarioId) {
  const token = generarToken();

  await prisma.tokenRenovacion.create({
    data: {
      usuario_id: usuarioId,
      token_hash: hashDeToken(token),
      expira: vencimiento(),
    },
    select: { id: true },
  });

  // Barrer el historial viejo justo aquí, aprovechando que ya se está
  // escribiendo. Sin esto habría que programar una tarea periódica para algo
  // que solo hay que hacer de vez en cuando.
  limpiarTokensViejos().catch(() => {}); // fire-and-forget

  return token;
}

/**
 * Cambia un token de renovación por otro nuevo. Devuelve `{ usuario, token }`
 * o `{ motivo }`, y quien llama decide qué hacer con cada caso.
 *
 * Motivos posibles: `no-existe` (token inventado o ya borrado), `expirado`,
 * `revocado` (cerró sesión, o cambió la contraseña), `inactivo` (cuenta
 * desactivada) y `reutilizado` (alarma).
 *
 * 📌 LOS MOTIVOS NO SE LE CUENTAN AL USUARIO, y es a propósito: quien pregunta
 * con un token robado merece la misma respuesta que quien pregunta sin token.
 * Aquí se separan solo para que el código se pueda leer y para que la alarma
 * (`reutilizado`) se pueda probar.
 */
export async function rotarTokenRenovacion(tokenCrudo) {
  const fila = await prisma.tokenRenovacion.findUnique({
    where: { token_hash: hashDeToken(tokenCrudo) },
    include: {
      usuario: {
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
          // ⛔ Los campos del plan tienen que estar: `usuarioPublico()` los lee
          // para calcular `plan_pro_activo`, y sin ellos el veredicto sale
          // `false` para todo el mundo. Es el fallo silencioso que ya costó una
          // vez un rato de depuración (ver el controlador de auth).
          plan: true,
          plan_vence: true,
        },
      },
    },
  });

  if (!fila) return { motivo: 'no-existe' };

  // Un token apagado a propósito (cerrar sesión, cambio de contraseña) no
  // vuelve a valer NUNCA, ni dentro de la ventana de gracia: si la admitiera,
  // cerrar sesión dejaría el token del ladrón funcionando un minuto más justo
  // cuando el dueño acaba de decir que no.
  if (fila.revocado_en) return { motivo: 'revocado' };

  if (fila.expira <= new Date()) return { motivo: 'expirado' };

  if (!fila.usuario.activo) {
    // La cuenta está desactivada: se apaga todo lo que tuviera abierto. Si
    // vuelven a activarla, tendrá que entrar de nuevo, que es lo razonable
    // después de que alguien decidiera cerrarle la puerta.
    await revocarTodosLosTokens(fila.usuario_id);
    return { motivo: 'inactivo' };
  }

  if (fila.rotado_en) {
    const segundos = (Date.now() - fila.rotado_en.getTime()) / 1000;

    if (segundos > SEGUNDOS_DE_GRACIA) {
      // 🚨 Un token que se rotó hace más de un minuto y vuelve a aparecer. La
      // explicación inocente (dos pestañas a la vez) ya no cuelga: esto es un
      // token copiado, o una copia antigua que alguien conservaba.
      //
      // Se apaga TODO, lo del ladrón y lo del dueño. Es incómodo —el dueño
      // tendrá que entrar otra vez— y es exactamente lo que hay que hacer: el
      // dueño puede recuperar su cuenta con su contraseña; el otro no. Ante la
      // duda, se cierra.
      await revocarTodosLosTokens(fila.usuario_id);
      return { motivo: 'reutilizado' };
    }

    // Dentro de la ventana de gracia: lo más probable es que sean dos pestañas
    // del mismo navegador renovando a la vez. Se rota igual, sin alarma.
  }

  const nuevo = generarToken();

  await prisma.$transaction([
    prisma.tokenRenovacion.update({
      where: { id: fila.id },
      data: {
        // ⚠️ Se conserva la fecha de la PRIMERA rotación (`fila.rotado_en ??`).
        // Si se reescribiera con `new Date()` en cada reintento, quien tuviera
        // el token podría mantener la gracia viva indefinidamente usándolo en
        // bucle, y la ventana dejaría de cerrar nada.
        rotado_en: fila.rotado_en ?? new Date(),
      },
    }),
    prisma.tokenRenovacion.create({
      data: {
        usuario_id: fila.usuario_id,
        token_hash: hashDeToken(nuevo),
        expira: vencimiento(),
      },
      select: { id: true },
    }),
  ]);

  return { usuario: fila.usuario, token: nuevo };
}

/**
 * Apaga UN token. Es el cierre de sesión: el navegador deja de mandar la
 * cookie, pero además el token queda muerto en la base, que es lo que hace que
 * cerrar sesión signifique algo de verdad.
 */
export async function revocarTokenRenovacion(tokenCrudo) {
  if (!tokenCrudo) return;

  await prisma.tokenRenovacion.updateMany({
    where: { token_hash: hashDeToken(tokenCrudo), revocado_en: null },
    data: { revocado_en: new Date() },
  });
}

/**
 * Apaga TODAS las sesiones de una persona.
 *
 * Tres usos, y los tres son razones de peso:
 *   - cambiar la contraseña (si alguien te la había robado, se queda fuera),
 *   - la alarma de reutilización,
 *   - una cuenta que se desactiva.
 */
export async function revocarTodosLosTokens(usuarioId) {
  await prisma.tokenRenovacion.updateMany({
    where: { usuario_id: usuarioId, revocado_en: null },
    data: { revocado_en: new Date() },
  });
}

/**
 * Barre las filas que ya no pueden hacer nada: vencidas o apagadas hace más de
 * un mes. No se borran en el momento para no perder la señal de reutilización
 * (un token rotado tiene que seguir ahí para poder reconocerlo si reaparece).
 */
export async function limpiarTokensViejos() {
  const limite = new Date(Date.now() - DIAS_DE_HISTORIAL * 24 * 60 * 60 * 1000);

  const { count } = await prisma.tokenRenovacion.deleteMany({
    where: {
      OR: [
        { expira: { lt: limite } },
        { revocado_en: { lt: limite } },
        { rotado_en: { lt: limite } },
      ],
    },
  });

  return count;
}
