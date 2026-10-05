// RUTAS DE AUTENTICACIÓN

import express from 'express';
import { registrarUsuario, loginUsuario, obtenerMiPerfil } from '../controllers/authController.js';
import { verificarToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/registro', registrarUsuario);    // POST /api/auth/registro
router.post('/login', loginUsuario);            // POST /api/auth/login
router.get('/perfil', verificarToken, obtenerMiPerfil); // GET /api/auth/perfil (PROTEGIDA)

export default router;
