// CONTROLADOR DE PROPIEDADES
// Toda la lógica de negocio relacionada con propiedades inmobiliarias.

import prisma from '../config/db.js';

// [CREATE] Crear una propiedad
export const crearPropiedad = async (req, res) => {
    try {
        const { usuario_id, titulo, descripcion, precio, tipo, latitud, longitud, habitaciones, banos, tour_3d_url } = req.body;

        const nuevaPropiedad = await prisma.propiedad.create({
            data: {
                usuario_id,
                titulo,
                descripcion,
                precio,
                tipo,
                latitud,
                longitud,
                habitaciones,
                banos,
                tour_3d_url
            }
        });

        res.status(201).json(nuevaPropiedad);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear la propiedad' });
    }
};

// [READ] Obtener TODAS las propiedades (con filtros opcionales)
export const obtenerPropiedades = async (req, res) => {
    try {
        // Los filtros vienen de la URL como "query params"
        // Ejemplo: /api/propiedades?tipo=VENTA&habitaciones=3
        const { tipo, habitaciones, precioMin, precioMax } = req.query;

        // Construimos los filtros dinámicamente
        const filtros = {};
        if (tipo) filtros.tipo = tipo;
        if (habitaciones) filtros.habitaciones = parseInt(habitaciones);
        if (precioMin || precioMax) {
            filtros.precio = {};
            if (precioMin) filtros.precio.gte = parseFloat(precioMin); // gte = Greater Than or Equal (Mayor o igual)
            if (precioMax) filtros.precio.lte = parseFloat(precioMax); // lte = Less Than or Equal (Menor o igual)
        }

        const propiedades = await prisma.propiedad.findMany({
            where: filtros,
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true
                    }
                }
            },
            orderBy: { fecha_creacion: 'desc' } // Las más recientes primero
        });

        res.json(propiedades);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar propiedades' });
    }
};

// [READ] Obtener UNA propiedad por ID
export const obtenerPropiedadPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const propiedad = await prisma.propiedad.findUnique({
            where: { id: parseInt(id) },
            include: {
                usuario: {
                    select: { id: true, nombre: true, email: true }
                }
            }
        });

        if (!propiedad) {
            return res.status(404).json({ error: 'Propiedad no encontrada' });
        }

        res.json(propiedad);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar la propiedad' });
    }
};

// [UPDATE] Actualizar una propiedad
export const actualizarPropiedad = async (req, res) => {
    try {
        const { id } = req.params;
        const datos = req.body;

        const propiedadActualizada = await prisma.propiedad.update({
            where: { id: parseInt(id) },
            data: datos
        });

        res.json(propiedadActualizada);
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Propiedad no encontrada' });
        }
        res.status(500).json({ error: 'Error al actualizar la propiedad' });
    }
};

// [DELETE] Eliminar una propiedad
export const eliminarPropiedad = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.propiedad.delete({
            where: { id: parseInt(id) }
        });

        res.json({ mensaje: '✅ Propiedad eliminada correctamente' });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Propiedad no encontrada' });
        }
        res.status(500).json({ error: 'Error al eliminar la propiedad' });
    }
};
