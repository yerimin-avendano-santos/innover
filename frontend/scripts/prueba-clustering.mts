// ========================================
// 🧩 PRUEBA DEL AGRUPADOR DEL MAPA
// ========================================
// `src/lib/clustering.ts` es lógica pura —no toca el DOM ni Mapbox ni React—
// así que se puede probar sin navegador. Es la primera prueba unitaria del
// frontend, y existe por los casos raros que no se ven mirando la pantalla:
// ¿dos casas a 30 m a zoom 12 son un grupo o dos? ¿el grupo se rompe al
// acercarse? ¿alguna propiedad se pierde por el camino?
//
// Se ejecuta con:
//
//     npm run verificar:clustering --workspace=frontend
//
// Node ejecuta el TypeScript tal cual (v22.18+ ya trae el borrado de tipos
// activado). Los archivos solo usan sintaxis borrable —interfaces, `as`,
// `import type`—, que es justo lo que esa opción permite.
//
// ⚠️ El `--disable-warning` del script de npm no es decorativo: `frontend/`
// no declara `"type": "module"` (es un proyecto Next, y cambiarlo afectaría a
// cómo se interpretan todos sus `.js`), así que Node avisa al importar el `.ts`
// como módulo. El aviso es inofensivo pero ensucia la salida, y una salida con
// ruido constante es una salida que nadie lee.
//
// 📌 POR QUÉ NO ES `.mjs`: tendría que importar el `.ts` con una extensión que
// TypeScript no deja usar dentro de `src/` (el proyecto compila con
// `moduleResolution: bundler`). `.mts` deja las dos cosas en paz: Node ve un
// módulo, TypeScript ve un archivo del proyecto.

import {
  claseDeGrupo,
  crearIndice,
  ZOOM_SIN_GRUPOS,
  type Limites,
} from '../src/lib/clustering.ts';
import type { PuntoMapa } from '../src/lib/tipos.ts';

// ========================================
// Utilidades
// ========================================

let fallos = 0;

function afirmar(condicion: boolean, mensaje: string, detalle?: unknown): void {
  if (condicion) {
    console.log(`  ✓ ${mensaje}`);
  } else {
    fallos++;
    const extra = detalle === undefined ? '' : ` → ${JSON.stringify(detalle)}`;
    console.error(`  ✗ ${mensaje}${extra}`);
  }
}

function seccion(titulo: string): void {
  console.log(`\n${titulo}`);
}

/** Un punto de mentira con lo justo que necesita el mapa. */
function punto(
  id: number,
  latitud: number,
  longitud: number,
  extra: Partial<PuntoMapa> = {}
): PuntoMapa {
  return {
    id,
    latitud,
    longitud,
    titulo: `Propiedad ${id}`,
    precio: 250000,
    moneda: 'PEN',
    tipo_inmueble: 'DEPARTAMENTO',
    habitaciones: 3,
    area_m2: 100,
    destacado: false,
    distrito: { id: 1, nombre: 'Huánuco' },
    ...extra,
  };
}

/** La manzana de Huánuco donde se apiñan las casas de la prueba. */
const VENTANA: Limites = [-76.25, -9.935, -76.23, -9.925];

/** Cuatro casas a menos de 200 m entre sí. */
const MANZANA = [
  punto(11, -9.9293, -76.2395),
  punto(12, -9.9295, -76.2398),
  punto(13, -9.929, -76.239),
  punto(14, -9.9298, -76.2392),
];

// ========================================
seccion('1. Sin puntos no hay índice');
// ========================================
afirmar(crearIndice([]) === null, 'una búsqueda sin resultados no crea índice');

// ========================================
seccion('2. Lo que está lejos no se agrupa');
// ========================================
{
  // Huánuco capital y Tingo María están a unos 120 km: a cualquier zoom de
  // ciudad son dos cosas distintas, no "lo mismo".
  const indice = crearIndice([
    punto(1, -9.9293, -76.2395),
    punto(2, -9.2952, -75.9975),
  ]);

  const elementos = indice!.elementos([-77.5, -10.5, -75, -9], 12);
  afirmar(elementos.length === 2, 'dos puntos a 120 km se pintan sueltos a zoom 12', elementos.length);
  afirmar(
    elementos.every((e) => e.tipo === 'propiedad'),
    'y ninguno se convierte en grupo'
  );
}

// ========================================
seccion('3. Lo que está junto se agrupa, y el grupo se abre al acercarse');
// ========================================
{
  const indice = crearIndice(MANZANA);

  const lejos = indice!.elementos(VENTANA, 12);
  afirmar(lejos.length === 1, 'a zoom 12, cuatro casas de la misma manzana son UN grupo', lejos.length);

  const grupo = lejos[0];
  afirmar(grupo?.tipo === 'grupo', 'y lo que sale es un grupo, no una chincheta');
  afirmar(
    grupo?.tipo === 'grupo' && grupo.cantidad === 4,
    'con las cuatro propiedades dentro',
    grupo?.tipo === 'grupo' ? grupo.cantidad : 'tipo inesperado'
  );

  // El mismo encuadre, más zoom: es como se abre un grupo de verdad.
  const cerca = indice!.elementos(VENTANA, ZOOM_SIN_GRUPOS);
  afirmar(
    cerca.length === 4,
    `a zoom ${ZOOM_SIN_GRUPOS} (el de "sin grupos") se ven las cuatro sueltas`,
    cerca.length
  );
  afirmar(
    cerca.every((e) => e.tipo === 'propiedad'),
    'y ninguna sigue siendo un grupo'
  );
}

