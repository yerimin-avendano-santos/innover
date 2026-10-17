// ========================================
// 🧩 AGRUPAR CHINCHETAS POR CERCANÍA
// ========================================
// El mapa del buscador pinta una chincheta por propiedad, y con 40 precios
// repartidos por la conurbación Huánuco–Amarilis–Pillco Marca se tapan unos a
// otros: lo que se lee no es un mapa, es una pila de etiquetas. Y el mapa
// existe justo para contestar "¿dónde?".
//
// Aquí se decide qué se pinta suelto y qué se resume en un grupo con un
// número. Es lógica PURA —entra una lista de puntos y una ventana, sale una
// lista de cosas que pintar— y eso es a propósito: no toca el DOM, ni Mapbox,
// ni React, así que se puede probar sola (ver `scripts/prueba-clustering.mts`)
// sin abrir un navegador.
//
// 📌 POR QUÉ `supercluster` Y NO UNA CUADRÍCULA CASERA.
//
// Agrupar "por distancia" parece un `if (distancia < X)` hasta que se cae en
// la cuenta de que el mapa tiene zoom: dos casas a 30 m se pisan a zoom 14 y
// no a zoom 18, y el grupo de ayer tiene que romperse hoy en los mismos grupos
// que ayer para que los números no bailen entre búsquedas. supercluster
// resuelve exactamente eso —es el mismo motor que Mapbox GL usa por dentro— y
// a mano serían varias noches de casos raros. Son 5 KB.
//
// ⛔ Y NO SE HACE CON LAS CAPAS GEOJSON DE MAPBOX, que también saben agrupar.
// Porque el color de un marcador vive en `globals.css` (ver "Marcador del
// mapa") y con capas habría que escribir el `paint` desde JavaScript: el
// hexadecimal repetido que el proyecto ya decidió no tener. Aquí los grupos
// siguen siendo `<button>` con clases, igual que las chinchetas sueltas.

import Supercluster, {
  type AnyProps,
  type ClusterFeature,
  type ClusterProperties,
  type PointFeature,
} from 'supercluster';
import type { PuntoMapa } from './tipos';

/**
 * El zoom desde el que NO se agrupa nada.
 *
 * 📌 SON DOS NÚMEROS DISTINTOS, Y NO ES OBVIO: MEDIDO, NO SUPUESTO.
 *
 * La opción `maxZoom` de supercluster es "el último zoom en el que AÚN se
 * agrupa". Con `maxZoom: 16`, a zoom 16 todavía sale un grupo y es a 17 cuando
 * se rompe (comprobado con la prueba del agrupador: zoom 16 → grupo(4),
 * zoom 17 → cuatro puntos sueltos).
 *
 * Así que el índice se configura con `maxZoom: ZOOM_SIN_GRUPOS - 1` y este
 * número significa lo que dice: "a este zoom o más, nada se agrupa". Los dos
 * usos que dependen de él —el que decide si una propiedad puede estar tapada y
 * el que salta a donde seguro que no lo está— tienen que coincidir, o el
 * síntoma sería "a veces, al elegir una tarjeta, no pasa nada".
 */
export const ZOOM_SIN_GRUPOS = 17;

/** La ventana visible: [oeste, sur, este, norte], como en GeoJSON. */
export type Limites = [oeste: number, sur: number, este: number, norte: number];

/** Varias propiedades que caben en el mismo puñado de píxeles. */
export interface GrupoMapa {
  tipo: 'grupo';
  /** Identificador interno de supercluster. Cambia con el zoom. */
  id: number;
  longitud: number;
  latitud: number;
  cantidad: number;
}

/** Una propiedad con su chincheta y su precio. */
export interface PuntoSuelto {
  tipo: 'propiedad';
  punto: PuntoMapa;
  longitud: number;
  latitud: number;
}

export type ElementoMapa = GrupoMapa | PuntoSuelto;

export interface IndiceMapa {
  /** Lo que hay que pintar en esta ventana y a este zoom. */
  elementos(limites: Limites, zoom: number): ElementoMapa[];
  /** El zoom al que este grupo se abre en chinchetas. `null` si ya no existe. */
  zoomDeExpansion(idGrupo: number): number | null;
  /** El grupo que esconde esta propiedad, o `null` si ya se ve suelta. */
  grupoQueEsconde(idPropiedad: number, limites: Limites, zoom: number): GrupoMapa | null;
}

/** Lo que se guarda en cada punto: solo su id. El resto ya está en `PuntoMapa`. */
interface PropsPunto {
  id: number;
}

/**
 * Prepara los puntos para agrupar. `null` si no hay ninguno que pintar.
 *
 * El índice es inmutable: si cambian los puntos (otra búsqueda), se crea otro.
 */
