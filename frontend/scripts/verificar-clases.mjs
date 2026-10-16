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
 * Los dos casos tienen la misma forma: algo que se cree aplicado y no se
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
      if (texto.trim()) textos.push(texto);
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

/** Convierte el texto de un className en una lista de clases sueltas. */
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
        /^[a-zA-Z][\w:.[\]%()/#-]*$/.test(t)
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
 * Escapa una clase como la escribe Tailwind en el selector.
 *
 * En CSS, un nombre de clase no puede llevar `:` ni `[` sin escapar, así
 * que `.hover:bg-x` se escribe `.\:hover\:bg-x`. Y un nombre que EMPIEZA
 * por dígito se escapa en hexadecimal con un espacio detrás para
 * terminarlo: `2xl:flex` → `.\32 xl\:flex`. Sin la misma regla aquí, la
 * búsqueda no encontraría clases que sí existen y el informe mentiría.
 */
function escaparClase(clase) {
  let salida = '';
  for (let i = 0; i < clase.length; i++) {
    const c = clase[i];
    if (/[a-zA-Z0-9_-]/.test(c)) {
      salida += c;
    } else if (i === 0 && /[0-9]/.test(c)) {
      salida += `\\3${c} `;
    } else if (c === ',') {
      salida += '\\2c ';
    } else {
      salida += `\\${c}`;
    }
  }
  return salida;
}

/** ¿Aparece `.clase` como selector, y no como trozo de otro nombre? */
function existeSelector(css, clase) {
  const buscado = `.${escaparClase(clase)}`;
  let desde = 0;
  for (;;) {
    const i = css.indexOf(buscado, desde);
    if (i === -1) return false;
    const siguiente = css[i + buscado.length] ?? '';
    // `.flex` NO debe darse por bueno al encontrar `.flex-col`: por eso
    // el carácter siguiente tiene que cerrar el selector.
    if (!/[-\w]/.test(siguiente) && !siguiente.startsWith('\\')) return true;
    desde = i + 1;
  }
}

// ========================================
// 3. Ejecutar
// ========================================

const css = cssCompilado();

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
