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

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
  /**
   * Muestra el botón "Mi ubicación" dentro del mapa.
   *
   * Solo lo enciende el buscador. La ficha y la vista previa de /publicar
   * no lo necesitan, y pedir el permiso de ubicación en una pantalla que
   * solo enseña una casa sería una interrupción sin propósito.
   */
  conUbicacion?: boolean;
  className?: string;
}

/** Los estados del botón de ubicación. */
type EstadoUbicacion = 'inactivo' | 'buscando' | 'activo' | 'error';

export function Mapa({
  puntos,
  total = puntos.length,
  sinCoordenadas = 0,
  recortado = false,
  seleccionada,
  alSeleccionar,
  claveVista = '',
  conUbicacion = false,
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

  /**
   * El control de Mapbox que pide la ubicación.
   *
   * Se guarda en un ref porque el botón visible es NUESTRO: el control
   * real va con `showButton: false` y solo existe para que Mapbox pinte
   * el punto, el círculo de precisión y mueva la cámara con su lógica.
   * Guardarlo en estado obligaría a un render extra que no cambia nada
   * de lo que se ve.
   */
  const geolocalizador = useRef<mapboxgl.GeolocateControl | null>(null);

  /**
   * Si ya obtuvimos una ubicación.
   *
   * El aviso de "lejos" escucha `moveend` y no debe aparecer cuando el
   * mapa se encuadra a los resultados ni cuando el usuario arrastra sin
   * haber usado "Mi ubicación". Un ref evita que el listener se vuelva a
   * suscribir en cada render.
   */
  const ubicacionActiva = useRef(false);

  const [estadoUbicacion, setEstadoUbicacion] = useState<EstadoUbicacion>('inactivo');
  const [precisionUbicacion, setPrecisionUbicacion] = useState<number | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [lejosDeResultados, setLejosDeResultados] = useState(false);

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
   * Si este navegador no puede dibujar el mapa.
   *
   * Se lee con `useSyncExternalStore` —el mismo recurso que el correo recordado
   * del acceso— y no con un `useState` que el efecto rellene: escribir estado
   * desde un efecto es un render en cascada, y el linter lo prohíbe con razón.
   * Preguntarlo en el primer render tampoco vale, porque el servidor no tiene
   * canvas: pintaría el mapa y el navegador el aviso, y la hidratación saltaría.
   * El `true` de la tercera línea es la instantánea del servidor —"aquí no se
   * puede saber, pero lo normal es que sí"—; ya montado, React la contrasta con
   * la realidad y repinta si no coinciden.
   *
   * De qué protege: Mapbox GL v3 exige WebGL2 y su constructor LANZA cuando no
   * lo consigue. Esa excepción, dentro de un efecto, no se queda en el mapa:
   * React desmonta el árbol entero y se cae la pantalla completa —lista,
   * filtros y fichas— por un mapa que ni siquiera se puede pintar.
   */
  const sinWebGL = !useSyncExternalStore(
    suscribirSoporteMapa,
    leerSoporteMapa,
    () => true
  );

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

    // Antes de tocar Mapbox: ¿puede este navegador dibujar? Sin WebGL2 el
    // constructor lanza, así que este efecto no debe llegar hasta ahí. El aviso
    // ocupa el sitio del mapa.
    if (!leerSoporteMapa()) {
      anotarQueNoSePudo();
      return;
    }

    mapboxgl.accessToken = token;

    let instancia: mapboxgl.Map;
    try {
      instancia = new mapboxgl.Map({
        container: contenedor.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: CENTRO_POR_DEFECTO,
        // 13 y no 12: el arranque tiene que enseñar la conurbación
        // Huánuco–Amarilis–Pillco Marca con las manzanas legibles, no un
        // punto. Si luego llegan resultados, `ajustarVista()` manda: el
        // zoom inicial solo se ve en el primer instante o si no hay nada.
        zoom: 13,
        attributionControl: true,
      });
    } catch (fallo) {
      // La comprobación de arriba no es infalible: hay controladores que
      // aceptan el contexto y luego fallan al compilar los sombreadores (por
      // eso Mapbox comprueba eso mismo antes de rendirse). Para quien mira, el
      // aviso es el mismo; el motivo real que dé Mapbox se queda en la consola,
      // no se convierte en un mensaje genérico.
      console.warn('[Mapa] El navegador no pudo inicializar el mapa:', fallo);
      anotarQueNoSePudo();
      return;
    }

    instancia.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    mapa.current = instancia;

    // 📌 La limpieza captura una COPIA del ref. Si escribiéramos
    // `marcadores.current.clear()` dentro del return, el linter avisa
    // (y con razón): entre el efecto y su limpieza el ref puede haber
    // cambiado, y estaríamos limpiando el mapa equivocado.
    const registro = pintados.current;

    /**
     * El aviso de "lejos" se decide por lo que se VE, no por kilómetros.
     *
     * Después de centrar el mapa en la persona, ¿queda alguna propiedad
     * dentro del encuadre? Si no, la lista sigue ahí abajo pero el mapa no
     * la respalda, y el botón "Ver resultados" devuelve la vista de la
     * búsqueda. Se comprueba al terminar cualquier movimiento porque si la
     * persona vuelve a los resultados a mano, el aviso debe desaparecer.
     *
     * El ref `ubicacionActiva` evita que el aviso aparezca al encuadrar
     * los resultados o al arrastrar el mapa sin haber usado la ubicación.
     */
    const alTerminarMovimiento = () => {
      if (!conUbicacion) return;

      if (!ubicacionActiva.current) {
        setLejosDeResultados(false);
        return;
      }

      const caja = instancia.getBounds();
      if (!caja) return;

      const hayResultados = refPuntos.current.some((punto) =>
        caja.contains([punto.longitud, punto.latitud])
      );

      setLejosDeResultados(refPuntos.current.length > 0 && !hayResultados);
    };

    let quitarEscuchasUbicacion: (() => void) | null = null;

    if (conUbicacion) {
      instancia.on('moveend', alTerminarMovimiento);

      /*
       * `showButton: false` + nuestro botón: Mapbox sigue haciendo el
       * trabajo difícil —pedir el permiso, pintar el punto, dibujar el
       * círculo de precisión y ajustar el zoom a la exactitud—, pero la
       * interfaz es la de Innover y no un control con el estilo de Mapbox.
       *
       * `enableHighAccuracy` es lo que hace que en el móvil use el GPS y
       * no solo la celda; el `maxZoom` de 16 evita que una precisión de
       * 10 m acerque tanto que se pierda el barrio.
       */
      const control = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        },
        fitBoundsOptions: { maxZoom: 16, padding: 40 },
        trackUserLocation: false,
        showUserLocation: true,
        showAccuracyCircle: true,
        showButton: false,
      });

      const alUbicarse = (posicion: GeolocationPosition) => {
        ubicacionActiva.current = true;
        setEstadoUbicacion('activo');
        setPrecisionUbicacion(posicion.coords.accuracy);
        setErrorUbicacion(null);
      };

      const alFallar = (error: GeolocationPositionError) => {
        ubicacionActiva.current = false;
        setEstadoUbicacion('error');
        setPrecisionUbicacion(null);
        setErrorUbicacion(mensajeDeUbicacion(error));
        setLejosDeResultados(false);
      };

      control.on('geolocate', alUbicarse);
      control.on('error', alFallar);
      instancia.addControl(control, 'bottom-right');
      geolocalizador.current = control;

      quitarEscuchasUbicacion = () => {
        control.off('geolocate', alUbicarse);
        control.off('error', alFallar);
      };
    }

    return () => {
      instancia.off('moveend', alTerminarMovimiento);
      quitarEscuchasUbicacion?.();
      registro.clear();
      instancia.remove();
      mapa.current = null;
      geolocalizador.current = null;
    };
  }, [token, conUbicacion]);

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
  // 5. El botón visible de ubicación
  // ========================================
  /**
   * Pide la ubicación y centra el mapa.
   *
   * 📌 POR QUÉ SE COMPRUEBA `isSecureContext` ANTES DE TOCAR MAPBOX
   *
   * La geolocalización del navegador solo funciona en HTTPS o en localhost.
   * En el móvil, si se abre la aplicación con `http://192.168.x.x:3000`, el
   * navegador no pregunta siquiera: falla. Sin esta comprobación el usuario
   * vería un error genérico y pensaría que la aplicación está rota; con ella,
   * se le dice exactamente qué pasa y qué hacer.
   *
   * No se desactiva el botón de antemano para no cambiar el HTML entre el
   * servidor y el navegador: la comprobación ocurre al pulsar.
   */
  const usarMiUbicacion = () => {
    setErrorUbicacion(null);
    setLejosDeResultados(false);
    ubicacionActiva.current = false;

    if (!window.isSecureContext) {
      setEstadoUbicacion('error');
      setPrecisionUbicacion(null);
      setErrorUbicacion(
        'El navegador solo comparte tu ubicación en HTTPS o en localhost. Si estás en el móvil, abre la versión publicada o un túnel HTTPS.'
      );
      return;
    }

    if (!('geolocation' in navigator)) {
      setEstadoUbicacion('error');
      setPrecisionUbicacion(null);
      setErrorUbicacion(
        'Este navegador no ofrece ubicación. Puedes seguir buscando moviendo el mapa o usando los filtros.'
      );
      return;
    }

    const control = geolocalizador.current;
    if (!control) {
      setEstadoUbicacion('error');
      setPrecisionUbicacion(null);
      setErrorUbicacion(
        'El mapa todavía no está listo. Espera un momento e inténtalo otra vez.'
      );
      return;
    }

    setEstadoUbicacion('buscando');
    setPrecisionUbicacion(null);

    // `trigger()` devuelve false si el control no llegó a añadirse al mapa.
    // En ese caso no habrá evento `error`, así que el mensaje se pone aquí.
    if (!control.trigger()) {
      setEstadoUbicacion('error');
      setErrorUbicacion(
        'El navegador no pudo iniciar la ubicación. Espera un momento e inténtalo otra vez.'
      );
      return;
    }

    /*
     * ⚠️ La ubicación se marca activa AQUÍ, no en el evento `geolocate`.
     *
     * Mapbox mueve la cámara antes de avisar que ya tiene la posición:
     * `_onSuccess()` llama a `fitBounds()` y solo después emite `geolocate`.
     * El `moveend` de ese encuadre llega primero, así que si el ref se
     * encendiera en `geolocate`, el aviso de "lejos" se evaluaría con la
     * ubicación todavía apagada y no aparecería nunca. Si el permiso falla,
     * `alFallar` lo vuelve a apagar.
     */
    ubicacionActiva.current = true;
  };

  /** Vuelve al encuadre de los resultados sin apagar el punto de ubicación. */
  const volverAResultados = () => {
    const instancia = mapa.current;
    if (!instancia || refPuntos.current.length === 0) return;

    ajustarVista(instancia, refPuntos.current);
    setLejosDeResultados(false);
  };

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

  if (sinWebGL) {
    return (
      <div
        className={`flex items-center justify-center bg-papel-hundido p-8 text-center ${className}`}
      >
        <div className="max-w-sm">
          <p className="text-grande font-semibold text-tinta">
            Tu navegador no puede dibujar el mapa
          </p>
          <p className="mt-2 text-menor text-tinta-50">
            El mapa necesita WebGL2 y este navegador no lo tiene disponible. Suele ser la
            aceleración por hardware, que está desactivada: actívala y vuelve a abrirlo, o
            míralo con otro navegador.
          </p>
          <p className="mt-2 text-menor text-tinta-50">
            La búsqueda, los filtros y las fichas funcionan igual: lo único que falta es el
            mapa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* El mapa y sus controles propios viven en un contenedor relativo:
          así la pastilla de ubicación y el aviso de lejos se colocan
          encima del mapa sin entrar en el flujo ni empujar la altura. */}
      <div className="relative min-h-0 flex-1">
        <div ref={contenedor} className="mapa-aparece h-full w-full" />

        {conUbicacion && (
          <>
            <BotonUbicacion
              estado={estadoUbicacion}
              precision={precisionUbicacion}
              alPulsar={usarMiUbicacion}
            />

            {lejosDeResultados && (
              <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-linea bg-papel-alto py-1.5 pl-3 pr-1.5 shadow-md">
                <p role="status" className="truncate text-menor text-tinta">
                  Estás lejos de los resultados
                </p>
                <button
                  type="button"
                  onClick={volverAResultados}
                  className="btn btn-fantasma shrink-0 px-2 py-1 text-menor"
                >
                  Ver resultados
                </button>
              </div>
            )}
          </>
        )}
      </div>

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

      {conUbicacion && errorUbicacion && (
        <p
          role="status"
          className="border-t border-linea bg-papel-alto px-4 py-2 text-micro text-tinta-70"
        >
          {errorUbicacion}
        </p>
      )}
    </div>
  );
}

