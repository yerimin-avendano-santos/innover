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

import { useEffect, useState } from 'react';
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

  // Sin sesión no hay lista que pedir: se manda a entrar y se vuelve aquí.
  useEffect(() => {
    if (!cargandoAuth && !estaConectado) {
      router.replace('/login?redirect=/favoritos');
    }
  }, [estaConectado, cargandoAuth, router]);

  useEffect(() => {
    if (!estaConectado) return;

    // `vivo` evita el clásico "setState en un componente que ya no está": si
    // alguien sale de la página mientras la petición viaja, al volver el
    // `setFavoritos` ya no tiene a quién pintar.
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
          <ul className="grid gap-4 lg:grid-cols-2">
            {favoritos.map((favorito) => (
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
