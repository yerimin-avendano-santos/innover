'use client';

// ========================================
// 🔎 EL BUSCADOR
// ========================================
// Esta es la pantalla que define el producto: mapa y lista, en paralelo.
//
// 📌 DECISIÓN DE DISEÑO: EL MAPA ES LA PÁGINA
//
// La primera versión metía todo en una columna centrado con el mapa
// debajo de un título. Eso es una landing page, no una herramienta de
// búsqueda. Alguien que busca dónde vivir no quiere leer un titular:
// quiere ver el mapa y empezar a filtrar.
//
// Así que el mapa ocupa la mitad de la pantalla desde el primer segundo,
// y la lista la otra mitad. El titular se reduce a una línea de contexto.
// Cero cards sueltas, cero gradientes decorativos.
//
// 📌 POR QUÉ ES UN COMPONENTE Y NO LA PÁGINA
//
// Antes esto vivía dentro de `app/page.tsx`. Al cerrar el buscador con un
// muro de sesión se movió aquí, y el motivo no es de organización sino de
// COSTES: Mapbox se cobra por carga de mapa. Si el buscador fuera el cuerpo
// de la página y la página decidiera "ahora enseño el muro en su lugar", el
// componente se montaría igual —React lo renderiza antes de decidir nada— y
// el mapa se habría cargado para alguien que solo venía a ver la invitación.
//
// Separarlo hace que el muro sea ESTRUCTURAL: sin sesión, `<Buscador />` no
// existe, así que no hay mapa que cobrar, ni petición de búsqueda que hacer,
// ni datos en el navegador. No es una capa de pintura encima.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Mapa } from '@/components/Mapa';
import { FichaPropiedad } from '@/components/FichaPropiedad';
import {
  BarraFiltros,
  FILTROS_VACIOS,
  construirDescripcion,
  tieneFiltrosActivos,
  type Filtros,
} from '@/components/BarraFiltros';
import { api, conQuery, ErrorPeticion } from '@/lib/api';
import type { Distrito, RespuestaMapa, RespuestaPropiedades } from '@/lib/tipos';

