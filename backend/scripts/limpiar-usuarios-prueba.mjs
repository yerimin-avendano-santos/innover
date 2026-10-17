/**
 * Borra SOLO los usuarios creados automáticamente por las suites de
 * pruebas, conservando los datos de ejemplo del seed.
 *
 * A diferencia de `npm run seed`, este script NO toca propiedades de
 * ejemplo, contactos ni distritos: solo limpia usuarios basura.
 *
 * Uso: node scripts/limpiar-usuarios-prueba.mjs
 *      node scripts/limpiar-usuarios-prueba.mjs --ejecutar
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/*
 * ⚠️ POR QUÉ SE FILTRA POR PREFIJO Y NO POR DOMINIO
 *
 * La primera versión usaba `email contains '@innover.dev'` menos una
 * lista de cuentas demo. Funcionaba mientras el seed creara 4 usuarios,
 * pero en cuanto `seed.js` añadió cuentas con documento pendiente
 * (`rosa.pendiente`, `jorge.pendiente`), la limpieza se las llevó como
 * si fueran basura: borró la cola de verificación del panel de admin.
 *
 * El filtro correcto no es "todo lo que no sea demo", sino
 * "exactamente lo que las pruebas crean". Los prefijos son ese filtro:
 * un nombre de cuenta del seed nunca empieza por `test-` ni por `puente-`.
 *
 * Si mañana el seed crea una cuenta nueva, este script la respeta sin
 * tocar una línea.
 */

/** Cuentas que crea `prisma/seed.js`. Solo informational. */
const CUENTAS_DEMO = [
  'admin@innover.dev',
  'agente@innover.dev',
  'propietario@innover.dev',
  'cliente@innover.dev',
  'rosa.pendiente@innover.dev',
  'jorge.pendiente@innover.dev',
];

/**
 * Prefijos que generan las suites de pruebas.
 *
 *   test-cliente-  pruebas.mjs        (el "cliente" del escenario de roles)
 *   test-intruso-  pruebas.mjs        (el que intenta robar propiedades)
 *   puente-        pruebas-puente.mjs (alta a través del puente SSR)
 *   corto-         pruebas.mjs        (registro con contraseña de 3 letras)
 *
 * ⚠️ `corto-` se añadió al descubrir que el filtro anterior lo cubría
 * solo por casualidad (caía dentro del dominio). Con el filtro por
 * prefijo hay que nombrarlo explícitamente o ese usuario se acumula
 * para siempre.
 */
const PREFIJOS_PRUEBA = ['test-cliente-', 'test-intruso-', 'puente-', 'corto-'];

const ejecutar = process.argv.includes('--ejecutar');

try {
  const candidatos = await prisma.usuario.findMany({
    where: {
      OR: PREFIJOS_PRUEBA.map((prefijo) => ({
        email: { startsWith: prefijo },
      })),
    },
    select: { id: true, email: true, _count: { select: { propiedades: true, contactosComoCliente: true } } },
  });

  // Salvaguarda: si alguna cuenta demo apareciera en la lista (porque
  // alguien le puso un prefijo de prueba por error), no se borra.
  const aBorrar = candidatos.filter((u) => !CUENTAS_DEMO.includes(u.email));

  if (aBorrar.length === 0) {
    console.log('✓ No hay usuarios de prueba. La base ya está limpia.');
    console.log(`  Cuentas de ejemplo intactas: ${CUENTAS_DEMO.length}`);
    process.exit(0);
  }

  console.log(`Encontrados ${aBorrar.length} usuarios de prueba:\n`);
  for (const u of aBorrar) {
    console.log(`  #${u.id} ${u.email}  (props=${u._count.propiedades}, leads=${u._count.contactosComoCliente})`);
  }

  // Aviso de lo que se lleva por delante. Conviene decirlo bien, porque el
  // texto anterior decía que las propiedades quedaban huérfanas y es justo lo
  // que el script evita: una cuenta de prueba con propiedades es la que llenó
  // `/sitemap.xml` de anuncios falsos.
  //
  //   - leads y solicitudes de agente → en cascada (ON DELETE CASCADE)
  //   - sesiones abiertas (TokenRenovacion) → en cascada también: una sesión de
  //     una cuenta que ya no existe no significa nada
  //   - propiedades → se borran aquí abajo, antes que los usuarios
  const conDatos = aBorrar.filter(
    (u) => u._count.propiedades > 0 || u._count.contactosComoCliente > 0
  );

  if (conDatos.length > 0) {
    console.log(`\n⚠️  ${conDatos.length} tienen propiedades o leads asociados.`);
    console.log('   Se van con ellos: sus leads y solicitudes de agente caen en');
    console.log('   cascada y sus propiedades se borran justo a continuación.');
  }

  if (!ejecutar) {
    console.log('\n(Simulación. Añade --ejecutar para borrar de verdad.)');
    process.exit(0);
  }

  // Las propiedades creadas por las pruebas se borran primero para no
  // dejar filas apuntando a un usuario inexistente.
  const ids = aBorrar.map((u) => u.id);

  const propsBorradas = await prisma.propiedad.deleteMany({
    where: { usuario_id: { in: ids } },
  });

  const { count } = await prisma.usuario.deleteMany({ where: { id: { in: ids } } });

  console.log(`\n✓ ${count} usuarios y ${propsBorradas.count} propiedades eliminados.`);

  // Comprobación: el seed debe seguir intacto.
  const demoIntactas = await prisma.usuario.count({
    where: { email: { in: CUENTAS_DEMO } },
  });

  if (demoIntactas !== CUENTAS_DEMO.length) {
    console.warn(
      `\n⚠️  Faltan cuentas de ejemplo: ${CUENTAS_DEMO.length - demoIntactas}.\n` +
        '   Ejecuta `npm run seed` para restaurarlas.'
    );
  } else {
    console.log(`  Cuentas de ejemplo intactas: ${demoIntactas}/${CUENTAS_DEMO.length}`);
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
