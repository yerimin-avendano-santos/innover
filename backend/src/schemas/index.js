// ========================================
// 📐 ESQUEMAS DE VALIDACIÓN
// ========================================
// Cada endpoint declara qué datos espera y con qué reglas.
// Es la "contrase" de la API: lo que no cumple la forma, ni entra.
//
// Ver src/middleware/validacion.js para ver cómo se usa.

import { z } from 'zod';

// ========================================
// REGLAS REUTILIZABLES
// ========================================

/** Email: debe verse como un email. Zod valida el formato, no que exista. */
const email = z
  .string()
  .trim()
  .min(1, 'El correo es obligatorio')
  .email('Ingresa un correo válido, ej. ana@correo.com')
  .max(255, 'El correo es demasiado largo')
  // Se normaliza a minúsculas para que Ana@x.com y ana@x.com sean la misma cuenta.
  .transform((v) => v.toLowerCase());

/**
 * Contraseña.
 * 8 caracteres es el mínimo razonable hoy (guía NIST: longitud sobre complejidad).
 * Se permiten espacios porque "mi contraseña" es más fácil de recordar que "M!c4rr@".
 */
const contrasena = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña es demasiado larga')
  // bcrypt trunca silenciosamente a 72 bytes: mejor rechazarlo que
  // darle al usuario la falsa sensación de que su contraseña es más larga.
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, {
    message: 'La contraseña es demasiado larga (máximo 72 bytes)',
  });

/** Teléfono peruano: 9 dígitos, opcionalmente con +51. */
const telefono = z
  .string()
  .trim()
  .regex(/^(\+?51\s*)?9\d{8}$/, 'Ingresa un celular peruano válido (9 dígitos)');

/** URL: solo http/https. Bloquea javascript: y data: (vectores de XSS). */
const url = z
  .string()
  .trim()
  .url('Debe ser una URL válida')
  .refine((v) => /^https?:\/\//i.test(v), {
    message: 'Solo se permiten URLs que empiezan con http:// o https://',
  });

/** IDs que vienen de la URL: siempre enteros positivos. */
const id = z.coerce
  .number({ invalid_type_error: 'El identificador debe ser un número' })
  .int('El identificador debe ser un número entero')
  .positive('El identificador debe ser mayor que cero');

// ========================================
// AUTH
// ========================================

export const registroSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre es demasiado largo'),

  email,

  contrasena,

  telefono: telefono.optional(),

  /**
   * ⛔ NOTA DE SEGURIDAD CRÍTICA
   *
   * El rol NO se acepta desde el registro público.
   *
   * Antes, el frontend mandaba `rol` y el backend lo obedecía:
   *   POST /api/auth/registro { "rol": "ADMIN" }
   * Eso convertía el registro en un ascensor a administrador.
   *
   * Ahora todas las cuentas nacen como CLIENTE.
   * Para ser AGENTE o PROPIETARIO hay un endpoint aparte (/api/auth/solicitar-agente)
   * que deja la solicitud pendiente de aprobación de un ADMIN.
   * ADMIN directamente no se puede pedir por API.
   */
});

export const loginSchema = z.object({
  email,
  contrasena: z.string().min(1, 'Ingresa tu contraseña'),
});

export const solicitarAgenteSchema = z.object({
  // Nota: RUC (Registro Único de Contribuyentes) o DNI del agente.
  documento: z
    .string()
    .trim()
    .min(8, 'Ingresa tu DNI o RUC')
    .max(20, 'Documento demasiado largo'),
  mensaje: z
    .string()
    .trim()
    .max(500, 'El mensaje es demasiado largo')
    .optional(),
});

export const actualizarPerfilSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120)
    .optional(),
  telefono: telefono.optional().or(z.literal('').transform(() => undefined)),
  avatar_url: url.optional().or(z.literal('').transform(() => undefined)),
  contrasenaActual: contrasena.optional(),
  nuevaContrasena: contrasena.optional(),
}).refine(
  // Si cambian la contraseña, tienen que confirmar la actual.
  // Sin esto, un token robado permite cambiar la clave y echar al dueño.
  (datos) => !datos.nuevaContrasena || !!datos.contrasenaActual,
  {
    message: 'Para cambiar tu contraseña necesitas confirmar la actual',
    path: ['contrasenaActual'],
  }
);

// ========================================
// PROPIEDADES
// ========================================

