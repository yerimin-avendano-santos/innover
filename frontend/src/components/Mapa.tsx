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
//
// 📌 Y AHORA LOS MARCADORES SE AGRUPAN (ver `lib/clustering.ts`).
//
// Con 40 resultados, la conurbación Huánuco–Amarilis–Pillco Marca se llena de
// precios pisados unos sobre otros, y un mapa de etiquetas amontonadas no
// contesta lo único que tiene que contestar: dónde hay qué. Cuando varias
// chinchetas caben en el mismo puñado de píxeles, se sustituyen por un número;
// al acercarse, el número se rompe en chinchetas.
//
// El componente NO decide cuándo agrupar —eso es lógica pura, con sus casos
// raros y su prueba, y vive en `lib/clustering.ts`—. Aquí solo se pinta lo que
// dice el índice y se traduce un clic en movimiento del mapa.

import { useCallback, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  claseDeGrupo,
  crearIndice,
  ZOOM_SIN_GRUPOS,
  type ElementoMapa,
  type GrupoMapa,
  type IndiceMapa,
  type Limites,
} from '@/lib/clustering';
import type { PuntoMapa } from '@/lib/tipos';
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
  /**
   * Los puntos que se pintan.
   *
   * En el buscador son los de TODA la búsqueda, no solo la página que enseña la
   * lista. 📌 Esa es la diferencia entre un mapa útil y uno que miente: si
   * enseñara solo los 50 primeros, alejarse para ver "dónde hay" diría que hay
   * barrios vacíos que no lo están.
   *
   * En la ficha y en la vista previa de `/publicar` es un único punto: allí el
   * mapa no busca, sitúa.
   */
  puntos: PuntoMapa[];
  /** Cuántas propiedades cumplen los filtros. Por defecto, las que se pintan. */
  total?: number;
  /** Cuántas no se pueden pintar por no tener coordenadas. */
  sinCoordenadas?: number;
  /** Si el backend recortó puntos por su tope. */
  recortado?: boolean;
  /** Propiedad seleccionada. El mapa la resalta. */
  seleccionada?: number | null;
  /** Se llama cuando el usuario hace clic en un marcador. */
  alSeleccionar?: (id: number) => void;
  /**
   * Cambia cuando cambia la BÚSQUEDA, no cuando el usuario mueve el mapa.
   *
   * Sirve para volver a encuadrar: una pregunta nueva merece una vista nueva
   * (si buscas en Tingo María, el mapa no puede quedarse en Huánuco
   * enseñando un vacío). Mover el mapa a mano, en cambio, no cambia esta
   * clave, así que la vista del usuario se respeta.
   */
  claveVista?: string;
  className?: string;
}

