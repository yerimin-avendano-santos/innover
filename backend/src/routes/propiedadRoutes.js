// RUTAS DE PROPIEDADES

import express from 'express';
import {
    crearPropiedad,
    obtenerPropiedades,
    obtenerPropiedadPorId,
    actualizarPropiedad,
    eliminarPropiedad
} from '../controllers/propiedadController.js';

const router = express.Router();

router.post('/', crearPropiedad);            // POST   /api/propiedades
router.get('/', obtenerPropiedades);          // GET    /api/propiedades
router.get('/:id', obtenerPropiedadPorId);    // GET    /api/propiedades/1
router.put('/:id', actualizarPropiedad);      // PUT    /api/propiedades/1
router.delete('/:id', eliminarPropiedad);     // DELETE /api/propiedades/1

export default router;
