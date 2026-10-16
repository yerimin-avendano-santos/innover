// ========================================
// 👥 RUTAS DE USUARIOS (solo ADMIN)
// ========================================
// ⛔ CAMBIO CRÍTICO: antes estas rutas eran PÚBLICAS.
// Ahora TODAS exigen token, y las que modifican datos exigen rol ADMIN.
//
// Un usuario normal NO gestiona usuarios: gestiona SU perfil desde
// /api/auth/perfil. Esta carpeta es la herramienta de administración
// de la plataforma.

import express from 'express';
import { validar } from '../middleware/validacion.js';
import { verificarToken, verificarRol } from '../middleware/auth.js';
import {
  idParamSchema,
  actualizarUsuarioAdminSchema,
  actualizarPlanSchema,
} from '../schemas/index.js';
import {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  actualizarPlan,
} from '../controllers/usuarioController.js';

const router = express.Router();

// Una sola línea aplica "token + rol ADMIN" a todas las rutas de aquí
// hacia abajo. Es el patrón DRY: en vez de repetir los dos middlewares
// en cada ruta, se aplican una vez y "se heredan".
router.use(verificarToken, verificarRol('ADMIN'));

router.get('/', obtenerUsuarios);

// ⛔ EL PLAN NO SE TOCA DESDE `PUT /:id`.
//
// `actualizarUsuarioAdminSchema` (el de PUT) NO incluye `plan` ni `plan_vence`
// entre sus campos: Zod descarta en silencio todo lo que no esté en la lista
// blanca, así que un `PUT /api/usuarios/5 { "plan": "PRO" }` se ignora sin
// error. Eso es deliberado: el plan se cambia por su propia ruta para que
// quede claro en el código que cambiar el plan dispara efectos (retirar
// destaques) que un PUT genérico no ejecutaría.
router.patch('/:id/plan', validar(idParamSchema, 'params'), validar(actualizarPlanSchema), actualizarPlan);

router.get('/:id', validar(idParamSchema, 'params'), obtenerUsuarioPorId);
router.put('/:id', validar(idParamSchema, 'params'), validar(actualizarUsuarioAdminSchema), actualizarUsuario);
router.delete('/:id', validar(idParamSchema, 'params'), eliminarUsuario);

export default router;
