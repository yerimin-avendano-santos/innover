// ========================================
// 🔐 MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN
// ========================================
// ¿Qué es un middleware?
// Una función que se ejecuta ANTES de que la petición llegue al controlador.
// Imagina un guardia en la puerta de un edificio:
//   1. El usuario muestra su pulsera (token JWT).
//   2. El guardia la verifica.
//   3. Si es válida → lo deja pasar al controlador.
//   4. Si no → lo rechaza con un 401.
//
// Uso en las rutas:
//   router.get('/mi-perfil', verificarToken, obtenerMiPerfil);
//                            ^^^^^^^^^^^^^^
//                            Este middleware se ejecuta primero

import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import prisma from '../config/db.js';
import { COOKIE_SESION } from '../utils/cookies.js';
import { ErrorNoAutorizado, ErrorProhibido } from '../utils/errores.js';

/** Los campos del usuario que se cargan en cada petición. */
const CAMPOS_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  // El plan también se lee de la base, no del token, por el mismo motivo
  // que el rol: si a alguien le vencen el PRO, debe perder las ventajas
  // en la siguiente petición — no cuando caduque su token.
  plan: true,
  plan_vence: true,
};

/**
 * ¿Quién manda esta petición? — la ÚNICA respuesta a esa pregunta.
 *
 * Devuelve `{ usuario }` si se pudo identificar, o `{ motivo }` explicando por
 * qué no. NO lanza excepciones por un token malo: no saber quién eres no es un
 * error, es un dato. Quien decide si eso corta la petición es el middleware.
 *
 * 📌 POR QUÉ ESTÁ SEPARADA DE LOS MIDDLEWARES QUE LA USAN
 *
 * Porque hay DOS políticas sobre la misma comprobación, y la comprobación es
 * larga: dos sitios donde buscar el token, verificar la firma, comprobar la
 * caducidad y volver a la base por el rol. Escribirla dos veces sería crear
 * dos caminos que se separan con el tiempo, y el día que alguien añada aquí
 * una comprobación nueva —una lista de tokens revocados, por ejemplo— el
 * camino duplicado se la saltaría en silencio. Y el que se la saltaría es
 * justo el que NO corta la petición: el hueco quedaría del lado abierto.
 *
 * El token puede venir de dos lugares:
 *   - Header: "Authorization: Bearer <token>"  (lo usan los clientes API)
 *   - Cookie httpOnly                          (lo usan los navegadores)
 *
 * Aceptar ambos es lo que permite que el frontend use cookies seguras sin que
 * un Postman manual tenga que hacer nada raro.
 */
async function identificar(req) {
  let token = null;

    // 1. Header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // 2. Cookie httpOnly (prioridad, porque el navegador la manda sola)
    if (!token && req.cookies?.[COOKIE_SESION]) {
      token = req.cookies[COOKIE_SESION];
    }

  if (!token) return { motivo: 'sin-token' };

  // jwt.verify() NO es "desencriptar": firma con una clave simétrica
  // y además verifica que no haya sido manipulado ni que haya expirado.
  //
  // 📌 El id va en `sub` (subject), que es el claim estándar de JWT
  // para "quién es este token". Al verificarlo vuelve como payload.sub.
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secreto);
  } catch (error) {
    // La caducidad merece un mensaje distinto aunque se arregle igual
    // (volviendo a entrar): "se te pasó el tiempo" y "esto no es un token"
    // no son lo mismo para quien lo lee, y el primero le pasa a cualquiera
    // que dejara la pestaña abierta.
    return { motivo: error.name === 'TokenExpiredError' ? 'expirado' : 'invalido' };
  }

  const usuarioId = Number(payload.sub);
  if (!usuarioId || Number.isNaN(usuarioId)) return { motivo: 'invalido' };

  /**
   * ⛔ POR QUÉ VOLVEMOS A BUSCAR EN LA BASE DE DATOS
   *
   * El token dice "soy el usuario 5". Pero:
   *   - ¿Y si le bajaron el rol hace un rato? El token viejo conserva
   *     sus permisos hasta que expire.
   *   - ¿Y si la cuenta se desactivó (activo = false)?
   *   - ¿Y si le robaron el token?
   *
   * Consultar la base cuesta una consulta rápida y cierra esos tres casos.
   * Para un API de este tamaño es un intercambio muy favorable.
   *
   * ⚠️ Y este `await` va FUERA del `try` de arriba a propósito. Si la base no
   * responde, eso no es "sesión inválida": es una caída. Decirle 401 a alguien
   * por un corte de base de datos es mandarlo a volver a entrar, que es
   * justamente lo único que no puede arreglar.
   */
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: CAMPOS_USUARIO,
  });

  if (!usuario) return { motivo: 'no-existe' };
  if (!usuario.activo) return { motivo: 'inactivo' };

  return { usuario };
}

/** El texto que se le da a cada motivo, escrito una sola vez. */
const MOTIVOS = {
  'sin-token': 'Inicia sesión para continuar.',
  expirado: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  invalido: 'Sesión inválida. Vuelve a iniciar sesión.',
  'no-existe': 'Tu sesión ya no es válida. Vuelve a iniciar sesión.',
};

