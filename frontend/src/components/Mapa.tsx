'use client';

// ========================================
// 🗺️ MAPA DE PROPIEDADES
// ========================================
// Muestra las propiedades como marcadores sobre Mapbox.
//
// Este componente tenía DOS bugs serios que ya están corregidos:
//
// ⛔ BUG 1 — XSS. Usaba `setHTML()` con datos del usuario interpolados:
//     .setHTML(`<div>${prop.titulo}</div>`)
//     Un propietario podía titular su propiedad
//     `<img src=x onerror="...robar cookie...">` y robar la sesión de
//     quien abriera el mapa. La API pública no exige sesión, así que no
//     hacía falta ni estar registrado.
//
//     Ahora el globo se construye con NODOS DE DOM y textContent.
//     textContent treats any string as plain text, nunca as HTML.
//     Un título con `<script>` sale escrito literal, sin ejecutarse.
//
// ⛔ BUG 2 — El mapa se recreaba entero en cada cambio.
//     El efecto dependía de [properties], así que cada filtro
//     destruía y volvía a construir el mapa: el usuario perdía el zoom
//     y la posición cada vez que escribía en el buscador.
//
//     Ahora el mapa se crea UNA vez y solo se actualizan los marcadores.

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Propiedad } from '@/lib/tipos';
import { formatearPrecio, etiquetaTipo } from '@/lib/api';

/**
 * Centro por defecto del mapa.
 *
 * Es la Plaza de Armas de Huánuco, donde Innover arranca. Está aquí y no
 * dentro del componente por el mismo motivo que los colores viven en
 * `globals.css`: el día que se abra una segunda región, se cambia en un sitio.
 *
 * ⚠️ Mapbox usa [longitud, latitud] — al revés que todo el resto del proyecto
 * (PostGIS, el backend y el seed trabajan con latitud primero). Equivocarse
 * aquí no da error: el mapa se centra en otro continente y el marcador
 * aparece a 3.000 km.
 */
const CENTRO_POR_DEFECTO: [number, number] = [-76.2395, -9.9293];

interface Props {
  propiedades: Propiedad[];
  /** Propiedad seleccionada. El mapa la resalta. */
  seleccionada?: number | null;
  /** Se llama cuando el usuario hace clic en un marcador. */
  alSeleccionar?: (id: number) => void;
  className?: string;
}

