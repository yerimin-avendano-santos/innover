// ========================================
// 🏠 CONTROLADOR DE PROPIEDADES
// ========================================
// Lógica de negocio de las propiedades: el corazón de INNOVER.
//
// Novedades frente a la versión anterior:
//   - El dueño se toma del token, nunca del cuerpo de la petición.
//   - Validación de ownership en update y delete.
//   - Filtros geográficos con PostGIS (radio en km).
//   - Paginación real.
//   - El precio se devuelve como número, no como string.

import { Prisma } from '@prisma/client';
import prisma from '../config/db.js';
import { ErrorNoEncontrado, ErrorProhibido } from '../utils/errores.js';
import { decimalANumero, slugify } from '../utils/utilidades.js';
import { tienePlanPro, motivoSinPro } from '../utils/plan.js';

/**
 * Cuántas propiedades puede tener destacadas un usuario con plan PRO.
 *
 * 📌 POR QUÉ HAY UN LÍMITE
 *
 * Sin él, el destaque deja de significar nada: el buscador ordena primero las
 * destacadas (`{ destacado: 'desc' }` en los `orderBy` de abajo), así que un
 * usuario con 80 propiedades las pone todas arriba y tapa el resto del
 * mercado. Lo que se vende como "tu aviso se ve primero" se convierte en
 * "el mercado entero cabe detrás de mí".
 *
 * Cinco es un número comercial, no técnico: cámbialo cuando haya datos de
 * cuántos destaca un agente de verdad. Lo importante es que exista y que esté
 * en un solo sitio.
 */
const MAX_DESTACADOS_POR_USUARIO = 5;

/**
 * Resuelve qué `tour_3d_url` puede guardarse.
 *
 * 📌 LA REGLA NO ES "¿TIENE PRO?" SINO "¿QUÉ ESTÁ INTENTANDO HACER?"
 *
 * Un `if (!pro) throw` a secas parece correcto y crea una trampa: el formulario
 * de edición manda de vuelta todos los campos, incluido el `tour_3d_url` que ya
 * tenía. Un usuario al que se le venció el PRO no podría ni cambiar el precio
 * de su propia casa, porque al guardar reenviaría su recorrido 3D y recibiría
 * un 403. Queda encerrado con sus propios datos.
 *
 * Por eso solo se comprueba cuando el valor CAMBIA a uno nuevo no vacío:
 *
 *   - no viene en el body        → se deja como estaba
 *   - vacío o null               → se permite: borrar lo propio siempre se puede
 *   - igual al que ya tenía      → se permite: reenviarlo no es usarlo
 *   - nuevo y no vacío           → exige PRO
 *
 * @param {unknown} valorNuevo    lo que llegó en el body
 * @param {string|null} valorActual  lo que hay en la base
 * @param {object} usuario        el de `req.usuario` (con plan, de la base)
 * @returns {string|null|undefined} el valor a guardar, o undefined para no tocarlo
 */
function resolverTour3D(valorNuevo, valorActual, usuario) {
  // El campo no viene: no se toca.
  if (valorNuevo === undefined) return undefined;

  const limpio = typeof valorNuevo === 'string' ? valorNuevo.trim() : valorNuevo;

  // Vacío = el usuario está quitando su recorrido. Siempre permitido.
  if (limpio === '' || limpio === null) return null;

  // Reenviar el mismo valor que ya estaba guardado no es un acto de uso.
  if (limpio === valorActual) return undefined;

  // Un ADMIN no paga por moderar, y es el MISMO trato que en `resolverDestacado`
  // y en AGENTS.md. Sin esta línea el código y su documentación decían cosas
  // distintas, y la diferencia se notaba al intentar arreglar el enlace roto del
  // recorrido de otra persona: un 403 por no pagar un plan que no cobra.
  if (usuario.rol === 'ADMIN') return limpio;

  // A partir de aquí es un valor NUEVO y no vacío: eso sí es usar el plan.
  if (!tienePlanPro(usuario)) {
    throw new ErrorProhibido(
      `${motivoSinPro(usuario)} El recorrido 3D va incluido en PRO. ` +
        'Puedes seguir editando el resto de la propiedad; solo se bloquea el 3D.'
    );
  }

  return limpio;
}

/**
 * Comprueba si el usuario puede guardar `destacado`.
 *
 * Lo escriben un ADMIN (que modera la plataforma) o un usuario con plan PRO
 * activo (el destaque va incluido en el plan). Nadie más.
 */
