// ========================================
// 📸 RESOLUTOR DE FOTOS REALES DE INMUEBLES
// ========================================
// Vincula los inmuebles de Huánuco con la galería de fotografías
// reales del proyecto (/inmuebles/...) en sustitución de imágenes de stock/IA.

import type { Propiedad, PuntoMapa } from '@/lib/tipos';

const FOTOS_POR_CATEGORIA = {
  casa1: [
    '/inmuebles/casa1/1.webp',
    '/inmuebles/casa1/2.webp',
    '/inmuebles/casa1/3.webp',
    '/inmuebles/casa1/4.webp',
    '/inmuebles/casa1/5.webp',
    '/inmuebles/casa1/6.webp',
    '/inmuebles/casa1/7.webp',
  ],
  casa2: [
    '/inmuebles/casa2/1.webp',
    '/inmuebles/casa2/2.webp',
    '/inmuebles/casa2/3.webp',
    '/inmuebles/casa2/4.webp',
    '/inmuebles/casa2/5.webp',
    '/inmuebles/casa2/6.webp',
  ],
  casacampo: [
    '/inmuebles/casacampo/1.webp',
    '/inmuebles/casacampo/2.webp',
    '/inmuebles/casacampo/3.webp',
    '/inmuebles/casacampo/4.webp',
    '/inmuebles/casacampo/5.webp',
  ],
  depa1: [
    '/inmuebles/depa1/1.webp',
    '/inmuebles/depa1/2.webp',
    '/inmuebles/depa1/3.webp',
    '/inmuebles/depa1/4.webp',
    '/inmuebles/depa1/5.webp',
  ],
  depa2: [
    '/inmuebles/depa2/1.webp',
    '/inmuebles/depa2/2.webp',
    '/inmuebles/depa2/3.webp',
    '/inmuebles/depa2/4.webp',
    '/inmuebles/depa2/5.webp',
    '/inmuebles/depa2/6.webp',
  ],
  local: [
    '/inmuebles/local/1.webp',
    '/inmuebles/local/2.webp',
    '/inmuebles/local/3.webp',
    '/inmuebles/local/4.webp',
    '/inmuebles/local/5.webp',
  ],
  terreno: [
    '/inmuebles/terreno/1.avif',
    '/inmuebles/terreno/2.avif',
    '/inmuebles/terreno/3.avif',
  ],
};

/**
 * Obtiene la lista de fotografías reales para una propiedad según sus datos.
 */
export function resolverFotosPropiedad(
  propiedad?: Partial<Propiedad> | Partial<PuntoMapa> | null
): string[] {
  if (!propiedad) return FOTOS_POR_CATEGORIA.depa1;

  // Si tiene imágenes locales ya asignadas (/inmuebles/...) o URLs subidas por el usuario (no Unsplash)
  const imagenes = (propiedad as Propiedad).imagenes ?? [];
  const tieneFotosLocales = imagenes.some((u) => u.startsWith('/inmuebles/'));
  if (tieneFotosLocales) {
    return imagenes;
  }

  const texto = `${propiedad.titulo ?? ''} ${(propiedad as Propiedad).slug ?? ''} ${(propiedad as Propiedad).descripcion ?? ''}`.toLowerCase();

  if (texto.includes('plaza de armas') || (texto.includes('departamento') && texto.includes('cuadras'))) {
    return FOTOS_POR_CATEGORIA.depa1;
  }
  if (texto.includes('churubamba') || texto.includes('huerta') || texto.includes('campo')) {
    return FOTOS_POR_CATEGORIA.casacampo;
  }
  if (texto.includes('amarilis') || texto.includes('casa amplia')) {
    return FOTOS_POR_CATEGORIA.casa1;
  }
  if (texto.includes('cayhuayna') || texto.includes('frente a parque')) {
    return FOTOS_POR_CATEGORIA.casa2;
  }
  if (texto.includes('alquiler') && texto.includes('huanuco centro')) {
    return FOTOS_POR_CATEGORIA.depa2;
  }
  if (texto.includes('local comercial') || texto.includes('oficina') || texto.includes('28 de julio')) {
    return FOTOS_POR_CATEGORIA.local;
  }
  if (texto.includes('terreno')) {
    return FOTOS_POR_CATEGORIA.terreno;
  }

  // Fallback por tipo de inmueble
  switch (propiedad.tipo_inmueble) {
    case 'CASA':
      return FOTOS_POR_CATEGORIA.casa1;
    case 'TERRENO':
      return FOTOS_POR_CATEGORIA.terreno;
    case 'LOCAL_COMERCIAL':
    case 'OFICINA':
      return FOTOS_POR_CATEGORIA.local;
    case 'DEPARTAMENTO':
    default:
      return FOTOS_POR_CATEGORIA.depa1;
  }
}
