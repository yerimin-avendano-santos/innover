/**
 * Comprueba que los colores del sistema de diseño se puedan leer.
 *
 * ── Por qué existe este archivo ──
 *
 * Un sistema de color con hexadecimales dentro PARECE correcto siempre.
 * La vista no distingue 4,1:1 de 4,6:1: los dos se ven bien en la
 * pantalla de quien los elige, con el brillo que tenga puesto. La
 * diferencia solo aparece cuando alguien con poca vista —o con el
 * portátil a pleno sol— intenta leer un botón.
 *
 * Por eso el contraste no se estima: se calcula. Y por eso el cálculo
 * LEE `globals.css` en vez de tener los colores copiados: si alguien
 * cambia un token por uno que no se lee, esta comprobación falla. Copiar
 * los valores aquí sería inútil, porque comprobaría mi copia y no el
 * diseño de verdad.
 *
 * Se ejecuta desde `frontend/`:
 *
 *     npm run verificar:contraste
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const RUTA_CSS = join(aqui, '..', 'src', 'app', 'globals.css');

// ========================================
// 1. Leer los tokens del CSS
// ========================================

/**
 * Saca los tokens de color declarados dentro de `@theme`.
 *
 * Solo mira el bloque `@theme`, no todo el archivo: en las clases de
 * componente también hay `var(--color-...)` y confundir unas con otras
 * daría un mapa incompleto sin avisar.
 */
function leerTokens(css) {
  const inicio = css.indexOf('@theme');
  if (inicio === -1) throw new Error('No se encontró el bloque @theme en globals.css');

  // Se recorre desde `@theme` contando llaves hasta cerrar el bloque.
  let i = css.indexOf('{', inicio);
  let profundidad = 0;
  let fin = -1;
  for (let j = i; j < css.length; j++) {
    if (css[j] === '{') profundidad++;
    else if (css[j] === '}') {
      profundidad--;
      if (profundidad === 0) {
        fin = j;
        break;
      }
    }
  }
  if (fin === -1) throw new Error('El bloque @theme no cierra');

  const bloque = css.slice(i + 1, fin);
  const tokens = {};

  for (const linea of bloque.split('\n')) {
    // Quita el comentario final antes de leer el valor, o un `/* ... */`
    // que contenga dos puntos se colaría como parte del color.
    const codigo = linea.split('/*')[0];
    const m = codigo.match(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/);
    if (m) tokens[m[1].replace('--color-', '')] = m[2];
  }

  return tokens;
}

// ========================================
// 2. Calcular el contraste
// ========================================

/** Convierte `#rrggbb` a sus tres componentes 0-255. */
function aRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6); // se ignora el alfa
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/**
 * Luminancia relativa, según la fórmula de la WCAG.
 *
 * No es la media de los canales: el ojo es mucho más sensible al verde
 * que al azul, así que cada canal se corrige primero a espacio lineal y
 * después se pondera (0.2126 rojo, 0.7152 verde, 0.0722 azul). Usar la
 * media daría por buenos colores que no se leen.
 */
