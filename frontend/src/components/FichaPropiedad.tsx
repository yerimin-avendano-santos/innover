'use client';

/* eslint-disable @next/next/no-img-element -- el motivo está en components/Galeria.tsx */

// ========================================
// 📋 FICHA DE PROPIEDAD
// ========================================
// La tarjeta de una propiedad.
//
// 📌 AHORA ES HORIZONTAL, COMO UN ANUNCIO, NO COMO UNA FICHA TÉCNICA
//
// La versión anterior ponía la foto de 64 px a la izquierda y el resto en
// filas con divisores. Se leía como una tabla: correcta para comparar, pero
// no se parecía a la cosa que se está comprando. La tarjeta nueva da a la
// foto el 44 % del ancho (con tope de 260 px en pantallas anchas), pone el
// precio en tinta y deja los datos en chips. La foto deja de ser un icono y
// pasa a ser la razón por la que alguien abre la ficha.
//
// 📌 DOS ENLACES, NO UN `role="button"` EN TODA LA TARJETA
//
// Antes la tarjeta entera era un botón (`role="button"`) que seleccionaba en
// el mapa. Eso hacía que el título no fuera un enlace: no se podía abrir la
// propiedad con el teclado, ni copiar su dirección, ni abrirla en otra
// pestaña. Ahora el título y la foto llevan a `/propiedad/[slug]`, y el clic
// en la superficie (precio, chips, meta) sigue seleccionando en el mapa.
// Los enlaces y los controles del carrusel hacen `stopPropagation` para no
// hacer las dos cosas a la vez.
//
// 📌 EL CORAZÓN NO ESTÁ AQUÍ TODAVÍA
//
// `es_favorito` solo viaja en la ficha, no en los listados, así que desde la
// tarjeta no se puede saber si el anuncio está guardado sin una petición por
// tarjeta. Se resolverá cuando ese campo viaje en la lista; poner un corazón
// que devuelve 401 al primer clic sería peor que no ponerlo.

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { formatearPrecio, precioPorM2, tiempoRelativo, etiquetaTipo } from '@/lib/api';
import type { Propiedad } from '@/lib/tipos';

interface Props {
  propiedad: Propiedad;
  seleccionada?: boolean;
  alSeleccionar?: (id: number) => void;
}