/**
 * 📌 POR QUÉ ESTOS CAMPOS ESTÁN SUELTOS
 *
 * En Zod 4, un esquema con `.refine()` deja de ser un objeto plano, y
 * `.partial()` sobre eso revienta con:
 *
 *     Error: .partial() cannot be used on object schemas containing refinements
 *
 * La solución: definir los campos UNA vez en un objeto simple, y componer
 * el esquema de creación y el de actualización por separado.
 *
 * ⚠️ Y un detalle sutil que aquí importa mucho: `.partial()` conserva
 * los `.default()`. Si al actualizar usáramos `crearSchema.partial()`, el
 * campo ausente `tipo` se rellenaría con 'VENTA' y pisaría el tipo real
 * de la propiedad. Por eso "partial" y "con defaults" no se mezclan,
 * y aquí los campos comunes van SIN default.
 */
const camposPropiedad = {
  titulo: z
    .string()
    .trim()
    .min(10, 'El título debe tener al menos 10 caracteres')
    .max(150, 'El título es demasiado largo'),

  descripcion: z
    .string()
    .trim()
    .min(30, 'Describe la propiedad con al menos 30 caracteres')
    .max(5000, 'La descripción es demasiado larga'),

  precio: z.coerce
    .number({ invalid_type_error: 'El precio debe ser un número' })
    .positive('El precio debe ser mayor que cero')
    .max(1_000_000_000, 'El precio es demasiado alto'),

  tipo: z.enum(['VENTA', 'ALQUILER']),

  area_m2: z.coerce
    .number()
    .positive('El área debe ser mayor que cero')
    .max(1_000_000)
    .optional(),

  distrito_id: id.optional(),
  direccion: z.string().trim().max(300).optional(),

  latitud: z.coerce
    .number()
    .min(-90, 'Latitud inválida')
    .max(90, 'Latitud inválida')
    .optional(),
  longitud: z.coerce
    .number()
    .min(-180, 'Longitud inválida')
    .max(180, 'Longitud inválida')
    .optional(),

  /**
   * URL del recorrido 3D embebido.
   *
   * 📌 POR QUÉ TIENE TRES CASOS Y NO DOS
   *
   * `''` y `null` significan "quitar el recorrido". AUSENTE significa "no
   * toques este campo". Si se confunden, pasa una de dos cosas, y las dos son
   * bugs:
   *
   *   - Si `''` se convierte en `undefined`, es indistinguible de "no lo mandé"
   *     y el usuario NO PUEDE BORRAR un recorrido 3D. Ese era el bug: el
   *     formulario mandaba `''` al vaciar el campo y el valor se quedaba como
   *     estaba, sin error ni aviso.
   *   - Si lo ausente se tratara como "borrar", cualquier edición del precio
   *     borraría el recorrido de paso.
   *
   * Antes había un `.transform(() => undefined)` que causaba exactamente el
   * primer caso.
   *
   * ⚠️ `url` solo acepta http/https, y eso importa aquí más que en ningún otro
   * campo: este valor se renderiza en el `src` de un iframe. Aunque los
   * navegadores modernos tratan `javascript:` en un iframe como inerte, no hay
   * motivo para dejar pasar el vector.
   */
  tour_3d_url: z.union([url, z.literal('').transform(() => null), z.null()]).optional(),

  imagenes: z.array(url).max(20, 'Máximo 20 imágenes'),

  /**
   * Destaque pagado. Va en los campos COMUNES (no solo en el de actualización)
   * porque también se puede marcar al crear: un agente con plan PRO publica su
   * aviso y quiere que salga destacado desde el primer momento. Si solo se
   * aceptara al editar, mandar `destacado: true` al crear se descartaría en
   * silencio — sin error y sin efecto, que es la peor combinación posible.
   *
   * Quién puede escribirlo NO se decide aquí: lo decide el controlador, que es
   * el único que sabe si quien pide es ADMIN o tiene el plan PRO vigente.
   */
  destacado: z.boolean().optional(),

  // Conteos. Van aquí (y no solo en el create) porque también se pueden
  // actualizar. 0 significa "no aplica": un terreno no tiene baños.
  habitaciones: z.coerce.number().int().min(0).max(50),
  banos: z.coerce.number().int().min(0).max(50),
  parkederos: z.coerce.number().int().min(0).max(50),
};