export function Mapa({
  puntos,
  total = puntos.length,
  sinCoordenadas = 0,
  recortado = false,
  seleccionada,
  alSeleccionar,
  claveVista = '',
  className = '',
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<mapboxgl.Map | null>(null);

  /**
   * Lo que está pintado, por clave: `p:<id>` para una propiedad, `g:<id>` para
   * un grupo.
   *
   * El mapa es una string y no el id de la propiedad porque en el mismo mapa
   * conviven las dos cosas, y sus ids vienen de sitios distintos (la base de
   * datos y supercluster). Un `Map<number, ...>` los mezclaría.
   */
  const pintados = useRef<Map<string, mapboxgl.Marker>>(new Map());

  /** El índice de agrupación de la búsqueda actual. Se rehace con cada una. */
  const indice = useRef<IndiceMapa | null>(null);

  /**
   * Los puntos actuales, en un ref.
   *
   * El efecto de la selección necesita las coordenadas de la propiedad elegida,
   * pero no debe re-ejecutarse cada vez que llega una búsqueda nueva: eso
   * recentraría el mapa solo. Un ref le da el dato sin crear la dependencia.
   */
  const refPuntos = useRef(puntos);

  /**
   * 📌 POR QUÉ EL CALLBACK VA EN UN REF Y SE ASIGNA EN UN EFECTO
   *
   * El padre (el buscador) pasa una función nueva en cada render:
   *
   *     alSeleccionar={(id) => setSeleccionada(...)}
   *
   * Si el efecto de marcadores dependiera de `alSeleccionar`, se
   * ejecutaría en cada render y reconstruiría todos los marcadores sin parar.
   *
   * Guardarlo en un ref lo mantiene estable. Y se escribe DENTRO de un
   * efecto, no en el cuerpo del componente: asignar un ref durante el
   * render es trabajo en tiempo de renderizado, y React puede descartar
   * ese render (con StrictMode, lo descarta y lo repite). El efecto
   * garantiza que la asignación corresponde a un render confirmado.
   */
  const refSeleccionar = useRef(alSeleccionar);

  /**
   * La propiedad cuya chincheta tiene que abrir su globo en cuanto exista.
   *
   * Cuando se selecciona desde la lista, la propiedad puede estar escondida
   * dentro de un grupo: primero hay que acercarse, y la chincheta no aparecerá
   * hasta que el mapa termine de moverse. Este ref es el recado que se deja
   * para la siguiente pintada.
   */
  const globoPendiente = useRef<number | null>(null);

  /** Con qué búsqueda se encuadró la vista, para no repetirlo. */
  const vistaAjustada = useRef<string | null>(null);

  useEffect(() => {
    refSeleccionar.current = alSeleccionar;
  }, [alSeleccionar]);

  useEffect(() => {
    refPuntos.current = puntos;
  }, [puntos]);

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

  /**
   * Traduce un clic en un grupo en un movimiento del mapa.
   *
   * Se va al zoom al que ESE grupo se abre, no a un zoom fijo: un grupo de 3
   * propiedades repartidas en tres manzanas se abre enseguida, y uno de 200
   * necesita acercarse bastante más. Lo dice supercluster, que es quien sabe
   * a qué zoom se rompe.
   */
  const abrirGrupo = useCallback((grupo: GrupoMapa) => {
    const instancia = mapa.current;
    const actual = indice.current;
    if (!instancia || !actual) return;

    const destino = actual.zoomDeExpansion(grupo.id);
    if (destino === null) return;

    // +0.01 y no el zoom pelado: supercluster decide por el SUELO del zoom, así
    // que aterrizar justo en el número que devuelve puede volver a montar el
    // mismo grupo (el borde está compartido con el nivel de debajo). Un pelo
    // más adentro, el grupo se rompe siempre.
    instancia.easeTo({
      center: [grupo.longitud, grupo.latitud],
      zoom: destino + 0.01,
      duration: 500,
    });
  }, []);

  /**
   * Pinta lo que corresponde a la ventana y el zoom actuales.
   *
   * 📌 SOLO SE PINTAN LOS MARCADORES QUE SE VEN.
   *
   * Antes había uno por propiedad, siempre, aunque estuviera a 40 km de la
   * pantalla. Con el respaldo de la lista (50) se aguantaba; con la búsqueda
   * entera (hasta 1.000 puntos) serían mil elementos en el DOM moviéndose a
   * cada arrastre, para nada: Mapbox los movería igual aunque nadie los mirara.
   */
  const pintar = useCallback(() => {
    const instancia = mapa.current;
    const actual = indice.current;
    if (!instancia || !actual) return;

    const caja = instancia.getBounds();
    if (!caja) return;

    const elementos = actual.elementos(aLimites(caja), Math.floor(instancia.getZoom()));
    const clavesEnPantalla = new Set<string>();

    for (const elemento of elementos) {
      const clave =
        elemento.tipo === 'grupo' ? `g:${elemento.id}` : `p:${elemento.punto.id}`;
      clavesEnPantalla.add(clave);

      if (pintados.current.has(clave)) continue;

      pintados.current.set(
        clave,
        crearMarcador(instancia, elemento, {
          alSeleccionar: (id) => refSeleccionar.current?.(id),
          alAbrirGrupo: abrirGrupo,
        })
      );
    }

    // Lo que ya no toca pintar se retira. No es solo memoria: un grupo que se
    // abrió se descompone en chinchetas que llevan su propio id, así que
    // quedarse con el grupo viejo dejaría el número grande encima.
    for (const [clave, marcador] of pintados.current) {
      if (!clavesEnPantalla.has(clave)) {
        marcador.remove();
        pintados.current.delete(clave);
      }
    }

    // El recado de la selección: si su chincheta ya está, se abre su globo.
    if (globoPendiente.current !== null) {
      const marcador = pintados.current.get(`p:${globoPendiente.current}`);
      if (marcador) {
        // Con la guarda para no CERRAR el globo del que ya está abierto: el
        // caso normal es pulsar la chincheta directamente, y Mapbox ya se lo
        // abrió solo.
        if (!marcador.getPopup()?.isOpen()) marcador.togglePopup();
        globoPendiente.current = null;
      }
    }
  }, [abrirGrupo]);

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
    const registro = pintados.current;

    return () => {
      registro.clear();
      instancia.remove();
      mapa.current = null;
    };
  }, [token]);

  // ========================================
  // 2. Preparar el índice y encuadrar la búsqueda
  // ========================================
  useEffect(() => {
    indice.current = crearIndice(puntos);

    // Los marcadores pintados son de la búsqueda ANTERIOR. Se limpian aquí y no
    // en `pintar` porque los que quedaron fuera de la ventana no volverían a
    // pasar por el repaso (que solo retira los que están dentro y sobran).
    for (const marcador of pintados.current.values()) marcador.remove();
    pintados.current.clear();

    const instancia = mapa.current;
    if (instancia && puntos.length > 0 && claveVista !== vistaAjustada.current) {
      ajustarVista(instancia, puntos);
      vistaAjustada.current = claveVista;
    }

    pintar();
  }, [puntos, claveVista, pintar]);

  // ========================================
  // 3. Repintar cuando el mapa se mueve
  // ========================================
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;

    // `moveend` cubre arrastrar, rodar la rueda y hacer zoom: se dispara
    // cuando el movimiento TERMINA, que es justo cuando cambia lo que se ve.
    // Escuchar `move` repintaría en cada fotograma del arrastre.
    instancia.on('moveend', pintar);

    return () => {
      instancia.off('moveend', pintar);
    };
  }, [pintar]);

  // ========================================
  // 4. Resaltar y traer a la vista la seleccionada
  // ========================================
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;

    // Deseleccionar cancela el globo que estuviera esperando: si no, aparecería
    // solo, más tarde, al mover el mapa.
    if (seleccionada === null || seleccionada === undefined) {
      globoPendiente.current = null;
      return;
    }

    // Resaltado: el color y el tamaño no se escriben aquí, se enciende y se
    // apaga la clase.
    //
    // Antes esto era `style.backgroundColor = activo ? '#14181a' : '#0f6b70'`,
    // y con el marcador destacado habría fallado en silencio: ese marcador se
    // pinta con una imagen de fondo, y una imagen de fondo se dibuja ENCIMA del
    // color. El marcador destacado se habría quedado verde al seleccionarlo,
    // sin ningún error. Con clases, cuál gana lo decide el CSS.
    for (const [clave, marcador] of pintados.current) {
      if (!clave.startsWith('p:')) continue; // los grupos no se seleccionan
      marcador
        .getElement()
        .classList.toggle('marcador-seleccionado', Number(clave.slice(2)) === seleccionada);
    }

    globoPendiente.current = seleccionada;

    // Caso 1: se ve suelta. Solo se centra: el zoom que eligió el usuario no se
    // toca.
    const suelta = pintados.current.get(`p:${seleccionada}`);
    if (suelta) {
      instancia.easeTo({ center: suelta.getLngLat(), duration: 600 });
      return;
    }

    const punto = refPuntos.current.find((p) => p.id === seleccionada);
    if (!punto) return;

    const caja = instancia.getBounds();
    const zoom = Math.floor(instancia.getZoom());
    const escondida = caja
      ? indice.current?.grupoQueEsconde(seleccionada, aLimites(caja), zoom) ?? null
      : null;

    // Caso 2: está debajo de un grupo que se ve. Se va al zoom al que ese grupo
    // se abre —lo mínimo para verla, sin desarmar el resto del mapa— y se
    // centra en la propiedad, no en el grupo.
    if (escondida) {
      const destino = indice.current?.zoomDeExpansion(escondida.id) ?? null;
      instancia.easeTo({
        center: [punto.longitud, punto.latitud],
        zoom: destino === null ? ZOOM_SIN_GRUPOS : destino + 0.01,
        duration: 600,
      });
      return;
    }

    // Caso 3: ni se ve ni se sabe qué grupo la tapa (el usuario movió el mapa a
    // otra zona). Se va a por ella a un zoom donde no hay agrupación posible.
    instancia.easeTo({
      center: [punto.longitud, punto.latitud],
      zoom: Math.max(zoom, ZOOM_SIN_GRUPOS),
      duration: 600,
    });
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

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* `min-h-0` + `flex-1`: sin esto el div del mapa no cede altura
          al aviso de abajo y el mapa se sale del contenedor. */}
      <div ref={contenedor} className="mapa-aparece min-h-0 w-full flex-1" />

      {/*
        Los avisos van FUERA del mapa, no encima.

        Antes el de las coordenadas estaba en `absolute bottom-3` y se
        superponía a los marcadores y a la atribución de Mapbox. En móvil
        ocupaba media pantalla y tapaba justo lo que el usuario venía a ver.
      */}
      {recortado && (
        <p className="border-t border-linea bg-papel-alto px-4 py-2 text-micro text-tinta-70">
          El mapa enseña {puntos.length} de {total} propiedades. Afina los filtros para ver el
          resto.
        </p>
      )}

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

