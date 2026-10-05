// ========================================
// 🚀 SERVIDOR PRINCIPAL DE INMOVER
// ========================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importamos nuestras rutas organizadas
import authRoutes from './src/routes/authRoutes.js';
import usuarioRoutes from './src/routes/usuarioRoutes.js';
import propiedadRoutes from './src/routes/propiedadRoutes.js';

// Configuración
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        proyecto: 'INMOVER API',
        estado: '✅ Funcionando',
        version: '2.0 - Con Autenticación',
        rutas: {
            auth: '/api/auth (registro, login, perfil)',
            usuarios: '/api/usuarios',
            propiedades: '/api/propiedades'
        }
    });
});

// Conectamos las rutas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/propiedades', propiedadRoutes);

// Encender el servidor
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 INMOVER Backend v2.0 (con Auth)`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📦 Rutas disponibles:`);
    console.log(`   - /api/auth      (registro y login)`);
    console.log(`   - /api/usuarios`);
    console.log(`   - /api/propiedades`);
    console.log(`=========================================`);
});