// [CREATE] Los obligatorios, y defaults solo para lo que tiene un valor
// por defecto razonable.
export const crearPropiedadSchema = z
  .object({
    ...camposPropiedad,
    moneda: z.enum(['PEN', 'USD']).default('PEN'),
    tipo_inmueble: z
      .enum(['DEPARTAMENTO', 'CASA', 'TERRENO', 'OFICINA', 'LOCAL_COMERCIAL', 'OTRO'])
      .default('DEPARTAMENTO'),
    estado: z.enum(['BORRADOR', 'PUBLICADA']).default('PUBLICADA'),
    habitaciones: camposPropiedad.habitaciones.default(0),
    banos: camposPropiedad.banos.default(0),
    parkederos: camposPropiedad.parkederos.default(0),
    imagenes: camposPropiedad.imagenes.default([]),
  })
  .refine(
    // Si tiene coordenadas, tienen que venir las dos.
    // Con una sola, el punto en el mapa queda en el golfo de Guinea.
    (datos) => (datos.latitud === undefined) === (datos.longitud === undefined),
    {
      message: 'Si envías coordenadas, envía latitud y longitud juntas',
      path: ['latitud'],
    }
  );

// [UPDATE] Todo opcional. Un campo ausente queda `undefined`, y en Prisma
// eso significa "no toques esta columna". Nunca inventes defaults aquí.
export const actualizarPropiedadSchema = z
  .object(camposPropiedad)
  .partial()
  .extend({
    // Al actualizar sí se puede marcar como vendida o retirada.
    estado: z
      .enum(['BORRADOR', 'PUBLICADA', 'VENDIDA', 'ALQUILADA', 'RETIRADA'])
      .optional(),
  })
  // `destacado` no se repite aquí: vive en `camposPropiedad`, así que
  // `.partial()` ya lo dejó opcional. Duplicarlo creaba dos definiciones del
  // mismo campo, y el día que se cambie una el otro se queda mintiendo.
  .refine(
    (datos) => (datos.latitud === undefined) === (datos.longitud === undefined),
    {
      message: 'Si envías coordenadas, envía latitud y longitud juntas',
      path: ['latitud'],
    }
  )
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Envía al menos un campo para actualizar',
  });

/**
 * Filtros del buscador.
 * Todo llega como texto desde la URL (?precioMin=1000), por eso
 * `z.coerce` convierte a número y valida el rango.
 */
export const filtrosPropiedadBaseSchema = z.object({
  tipo: z.enum(['VENTA', 'ALQUILER']).optional(),
  tipo_inmueble: z
    .enum(['DEPARTAMENTO', 'CASA', 'TERRENO', 'OFICINA', 'LOCAL_COMERCIAL', 'OTRO'])
    .optional(),
  estado: z.enum(['BORRADOR', 'PUBLICADA', 'VENDIDA', 'ALQUILADA', 'RETIRADA']).optional(),

  precioMin: z.coerce.number().min(0).optional(),
  precioMax: z.coerce.number().min(0).optional(),

  habitaciones: z.coerce.number().int().min(0).max(50).optional(),
  banos: z.coerce.number().int().min(0).max(50).optional(),
  areaMin: z.coerce.number().min(0).optional(),
  areaMax: z.coerce.number().min(0).optional(),

  distrito_id: id.optional(),
  moneda: z.enum(['PEN', 'USD']).optional(),

  // Búsqueda por texto libre en el título.
  busqueda: z.string().trim().max(100).optional(),

  // Búsqueda geográfica: radio en km alrededor de un punto.
  latitud: z.coerce.number().min(-90).max(90).optional(),
  longitud: z.coerce.number().min(-180).max(180).optional(),
  radioKm: z.coerce.number().min(0.1).max(100).optional(),

  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),

  // Orden: precio ascendente, los más recientes, los más vistos.
  orden: z.enum(['recientes', 'precio_asc', 'precio_desc', 'populares']).default('recientes'),
});

// Las reglas cruzadas (comparar un campo con otro) van fuera del objeto,
// porque necesitamos poder seguir usando .partial() sobre el esqueleto.
export const filtrosPropiedadSchema = filtrosPropiedadBaseSchema
  .refine(
    (datos) =>
      datos.precioMin === undefined ||
      datos.precioMax === undefined ||
      datos.precioMin <= datos.precioMax,
    {
      message: 'El precio mínimo no puede ser mayor que el máximo',
      path: ['precioMin'],
    }
  )
  .refine(
    (datos) =>
      datos.areaMin === undefined ||
      datos.areaMax === undefined ||
      datos.areaMin <= datos.areaMax,
    {
      message: 'El área mínima no puede ser mayor que la máxima',
      path: ['areaMin'],
    }
  )
  .refine(
    // Para buscar por radio hacen falta las dos coordenadas.
    (datos) =>
      !datos.radioKm ||
      (datos.latitud !== undefined && datos.longitud !== undefined),
    {
      message: 'Para buscar por cercanía necesitas enviar latitud y longitud',
      path: ['radioKm'],
    }
  );

export const idParamSchema = z.object({ id });