export function Mapa({
  propiedades,
  seleccionada,
  alSeleccionar,
  className = '',
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<mapboxgl.Map | null>(null);
  const marcadores = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const ajustadoUnaVez = useRef(false);

  /**
   * 📌 POR QUÉ EL CALLBACK VA EN UN REF Y SE ASIGNA EN UN EFECTO
   *
   * El padre (el buscador) pasa una función nueva en cada render:
   *
   *     alSeleccionar={(id) => setSeleccionada(...)}
   *
   * Si el efecto de marcadores dependiera de `alSeleccionar`, se
   * ejecutaría en cada render y reconstru todos los marcadores sin parar.
   *
   * Guardarlo en un ref lo mantiene estable. Y se escribe DENTRO de un
   * efecto, no en el cuerpo del componente: asignar un ref durante el
   * render es trabajo en tiempo de renderizado, y React puede descartar
   * ese render (con StrictMode, lo descarta y lo repite). El efecto
   * guarantee que la asignación corresponde a un render confirmado.
   */
  const refSeleccionar = useRef(alSeleccionar);

  useEffect(() => {
    refSeleccionar.current = alSeleccionar;
  }, [alSeleccionar]);

  /**
   * ⚠️ `tokenFalta` no es estado: se deriva directamente de `token`.
   *
   * Antes había un `useState` que se ponía en `true` dentro del efecto
   * cuando faltaba el token. Eso obligaba a un render extra y, peor,
   * guards contra `tokenFalta` desincronizado (el efecto corre después
   * del primer render, así que había un instante con un mapa vacío).
   *
   * Si el token no está, no hay mapa. Basta con mirarlo.
   */
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const tokenFalta = !token;

  // ========================================
  // 1. Crear el mapa UNA sola vez
  // ========================================
  useEffect(() => {
    if (!token) return;
    if (!contenedor.current) return;

    mapboxgl.accessToken = token;

    const instancia = new mapboxgl.Map({
      container: contenedor.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: CENTRO_POR_DEFECTO,
      // 12 y no 11: Lima es una mancha urbana de 50 km y necesitaba alejarse;
      // la conurbación de Huánuco mide unos 5 km. Con el zoom de Lima, las
      // propiedades de Huánuco, Amarilis y Pillco Marca caerían amontonadas
      // en el mismo píxel.
      zoom: 12,
      attributionControl: true,
    });

    instancia.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    mapa.current = instancia;

    // 📌 La limpieza captura una COPIA del ref. Si escribiéramos
    // `marcadores.current.clear()` dentro del return, el linter avisa
    // (y con razón): entre el efecto y su limpieza el ref puede haber
    // cambiado, y estaríamos limpiando el mapa equivocado.
    const registro = marcadores.current;

    return () => {
      registro.clear();
      instancia.remove();
      mapa.current = null;
    };
  }, [token]);

  // ========================================
  // 2. Sincronizar los marcadores
  // ========================================
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;

    const registro = marcadores.current;

    // Quitar los marcadores que ya no están en la lista.
    const idsActuales = new Set(propiedades.map((p) => p.id));

    for (const [id, marcador] of registro) {
      if (!idsActuales.has(id)) {
        marcador.remove();
        registro.delete(id);
      }
    }

    // Agregar los que son nuevos.
    for (const propiedad of propiedades) {
      if (propiedad.latitud === null || propiedad.longitud === null) continue;
      if (registro.has(propiedad.id)) continue;

      const elemento = crearMarcador(propiedad, (id) => refSeleccionar.current?.(id));
      const marcador = new mapboxgl.Marker({ element: elemento, anchor: 'bottom' })
        .setLngLat([propiedad.longitud, propiedad.latitud])
        .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: true }).setDOMContent(crearGlobo(propiedad)))
        .addTo(instancia);

      registro.set(propiedad.id, marcador);
    }

    // Encuadrar solo la primera vez: después el usuario puede haber
    // movido el mapa a propósito y no queremos pisarle la vista.
    if (propiedades.length > 0 && !ajustadoUnaVez.current) {
      ajustarVista(instancia, propiedades);
      ajustadoUnaVez.current = true;
    }
  }, [propiedades]);

  // ========================================
  // 3. Resaltar la seleccionada
  // ========================================
  useEffect(() => {
    const registro = marcadores.current;

    for (const [id, marcador] of registro) {
      const elemento = marcador.getElement();
      const activo = id === seleccionada;

      // El color no se escribe aquí: se enciende y se apaga la clase.
      //
      // Antes esto era `style.backgroundColor = activo ? '#14181a' :
      // '#0f6b70'`, y con el marcador destacado habría fallado en
      // silencio: ese marcador se pinta con una imagen de fondo, y una
      // imagen de fondo se dibuja ENCIMA del color. El marcador
      // destacado se habría quedado verde al seleccionarlo, sin ningún
      // error. Con clases, cuál gana lo decide el CSS.
      elemento.classList.toggle('marcador-seleccionado', activo);

      // El seleccionado va un punto mayor: es el que se está leyendo.
      elemento.style.transform = activo ? 'scale(1.15)' : 'scale(1)';
      elemento.style.zIndex = activo ? '10' : '1';
    }

    // Centrar en la selección sin perder el zoom del usuario.
    if (seleccionada) {
      const marcador = registro.get(seleccionada);
      if (marcador) {
        mapa.current?.easeTo({ center: marcador.getLngLat(), duration: 600 });
        marcador.togglePopup();
      }
    }
  }, [seleccionada]);

  // ========================================
  // Estados sin datos
  // ========================================
  if (tokenFalta) {
    return (
      <div
        className={`flex items-center justify-center bg-papel-hundido p-8 text-center ${className}`}
      >
        <div className="max-w-sm">
          <p className="text-grande font-semibold text-tinta">Falta configurar el mapa</p>
          <p className="mt-2 text-menor text-tinta-50">
            Añade <code className="cifra rounded bg-papel-alto px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code>{' '}
            a tu archivo <code className="cifra rounded bg-papel-alto px-1">.env.local</code> y
            reinicia el servidor.
          </p>
        </div>
      </div>
    );
  }

  const sinCoordenadas = propiedades.filter(
    (p) => p.latitud === null || p.longitud === null
  ).length;

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* `min-h-0` + `flex-1`: sin esto el div del mapa no cede altura
          al aviso de abajo y el mapa se sale del contenedor. */}
      <div ref={contenedor} className="mapa-aparece min-h-0 w-full flex-1" />

      {/*
        El aviso va FUERA del mapa, no encima.

        Antes estaba en `absolute bottom-3` y se superponía a los
        marcadores y a la atribución de Mapbox. En móvil ocupaba media
        pantalla y tapaba justo lo que el usuario venía a ver.
      */}
      {sinCoordenadas > 0 && (
        <p className="border-t border-linea bg-papel-alto px-4 py-2 text-micro text-tinta-70">
          {sinCoordenadas}{' '}
          {sinCoordenadas === 1
            ? 'propiedad no aparece en el mapa por no tener coordenadas.'
            : 'propiedades no aparecen en el mapa por no tener coordenadas.'}
        </p>
      )}
    </div>
  );
}