async function resolverDestacado(valorNuevo, usuarioId, usuario, propiedadId = null) {
  if (valorNuevo === undefined) return undefined;

  if (usuario.rol === 'ADMIN') return valorNuevo;

  if (!tienePlanPro(usuario)) {
    throw new ErrorProhibido(
      `${motivoSinPro(usuario)} El destaque de publicaciones va incluido en PRO.`
    );
  }

  // Solo hay que contar al ACTIVARLO: si ya estaba destacada no consume cupo
  // nuevo, y si se está quitando no importa cuántas tenga.
  if (valorNuevo === true) {
    const yaDestacadas = await prisma.propiedad.count({
      where: {
        usuario_id: usuarioId,
        destacado: true,
        ...(propiedadId && { id: { not: propiedadId } }),
      },
    });

    if (yaDestacadas >= MAX_DESTACADOS_POR_USUARIO) {
      throw new ErrorProhibido(
        `Tu plan permite ${MAX_DESTACADOS_POR_USUARIO} propiedades destacadas y ya las tienes. ` +
          'Quita el destaque de alguna para poner otra.'
      );
    }
  }

  return valorNuevo;
}

/**
 * Convierte un registro de Propiedad de la base de datos al formato
 * que entiende el frontend.
 *
 * 🛡️ Por qué no devuelvo la fila tal cual:
 *
 * 1. `precio` es Decimal en Prisma y sale como string ("275000.00").
 *    Si lo mando así, el frontend que haga `precio * 2` obtiene NaN.
 *
 * 2. Un usuario malicioso podría inyectar datos en su `nombre` o `titulo`
 *    (tipo "Mi nombre es <script>..."). Devolvemos solo campos concretos
 *    en lugar de `...usuario` para no filtrar de más por accidente.
 *
 * 📌 ESTÁ EXPORTADA PORQUE LA COMPARTE LA LISTA DE FAVORITOS.
 *
 * Un favorito es una propiedad más, y la tarjeta que la pinta es la misma: si
 * cada endpoint armara su propia versión "pública", bastaría con que uno se
 * olvidara de convertir `precio` a número para que la interfaz enseñara
 * "275000.00" en una pantalla y 275000 en la de al lado. Un solo sitio decide
 * qué se ve de un anuncio.
 */
export function propiedadPublica(propiedad) {
  if (!propiedad) return null;

  const { usuario, distrito, ...datos } = propiedad;

  return {
    ...datos,
    precio: decimalANumero(propiedad.precio),
    area_m2: decimalANumero(propiedad.area_m2),
    // El dueño se expone con un DTO mínimo: email NO se publica.
    // "Directorio de propietarios" es la promesa del startup, pero
    // filtrar emails abiertos por la API sería regalar datos a cualquiera.
    propietario: usuario
      ? {
          id: usuario.id,
          nombre: usuario.nombre,
          identidad_verificada: usuario.identidad_verificada,
        }
      : null,
    distrito: distrito
      ? { id: distrito.id, nombre: distrito.nombre }
      : null,
  };
}

