// RUTAS DE USUARIOS
// Este archivo SOLO define las URLs y a qué controlador llaman.
// Piensa en esto como el "menú del restaurante" que conecta cada plato con su chef.

import express from 'express';
import {
    crearUsuario,
    obtenerUsuarios,
    obtenerUsuarioPorId,
    actualizarUsuario,
    eliminarUsuario
} from '../controllers/usuarioController.js';

const router = express.Router();

router.post('/', crearUsuario);           // POST   /api/usuarios
router.get('/', obtenerUsuarios);          // GET    /api/usuarios
router.get('/:id', obtenerUsuarioPorId);   // GET    /api/usuarios/1
router.put('/:id', actualizarUsuario);     // PUT    /api/usuarios/1
router.delete('/:id', eliminarUsuario);    // DELETE /api/usuarios/1

export default router;

