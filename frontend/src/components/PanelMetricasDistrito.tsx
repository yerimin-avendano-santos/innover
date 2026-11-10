'use client';

// ========================================
// 📊 PANEL DE MÉTRICAS INMOBILIARIAS POR DISTRITO
// ========================================
// Muestra el cuadro analítico de precios por m² y volumen disponible
// cuando el usuario selecciona un distrito en el mapa o en los filtros.
//
// 📌 PRECIOS POR M² EN HUÁNUCO:
//
// En Huánuco el m² oscila entre S/ 1,800 y S/ 3,500. Si un distrito
// seleccionado aún no cuenta con propiedades suficientes en el catálogo,
// el panel lo detecta y muestra con honestidad los valores referenciales
// oficiales de la región, en vez de mostrar ceros que desorienten.

import { useMemo } from 'react';
import type { Distrito, Propiedad } from '@/lib/tipos';
import { VALORES_MERCADO_REFERENCIAL } from '@/lib/distritos-geo';

interface Props {
  distrito: Distrito;
  propiedades: Propiedad[];
  alCerrar: () => void;
  className?: string;
}

/** Tasa de cambio referencial para normalizar comparativas en soles */
const TIPO_CAMBIO_PEN = 3.75;

export function PanelMetricasDistrito({
  distrito,
  propiedades,
  alCerrar,
  className = '',
}: Props) {
  // Calculamos las métricas en tiempo real con las propiedades del distrito
  const metricas = useMemo(() => {
    const enDistrito = propiedades.filter(
      (p) =>
        p.distrito_id === distrito.id ||
        p.distrito?.id === distrito.id ||
        p.distrito?.nombre?.toLowerCase() === distrito.nombre.toLowerCase()
    );

    const conArea = enDistrito.filter(
      (p) => p.area_m2 && p.area_m2 > 0 && p.precio > 0
    );

    if (conArea.length === 0) {
      return {
        esReferencial: true,
        promedioM2: VALORES_MERCADO_REFERENCIAL.promedioM2,
        minM2: VALORES_MERCADO_REFERENCIAL.minM2,
        maxM2: VALORES_MERCADO_REFERENCIAL.maxM2,
        volumen: enDistrito.length,
      };
    }

    const preciosM2 = conArea.map((p) => {
      const precioSoles = p.moneda === 'USD' ? p.precio * TIPO_CAMBIO_PEN : p.precio;
      return precioSoles / (p.area_m2 as number);
    });

    const suma = preciosM2.reduce((acc, val) => acc + val, 0);
    const promedio = Math.round(suma / preciosM2.length);
    const min = Math.round(Math.min(...preciosM2));
    const max = Math.round(Math.max(...preciosM2));

    return {
      esReferencial: false,
      promedioM2: promedio,
      minM2: min,
      maxM2: max,
      volumen: enDistrito.length,
    };
  }, [distrito, propiedades]);

  return (
    <div
      role="region"
      aria-label={`Métricas inmobiliarias de ${distrito.nombre}`}
      className={`rounded-2xl border border-linea/80 bg-papel-alto/95 p-3.5 shadow-xl backdrop-blur-md transition-all sm:p-4 ${className}`}
    >
      {/* Cabecera del panel */}
      <div className="flex items-start justify-between gap-3 border-b border-linea/60 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full bg-senal"
              aria-hidden="true"
            />
            <span className="text-micro font-bold uppercase tracking-wider text-tinta-50">
              Métricas de Zona · {distrito.provincia}
            </span>
          </div>
          <h3 className="truncate text-cuerpo font-bold text-tinta">
            {distrito.nombre}
          </h3>
        </div>

        <button
          type="button"
          onClick={alCerrar}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-papel-hundido text-tinta-70 transition hover:bg-linea-fuerte hover:text-tinta"
          title="Deseleccionar distrito y ver toda la región"
          aria-label="Cerrar panel de métricas de distrito"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Rejilla de métricas */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
        {/* Precio Promedio por m² */}
        <div className="rounded-xl border border-linea/60 bg-senal-suave/40 p-2.5">
          <span className="block text-micro font-medium text-tinta-70">
            Promedio / m²
          </span>
          <p className="cifra mt-0.5 text-cuerpo font-bold text-senal-hondo">
            S/ {metricas.promedioM2.toLocaleString('es-PE')}
          </p>
        </div>

        {/* Precio Mínimo por m² */}
        <div className="rounded-xl border border-linea/60 bg-papel p-2.5">
          <span className="block text-micro font-medium text-tinta-70">
            Mínimo / m²
          </span>
          <p className="cifra mt-0.5 text-cuerpo font-bold text-tinta">
            S/ {metricas.minM2.toLocaleString('es-PE')}
          </p>
        </div>

        {/* Precio Máximo por m² */}
        <div className="rounded-xl border border-linea/60 bg-papel p-2.5">
          <span className="block text-micro font-medium text-tinta-70">
            Máximo / m²
          </span>
          <p className="cifra mt-0.5 text-cuerpo font-bold text-tinta">
            S/ {metricas.maxM2.toLocaleString('es-PE')}
          </p>
        </div>

        {/* Volumen disponible */}
        <div className="rounded-xl border border-linea/60 bg-papel p-2.5">
          <span className="block text-micro font-medium text-tinta-70">
            Disponibles
          </span>
          <p className="cifra mt-0.5 text-cuerpo font-bold text-tinta">
            {metricas.volumen}{' '}
            <span className="text-micro font-normal text-tinta-50">
              {metricas.volumen === 1 ? 'inmueble' : 'inmuebles'}
            </span>
          </p>
        </div>
      </div>

      {/* Nota de mercado o referencial */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-micro text-tinta-50">
        {metricas.esReferencial ? (
          <p className="flex items-center gap-1 text-aviso">
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3M8 11h.01" strokeLinecap="round" />
            </svg>
            <span>Valores referenciales del mercado de Huánuco</span>
          </p>
        ) : (
          <p className="flex items-center gap-1 text-menta-hondo">
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Calculado con inmuebles activos en la zona</span>
          </p>
        )}

        <button
          type="button"
          onClick={alCerrar}
          className="text-micro font-medium text-senal underline hover:text-senal-hondo"
        >
          Ver toda la región
        </button>
      </div>
    </div>
  );
}
