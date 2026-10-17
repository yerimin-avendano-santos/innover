/**
 * Comprueba que toda clase escrita en un componente EXISTA en el CSS.
 *
 * ── Por qué existe este archivo ──
 *
 * Una clase mal escrita no da ningún error. Ni el linter, ni TypeScript, ni
 * el build dicen nada: Tailwind simplemente no genera ese estilo y el
 * elemento se queda sin color, sin borde o sin sombra. No hay excepción, no
 * hay aviso, no hay nada que leer — solo un elemento que se ve mal y nadie
 * sabe por qué.
 *
 * Ya pasó dos veces en este proyecto:
 *
 *   1. Se renombró `distintivo-latón` a `distintivo-destacado` y quedaron
 *      cuatro usos del nombre viejo. El distintivo perdió el color y el
 *      resumen de verificación dijo que todo estaba bien.
 *
 *   2. El color del marcador seleccionado se escribía en JavaScript con
 *      `style.backgroundColor`. Sobre un marcador destacado no hacía nada,
 *      porque una imagen de fondo se pinta ENCIMA del color.
 *
 *   3. El propio comprobador tenía un punto ciego y por eso no encontró el
 *      uso de `distintivo-latón` que quedó en la ficha: el filtro de nombres
 *      usaba `\w`, que en JavaScript es SOLO ASCII. Un nombre con tilde —y
 *      el nombre que originó todo esto lleva tilde— no pasaba el filtro, se
 *      descartaba en silencio y nunca llegaba a comprobarse. La validación
 *      que se hizo en su día usó `distintivo-laton` sin tilde, que sí pasaba:
 *      un test que certificaba lo que no era. Ahora los nombres se aceptan
 *      con cualquier letra Unicode y el CSS se DESESCAPA antes de buscar,
 *      en vez de escapar el nombre para ir a su encuentro.
 *
 * Los tres casos tienen la misma forma: algo que se cree aplicado y no se
 * aplica. Este script los caza leyendo el DOM que Tailwind generó de verdad.
 *
 * Se ejecuta DESPUÉS de `npm run build`:
 *
 *     npm run verificar:clases
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');

// ========================================
// 1. Las clases que escriben los componentes
// ========================================

/**
 * Clases que NO generan CSS a propósito.
 *
 * `group` y `peer` son marcadores: existen para que `group-hover:` o
 * `peer-checked:` tengan algo a lo que referirse. Por sí solos no pintan
 * nada, y ese silencio es correcto. Marcarlos como error sería acusar al
 * código de hacer bien las cosas.
 */
const MARCADORES = /^(?:group|peer)(?:\/[\w-]+)?$/;

/**
 * Recoge los textos que pueden contener clases dentro de una expresión.
 *
 * 📌 POR QUÉ NO BASTA UNA EXPRESIÓN REGULAR
 *
 * La primera versión buscaba `['"`]([^'"`]*)['"`]`, y ese patrón empareja
 * comillas de distinto tipo. En un ternario dentro de una plantilla:
 *
 *     `px-3 ${hayValor ? 'activo' : ''}`
 *
 * abría con la comilla invertida y cerraba con la simple, así que el
 * código de dentro se colaba como si fueran nombres de clase, y el
 * informe acusaba a `hayValor`, `filtros.tipo` y `u.activo`. Ninguno
 * existe porque ninguno es una clase: son variables.
 *
 * Un comprobador con falsos positivos deja de leerse a la tercera vez, y
 * entonces da igual que sea capaz de encontrar algo de verdad.
 *
 * El recorrido distingue las dos zonas de una plantilla, que es donde
 * está todo el problema: el texto suelto SÍ es clase (`px-3`), y lo que
 * hay dentro de `${...}` es lógica, así que de ahí solo se recogen las
 * cadenas entrecomilladas.
 */
