// ========================================
// 🏠 RUTAS DE PROPIEDADES
// ========================================
// Lee cada línea como una regla de permiso:
//
//   GET  /            → TOKEN      (el buscador exige sesión)
//   GET  /cercanas    → TOKEN      (es la misma información, misma regla)
//   GET  /:id         → PÚBLICA    (es la ficha, y tiene que serlo)
//   GET  /mias        → TOKEN      (y solo devuelve las tuyas)
//   POST /            → TOKEN      (debes estar logueado)
//   PUT  /:id         → TOKEN + DUEÑO
//   DELETE /:id       → TOKEN + DUEÑO
//
// 📌 POR QUÉ LA BÚSQUEDA PIDE TOKEN Y LA FICHA NO
//
// Son DOS rutas distintas, y esa separación es lo que hace posible la regla.
//
//   · Buscar y filtrar es la herramienta: se pide cuenta para usarla. Además
//     la pantalla del buscador monta Mapbox, que se cobra por carga — dejar
//     que cada visitante anónimo levantara un mapa sería pagar por gente que
//     todavía no es usuario.
//
//   · La ficha (`/:id`, que acepta id numérico o slug) es la página que se
//     comparte por WhatsApp y la que indexa Google. Si exigiera sesión, cada
//     enlace compartido daría contra un muro y no habría nada que indexar:
//     el producto perdería su única puerta de entrada orgánica. Quien recibe
//     el enlace ve la propiedad; solo buscar y filtrar pide cuenta.
//
// ⛔ EL CANDADO VA EN EL SERVIDOR, NO EN LA PANTALLA.
//
// Esconder el buscador en el frontend y dejar esta ruta abierta no habría
// protegido nada: bastaba un `curl` para leer el mercado entero sin cuenta.
// Lo que se ve en la pantalla es cortesía; lo que decide es esto.
//
// El detalle importante: verificarDuenio NO solo mira el rol.
// Que seas AGENTE no te da permiso sobre las propiedades de otros agentes.
// La propiedad se verifica recurso por recurso.

import express from 'express';
import { validar } from '../middleware/validacion.js';
import { limitadorEscritura } from '../middleware/security.js';
import { verificarToken, verificarDuenio, usuarioOpcional } from '../middleware/auth.js';
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

// --- CON SESIÓN ---
//
// Estas dos son la HERRAMIENTA de búsqueda, y piden token. Las dos devuelven
// el mismo tipo de información, así que dejar una abierta habría abierto la
// otra: proteger solo el buscador y no `/cercanas` no protegería nada.

// Propiedades cercanas por radio (PostGIS).
// Aquí usamos el esqueleto sin las reglas cruzadas: en esta ruta
// latitud/longitud son los únicos campos que importan y ya se validan
// como números. El `.partial()` funciona porque este esquema no tiene refinements.
router.get(
  '/cercanas',
  verificarToken,
  validar(filtrosPropiedadBaseSchema.partial(), 'query'),
  obtenerPropiedadesCercanas
);

// El buscador. Todos los filtros son opcionales y llegan validados por Zod.
router.get('/', verificarToken, validar(filtrosPropiedadSchema, 'query'), obtenerPropiedades);

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

// ⛔ Esta es la ÚNICA lectura pública de propiedades, y a propósito: es la
// ficha que se comparte por enlace y la que indexa Google. El porqué, en la
// cabecera del archivo.
//
// Acepta id numérico O slug, así que usa el esquema mixto. Con
// `idParamSchema` (solo números) una URL como
// /propiedad/depa-vista-al-mar-miraflores devolvía 400.
//
// 📌 `usuarioOpcional` NO protege esta ruta: es pública y sigue siéndolo. Lo
// que hace es que el dueño pueda abrir su propio BORRADOR en vez de comerse un
// 403. El controlador ya lo decidía con `esVisiblePara(req.usuario, ...)`, pero
// `req.usuario` no lo rellenaba NADIE aquí, así que la respuesta era 403
// también para el dueño. El propio controlador lo daba por hecho: cuenta las
// visitas con `req.usuario?.id !== propiedad.usuario_id`, y sin identidad el
// contador subía incluso cuando el dueño miraba su propia casa.
//
// El orden —validar antes que identificar— es el contrario que en las rutas
// protegidas, y a propósito: allí el 401 va primero para no filtrar si los
// filtros eran válidos; aquí no hay nada que filtrar. Un slug mal escrito se
// contesta sin tocar la base.
router.get(
  '/:id',
  validar(idOSlugParamSchema, 'params'),
  usuarioOpcional,
  obtenerPropiedadPorId
);

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
