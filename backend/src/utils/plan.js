// ========================================
// 💳 PLAN COMERCIAL DEL USUARIO
// ========================================
// El plan es un eje DISTINTO del rol.
//
//   rol  → qué hace alguien en la plataforma (compra, vende, intermedia)
//   plan → qué puede pagar
//
// Un PROPIETARIO con plan PRO tiene recorrido 3D igual que un AGENTE con plan
// PRO. Si el plan fuera un rol habría que inventar `AGENTE_PRO`,
// `PROPIETARIO_PRO`... y cada combinación nueva multiplicaría los valores.
//
// 📌 POR QUÉ ESTO ES UNA FUNCIÓN Y NO UNA COMPARACIÓN SUELTA
//
// La regla tiene un caso que se olvida con facilidad: el plan VENCE. Escribir
// `usuario.plan === 'PRO'` por el código reparte esa lógica en cada punto de
// decisión, y basta con que uno se olvide de la fecha para que alguien que
// dejó de pagar conserve las ventajas para siempre.
//
// Una sola función, un solo sitio donde equivocarse (y donde arreglarlo).

/**
 * ¿El usuario tiene el plan PRO vigente AHORA?
 *
 * @param {{ plan?: string, plan_vence?: Date|string|null } | null | undefined} usuario
 * @returns {boolean}
 */
export function tienePlanPro(usuario) {
  if (!usuario) return false;
  if (usuario.plan !== 'PRO') return false;

  /**
   * ⛔ AUSENTE (`undefined`) NO ES LO MISMO QUE VACÍO (`null`), Y AQUÍ SE
   *    DECIDE EN QUÉ DIRECCIÓN FALLA.
   *
   *   - `null`  → la consulta pidió la columna y la base tiene NULL. Es una
   *               cortesía o una cuenta interna: no vence. Vale `true`.
   *   - `undefined` → la consulta NO pidió la columna. Es un error de
   *               programación, no un dato.
   *
   * Si el caso `undefined` se tratara como "no vence" (que es lo que hacía
   * antes), el fallo es **abierto y mudo**: a alguien se le olvida añadir
   * `plan_vence: true` a un `select` nuevo, el usuario tiene el PRO vencido
   * desde hace meses, y sigue usando el recorrido 3D sin que nada avise. Es un
   * agujero en el modelo de cobro que no aparece en ningún log.
   *
   * Falla en cerrado y el síntoma es un 403 visible para un cliente que sí
   * paga: molesto, se reporta y se arregla en cinco minutos. Entre un fallo
   * silencioso que regala el producto y uno ruidoso que lo cobra de más, se
   * elige el ruidoso.
   *
   * Se comprobó que los tres llamadores actuales (`verificarToken`,
   * `usuarioPublico` y la proyección del panel de admin) piden la columna, así
   * que este caso no se da hoy.
   */
  if (usuario.plan_vence === undefined) return false;

  // Sin fecha de vencimiento explícita = no vence.
  if (usuario.plan_vence === null) return true;

  // Prisma devuelve Date; si algún día llega un string (JSON, query cruda),
  // `new Date()` lo normaliza. Comparar un string contra un Date en JS no
  // lanza error: da `false` en silencio, que es la peor forma de fallar.
  const vence = usuario.plan_vence instanceof Date
    ? usuario.plan_vence
    : new Date(usuario.plan_vence);

  if (Number.isNaN(vence.getTime())) return false;

  return vence > new Date();
}

/**
 * Motivo, en texto, de por qué NO tiene PRO. Se usa para el mensaje de error.
 *
 * Decir "necesitas el plan PRO" a alguien cuyo plan venció ayer es una mala
 * respuesta: sabe que lo tenía, y el mensaje no le explica nada.
 */
export function motivoSinPro(usuario) {
  if (!usuario || usuario.plan !== 'PRO') {
    return 'Necesitas el plan PRO para usar esta función.';
  }
  return 'Tu plan PRO venció. Renuévalo para volver a usar esta función.';
}

export default { tienePlanPro, motivoSinPro };