export function crearIndice(puntos: PuntoMapa[]): IndiceMapa | null {
  // El tipo dice que las coordenadas vienen, pero el mapa no se cae por
  // desconfiar de un dato: una chincheta con un NaN no da error, se pinta en
  // el golfo de Guinea.
  const utiles = puntos.filter(
    (p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud)
  );

  if (utiles.length === 0) return null;

  const indice = new Supercluster<PropsPunto>({
    // 60 px y no los 40 por defecto: las chinchetas de este mapa no son
    // círculos de 12 px, son cajas de 48 a 90 px de ancho con el precio dentro.
    // Con 40 se agrupan tarde y se siguen pisando.
    radius: 60,
    maxZoom: ZOOM_SIN_GRUPOS - 1,
    minPoints: 2,
  });

  indice.load(
    utiles.map((p) => ({
      type: 'Feature' as const,
      properties: { id: p.id },
      // ⚠️ GeoJSON es [longitud, latitud] — al revés que PostGIS, el backend
      // y el seed. Invertirlo aquí no da error: el mapa se va a otro
      // continente. Es la misma trampa que en `Mapa.tsx`.
      geometry: {
        type: 'Point' as const,
        coordinates: [p.longitud, p.latitud] as [number, number],
      },
    }))
  );

  const porId = new Map(utiles.map((p) => [p.id, p]));

  /** Traduce una feature de supercluster a lo que pinta el mapa. */
  function aElemento(
    elemento: ClusterFeature<AnyProps> | PointFeature<PropsPunto>
  ): ElementoMapa {
    const props = elemento.properties;
    const [longitud, latitud] = elemento.geometry.coordinates;

    if ('cluster' in props && props.cluster) {
      return {
        tipo: 'grupo',
        id: props.cluster_id,
        longitud,
        latitud,
        cantidad: props.point_count,
      };
    }

    // El punto siempre está en `porId`: lo metimos nosotros al cargar.
    return {
      tipo: 'propiedad',
      punto: porId.get(props.id) as PuntoMapa,
      longitud,
      latitud,
    };
  }

  return {
    elementos(limites, zoom) {
      return indice.getClusters(limites, zoom).map(aElemento);
    },

    zoomDeExpansion(idGrupo) {
      // Dos formas de que esto reviente, y ninguna la avisa el tipo:
      //
      //   · Un id que supercluster no conoce LANZA ("No cluster with the
      //     specified id"). Pasa de verdad: el mapa se movió entre el clic y
      //     el cálculo.
      //   · Un id de OTRA búsqueda (el índice se rehace con cada una) no
      //     lanza: supercluster calcula a partir del id y devuelve un número
      //     sin sentido. Medido: id 999999 → zoom 26, id 12345 → zoom 20.
      //
      // El rango válido es 0..ZOOM_SIN_GRUPOS: el zoom de expansión nunca
      // puede pasar del último zoom en el que se agrupa. Lo que quede fuera
      // no es un destino, es basura.
      try {
        const zoom = indice.getClusterExpansionZoom(idGrupo);
        const util = Number.isFinite(zoom) && zoom >= 0 && zoom <= ZOOM_SIN_GRUPOS;
        return util ? zoom : null;
      } catch {
        return null;
      }
    },

    grupoQueEsconde(idPropiedad, limites, zoom) {
      const grupos = indice
        .getClusters(limites, zoom)
        .filter(
          (elemento): elemento is ClusterFeature<AnyProps> =>
            'cluster' in elemento.properties && elemento.properties.cluster === true
        );

      for (const grupo of grupos) {
        // ¿Está esta propiedad entre las que este grupo resume? Es la única
        // forma de saberlo: el grupo no dice a quién esconde, solo cuántos son.
        const escondida = indice
          .getLeaves((grupo.properties as ClusterProperties).cluster_id)
          .some((hoja) => (hoja.properties as PropsPunto).id === idPropiedad);

        if (escondida) {
          const [longitud, latitud] = grupo.geometry.coordinates;
          const props = grupo.properties as ClusterProperties;
          return {
            tipo: 'grupo',
            id: props.cluster_id,
            longitud,
            latitud,
            cantidad: props.point_count,
          };
        }
      }

      return null;
    },
  };
}

/**
 * El tamaño del grupo: tres escalones, no una fórmula continua.
 *
 * Un `width = 34 + log(cantidad) * 12` da un tamaño más "exacto" y peor: el
 * número baila entre búsquedas, y un mapa cuyos elementos cambian de tamaño
 * sin motivo parece roto. Tres escalones se leen de un vistazo —"unos pocos",
 * "unas decenas", "cientos"— y dejan el CSS tranquilo.
 */
export function claseDeGrupo(cantidad: number): string {
  if (cantidad < 10) return 'marcador-grupo-chico';
  if (cantidad < 100) return 'marcador-grupo-medio';
  return 'marcador-grupo-grande';
}
