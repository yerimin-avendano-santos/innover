'use client';

// ========================================
// 🏠 PÁGINA PRINCIPAL · BUSCADOR
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
// y la lista la otra mitad. El titular se reduce a una línea de
// contexto. Cero cards sueltas, cero gradientes decorativos.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mapa } from '@/components/Mapa';
import { FichaPropiedad } from '@/components/FichaPropiedad';
import { BarraFiltros, FILTROS_VACIOS, type Filtros } from '@/components/BarraFiltros';
import { api, conQuery, ErrorPeticion } from '@/lib/api';
import type { Distrito, RespuestaPropiedades } from '@/lib/tipos';

export default function PaginaBuscador() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [datos, setDatos] = useState<RespuestaPropiedades | null>(null);
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

    const consulta = conQuery('/api/propiedades', {
      tipo: filtrosActuales.tipo || undefined,
      tipo_inmueble: filtrosActuales.tipo_inmueble || undefined,
      distrito_id: filtrosActuales.distrito_id ?? undefined,
      habitaciones: filtrosActuales.habitaciones ?? undefined,
      precioMax: filtrosActuales.precioMax ?? undefined,
      busqueda: filtrosActuales.busqueda || undefined,
      orden: filtrosActuales.orden,
      porPagina: 50,
    });

    try {
      const respuesta = await api<RespuestaPropiedades>(consulta, {
        signal: controlador.signal,
      });
      setDatos(respuesta);
    } catch (e) {
      // Una búsqueda cancelada no es un error: la reemplazó otra.
      if ((e as Error).name === 'AbortError') return;

      setError(
        e instanceof ErrorPeticion
          ? e.message
          : 'No pudimos cargar las propiedades. Inténtalo de nuevo.'
      );
      setDatos(null);
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <BarraFiltros
        filtros={filtros}
        alCambiar={setFiltros}
        distritos={distritos}
        total={datos?.paginacion.total ?? 0}
        cargando={cargando}
      />

      {/* --- Error --- */}
      {error && (
        <div
          role="alert"
          className="border-b border-alerta bg-alerta-suave px-4 py-3 text-cuerpo text-alerta sm:px-6"
        >
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,1fr)_1.15fr]">
        {/* ============ LISTA (izquierda en escritorio) ============ */}
        <section
          aria-label="Lista de propiedades"
          className="order-2 min-h-0 overflow-y-auto border-linea lg:order-1 lg:border-r"
        >
          {propiedades.length > 0 ? (
            <ul className="divide-y divide-linea">
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
              hayFiltros={JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS)}
              alLimpiar={() => setFiltros(FILTROS_VACIOS)}
            />
          ) : (
            <div className="p-6">
              {/* Esqueletos de carga. Miden lo mismo que una ficha real
                  para que la página no salte al llegar los datos. */}
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="mb-4 animate-pulse">
                  <div className="mb-2 h-5 w-3/4 rounded-chico bg-papel-hundido" />
                  <div className="mb-3 h-4 w-1/3 rounded-chico bg-papel-hundido" />
                  <div className="h-3 w-full rounded-chico bg-papel-hundido" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ============ MAPA (derecha en escritorio) ============ */}
        <section
          aria-label="Mapa de propiedades"
          className="order-1 min-h-[320px] border-linea lg:order-2 lg:min-h-0"
        >
          {/*
            En escritorio el mapa llena la altura disponible. `h-full`
            solo funciona si todos los ancestros del flex tienen
            `min-h-0`; sin eso el mapa empuja la página y aparecen
            barras de desplazamiento fantasma.
          */}
          <Mapa
            propiedades={propiedades}
            seleccionada={seleccionada}
            alSeleccionar={(id) => setSeleccionada(id)}
            className="h-full w-full"
          />
        </section>
      </div>
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
          : 'Sé la primera persona en publicar una propiedad en INNOVER.'}
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
