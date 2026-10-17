// ========================================
// ⚙️ CONFIGURACIÓN CENTRALIZADA
// ========================================
// Todas las variables de entorno se leen y validan en UN solo lugar.
//
// ¿Por qué?
// Si lees process.env.JWT_SECRET disperso en cinco archivos, es fácil que en
// un entorno falte y la app arranque "funcionando" hasta que alguien intente
// loguearse. Aquí falla ruidosamente al arrancar, que es lo que quieres.

import dotenv from 'dotenv';

dotenv.config();

/**
 * Lee una variable de entorno obligatoria.
 * Si no existe o está vacía, detiene el proceso con un mensaje claro.
 */
function obligatoria(nombre, valorPorDefecto = undefined) {
  const valor = process.env[nombre] ?? valorPorDefecto;

  if (valor === undefined || valor === '') {
    throw new Error(
      `Falta la variable de entorno ${nombre}.\n` +
        `Cópiala desde .env.example a .env y ajústala.`
    );
  }

  return valor;
}

/**
 * Lee una variable opcional.
 */
function opcional(nombre, valorPorDefecto = null) {
  const valor = process.env[nombre];
  return valor === undefined || valor === '' ? valorPorDefecto : valor;
}

const esProduccion = process.env.NODE_ENV === 'production';

const config = {
  esProduccion,
  puerto: Number(opcional('PORT', 5000)),
  baseDatosUrl: obligatoria('DATABASE_URL'),

  jwt: {
    // En producción NUNCA puede ser un valor por defecto.
    // Si alguien despliega sin definir el secreto, todos los usuarios del
    // mundo podrían firmar tokens falsos y hacerse ADMIN.
    secreto: obligatoria(
      'JWT_SECRET',
      esProduccion ? undefined : 'innover-secreto-de-desarrollo-no-usar-en-produccion'
    ),
    // Vida corta para el access token. El frontend guarda el token en
    // localStorage, así que hay que limitar el daño si se filtra.
    expiraEn: opcional('JWT_EXPIRA_EN', '2h'),
  },

  bcrypt: {
    // 12 rondas. Cada ronda extra duplica el costo de romper un hash.
    rondas: Number(opcional('BCRYPT_RONDAS', 12)),
  },

  cors: {
    // Lista de orígenes permitidos, separada por comas.
    // '*' significa cualquiera y solo tiene sentido en desarrollo.
    origenesPermitidos: opcional('CORS_ORIGENES', 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    // Ventana de 15 minutos (el estándar de OWASP para login).
    ventanaMs: 15 * 60 * 1000,
    maxIntentosAuth: Number(opcional('RATE_LIMIT_AUTH', 10)),
    maxPeticionesGeneral: Number(opcional('RATE_LIMIT_GENERAL', 300)),

    /**
     * Escrituras (publicar, mandar un lead, guardar un favorito) por hora.
     *
     * 📌 ESTA VARIABLE NO EXISTÍA, Y `AGENTS.md` DECÍA QUE SÍ.
     *
     * El tope estaba escrito a mano en el limitador (`max: 20`), así que la
     * recomendación de "súbelo en `backend/.env` si vas a iterar" no hacía
     * absolutamente nada: se podía poner `RATE_LIMIT_ESCRITURA=200`, reiniciar
     * el backend y seguir cortándose a mitad de suite, sin ninguna pista de
     * por qué. Un ajuste documentado que no existe es peor que no tenerlo.
     *
     * El valor por defecto sigue siendo 20 —es un tope de producción— y quien
     * necesite margen lo sube en su `.env` (`.env.example` ya trae 40, que es
     * lo que cuestan dos corridas seguidas de las suites).
     */
    maxEscrituras: Number(opcional('RATE_LIMIT_ESCRITURA', 20)),
    ventanaEscriturasMs: 60 * 60 * 1000,
  },

  paginacion: {
    porPagina: 20,
    maximo: 100,
  },
};

// Aviso ruidoso si el secreto de desarrollo llega a producción.
if (!esProduccion && config.jwt.secreto.includes('desarrollo')) {
  console.warn(
    '\x1b[33m⚠️  Usando el secreto JWT de desarrollo. No sirvas esto en internet.\x1b[0m'
  );
}

export default config;
