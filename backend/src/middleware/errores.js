// ========================================
// 🧯 MANEJADOR CENTRAL DE ERRORES
// ========================================
// Un solo lugar donde se decide qué se responde cuando algo falla.
//
// Sin esto, cada controlador tiene su propio try/catch y es fácil olvidar
// uno. Y lo peor: un error no controlado en Express 5 se convierte en un
// HTML con el stack trace, que en producción filtra rutas de archivos
// y estructura interna de la base de datos.

import { Prisma } from '@prisma/client';
import config from '../config/env.js';
import AppError from '../utils/errores.js';

/**
 * 404: ruta no encontrada.
 * Va DESPUÉS de todas las rutas pero antes del manejador de errores.
 */
export function noEncontrado(req, res, next) {
  next(new AppError(`La ruta ${req.method} ${req.originalUrl} no existe.`, 404, 'RUTA_NO_ENCONTRADA'));
}

/**
 * Manejador de errores. Express lo reconoce por sus 4 parámetros.
 *
 * ⛔ IMPORTANTE: si le quitas un parámetro, Express deja de tratarlo como
 * manejador de errores y se rompe todo el manejo de excepciones.
 */
// eslint-disable-next-line no-unused-vars
export function manejadorErrores(error, req, res, next) {
  let estado = 500;
  let codigo = 'ERROR_INTERNO';
  let mensaje = 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  let detalles = undefined;

  // --- Errores que NOSOTROS lanzamos a propósito ---
  if (error instanceof AppError) {
    estado = error.estado;
    codigo = error.codigo;
    mensaje = error.message;
    detalles = error.detalles;
  }

  // --- Errores que PRISMA produce ---
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // P2002: violaste una restricción de unicidad (email o slug repetido).
      case 'P2002': {
        estado = 409;
        codigo = 'DUPLICADO';
        const campo = error.meta?.target?.join(', ') || 'valor';
        mensaje =
          campo.includes('email')
            ? 'Ese correo ya está registrado.'
            : `Ya existe un registro con ese ${campo}.`;
        break;
      }
      // P2025: el registro que intentas tocar no existe.
      case 'P2025':
        estado = 404;
        codigo = 'NO_ENCONTRADO';
        mensaje = 'El registro que buscas no existe.';
        break;
      // P2003: violaste una llave foránea.
      case 'P2003':
        estado = 409;
        codigo = 'REFERENCIA_INVALIDA';
        mensaje = 'No se puede completar la operación: hay registros relacionados.';
        break;
      default:
        estado = 400;
        codigo = `DB_${error.code}`;
        mensaje = 'No pudimos guardar los cambios.';
    }
  }

  // --- Error de validación de Zod que se escapó del middleware ---
  else if (error.name === 'ZodError') {
    estado = 400;
    codigo = 'VALIDACION';
    mensaje = 'Revisa los datos enviados.';
    // Zod 4 usa `issues`; Zod 3 usaba `errors`. Aceptamos ambos.
    const lista = error.issues || error.errors || [];
    detalles = lista.map((issue) => ({
      campo: issue.path?.join('.') || '(raíz)',
      mensaje: issue.message,
    }));
  }

  // --- JSON mal formado: { "nombre": } ---
  else if (error instanceof SyntaxError && 'body' in error) {
    estado = 400;
    codigo = 'JSON_INVALIDO';
    mensaje = 'El cuerpo de la petición no es JSON válido.';
  }

  // --- Payload demasiado grande (subida de imágenes) ---
  else if (error.type === 'entity.too.large') {
    estado = 413;
    codigo = 'DEMASIADO_GRANDE';
    mensaje = 'La petición es demasiado grande.';
  }

  // --- Origen bloqueado por CORS ---
  // No es un fallo del servidor: es una petición de un sitio que no
  // está en la lista. Se responde 403 sin Filling el log de errores.
  else if (error.message === 'Origen no permitido por CORS') {
    estado = 403;
    codigo = 'CORS_BLOQUEADO';
    mensaje = 'Este origen no tiene permiso para usar la API.';
  }

  // --- Registro obligatorio ---
  const esConocido = error instanceof AppError || error instanceof Prisma.PrismaClientKnownRequestError;

  // --- Logging ---
  // Los errores 4xx son culpa del usuario (un email mal escrito, un 404).
  // No vale la pena llenar los logs con ellos.
  // Los 5xx son bugs NUESTROS: hay que verlos siempre.
  if (!esConocido || estado >= 500) {
    console.error('\x1b[31m✖ Error no controlado\x1b[0m', {
      metodo: req.method,
      ruta: req.originalUrl,
      mensaje: error.message,
      stack: config.esProduccion ? undefined : error.stack,
    });
  }

  // --- Respuesta ---
  const respuesta = {
    error: mensaje,
    codigo,
  };

  if (detalles) respuesta.detalles = detalles;

  // En desarrollo mostramos el stack para poder depurar.
  if (!config.esProduccion && !esConocido) {
    respuesta.debug = error.message;
  }

  res.status(estado).json(respuesta);
}