/**
 * Exige un token válido: sin él, la petición se corta con 401.
 *
 * Es el middleware de casi todas las rutas. Lo que no es público, no se
 * contesta sin saber a quién.
 */
export const verificarToken = async (req, res, next) => {
  try {
    const resultado = await identificar(req);

    if (resultado.motivo) {
      // La cuenta desactivada es lo único que va con 403 y no con 401: el
      // token es válido y el usuario existe, así que insistir no arregla
      // nada. Volver a entrar solo le daría la misma puerta en la cara.
      if (resultado.motivo === 'inactivo') {
        throw new ErrorProhibido('Tu cuenta está desactivada. Contacta al soporte.');
      }
      throw new ErrorNoAutorizado(MOTIVOS[resultado.motivo]);
    }

    // req.usuario es lo que leen los controladores.
    // OJO: el rol viene de la BASE, no del token. Esa es toda la diferencia
    // entre un sistema que se puede degradar de rol y uno que no.
    req.usuario = resultado.usuario;

    // Última actividad, para el panel de métricas.
    prisma.usuario
      .update({ where: { id: resultado.usuario.id }, data: { ultimo_acceso: new Date() } })
      .catch(() => {}); // fire-and-forget: si falla, no romper la petición

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Identifica al usuario SI viene con sesión, y si no, sigue igual.
 *
 * ⛔ ESTO NO ES `verificarToken` EN SUAVE. No protege nada.
 *
 * `verificarToken` es un guardia: sin token, no se pasa. Este es un
 * recepcionista: apunta quién eres si traes credencial, y si no, te deja pasar
 * sin nombre. Por eso SOLO puede ir en rutas que ya son públicas: poner esto
 * donde iba `verificarToken` no protege, RINDE.
 *
 * Sirve para las rutas públicas que se comportan distinto según quién llama.
 * Hay una, y conviene entenderla antes de añadir otra:
 *
 *     GET /api/propiedades/:id   (la ficha)
 *       · sin sesión  → 200 si está publicada; 403 si es un BORRADOR ajeno
 *       · con sesión  → y además, el dueño ve su propio BORRADOR
 *
 * ⚠️ Aquí NO se decide ningún permiso, solo se rellena `req.usuario`. Quien
 * decide sigue siendo el controlador. Si este middleware no reconoce el token,
 * el resultado es el de un visitante anónimo: el caso MÁS restrictivo, no el
 * más permisivo. Ese es el motivo por el que puede ser tan indulgente — un
 * token caducado en una ruta pública no es un error, es alguien sin sesión.
 *
 * ⚠️ Y no actualiza `ultimo_acceso`, también a propósito: eso significa "entró
 * a la aplicación", no "miró una ficha". La ficha la ve cualquiera, y anotar
 * aquí convertiría cada visita con sesión en una escritura a la base.
 */
export const usuarioOpcional = async (req, res, next) => {
  try {
    const resultado = await identificar(req);
    if (resultado.usuario) req.usuario = resultado.usuario;
    next();
  } catch (error) {
    // Un fallo de verdad (la base no responde) sí sube: la ruta va a
    // consultar la misma base un paso después y va a responder 500 de todas
    // formas. Tragárselo aquí solo haría que el controlador tomara al usuario
    // por anónimo y contestara un 403 que no describe lo que está pasando.
    next(error);
  }
};

/**
 * Middleware factory: exige que el usuario tenga uno de los roles indicados.
 *
 * Uso: router.delete('/:id', verificarToken, verificarRol('ADMIN'), eliminar);
 *
 * @param {...string} rolesPermitidos
 *
 * ⛔ SIEMPRE va después de verificarToken.
 * Si lo pones solo, `req.usuario` es undefined y revienta con un error 500
 * en vez de un 401 claro.
 */
export const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(new ErrorNoAutorizado());
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(
        new ErrorProhibido(
          `Esta acción es solo para: ${rolesPermitidos.join(', ')}.`
        )
      );
    }

    next();
  };
};

/**
 * Comprueba que el usuario es dueño del recurso, o es ADMIN.
 *
 * Se usa en update/delete de propiedades. Sin esto, cualquier usuario
 * logueado podía editar la casa de otro con solo saber el ID.
 *
 * La lógica va en un middleware aparte (y no dentro del controlador) para que
 * quede visible en el archivo de rutas dónde ocurre la autorización.
 */
export const verificarDuenio = (modelo = 'propiedad') => {
  return async (req, res, next) => {
    try {
      if (!req.usuario) return next(new ErrorNoAutorizado());

      // ADMIN pasa siempre: es el que modera la plataforma.
      if (req.usuario.rol === 'ADMIN') return next();

      const id = Number(req.params.id);
      const registro = await prisma[modelo].findUnique({
        where: { id },
        select: { usuario_id: true },
      });

      if (!registro) return next();

      if (registro.usuario_id !== req.usuario.id) {
        return next(
          new ErrorProhibido('Esta publicación no es tuya, solo puedes editar la tuya.')
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