export function Buscador() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [datos, setDatos] = useState<RespuestaPropiedades | null>(null);

  /**
   * Los puntos del mapa: el resultado filtrado ENTERO, no la página de la lista.
   *
   * Va en su propio estado porque es otra petición y otra cosa: la lista
   * pagina (50) y el mapa no. Ver `obtenerPuntosDelMapa` en el backend.
   */
  const [puntos, setPuntos] = useState<RespuestaMapa | null>(null);

  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * La credencial venció mientras se buscaba.
   *
   * Es un estado aparte del `error` a propósito: no es un fallo de la
   * aplicación, es algo que el usuario arregla en dos clics, y merece un
   * mensaje distinto con la salida a mano.
   *
   * 📌 Desde que el buscador exige token (ver `propiedadRoutes.js`), una
   * sesión vencida dejó de ser un caso teórico. Antes la búsqueda era
   * pública: con la credencial muerta seguía devolviendo propiedades y nadie
   * se enteraba. Ahora devuelve 401, y si esto no se distinguiera del resto,
   * el usuario vería un error técnico sin saber que basta con volver a
   * entrar.
   */
  const [sesionCaducada, setSesionCaducada] = useState(false);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);

  /**
   * Permite cancelar la petición en vuelo.
   *
   * Va en un ref porque su valor no debe disparar renders: es un
   * "memoria" del controlador activo, no estado de la interfaz.
   */
  const cancelacion = useRef<AbortController | null>(null);

  /**
   * Los distritos se cargan UNA vez, al arrancar: son la taxonomía del
   * negocio y casi nunca cambian.
   *
   * 📌 El setState está DENTRO del `.then()`, no en el cuerpo del efecto.
   * Ponerlo en el cuerpo obliga a React a renderizar dos veces seguidas
   * (una por el efecto, otra por el setState). Dentro del callback solo
   * hay un render, y llega con los datos ya listos.
   */
  useEffect(() => {
    let vivo = true;

    api<{ datos: Distrito[] }>('/api/distritos')
      .then((r) => {
        if (vivo) setDistritos(r.datos);
      })
      .catch(() => {
        // Sin distritos el buscador sigue funcionando: el filtro se
        // queda vacío. No vale la pena bloquear la página por eso.
      });

    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Cada cambio de filtro dispara una búsqueda.
   *
   * Se cancela la petición en vuelo antes de lanzar la nueva. Sin esto,
   * si el usuario escribe rápido, llegan varias respuestas y la pantalla
   * puede mostrar el resultado de una búsqueda antigua.
   */
  const buscar = useCallback(async (filtrosActuales: Filtros) => {
    cancelacion.current?.abort();
    const controlador = new AbortController();
    cancelacion.current = controlador;

    setCargando(true);
    setError(null);
    setSesionCaducada(false);

    // 📌 LOS MISMOS FILTROS PARA LAS DOS PETICIONES.
    //
    // El mapa y la lista tienen que enseñar el mismo conjunto, así que los
    // parámetros se construyen una vez y se usan en las dos. En el backend
    // pasa lo mismo con el `where` (ver `construirWhere`): si cada pantalla
    // tuviera su copia, bastaría con olvidar un filtro para que la lista
    // dijera "38 resultados" y el mapa pintara otra cosa sin dar un solo error.
    const parametros = {
      tipo: filtrosActuales.tipo || undefined,
      tipo_inmueble: filtrosActuales.tipo_inmueble || undefined,
      distrito_id: filtrosActuales.distrito_id ?? undefined,
      habitaciones: filtrosActuales.habitaciones ?? undefined,
      precioMax: filtrosActuales.precioMax ?? undefined,
      busqueda: filtrosActuales.busqueda || undefined,
      orden: filtrosActuales.orden,
    };

    try {
      // En paralelo: son la misma pregunta por dos caminos, y encadenarlas
      // solo sumaría esperas.
      const [respuesta, delMapa] = await Promise.all([
        api<RespuestaPropiedades>(
          conQuery('/api/propiedades', { ...parametros, porPagina: 50 }),
          { signal: controlador.signal }
        ),
        api<RespuestaMapa>(conQuery('/api/propiedades/mapa', parametros), {
          signal: controlador.signal,
        }),
      ]);

      setDatos(respuesta);
      setPuntos(delMapa);
    } catch (e) {
      // Una búsqueda cancelada no es un error: la reemplazó otra.
      if ((e as Error).name === 'AbortError') return;

      setDatos(null);
      setPuntos(null);

      // El 401 se cuenta aparte y SIN mensaje de error: no hay nada que el
      // usuario pueda arreglar en esta pantalla, así que en vez de un aviso
      // técnico se le enseña la salida (volver a entrar).
      if (e instanceof ErrorPeticion && e.esSesion) {
        setSesionCaducada(true);
        return;
      }

      setError(
        e instanceof ErrorPeticion
          ? e.message
          : 'No pudimos cargar las propiedades. Inténtalo de nuevo.'
      );
    } finally {
      if (!controlador.signal.aborted) setCargando(false);
    }
  }, []);

  /**
   * Un SOLO efecto para la búsqueda, incluida la inicial.
   *
   * Antes había dos: uno para la carga inicial y otro "al cambiar los
   * filtros". Eso disparaba la misma petición dos veces al montar, y
   * además el setState dentro del efecto obligaba a un render extra.
   *
   * El retraso de 300 ms es de "debounce": el usuario escribe "amarilis"
   * en 8 pulsaciones y sin esto saldrían 8 peticiones al backend.
   * En la primera carga ese retraso no molesta (la página todavía está
   * montando), y a partir de ahí evita el spam.
   */
  useEffect(() => {
    const temporizador = setTimeout(() => {
      void buscar(filtros);
    }, 300);

    // Cada cambio limpia el temporizador anterior, así que solo sobrevive
    // el último. Y al desmontar, se cancela la petición en vuelo.
    return () => {
      clearTimeout(temporizador);
      cancelacion.current?.abort();
    };
  }, [filtros, buscar]);

  const propiedades = useMemo(() => datos?.datos ?? [], [datos]);

  /**
   * La firma de la búsqueda actual.
   *
   * Cambia cuando cambian los filtros, NO cuando el usuario mueve el mapa. El
   * mapa la usa para saber cuándo volver a encuadrar: una pregunta nueva merece
   * una vista nueva (buscar en Tingo María y quedarse mirando Huánuco parece
   * que "no hay nada"), pero arrastrar el mapa es una decisión del usuario y no
   * se pisa.
   */
  const claveVista = useMemo(() => JSON.stringify(filtros), [filtros]);

  return (
    /*
     * La altura descuenta la barra ENTERA, no solo la fila de 56 px.
     *
     * En móvil la barra mide 99 px: 56 de la fila principal, 41 de la
     * segunda fila de enlaces y 2 de la franja de marca. Con
     * `100vh - 3.5rem` el buscador medía ~38 px más que la ventana, así que
     * el fondo del mapa —y sus controles— caía por debajo del pliegue. En
     * escritorio la fila móvil desaparece y solo quedan 58 px. `dvh` y no
     * `vh` para que el navegador móvil no reserve la barra de direcciones
     * que ya no se ve.
     */
    <div className="flex h-[calc(100dvh-6.1875rem)] flex-col sm:h-[calc(100dvh-3.625rem)]">
      <BarraFiltros filtros={filtros} alCambiar={setFiltros} distritos={distritos} />

      {/* --- Error --- */}
      {error && (
        <div
          role="alert"
          className="border-b border-alerta bg-alerta-suave px-4 py-3 text-cuerpo text-alerta sm:px-6"
        >
          {error}
        </div>
      )}

      {/*
        El mapa domina la pantalla:
        En escritorio la lista se acomoda en un carril lateral de 390px
        y el mapa se expande para ocupar todo el espacio restante (~65%-72% del ancho).
      */}
      <div className="grid min-h-0 flex-1 grid-rows-[380px_minmax(0,1fr)] lg:grid-cols-[minmax(350px,390px)_1fr] lg:grid-rows-1">
        {/* ============ LISTA (izquierda en escritorio) ============ */}
        <section
          aria-label="Lista de propiedades"
          className="order-2 flex min-h-0 flex-col border-linea bg-papel lg:order-1 lg:border-r"
        >
          {/* La cabecera vive fuera del scroll: el contador de lo que
              hay y "Limpiar filtros" no desaparecen al bajar por la
              lista. En móvil queda debajo del mapa, que va primero. */}
          {/* Con la sesión vencida no se cuenta nada: el contador diría
              "no encontramos propiedades" y la lista diría "tu sesión
              caducó", dos mensajes que se contradicen. */}
          {!sesionCaducada && (
            <CabeceraLista
              filtros={filtros}
              distritos={distritos}
              total={datos?.paginacion.total ?? 0}
              cargando={cargando}
              alLimpiar={() => setFiltros({ ...FILTROS_VACIOS })}
            />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {sesionCaducada ? (
              <SesionVencida />
            ) : propiedades.length > 0 ? (
              <ul className="space-y-3 p-3 sm:p-4">
                {propiedades.map((propiedad) => (
                  <li key={propiedad.id}>
                    <FichaPropiedad
                      propiedad={propiedad}
                      seleccionada={seleccionada === propiedad.id}
                      alSeleccionar={(id) =>
                        setSeleccionada((actual) => (actual === id ? null : id))
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : !cargando ? (
              <EstadoVacio
                hayFiltros={tieneFiltrosActivos(filtros)}
                alLimpiar={() => setFiltros({ ...FILTROS_VACIOS })}
              />
            ) : (
              <div className="space-y-3 p-3 sm:p-4">
                {/* Esqueletos de carga con la forma de la tarjeta nueva:
                    foto a la izquierda y líneas a la derecha. Así la
                    página no salta cuando llegan los datos. */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex animate-pulse overflow-hidden rounded-grande border border-linea bg-papel-alto"
                  >
                    <div className="h-40 w-[44%] shrink-0 bg-papel-hundido" />
                    <div className="flex-1 space-y-2 p-3.5">
                      <div className="h-3 w-1/3 rounded-chico bg-papel-hundido" />
                      <div className="h-4 w-full rounded-chico bg-papel-hundido" />
                      <div className="h-4 w-2/3 rounded-chico bg-papel-hundido" />
                      <div className="h-5 w-1/2 rounded-chico bg-papel-hundido" />
                      <div className="h-6 w-full rounded-chico bg-papel-hundido" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ============ MAPA (derecha en escritorio) ============ */}
        <section
          aria-label="Mapa de propiedades"
          className="order-1 min-h-[360px] border-linea lg:order-2 lg:min-h-0"
        >
          {/*
            En escritorio el mapa llena la altura disponible. `h-full`
            solo funciona si todos los ancestros del flex tienen
            `min-h-0`; sin eso el mapa empuja la página y aparecen
            barras de desplazamiento fantasma.

            `conUbicacion` solo en el buscador: la ficha y la vista previa
            de /publicar no necesitan "dónde estoy", y el control de
            Mapbox cuesta una petición de permiso que ahí no viene a
            cuento.
          */}
          <Mapa
            puntos={puntos?.datos ?? []}
            total={puntos?.total ?? 0}
            sinCoordenadas={puntos?.sin_coordenadas ?? 0}
            recortado={puntos?.recortado ?? false}
            seleccionada={seleccionada}
            alSeleccionar={(id) => setSeleccionada(id)}
            claveVista={claveVista}
            conUbicacion
            propiedades={propiedades}
            className="h-full w-full"
          />
        </section>
      </div>
    </div>
  );
}

/**
 * La cabecera de la lista: cuántas propiedades hay y cómo limpiar.
 *
 * 📌 VIVE AQUÍ Y NO EN `BarraFiltros` PORQUE CUENTA LA LISTA, NO EL
 * FILTRO. Antes estaba en una segunda franja de la barra, y eso tenía dos
 * problemas: le robaba altura al mapa y el contador quedaba lejos de las
 * tarjetas que cuenta. Aquí está pegado a ellas y no se va al hacer
 * scroll, porque el scroll es del div de abajo.
 *
 * `aria-live="polite"` es deliberado: al cambiar un filtro, quien usa un
 * lector de pantalla necesita saber que el número cambió sin que se le
 * robe el foco.
 */
function CabeceraLista({
  filtros,
  distritos,
  total,
  cargando,
  alLimpiar,
}: {
  filtros: Filtros;
  distritos: Distrito[];
  total: number;
  cargando: boolean;
  alLimpiar: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-linea/60 bg-papel px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-papel-alto px-2.5 py-0.5 text-micro font-semibold text-tinta shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-senal" aria-hidden="true" />
          <span className="cifra">{cargando ? '…' : total}</span>
        </span>
        <p aria-live="polite" className="truncate text-menor font-medium text-tinta-70">
          {cargando ? 'Buscando inmuebles…' : construirDescripcion(filtros, distritos, total)}
        </p>
      </div>

      {/*
        Con cero resultados no se pinta aquí: el estado vacío tiene su
        propio "Limpiar filtros" y dos botones iguales en la misma
        pantalla se estorban. Mientras carga tampoco: el número aún no
        es el definitivo.
      */}
      {!cargando && total > 0 && tieneFiltrosActivos(filtros) && (
        <button
          type="button"
          onClick={alLimpiar}
          className="btn btn-fantasma inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-micro font-medium"
        >
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" strokeLinecap="round" />
          </svg>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

/**
 * Pantalla sin resultados.
 *
 * No es un "no hay datos" seco: es una invitación a cambiar el filtro.
 * Decirle al usuario qué hacer a continuación es la diferencia entre una
 * pantalla muerta y una que guía.
 */
function EstadoVacio({
  hayFiltros,
  alLimpiar,
}: {
  hayFiltros: boolean;
  alLimpiar: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
      <svg
        viewBox="0 0 48 48"
        className="mb-4 h-12 w-12 text-linea-fuerte"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="21" cy="21" r="14" />
        <path d="M31 31l11 11" strokeLinecap="round" />
      </svg>

      <h2 className="text-grande font-semibold text-tinta">
        {hayFiltros ? 'Nada coincide con esos filtros' : 'Aún no hay propiedades'}
      </h2>

      <p className="mt-2 max-w-xs text-cuerpo text-tinta-50">
        {hayFiltros
          ? 'Prueba subiendo el tope de precio o quitando algún filtro.'
          : 'Sé la primera persona en publicar una propiedad en Innover.'}
      </p>

      <div className="mt-5 flex gap-2">
        {hayFiltros && (
          <button type="button" onClick={alLimpiar} className="btn btn-secundario">
            Limpiar filtros
          </button>
        )}
        <a href="/publicar" className="btn btn-principal">
          Publicar propiedad
        </a>
      </div>
    </div>
  );
}

/**
 * La sesión venció mientras se buscaba.
 *
 * Sustituye a la lista en vez de convivir con ella. Si esto fuera solo un
 * aviso arriba, debajo seguiría leyéndose "Aún no hay propiedades" — que es
 * cierto y a la vez mentira: sí las hay, lo que no hay es permiso para
 * verlas. Dos mensajes que se contradicen es peor que uno incómodo.
 *
 * 📌 El enlace lleva `?redirect=/` para que, después de entrar, la persona
 * vuelva aquí y no al panel de su cuenta. `login/page.tsx` ya sabe leer ese
 * parámetro, así que no hace falta nada más.
 */
function SesionVencida() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
      <svg
        viewBox="0 0 48 48"
        className="mb-4 h-12 w-12 text-aviso"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="24" cy="24" r="18" />
        <path d="M24 14v12" strokeLinecap="round" />
        <path d="M24 32.5v.5" strokeLinecap="round" />
      </svg>

      <h2 className="text-grande font-semibold text-tinta">Tu sesión caducó</h2>

      <p className="mt-2 max-w-xs text-cuerpo text-tinta-50">
        Por seguridad, la sesión de Innover tiene fecha de caducidad. Vuelve a
        entrar para seguir buscando.
      </p>

      <Link href="/login?redirect=/" className="btn btn-principal mt-5">
        Volver a entrar
      </Link>
    </div>
  );
}
