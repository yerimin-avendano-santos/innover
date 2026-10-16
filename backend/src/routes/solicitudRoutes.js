// ========================================
// 🧾 RUTAS DE SOLICITUDES DE AGENTE (solo ADMIN)
// ========================================
// 📌 POR QUÉ UN ARCHIVO APARTE Y NO DENTRO DE /api/usuarios
//
// Por dos motivos, y el primero es un bug esperando a pasar:
//
//  1. `usuarioRoutes.js` monta `router.get('/:id')`. Si estas rutas vivieran
//     ahí, `GET /api/usuarios/solicitudes` entraría por `/:id` con id =
//     "solicitudes", y `Number("solicitudes")` es NaN. Prisma buscaría NaN y
//     devolvería un 404 confuso. Es exactamente la misma trampa que obliga a
//     poner `/mias` antes de `/:id` en propiedadRoutes.js.
//
//  2. Una solicitud NO es un usuario. Es su propio recurso, con su propio
//     ciclo de vida (nace pendiente, se resuelve una vez). Meterla bajo
//     /api/usuarios mezcla dos cosas que cambian por razones distintas.
//
// El prefijo de la URL lo pone server.js: app.use('/api/solicitudes', ...).
// Aquí las rutas van SIN el prefijo.

import express from 'express';
import { validar } from '../middleware/validacion.js';
import { verificarToken, verificarRol } from '../middleware/auth.js';
import { idParamSchema, resolverSolicitudAgenteSchema } from '../schemas/index.js';
import {
  obtenerSolicitudesAgente,
  resolverSolicitudAgente,
} from '../controllers/usuarioController.js';

const router = express.Router();

// ⛔ TODAS las rutas de este archivo son de administración.
// `verificarToken` SIEMPRE antes de `verificarRol`: sin el primero,
// `req.usuario` no existe y verificarRol reventaría con un 500 en vez de
// dar un 401 claro.
router.use(verificarToken, verificarRol('ADMIN'));

// La cola. `?estado=APROBADA` para consultar el historial; por defecto
// devuelve las pendientes, que es lo que el admin necesita al entrar.
router.get('/', obtenerSolicitudesAgente);

// Resolver: aprobar o rechazar. Una sola vez por solicitud.
router.patch(
  '/:id',
  validar(idParamSchema, 'params'),
  validar(resolverSolicitudAgenteSchema),
  resolverSolicitudAgente
);

export default router;
