// CONTROLADOR DE USUARIOS
// Aquí va toda la LÓGICA de negocio relacionada con usuarios.
// Los controladores reciben la petición (req), hacen el trabajo, y envían la respuesta (res).

import prisma from '../config/db.js';

// [CREATE] Crear un usuario
export const crearUsuario = async (req, res) => {
    try {
        const { nombre, email, contrasena_hash, rol } = req.body;

        const nuevoUsuario = await prisma.usuario.create({
            data: { nombre, email, contrasena_hash, rol }
        });

        res.status(201).json(nuevoUsuario);
    } catch (error) {
        console.error(error);
        // Si el email ya existe, Prisma lanza un error especial
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Ese email ya está registrado' });
        }
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
};

// [READ] Obtener todos los usuarios
export const obtenerUsuarios = async (req, res) => {
    try {
        const usuarios = await prisma.usuario.findMany({
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                fecha_creacion: true
                // NO incluimos contrasena_hash por seguridad
            }
        });
        res.json(usuarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

// [READ] Obtener un usuario por su ID
export const obtenerUsuarioPorId = async (req, res) => {
    try {
        // req.params.id viene de la URL, ej: /api/usuarios/3 → id = "3"
        const { id } = req.params;

        const usuario = await prisma.usuario.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                fecha_creacion: true,
                propiedades: true // Traemos sus propiedades también
            }
        });

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(usuario);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar el usuario' });
    }
};

// [UPDATE] Actualizar un usuario
export const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, rol } = req.body;

        const usuarioActualizado = await prisma.usuario.update({
            where: { id: parseInt(id) },
            data: { nombre, email, rol }
        });

        res.json(usuarioActualizado);
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
};

// [DELETE] Eliminar un usuario
export const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.usuario.delete({
            where: { id: parseInt(id) }
        });

        res.json({ mensaje: '✅ Usuario eliminado correctamente' });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};