// ========================================
// [CREATE] Crear una propiedad
// ========================================
export const crearPropiedad = async (req, res) => {
  const {
    titulo, descripcion, precio, moneda, tipo, tipo_inmueble, estado,
    area_m2, habitaciones, banos, parkederos,
    distrito_id, direccion, latitud, longitud,
    tour_3d_url, imagenes, destacado,
  } = req.body;

  /**
   * ⛔ EL DUEÑO SE TOMA DEL TOKEN, NO DEL BODY.
   *
   * Antes: `const { usuario_id } = req.body` → cualquiera publicaba
   * en nombre de otro usuario.
   *
   * Ahora: el middleware verificó el token, así que req.usuario.id
   * es prueba criptográfica de quién es.
   */
  const usuarioId = req.usuario.id;

  /**
   * ⛔ CANDADOS DE PLAN, Y EN EL SERVIDOR.
   *
   * Aquí es donde el plan PRO se convierte en algo real. Esconder el campo 3D
   * en el formulario no protege nada: cualquiera manda el JSON a mano con curl
   * y lo salta. La única defensa que cuenta es esta, la que corre antes de
   * tocar la base.
   */
  const tour3dFinal = resolverTour3D(tour_3d_url, null, req.usuario);
  const destacadoFinal = await resolverDestacado(destacado, usuarioId, req.usuario);

  // Generar un slug único a partir del título.
  const slugBase = slugify(titulo);
  let slug = slugBase;
  let intento = 1;

  // Si ya existe, agregamos un sufijo numérico: "casa-en-amarilis-2", etc.
  while (await prisma.propiedad.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${slugBase}-${++intento}`;
  }

  // El trigger de la base de datos calcula `locacion` a partir de
  // latitud/longitud, así que no hay que escribirla a mano.
  const propiedad = await prisma.propiedad.create({
    data: {
      usuario_id: usuarioId,
      slug,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      precio,
      moneda,
      tipo,
      tipo_inmueble,
      estado,
      area_m2: area_m2 ?? null,
      habitaciones,
      banos,
      parkederos,
      distrito_id: distrito_id ?? null,
      direccion: direccion?.trim() || null,
      latitud: latitud ?? null,
      longitud: longitud ?? null,
      // `?? null` y no `|| null`: resolverTour3D devuelve `undefined` cuando el
      // campo no debe tocarse. En un create nada que tocar equivale a null.
      tour_3d_url: tour3dFinal ?? null,
      // Solo se escribe si alguien con permiso lo pidió; si no, queda el
      // default de la base (false). Un `destacado: true` de un CLIENTE ya
      // habría lanzado 403 en resolverDestacado.
      ...(destacadoFinal !== undefined && { destacado: destacadoFinal }),
      imagenes: imagenes || [],
    },
    include: {
      usuario: { select: { id: true, nombre: true, identidad_verificada: true } },
      distrito: { select: { id: true, nombre: true } },
    },
  });

  res.status(201).json({
    mensaje: 'Propiedad publicada.',
    propiedad: propiedadPublica(propiedad),
  });
};

// ========================================
// Los filtros de la búsqueda, en un solo sitio
// ========================================
/**
 * Construye el `where` de Prisma a partir de los filtros de la query.
 *
 * 📌 ESTÁ FUERA DE `obtenerPropiedades` PORQUE LO COMPARTEN DOS PANTALLAS.
 *
 * La lista y el mapa tienen que enseñar EL MISMO conjunto. Si el mapa llevara
 * su propia copia de los filtros, bastaría con olvidar un `if` para que la
 * lista dijera "38 resultados" y el mapa pintara otra cosa — y eso no da
 * error, solo miente. Con una sola función, o coinciden los dos o no coincide
 * ninguno.
 *
 * ⛔ Y SOLO ENSEÑA `PUBLICADA`: ESO NO ES UN FILTRO, ES UN CANDADO.
 *
 * Aquí hubo un `estado ? [estado] : ['PUBLICADA']` que hoy no hace nada —el
 * schema de filtros es lista blanca y ni siquiera acepta `estado`, así que Zod
 * lo descarta antes de llegar— y que el día que alguien añada ese filtro
 * "razonable" ("enséñame también las vendidas") convertirá estas dos rutas en
 * la puerta de los borradores ajenos: sin error, sin prueba roja, sin nada.
 * La razón por la que pueden pedir solo sesión es que un BORRADOR no sale
 * nunca de aquí.
 *
 * Los borradores propios se ven en `/api/propiedades/mias`, que es otra ruta y
 * otro candado.
 *
 * Es `async` por la búsqueda por radio: PostGIS no se consulta con el
 * generador de Prisma, sino con SQL.
 */
async function construirWhere(filtros) {
  const {
    tipo, tipo_inmueble,
    precioMin, precioMax, areaMin, areaMax,
    habitaciones, banos, distrito_id, moneda, busqueda,
    latitud, longitud, radioKm,
  } = filtros;

  const where = { estado: { in: ['PUBLICADA'] } };

  if (tipo) where.tipo = tipo;
  if (tipo_inmueble) where.tipo_inmueble = tipo_inmueble;
  if (moneda) where.moneda = moneda;
  if (distrito_id) where.distrito_id = distrito_id;
  if (habitaciones !== undefined) where.habitaciones = { gte: habitaciones };
  if (banos !== undefined) where.banos = { gte: banos };

  if (precioMin !== undefined || precioMax !== undefined) {
    where.precio = {
      ...(precioMin !== undefined && { gte: precioMin }),
      ...(precioMax !== undefined && { lte: precioMax }),
    };
  }

  if (areaMin !== undefined || areaMax !== undefined) {
    where.area_m2 = {
      ...(areaMin !== undefined && { gte: areaMin }),
      ...(areaMax !== undefined && { lte: areaMax }),
    };
  }

  if (busqueda) {
    where.titulo = { contains: busqueda, mode: 'insensitive' };
  }

  /**
   * 🌍 BÚSQUEDA GEOGRÁFICA CON POSTGIS
   *
   * El operador `<->` es el operador KNN de PostGIS: "ordena por
   * cercanía". Usa el índice GIST, así que funciona en tiempo constante
   * aunque haya cientos de miles de propiedades.
   *
   * Es infinitamente más rápido que calcular distancias en JavaScript,
   * que tendría que traer todas las filas a Node y compararlas una a una.
   */
  if (radioKm && latitud !== undefined && longitud !== undefined) {
    const punto = Prisma.sql`ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)::geography`;
    const radioMetros = radioKm * 1000;

    const dentroDelRadio = await prisma.$queryRaw`
      SELECT "id"
      FROM "Propiedad"
      WHERE "estado" = 'PUBLICADA'::"EstadoPropiedad"
        AND "locacion" IS NOT NULL
        AND ST_DWithin(
          "locacion",
          ${punto},
          ${radioMetros}
        )
    `;

    const ids = dentroDelRadio.map((r) => r.id);
    where.id = { in: ids.length > 0 ? ids : [-1] }; // [-1] = lista vacía
  }

  return where;
}

// ========================================
// [READ] Buscar propiedades (con sesión)
// ========================================
export const obtenerPropiedades = async (req, res) => {
  const { pagina, porPagina, orden } = req.query;

  const where = await construirWhere(req.query);

  /**
   * 📡 EL DESTACADO PAGA.
   *
   * El modelo de monetización del startup es cobrar por aparecer primero.
   * El `orderBy` con array de objetos se aplica en orden: primero los
   * destacados, y dentro de cada grupo por el criterio elegido.
   */
  const ordenes = {
    recientes: [{ destacado: 'desc' }, { fecha_creacion: 'desc' }],
    populares: [{ destacado: 'desc' }, { vistas: 'desc' }],
    precio_asc: [{ destacado: 'desc' }, { precio: 'asc' }],
    precio_desc: [{ destacado: 'desc' }, { precio: 'desc' }],
  };

  const skip = (pagina - 1) * porPagina;

  const [total, propiedades, agregados] = await Promise.all([
    prisma.propiedad.count({ where }),
    prisma.propiedad.findMany({
      where,
      include: {
        usuario: { select: { id: true, nombre: true, identidad_verificada: true } },
        distrito: { select: { id: true, nombre: true } },
      },
      orderBy: ordenes[orden] || ordenes.recientes,
      skip,
      take: porPagina,
    }),
    // Rango de precios del conjunto filtrado, para los controles del filtro.
    prisma.propiedad.aggregate({
      where,
      _min: { precio: true },
      _max: { precio: true },
    }),
  ]);

  res.json({
    datos: propiedades.map(propiedadPublica),
    paginacion: {
      pagina,
      porPagina,
      total,
      paginas: Math.ceil(total / porPagina),
      hayMas: skip + propiedades.length < total,
    },
    rangoPrecios: {
      minimo: decimalANumero(agregados._min.precio),
      maximo: decimalANumero(agregados._max.precio),
    },
  });
};

// ========================================
// [READ] Los puntos del mapa (con sesión)
// ========================================
/**
 * Todo lo que el mapa necesita para dibujar la búsqueda. Nada más.
 *
 * 📌 POR QUÉ NO ES `obtenerPropiedades` CON `porPagina=100`.
 *
 * Porque el mapa NO pagina. Si enseñara solo la primera página, alejarse para
 * ver "¿dónde hay?" mentiría —un barrio se vería vacío porque sus propiedades
 * cayeron en la página 2— y el mapa existe justo para eso: la lista contesta
 * "cuáles", el mapa contesta "dónde". Así que devuelve el conjunto filtrado
 * entero (hasta un tope) y con los campos justos para pintar la chincheta y su
 * globo: mil propiedades con `descripcion` e `imagenes` serían cientos de
 * kilobytes para dibujar mil cuadrados de 28 px.
 *
 * ⛔ El tope SÍ recorta, y por eso la respuesta dice si recortó. Es la
 * diferencia entre "no hay más" y "no te estoy enseñando todo": el mapa no
 * puede permitirse confundirlas, porque la conclusión que saca quien mira es
 * "aquí no hay nada".
 */
const MAX_PUNTOS_MAPA = 1000;

export const obtenerPuntosDelMapa = async (req, res) => {
  const where = await construirWhere(req.query);

  // Una propiedad sin coordenadas no se puede pintar, y desaparecer sin decir
  // nada es justo lo que se lee como "aquí no hay nada". Se cuentan aparte
  // para poder avisarlo en pantalla.
  const sinCoordenadas = await prisma.propiedad.count({
    where: { ...where, OR: [{ latitud: null }, { longitud: null }] },
  });

  const [total, puntos] = await Promise.all([
    prisma.propiedad.count({ where }),
    prisma.propiedad.findMany({
      where: { ...where, latitud: { not: null }, longitud: { not: null } },
      select: {
        id: true,
        latitud: true,
        longitud: true,
        titulo: true,
        precio: true,
        moneda: true,
        tipo_inmueble: true,
        habitaciones: true,
        area_m2: true,
        destacado: true,
        distrito: { select: { id: true, nombre: true } },
      },
      // El mismo criterio que la lista: si el tope recorta, recorta por el
      // final, así que quedan fuera los que peor cumplen el orden que el
      // usuario pidió.
      orderBy: [{ destacado: 'desc' }, { fecha_creacion: 'desc' }],
      take: MAX_PUNTOS_MAPA,
    }),
  ]);

  const conCoordenadas = total - sinCoordenadas;

  res.json({
    datos: puntos.map(puntoParaMapa),
    total,
    con_coordenadas: conCoordenadas,
    sin_coordenadas: sinCoordenadas,
    recortado: conCoordenadas > MAX_PUNTOS_MAPA,
  });
};

/**
 * La proyección del mapa: lo justo para la chincheta y su globo.
 *
 * `precio` pasa por `decimalANumero` igual que en `propiedadPublica`, y aquí
 * importa más que allí: Prisma devuelve Decimal como texto, y la chincheta
 * enseña el precio dentro de una caja de 28 px de alto. "S/ 275000.00" no cabe
 * y, peor, `destacado`/`precio` alimentan decisiones de color: un string donde
 * se espera un número no falla, solo pinta mal.
 */
function puntoParaMapa(propiedad) {
  return {
    id: propiedad.id,
    latitud: propiedad.latitud,
    longitud: propiedad.longitud,
    titulo: propiedad.titulo,
    precio: decimalANumero(propiedad.precio),
    moneda: propiedad.moneda,
    tipo_inmueble: propiedad.tipo_inmueble,
    habitaciones: propiedad.habitaciones,
    area_m2: decimalANumero(propiedad.area_m2),
    destacado: propiedad.destacado,
    distrito: propiedad.distrito,
  };
}

// ========================================
// [READ] Una propiedad por ID o slug
// ========================================
export const obtenerPropiedadPorId = async (req, res) => {
  const { id } = req.params;

  // Acepta tanto /api/propiedades/12 como /api/propiedades/depa-miraflores
  const esSlug = !/^\d+$/.test(id);

  const propiedad = await prisma.propiedad.findFirst({
    where: esSlug ? { slug: id } : { id: Number(id) },
    include: {
      usuario: { select: { id: true, nombre: true, identidad_verificada: true } },
      distrito: { select: { id: true, nombre: true } },
    },
  });

  if (!propiedad) {
    throw new ErrorNoEncontrado('La propiedad');
  }

  // Un BORRADOR solo lo ve su dueño (o un admin).
  if (propiedad.estado === 'BORRADOR' && !esVisiblePara(req.usuario, propiedad)) {
    throw new ErrorProhibido('Esta publicación no está disponible.');
  }

  // Contar la visita. Fire-and-forget: si falla, no queremos romper la vista.
  if (req.usuario?.id !== propiedad.usuario_id) {
    prisma.propiedad
      .update({ where: { id: propiedad.id }, data: { vistas: { increment: 1 } } })
      .catch(() => {});
  }

  /**
   * 📌 ¿LA TIENE GUARDADA QUIEN MIRA?
   *
   * Es el estado del visitante, no un dato del anuncio: el mismo anuncio es
   * favorito para uno y no para otro. Por eso no vive en `propiedadPublica`
   * —que describe el anuncio— y por eso se pregunta solo si hay alguien
   * mirando: `usuarioOpcional` deja `req.usuario` vacío cuando no reconoce el
   * token, y un rastreador no tiene favoritos.
   *
   * Va aquí y no en una llamada aparte desde la isla del corazón porque el
   * botón necesita saber su estado al pintarse: preguntándolo después, se
   * vería apagado un instante aunque estuviera encendido. Es una consulta por
   * índice único sobre una tabla pequeña.
   */
  const favorito = req.usuario
    ? await prisma.favorito.findUnique({
        where: {
          usuario_id_propiedad_id: {
            usuario_id: req.usuario.id,
            propiedad_id: propiedad.id,
          },
        },
        select: { id: true },
      })
    : null;

  /**
   * 📌 `es_favorito` SOLO VIAJA SI HAY ALGUIEN IDENTIFICADO.
   *
   * Un `false` para un visitante anónimo sería un dato que miente: dice "no lo
   * tienes guardado" a quien no puede tenerlo. Y la ficha necesita distinguir
   * los dos casos, porque no es lo mismo ofrecer un corazón —un botón que
   * guarda— que un enlace a `login` —guardar exige cuenta—.
   *
   * La ausencia del campo es la señal, y la decide el servidor: la interfaz no
   * adivina si hay sesión mirando una cookie que no puede leer (es httpOnly).
   */
  const respuesta = { ...propiedadPublica(propiedad) };
  if (req.usuario) {
    respuesta.es_favorito = favorito !== null;
  }

  res.json({ propiedad: respuesta });
};

/**
 * Regla de visibilidad reutilizable.
 * El dueño y el admin ven todo; el resto solo lo publicado.
 *
 * 📌 ESTÁ EXPORTADA PORQUE LA COMPARTEN LA FICHA Y LOS FAVORITOS.
 *
 * Guardar un anuncio es una forma de mirarlo, así que el candado es el mismo:
 * no se puede guardar lo que no se puede abrir. Escribirlo dos veces sería
 * pedir que las dos copias sigan coincidiendo para siempre.
 */
export function esVisiblePara(usuario, propiedad) {
  if (!usuario) return false;
  return usuario.rol === 'ADMIN' || usuario.id === propiedad.usuario_id;
}

/**
 * Cuántas URLs se aceptan en el sitemap.
 *
 * El formato permite 50 000 por archivo. Se corta antes por dos motivos: un
 * archivo de ese tamaño tarda en generarse y en leerse, y quedarse corto deja
 * un aviso (el `total` no cuadra con las URLs) antes de llegar al límite real.
 * Si algún día se alcanza, toca partir el sitemap en varios archivos y
 * anunciarlos con un índice — trabajo que solo tiene sentido cuando estorbe.
 */
const MAX_URLS_SITEMAP = 10000;

// ========================================
// [READ] La lista para el sitemap.xml
// ========================================
// 📌 POR QUÉ EXISTE ESTE ENDPOINT, SI LA FICHA YA ES PÚBLICA
//
// Porque "pública" no es lo mismo que "encontrable". El buscador exige sesión
// y un rastreador no tiene cuenta, así que no hay un solo enlace interno que
// lleve a una ficha: Google solo las descubriría por enlaces externos. Esta
// lista es la que se convierte en `/sitemap.xml`, que es el mecanismo estándar
// para decirle a un buscador qué páginas hay.
//
// ⛔ DEVUELVE DOS CAMPOS, Y NADA MÁS.
//
// Un endpoint público es una puerta abierta: cuanto menos haya detrás, menos
// importa que esté abierta. Aquí hay exactamente lo que necesita un sitemap —
// la URL y cuándo cambió (la fecha es lo que le dice a Google si vale la pena
// volver)—. Ni precios, ni direcciones, ni dueño, ni contadores. Todo eso vive
// en la ficha, que también es pública pero se pide de una en una y con el
// resto del contexto alrededor.
//
// Solo PUBLICADAS, y esto sí es un candado y no una comodidad: un BORRADOR
// aquí sería filtrar al buscador justo lo que su dueño no ha decidido
// enseñar, y además dejarlo apuntado para siempre.
export const obtenerListaParaSitemap = async (req, res) => {
  const propiedades = await prisma.propiedad.findMany({
    where: { estado: 'PUBLICADA' },
    select: { slug: true, fecha_actualizacion: true },
    orderBy: { fecha_actualizacion: 'desc' },
    take: MAX_URLS_SITEMAP,
  });

  res.json({ datos: propiedades, total: propiedades.length });
};

// ========================================
// [READ] Propiedades de un usuario
// ========================================
export const obtenerMisPropiedades = async (req, res) => {
  const { estado } = req.query;

  const propiedades = await prisma.propiedad.findMany({
    where: {
      usuario_id: req.usuario.id,   // 👈 siempre el del token
      ...(estado && { estado }),
    },
    include: {
      distrito: { select: { id: true, nombre: true } },
      _count: { select: { contactos: true } },  // leads recibidos
    },
    orderBy: { fecha_creacion: 'desc' },
  });

  res.json({
    datos: propiedades.map((p) => ({
      ...propiedadPublica(p),
      leads: p._count.contactos,
    })),
  });
};

// ========================================
// [UPDATE] Actualizar una propiedad
// ========================================
export const actualizarPropiedad = async (req, res) => {
  const { id } = req.params;
  const propiedadId = Number(id);

  const existente = await prisma.propiedad.findUnique({
    where: { id: propiedadId },
    select: {
      id: true,
      usuario_id: true,
      slug: true,
      titulo: true,
      // Se lee el valor actual del 3D para poder distinguir "lo reenvío igual"
      // de "quiero poner uno nuevo". Sin esto no se puede saber si el usuario
      // está usando el plan o solo guardando el formulario.
      tour_3d_url: true,
    },
  });

  if (!existente) throw new ErrorNoEncontrado('La propiedad');

  /**
   * ⛔ AUTORIZACIÓN REAL, no solo de rol.
   *
   * El middleware verificarDuenio ya comprobó que es suya o es ADMIN.
   * Lo repetimos aquí porque esta función también se podría llamar desde
   * otro sitio en el futuro. La regla: "verifica la autorización en el
   * punto donde usas el dato".
   */
  if (req.usuario.rol !== 'ADMIN' && existente.usuario_id !== req.usuario.id) {
    throw new ErrorProhibido('Esta publicación no es tuya.');
  }

  /**
   * ⛔ MASS ASSIGNMENT: nunca `data: req.body`.
   *
   * Antes el código hacía exactamente eso:
   *     data: req.body
   * Eso permitía mandar { "usuario_id": 42 } y robar la propiedad de otro,
   * o { "id": 999 } y cambiar su identificador.
   *
   * Ahora el schema de Zod define una lista blanca de campos permitidos
   * y aquí solo copiamos esos. Lo que no esté en el schema no se escribe.
   */
  const {
    titulo, descripcion, precio, moneda, tipo, tipo_inmueble, estado,
    area_m2, habitaciones, banos, parkederos,
    distrito_id, direccion, latitud, longitud,
    tour_3d_url, imagenes, destacado,
  } = req.body;

  /**
   * ⛔ CAMPOS DE PAGO: `destacado` Y `tour_3d_url`.
   *
   * Antes bastaba con borrar `destacado` del body cuando el usuario no era
   * ADMIN. Ahora hay dos planes, así que la pregunta ya no es "¿es admin?"
   * sino "¿tiene PRO activo?" — y en el caso del 3D, "¿está intentando
   * cambiarlo o solo reenviando el formulario?".
   *
   * Los dos helpers devuelven `undefined` cuando el campo no debe tocarse.
   * Ojo: `undefined` en un `update` de Prisma significa "no toques este campo",
   * que es justo lo que queremos — pero hay que respetarlo, no convertirlo
   * a `null` sin querer.
   */
  const tour3dFinal = resolverTour3D(tour_3d_url, existente.tour_3d_url, req.usuario);
  const destacadoFinal = await resolverDestacado(
    destacado,
    existente.usuario_id,
    req.usuario,
    propiedadId
  );

  /**
   * Zod ya garantiza que no vienen campos extra, así que copiar el body
   * es seguro frente a mass assignment. Lo que hay que sobrescribir son los
   * campos cuyo permiso acaba de resolverse arriba.
   */
  const datos = { ...req.body };

  // `delete` en vez de asignar `undefined`: Prisma trataría un `undefined`
  // explícito igual, pero borrar la clave deja el objeto limpio y hace obvio
  // en un `console.log` que ese campo no se va a escribir.
  if (tour3dFinal === undefined) delete datos.tour_3d_url;
  else datos.tour_3d_url = tour3dFinal;

  if (destacadoFinal === undefined) delete datos.destacado;
  else datos.destacado = destacadoFinal;

  // Limpiar opcionales que llegaron vacíos como string.
  for (const campo of ['area_m2', 'distrito_id', 'latitud', 'longitud']) {
    if (datos[campo] === '' || datos[campo] === undefined) delete datos[campo];
  }
  // `tour_3d_url` ya no está en esta lista: resolverTour3D convierte el vacío
  // en `null` y el "no lo toques" en una clave borrada. Repetirlo aquí
  // sugeriría que hay dos sitios donde se decide lo mismo.
  if (datos.direccion === '') datos.direccion = null;
  if (datos.titulo) datos.titulo = datos.titulo.trim();
  if (datos.descripcion) datos.descripcion = datos.descripcion.trim();

  // Si cambió el título, el slug se recalcula (por eso el slug va en URL).
  if (datos.titulo && datos.titulo !== existente.titulo) {
    datos.slug = await slugUnico(slugify(datos.titulo), propiedadId);
  }

  const propiedad = await prisma.propiedad.update({
    where: { id: propiedadId },
    data: datos,
    include: {
      usuario: { select: { id: true, nombre: true, identidad_verificada: true } },
      distrito: { select: { id: true, nombre: true } },
    },
  });

  res.json({
    mensaje: 'Propiedad actualizada.',
    propiedad: propiedadPublica(propiedad),
  });
};

/** Genera un slug único, ignorando una propiedad concreta. */
async function slugUnico(base, ignorarId) {
  let slug = base;
  let intento = 1;

  while (true) {
    const choque = await prisma.propiedad.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!choque || choque.id === ignorarId) return slug;
    slug = `${base}-${++intento}`;
  }
}

// ========================================
// [DELETE] Eliminar una propiedad
// ========================================
export const eliminarPropiedad = async (req, res) => {
  const { id } = req.params;
  const propiedadId = Number(id);

  const existente = await prisma.propiedad.findUnique({
    where: { id: propiedadId },
    select: { id: true, usuario_id: true },
  });

  if (!existente) throw new ErrorNoEncontrado('La propiedad');

  if (req.usuario.rol !== 'ADMIN' && existente.usuario_id !== req.usuario.id) {
    throw new ErrorProhibido('Esta publicación no es tuya.');
  }

  await prisma.propiedad.delete({ where: { id: propiedadId } });

  res.json({ mensaje: 'Propiedad eliminada.' });
};

// ========================================
// [EXTRA] Propiedades cercanas (PostGIS puro)
// ========================================
// Esta ruta no acepta paginación: por su naturaleza siempre devuelve
// un número pequeño de resultados ("las 20 más cercanas a mí").

export const obtenerPropiedadesCercanas = async (req, res) => {
  const { latitud, longitud, radioKm = 2, limite = 20 } = req.query;

  const punto = Prisma.sql`ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)::geography`;

  const resultados = await prisma.$queryRaw`
    SELECT
      p."id",
      p."slug",
      p."titulo",
      p."precio",
      p."moneda",
      p."tipo",
      p."habitaciones",
      p."banos",
      p."latitud",
      p."longitud",
      p."destacado",
      -- El ::float8 es necesario: PostgreSQL devuelve el tipo numeric como
    -- texto, y el JSON llegaría al frontend como "0.5" en vez de 0.5.
    (ST_Distance(p."locacion", ${punto}) / 1000)::float8 AS "distancia_km"
    FROM "Propiedad" p
    WHERE p."estado" = 'PUBLICADA'::"EstadoPropiedad"
      AND p."locacion" IS NOT NULL
      AND ST_DWithin(p."locacion", ${punto}, ${radioKm * 1000})
    ORDER BY p."locacion" <-> ${punto}   -- KNN: ordena por cercanía real
    LIMIT ${limite}
  `;

  res.json({
    datos: resultados.map((r) => ({
      ...r,
      precio: decimalANumero(r.precio),
      distancia_km: Number(r.distancia_km),
    })),
    radio_km: radioKm,
  });
};
