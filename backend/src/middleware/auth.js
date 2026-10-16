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
import { ErrorNoAutorizado, ErrorProhibido } from '../utils/errores.js';

/**
 * Verifica que el usuario envió un token JWT válido.
 *
 * El token puede venir de dos lugares:
 *   - Header: "Authorization: Bearer <token>"  (lo usan los clientes API)
 *   - Cookie httpOnly                             (lo usan los navegadores)
 *
 * Aceptar ambos es lo que permite que el frontend use cookies seguras
 * sin que un Postman manual tenga que hacer nada raro.
 */
export const verificarToken = async (req, res, next) => {
  try {
    let token = null;

    // 1. Header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // 2. Cookie httpOnly (prioridad, porque el navegador la manda sola)
    if (!token && req.cookies?.innover_token) {
      token = req.cookies.innover_token;
    }

    if (!token) {
      throw new ErrorNoAutorizado('Inicia sesión para continuar.');
    }

    // jwt.verify() NO es "desencriptar": firma con una clave simétrica
    // y además verifica que no haya sido manipulado ni que haya expirado.
    //
    // 📌 El id va en `sub` (subject), que es el claim estándar de JWT
    // para "quién es este token". Al verificarlo vuelve como payload.sub.
    const payload = jwt.verify(token, config.jwt.secreto);

    const usuarioId = Number(payload.sub);

    if (!usuarioId || Number.isNaN(usuarioId)) {
      throw new ErrorNoAutorizado('Sesión inválida. Vuelve a iniciar sesión.');
    }

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
     */
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
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
      },
    });

    if (!usuario) {
      throw new ErrorNoAutorizado('Tu sesión ya no es válida. Vuelve a iniciar sesión.');
    }

    if (!usuario.activo) {
      throw new ErrorProhibido('Tu cuenta está desactivada. Contacta al soporte.');
    }

    // req.usuario es lo que leen los controladores.
    // OJO: el rol viene de la BASE, no del token. Esa es toda la diferencia
    // entre un sistema que se puede degradar de rol y uno que no.
    req.usuario = usuario;

    // Última actividad, para el panel de métricas.
    prisma.usuario
      .update({ where: { id: usuario.id }, data: { ultimo_acceso: new Date() } })
      .catch(() => {}); // fire-and-forget: si falla, no romper la petición

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ErrorNoAutorizado('Tu sesión expiró. Vuelve a iniciar sesión.'));
    }
    if (error instanceof ErrorNoAutorizado || error instanceof ErrorProhibido) {
      return next(error);
    }
    // Token malformado, firma inválida, etc.
    next(new ErrorNoAutorizado('Sesión inválida. Vuelve a iniciar sesión.'));
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
