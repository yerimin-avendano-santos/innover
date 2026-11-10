// ========================================
// 🗺️ DELIMITACIÓN GEOGRÁFICA DE DISTRITOS (HUÁNUCO)
// ========================================
// Contiene las geometrías vectoriales (GeoJSON Polygons) y Bounding Boxes
// de los 9 distritos clave de la región de Huánuco.
//
// 📌 DE DÓNDE SALEN ESTAS COORDENADAS:
//
// En Mapbox las coordenadas siguen el estándar GeoJSON: [longitud, latitud].
// En Huánuco tanto la latitud como la longitud son estrictamente NEGATIVAS
// (hemisferio sur, al oeste de Greenwich).
//
// Las 9 zonas abarcan:
// 1. Conurbación central: Huánuco, Amarilis, Pillco Marca.
// 2. Valles y expansión: Santa María del Valle, Churubamba, San Francisco de Cayrán, Quisqui.
// 3. Ciudades clave de la región: Ambo, Tingo María (Leoncio Prado).

export interface PropiedadesGeoDistrito {
  nombre: string;
  slug: string;
  region: string;
  provincia: string;
  centro: [number, number]; // [longitud, latitud]
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  descripcion: string;
}

export interface FeatureDistrito {
  type: 'Feature';
  id: string;
  properties: PropiedadesGeoDistrito;
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

export interface ColeccionDistritosGeo {
  type: 'FeatureCollection';
  features: FeatureDistrito[];
}

/**
 * Valores referenciales de mercado en Huánuco para zonas sin publicaciones suficientes.
 * Basado en tasaciones e historial real de la región (S/ 1,800 – S/ 3,500 / m²).
 */
export const VALORES_MERCADO_REFERENCIAL = {
  minM2: 1800,
  maxM2: 3500,
  promedioM2: 2450,
  moneda: 'PEN' as const,
};

export const DISTRITOS_GEO_DATA: ColeccionDistritosGeo = {
  type: 'FeatureCollection',
  features: [
    // --- 1. HUÁNUCO (Distrito Capital) ---
    {
      type: 'Feature',
      id: 'huanuco',
      properties: {
        nombre: 'Huánuco',
        slug: 'huanuco',
        region: 'Huánuco',
        provincia: 'Huánuco',
        centro: [-76.2395, -9.9293],
        bbox: [-76.255, -9.943, -76.226, -9.912],
        descripcion: 'Centro histórico, administrativo y comercial de la región.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.2485, -9.921],
            [-76.242, -9.914],
            [-76.233, -9.916],
            [-76.228, -9.924],
            [-76.231, -9.933],
            [-76.236, -9.939],
            [-76.244, -9.941],
            [-76.252, -9.934],
            [-76.253, -9.926],
            [-76.2485, -9.921],
          ],
        ],
      },
    },

