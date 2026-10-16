// ========================================
// 🛡️ ERRORES DE APLICACIÓN
// ========================================
// Una clase de error propia permite distinguir "el usuario hizo algo mal"
// de "se cayó el servidor".
//
// Antes de esto, todo error terminaba como un 500 genérico, y un typo en un
// campo Mandatory se veía igual que una base de datos caída. Con esta clase,
// el manejador central sabe qué código HTTP y qué mensaje enviar.

class AppError extends Error {
  /**
   * @param {string} mensaje  Mensaje que verá el usuario. Sin datos sensibles.
   * @param {number} estado   Código HTTP (400, 401, 403, 404, 409, 422...).
   * @param {string} codigo   Identificador interno, útil para el frontend
   *                          y para buscar el error en los logs.
   */
  constructor(mensaje, estado = 500, codigo = 'ERROR_INTERNO') {
    super(mensaje);
    this.name = 'AppError';
    this.estado = estado;
    this.codigo = codigo;
    this.esErrorEsperado = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Errores de validación del esquema de entrada.
export class ErrorValidacion extends AppError {
  constructor(detalles) {
    super('Revisa los datos enviados.', 400, 'VALIDACION');
    // `detalles` es un array de { campo, mensaje } que el frontend puede
    // mostrar pegado al input correspondiente.
    this.detalles = detalles;
  }
}

export class ErrorNoAutorizado extends AppError {
  constructor(mensaje = 'Necesitas iniciar sesión para hacer esto.') {
    super(mensaje, 401, 'NO_AUTORIZADO');
  }
}

export class ErrorProhibido extends AppError {
  constructor(mensaje = 'No tienes permiso para realizar esta acción.') {
    super(mensaje, 403, 'PROHIBIDO');
  }
}

export class ErrorNoEncontrado extends AppError {
  constructor(recurso = 'El recurso') {
    super(`${recurso} no fue encontrado.`, 404, 'NO_ENCONTRADO');
  }
}

export class ErrorConflicto extends AppError {
  constructor(mensaje) {
    super(mensaje, 409, 'CONFLICTO');
  }
}

export default AppError;
