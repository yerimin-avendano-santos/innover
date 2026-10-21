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
import {
  IconoArea,
  IconoHabitacion,
  IconoBano,
  IconoAuto,
} from '@/components/IconosPropiedad';
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
      className={`ficha grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] overflow-hidden rounded-grande shadow-xs transition-all duration-200 hover:shadow-md ${
        alSeleccionar ? 'cursor-pointer' : 'cursor-default'
      } ${seleccionada ? 'border-senal ring-2 ring-senal/20' : ''}`}
      onClick={() => alSeleccionar?.(propiedad.id)}
    >
      {/* --- Foto --- */}
      <FotoCarrusel propiedad={propiedad} />

      <div className="flex min-w-0 flex-col justify-between p-3">
        {/* Encabezado: Precio + Distintivos */}
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <p className="cifra whitespace-nowrap text-normal sm:text-grande font-bold text-tinta">
              {formatearPrecio(propiedad.precio, propiedad.moneda)}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {propiedad.destacado && (
                <span className="distintivo distintivo-destacado-solido">Destacado</span>
              )}
              <span
                className={`distintivo ${
                  propiedad.tipo === 'ALQUILER' ? 'distintivo-senal' : 'distintivo-neutro'
                }`}
              >
                {operacion}
              </span>
            </div>
          </div>

          {/* Título compacto */}
          <h3 className="mt-1 text-menor font-semibold leading-tight text-tinta">
            <Link
              href={`/propiedad/${propiedad.slug}`}
              prefetch={false}
              onClick={(evento) => evento.stopPropagation()}
              title={propiedad.titulo}
              className="line-clamp-1 transition-colors hover:text-senal"
            >
              {propiedad.titulo}
            </Link>
          </h3>

          {/* Metadatos */}
          <p className="mt-0.5 truncate text-micro leading-snug text-tinta-50">
            {etiquetaTipo(propiedad.tipo_inmueble)}
            {propiedad.distrito && ` · ${propiedad.distrito.nombre}`}
            {porM2 && ` · ${porM2}`}
          </p>
        </div>

        {/* Chips en micro-formato */}
        <div className="my-2 flex flex-wrap items-center gap-1">
          <Dato
            icono={<IconoArea />}
            texto={propiedad.area_m2 ? `${propiedad.area_m2} m²` : '—'}
            variante="senal"
          />
          <Dato
            icono={<IconoHabitacion />}
            texto={propiedad.habitaciones ? `${propiedad.habitaciones} Hab.` : '—'}
            variante="neutro"
          />
          <Dato
            icono={<IconoBano />}
            texto={propiedad.banos ? `${propiedad.banos} Baños` : '—'}
            variante="neutro"
          />
          {Boolean(propiedad.parkederos) && (
            <Dato
              icono={<IconoAuto />}
              texto={`${propiedad.parkederos} Auto`}
              variante="neutro"
            />
          )}
        </div>

        {/* Pie compacto */}
        <footer className="flex items-center justify-between gap-1 border-t border-linea/60 pt-1.5 text-micro text-tinta-50">
          <span className="truncate">{tiempoRelativo(propiedad.fecha_creacion)}</span>

          {verificado && (
            <span className="distintivo distintivo-menta shrink-0">
              <IconoVerificado />
              Verificado
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
        className="flex h-full min-h-[130px] items-center justify-center bg-papel-hundido"
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
    <div className="relative h-full min-h-[130px] overflow-hidden bg-papel-hundido">
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

/** Una pastilla de dato con micro-badge de icono. */
function Dato({
  icono,
  texto,
  variante = 'neutro',
}: {
  icono: ReactNode;
  texto: string | number;
  variante?: 'senal' | 'menta' | 'neutro';
}) {
  const fondoIcono =
    variante === 'senal'
      ? 'bg-senal-suave text-senal-hondo'
      : variante === 'menta'
        ? 'bg-menta-suave text-menta-hondo'
        : 'bg-papel-hundido text-tinta-70';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-papel-alto py-0.5 pl-1 pr-2 text-micro text-tinta-70 shadow-2xs">
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${fondoIcono}`}>
        {icono}
      </span>
      <span className="cifra font-semibold text-tinta">{texto}</span>
    </span>
  );
}

// ========================================
// Iconos
// ========================================

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