/**
 * 📌 POR QUÉ HAY DOS ESQUEMAS PARA EL MISMO PARÁMETRO
 *
 * La ruta `/:id` acepta DOS formatos a propósito:
 *
 *   GET /api/propiedades/12                        → por id numérico
 *   GET /api/propiedades/depa-vista-al-mar-miraflores → por slug
 *
 * Un solo esquema no puede validar los dos: `z.coerce.number()` revienta
 * con un slug, y un `z.string()` dejaría pasar "abc" como si fuera un id.
 *
 * Este esquema acepta cualquiera de los dos, y el controlador decide
 * cómo buscar según corresponda.
 *
 * La expresión `^\d+$` es la que decide: si son solo dígitos → id;
 * si no → slug. Es la misma prueba que hace el controlador, para que
 * validación y búsqueda nunca discrepen.
 */
export const idOSlugParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Falta el identificador de la propiedad')
    .max(120, 'El identificador es demasiado largo')
    .refine(
      (valor) => /^\d+$/.test(valor) || /^[a-z0-9-]+$/.test(valor),
      {
        // Este patrón tiene que coincidir EXACTAMENTE con el slugify() de
        // src/utils/utilidades.js. Si divergen, aparece un 400 en enlaces
        // que sí existen en la base, y es un fallo muy difícil de
        // diagnosticar porque el backend "tiene la propiedad".
        message: 'El enlace no es válido',
        path: ['id'],
      }
    ),
});

// ========================================
// CONTACTOS (LEADS)
// ========================================

export const crearContactoSchema = z.object({
  propiedad_id: id,
  mensaje: z
    .string()
    .trim()
    .min(10, 'Escribe un mensaje de al menos 10 caracteres')
    .max(1000, 'El mensaje es demasiado largo'),

  // El teléfono se congela en el lead para que el agente siempre
  // tenga por dónde llamar, aunque el cliente borre su perfil después.
  telefono: telefono.optional(),
});

export const actualizarContactoSchema = z.object({
  estado: z.enum(['NUEVO', 'EN_PROCESO', 'CERRADO', 'DESCARTADO']).optional(),
  notas: z.string().trim().max(2000).optional(),
});

// ========================================
// USUARIOS (solo ADMIN)
// ========================================

export const actualizarUsuarioAdminSchema = z.object({
  nombre: z.string().trim().min(3).max(120).optional(),
  rol: z.enum(['CLIENTE', 'PROPIETARIO', 'AGENTE', 'ADMIN']).optional(),
  activo: z.boolean().optional(),
  identidad_verificada: z.boolean().optional(),
}).refine((datos) => Object.keys(datos).length > 0, {
  message: 'Envía al menos un campo para actualizar',
});

// ========================================
// SOLICITUDES DE AGENTE (resolver, solo ADMIN)
// ========================================

export const resolverSolicitudAgenteSchema = z.object({
  /**
   * Solo dos valores posibles. No se acepta 'PENDIENTE' a propósito: una
   * solicitud resuelta no puede volver a la cola, porque entonces dos admins
   * podrían resolverla en sentidos opuestos y el historial mentiría.
   */
  estado: z.enum(['APROBADA', 'RECHAZADA']),

  /**
   * Obligatorio en la práctica al rechazar: sin motivo, el usuario no sabe
   * qué corregir. La comprobación de que viene cuando toca está en el
   * controlador, porque depende de `estado`.
   */
  motivo_rechazo: z.string().trim().max(500).optional(),
});

// ========================================
// PLAN COMERCIAL (solo ADMIN)
// ========================================

export const actualizarPlanSchema = z.object({
  /**
   * ⛔ El plan NO se acepta del propio usuario en ningún endpoint.
   * Esta ruta exige rol ADMIN. Si el usuario pudiera escribirlo,
   * el producto de pago sería gratis.
   */
  plan: z.enum(['GRATIS', 'PRO']),

  /**
   * Fecha de vencimiento en ISO 8601. `null` = sin vencimiento (cortesías).
   *
   * Se valida aquí con un mensaje claro en vez de dejar que Prisma falle:
   * `new Date('mañana')` no lanza error, produce `Invalid Date`, y una fecha
   * inválida guardada en la base es un plan que nunca vence o que vence
   * siempre, según cómo se compare. Mejor rechazarla en la puerta.
   */
  plan_vence: z
    .string()
    .nullable()
    .optional()
    .refine(
      (valor) => valor === null || valor === undefined || !Number.isNaN(new Date(valor).getTime()),
      { message: 'Usa una fecha válida en formato ISO 8601 (ej. 2027-01-31T00:00:00Z).' }
    ),
});
