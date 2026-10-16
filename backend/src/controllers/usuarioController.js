// ========================================
// 👥 CONTROLADOR DE USUARIOS (solo ADMIN)
// ========================================
// ⛔ CAMBIO CRÍTICO DE SEGURIDAD
//
// Antes, estas rutas eran públicas. Eso significaba que:
//
//   PUT /api/usuarios/1  { "rol": "ADMIN" }
//     → cualquiera se autopromovía a administrador con una sola petición.
//
//   DELETE /api/usuarios/1
//     → cualquiera borraba cuentas.
//
//   GET /api/usuarios
//     → cualquiera listaba todos los correos registrados.
//
// Ahora TODAS las rutas exigen token, y las que cambian datos exigen rol
// ADMIN. Un usuario solo puede leer y editar SU propio perfil, y para eso
// usa /api/auth (no esta carpeta).
//
// Recuerda: "autenticado" (saber quién eres) y "autorizado" (tener permiso)
// son cosas distintas. Aquí se requieren las dos.

import prisma from '../config/db.js';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorValidacion,
} from '../utils/errores.js';
import { tienePlanPro } from '../utils/plan.js';

/**
 * Añade `plan_pro_activo` al usuario que sale por la API.
 *
 * 📌 POR QUÉ NO BASTA CON MANDAR `plan` Y `plan_vence`
 *
 * Porque entonces cada consumidor tendría que decidir por su cuenta si el plan
 * vale, y la decisión depende de la FECHA. La versión ingenua
 * (`plan === 'PRO'`) dice que un PRO vencido sigue vigente y el error no
 * aparece hasta que el usuario intenta usar la ventaja y recibe un 403.
 *
 * El veredicto se calcula aquí, una sola vez, con la misma función que usa el
 * candado del servidor (`tienePlanPro`). Los campos crudos siguen viajando para
 * poder MOSTRARLOS ("PRO · venció el 1 de octubre").
 */
const conPlanActivo = (usuario) => ({ ...usuario, plan_pro_activo: tienePlanPro(usuario) });

/** Proyección segura: nunca incluye contrasena_hash. */
const seleccionSegura = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  telefono: true,
  avatar_url: true,
  documento_identidad: true,
  identidad_verificada: true,
  activo: true,
  fecha_creacion: true,
  ultimo_acceso: true,
  // El plan se expone porque el panel de admin lo muestra y lo cambia.
  // Ojo: eso NO significa que se acepte del body en otros endpoints — quien
  // escribe el plan es `actualizarPlan`, y esa ruta exige ser ADMIN.
  plan: true,
  plan_vence: true,
};

// ========================================
// [READ] Listar usuarios (solo ADMIN)
// ========================================
export const obtenerUsuarios = async (req, res) => {
  const { rol, activo, busqueda } = req.query;

  const usuarios = await prisma.usuario.findMany({
    where: {
      ...(rol && { rol }),
      ...(activo !== undefined && { activo: activo === 'true' }),
      ...(busqueda && {
        OR: [
          { nombre: { contains: busqueda, mode: 'insensitive' } },
          { email: { contains: busqueda, mode: 'insensitive' } },
        ],
      }),
    },
    select: {
      ...seleccionSegura,
      _count: { select: { propiedades: true } },
    },
    orderBy: { fecha_creacion: 'desc' },
    take: 100,   // un panel de admin no necesita 100 mil filas
  });

  res.json({
    datos: usuarios.map(({ _count, ...u }) => ({
      ...conPlanActivo(u),
      propiedades: _count.propiedades,
    })),
  });
};

// ========================================
// [READ] Un usuario por ID (solo ADMIN)
// ========================================
export const obtenerUsuarioPorId = async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: Number(req.params.id) },
    select: {
      ...seleccionSegura,
      propiedades: {
        select: { id: true, slug: true, titulo: true, estado: true, precio: true },
        orderBy: { fecha_creacion: 'desc' },
      },
    },
  });

  if (!usuario) throw new ErrorNoEncontrado('El usuario');

  res.json({ usuario: conPlanActivo(usuario) });
};

// ========================================
// [UPDATE] Modificar un usuario (solo ADMIN)
// ========================================
export const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const usuarioId = Number(id);

  const objetivo = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, rol: true },
  });

  if (!objetivo) throw new ErrorNoEncontrado('El usuario');

  /**
   * Protección contra el "error de(admin)".
   *
   * Si un ADMIN se quita a sí mismo el rol ADMIN y era el único, la
   * plataforma se queda sin nadie que la administre. Le avisamos.
   */
  if (objetivo.rol === 'ADMIN' && req.body.rol && req.body.rol !== 'ADMIN') {
    const otrosAdmins = await prisma.usuario.count({
      where: { rol: 'ADMIN', activo: true, id: { not: usuarioId } },
    });

    if (otrosAdmins === 0) {
      throw new ErrorValidacion([
        {
          campo: 'rol',
          mensaje:
            'Eres el único administrador activo. Crea otro antes de quitarte el rol.',
        },
      ]);
    }
  }

  /**
   * Un ADMIN tampoco puede desactivarse a sí mismo por accidente.
   * Si quiere irse, que lo haga otro ADMIN.
   */
  if (usuarioId === req.usuario.id && req.body.activo === false) {
    throw new ErrorProhibido('No puedes desactivar tu propia cuenta.');
  }

  const usuario = await prisma.usuario.update({
    where: { id: usuarioId },
    data: req.body,   // seguro: Zod ya filtró los campos permitidos
    select: seleccionSegura,
  });

  res.json({ mensaje: 'Usuario actualizado.', usuario });
};

