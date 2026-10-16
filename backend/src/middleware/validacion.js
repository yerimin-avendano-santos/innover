// ========================================
// ✅ MIDDLEWARE DE VALIDACIÓN
// ========================================
// ¿Por qué existe esto?
//
// Sin validación, estas peticiones pasan y rompen cosas:
//
//   POST /api/propiedades  { "precio": "mucho" }
//     → Prisma explota con un error que nadie entiende.
//
//   POST /api/auth/registro  { "email": "no-es-un-email", "contrasena": "1" }
//     → Se crea una cuenta con contraseña de un carácter.
//
//   GET /api/propiedades/abc
//     → parseInt("abc") = NaN, Prisma busca NaN y falla.
//
// Con Zod definimos la "forma" que debe tener cada dato ANTES de tocar la
// base de datos. Si no cumple, el usuario recibe un 400 con el detalle
// exacto de qué campo falló.
//
// La idea clave: validación en el BORDE (la puerta de entrada).
// Dentro del código ya asumimos que los datos son correctos.

import { ZodError } from 'zod';
import { ErrorValidacion } from '../utils/errores.js';

/**
 * Crea un middleware de validación a partir de un esquema de Zod.
 *
 * @param {import('zod').ZodTypeAny} esquema
 * @param {'body'|'query'|'params'} fuente  De dónde se leen los datos.
 *
 * @example
 *   router.post('/',
 *     validar(crearPropiedadSchema, 'body'),
 *     crearPropiedad
 *   );
 */
export function validar(esquema, fuente = 'body') {
  return (req, res, next) => {
    try {
      // .parse() lanza ZodError si los datos no cumplen el esquema.
      // El resultado viene limpio: sin campos desconocidos, con los
      // tipos convertidos y los defaults aplicados.
      const datosValidados = esquema.parse(req[fuente]);

      /**
       * ⚠️ POR QUÉ `defineProperty` Y NO `req[fuente] = ...`
       *
       * En Express 5, `req.query` es un GETTER definido en el prototipo:
       *
       *     Object.getOwnPropertyDescriptor(Request.prototype, 'query')
       *     // → { get: [Function], set: undefined }
       *
       * Hacer `req.query = datos` lanza en tiempo de ejecución:
       *     TypeError: Cannot set property query of #<IncomingMessage>
       *                which has only a getter
       *
       * La solución es crear una PROPIEDAD PROPIA en la instancia, que
       * tiene prioridad sobre la del prototipo. Así el resto del código
       * sigue usando `req.query` sin enterarse del cambio.
       *
       * 💡 De paso, esto documenta algo importante de Zod: los campos
       * desconocidos se DESCARTAN en silencio (no dan error). Eso es
       * exactamente lo que queremos contra mass assignment: un cliente
       * que mande `usuario_id` no rompe nada, simplemente se ignora.
       * Para que sí dieran error usaríamos `.strict()`.
       */
      Object.defineProperty(req, fuente, {
        value: datosValidados,
        writable: true,
        configurable: true,
        enumerable: true,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Aplanamos los errores de Zod al formato que consume el frontend.
        //
        // 📌 En Zod 4 la lista se llama `issues`, no `errors`.
        // En Zod 3 era `error.errors`. Es un detalle que rompe en silencio
        // si no lo revisas, por eso lo dejamos anotado.
        const lista = error.issues || error.errors || [];

        const detalles = lista.map((issue) => ({
          campo: issue.path.join('.') || '(raíz)',
          mensaje: issue.message,
        }));

        return next(new ErrorValidacion(detalles));
      }

      next(error);
    }
  };
}

export default validar;