function luminancia(hex) {
  const [r, g, b] = aRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Cociente de contraste entre dos colores.
 *
 * El +0.05 del numerador y el denominador no es un ajuste: la fórmula
 * suma 0.05 a las dos luminancias porque incluso el negro absoluto
 * refleja algo de luz. Va de 1:1 (idénticos) a 21:1 (negro sobre blanco).
 */
function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

// ========================================
// 3. Las combinaciones que importan
// ========================================
//
// No se comprueban todos los pares posibles, porque la mayoría no
// aparece nunca en pantalla y una lista larga de irrelevantes se deja
// de leer. Se comprueba cada combinación de texto y fondo que el
// producto usa de verdad.

const NORMAL = 4.5; // Texto por debajo de 18,66 px en negrita o 24 px normal.
const GRANDE = 3.0; // Títulos y texto grande.
const NO_TEXTO = 3.0; // Bordes, iconos y anillos de foco.

const COMBINACIONES = [
  // ── Texto sobre el fondo de la página ──
  { texto: 'tinta', fondo: 'papel', minimo: NORMAL, donde: 'Texto principal' },
  { texto: 'tinta-70', fondo: 'papel', minimo: NORMAL, donde: 'Párrafos' },
  { texto: 'tinta-50', fondo: 'papel', minimo: NORMAL, donde: 'Texto de apoyo' },
  {
    texto: 'tinta-30',
    fondo: 'papel',
    minimo: GRANDE,
    donde: 'Placeholders (no se usa para texto que haya que leer)',
  },
  { texto: 'senal', fondo: 'papel', minimo: NORMAL, donde: 'Enlaces' },
  { texto: 'alerta', fondo: 'papel', minimo: NORMAL, donde: 'Mensajes de error' },
  { texto: 'aviso', fondo: 'papel', minimo: NORMAL, donde: 'Mensajes de aviso' },
  { texto: 'destacado', fondo: 'papel', minimo: NORMAL, donde: 'Aviso de destaque' },
  // No hay entradas para un verde de éxito ni un azul de información
  // porque esos tokens no existen todavía: se añadirán con la primera
  // pantalla que los use. Ver `verificar-tokens.mjs`.

  // ── Texto sobre las tarjetas ──
  { texto: 'tinta', fondo: 'papel-alto', minimo: NORMAL, donde: 'Título y precio de tarjeta' },
  { texto: 'tinta-50', fondo: 'papel-alto', minimo: NORMAL, donde: 'Apoyo en tarjeta' },
  {
    texto: 'senal',
    fondo: 'papel-alto',
    minimo: NORMAL,
    donde: 'Enlaces de la tarjeta al pasar por encima',
  },

  // ── Botones ──
  { texto: 'sobre-marino', fondo: 'senal', minimo: NORMAL, donde: 'Botón principal (texto blanco)' },
  {
    texto: 'marino',
    fondo: 'turquesa',
    minimo: NORMAL,
    donde: 'Botón de marca y avatar (texto marino)',
  },
  { texto: 'sobre-marino', fondo: 'alerta', minimo: NORMAL, donde: 'Botón de borrar' },
  { texto: 'tinta', fondo: 'papel-hundido', minimo: NORMAL, donde: 'Botón secundario al pasar' },

  // ── Barra de navegación ──
  // La barra dejó de ser marino: es el teal hondo del boceto. El chip
  // activo se invierte (blanco con texto teal) y los inactivos usan
  // `sobre-senal-tenue`. Los pares viejos de `marino-alto` se fueron con
  // los tokens.
  {
    texto: 'sobre-marino',
    fondo: 'senal-hondo',
    minimo: NORMAL,
    donde: 'Marca y nombre en la barra',
  },
  {
    texto: 'sobre-senal-tenue',
    fondo: 'senal-hondo',
    minimo: NORMAL,
    donde: 'Enlaces de la barra',
  },
  {
    texto: 'senal-hondo',
    fondo: 'papel-alto',
    minimo: NORMAL,
    donde: 'Chip activo de la barra',
  },
  { texto: 'marino', fondo: 'turquesa-claro', minimo: NORMAL, donde: 'Botón de marca al pasar' },

  // ── Distintivos: el texto sobre su propio fondo pálido ──
  { texto: 'destacado', fondo: 'destacado-suave', minimo: NORMAL, donde: 'Distintivo Destacado' },
  {
    texto: 'sobre-marino',
    fondo: 'destacado',
    minimo: NORMAL,
    donde: 'Distintivo Destacado sólido de la tarjeta',
  },
  { texto: 'aviso', fondo: 'aviso-suave', minimo: NORMAL, donde: 'Distintivo Pendiente' },
  { texto: 'senal-hondo', fondo: 'senal-suave', minimo: NORMAL, donde: 'Distintivo de función' },
  { texto: 'menta-hondo', fondo: 'menta-suave', minimo: NORMAL, donde: 'Distintivo Verificado' },
  { texto: 'tinta-70', fondo: 'papel-hundido', minimo: NORMAL, donde: 'Distintivo neutro' },
  { texto: 'alerta', fondo: 'alerta-suave', minimo: NORMAL, donde: 'Aviso de error enmarcado' },

  // ── Tarjeta de acceso ──
  // El panel del acceso lleva el titular en blanco sobre un degradado, y
  // un degradado no tiene un contraste único: hay que comprobar las DOS
  // puntas. La de arriba es el teal hondo; la de abajo, el marino. El
  // blanco sobre marino ya no se comprueba en la barra —la barra es teal—,
  // así que la entrada del marino vive aquí o el degradado se quedaría
  // con una punta sin probar.
  //
  // Si alguien cambia el ángulo o los colores del degradado por unos más
  // claros, estas líneas son lo único que lo detecta: la frase se vería
  // lavada y ningún otro comprobador mira si un texto se lee.
  {
    texto: 'sobre-marino',
    fondo: 'senal-hondo',
    minimo: NORMAL,
    donde: 'Titular del panel de acceso (punta teal)',
  },
  {
    texto: 'sobre-marino',
    fondo: 'marino',
    minimo: NORMAL,
    donde: 'Titular del panel de acceso (punta marino)',
  },

  // ── Anillos de foco (no son texto: basta con 3:1) ──
  { texto: 'senal', fondo: 'papel', minimo: NO_TEXTO, donde: 'Anillo de foco normal' },
  {
    texto: 'turquesa',
    fondo: 'senal-hondo',
    minimo: NO_TEXTO,
    donde: 'Anillo de foco en la barra teal',
  },
  { texto: 'senal', fondo: 'papel-alto', minimo: NO_TEXTO, donde: 'Anillo de foco en tarjeta' },
];

// ========================================
// 4. Ejecutar
// ========================================

const tokens = leerTokens(readFileSync(RUTA_CSS, 'utf8'));

console.log('\nContraste del sistema de diseño');
console.log('─'.repeat(78));
console.log(`Leídos ${Object.keys(tokens).length} tokens de src/app/globals.css\n`);

let fallos = 0;
const faltantes = new Set();

for (const c of COMBINACIONES) {
  const t = tokens[c.texto];
  const f = tokens[c.fondo];

  // Un token que no existe casi siempre significa que alguien lo
  // renombró y se olvidó de un sitio. Sin este aviso, la comprobación
  // se saltaría el par en silencio y diría que todo está bien.
  if (!t) faltantes.add(c.texto);
  if (!f) faltantes.add(c.fondo);
  if (!t || !f) continue;

  const ratio = contraste(t, f);
  const pasa = ratio >= c.minimo;
  if (!pasa) fallos++;

  const marca = pasa ? '  ok  ' : ' FALLA';
  console.log(
    `${marca}  ${ratio.toFixed(2).padStart(5)}:1  (mín ${c.minimo})  ${c.donde}`
  );
  if (!pasa) {
    console.log(`         ${c.texto} ${t} sobre ${c.fondo} ${f}`);
  }
}

if (faltantes.size > 0) {
  console.log('\n⛔ Tokens que se usan aquí y no existen en globals.css:');
  for (const t of faltantes) console.log(`   · --color-${t}`);
  console.log('   ¿Se renombró alguno sin actualizar esta lista?');
  fallos += faltantes.size;
}

console.log('\n' + '─'.repeat(78));
if (fallos === 0) {
  console.log(`✓ ${COMBINACIONES.length} combinaciones comprobadas, todas legibles.\n`);
} else {
  console.log(`✗ ${fallos} problema(s) de contraste.\n`);
}

process.exit(fallos > 0 ? 1 : 0);
