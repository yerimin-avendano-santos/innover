// ========================================
// ❤️ RUTAS DE FAVORITOS
// ========================================
// Todas piden token, y no hay ninguna pública:
//
//   GET    /     → TOKEN   (mi lista)
//   GET    /:id  → TOKEN   (¿está guardado este?)
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
  obtenerFavorito,
  crearFavorito,
  eliminarFavorito,
} from '../controllers/favoritoController.js';

const router = express.Router();

router.get('/', verificarToken, validar(paginacionSchema, 'query'), obtenerFavoritos);

router.post('/', verificarToken, validar(crearFavoritoSchema), crearFavorito);

// ¿Está guardado este anuncio concreto? Lo pregunta la isla de la ficha cuando
// el servidor no pudo ver la sesión. Va después de `/` porque no hay colisión
// —una es la lista y otra un id—, pero se deja escrito para que no se añada
// otra ruta con parámetro sin mirar el orden.
router.get('/:id', verificarToken, validar(idParamSchema, 'params'), obtenerFavorito);

router.delete(
  '/:id',
  verificarToken,
  validar(idParamSchema, 'params'),
  eliminarFavorito
);

export default router;