// ========================================
seccion('4. Saber qué grupo esconde una propiedad');
// ========================================
{
  const indice = crearIndice(MANZANA);

  const escondida = indice!.grupoQueEsconde(13, VENTANA, 12);
  afirmar(escondida !== null, 'a zoom 12, la propiedad 13 está dentro de un grupo');
  afirmar(
    escondida !== null && escondida.cantidad === 4,
    'y se sabe que es el grupo de cuatro',
    escondida?.cantidad
  );

  afirmar(
    indice!.grupoQueEsconde(13, VENTANA, ZOOM_SIN_GRUPOS) === null,
    `a zoom ${ZOOM_SIN_GRUPOS} ya no la esconde nada`
  );
  afirmar(
    indice!.grupoQueEsconde(999, VENTANA, 12) === null,
    'una propiedad que no está en el mapa no está en ningún grupo'
  );
}

// ========================================
seccion('5. Un grupo que ya no existe no rompe el mapa');
// ========================================
{
  const indice = crearIndice(MANZANA);

  // Esto pasa de verdad: el usuario pulsa un grupo y el mapa ya se movió (o la
  // búsqueda cambió y el índice se rehizo) entre el clic y el cálculo.
  //
  // supercluster no valida los ids: con uno inventado a veces lanza y a veces
  // calcula un número absurdo (medido: 999999 → zoom 26). Las dos cosas tienen
  // que quedarse en `null`, porque el rango válido es 0..ZOOM_SIN_GRUPOS.
  const inventado = indice!.zoomDeExpansion(999999);
  afirmar(
    inventado === null,
    'un grupo inexistente no devuelve un zoom absurdo',
    inventado
  );
  afirmar(
    indice!.zoomDeExpansion(0) === null,
    'y un id por el que supercluster lanza tampoco se propaga'
  );

  const real = indice!.elementos(VENTANA, 12)[0];
  afirmar(
    real?.tipo === 'grupo' && typeof indice!.zoomDeExpansion(real.id) === 'number',
    'y el de un grupo real es un número'
  );
}

// ========================================
seccion('6. El tamaño del grupo');
// ========================================
afirmar(claseDeGrupo(2) === 'marcador-grupo-chico', '2 propiedades → grupo pequeño');
afirmar(claseDeGrupo(9) === 'marcador-grupo-chico', '9 → pequeño');
afirmar(claseDeGrupo(10) === 'marcador-grupo-medio', '10 → mediano');
afirmar(claseDeGrupo(99) === 'marcador-grupo-medio', '99 → mediano');
afirmar(claseDeGrupo(100) === 'marcador-grupo-grande', '100 → grande');

// ========================================
seccion('7. No se pierde ninguna propiedad');
// ========================================
{
  // 60 propiedades repartidas en tres focos. La suma de los grupos más las
  // sueltas tiene que dar 60: si el agrupador se comiera una, el mapa diría
  // que hay menos de las que hay y nadie se enteraría.
  const focos: Array<[number, number]> = [
    [-9.9293, -76.2395],
    [-9.945, -76.255],
    [-9.91, -76.22],
  ];

  const puntos: PuntoMapa[] = [];
  for (let i = 0; i < 60; i++) {
    const [lat, lng] = focos[i % focos.length];
    puntos.push(punto(100 + i, lat + (i % 5) * 0.0003, lng + (i % 7) * 0.0003));
  }

  const indice = crearIndice(puntos)!;
  const elementos = indice.elementos([-77, -10.2, -75.5, -9.5], 12);
  const suma = elementos.reduce(
    (total, e) => total + (e.tipo === 'grupo' ? e.cantidad : 1),
    0
  );

  afirmar(suma === 60, 'la suma de grupos y sueltas da las 60 propiedades', suma);
  afirmar(
    elementos.length < 60,
    'y de verdad se agruparon (si no, la prueba no estaría probando nada)',
    elementos.length
  );
}

// ========================================
seccion('8. Solo se pinta lo que cae en la ventana');
// ========================================
{
  const indice = crearIndice([
    punto(201, -9.9293, -76.2395),
    punto(202, -9.4, -75.6),
  ]);

  const enVentana = indice!.elementos([-76.3, -10, -76.2, -9.9], 16);
  afirmar(enVentana.length === 1, 'el punto de fuera de la ventana no se pinta', enVentana.length);
  afirmar(
    enVentana[0]?.tipo === 'propiedad' && enVentana[0].punto.id === 201,
    'y el que se pinta es el de dentro'
  );
}

// ========================================
console.log('');
if (fallos > 0) {
  console.error(`✗ ${fallos} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log('✓ El agrupador del mapa se comporta como se espera.');
