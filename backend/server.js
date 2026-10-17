// ========================================
// 🚀 SERVIDOR PRINCIPAL DE INNOVER
// ========================================
// Este archivo "arma" la aplicación: junta las piezas y las coloca
// en el orden correcto.
//
// ⚠️ EL ORDEN DE LOS MIDDLEWARES IMPORTA MUCHÍSIMO.
// El orden correcto es: seguridad → parseo del cuerpo → CORS → rate limit
// → rutas → 404 → manejador de errores.
// Si inviertes el manejador de errores con las rutas, deja de funcionar.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import config from './src/config/env.js';
import prisma from './src/config/db.js';
import { limitadorGeneral } from './src/middleware/security.js';
import { manejadorErrores, noEncontrado } from './src/middleware/errores.js';

import authRoutes from './src/routes/authRoutes.js';
import usuarioRoutes from './src/routes/usuarioRoutes.js';
import propiedadRoutes from './src/routes/propiedadRoutes.js';
import favoritoRoutes from './src/routes/favoritoRoutes.js';
import contactoRoutes from './src/routes/contactoRoutes.js';
import distritoRoutes from './src/routes/distritoRoutes.js';
import solicitudRoutes from './src/routes/solicitudRoutes.js';

const app = express();

// ========================================
// 1. CABECERAS DE SEGURIDAD (helmet)
// ========================================
// helmet pone cabeceras HTTP que protegen al navegador:
//   - X-Content-Type-Options: nosniff  → impide que el navegador "adivine"
//     el tipo de un archivo y ejecute algo que no debería.
//   - X-Frame-Options: DENY           → impide que alguien incruste tu API
//     en un iframe para hacer clickjacking.
//   - Strict-Transport-Security      → obliga a HTTPS tras la primera visita.
//   - CSP                           → define qué scripts puede cargar la página.
//
// ⛔ Importante: la API sirve JSON, no HTML. helmet protege sobre todo al
// frontend, pero es buena práctica ponerlo igual.

app.set('trust proxy', 1); // detrás de un proxy como Render/Vercel/Nginx

app.use(helmet());

// ========================================
// 2. CORS — Solo orígenes permitidos
// ========================================
// ⛔ ANTES: `app.use(cors())` = cualquier sitio del mundo podía llamar
// a tu API. Eso permite ataques desde páginas de phishing.
//
// Ahora el origen tiene que estar en la lista de config.cors.
// `credentials: true` es necesario para que viaje la cookie de sesión.

app.use(
  cors({
    origin: (origen, callback) => {
      // Sin origin = petición del mismo servidor, curl o Postman.
      // No es un ataque, así que se permite.
      if (!origen) return callback(null, true);

      if (config.cors.origenesPermitidos.includes(origen)) {
        return callback(null, true);
      }

      console.warn(`⚠️  Origen bloqueado por CORS: ${origen}`);
      callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true, // necesario para enviar/recibir cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ========================================
// 3. Lectura del cuerpo y cookies
// ========================================
// cookieParser es lo que permite que verificarToken lea req.cookies.
// Sin esto, la cookie httpOnly que mandamos en el login nunca llegaría.
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));   // 1MB basta para JSON normal
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ========================================
// 4. Límite global de peticiones
// ========================================
app.use(limitadorGeneral);

// ========================================
// 5. Rutas
// ========================================

// Raíz: sirve de "ping" para verificar que la API está viva.
app.get('/', (req, res) => {
  res.json({
    proyecto: 'INNOVER API',
    estado: 'operativo',
    version: '3.0',
    endpoints: {
      auth: '/api/auth',
      propiedades: '/api/propiedades',
      contactos: '/api/contactos',
      distritos: '/api/distritos',
      usuarios: '/api/usuarios (solo ADMIN)',
      solicitudes: '/api/solicitudes (solo ADMIN)',
    },
  });
});

/**
 * Healthcheck: lo usan Render, Vercel y Docker para decidir si la
 * aplicación está viva. Debe responder rápido.
 */
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ estado: 'ok', baseDatos: 'conectada', hora: new Date().toISOString() });
  } catch {
    res.status(503).json({ estado: 'degradado', baseDatos: 'sin conexión' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/propiedades', propiedadRoutes);
app.use('/api/favoritos', favoritoRoutes);
app.use('/api/contactos', contactoRoutes);
app.use('/api/distritos', distritoRoutes);
app.use('/api/solicitudes', solicitudRoutes);

// ========================================
// 6. 404 y manejador de errores
// ========================================
// SIEMPRE al final, y en este orden.
app.use(noEncontrado);
app.use(manejadorErrores);

// ========================================
// 7. Encender el servidor
// ========================================
const servidor = app.listen(config.puerto, () => {
  console.log('=========================================');
  console.log('🚀 INNOVER API v3.0');
  console.log(`🌐 http://localhost:${config.puerto}`);
  console.log(`🔒 Entorno: ${config.esProduccion ? 'PRODUCCIÓN' : 'desarrollo'}`);
  console.log('📦 Rutas:');
  console.log('   POST /api/auth/registro | login | logout');
  console.log('   GET  /api/auth/perfil          (protegida)');
  console.log('   GET  /api/propiedades          (buscador, con sesión)');
  console.log('   GET  /api/propiedades/cercanas (PostGIS, con sesión)');
  console.log('   GET  /api/propiedades/:id      (ficha, PÚBLICA: es el enlace que se comparte)');
  console.log('   GET  /api/propiedades/mias     (protegida)');
  console.log('   POST /api/contactos             (leads del CRM)');
  console.log('   GET  /api/distritos');
  console.log('   ALL  /api/usuarios              (solo ADMIN)');
  console.log('   ALL  /api/solicitudes           (cola de agentes, solo ADMIN)');
  console.log('=========================================');
});

/**
 * Apagado ordenado.
 *
 * Cuando matas un proceso, Node corta todo de golpe. Si hay una petición
 * a media escritura en la base de datos, se pierde. Con esto le damos
 * tiempo a terminar lo que esté en curso.
 */
function apagar() {
  console.log('\n Cerrando el servidor...');
  servidor.close(() => {
    console.log(' Servidor cerrado correctamente.');
    process.exit(0);
  });

  // Si en 10 segundos no cierra, nos vamos igual.
  setTimeout(() => {
    console.error(' Cierre forzado tras 10s.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);

export default app;