function extraerTextos(codigo, desde, hasta) {
  const textos = [];
  const pila = []; // profundidad de llaves de cada `${...}` abierto
  let literal = '';
  let enPlantilla = false;

  const volcar = () => {
    if (literal.trim()) textos.push(literal);
    literal = '';
  };

  for (let i = desde; i < hasta; ) {
    const c = codigo[i];

    if (enPlantilla) {
      if (c === '`') {
        volcar();
        enPlantilla = false;
        i++;
      } else if (c === '$' && codigo[i + 1] === '{') {
        volcar();
        enPlantilla = false;
        pila.push(1);
        i += 2;
      } else {
        literal += c;
        i++;
      }
      continue;
    }

    // Fuera de la plantilla. Si hay un `${...}` en curso, se sigue su
    // profundidad de llaves para saber dónde termina y vuelve el texto.
    if (c === '{' && pila.length) {
      pila[pila.length - 1]++;
      i++;
      continue;
    }
    if (c === '}') {
      if (pila.length) {
        pila[pila.length - 1]--;
        if (pila[pila.length - 1] === 0) {
          pila.pop();
          enPlantilla = true; // se cierra la interpolación y sigue el texto
        }
      }
      i++;
      continue;
    }
    if (c === '`') {
      enPlantilla = true;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const cierre = codigo.indexOf(c, i + 1);
      const fin = cierre === -1 ? hasta : cierre;
      const texto = codigo.slice(i + 1, fin);

      /**
       * ⛔ Una cadena COMPARADA no es una clase.
       *
       * En una plantilla con ternario es normal comparar el estado:
       *
       *     className={`caja ${s.estado === 'PENDIENTE' ? 'borde-aviso' : ''}`}
       *
       * `'PENDIENTE'` no es una clase y no tiene por qué existir en el CSS,
       * pero el recorrido la recogía como si lo fuera y el informe acusaba a
       * un valor de enum de estar mal escrito. Un comprobador que señala lo
       * que está bien deja de leerse, y entonces da igual lo que sea capaz de
       * encontrar.
       *
       * Solo se descarta si delante hay un operador de comparación COMPLETO
       * (`===`, `!==`, `==`, `!=`). Un `=` suelto no cuenta: ahí está la
       * asignación de un `className` que sí es clase.
       */
      const antes = codigo.slice(Math.max(0, i - 12), i);
      const esComparacion = /(?:===|!==|==|!=)\s*$/.test(antes);

      if (!esComparacion && texto.trim()) textos.push(texto);
      i = fin + 1;
      continue;
    }

    i++;
  }

  volcar();
  return textos;
}

/**
 * Extrae las clases de los `className` de un archivo.
 *
 * Solo mira los `className`, y no todas las cadenas del archivo a
 * propósito: `'ADMIN'`, `'/api/propiedades'` o `'use client'` también son
 * cadenas, y colarlas llenaría el informe de falsos positivos hasta que
 * nadie lo leyera.
 */
function clasesDeUnArchivo(codigo) {
  const encontradas = [];

  // `className="..."`, `className={`...`}` o `className={cond ? '...' : '...'}`
  // y también `el.className = '...'` (Mapbox construye el DOM a mano).
  const patron = /className\s*=\s*/g;
  let m;

  while ((m = patron.exec(codigo)) !== null) {
    const i = m.index + m[0].length;

    if (codigo[i] === '"' || codigo[i] === "'") {
      const cierre = codigo.indexOf(codigo[i], i + 1);
      if (cierre === -1) continue;
      encontradas.push(codigo.slice(i + 1, cierre));
      continue;
    }

    if (codigo[i] === '{') {
      // Se busca el cierre de la expresión contando llaves, y dentro se
      // recogen solo los textos que pueden ser clases.
      let profundidad = 0;
      let j = i;
      while (j < codigo.length) {
        if (codigo[j] === '{') profundidad++;
        else if (codigo[j] === '}') {
          profundidad--;
          if (profundidad === 0) break;
        }
        j++;
      }
      encontradas.push(...extraerTextos(codigo, i + 1, j));
    }
  }

  return encontradas;
}

/**
 * Convierte el texto de un `className` en una lista de clases sueltas.
 *
 * ⚠️ Las letras se aceptan con `\p{L}` y no con `\w`.
 *
 * `\w` es `[A-Za-z0-9_]`: SOLO ASCII. Con ese filtro, un nombre acentuado
 * como `distintivo-latón` no se reconoce como clase y se descarta sin decir
 * nada — que es justo lo contrario de lo que hace falta en un comprobador.
 * El nombre que originó este script lleva tilde, así que el punto ciego caía
 * precisamente sobre el caso que había que vigilar.
 */
function aClases(texto) {
  return texto
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t &&
        // Se descartan los trozos de plantilla que hayan podido quedar.
        !t.includes('${') &&
        !MARCADORES.test(t) &&
        /^[\p{L}][\p{L}\p{N}_:.[\]%()/#-]*$/u.test(t)
    );
}