    // --- 2. AMARILIS ---
    {
      type: 'Feature',
      id: 'amarilis',
      properties: {
        nombre: 'Amarilis',
        slug: 'amarilis',
        region: 'Huánuco',
        provincia: 'Huánuco',
        centro: [-76.2427, -9.9449],
        bbox: [-76.248, -9.962, -76.214, -9.931],
        descripcion: 'Paucarbamba, San Luis y Llicua. Principal expansión residencial y comercial.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.236, -9.939],
            [-76.231, -9.933],
            [-76.223, -9.936],
            [-76.216, -9.944],
            [-76.22, -9.956],
            [-76.233, -9.96],
            [-76.243, -9.953],
            [-76.24, -9.945],
            [-76.236, -9.939],
          ],
        ],
      },
    },

    // --- 3. PILLCO MARCA ---
    {
      type: 'Feature',
      id: 'pillco-marca',
      properties: {
        nombre: 'Pillco Marca',
        slug: 'pillco-marca',
        region: 'Huánuco',
        provincia: 'Huánuco',
        centro: [-76.2468, -9.961],
        bbox: [-76.264, -9.983, -76.231, -9.94],
        descripcion: 'Cayhuayna y Ciudad Universitaria UNHEVAL. Zona residencial moderna y universitaria.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.244, -9.941],
            [-76.243, -9.953],
            [-76.233, -9.96],
            [-76.237, -9.974],
            [-76.248, -9.981],
            [-76.262, -9.973],
            [-76.259, -9.957],
            [-76.251, -9.948],
            [-76.244, -9.941],
          ],
        ],
      },
    },

    // --- 4. SANTA MARÍA DEL VALLE ---
    {
      type: 'Feature',
      id: 'santa-maria-del-valle',
      properties: {
        nombre: 'Santa María del Valle',
        slug: 'santa-maria-del-valle',
        region: 'Huánuco',
        provincia: 'Huánuco',
        centro: [-76.1699, -9.8628],
        bbox: [-76.215, -9.91, -76.125, -9.83],
        descripcion: 'Valle fértil con alta proyección campestre, casas de campo y terrenos amplios.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.21, -9.89],
            [-76.18, -9.845],
            [-76.14, -9.835],
            [-76.13, -9.87],
            [-76.16, -9.9],
            [-76.2, -9.905],
            [-76.21, -9.89],
          ],
        ],
      },
    },

    // --- 5. CHURUBAMBA ---
    {
      type: 'Feature',
      id: 'churubamba',
      properties: {
        nombre: 'Churubamba',
        slug: 'churubamba',
        region: 'Huánuco',
        provincia: 'Huánuco',
        centro: [-76.1337, -9.8257],
        bbox: [-76.175, -9.86, -76.09, -9.79],
        descripcion: 'Zona de paisajes andinos, agricultura y casas de descanso a orillas del Huallaga.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.17, -9.845],
            [-76.14, -9.795],
            [-76.1, -9.8],
            [-76.095, -9.84],
            [-76.13, -9.855],
            [-76.17, -9.845],
          ],
        ],
      },
    },

    // --- 6. SAN FRANCISCO DE CAYRÁN ---
    {
      type: 'Feature',
      id: 'san-francisco-de-cayran',
      properties: {
        nombre: 'San Francisco de Cayrán',
        slug: 'san-francisco-de-cayran',
        region: 'Huánuco',
        provincia: 'Huánuco',
        centro: [-76.284, -9.9809],
        bbox: [-76.325, -10.02, -76.255, -9.96],
        descripcion: 'Balcón natural de Huánuco, aire puro y miradores residenciales con vistas panorámicas.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.31, -9.965],
            [-76.265, -9.965],
            [-76.26, -9.995],
            [-76.295, -10.015],
            [-76.32, -9.99],
            [-76.31, -9.965],
          ],
        ],
      },
    },

    // --- 7. QUISQUI ---
    {
      type: 'Feature',
      id: 'quisqui',
      properties: {
        nombre: 'Quisqui',
        slug: 'quisqui',
        region: 'Huánuco',
        provincia: 'Huánuco',
        centro: [-76.3924, -9.9046],
        bbox: [-76.45, -9.945, -76.345, -9.875],
        descripcion: 'Valle del río Higueras (Kotosh y Huancapallac). Clima templado y turismo ecológico.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.43, -9.88],
            [-76.36, -9.885],
            [-76.35, -9.925],
            [-76.41, -9.94],
            [-76.445, -9.915],
            [-76.43, -9.88],
          ],
        ],
      },
    },

    // --- 8. AMBO ---
    {
      type: 'Feature',
      id: 'ambo',
      properties: {
        nombre: 'Ambo',
        slug: 'ambo',
        region: 'Huánuco',
        provincia: 'Ambo',
        centro: [-76.2043, -10.1292],
        bbox: [-76.245, -10.17, -76.17, -10.1],
        descripcion: 'Ciudad nexo del valle del Huallaga hacia Lima y Pasco. Fuerte actividad comercial.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.23, -10.105],
            [-76.18, -10.108],
            [-76.175, -10.15],
            [-76.215, -10.165],
            [-76.24, -10.135],
            [-76.23, -10.105],
          ],
        ],
      },
    },

    // --- 9. TINGO MARÍA ---
    {
      type: 'Feature',
      id: 'tingo-maria',
      properties: {
        nombre: 'Tingo María',
        slug: 'tingo-maria',
        region: 'Huánuco',
        provincia: 'Leoncio Prado',
        centro: [-76.0003, -9.2984],
        bbox: [-76.045, -9.345, -75.96, -9.265],
        descripcion: 'La Puerta de la Amazonía. Gran polo turístico, comercial y residencial de selva alta.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.03, -9.27],
            [-75.975, -9.275],
            [-75.965, -9.325],
            [-76.015, -9.34],
            [-76.04, -9.305],
            [-76.03, -9.27],
          ],
        ],
      },
    },
  ],
};

/**
 * Busca la definición GeoJSON de un distrito por su nombre exacto o normalizado.
 */
export function obtenerGeoDistrito(nombre: string): FeatureDistrito | undefined {
  const norm = nombre.trim().toLowerCase();
  return DISTRITOS_GEO_DATA.features.find(
    (f) =>
      f.properties.nombre.toLowerCase() === norm ||
      f.properties.slug === norm ||
      f.id === norm
  );
}

/**
 * Obtiene el bounding box [minLng, minLat, maxLng, maxLat] de un distrito por nombre.
 */
export function obtenerBBoxDistrito(nombre: string): [number, number, number, number] | undefined {
  const geo = obtenerGeoDistrito(nombre);
  return geo?.properties.bbox;
}