/** De los límites de Mapbox a la caja que entiende el agrupador. */
function aLimites(caja: mapboxgl.LngLatBounds): Limites {
  return [caja.getWest(), caja.getSouth(), caja.getEast(), caja.getNorth()];
}

/**
 * Crea el marcador de un elemento —una propiedad o un grupo— y lo añade al mapa.
 *
 * El color no se pone aquí: sale de `globals.css`. Un marcador destacado lleva
 * el degradado de marca y un grupo el azul marino, y esa diferencia es una
 * clase más, no un hexadecimal repetido en JavaScript.
 */
function crearMarcador(
  instancia: mapboxgl.Map,
  elemento: ElementoMapa,
  acciones: {
    alSeleccionar: (id: number) => void;
    alAbrirGrupo: (grupo: GrupoMapa) => void;
  }
): mapboxgl.Marker {
  const boton = document.createElement('button');
  boton.type = 'button';

  // Los grupos se anclan por el centro y las chinchetas por abajo: una
  // chincheta con forma de caja "se clava" en el punto; un círculo se apoya en
  // él.
  let ancla: 'center' | 'bottom' = 'center';

  if (elemento.tipo === 'grupo') {
    const { cantidad } = elemento;
    boton.className = `marcador-grupo ${claseDeGrupo(cantidad)}`;
    boton.textContent = String(cantidad);
    // El "acércate" no es adorno: un número sin instrucción se lee como un
    // dato, y lo que hay que entender es que se puede abrir.
    boton.setAttribute(
      'aria-label',
      `${cantidad} propiedades en esta zona. Acércate para verlas.`
    );

    boton.addEventListener('click', (evento) => {
      evento.stopPropagation();
      acciones.alAbrirGrupo(elemento);
    });
  } else {
    const { punto } = elemento;
    ancla = 'bottom';

    boton.className = punto.destacado ? 'marcador marcador-destacado' : 'marcador';

    const texto = formatearPrecio(punto.precio, punto.moneda);
    boton.setAttribute('aria-label', `${punto.titulo}, ${texto}`);

    // El ancho crece con el número de dígitos del precio, para que
    // "S/ 1,680" y "S/ 385,000" no se desborden.
    //
    // Esta medida SÍ se queda en JavaScript, y es la excepción que
    // confirma la regla de "los colores viven en globals.css": no es una
    // decisión de diseño, es un cálculo sobre el dato. Con un ancho fijo
    // en CSS, un precio de seis cifras se saldría de la caja, y no hay
    // forma de conocer los dígitos sin mirar el precio.
    boton.style.width = `${Math.max(48, texto.length * 7 + 16)}px`;
    boton.style.height = '28px';
    boton.style.padding = '0 8px';
    boton.textContent = texto;

    boton.addEventListener('click', (evento) => {
      evento.stopPropagation();
      acciones.alSeleccionar(punto.id);
    });
  }

  const marcador = new mapboxgl.Marker({ element: boton, anchor: ancla })
    .setLngLat([elemento.longitud, elemento.latitud]);

  // El globo es de las propiedades, no de los grupos: un grupo no tiene nada
  // que contar (ni título, ni precio) y su clic ya significa "acércate".
  if (elemento.tipo === 'propiedad') {
    marcador.setPopup(
      new mapboxgl.Popup({ offset: 20, closeButton: true }).setDOMContent(
        crearGlobo(elemento.punto)
      )
    );
  }

  return marcador.addTo(instancia);
}

