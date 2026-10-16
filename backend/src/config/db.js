// ========================================
// 🗄️ CONEXIÓN A LA BASE DE DATOS
// ========================================
// Este archivo expone UNA sola instancia de Prisma reutilizada por toda
// la aplicación.
//
// ¿POR QUÉ NO HACER `new PrismaClient()` EN CADA ARCHIVO?
//
// Prisma no es un simple "librería que habla con la BD": mantiene un pool
// de conexiones TCP abiertas. Si creas 12 instancias, abres 12 pools.
// Con lo mismo, de archivo por archivo, acabas con cientos de conexiones
// hasta que PostgreSQL dice "too many clients for user" y la app se cae.
//
// Además, en desarrollo `nodemon` recarga los archivos en cada cambio.
// Sin este singleton, cada recarga dejaría un pool huérfano en memoria.
//
// 📌 Patrón "singleton" en Node:
//   - En producción no hay nada especial: Node guarda el módulo en caché
//     y el `import` devuelve siempre el mismo objeto.
//   - En desarrollo guardamos la instancia en `globalThis`, porque nodemon
//     borra la caché de módulos entre recargas.

import { PrismaClient } from '@prisma/client';

const globalParaPrisma = globalThis;

/**
 * Configuración de logs de Prisma.
 *
 * `warn` y `error` se muestran siempre. El nivel `query` solo en desarrollo:
 * en producción llenaría los logs de miles de líneas por minuto.
 */
const opciones = {
  log: ['warn', 'error'],
};

const prisma = globalParaPrisma.prisma ?? new PrismaClient(opciones);

// Aviso de queries lentas en desarrollo. 100ms es el umbral que usamos:
// más que eso, en una app con mapa, se nota.
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (evento) => {
    if (evento.duration > 100) {
      console.warn(
        `🐌 Query lenta (${evento.duration}ms): ${evento.query.slice(0, 120)}...`
      );
    }
  });
}

// En desarrollo la guardamos en globalThis para sobrevivir a las recargas.
if (process.env.NODE_ENV !== 'production') {
  globalParaPrisma.prisma = prisma;
}

export default prisma;
