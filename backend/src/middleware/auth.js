// MIDDLEWARE DE AUTENTICACIÓN
//
// ¿Qué es un Middleware?
// Es una función que se ejecuta ANTES de que la petición llegue al controlador.
// Imagina un guardia de seguridad en la puerta del edificio:
//   1. El usuario muestra su pulsera (token JWT).
//   2. El guardia la verifica.
//   3. Si es válida → lo deja pasar al controlador.
//   4. Si no es válida → lo rechaza con un error 401.
//
// Uso en las rutas:
//   router.get('/mi-perfil', verificarToken, obtenerMiPerfil);
//                            ^^^^^^^^^^^^^^
//                            Este middleware se ejecuta primero

import jwt from 'jsonwebtoken';

// Middleware: Verificar que el usuario envió un token JWT válido
export const verificarToken = (req, res, next) => {
    // El token viene en el header "Authorization" con formato: "Bearer <token>"
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: '🔒 Acceso denegado. No se envió un token.' });
    }

    // Extraemos solo el token (quitamos la palabra "Bearer ")
    const token = authHeader.split(' ')[1];

    try {
        // jwt.verify() desencripta el token y nos devuelve los datos del usuario
        const datosUsuario = jwt.verify(token, process.env.JWT_SECRET);

        // Guardamos los datos del usuario en req.usuario para que el controlador los use
        req.usuario = datosUsuario;

        // next() le dice a Express: "Todo bien, déjalo pasar al siguiente paso"
        next();
    } catch (error) {
        return res.status(403).json({ error: '🔒 Token inválido o expirado.' });
    }
};

// Middleware: Verificar que el usuario tenga un ROL específico
// Uso: router.delete('/usuarios/:id', verificarToken, verificarRol('ADMIN'), eliminarUsuario);
export const verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ 
                error: '🚫 No tienes permiso para realizar esta acción.',
                tu_rol: req.usuario.rol,
                roles_requeridos: rolesPermitidos
            });
        }
        next();
    };
};
