// CONTROLADOR DE AUTENTICACIÓN (Auth)
// Aquí vive la lógica de REGISTRO y LOGIN.
//
// 🔑 Conceptos clave que aprenderás aquí:
//
// 1. BCRYPT: Cuando un usuario se registra con contraseña "hola123",
//    bcrypt la convierte en algo como "$2b$10$xK8f..." (un hash irreversible).
//    Ni siquiera nosotros (los desarrolladores) podemos ver la contraseña real.
//
// 2. JWT (JSON Web Token): Cuando el usuario hace login correctamente,
//    le damos un "pase VIP" (token) que debe mostrar en cada petición futura.
//    Es como la pulsera de un festival: sin ella, no entras.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

// ==========================================
// REGISTRO (Sign Up)
// ==========================================
export const registrarUsuario = async (req, res) => {
    try {
        const { nombre, email, contrasena, rol } = req.body;

        // 1. Verificar que el email no exista ya
        const usuarioExistente = await prisma.usuario.findUnique({
            where: { email }
        });

        if (usuarioExistente) {
            return res.status(400).json({ error: 'Este email ya está registrado' });
        }

        // 2. Encriptar la contraseña con bcrypt
        // El número 10 es el "costo": cuántas veces se mezcla. Más alto = más seguro pero más lento.
        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

        // 3. Guardar el usuario con la contraseña encriptada
        const nuevoUsuario = await prisma.usuario.create({
            data: {
                nombre,
                email,
                contrasena_hash: contrasenaEncriptada,
                rol: rol || 'CLIENTE' // Si no dice qué rol, es CLIENTE por defecto
            }
        });

        // 4. Generar un JWT para que ya quede logueado
        const token = jwt.sign(
            { id: nuevoUsuario.id, email: nuevoUsuario.email, rol: nuevoUsuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // El token expira en 7 días
        );

        // 5. Respondemos (SIN enviar la contraseña de vuelta)
        res.status(201).json({
            mensaje: '✅ Usuario registrado exitosamente',
            usuario: {
                id: nuevoUsuario.id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email,
                rol: nuevoUsuario.rol
            },
            token // Este token lo guardará el Frontend para futuras peticiones
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el usuario' });
    }
};

// ==========================================
// LOGIN (Sign In)
// ==========================================
export const loginUsuario = async (req, res) => {
    try {
        const { email, contrasena } = req.body;

        // 1. Buscar al usuario por email
        const usuario = await prisma.usuario.findUnique({
            where: { email }
        });

        if (!usuario) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
            // Nota de seguridad: NUNCA decir "el email no existe" porque un hacker
            // podría usar eso para descubrir qué emails están registrados.
        }

        // 2. Comparar la contraseña que envió con la encriptada en la BD
        const contrasenaCorrecta = await bcrypt.compare(contrasena, usuario.contrasena_hash);

        if (!contrasenaCorrecta) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
        }

        // 3. Si todo está bien, generar el JWT
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 4. Respondemos con el token
        res.json({
            mensaje: '✅ Login exitoso',
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            },
            token
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
};

// ==========================================
// VER MI PERFIL (Ruta protegida de ejemplo)
// ==========================================
export const obtenerMiPerfil = async (req, res) => {
    try {
        // req.usuario viene del middleware de autenticación (veremos esto a continuación)
        const usuario = await prisma.usuario.findUnique({
            where: { id: req.usuario.id },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                fecha_creacion: true,
                propiedades: true
            }
        });

        res.json(usuario);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
};
