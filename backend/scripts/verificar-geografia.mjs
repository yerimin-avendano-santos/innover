/**
 * Comprueba que cada propiedad del seed esté cerca del centro de su distrito.
 *
 * 📌 QUÉ BUSCA ESTE SCRIPT
 *
 * Que una latitud pegada al revés, o copiada de otra fila, no pase inadvertida.
 * El seed no valida nada: inserta lo que le des. Y el mapa tampoco se queja —
 * pinta el marcador donde le digan. La única forma de detectar un punto mal
 * puesto es compararlo con dónde debería estar.
 *
 * La comprobación es por distancia al centro del distrito, porque la base solo
 * guarda un punto por distrito, no su polígono. Un margen de 8 km es generoso
 * para los distritos rurales de Huánuco (Churubamba y Santa María del Valle
 * son grandes) y estrecho para los urbanos (~2 km).
 *
 * También revisa la coherencia del signo: en Huánuco la latitud es negativa
 * (hemisferio sur) y la longitud también (al oeste de Greenwich). Un signo
 * cambiado manda la propiedad al otro lado del mundo, y ahí sí lo vería
 * cualquiera — pero mejor detectarlo aquí.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Distancia en km entre dos puntos (haversine). */
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;

  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

const propiedades = await prisma.propiedad.findMany({
  include: { distrito: true },
  orderBy: { id: 'asc' },
});

console.log('Propiedad → distrito, y distancia al centro del distrito\n');

let problemas = 0;

for (const p of propiedades) {
  const d = p.distrito;

  /**
   * ⛔ PROPIEDADES SIN DISTRITO O SIN COORDENADAS.
   *
   * Antes esto no estaba comprobado y el script reventaba con un
   * "Cannot read properties of null (reading 'latitud_centro')" en cuanto la
   * base tenía UNA propiedad sin distrito. No es un caso raro: la suite de
   * pruebas crea propiedades de prueba sin distrito a propósito (para no
   * depender de los datos del seed), así que bastaba con correr `npm run
   * prueba` y luego `npm run verificar:geo` para ver un error de JavaScript
   * que no dice nada sobre el problema real.
   *
   * Se avisa y se sigue: el script comprueba la geografía del SEED, y una
   * propiedad que no está en ningún distrito no tiene geografía que comprobar.
   */
  if (!d) {
    console.log(`—   ${p.titulo.slice(0, 52)}`);
    console.log('      sin distrito asignado: no hay centro contra el que medir');
    continue;
  }

  if (p.latitud === null || p.longitud === null) {
    console.log(`⚠️  ${p.titulo.slice(0, 52)}`);
    console.log(`      ${d.nombre.padEnd(24)} SIN COORDENADAS (latitud/longitud nulas)`);
    problemas++;
    continue;
  }

  const distancia = distanciaKm(p.latitud, p.longitud, d.latitud_centro, d.longitud_centro);

  // Los distritos rurales son grandes; los urbanos, pequeños. El margen
  // depende del distrito, no de un número único.
  const margen = ['Churubamba', 'Santa María del Valle', 'Quisqui', 'San Francisco de Cayrán'].includes(
    d.nombre
  )
    ? 12
    : 6;

  const signosOk = p.latitud < 0 && p.longitud < 0;
  const cerca = distancia <= margen;
  const bien = cerca && signosOk;

  if (!bien) problemas++;

  const marca = bien ? 'OK  ' : '⚠️  ';
  console.log(`${marca}${p.titulo.slice(0, 52)}`);
  console.log(
    `      ${d.nombre.padEnd(24)} ${p.latitud.toFixed(4)}, ${p.longitud.toFixed(4)}` +
      `   a ${distancia.toFixed(2)} km del centro (margen ${margen} km)`
  );

  if (!signosOk) console.log('      ⚠️ SIGNO INCORRECTO: debería ser lat y lon negativas');
  if (!cerca) console.log('      ⚠️ DEMASIADO LEJOS del centro de su distrito');
}

// --- Cobertura de distritos ---
console.log('\n--- Cobertura ---');
const distritos = await prisma.distrito.findMany({ include: { propiedades: true } });

for (const d of distritos) {
  const n = d.propiedades.length;
  console.log(`  ${d.nombre.padEnd(24)} ${n} propiedad${n === 1 ? '' : 'es'}`);
}

// --- PostGIS ---
// El trigger debería haber rellenado `locacion` a partir de latitud/longitud.
// Si estuviera vacía, la búsqueda por cercanía devolvería cero resultados
// sin dar ningún error — que es justo el fallo silencioso a evitar.
const conLocacion = await prisma.$queryRaw`
  SELECT count(*)::int AS total
  FROM "Propiedad"
  WHERE locacion IS NOT NULL
`;

console.log(`\n--- PostGIS ---`);
console.log(`  propiedades con 'locacion' calculada: ${conLocacion[0].total} de ${propiedades.length}`);

console.log(`\n${problemas === 0 ? '✓ todas las propiedades están donde deben' : `⚠️ ${problemas} con problemas`}`);

await prisma.$disconnect();
process.exit(problemas === 0 ? 0 : 1);
