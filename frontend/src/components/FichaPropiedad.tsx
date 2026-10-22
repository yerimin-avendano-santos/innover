'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  IconoArea,
  IconoHabitacion,
  IconoBano,
  IconoAuto,
} from '@/components/IconosPropiedad';
import { formatearPrecio, precioPorM2, tiempoRelativo, etiquetaTipo } from '@/lib/api';
import { resolverFotosPropiedad, resolverTour3D } from '@/lib/fotos';
import type { Propiedad } from '@/lib/tipos';

interface Props {
  propiedad: Propiedad;
  seleccionada?: boolean;
  resaltada?: boolean;
  alSeleccionar?: (id: number) => void;
  alResaltar?: (id: number | null) => void;
}

export function FichaPropiedad({
  propiedad,
  seleccionada,
  resaltada,
  alSeleccionar,
  alResaltar,
}: Props) {
  const porM2 = precioPorM2(propiedad.precio, propiedad.area_m2, propiedad.moneda);
  const verificado = propiedad.propietario?.identidad_verificada === true;
  const operacion = propiedad.tipo === 'VENTA' ? 'Venta' : 'Alquiler';
  const tour3D = resolverTour3D(propiedad);

  return (
    <article
      className={`ficha grid grid-cols-[135px_1fr] sm:grid-cols-[165px_1fr] overflow-hidden rounded-2xl bg-white border border-linea shadow-2xs transition-all duration-200 hover:shadow-md ${
        alSeleccionar ? 'cursor-pointer' : 'cursor-default'
      } ${
        seleccionada
          ? 'border-senal ring-2 ring-teal-500/30 shadow-md'
          : resaltada
            ? 'border-senal/80 ring-2 ring-teal-500/20 shadow-sm'
            : 'hover:border-linea-fuerte'
      }`}
      onClick={() => alSeleccionar?.(propiedad.id)}
      onMouseEnter={() => alResaltar?.(propiedad.id)}
      onMouseLeave={() => alResaltar?.(null)}
    >
      {/* --- Foto con carrusel --- */}
      <FotoCarrusel propiedad={propiedad} />

      <div className="flex min-w-0 flex-col justify-between p-3 sm:p-3.5">
        {/* Encabezado: Precio + Distintivos */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <p className="cifra whitespace-nowrap text-normal sm:text-grande font-bold text-tinta">
              {formatearPrecio(propiedad.precio, propiedad.moneda)}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {propiedad.destacado && (
                <span className="distintivo distintivo-destacado-solido">Destacado</span>
              )}
              {Boolean(tour3D) && (
                <span className="distintivo border border-teal-200 bg-teal-50 font-semibold text-senal" title="Cuenta con recorrido y modelo 3D">
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M8 1.5l5.5 3.2v6.6L8 14.5l-5.5-3.2V4.7zM8 1.5v13M2.5 4.7l5.5 3.3 5.5-3.3" />
                  </svg>
                  3D
                </span>
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

          {/* Título en 2 líneas para evitar recortes bruscos */}
          <h3 className="mt-1.5 text-menor font-semibold leading-snug text-tinta">
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

          {/* Metadatos secundarios */}
          <p className="mt-1 truncate text-micro leading-snug text-tinta-50">
            {etiquetaTipo(propiedad.tipo_inmueble)}
            {propiedad.distrito && ` · ${propiedad.distrito.nombre}`}
            {porM2 && ` · ${porM2}`}
          </p>
        </div>

        {/* Chips de características simplificados */}
        <div className="my-2.5 flex flex-wrap items-center gap-1.5">
          <Dato
            icono={<IconoArea />}
            texto={propiedad.area_m2 ? `${propiedad.area_m2} m²` : '—'}
          />
          <Dato
            icono={<IconoHabitacion />}
            texto={propiedad.habitaciones ? `${propiedad.habitaciones} hab.` : '—'}
          />
          <Dato
            icono={<IconoBano />}
            texto={propiedad.banos ? `${propiedad.banos} baños` : '—'}
          />
          {Boolean(propiedad.parkederos) && (
            <Dato
              icono={<IconoAuto />}
              texto={`${propiedad.parkederos} auto`}
            />
          )}
        </div>

        {/* Pie de tarjeta */}
        <footer className="flex items-center justify-between gap-1 border-t border-linea/60 pt-2 text-micro text-tinta-50">
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
 */
function FotoCarrusel({ propiedad }: { propiedad: Propiedad }) {
  const [indice, setIndice] = useState(0);
  const fotos = resolverFotosPropiedad(propiedad);
  const total = fotos.length;
  const tieneFotos = total > 0;
  const tieneVarias = total > 1;

  const anterior = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndice((actual) => (actual === 0 ? total - 1 : actual - 1));
  };

  const siguiente = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndice((actual) => (actual === total - 1 ? 0 : actual + 1));
  };

  return (
    <div className="group/foto relative h-full min-h-[140px] bg-papel-hundido">
      <Link
        href={`/propiedad/${propiedad.slug}`}
        prefetch={false}
        onClick={(evento) => evento.stopPropagation()}
        tabIndex={-1}
        aria-hidden="true"
        className="block h-full w-full"
      >
        {tieneFotos ? (
          <img
            src={fotos[indice]}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover/foto:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-tinta-30">
            <IconoFoto />
          </div>
        )}
      </Link>

      {/* Flechas de cambio de foto */}
      {tieneVarias && (
        <>
          <button
            type="button"
            onClick={anterior}
            aria-label="Foto anterior"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1 text-white opacity-0 backdrop-blur-xs transition hover:bg-black/80 group-hover/foto:opacity-100"
          >
            <IconoFlecha direccion="izquierda" />
          </button>
          <button
            type="button"
            onClick={siguiente}
            aria-label="Siguiente foto"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1 text-white opacity-0 backdrop-blur-xs transition hover:bg-black/80 group-hover/foto:opacity-100"
          >
            <IconoFlecha direccion="derecha" />
          </button>

          {/* Indicadores de bolitas */}
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {fotos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndice(i);
                }}
                className={`pointer-events-auto h-1.5 rounded-full transition-all ${
                  i === indice ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                }`}
                aria-label={`Ver foto ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Pastilla de dato simplificada y limpia */
function Dato({
  icono,
  texto,
}: {
  icono: ReactNode;
  texto: string | number;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-papel-hundido/70 px-2 py-0.5 text-micro text-tinta-70">
      <span className="h-3.5 w-3.5 shrink-0 opacity-70">
        {icono}
      </span>
      <span className="font-medium text-tinta">{texto}</span>
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
      strokeWidth="2"
    >
      <path d="m3.5 8.5 3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoFlecha({ direccion }: { direccion: 'izquierda' | 'derecha' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
