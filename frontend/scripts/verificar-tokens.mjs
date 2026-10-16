/**
 * Compara los tokens declarados en `@theme` con los que Tailwind emite
 * de verdad en el CSS compilado.
 *
 * ── Por qué hace falta ──
 *
 * Tailwind v4 no publica todos los tokens: elimina los que ninguna
 * utilidad usa. Eso está bien hasta que un token se usa SOLO dentro de
 * `var(--color-x)` en una clase de componente. Si el token se elimina,
 * la referencia queda vacía y el color simplemente no se pinta: ni
 * error de compilación, ni aviso, ni nada. El borde se queda gris.
 *
 * Esta comprobación es la única forma de verlo sin abrir el navegador.
 *
 * Se ejecuta DESPUÉS de `npm run build`, desde `frontend/`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');

/** Los tokens declarados en el bloque `@theme`. */
function declarados() {
  const css = readFileSync(join(raiz, 'src', 'app', 'globals.css'), 'utf8');
  const inicio = css.indexOf('@theme');
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
  const bloque = css.slice(i + 1, fin);
  const nombres = [];
  for (const linea of bloque.split('\n')) {
    if (linea.trim().startsWith('*')) continue;
    const m = linea.match(/^\s*(--[a-z0-9-]+)\s*:/);
    if (m) nombres.push(m[1]);
  }
  return [...new Set(nombres)];
}

/** Todo el CSS que Tailwind generó para la aplicación. */
function cssCompilado() {
  const dir = join(raiz, '.next', 'static');
  const trozos = [];
  const recorrer = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) recorrer(p);
      else if (e.endsWith('.css') && !e.includes('mapbox')) trozos.push(readFileSync(p, 'utf8'));
    }
  };
  recorrer(dir);
  return trozos.join('\n');
}

/** Los `var(--color-x)` escritos a mano en clases de componente. */
function referenciasUsadas() {
  const css = readFileSync(join(raiz, 'src', 'app', 'globals.css'), 'utf8');
  const usadas = new Set();
  for (const m of css.matchAll(/var\((--[a-z0-9-]+)/g)) usadas.add(m[1]);
  return usadas;
}

const todos = declarados();
const compilado = cssCompilado();
const usadas = referenciasUsadas();

const ausentes = todos.filter((t) => !compilado.includes(`${t}:`));

console.log(`\nTokens declarados en @theme: ${todos.length}`);
console.log(`Emitidos por Tailwind:        ${todos.length - ausentes.length}`);

if (ausentes.length === 0) {
  console.log('\n✓ Todos los tokens llegan al CSS compilado.\n');
  process.exit(0);
}

// Un token ausente que nadie referencia es solo peso muerto: se puede
// borrar del @theme sin consecuencias. Un token ausente que SÍ se
// referencia vía `var()` es un fallo silencioso: el color no se pinta.
const peligrosos = ausentes.filter((t) => usadas.has(t));
const inertes = ausentes.filter((t) => !usadas.has(t));

if (peligrosos.length) {
  console.log('\n⛔ FALLO SILENCIOSO: se usan con var() pero Tailwind no los emite.');
  console.log('   El color no se pinta y no hay ningún error que lo diga.\n');
  for (const t of peligrosos) console.log(`   · ${t}`);
  console.log('\n   Se arregla usando el token en alguna clase de utilidad,');
  console.log('   o declarando el bloque como `@theme static`.\n');
}

if (inertes.length) {
  console.log('\n· Tokens declarados que no usa nadie (peso muerto, se pueden borrar):\n');
  for (const t of inertes) console.log(`   · ${t}`);
  console.log('');
}

process.exit(peligrosos.length > 0 ? 1 : 0);
