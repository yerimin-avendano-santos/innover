'use client';

// ========================================
// ❤️ GUARDADOS: los anuncios que alguien guardó
// ========================================
// El último que interesó, primero.
//
// 📌 ES UNA PÁGINA DE CLIENTE, AL CONTRARIO QUE LA FICHA.
//
// La ficha se sirve desde el servidor porque es lo que indexa Google y lo que
// se comparte por WhatsApp: ahí el HTML tiene que traer el contenido. Esta
// lista no se comparte ni se indexa, y cambia con la sesión, así que se pide
// junto al resto de la interfaz privada (`/perfil`, `/leads`), donde el patrón
// de "¿hay sesión?" ya está resuelto.
//
// 📌 Y POR ESO EL CORAZÓN NO SE PUEDE TOCAR DESDE AQUÍ (todavía).
//
// Las tarjetas llevan al anuncio; para quitar uno, se entra en él. Poner el
// interruptor en la tarjeta es lo siguiente que pide el cuerpo, y no se ha
// hecho porque quitar algo de la lista que estás mirando obliga a decidir qué
// pasa con el hueco —¿desaparece la tarjeta?, ¿se puede deshacer?—: es una
// decisión de diseño, no una línea de código, y merece su propio rato.

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contextos/Auth';
import { FichaPropiedad } from '@/components/FichaPropiedad';
import type { Favorito, Paginacion } from '@/lib/tipos';

/**
 * Tope de la lista de una sola página.
 *
 * Es el máximo que acepta la API (`porPagina` hasta 100). Con más, se avisa en
 * pantalla: preferimos decir "hay más" a esconder los guardados viejos sin
 * decirlo. Una lista de guardados es de las pocas cosas donde lo viejo sigue
 * importando — es literalmente para lo que existe.
 */
const POR_PAGINA = 100;

/**
 * Formato de fecha fijo, con zona horaria de Perú.
 *
 * ⛔ NO ES UN DETALLE. Esta página se pinta primero en el servidor y luego en
 * el navegador; si la fecha se formateara con el idioma o la zona del que la
 * pinta, los dos textos saldrían distintos y React avisaría de un fallo de
 * hidratación — que en producción se ve como la fecha cambiando sola al
 * cargar. Fijando idioma y zona, los dos lados dicen lo mismo.
 */
const FECHA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: 'numeric',
  month: 'long',
});