// ========================================
// El botón "Mi ubicación"
// ========================================
/**
 * La pastilla que el usuario ve y pulsa.
 *
 * Se separa del control de Mapbox a propósito: Mapbox sabe pedir el permiso
 * y pintar el punto, pero su botón es un icono cuadrado con un tooltip en
 * inglés. Aquí el estado se lee de un vistazo —inactivo, buscando, activo o
 * con error— y la precisión se muestra en la segunda línea, porque saber que
 * la ubicación es "± 2 km" cambia por completo cuánto se puede confiar en
 * ella.
 */
function BotonUbicacion({
  estado,
  precision,
  alPulsar,
}: {
  estado: EstadoUbicacion;
  precision: number | null;
  alPulsar: () => void;
}) {
  const segunda =
    estado === 'activo'
      ? textoPrecision(precision)
      : estado === 'buscando'
        ? 'Buscando…'
        : estado === 'error'
          ? 'Revisa el permiso'
          : 'Ubicación actual';

  const etiqueta =
    estado === 'buscando'
      ? 'Buscando tu ubicación'
      : estado === 'activo'
        ? `Mi ubicación, ${textoPrecision(precision).toLowerCase()}. Pulsa para volver a centrar.`
        : estado === 'error'
          ? 'Volver a intentar usar mi ubicación'
          : 'Usar mi ubicación para centrar el mapa';

  return (
    <button
      type="button"
      onClick={alPulsar}
      disabled={estado === 'buscando'}
      aria-label={etiqueta}
      aria-busy={estado === 'buscando'}
      className="absolute bottom-[76px] right-3 z-10 flex max-w-[200px] items-center gap-2 rounded-full border border-linea bg-papel-alto py-2 pl-2 pr-3 text-left shadow-md transition-colors hover:bg-papel disabled:cursor-wait disabled:opacity-80"
    >
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          estado === 'activo' ? 'bg-senal text-sobre-marino' : 'bg-senal-suave text-senal'
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M10 2.5 15.5 17 10 14 4.5 17 10 2.5Z" strokeLinejoin="round" />
        </svg>
      </span>

      <span className="min-w-0">
        <span className="block text-menor font-semibold text-tinta">Mi ubicación</span>
        <span className="block truncate text-micro text-tinta-50">{segunda}</span>
      </span>
    </button>
  );
}