// ========================================
// [DELETE] Desactivar un usuario (baja lógica)
// ========================================
// ⛔ NO se borra la fila.
//
// Si borramos el registro, sus propiedades y su historial de leads quedan
// huérfanos o se borran en cascada, y perdemos datos del negocio.
// En su lugar lo desactivamos: deja de poder entrar, pero su historial vive.

export const eliminarUsuario = async (req, res) => {
  const usuarioId = Number(req.params.id);

  if (usuarioId === req.usuario.id) {
    throw new ErrorProhibido('No puedes desactivar tu propia cuenta.');
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true },
  });

  if (!usuario) throw new ErrorNoEncontrado('El usuario');

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { activo: false },
  });

  res.json({
    mensaje:
      'Usuario desactivado. Sus propiedades siguen visibles; ya no puede iniciar sesión.',
  });
};

// ========================================
// 🧾 COLA DE SOLICITUDES DE AGENTE (solo ADMIN)
// ========================================

/**
 * Lista las solicitudes de agente para la cola del panel.
 *
 * Por defecto devuelve las PENDIENTES, que es lo único que el admin necesita
 * ver al entrar. `?estado=APROBADA` permite consultar el historial.
 */
export const obtenerSolicitudesAgente = async (req, res) => {
  const { estado = 'PENDIENTE' } = req.query;

  const solicitudes = await prisma.solicitudAgente.findMany({
    where: { estado },
    include: {
      // Se incluye el usuario para que el admin vea de quién es la solicitud
      // sin tener que cruzar el id a mano. NO se incluye contrasena_hash.
      usuario: {
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          rol: true,
          identidad_verificada: true,
          fecha_creacion: true,
        },
      },
      revisor: { select: { id: true, nombre: true } },
    },
    // De la más vieja a la más nueva: una cola se atiende por turno, no por
    // novedad. Si se ordenara al revés, las solicitudes antiguas nunca se
    // revisarían.
    orderBy: { fecha_creacion: 'asc' },
    take: 100,
  });

  res.json({ datos: solicitudes });
};

/**
 * Aprueba o rechaza una solicitud.
 *
 * ⛔ SOLO UN ADMIN. Va detrás de `verificarToken` + `verificarRol('ADMIN')`.
 *
 * Aprobar cambia el rol del usuario a AGENTE. Es la ÚNICA vía legítima para
 * llegar a AGENTE además de tocar la base a mano — junto con el panel, que
 * ya existía. El registro nunca lo permite.
 */
export const resolverSolicitudAgente = async (req, res) => {
  const solicitudId = Number(req.params.id);
  const { estado, motivo_rechazo: motivoRechazo } = req.body;

  const solicitud = await prisma.solicitudAgente.findUnique({
    where: { id: solicitudId },
    include: { usuario: { select: { id: true, rol: true, nombre: true } } },
  });

  if (!solicitud) throw new ErrorNoEncontrado('La solicitud');

  /**
   * ⛔ NO SE PUEDE RESOLVER DOS VECES.
   *
   * Sin esto, un admin podría aprobar una solicitud y otro rechazarla después:
   * la fila quedaría RECHAZADA mientras el usuario ya es AGENTE, y el historial
   * diría una cosa mientras la realidad dice otra. Una decisión se toma una vez.
   */
  if (solicitud.estado !== 'PENDIENTE') {
    throw new ErrorConflicto(
      `Esta solicitud ya fue ${solicitud.estado === 'APROBADA' ? 'aprobada' : 'rechazada'}.`
    );
  }

  /**
   * Rechazar SIN motivo deja al usuario sin saber qué corregir: vuelve a
   * mandar exactamente lo mismo y el admin rechaza otra vez. El motivo es
   * parte del dato, no un extra.
   */
  if (estado === 'RECHAZADA' && !motivoRechazo?.trim()) {
    throw new ErrorValidacion([
      { campo: 'motivo_rechazo', mensaje: 'Explica por qué se rechaza la solicitud.' },
    ]);
  }

  const aprobada = estado === 'APROBADA';

  /**
   * ⚠️ UN ADMIN NO SE DEGRADA AL APROBAR.
   *
   * Si por lo que sea existe una solicitud de alguien que ya es ADMIN, aprobarla
   * le cambiaría el rol a AGENTE y la plataforma perdería un administrador
   * (o se quedaría sin ninguno, si era el único). El `rol: 'AGENTE'` solo se
   * aplica a quien todavía no administra.
   */
  const debeAscender = aprobada && solicitud.usuario.rol !== 'ADMIN';

  const [resuelta] = await prisma.$transaction([
    prisma.solicitudAgente.update({
      where: { id: solicitudId },
      data: {
        estado,
        motivo_rechazo: aprobada ? null : motivoRechazo.trim(),
        revisor_id: req.usuario.id,
        fecha_resolucion: new Date(),
      },
      include: {
        usuario: { select: { id: true, nombre: true, email: true, rol: true } },
        revisor: { select: { id: true, nombre: true } },
      },
    }),
    ...(debeAscender
      ? [
          prisma.usuario.update({
            where: { id: solicitud.usuario_id },
            data: { rol: 'AGENTE', identidad_verificada: true },
            select: { id: true },
          }),
        ]
      : []),
  ]);

  res.json({
    mensaje: aprobada
      ? `${solicitud.usuario.nombre} ahora es agente.`
      : 'Solicitud rechazada.',
    solicitud: resuelta,
  });
};

