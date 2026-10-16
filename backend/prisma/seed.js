// ========================================
// 🌱 DATOS DE EJEMPLO (seed)
// ========================================
// Ejecutar:  npm run seed
//
// ⛔ Este script BORRA los datos existentes de las tablas y pone un
// conjunto de ejemplo. Está pensado para desarrollo, NUNCA para producción.
//
// Sirve para dos cosas:
//   1. Ver la aplicación con contenido realista sin teclear 20 avisos.
//   2. Probar los filtros y el mapa con precios y zonas variados.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('⚠️  Esto BORRA los datos de ejemplo y crea unos nuevos.\n');

  // El orden importa por las llaves foráneas: primero los hijos, después
  // los padres. O al revés, con cascade.
  //
  // `solicitudAgente` va la primera aunque su FK a Usuario sea en cascada:
  // depender del cascade para vaciar una tabla es frágil —el día que alguien
  // cambie el `onDelete` a `Restrict`, este script empieza a fallar con un
  // error de llave foránea que no menciona la causa real—. Explícito y en
  // orden es una línea más y no se rompe solo.
  await prisma.solicitudAgente.deleteMany();
  await prisma.contacto.deleteMany();
  await prisma.propiedad.deleteMany();
  await prisma.distrito.deleteMany();
  await prisma.usuario.deleteMany();

  console.log('✓ Tablas vaciadas');

  // --- Zonas de la región de Huánuco, con su centro aproximado ---
  //
  // 📌 POR QUÉ HUÁNUCO Y NO LIMA
  //
  // INNOVER arranca en una sola región: Huánuco. Es el mercado que conocemos
  // y donde los precios de un seed significan algo. Sembrar Lima haría que la
  // demo se viera bien y no dijera nada: los distritos importan por su
  // vecindario real, no por su fama.
  //
  // Las nueve zonas cubren la conurbación de la capital más las zonas donde
  // de verdad se compra y se alquila en la región.
  //
  // 📌 DE DÓNDE SALEN ESTAS COORDENADAS
  //
  // De OpenStreetMap (Nominatim), exigiendo que el resultado fuera un lugar
  // poblado o una frontera administrativa. NO están escritas de memoria: una
  // latitud inventada no falla al ejecutar — solo pinta el marcador dentro del
  // río y nadie se entera hasta que alguien abre el mapa.
  //
  // Dos de ellas se contrastaron contra fuentes independientes y coinciden:
  //   Amarilis      aquí -9.9449/-76.2427  ·  muniamarilis.gob.pe -9.94472/-76.2428
  //   Pillco Marca  aquí -9.9610/-76.2468  ·  Wikipedia        -9.9617/-76.2469
  //
  // 'latitud_centro' solo se usa para centrar el mapa cuando el usuario filtra
  // por una zona sin resultados. Para eso el centro del distrito sirve; el de
  // su capital (Paucarbamba, Cayhuayna, Huancapallac) es más útil todavía,
  // porque es donde está la gente.
  const distritos = [
    // --- La conurbación: los tres distritos que forman la ciudad ---
    { nombre: 'Huánuco', latitud_centro: -9.9293, longitud_centro: -76.2395, region: 'Huánuco', provincia: 'Huánuco' },
    { nombre: 'Amarilis', latitud_centro: -9.9449, longitud_centro: -76.2427, region: 'Huánuco', provincia: 'Huánuco' },
    { nombre: 'Pillco Marca', latitud_centro: -9.9610, longitud_centro: -76.2468, region: 'Huánuco', provincia: 'Huánuco' },

    // --- Alrededores de la capital, donde crece la ciudad ---
    { nombre: 'Santa María del Valle', latitud_centro: -9.8628, longitud_centro: -76.1699, region: 'Huánuco', provincia: 'Huánuco' },
    { nombre: 'Churubamba', latitud_centro: -9.8257, longitud_centro: -76.1337, region: 'Huánuco', provincia: 'Huánuco' },
    // Quisqui se conoce en la calle como "Kichki"; su capital es Huancapallac.
    { nombre: 'Quisqui', latitud_centro: -9.9046, longitud_centro: -76.3924, region: 'Huánuco', provincia: 'Huánuco' },
    { nombre: 'San Francisco de Cayrán', latitud_centro: -9.9809, longitud_centro: -76.2840, region: 'Huánuco', provincia: 'Huánuco' },

    // --- Las otras dos ciudades de la región ---
    // 📌 Ojo: la REGIÓN de las tres es 'Huánuco', pero la PROVINCIA cambia.
    // Por eso hacen falta los dos campos y no uno: "Huánuco" es el nombre de
    // un distrito, de una provincia y de una región a la vez.
    { nombre: 'Ambo', latitud_centro: -10.1292, longitud_centro: -76.2043, region: 'Huánuco', provincia: 'Ambo' },
    { nombre: 'Tingo María', latitud_centro: -9.2984, longitud_centro: -76.0003, region: 'Huánuco', provincia: 'Leoncio Prado' },
  ];

  const mapaDistritos = {};
  for (const d of distritos) {
    mapaDistritos[d.nombre] = await prisma.distrito.create({ data: d });
  }
  console.log(`✓ ${distritos.length} distritos creados`);

  // --- Usuarios ---
  const hash = await bcrypt.hash('Demo1234', 12);

  // ========================================
  // PLANES: LOS TRES ESTADOS POSIBLES
  // ========================================
  //
  // 📌 POR QUÉ CADA CUENTA LLEVA UN PLAN DISTINTO
  //
  // El plan es un eje APARTE del rol, y eso solo se ve si hay combinaciones
  // que lo demuestren. Un seed donde todos son PRO no prueba nada.
  //
  //   agente       → PRO VIGENTE (con fecha)  → el cliente que paga
  //   propietario  → PRO VENCIDO              → quien dejó de pagar. Y ojo:
  //                                             es PROPIETARIO, no agente —
  //                                             justo el caso que justifica
  //                                             separar el plan del rol
  //   cliente      → GRATIS                   → nunca tuvo acceso
  //
  // El PRO vencido es el más útil de los tres: obliga a que la comprobación
  // mire la FECHA y no solo la palabra 'PRO'. Si alguien "simplificara"
  // `tienePlanPro()` a `usuario.plan === 'PRO'`, la demo se seguiría viendo
  // bien y la cuenta vencida conservaría el 3D para siempre.
  const enDias = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const admin = await prisma.usuario.create({
    data: {
      nombre: 'Andrea Salazar',
      email: 'admin@innover.dev',
      contrasena_hash: hash,
      rol: 'ADMIN',
      telefono: '987654321',
      identidad_verificada: true,
      // El admin administra el plan de otros; el suyo da igual. Se deja
      // GRATIS a propósito para que el panel muestre los dos estados.
    },
  });

  const agente = await prisma.usuario.create({
    data: {
      nombre: 'Carlos Mendoza',
      email: 'agente@innover.dev',
      contrasena_hash: hash,
      rol: 'AGENTE',
      telefono: '987112233',
      identidad_verificada: true,
      plan: 'PRO',
      plan_vence: enDias(90), // tres meses: la suscripción típica
    },
  });

  const propietario = await prisma.usuario.create({
    data: {
      nombre: 'Lucia Fernández',
      email: 'propietario@innover.dev',
      contrasena_hash: hash,
      rol: 'PROPIETARIO',
      telefono: '988776655',
      identidad_verificada: true,
      // Venció hace 15 días. Conserva el 3D de lo que publicó entonces, pero
      // no puede poner uno nuevo. Es el caso incómodo y hay que verlo.
      plan: 'PRO',
      plan_vence: enDias(-15),
    },
  });

  const cliente = await prisma.usuario.create({
    data: {
      nombre: 'Marco Rojas',
      email: 'cliente@innover.dev',
      contrasena_hash: hash,
      rol: 'CLIENTE',
      telefono: '955443322',
    },
  });

  /*
   * Dos usuarios con documento enviado pero SIN verificar.
   *
   * Son lo que deja POST /api/auth/solicitar-agente. A partir del Bloque 2 ese
   * endpoint hace DOS cosas: guarda `documento_identidad` en el usuario (el
   * dato vigente de la persona) y crea una fila en `SolicitudAgente` (la
   * fotocopia de lo que se presentó en ese intento).
   *
   * Sin ellos, el panel de administración se abre vacío y no hay forma de
   * probar el flujo de verificación, que es su razón de existir.
   */
  const pendienteVerificacion = await prisma.usuario.create({
    data: {
      nombre: 'Rosa Villaseñor',
      email: 'rosa.pendiente@innover.dev',
      contrasena_hash: hash,
      rol: 'CLIENTE',
      telefono: '944112233',
      documento_identidad: '45678912',
    },
  });

  const pendienteAgente = await prisma.usuario.create({
    data: {
      nombre: 'Jorge Cueva',
      email: 'jorge.pendiente@innover.dev',
      contrasena_hash: hash,
      rol: 'CLIENTE',
      telefono: '933445566',
      documento_identidad: '20678123456',
    },
  });

  // ========================================
  // SOLICITUDES DE AGENTE: UNA PENDIENTE Y UNA RECHAZADA
  // ========================================
  //
  // 📌 POR QUÉ NO SON LAS DOS PENDIENTES
  //
  // La cola del admin necesita al menos una pendiente para tener algo que
  // mostrar. Pero un seed donde TODAS están pendientes esconde la mitad del
  // modelo: no se ve qué aspecto tiene una solicitud resuelta, ni que el
  // usuario puede leer el motivo por el que lo rechazaron.
  //
  // Rosa queda esperando (es la de la cola). Jorge ya fue rechazado una vez:
  // su solicitud sirve para comprobar que `GET /api/auth/mi-solicitud`
  // devuelve el motivo, y que rechazado ≠ bloqueado — puede volver a pedirlo.

  await prisma.solicitudAgente.create({
    data: {
      usuario_id: pendienteVerificacion.id,
      documento: '45678912',
      mensaje:
        'Soy corredora de seguros y quiero pasarme al rubro inmobiliario. Tengo cartera de clientes en Huánuco y Amarilis.',
      estado: 'PENDIENTE',
    },
  });

  await prisma.solicitudAgente.create({
    data: {
      usuario_id: pendienteAgente.id,
      documento: '20678123456',
      mensaje: 'Quiero publicar mis terrenos de Tingo María.',
      estado: 'RECHAZADA',
      // El motivo es obligatorio al rechazar: sin él, el usuario no sabe qué
      // corregir y vuelve a mandar exactamente lo mismo.
      motivo_rechazo:
        'El RUC está a nombre de otra razón social. Vuelve a solicitarlo con el documento a tu nombre o adjunta un poder de representación.',
      revisor_id: admin.id,
      fecha_resolucion: new Date(),
    },
  });

  console.log('✓ 6 usuarios creados (contraseña de todos: Demo1234)');
  console.log(`  Solicitudes de agente: 1 pendiente (${pendienteVerificacion.email}), 1 rechazada (${pendienteAgente.email})`);

  // --- Propiedades ---
  //
  // 📌 LOS PRECIOS ESTÁN INVESTIGADOS, NO INVENTADOS
  //
  // Un departamento de 98 m² a US$ 385,000 en Huánuco no existe: eso es un
  // precio de Miraflores. Sembrar precios de Lima en una ciudad donde el metro
  // cuadrado cuesta entre S/ 1,800 y S/ 3,500 haría que la demo se viera bien
  // y no sirviera para nada — los filtros de precio devolverían resultados
  // absurdos y la estimación por zona, cuando llegue, partiría de datos falsos.
  //
  // Las cifras salen de anuncios reales de Huánuco consultados en portales
  // inmobiliarios: departamentos entre US$ 60,000 (86 m², Fonavi II) y
  // US$ 139,000 (dúplex de 163 m² frente al puente Calicanto), alquileres de
  // S/ 500 a S/ 1,300 al mes, y terrenos en los alrededores desde US$ 42,000.
  const propiedades = [
    {
      // El más caro de la cartera: el centro de Huánuco es la zona más
      // cotizada y este está a dos cuadras de la Plaza de Armas.
      usuario_id: agente.id,
      titulo: 'Departamento a dos cuadras de la Plaza de Armas',
      descripcion:
        'Piso alto en edificio con ascensor, en pleno centro histórico de Huánuco. Sala comedor con balcón a la calle, cocina con muebles altos y bajos, y lavandería independiente. A dos cuadras de la Plaza de Armas y a cinco minutos a pie de la Catedral y del Mercado Antiguo. Ideal para quien quiere vivir sin depender del auto: colegios, bancos y transporte público están a la vuelta.',
      precio: 385000, moneda: 'PEN', tipo: 'VENTA', tipo_inmueble: 'DEPARTAMENTO',
      estado: 'PUBLICADA', area_m2: 110, habitaciones: 3, banos: 2, parkederos: 1,
      distrito_id: mapaDistritos['Huánuco'].id,
      direccion: 'Jr. Dos de Mayo 340, Huánuco',
      latitud: -9.9299, longitud: -76.2401, destacado: true, vistas: 342,
      // Recorrido 3D de ejemplo. Es un espacio de demostración PÚBLICO de
      // Matterport, y se comprobó que responde antes de ponerlo aquí: la otra
      // URL que se probó devolvía 404. Una URL de mentira no rompe el seed,
      // solo deja un iframe en blanco en la ficha — que es peor, porque parece
      // un fallo del visor.
      //
      // Este usuario tiene plan PRO vigente, así que puede tenerlo.
      tour_3d_url: 'https://my.matterport.com/show/?m=SxQL3iGyoDo',
    },
    {
      // Frente al malecón y al puente Calicanto (1879-1884, patrimonio de la
      // nación). La vista al río Huallaga es lo que sostiene el precio.
      usuario_id: agente.id,
      titulo: 'Ático dúplex con terraza frente al malecón Alomía Robles',
      descripcion:
        'Dos niveles unidos por escalera de madera, con terraza propia de 35 m² mirando al río Huallaga. Cuatro dormitorios, dormitorio de servicio y cochera doble. El edificio tiene vigilancia 24 horas y ascensor directo. A pasos del puente Calicanto y del paseo ribereño: se puede cruzar el río caminando hasta Amarilis.',
      precio: 139000, moneda: 'USD', tipo: 'VENTA', tipo_inmueble: 'DEPARTAMENTO',
      estado: 'PUBLICADA', area_m2: 163, habitaciones: 4, banos: 3, parkederos: 2,
      distrito_id: mapaDistritos['Huánuco'].id,
      direccion: 'Av. Malecón Leoncio Prado 220, Huánuco',
      latitud: -9.9320, longitud: -76.2380, destacado: false, vistas: 128,
    },
    {
      usuario_id: propietario.id,
      titulo: 'Local comercial en el Jr. 28 de Julio, alto tráfico',
      descripcion:
        'Local de 180 m² a media cuadra del Mercado Antiguo, una de las vías más transitadas del centro. Dos entradas con 4 metros de frente cada una y almacén interior. Actualmente alquilado a una botica, con contrato vigente hasta fin de año: se vende con el inquilino dentro, lo que lo hace rentable desde el primer día.',
      precio: 165000, moneda: 'USD', tipo: 'VENTA', tipo_inmueble: 'LOCAL_COMERCIAL',
      estado: 'PUBLICADA', area_m2: 180, habitaciones: 0, banos: 2, parkederos: 1,
      distrito_id: mapaDistritos['Huánuco'].id,
      direccion: 'Jr. 28 de Julio 620, Huánuco',
      latitud: -9.9280, longitud: -76.2415, destacado: false, vistas: 176,
    },
    {
      usuario_id: agente.id,
      titulo: 'Oficina implementada en el centro, lista para entrar',
      descripcion:
        'Oficina de 95 m² distribuida en recepción, dos privados y sala de reuniones para ocho personas. Cableado estructurado ya instalado y aire acondicionado en todos los ambientes. El alquiler incluye un estacionamiento y el mantenimiento del edificio. A una cuadra de la Iglesia La Merced.',
      precio: 2800, moneda: 'PEN', tipo: 'ALQUILER', tipo_inmueble: 'OFICINA',
      estado: 'PUBLICADA', area_m2: 95, habitaciones: 3, banos: 1, parkederos: 1,
      distrito_id: mapaDistritos['Huánuco'].id,
      direccion: 'Jr. Hermilio Valdizán 555, Huánuco',
      latitud: -9.9275, longitud: -76.2425, destacado: false, vistas: 95,
    },
    {
      // En Amarilis, al otro lado del río. Es el distrito residencial por
      // excelencia: casas con patio, calles tranquilas.
      usuario_id: propietario.id,
      titulo: 'Casa con patio y cochera doble en Amarilis',
      descripcion:
        'Casa de dos pisos en calle tranquila, a cinco minutos del puente Calicanto. Tiene patio con jardín, cochera techada para dos autos y cocina remodelada. Los tres dormitorios están arriba, con closets empotrados. El colegio y el mercado de Paucarbamba quedan a pocas cuadras.',
      precio: 1300, moneda: 'PEN', tipo: 'ALQUILER', tipo_inmueble: 'CASA',
      estado: 'PUBLICADA', area_m2: 145, habitaciones: 3, banos: 2, parkederos: 2,
      distrito_id: mapaDistritos['Amarilis'].id,
      direccion: 'Av. Esteban Pabletich 450, Amarilis',
      latitud: -9.9455, longitud: -76.2405, destacado: false, vistas: 87,
      // 📌 ESTE RECORRIDO 3D ES UN CASO LÍMITE A PROPÓSITO.
      //
      // Lucia tiene el plan PRO VENCIDO hace 15 días. La propiedad conserva el
      // 3D que publicó cuando estaba al día —quitárselo sería borrarle
      // contenido que ya había pagado— pero si hoy intenta poner uno nuevo o
      // cambiar este, recibe un 403. Es justo la distinción que hace
      // `resolverTour3D`: "reenviar lo que ya estaba" no es "usar el plan".
      tour_3d_url: 'https://my.matterport.com/show/?m=SxQL3iGyoDo',
    },
    {
      // Pillco Marca es lo nuevo de la ciudad: de estreno y cerca de la
      // universidad, que es lo que mueve ese mercado.
      usuario_id: agente.id,
      titulo: 'Departamento de estreno cerca de la UNHEVAL',
      descripcion:
        'Sin estrenar. Pisos de porcelanato, cocina con isla y muebles altos, y closets en los tres dormitorios. Edificio de seis pisos con ascensor y azotea con zona de parrilla. Av. Universitaria a una cuadra. Pensado para alquilar a estudiantes o docentes: la universidad queda a menos de diez minutos caminando.',
      precio: 298000, moneda: 'PEN', tipo: 'VENTA', tipo_inmueble: 'DEPARTAMENTO',
      estado: 'PUBLICADA', area_m2: 88, habitaciones: 3, banos: 2, parkederos: 1,
      distrito_id: mapaDistritos['Pillco Marca'].id,
      direccion: 'Av. Universitaria 1250, Pillco Marca',
      latitud: -9.9570, longitud: -76.2480, destacado: false, vistas: 213,
    },
    {
      usuario_id: propietario.id,
      titulo: 'Terreno de 320 m² listo para construir',
      descripcion:
        'Terreno plano con frente de 16 metros sobre la carretera, a la altura del kilómetro 8. Tiene luz, agua y desagüe en la puerta. Uso residencial permitido y título inscrito en Registros Públicos. Zona en crecimiento: hay obra nueva en las dos manzanas contiguas.',
      precio: 42000, moneda: 'USD', tipo: 'VENTA', tipo_inmueble: 'TERRENO',
      estado: 'PUBLICADA', area_m2: 320, habitaciones: 0, banos: 0, parkederos: 0,
      distrito_id: mapaDistritos['Santa María del Valle'].id,
      direccion: 'Carretera Huánuco–Santa María del Valle km 8',
      latitud: -9.8640, longitud: -76.1720, destacado: false, vistas: 54,
    },
    {
      usuario_id: propietario.id,
      titulo: 'Casa de campo con huerta en Churubamba',
      descripcion:
        'Casa de 210 m² construidos sobre un terreno de 800 m², con huerta de frutales y agua de manantial. Tiene corral para animales menores y cochera para tres autos. A 20 minutos de Huánuco por carretera asfaltada. El clima es más frío que en la capital, ideal para quien busca retirarse del ruido.',
      precio: 85000, moneda: 'USD', tipo: 'VENTA', tipo_inmueble: 'CASA',
      estado: 'PUBLICADA', area_m2: 210, habitaciones: 4, banos: 2, parkederos: 3,
      distrito_id: mapaDistritos['Churubamba'].id,
      direccion: 'Jr. Los Álamos s/n, Churubamba',
      latitud: -9.8265, longitud: -76.1345, destacado: false, vistas: 66,
    },
    {
      // El borrador existe para poder probar que un aviso sin publicar NO
      // aparece en el buscador público. Es una prueba, no una propiedad.
      usuario_id: agente.id,
      titulo: 'Proyecto en borrador: edificio de departamentos en Tingo María',
      descripcion:
        'Borrador de planificación. Todavía no se publica al público.',
      precio: 78000, moneda: 'USD', tipo: 'VENTA', tipo_inmueble: 'DEPARTAMENTO',
      estado: 'BORRADOR', area_m2: 75, habitaciones: 2, banos: 2, parkederos: 1,
      distrito_id: mapaDistritos['Tingo María'].id,
      direccion: 'Por definir, Tingo María',
      latitud: -9.2990, longitud: -76.0000, destacado: false, vistas: 0,
    },
  ];

  for (const [indice, datos] of propiedades.entries()) {
    await prisma.propiedad.create({
      data: {
        ...datos,
        slug: `${datos.titulo
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')}-${indice + 1}`,
        imagenes: [],
      },
    });
  }
  console.log(`✓ ${propiedades.length} propiedades creadas`);

  // --- Leads de ejemplo para el CRM ---
  //
  // 📌 POR QUÉ SE BUSCAN POR TÍTULO Y NO POR ÍNDICE
  //
  // Antes esto era `todas[0]` y `todas[2]`, con `todas = findMany(...)` SIN
  // `orderBy`. Eso tiene dos problemas:
  //
  //  1. Postgres NO garantiza el orden de un `findMany` sin `orderBy`. Hoy
  //     devuelve el orden de inserción y mañana, tras un `UPDATE` o un
  //     `VACUUM`, puede devolver otro. El mensaje del lead apuntaría a la
  //     propiedad equivocada sin que nada falle.
  //
  //  2. Ya estaba mal: `todas[2]` es el LOCAL COMERCIAL del Jr. 28 de Julio,
  //     pero su mensaje hablaba de "la casa de Pueblo Libre". El texto y la
  //     propiedad llevaban sin corresponderse desde el seed de Lima.
  //
  // Buscar por el slug ata el mensaje a la propiedad de verdad y sobrevive a
  // que alguien reordene el array de arriba.
  const departamentoCentro = await prisma.propiedad.findFirstOrThrow({
    where: { slug: { startsWith: 'departamento-a-dos-cuadras' } },
    select: { id: true },
  });

  const casaAmarilis = await prisma.propiedad.findFirstOrThrow({
    where: { slug: { startsWith: 'casa-con-patio-y-cochera' } },
    select: { id: true },
  });

  await prisma.contacto.create({
    data: {
      propiedad_id: departamentoCentro.id,
      cliente_id: cliente.id,
      agente_id: agente.id,
      // El texto del lead imita a un cliente real de Huánuco. El anterior
      // pedía "vista al mar", que en una región andina a 1,900 m no existe:
      // era un resto del seed de Lima.
      mensaje:
        'Hola, me interesa mucho el departamento del centro. ¿Sigue disponible? Quisiera agendar una visita este sábado por la mañana.',
      email_contacto: 'cliente@innover.dev',
      telefono_contacto: '955443322',
      estado: 'NUEVO',
    },
  });

  await prisma.contacto.create({
    data: {
      propiedad_id: casaAmarilis.id,
      cliente_id: cliente.id,
      propietario_id: propietario.id,
      mensaje:
        'Buenas tardes, la casa de Amarilis me interesa para mi familia. ¿El alquiler incluye el mantenimiento del jardín?',
      email_contacto: 'cliente@innover.dev',
      telefono_contacto: '955443322',
      estado: 'EN_PROCESO',
    },
  });

  console.log('✓ 2 leads de ejemplo creados');

  // --- Comprobación: el trigger de PostGIS debió calcular locacion ---
  const conUbicacion = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total
    FROM "Propiedad"
    WHERE "locacion" IS NOT NULL
  `);
  console.log(`✓ PostGIS calculó ${conUbicacion[0].total} coordenadas automáticamente`);

  console.log('\n' + '='.repeat(50));
  console.log('  Datos de ejemplo listos.');
  console.log('\n  Cuentas para entrar (contraseña: Demo1234)');
  console.log('    admin@innover.dev        Administrador');
  console.log('    agente@innover.dev       Agente inmobiliario');
  console.log('    propietario@innover.dev  Propietario directo');
  console.log('    cliente@innover.dev       Comprador / inquilino');
  console.log('='.repeat(50) + '\n');
}

main()
  .catch((error) => {
    console.error('\n✖ Error al sembrar la base de datos:');
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