/** "± 35 m" o "± 1,2 km", que es lo que la precisión significa para el usuario. */
function textoPrecision(metros: number | null): string {
  if (metros === null) return 'Ubicación actual';
  if (metros < 1000) return `Precisión ±${Math.round(metros)} m`;
  return `Precisión ±${(metros / 1000).toFixed(1)} km`;
}

/**
 * Traduce el error del navegador a algo que se pueda accionar.
 *
 * El código 1 —permiso denegado— es el más importante: el navegador no
 * vuelve a preguntar por su cuenta, así que hay que decir dónde se cambia.
 * El 2 y el 3 suelen ser intentos que se pueden repetir.
 */
function mensajeDeUbicacion(error: GeolocationPositionError): string {
  switch (error.code) {
    case 1:
      return 'El permiso de ubicación está denegado. Actívalo en el candado de la dirección y vuelve a intentarlo.';
    case 2:
      return 'No pudimos obtener tu ubicación. Comprueba que la ubicación del dispositivo esté activa e inténtalo otra vez.';
    case 3:
      return 'La ubicación tardó demasiado. Inténtalo otra vez.';
    default:
      return 'No pudimos usar tu ubicación. Inténtalo otra vez.';
  }
}

// ========================================
// El navegador, ¿puede dibujar el mapa?
// ========================================
//
// La respuesta tiene dos mitades y un solo sitio donde vivir:
//
//   1. ¿Hay contexto WebGL2? Lo contesta `comprobarWebGL2()`, con un canvas de
//      usar y tirar.
//   2. Y si lo hay, ¿arranca Mapbox con él? Hay controladores que pasan esa
//      prueba y fallan al construir, así que la respuesta definitiva solo se
//      sabe intentándolo.
//
// Por eso el veredicto vive aquí, fuera de React: el componente lo LEE con
// `useSyncExternalStore` —en el servidor no hay canvas que probar, así que
// durante la hidratación se da por bueno y ya montado se contrasta con la
// realidad— y el `catch` de la construcción lo corrige. Un `useState` con un
// `setSinWebGL()` dentro del efecto también lo contaría, pero sería un render
// en cascada, que es justo lo que prohíbe `react-hooks/set-state-in-effect`.

