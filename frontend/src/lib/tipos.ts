// ========================================
// 📐 TIPOS DEL DOMINIO
// ========================================
// Estos tipos son el "contrato" entre el backend y el frontend.
//
// ¿Por qué importarlos a mano en vez de inferirlos?
// Si el backend cambia `tipo` a `tipo_operacion` y no actualizas este
// archivo, TypeScript sigue diciendo que está bien y el bug aparece en
// producción. Los tipos escritos a mano obligan a revisarlos cuando
// el contrato cambia.

/** Quien está usando la plataforma. Dice QUÉ HACE, no qué paga. */
export type RolUsuario = 'CLIENTE' | 'PROPIETARIO' | 'AGENTE' | 'ADMIN';

/**
 * El plan comercial. Dice QUÉ PUEDE PAGAR, no qué hace.
 *
 * Es un eje distinto del rol a propósito: un PROPIETARIO con PRO tiene el
 * recorrido 3D igual que un AGENTE con PRO. Si el plan fuera un rol habría que
 * inventar AGENTE_PRO, PROPIETARIO_PRO y cada combinación nueva.
 */
export type PlanUsuario = 'GRATIS' | 'PRO';

/** Estado de una solicitud para pasar de CLIENTE a AGENTE. */
export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

/** Venta o alquiler. */
export type TipoOperacion = 'VENTA' | 'ALQUILER';

export type TipoInmueble =
  | 'DEPARTAMENTO'
  | 'CASA'
  | 'TERRENO'
  | 'OFICINA'
  | 'LOCAL_COMERCIAL'
  | 'OTRO';

export type EstadoPropiedad =
  | 'BORRADOR'
  | 'PUBLICADA'
  | 'VENDIDA'
  | 'ALQUILADA'
  | 'RETIRADA';

export type EstadoContacto = 'NUEVO' | 'EN_PROCESO' | 'CERRADO' | 'DESCARTADO';

export type Moneda = 'PEN' | 'USD';

// ========================================
// Usuario
// ========================================

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
  telefono: string | null;
  avatar_url: string | null;
  identidad_verificada: boolean;
  activo: boolean;
  fecha_creacion: string;

  // --- Plan comercial ---
  /** El plan contratado. Para MOSTRAR texto ("Plan PRO"). */
  plan: PlanUsuario;
  /** Cuándo vence. `null` = sin vencimiento (cortesías). Para MOSTRAR. */
  plan_vence: string | null;

  /**
   * ⛔ PARA DECIDIR, USA ESTE CAMPO. NO compares `plan === 'PRO'`.
   *
   * Lo calcula el servidor con `tienePlanPro()`, que es el único sitio que
   * mira la fecha. Repetir la comparación aquí diría que un PRO **vencido**
   * sigue vigente: la interfaz mostraría el formulario del recorrido 3D, el
   * usuario lo rellenaría, y el servidor lo rechazaría con un 403 que no
   * encaja con lo que acaba de ver en pantalla.
   *
   * No es un bug visible — es peor: es un bug que solo aparece al guardar.
   */
  plan_pro_activo: boolean;
}

export interface MiPerfil extends Usuario {
  ultimo_acceso: string | null;
  resumen: {
    propiedades_publicadas: number;
    leads_recibidos: number;
  };
}

/**
 * Lo que devuelve GET /api/usuarios, que tiene más campos que `Usuario`.
 *
 * Expone `documento_identidad` porque el panel de admin necesita
 * mostrarlo para poder verificar la identidad a ojo.
 */
export interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
  telefono: string | null;
  avatar_url: string | null;
  documento_identidad: string | null;
  identidad_verificada: boolean;
  activo: boolean;
  fecha_creacion: string;
  ultimo_acceso: string | null;
  propiedades: number;
  /** Mismo trío que en `Usuario`: ver el comentario de `plan_pro_activo`. */
  plan: PlanUsuario;
  plan_vence: string | null;
  plan_pro_activo: boolean;
}

/** Filtros del panel de administración. */
export interface FiltrosAdmin {
  busqueda: string;
  rol: RolUsuario | '';
  activo: '' | 'true' | 'false';
}

// ========================================
// Propiedad
// ========================================

export interface Propietario {
  id: number;
  nombre: string;
  identidad_verificada: boolean;
}

export interface Distrito {
  id: number;
  nombre: string;
  /**
   * "Huánuco" es a la vez un distrito, una provincia y una región. Sin estos
   * dos campos la interfaz no puede desambiguar cuál de los tres está
   * mostrando, y el día que se abra una segunda región el selector tendría que
   * cambiar de forma.
   */
  region: string;
  provincia: string;
  latitud_centro: number | null;
  longitud_centro: number | null;
  propiedades_publicadas?: number;
}

/**
 * Una solicitud para pasar de CLIENTE a AGENTE.
 *
 * Es una fila y no una columna de `Usuario` a propósito: da historial de
 * intentos, guarda el documento presentado EN CADA intento, el motivo del
 * rechazo y quién lo revisó. Un rechazado puede volver a intentarlo.
 */