export default function Favoritos() {
  const { estaConectado, cargando: cargandoAuth } = useAuth();
  const router = useRouter();

  const [favoritos, setFavoritos] = useState<Favorito[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState('');

  // Sin sesión no hay lista que pedir: se manda a entrar y se vuelve aquí.
  useEffect(() => {
    if (!cargandoAuth && !estaConectado) {
      router.replace('/login?redirect=/favoritos');
    }
  }, [estaConectado, cargandoAuth, router]);

  useEffect(() => {
    if (!estaConectado) return;

    let vivo = true;

    api<{ datos: Favorito[]; paginacion: Paginacion }>(
      `/api/favoritos?porPagina=${POR_PAGINA}`
    )
      .then((respuesta) => {
        if (!vivo) return;
        setFavoritos(respuesta.datos);
        setHayMas(respuesta.paginacion.hayMas);
      })
      .catch(() => {
        if (vivo) setError('No pudimos cargar tus guardados. Inténtalo de nuevo.');
      });

    return () => {
      vivo = false;
    };
  }, [estaConectado]);

  // Filtrado en memoria entre los favoritos cargados
  const favoritosFiltrados = useMemo(() => {
    if (!favoritos) return [];
    return favoritos.filter((fav) => {
      const coincideTipo =
        filtroTipo === 'TODOS' ||
        fav.tipo === filtroTipo ||
        fav.tipo_inmueble === filtroTipo;
      const coincideTexto =
        !busqueda.trim() ||
        fav.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        (fav.distrito?.nombre && fav.distrito.nombre.toLowerCase().includes(busqueda.toLowerCase())) ||
        (fav.direccion && fav.direccion.toLowerCase().includes(busqueda.toLowerCase()));
      return coincideTipo && coincideTexto;
    });
  }, [favoritos, filtroTipo, busqueda]);

  if (!estaConectado) {
    // Mientras el contexto resuelve si hay sesión, y en el instante en que el
    // `useEffect` manda a entrar, esto es lo que se ve.
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-cuerpo text-tinta-50">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-titulo font-semibold text-tinta">Guardados</h1>
        <p className="mt-1 text-cuerpo text-tinta-50">
          Los anuncios que guardaste, el último primero.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-medio border border-alerta bg-alerta-suave px-4 py-3 text-cuerpo text-alerta"
        >
          {error}
        </p>
      )}

      {!error && favoritos === null && (
        <p className="text-cuerpo text-tinta-50">Cargando tus guardados…</p>
      )}

      {!error && favoritos !== null && favoritos.length === 0 && (
        <div className="ficha p-8 text-center">
          <p className="text-grande font-semibold text-tinta">
            Todavía no guardaste ningún anuncio
          </p>
          <p className="mx-auto mt-2 max-w-md text-cuerpo text-tinta-50">
            El corazón de una ficha lo guarda aquí, y así no hay que volver a
            buscarlo entre cientos de anuncios.
          </p>
          <Link href="/" className="btn btn-secundario mt-5 text-menor">
            Ir al buscador
          </Link>
        </div>
      )}

      {!error && favoritos !== null && favoritos.length > 0 && (
        <>
          {/* Controles de búsqueda y filtros de guardados */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="sin-barra flex gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setFiltroTipo('TODOS')}
                className={`rounded-medio px-3 py-1.5 text-menor font-medium transition ${
                  filtroTipo === 'TODOS'
                    ? 'bg-tinta text-white'
                    : 'bg-papel-alto text-tinta-70 hover:bg-papel-hundido'
                }`}
              >
                Todos ({favoritos.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('VENTA')}
                className={`rounded-medio px-3 py-1.5 text-menor font-medium transition ${
                  filtroTipo === 'VENTA'
                    ? 'bg-tinta text-white'
                    : 'bg-papel-alto text-tinta-70 hover:bg-papel-hundido'
                }`}
              >
                En Venta
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('ALQUILER')}
                className={`rounded-medio px-3 py-1.5 text-menor font-medium transition ${
                  filtroTipo === 'ALQUILER'
                    ? 'bg-tinta text-white'
                    : 'bg-papel-alto text-tinta-70 hover:bg-papel-hundido'
                }`}
              >
                En Alquiler
              </button>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="search"
                placeholder="Buscar entre guardados..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="campo py-1.5 text-menor text-tinta"
              />
            </div>
          </div>

          {favoritosFiltrados.length === 0 ? (
            <div className="rounded-grande border border-dashed border-linea-fuerte px-6 py-12 text-center">
              <p className="text-cuerpo font-medium text-tinta">
                No hay guardados que coincidan con tu búsqueda
              </p>
              <p className="mx-auto mt-1 max-w-xs text-menor text-tinta-50">
                Prueba borrando el texto de búsqueda o cambiando el filtro.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {favoritosFiltrados.map((favorito) => (
                <li key={favorito.id}>
                  <p className="mb-1 text-micro text-tinta-50">
                    Guardado el {FECHA.format(new Date(favorito.guardado_en))}
                  </p>
                  <FichaPropiedad
                    propiedad={favorito}
                    alSeleccionar={() => router.push(`/propiedad/${favorito.slug}`)}
                  />
                </li>
              ))}
            </ul>
          )}

          {hayMas && (
            <p className="mt-6 text-menor text-tinta-50">
              Tienes más de {POR_PAGINA} guardados. Esta lista enseña los{' '}
              {POR_PAGINA} más recientes.
            </p>
          )}
        </>
      )}
    </div>
  );
}