/** El veredicto. `null` = todavía no se ha preguntado. */
let soporteMapa: boolean | null = null;

/** Quienes miran el veredicto: `useSyncExternalStore` necesita poder suscribirse. */
const oyentesMapa = new Set<() => void>();

/**
 * Lo que lee `useSyncExternalStore`, una vez por render.
 *
 * La primera vez pregunta; las demás devuelve lo guardado, y que sea un valor
 * estable importa: una instantánea distinta en cada lectura haría que React
 * volviera a renderizar en bucle.
 */
function leerSoporteMapa(): boolean {
  if (soporteMapa === null) soporteMapa = comprobarWebGL2();
  return soporteMapa;
}

/** La forma de suscripción que exige `useSyncExternalStore`. */
function suscribirSoporteMapa(oyente: () => void): () => void {
  oyentesMapa.add(oyente);
  return () => oyentesMapa.delete(oyente);
}

/**
 * Mapbox no pudo construir el mapa: la segunda mitad del veredicto.
 *
 * Da igual lo que hubiera contestado el sondeo del contexto —hay controladores
 * que lo pasan y luego no compilan los sombreadores—: aquí ya se sabe que no se
 * puede dibujar, así que se anota y se avisa a quien esté mirando.
 */
function anotarQueNoSePudo(): void {
  if (soporteMapa === false) return;
  soporteMapa = false;
  for (const oyente of oyentesMapa) oyente();
}

