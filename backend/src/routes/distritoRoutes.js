// ========================================
// 📍 RUTAS DE DISTRITOS
// ========================================
// Huánuco se piensa por distritos. Esta ruta alimenta el selector del buscador
// y, más adelante, el filtro por "estilo de vida" del roadmap.

import express from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { validar } from '../middleware/validacion.js';
import { verificarToken, verificarRol } from '../middleware/auth.js';
import { ErrorConflicto } from '../utils/errores.js';

const router = express.Router();

/** Limita los nombres que se pueden crear, para no ensuciar la tabla. */
const crearDistritoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre es demasiado corto')
    .max(60, 'El nombre es demasiado largo')
    .regex(/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s-]+$/, 'Solo letras y espacios'),
  latitud_centro: z.coerce.number().min(-90).max(90).optional(),
  longitud_centro: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * GET /api/distritos — PÚBLICA
 *
 * Lista los distritos con cuántas propiedades publicadas tiene cada uno.
 *
 * El `_count` dentro del `include` trae el número en la MISMA consulta
 * (un JOIN), en vez de una consulta extra por distrito. Con 40 distritos
 * eso son 40 queries en vez de 1.
 */
router.get('/', async (req, res) => {
  const distritos = await prisma.distrito.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      _count: {
        select: {
          propiedades: { where: { estado: 'PUBLICADA' } },
        },
      },
    },
  });

  res.json({
    datos: distritos.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      /**
       * `region` y `provincia` viajan al frontend aunque hoy no se filtren por
       * ellas. "Huánuco" es a la vez un distrito, una provincia y una región:
       * sin estos campos, la interfaz no puede desambiguar cuál de los tres
       * está mostrando, y el día que se abra una segunda región el selector
       * tendría que cambiar de forma.
       */
      region: d.region,
      provincia: d.provincia,
      latitud_centro: d.latitud_centro,
      longitud_centro: d.longitud_centro,
      propiedades_publicadas: d._count.propiedades,
    })),
  });
});

/**
 * POST /api/distritos — solo ADMIN
 *
 * Los distritos son la taxonomía del negocio: si cualquiera pudiera crear
 * "Mi Casa", el filtro por zona se vuelve inútil y el mapa se ensucia.
 */
router.post(
  '/',
  verificarToken,
  verificarRol('ADMIN'),
  validar(crearDistritoSchema),
  async (req, res) => {
    const { nombre, latitud_centro, longitud_centro } = req.body;

    const existente = await prisma.distrito.findUnique({
      where: { nombre: nombre.trim() },
      select: { id: true },
    });

    if (existente) {
      throw new ErrorConflicto('Ese distrito ya está en la lista.');
    }

    const distrito = await prisma.distrito.create({
      data: {
        nombre: nombre.trim(),
        latitud_centro: latitud_centro ?? null,
        longitud_centro: longitud_centro ?? null,
      },
    });

    res.status(201).json({ mensaje: 'Distrito agregado.', distrito });
  }
);

export default router;
