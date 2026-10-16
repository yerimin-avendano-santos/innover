// ========================================
// 📬 CONTROLADOR DE CONTACTOS (Leads del CRM)
// ========================================
// Este es el corazón del modelo B2B del startup.
//
// Cuando alguien escribe sobre una propiedad, se crea un Lead. El agente
// (o el dueño) lo ve en su panel y lo gestiona: NUEVO → EN_PROCESO → CERRADO.
//
// Por qué los campos de contacto están "congelados" en el Lead:
// si el cliente actualiza su perfil o se borra su cuenta, el agente
// necesita poder llamarle igual. El Lead guarda una foto de los datos
// tal como estaban el día que escribió.

// 💡 El "créditos de contacto" del modelo de negocio entra por aquí:
// el agente ve leads limitados por mes según su suscripción. Ese conteo
// se conectará a la tabla de suscripciones cuando exista.

import prisma from '../config/db.js';
import {
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorValidacion,
} from '../utils/errores.js';

// ========================================
// [CREATE] Crear un lead
// ========================================
export const crearContacto = async (req, res) => {
  const { propiedad_id, mensaje, telefono } = req.body;
  const clienteId = req.usuario.id;   // 👈 del token, nunca del body

  const propiedad = await prisma.propiedad.findUnique({
    where: { id: propiedad_id },
    select: {
      id: true,
      titulo: true,
      estado: true,
      usuario_id: true,
      usuario: { select: { rol: true } },
    },
  });

  if (!propiedad) throw new ErrorNoEncontrado('La propiedad');

  if (propiedad.estado !== 'PUBLICADA') {
    throw new ErrorProhibido('Esta propiedad no está disponible para contacto.');
  }

  // Una persona no se escribe a sí misma.
  if (propiedad.usuario_id === clienteId) {
    throw new ErrorValidacion([
      { campo: 'propiedad_id', mensaje: 'Esta propiedad es tuya' },
    ]);
  }

  // Cortafuegos de spam: si ya escribió 3 veces por la misma propiedad
  // en las últimas 24h, no tiene sentido crear un cuarto lead.
  const recientes = await prisma.contacto.count({
    where: {
      propiedad_id: propiedad.id,
      cliente_id: clienteId,
      fecha_creacion: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (recientes >= 3) {
    throw new ErrorValidacion([
      {
        campo: 'mensaje',
        mensaje: 'Ya te comunicaste con este propietario varias veces. Te responderá pronto.',
      },
    ]);
  }

  // Congelar los datos de contacto del cliente en este momento.
  const cliente = await prisma.usuario.findUnique({
    where: { id: clienteId },
    select: { email: true, telefono: true },
  });

  /**
   * A quién le llega el lead:
   *   - Si el dueño es AGENTE → es su lead (rol "AgenteContactos").
   *   - Si el dueño es PROPIETARIO o CLIENTE → es un lead directo
   *     (rol "PropietarioContactos"), sin intermediario.
   *
   * Así el mismo modelo sirve para el B2B y para el propietario directo,
   * que son los dos lados del negocio.
   */
  const esAgente = propiedad.usuario.rol === 'AGENTE';

  const contacto = await prisma.contacto.create({
    data: {
      propiedad_id: propiedad.id,
      cliente_id: clienteId,
      agente_id: esAgente ? propiedad.usuario_id : null,
      propietario_id: esAgente ? null : propiedad.usuario_id,
      mensaje: mensaje.trim(),
      email_contacto: cliente.email,
      telefono_contacto: telefono || cliente.telefono || null,
    },
    include: {
      propiedad: { select: { id: true, slug: true, titulo: true } },
    },
  });

  res.status(201).json({
    mensaje:
      esAgente
        ? 'Mensaje enviado. El agente te contactará por correo.'
        : 'Mensaje enviado. El propietario te contactará por correo.',
    contacto: {
      id: contacto.id,
      fecha_creacion: contacto.fecha_creacion,
      propiedad: contacto.propiedad,
    },
  });
};

// ========================================
// [READ] Leads recibidos (agente o propietario)
// ========================================
export const obtenerMisLeads = async (req, res) => {
  const { estado } = req.query;

  // Un mismo endpoint sirve a agentes y propietarios: el filtro se arma
  // según el rol que tenga el usuario, sin preguntar en el frontend.
  const dondeComoAgente = { agente_id: req.usuario.id };
  const dondeComoPropietario = { propietario_id: req.usuario.id };

  const leads = await prisma.contacto.findMany({
    where: {
      OR: [dondeComoAgente, dondeComoPropietario],
      ...(estado && { estado }),
    },
    include: {
      propiedad: {
        select: { id: true, slug: true, titulo: true, precio: true, moneda: true, estado: true },
      },
      // ⛔ El email/teléfono del cliente SOLO se expone aquí, y solo a quien
      // le corresponde el lead. En la lista de propiedades nunca.
      cliente: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha_creacion: 'desc' },
    take: 200,
  });

  // Enriquecemos con los datos congelados de contacto.
  res.json({
    datos: leads.map((lead) => ({
      id: lead.id,
      estado: lead.estado,
      mensaje: lead.mensaje,
      fecha_creacion: lead.fecha_creacion,
      cliente: lead.cliente,
      // Datos de contacto del cliente, según el tipo de lead.
      contacto: {
        email: lead.email_contacto,
        telefono: lead.telefono_contacto,
      },
      propiedad: lead.propiedad,
    })),
  });
};

// ========================================
// [UPDATE] Cambiar el estado de un lead
// ========================================
export const actualizarContacto = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  const lead = await prisma.contacto.findUnique({
    where: { id: Number(id) },
    select: { id: true, agente_id: true, propietario_id: true },
  });

  if (!lead) throw new ErrorNoEncontrado('El contacto');

  // Solo quien es dueño del lead puede moverlo.
  const esSuyo =
    lead.agente_id === req.usuario.id ||
    lead.propietario_id === req.usuario.id ||
    req.usuario.rol === 'ADMIN';

  if (!esSuyo) {
    throw new ErrorProhibido('Este contacto no está asignado a ti.');
  }

  const actualizado = await prisma.contacto.update({
    where: { id: Number(id) },
    data: { estado },
    select: { id: true, estado: true, fecha_actualizacion: true },
  });

  res.json({ mensaje: 'Estado actualizado.', contacto: actualizado });
};

// ========================================
// [EXTRA] Métricas del CRM
// ========================================
// El número de leads es exactamente la métrica que un agente quiere ver
// para justificar su suscripción ("mi herramienta me trajo 40 contactos").

export const obtenerEstadisticasCRM = async (req, res) => {
  const [porEstado, total, propiedadesActivas] = await Promise.all([
    prisma.contacto.groupBy({
      by: ['estado'],
      where: {
        OR: [{ agente_id: req.usuario.id }, { propietario_id: req.usuario.id }],
      },
      _count: { _all: true },
    }),
    prisma.contacto.count({
      where: {
        OR: [{ agente_id: req.usuario.id }, { propietario_id: req.usuario.id }],
      },
    }),
    prisma.propiedad.count({
      where: { usuario_id: req.usuario.id, estado: 'PUBLICADA' },
    }),
  ]);

  const resumen = { NUEVO: 0, EN_PROCESO: 0, CERRADO: 0, DESCARTADO: 0 };
  porEstado.forEach((fila) => {
    resumen[fila.estado] = fila._count._all;
  });

  // Tasa de conversión: cuántos leads terminaron en cierre.
  const tasaCierre =
    total > 0 ? Math.round(((resumen.CERRADO / total) * 100 + Number.EPSILON) * 10) / 10 : 0;

  res.json({
    resumen,
    total,
    tasa_cierre_porcentaje: tasaCierre,
    propiedades_activas: propiedadesActivas,
  });
};