// ========================================
// Constructores del DOM
// ========================================

/**
 * Crea el elemento DOM del marcador.
 *
 * Cada marcador muestra el precio: es el dato por el que la gente
 * elige, y cabe en un cuadrado de 44×28 px.
 */
function crearMarcador(propiedad: Propiedad, alHacerClic: (id: number) => void): HTMLElement {
  const el = document.createElement('button');

  el.type = 'button';
  // El color no se pone aquí: sale de `globals.css`. Un marcador
  // destacado lleva el degradado de marca, y esa diferencia es una
  // clase más, no un hexadecimal repetido en JavaScript.
  el.className = propiedad.destacado ? 'marcador marcador-destacado' : 'marcador';
  el.setAttribute('aria-label', `${propiedad.titulo}, ${formatearPrecio(propiedad.precio, propiedad.moneda)}`);

  // El ancho crece con el número de dígitos del precio, para que
  // "S/ 1,680" y "S/ 385,000" no se desborden.
  //
  // Esta medida SÍ se queda en JavaScript, y es la excepción que
  // confirma la regla de "los colores viven en globals.css": no es una
  // decisión de diseño, es un cálculo sobre el dato. Con un ancho fijo
  // en CSS, un precio de seis cifras se saldría de la caja, y no hay
  // forma de conocer los dígitos sin mirar el precio.
  const texto = formatearPrecio(propiedad.precio, propiedad.moneda);
  el.style.width = `${Math.max(48, texto.length * 7 + 16)}px`;
  el.style.height = '28px';
  el.style.padding = '0 8px';

  el.textContent = texto;

  el.addEventListener('click', (evento) => {
    evento.stopPropagation();
    alHacerClic(propiedad.id);
  });

  return el;
}

/**
 * Construye el globo del popup con NODOS, no con HTML.
 *
 * Esta es la función que cierra el XSS. Todo lo que venga de la base de
 * datos se inserta con textContent, que siempre trata el dato como texto
 * plano. Es imposible que se interprete como marcado.
 */
function crearGlobo(propiedad: Propiedad): HTMLElement {
  const contenedor = document.createElement('div');
  contenedor.className = 'globo';

  // --- Título ---
  const titulo = document.createElement('p');
  titulo.textContent = propiedad.titulo;
  titulo.className = 'globo-titulo';
  contenedor.appendChild(titulo);

  // --- Precio ---
  const precio = document.createElement('p');
  precio.textContent = formatearPrecio(propiedad.precio, propiedad.moneda);
  precio.className = 'globo-precio';
  contenedor.appendChild(precio);

  // --- Metadatos ---
  const detalles: string[] = [etiquetaTipo(propiedad.tipo_inmueble)];

  if (propiedad.habitaciones > 0) detalles.push(`${propiedad.habitaciones} hab.`);
  if (propiedad.area_m2) detalles.push(`${propiedad.area_m2} m²`);
  if (propiedad.distrito) detalles.push(propiedad.distrito.nombre);

  const meta = document.createElement('p');
  meta.textContent = detalles.join(' · ');
  meta.className = 'globo-meta';
  contenedor.appendChild(meta);

  return contenedor;
}

/** Encuadra el mapa para que quepan todos los marcadores. */
function ajustarVista(instancia: mapboxgl.Map, propiedades: Propiedad[]): void {
  const conCoordenadas = propiedades.filter(
    (p) => p.latitud !== null && p.longitud !== null
  );

  if (conCoordenadas.length === 0) return;

  if (conCoordenadas.length === 1) {
    instancia.easeTo({
      center: [conCoordenadas[0].longitud!, conCoordenadas[0].latitud!],
      zoom: 14,
      duration: 600,
    });
    return;
  }

  const limites = new mapboxgl.LngLatBounds();

  for (const p of conCoordenadas) {
    limites.extend([p.longitud!, p.latitud!]);
  }

  instancia.fitBounds(limites, { padding: 60, maxZoom: 15, duration: 600 });
}
