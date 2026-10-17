// ========================================
// ❤️ RUTAS DE FAVORITOS
// ========================================
// Las tres piden token, y no hay ninguna pública:
//
//   GET    /     → TOKEN   (mi lista)
//   POST   /     → TOKEN   (guardar)
//   DELETE /:id  → TOKEN   (quitar)
//
// 📌 NINGUNA LLEVA `usuarioOpcional`.
//
// Esa pieza NO protege: identifica. Va solo en rutas que YA son públicas (hoy,
// únicamente la ficha) para que el dueño vea su propio borrador. Ponerla aquí
// no daría ningún error y dejaría la lista de cualquiera abierta a quien no
// mande token — el fallo más silencioso de este proyecto, y por eso se dice
// explícitamente.
//
// 📌 `:id` ES EL ID DE LA PROPIEDAD, NO EL DE LA FILA DE `Favorito`.
//
// A propósito: el cliente nunca ve el id del favorito (no le sirve para nada)
// y así el botón de la ficha manda el id que ya tiene en la mano, sin una
// consulta previa para traducirlo.
//
// 📌 Y NO LLEVAN `limitadorEscritura`.
//
// Su trabajo es frenar el spam de cosas que ven otros (anuncios, leads). Un
// favorito es privado y la clave única impide repetirlo, así que no hay nada
// que limitar. El porqué largo, en la cabecera del controlador.

import express from 'express';
import { validar } from '../middleware/validacion.js';
import { verificarToken } from '../middleware/auth.js';
import { crearFavoritoSchema, paginacionSchema, idParamSchema } from '../schemas/index.js';
import {
  obtenerFavoritos,
  crearFavorito,
  eliminarFavorito,
} from '../controllers/favoritoController.js';

const router = express.Router();

router.get('/', verificarToken, validar(paginacionSchema, 'query'), obtenerFavoritos);

router.post('/', verificarToken, validar(crearFavoritoSchema), crearFavorito);

router.delete(
  '/:id',
  verificarToken,
  validar(idParamSchema, 'params'),
  eliminarFavorito
);

export default router;
