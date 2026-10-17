// ========================================
// 🍪 LOS NOMBRES DE LAS COOKIES DE SESIÓN
// ========================================
// Viven en un archivo aparte por un motivo pequeño y muy real: la sesión se
// apoya en DOS cookies, y sus nombres se leen en dos sitios que no se ven el
// uno al otro — el controlador, que las escribe, y el middleware, que las lee.
//
// Con el nombre escrito a mano en cada sitio, renombrar una es un fallo
// silencioso, y de los peores: el middleware buscaría una cookie que ya no
// existe, dejaría pasar la petición SIN usuario, y la interfaz diría "inicia
// sesión" mientras la renovación funciona perfectamente (esa usa el otro
// nombre, el del controlador). Nada da error, nada avisa, y el síntoma —"me
// echa pero me deja renovar"— no apunta a ninguna parte.
//
// (El frontend no necesita estos nombres: no puede leer las cookies. Es
// httpOnly justamente para eso.)

/** El pase corto: el JWT firmado que viaja en cada petición. */
export const COOKIE_SESION = 'innover_token';

/** El token de renovación: opaco, revocable, y solo para `/api/auth`. */
export const COOKIE_RENOVACION = 'innover_renovacion';