/**
 * ¿Puede este navegador crear un contexto WebGL2?
 *
 * Mapbox GL v3 exige WebGL2 —la v2 aceptaba WebGL1 y la v3 lo quitó—, así que
 * esta es exactamente la pregunta que decide si `new mapboxgl.Map(...)` va a
 * funcionar. De dónde venga el "no" da igual: aceleración por hardware apagada,
 * una GPU en la lista negra del navegador, una máquina virtual sin aceleración
 * 3D, un navegador viejo…
 *
 * 📌 No se usa `mapboxgl.supported()`, que es quien haría esta comprobación
 * dentro de Mapbox: existe en tiempo de ejecución, pero la v3 no lo declara en
 * sus tipos y llamarlo no compila. La comprobación propia dice además, de forma
 * explícita, QUÉ hace falta. Y no se copian los atributos que pide Mapbox al
 * contexto (alpha, stencil, depth…): si el navegador diera un contexto distinto
 * al que Mapbox necesita, el `try/catch` de la construcción lo recoge igual.
 *
 * El `try` no es de adorno: hay navegadores que, en vez de devolver `null`,
 * lanzan una excepción (modo privado, gráficos restringidos por política).
 */
function comprobarWebGL2(): boolean {
  try {
    const contexto = document.createElement('canvas').getContext('webgl2');
    if (!contexto) return false;

    // El contexto de prueba se suelta a mano. No es paranoia: cada contexto
    // WebGL es un recurso del sistema y los navegadores mantienen unos pocos
    // vivos a la vez. Este no pinta nada y no debe ocupar uno de esos huecos.
    contexto.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
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

  // Los grupos se anclan por el centro y las píldoras de precio por abajo:
  // el borde inferior de la píldora queda sobre el punto, sin una cola que
  // desplace el ancla. Un círculo —el grupo— se apoya en el centro.
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
    // 15 y no 14: una sola propiedad merece verse con su manzana, no como
    // un punto perdido en el distrito. El tope de 16 de la ubicación es más
    // alto porque ahí la precisión manda; aquí el interés es el entorno.
    instancia.easeTo({
      center: [puntos[0].longitud, puntos[0].latitud],
      zoom: 15,
      duration: 600,
    });
    return;
  }

  const limites = new mapboxgl.LngLatBounds();

  for (const p of puntos) {
    limites.extend([p.longitud, p.latitud]);
  }

  // `maxZoom: 15.5`: con dos puntos casi pegados, encuadrar "perfecto" daría
  // un zoom de calle que esconde todo lo demás. `padding: 40` —antes 60— deja
  // más mapa útil y evita que las píldoras del borde se corten; las píldoras
  // se anclan por abajo y no necesitan tanto margen como una chincheta.
  instancia.fitBounds(limites, { padding: 40, maxZoom: 15.5, duration: 600 });
}