/**
 * Construye el globo del popup con NODOS, no con HTML.
 *
 * Esta es la función que cierra el XSS. Todo lo que venga de la base de
 * datos se inserta con textContent, que siempre trata el dato como texto
 * plano. Es imposible que se interprete como marcado.
 */
function crearGlobo(punto: PuntoMapa): HTMLElement {
  const contenedor = document.createElement('div');
  contenedor.className = 'globo';

  // --- Título ---
  const titulo = document.createElement('p');
  titulo.textContent = punto.titulo;
  titulo.className = 'globo-titulo';
  contenedor.appendChild(titulo);

  // --- Precio ---
  const precio = document.createElement('p');
  precio.textContent = formatearPrecio(punto.precio, punto.moneda);
  precio.className = 'globo-precio';
  contenedor.appendChild(precio);

  // --- Metadatos ---
  const detalles: string[] = [etiquetaTipo(punto.tipo_inmueble)];

  if (punto.habitaciones > 0) detalles.push(`${punto.habitaciones} hab.`);
  if (punto.area_m2) detalles.push(`${punto.area_m2} m²`);
  if (punto.distrito) detalles.push(punto.distrito.nombre);

  const meta = document.createElement('p');
  meta.textContent = detalles.join(' · ');
  meta.className = 'globo-meta';
  contenedor.appendChild(meta);

  return contenedor;
}

/** Encuadra el mapa para que quepan todos los puntos de la búsqueda. */
function ajustarVista(instancia: mapboxgl.Map, puntos: PuntoMapa[]): void {
  if (puntos.length === 0) return;

  if (puntos.length === 1) {
    instancia.easeTo({
      center: [puntos[0].longitud, puntos[0].latitud],
      zoom: 14,
      duration: 600,
    });
    return;
  }

  const limites = new mapboxgl.LngLatBounds();

  for (const p of puntos) {
    limites.extend([p.longitud, p.latitud]);
  }

  // `maxZoom: 15`: con dos puntos casi pegados, encuadrar "perfecto" daría un
  // zoom de calle que esconde todo lo demás. Y `padding` para que las
  // chinchetas del borde no queden medio fuera.
  instancia.fitBounds(limites, { padding: 60, maxZoom: 15, duration: 600 });
}