// ========================================
// 2. El CSS que Tailwind generó de verdad
// ========================================

function cssCompilado() {
  const trozos = [];
  const recorrer = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) recorrer(p);
      else if (e.endsWith('.css') && !e.includes('mapbox')) trozos.push(readFileSync(p, 'utf8'));
    }
  };
  recorrer(join(raiz, '.next', 'static'));
  return trozos.join('\n');
}

/**
 * Deshace los escapes de CSS para poder buscar los nombres tal cual.
 *
 * 📌 POR QUÉ DESESCAPAR EL CSS EN VEZ DE ESCAPAR EL NOMBRE
 *
 * La versión anterior traducía el nombre a su forma escapada (`w-[100px]` →
 * `w-\[100px\]`) y buscaba esa cadena. Funcionaba, pero obligaba a mantener a
 * mano una copia de las reglas de escape de CSS, y ahí cabe cualquier
 * olvido: la forma hexadecimal (`2` → `\32 `), la coma (`\2c `) y las letras
 * no ASCII, que ni se planteaban porque el filtro las descartaba antes.
 *
 * Al revés hay una sola regla que cumplir: deshacer lo que CSS permite
 * escribir. Se aplica UNA vez sobre el CSS entero, no clase por clase.
 */
function sinEscapesCss(css) {
  return (
    css
      // Escapes hexadecimales: `\f3 ` (el espacio cierra el número).
      .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
        String.fromCodePoint(parseInt(hex, 16))
      )
      // Escapes de un solo carácter: `\:`, `\[`, `\/`.
      .replace(/\\([^0-9a-fA-F])/g, '$1')
  );
}

/**
 * ¿Aparece `.clase` como selector, y no como trozo de otro nombre?
 *
 * Se busca sobre el CSS ya desescapado.
 */
function existeSelector(css, clase) {
  const buscado = `.${clase}`;
  let desde = 0;
  for (;;) {
    const i = css.indexOf(buscado, desde);
    if (i === -1) return false;
    const siguiente = css[i + buscado.length] ?? '';
    // `.flex` NO debe darse por bueno al encontrar `.flex-col`: por eso el
    // carácter siguiente tiene que cerrar el selector.
    //
    // La comprobación es Unicode (`\p{L}`) y no `\w`: con `\w`, buscar
    // `distintivo-lat` se daría por bueno al toparse con el `ó` de
    // `distintivo-latón`, porque el acento no cuenta como parte del nombre.
    if (!/[-\p{L}\p{N}_]/u.test(siguiente)) return true;
    desde = i + 1;
  }
}

// ========================================
// 3. Ejecutar
// ========================================

// El CSS se desescapa UNA vez, y todas las búsquedas van sobre él.
const css = sinEscapesCss(cssCompilado());

const archivos = [];
const recolectar = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) recolectar(p);
    else if (/\.(tsx|ts)$/.test(e)) archivos.push(p);
  }
};
recolectar(join(raiz, 'src'));

/** clase → [dónde se usa] */
const usos = new Map();

for (const archivo of archivos) {
  const codigo = readFileSync(archivo, 'utf8');
  const relativo = archivo.slice(raiz.length + 1).replace(/\\/g, '/');

  for (const texto of clasesDeUnArchivo(codigo)) {
    for (const clase of aClases(texto)) {
      if (!usos.has(clase)) usos.set(clase, new Set());
      usos.get(clase).add(relativo);
    }
  }
}

const huerfanas = [...usos.keys()].filter((c) => !existeSelector(css, c)).sort();

console.log(`\nClases comprobadas: ${usos.size}`);
console.log(`CSS compilado:      ${Math.round(css.length / 1024)} KB\n`);

if (huerfanas.length === 0) {
  console.log('✓ Todas las clases de los componentes existen en el CSS.\n');
  process.exit(0);
}

console.log(`✗ ${huerfanas.length} clase(s) no generan ningún estilo:\n`);
for (const c of huerfanas) {
  console.log(`   ${c}`);
  console.log(`      en: ${[...usos.get(c)].join(', ')}`);
}
console.log('\n   Una clase que no existe NO da error: el elemento se queda');
console.log('   sin ese estilo y nadie sabe por qué. Suele ser un nombre');
console.log('   renombrado que se olvidó en un sitio, o una errata.\n');

process.exit(1);
