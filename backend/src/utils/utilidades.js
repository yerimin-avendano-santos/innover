// ========================================
// 🧹 UTILIDADES VARIAS
// ========================================

/**
 * Normaliza un email para que "Ana@Gmail.com" y "ana@gmail.com" sean
 * la misma cuenta. Sin esto, un usuario podría registrarse dos veces
 * con el mismo correo usando distinta capitalización.
 */
export function normalizarEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Convierte un título en un slug apto para URLs.
 *
 * "Departamento de Lujo en Amarilis!" → "departamento-de-lujo-en-amarilis"
 *
 * Se usa en: frontend/src/app/propiedad/[slug]
 */
export function slugify(texto) {
  return texto
    .normalize('NFD')                    // separa la tilde: "ó" → "o" + acento
    .replace(/[\u0300-\u036f]/g, '')      // borra los acentos que quedaron
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')          // todo lo que no sea alfanumérico → "-"
    .replace(/^-+|-+$/g, '')              // quita guiones del inicio y final
    .slice(0, 80);
}

/**
 * Escapa el input para preventar inyecciones de HTML.
 *
 * OJO CON ALGO: NO es la defensa principal contra XSS. La defensa principal
 * es no usar setHTML() del lado del cliente (Mapbox) ni dangerouslySetInnerHTML
 * en React. Esto es una segunda capa para casos donde el HTML es inevitable
 * (un PDF firmado, un email).
 *
 * @see frontend/src/components/Map.jsx — usa nodos de texto, no HTML.
 */
export function escaparHtml(texto) {
  if (typeof texto !== 'string') return '';

  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formatea un precio para mostrar: 275000 → "S/ 275,000.00"
 *
 * Se usa en el backend para las respuestas que van a emails o PDFs.
 * El frontend tiene su propia versión en TypeScript.
 */
export function formatearPrecio(valor, moneda = 'PEN') {
  const simbolo = moneda === 'USD' ? '$' : 'S/';
  const numero = Number(valor);

  if (Number.isNaN(numero)) return `${simbolo} 0.00`;

  return `${simbolo} ${numero.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calcula cuántos días lleva publicada una propiedad.
 */
export function diasPublicado(fecha) {
  const diferencia = Date.now() - new Date(fecha).getTime();
  return Math.floor(diferencia / (1000 * 60 * 60 * 24));
}

/**
 * Convierte un Decimal de Prisma en número plano.
 *
 * ¿Por qué importa esto?
 * Prisma devuelve los campos Decimal como strings para no perder precisión:
 *   { precio: "275000.00" }
 * Si los mandas tal cual al frontend y ahí haces `precio * 2`, JavaScript
 * intenta multiplicar un string y te da NaN o un resultado raro.
 *
 * Con esta función el JSON sale como número y el frontend puede operar.
 */
export function decimalANumero(valor) {
  if (valor === null || valor === undefined) return null;
  return typeof valor === 'object' && typeof valor.toNumber === 'function'
    ? valor.toNumber()
    : Number(valor);
}

/**
 * Decide si una propiedad está dentro de un radio (en kilómetros)
 * alrededor de un punto. Usa la fórmula del teorema de Haversine.
 *
 * La usamos para el filtro "cerca de" cuando el usuario no quiere
 * activar PostGIS. La versión con PostGIS ($queryRaw) es más exacta
 * y está indexada; esta es el respaldo para cuando no hay coordenadas exactas.
 */
export function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const RAD = 6371; // radio terrestre en km

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return RAD * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
