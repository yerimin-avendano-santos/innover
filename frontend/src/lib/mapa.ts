// ========================================
// 📍 DE PROPIEDAD A PUNTO DEL MAPA
// ========================================
// El buscador recibe sus puntos ya listos del backend (`/api/propiedades/mapa`,
// que devuelve exactamente un `PuntoMapa` por propiedad). Las pantallas que
// enseñan UNA sola propiedad —la ficha y la vista previa de `/publicar`— no
// pasan por ahí: tienen una `Propiedad` en la mano y necesitan la chincheta.
//
// 📌 POR QUÉ NO SE PASA `Propiedad` DIRECTAMENTE AL MAPA.
//
// Porque `Propiedad` es lo que pinta la LISTA: descripción, fotos, slug,
// fechas. El mapa no usa nada de eso, y si lo recibiera, el día que `Mapa`
// leyera un campo que el backend no manda en su endpoint, el fallo aparecería
// solo en una de las dos pantallas. Aquí la conversión es explícita y
// TypeScript la vigila: si `PuntoMapa` gana un campo, este archivo deja de
// compilar hasta que alguien decida de dónde sale.
//
// Devuelve `null` si la propiedad no tiene coordenadas, porque un punto sin
// coordenadas no es un punto: es una propiedad que no se puede situar.

import type { Propiedad, PuntoMapa } from './tipos';

/** Una propiedad como punto del mapa, o `null` si no tiene dónde clavarse. */
export function aPuntoMapa(propiedad: Propiedad): PuntoMapa | null {
  if (propiedad.latitud === null || propiedad.longitud === null) return null;

  return {
    id: propiedad.id,
    latitud: propiedad.latitud,
    longitud: propiedad.longitud,
    titulo: propiedad.titulo,
    precio: propiedad.precio,
    moneda: propiedad.moneda,
    tipo_inmueble: propiedad.tipo_inmueble,
    habitaciones: propiedad.habitaciones,
    area_m2: propiedad.area_m2,
    destacado: propiedad.destacado,
    distrito: propiedad.distrito,
  };
}

/**
 * Lo mismo para una lista, saltándose las que no se pueden situar.
 *
 * Es lo que usan la ficha y la vista previa: allí una propiedad sin coordenadas
 * simplemente no se pinta, sin ruido ni aviso (el aviso de "no aparece en el
 * mapa" es del buscador, donde la ausencia se puede leer como "aquí no hay
 * nada" y hay que desmentirlo).
 */
export function aPuntosDeMapa(propiedades: Propiedad[]): PuntoMapa[] {
  return propiedades.flatMap((propiedad) => {
    const punto = aPuntoMapa(propiedad);
    return punto ? [punto] : [];
  });
}
