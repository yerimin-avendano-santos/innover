// ========================================
// 🛡️ MIDDLEWARES DE SEGURIDAD
// ========================================
// "Security middleware" = headers HTTP y límites que protegen tu API
// sin que tengas que acordarte de hacerlo en cada endpoint.

import rateLimit from 'express-rate-limit';
import config from '../config/env.js';

/**
 * Límite general de peticiones.
 *
 * Evita que alguien con un script sature tu servidor. 300 peticiones
 * cada 15 minutos es de sobra para navegación normal.
 */
export const limitadorGeneral = rateLimit({
  windowMs: config.rateLimit.ventanaMs,
  max: config.rateLimit.maxPeticionesGeneral,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
    codigo: 'RATE_LIMIT',
  },
});

/**
 * Límite específico para login y registro.
 *
 * Es el límite MÁS importante: sin él, un atacante puede probar miles de
 * contraseñas por minuto contra una cuenta conocida.
 *
 * 10 intentos cada 15 minutos es el valor recomendado por OWASP.
 * Un usuario legítimo casi nunca falla 3 veces seguidas.
 */
export const limitadorAuth = rateLimit({
  windowMs: config.rateLimit.ventanaMs,
  max: config.rateLimit.maxIntentosAuth,
  standardHeaders: true,
  legacyHeaders: false,
  // Solo contamos los fallos. Si el login es correcto, el contador se resetea,
  // así un usuario legítimo que entra bien no se bloquea a sí mismo.
  skipSuccessfulRequests: true,
  message: {
    error:
      'Demasiados intentos fallidos de inicio de sesión. Espera 15 minutos antes de reintentar.',
    codigo: 'RATE_LIMIT_AUTH',
  },
});

/**
 * Límite para crear recursos (propiedades, contactos).
 * Evita spam de publicaciones y de leads falsos.
 */
export const limitadorEscritura = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Has alcanzado el límite de publicaciones por hora. Inténtalo más tarde.',
    codigo: 'RATE_LIMIT_ESCRITURA',
  },
});
