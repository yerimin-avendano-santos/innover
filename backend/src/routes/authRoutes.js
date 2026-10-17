// ========================================
// 🔐 RUTAS DE AUTENTICACIÓN
// ========================================
// Este archivo SOLO define qué URL llama a qué controlador.
// Toda la lógica vive en el controlador. Regla: si un archivo de rutas
// tiene lógica de negocio, algo está en el lugar equivocado.
//
// 🔒 Mira el orden de los middlewares en cada línea:
//    verificarToken SIEMPRE va antes de verificarRol y de verificarDuenio.

import express from 'express';
import { validar } from '../middleware/validacion.js';
import { limitadorAuth } from '../middleware/security.js';
import { verificarToken } from '../middleware/auth.js';
import {
  registroSchema,
  loginSchema,
  actualizarPerfilSchema,
  solicitarAgenteSchema,
} from '../schemas/index.js';
import {
  registrarUsuario,
  loginUsuario,
  renovarSesion,
  cerrarSesion,
  obtenerMiPerfil,
  actualizarMiPerfil,
  solicitarAgente,
  obtenerMiSolicitud,
} from '../controllers/authController.js';

const router = express.Router();

// Sin límite de peticiones: el rate limit mide SOLO los intentos fallidos
// (skipSuccessfulRequests). Un usuario que se equivoca 2 veces y luego
// entra bien no queda bloqueado.
router.post('/registro', limitadorAuth, validar(registroSchema), registrarUsuario);
router.post('/login', limitadorAuth, validar(loginSchema), loginUsuario);

/**
 * Renovar la sesión. NO lleva `verificarToken` —si el pase corto fuera válido
 * no habría nada que renovar— ni `limitadorAuth`, porque aquí no hay ninguna
 * contraseña que adivinar: lo que viaja es un secreto de 256 bits. El porqué
 * largo está en el controlador.
 */
router.post('/renovar', renovarSesion);

router.post('/logout', cerrarSesion);

// Rutas protegidas: exigan token válido.
router.get('/perfil', verificarToken, obtenerMiPerfil);
router.patch('/perfil', verificarToken, validar(actualizarPerfilSchema), actualizarMiPerfil);

// ⛔ NOTA: `solicitar-agente` NO cambia el rol. Solo deja la solicitud.
// El ADMIN la aprueba. Por eso vive aquí y no en una ruta de "hazte admin".
router.post('/solicitar-agente', verificarToken, validar(solicitarAgenteSchema), solicitarAgente);

// Estado de la ÚLTIMA solicitud del usuario.
// Sin esto, quien manda la solicitud se queda a oscuras: no sabe si le
// aprobaron, si le rechazaron, ni por qué. Devuelve `solicitud: null` cuando
// nunca ha pedido nada, que no es un error.
router.get('/mi-solicitud', verificarToken, obtenerMiSolicitud);

export default router;