export interface SolicitudAgente {
  id: number;
  usuario_id: number;
  documento: string;
  mensaje: string | null;
  estado: EstadoSolicitud;
  motivo_rechazo: string | null;
  revisor_id: number | null;
  fecha_creacion: string;
  fecha_resolucion: string | null;
  /**
   * Solo viene en los listados de admin (en `mi-solicitud` no: quien pregunta
   * es el propio interesado y ya sabe quién es).
   *
   * El teléfono SÍ se incluye, y no es un descuido de privacidad: el admin
   * tiene que poder llamar a quien solicita si el documento no se lee, y esa
   * llamada es justamente el trabajo. Lo que no viaja nunca es la contraseña.
   */
  usuario?: Pick<
    Usuario,
    'id' | 'nombre' | 'email' | 'telefono' | 'rol' | 'identidad_verificada'
  >;
  revisor?: { id: number; nombre: string } | null;
}

export interface Propiedad {
  id: number;
  slug: string;
  titulo: string;
  descripcion: string;

  /** Ya viene como número: el backend lo convierte con `decimalANumero`. */
  precio: number;
  moneda: Moneda;

  tipo: TipoOperacion;
  tipo_inmueble: TipoInmueble;
  estado: EstadoPropiedad;

  area_m2: number | null;
  habitaciones: number;
  banos: number;
  parkederos: number;

  distrito_id: number | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;

  tour_3d_url: string | null;
  imagenes: string[];
  destacado: boolean;
  vistas: number;

  fecha_creacion: string;
  fecha_actualizacion: string;

  propietario: Propietario | null;
  distrito: { id: number; nombre: string } | null;

  /** Solo en la ruta /cercanas. */
  distancia_km?: number;

  /**
   * Solo en la FICHA, y solo si hay sesión.
   *
   * Es el estado de quien mira, no un dato del anuncio: el mismo anuncio es
   * favorito para uno y no para otro. Y es opcional a propósito — su AUSENCIA
   * significa "no hay sesión", que no es lo mismo que "no lo tienes guardado":
   * con `false` la ficha no podría distinguir a un visitante anónimo de un
   * usuario que no lo ha guardado, y ofrecería un corazón que devuelve 401.
   */
  es_favorito?: boolean;
}

/**
 * Un anuncio guardado: la propiedad entera más cuándo se guardó.
 *
 * Es `Propiedad` y no un resumen a propósito: la lista de favoritos pinta las
 * mismas tarjetas que el buscador (`FichaPropiedad`), y si este tipo trajera
 * menos campos, ese componente reventaría al recibirlo.
 */
export interface Favorito extends Propiedad {
  /** ISO de cuándo se guardó. Es lo que ordena la lista. */
  guardado_en: string;
}

/**
 * Lo que el mapa necesita de una propiedad: la chincheta y su globo. Nada más.
 *
 * 📌 NO ES `Propiedad` RECORTADA, ES SU PROPIO TIPO, Y ESO ES LO IMPORTANTE.
 *
 * `Propiedad` es lo que pinta la lista; esto es lo que pinta un cuadrado de
 * 28 px sobre un mapa. Si el endpoint del mapa devolviera propiedades a medias
 * con el tipo `Propiedad`, la lista de al lado podría recibirlas sin que
 * TypeScript dijera nada y reventaría al leer `descripcion` o `imagenes` — que
 * no vienen. Aquí el compilador lo ve venir.
 *
 * `latitud` y `longitud` son `number` y no `number | null` a propósito: el
 * backend no manda puntos sin coordenadas, porque no se pueden pintar. El
 * tipo lo dice, y así nadie tiene que repetir el `if` que ya se hizo allí.
 */
export interface PuntoMapa {
  id: number;
  latitud: number;
  longitud: number;
  titulo: string;
  precio: number;
  moneda: Moneda;
  tipo_inmueble: TipoInmueble;
  habitaciones: number;
  area_m2: number | null;
  destacado: boolean;
  distrito: { id: number; nombre: string } | null;
}

// ========================================
// Respuestas de la API
// ========================================

export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
  paginas: number;
  hayMas: boolean;
}

export interface RespuestaPropiedades {
  datos: Propiedad[];
  paginacion: Paginacion;
  rangoPrecios: {
    minimo: number | null;
    maximo: number | null;
  };
}

/**
 * La respuesta del mapa: el resultado filtrado ENTERO, no una página.
 *
 * Por eso no hay `paginacion` aquí: el mapa no pagina, agrupa. Y como el mapa
 * no puede decir "no hay más" sin mentir, la respuesta lleva sus propios
 * contadores: cuántas propiedades caen fuera por no tener coordenadas y si el
 * tope del backend dejó alguna fuera.
 */
export interface RespuestaMapa {
  datos: PuntoMapa[];
  /** Propiedades que cumplen los filtros (coincida con el total de la lista). */
  total: number;
  con_coordenadas: number;
  sin_coordenadas: number;
  /** `true` si se alcanzó el tope y hay puntos que NO se están pintando. */
  recortado: boolean;
}

export interface RespuestaLead {
  id: number;
  estado: EstadoContacto;
  mensaje: string;
  fecha_creacion: string;
  cliente: { id: number; nombre: string };
  contacto: { email: string | null; telefono: string | null };
  propiedad: {
    id: number;
    slug: string;
    titulo: string;
    precio: number;
    moneda: Moneda;
    estado: EstadoPropiedad;
  };
}

export interface EstadisticasCRM {
  resumen: Record<EstadoContacto, number>;
  total: number;
  tasa_cierre_porcentaje: number;
  propiedades_activas: number;
}

/** Error que devuelve la API. */
export interface ErrorAPI {
  error: string;
  codigo?: string;
  detalles?: { campo: string; mensaje: string }[];
}