// ========================================
// 💳 CAMBIAR EL PLAN (solo ADMIN)
// ========================================
// ⛔ El plan NUNCA se acepta del propio usuario. Igual que el rol: si el
// usuario pudiera escribirlo, el producto de pago sería gratuito.

export const actualizarPlan = async (req, res) => {
  const usuarioId = Number(req.params.id);
  const { plan, plan_vence: planVence } = req.body;

  const objetivo = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nombre: true, rol: true },
  });

  if (!objetivo) throw new ErrorNoEncontrado('El usuario');

  // El schema ya verificó que la fecha es válida; aquí solo se convierte.
  // `null` se conserva tal cual porque significa "sin vencimiento".
  const vence = planVence ? new Date(planVence) : null;

  const usuario = await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      plan,
      // Al volver a GRATIS se limpia el vencimiento: dejar una fecha colgando
      // haría que un futuro cambio a PRO heredara la fecha vieja — y si ya
      // pasó, el PRO nacería vencido.
      plan_vence: plan === 'PRO' ? vence : null,
    },
    select: seleccionSegura,
  });

  // El destaque va incluido en el plan. Al perderlo, las propiedades de ese
  // usuario dejan de ir destacadas.
  const destacadosRetirados = plan === 'GRATIS'
    ? await sincronizarDestacados(usuarioId)
    : 0;

  res.json({
    mensaje:
      plan === 'PRO'
        ? `Plan PRO activado para ${objetivo.nombre}.`
        : `Plan GRATIS para ${objetivo.nombre}.` +
          (destacadosRetirados > 0
            ? ` Se retiró el destaque de ${destacadosRetirados} propiedad${destacadosRetirados === 1 ? '' : 'es'}.`
            : ''),
    usuario: conPlanActivo(usuario),
    destacados_retirados: destacadosRetirados,
  });
};

/**
 * Pone en coherencia los destaques de un usuario con su plan actual.
 *
 * 📌 EL PROBLEMA QUE RESUELVE
 *
 * `destacado` es una COLUMNA GUARDADA, no algo que se calcule al leer. Si un
 * usuario con plan PRO destaca sus tres propiedades y mañana vuelve a GRATIS,
 * esas tres siguen saliendo por encima de las demás para siempre. El plan
 * venció, pero las ventajas se quedaron.
 *
 * La alternativa sería no guardar `destacado` y derivarlo en cada consulta
 * (`WHERE usuario.plan = 'PRO' AND propiedad.destacado`). Es más elegante, pero
 * obliga a un JOIN con Usuario en la consulta más caliente del sistema —la del
 * buscador— y complica el índice `[destacado, fecha_creacion]`.
 *
 * Se eligió guardar y sincronizar.
 *
 * ⚠️ LO QUE ESTO CUESTA (decisión consciente)
 *
 * Al bajar a GRATIS se quitan TODOS los destaques del usuario, incluidos los
 * que un ADMIN hubiera puesto a mano en su momento. No hay forma de
 * distinguirlos porque la tabla no guarda quién puso cada destaque. Es el
 * precio de un modelo simple; si algún día molesta, la solución es una columna
 * `destacado_origen` ('PLAN' | 'ADMIN') y filtrar por ella.
 *
 * @returns {Promise<number>} cuántas propiedades dejaron de estar destacadas
 */
export async function sincronizarDestacados(usuarioId) {
  const { count } = await prisma.propiedad.updateMany({
    where: { usuario_id: usuarioId, destacado: true },
    data: { destacado: false },
  });

  return count;
}
