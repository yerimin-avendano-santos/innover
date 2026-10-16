// ========================================
// 🏠 RUTAS DE PROPIEDADES
// ========================================
// Lee cada línea como una regla de permiso:
//
//   GET  /            → PÚBLICA    (cualquiera puede buscar, es el marketplace)
//   GET  /mias        → TOKEN      (y solo devuelve las tuyas)
//   POST /            → TOKEN      (debes estar logueado)
//   PUT  /:id         → TOKEN + DUEÑO
//   DELETE /:id       → TOKEN + DUEÑO
//
// El detalle importante: verificarDuenio NO solo mira el rol.
// Que seas AGENTE no te da permiso sobre las propiedades de otros agentes.
// La propiedad se verifica recurso por recurso.

import express from 'express';
import { validar } from '../middleware/validacion.js';
import { limitadorEscritura } from '../middleware/security.js';
import { verificarToken, verificarDuenio } from '../middleware/auth.js';
import {
  filtrosPropiedadSchema,
  filtrosPropiedadBaseSchema,
  crearPropiedadSchema,
  actualizarPropiedadSchema,
  idParamSchema,
  idOSlugParamSchema,
} from '../schemas/index.js';
import {
  crearPropiedad,
  obtenerPropiedades,
  obtenerPropiedadPorId,
  obtenerMisPropiedades,
  actualizarPropiedad,
  eliminarPropiedad,
  obtenerPropiedadesCercanas,
} from '../controllers/propiedadController.js';

const router = express.Router();

/**
 * ⚠️ EL ORDEN DE ESTAS RUTAS IMPORTA.
 *
 * Express prueba las rutas en orden y se detiene en la primera que coincide
 * con el método y el patrón. Por eso TODO lo que tenga un texto literal
 * (`/mias`, `/cercanas`) tiene que declararse ANTES que `/:id`.
 *
 * Si inviertieras el orden, Express vería "mias" como un id de propiedad,
 * intentaría buscar una propiedad con slug "mias", daría 404, y tu pantalla
 * de "mis publicaciones" nunca funcionaría.
 */

// --- PÚBLICAS ---

// Propiedades cercanas por radio (PostGIS).
// Aquí usamos el esqueleto sin las reglas cruzadas: en esta ruta
// latitud/longitud son los únicos campos que importan y ya se validan
// como números. El `.partial()` funciona porque este esquema no tiene refinements.
router.get(
  '/cercanas',
  validar(filtrosPropiedadBaseSchema.partial(), 'query'),
  obtenerPropiedadesCercanas
);

// El buscador. Todos los filtros son opcionales y llegan validados por Zod.
router.get('/', validar(filtrosPropiedadSchema, 'query'), obtenerPropiedades);

// --- PROTEGIDAS ---

// "Mis propiedades": el usuario_id sale del token, así que es imposible
// pedir las propiedades de otra persona por esta ruta.
router.get('/mias', verificarToken, obtenerMisPropiedades);

router.post(
  '/',
  verificarToken,
  limitadorEscritura,
  validar(crearPropiedadSchema),
  crearPropiedad
);

// --- CON PARÁMETRO (al final, para que no las "se coma" el 404) ---

// ⛔ Esta ruta acepta id numérico O slug, así que usa el esquema mixto.
// Con `idParamSchema` (solo números) una URL como
// /propiedad/depa-vista-al-mar-miraflores devolvía 400.
router.get('/:id', validar(idOSlugParamSchema, 'params'), obtenerPropiedadPorId);

router.put(
  '/:id',
  verificarToken,
  validar(idParamSchema, 'params'),
  validar(actualizarPropiedadSchema),
  verificarDuenio('propiedad'),
  actualizarPropiedad
);

router.delete(
  '/:id',
  verificarToken,
  validar(idParamSchema, 'params'),
  verificarDuenio('propiedad'),
  eliminarPropiedad
);

export default router;
