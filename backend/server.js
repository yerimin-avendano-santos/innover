// ========================================
// 🚀 SERVIDOR PRINCIPAL DE INMOVER
// ========================================
// Este archivo es el "punto de entrada" de nuestro backend.
// Su trabajo es simple: configurar Express y conectar las rutas.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importamos nuestras rutas organizadas
import usuarioRoutes from './src/routes/usuarioRoutes.js';
import propiedadRoutes from './src/routes/propiedadRoutes.js';

// Configuración
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta raíz (saludo de bienvenida)
app.get('/', (req, res) => {
    res.json({
        proyecto: 'INMOVER API',
        estado: '✅ Funcionando',
        rutas: {
            usuarios: '/api/usuarios',
            propiedades: '/api/propiedades'
        }
    });
});

// Conectamos las rutas
// Todo lo que empiece con /api/usuarios va al archivo de rutas de usuarios
app.use('/api/usuarios', usuarioRoutes);
// Todo lo que empiece con /api/propiedades va al archivo de rutas de propiedades
app.use('/api/propiedades', propiedadRoutes);

// Encender el servidor
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 INMOVER Backend v1.0`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📦 Rutas disponibles:`);
    console.log(`   - /api/usuarios`);
    console.log(`   - /api/propiedades`);
    console.log(`=========================================`);
});