export function FichaPropiedad({ propiedad, seleccionada, alSeleccionar }: Props) {
  const porM2 = precioPorM2(propiedad.precio, propiedad.area_m2, propiedad.moneda);
  const verificado = propiedad.propietario?.identidad_verificada === true;
  const operacion = propiedad.tipo === 'VENTA' ? 'Venta' : 'Alquiler';

  return (
    <article
      className={`ficha grid grid-cols-[minmax(140px,42%)_1fr] overflow-hidden rounded-grande shadow-xs transition-all duration-200 hover:shadow-md xl:grid-cols-[210px_1fr] ${
        alSeleccionar ? 'cursor-pointer' : 'cursor-default'
      } ${seleccionada ? 'border-senal ring-2 ring-senal/20' : ''}`}
      onClick={() => alSeleccionar?.(propiedad.id)}
    >
      {/* --- Foto ---
          El 42 % del ancho mantiene el equilibrio y permite a las tarjetas
          compactas respirar en la columna lateral del buscador. */}
      <FotoCarrusel propiedad={propiedad} />

      <div className="flex min-w-0 flex-col p-3.5">
        {/* --- Distintivos --- */}
        <div className="mb-1.5 flex items-center gap-2">
          {propiedad.destacado && (
            <span className="distintivo distintivo-destacado-solido">Destacado</span>
          )}
          <span
            className={`distintivo ml-auto ${
              propiedad.tipo === 'ALQUILER' ? 'distintivo-senal' : 'distintivo-neutro'
            }`}
          >
            {operacion}
          </span>
        </div>

        {/* --- Título ---
            Dos líneas como máximo y una altura mínima de dos: así el
            precio queda a la misma altura en todas las tarjetas aunque un
            título sea corto. La altura es en `em` para que siga a la
            escala tipográfica. */}
        <h3 className="min-h-[2.75em] text-normal font-semibold leading-snug text-tinta">
          <Link
            href={`/propiedad/${propiedad.slug}`}
            prefetch={false}
            onClick={(evento) => evento.stopPropagation()}
            title={propiedad.titulo}
            className="line-clamp-2 transition-colors hover:text-senal"
          >
            {propiedad.titulo}
          </Link>
        </h3>

        {/* --- Precio ---
            En tinta, no en turquesa: el precio es el dato que se compara,
            y el color de acción se reserva para lo que se pulsa. */}
        <p className="cifra mt-1 text-grande font-semibold text-tinta">
          {formatearPrecio(propiedad.precio, propiedad.moneda)}
        </p>

        {/* --- Metadatos ---
            Tipo y distrito, más el precio por m², que es la cifra con la
            que se decide entre dos anuncios del mismo precio. Sin
            `truncate`: en 1024 puede ocupar dos líneas; esconder el
            precio/m² sería esconder justo la comparación. */}
        <p className="mt-0.5 text-menor leading-snug text-tinta-50">
          {etiquetaTipo(propiedad.tipo_inmueble)}
          {propiedad.distrito && ` · ${propiedad.distrito.nombre}`}
          {porM2 && ` · ${porM2}`}
        </p>

        {/* --- Chips ---
            Datos en pastillas, no en una tabla con divisores. El icono
            ayuda a reconocer la columna de un vistazo y la etiqueta
            ("Hab.", "Baños") evita que un 3 se lea como un precio. */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Dato
            icono={<IconoArea />}
            texto={propiedad.area_m2 ? `${propiedad.area_m2} m²` : '—'}
          />
          <Dato
            icono={<IconoHabitacion />}
            texto={propiedad.habitaciones ? `${propiedad.habitaciones} Hab.` : '—'}
          />
          <Dato
            icono={<IconoBano />}
            texto={propiedad.banos ? `${propiedad.banos} Baños` : '—'}
          />
          <Dato
            icono={<IconoAuto />}
            texto={propiedad.parkederos ? `${propiedad.parkederos} Auto` : '—'}
          />
        </div>

        {/* --- Pie ---
            El tiempo ya no va en `tinta-30`: ese tono no pasa AA. El
            sello de identidad verificada es la promesa central del
            producto, por eso tiene color propio y no un texto suelto. */}
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2.5">
          <p className="text-micro text-tinta-50">{tiempoRelativo(propiedad.fecha_creacion)}</p>

          {verificado && (
            <span className="distintivo distintivo-menta">
              <IconoVerificado />
              Propietario verificado
            </span>
          )}
        </footer>
      </div>
    </article>
  );
}

/**
 * La foto con carrusel, o su hueco.
 *
 * 📌 EL CARRUSEL SOLO APARECE CON DOS O MÁS FOTOS. Con una, unas flechas
 * que no llevan a ninguna parte son una promesa falsa. Los controles son
 * botones de verdad —se pueden tocar con el teclado— y las bolitas
 * también: una bolita que no cambia la foto es un adorno que engaña.
 *
 * El enlace de la foto y el del título son dos entradas al mismo sitio, y
 * eso se acepta a propósito: en un listado la foto es el blanco natural
 * del clic y el título es el que entiende un lector de pantalla.
 */
function FotoCarrusel({ propiedad }: { propiedad: Propiedad }) {
  const imagenes = propiedad.imagenes ?? [];
  const [indice, setIndice] = useState(0);

  if (imagenes.length === 0) {
    return (
      <div
        aria-hidden="true"
        className="flex min-h-[150px] items-center justify-center bg-papel-hundido"
      >
        <IconoFoto />
      </div>
    );
  }

  const actual = imagenes[indice] ?? imagenes[0];

  const irA = (destino: number) => {
    setIndice((destino + imagenes.length) % imagenes.length);
  };

  return (
    <div className="relative min-h-[150px] overflow-hidden bg-papel-hundido">
      <Link
        href={`/propiedad/${propiedad.slug}`}
        prefetch={false}
        onClick={(evento) => evento.stopPropagation()}
        aria-label={`Ver ${propiedad.titulo}`}
        className="block h-full w-full"
      >
        <img
          src={actual}
          alt=""
          width={520}
          height={400}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
        />
      </Link>

      {imagenes.length > 1 && (
        <>
          <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-marino/75 px-2 py-0.5 text-micro font-medium text-sobre-marino backdrop-blur-xs">
            {indice + 1}/{imagenes.length}
          </span>

          <button
            type="button"
            aria-label="Foto anterior"
            onClick={(evento) => {
              evento.stopPropagation();
              irA(indice - 1);
            }}
            className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-papel-alto/90 text-tinta shadow-sm transition-colors hover:bg-papel-alto"
          >
            <IconoFlecha direccion="izquierda" />
          </button>

          <button
            type="button"
            aria-label="Foto siguiente"
            onClick={(evento) => {
              evento.stopPropagation();
              irA(indice + 1);
            }}
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-papel-alto/90 text-tinta shadow-sm transition-colors hover:bg-papel-alto"
          >
            <IconoFlecha direccion="derecha" />
          </button>

          <div className="absolute bottom-1.5 left-1/2 z-10 flex -translate-x-1/2 gap-0.5">
            {imagenes.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ver foto ${i + 1} de ${imagenes.length}`}
                aria-current={i === indice ? 'true' : undefined}
                onClick={(evento) => {
                  evento.stopPropagation();
                  irA(i);
                }}
                className="flex h-4 w-4 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ring-1 ring-tinta/20 ${
                    i === indice ? 'bg-papel-alto' : 'bg-papel-alto/50'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Una pastilla de dato con icono. */
function Dato({ icono, texto }: { icono: ReactNode; texto: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-chico bg-papel px-1.5 py-1 text-micro text-tinta-70">
      {icono}
      <span className="cifra font-medium text-tinta">{texto}</span>
    </span>
  );
}

// ========================================
// Iconos
// ========================================
//
// Son SVG en línea y `currentColor` a propósito: el color lo decide la
// clase del contenedor, no un atributo. Así el mismo icono sirve en la
// tarjeta clara y en cualquier superficie futura sin duplicarlo.
const CLASE_ICONO = 'h-3 w-3 shrink-0 text-tinta-50';

function IconoArea() {
  return (
    <svg
      viewBox="0 0 16 16"
      className={CLASE_ICONO}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M9 2h5v5M14 2 8 8M7 14H2V9M2 14l6-6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoHabitacion() {
  return (
    <svg
      viewBox="0 0 16 16"
      className={CLASE_ICONO}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 12V7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V12" />
      <path d="M2 10h12M4 6V4.5A1.5 1.5 0 0 1 5.5 3h5A1.5 1.5 0 0 1 12 4.5V6" />
    </svg>
  );
}

function IconoBano() {
  return (
    <svg
      viewBox="0 0 16 16"
      className={CLASE_ICONO}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 8h12v1a3.5 3.5 0 0 1-3.5 3.5h-5A3.5 3.5 0 0 1 2 9V8Z" />
      <path d="M4 8V4a2 2 0 0 1 4 0M5 12.5v1M11 12.5v1" strokeLinecap="round" />
    </svg>
  );
}

function IconoAuto() {
  return (
    <svg
      viewBox="0 0 16 16"
      className={CLASE_ICONO}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 11h12M3.5 11V8L5 5h6l1.5 3v3" strokeLinejoin="round" />
      <circle cx="5" cy="11" r="1.5" />
      <circle cx="11" cy="11" r="1.5" />
    </svg>
  );
}

function IconoVerificado() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m3.5 8.5 3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoFlecha({ direccion }: { direccion: 'izquierda' | 'derecha' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d={direccion === 'izquierda' ? 'm10 3-5 5 5 5' : 'm6 3 5 5-5 5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoFoto() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-9 w-9 text-linea-fuerte"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m4 18 5-5 4 4 3-3 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
