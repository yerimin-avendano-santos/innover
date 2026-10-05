// RUTAS DE PROPIEDADES (Ahora con protección)

import express from 'express';
import { verificarToken, verificarRol } from '../middleware/auth.js';
import {
    crearPropiedad,
    obtenerPropiedades,
    obtenerPropiedadPorId,
    actualizarPropiedad,
    eliminarPropiedad
} from '../controllers/propiedadController.js';

const router = express.Router();

// Rutas PÚBLICAS (cualquiera puede ver propiedades)
router.get('/', obtenerPropiedades);              // GET    /api/propiedades
router.get('/:id', obtenerPropiedadPorId);        // GET    /api/propiedades/1

// Rutas PROTEGIDAS (necesitas estar logueado)
router.post('/', verificarToken, crearPropiedad);                                   // Solo usuarios logueados pueden crear
router.put('/:id', verificarToken, actualizarPropiedad);                            // Solo usuarios logueados pueden editar
router.delete('/:id', verificarToken, verificarRol('ADMIN', 'AGENTE'), eliminarPropiedad);  // Solo ADMIN o AGENTE pueden eliminar

export default router;
