// ========================================
// 📬 RUTAS DE CONTACTOS (Leads del CRM)
// ========================================

import express from 'express';
import { validar } from '../middleware/validacion.js';
import { limitadorEscritura } from '../middleware/security.js';
import { verificarToken } from '../middleware/auth.js';
import {
  crearContactoSchema,
  actualizarContactoSchema,
  idParamSchema,
} from '../schemas/index.js';
import {
  crearContacto,
  obtenerMisLeads,
  actualizarContacto,
  obtenerEstadisticasCRM,
} from '../controllers/contactoController.js';

const router = express.Router();

// Todas exigen sesión: un lead siempre tiene un cliente identificado.
router.use(verificarToken);

// Métricas del CRM: "mi herramienta me trajo 40 contactos este mes".
router.get('/estadisticas', obtenerEstadisticasCRM);

// Bandeja de leads del agente o del propietario.
router.get('/mis-leads', obtenerMisLeads);

// Crear un lead.
router.post('/', limitadorEscritura, validar(crearContactoSchema), crearContacto);

// Mover un lead de estado (NUEVO → EN_PROCESO → CERRADO).
router.put(
  '/:id',
  validar(idParamSchema, 'params'),
  validar(actualizarContactoSchema),
  actualizarContacto
);

export default router;
