'use client';

// ========================================
// 🎛️ BARRA DE FILTROS
// ========================================
// El instrumento de búsqueda limpio y ergonómico.
//
// 📌 ORGANIZACIÓN DE CONTROLES
// - Buscador ensanchado con placeholder conciso
// - Segmentado Venta/Alquiler con contraste nítido (#0F5C63 activo)
// - Desplegables esenciales directos: Tipo de inmueble y Distrito
// - Panel desplegable "Filtros" para Habitaciones, Precio y Orden, con contador de activos

import { useState, useRef, useEffect } from 'react';
import type { Distrito, TipoInmueble } from '@/lib/tipos';

export interface Filtros {
  tipo: 'VENTA' | 'ALQUILER' | '';
  tipo_inmueble: TipoInmueble | '';
  distrito_id: number | null;
  habitaciones: number | null;
  precioMax: number | null;
  orden: 'recientes' | 'precio_asc' | 'precio_desc' | 'populares';
  busqueda: string;
}

export const FILTROS_VACIOS: Filtros = {
  tipo: '',
  tipo_inmueble: '',
  distrito_id: null,
  habitaciones: null,
  precioMax: null,
  orden: 'recientes',
  busqueda: '',
};

interface Props {
  filtros: Filtros;
  alCambiar: (filtros: Filtros) => void;
  distritos: Distrito[];
}

const TIPOS_INMUEBLE: { valor: TipoInmueble; etiqueta: string }[] = [
  { valor: 'DEPARTAMENTO', etiqueta: 'Departamentos' },
  { valor: 'CASA', etiqueta: 'Casas' },
  { valor: 'TERRENO', etiqueta: 'Terrenos' },
  { valor: 'OFICINA', etiqueta: 'Oficinas' },
  { valor: 'LOCAL_COMERCIAL', etiqueta: 'Locales' },
];

const NOMBRES_INMUEBLE: Record<TipoInmueble, { singular: string; plural: string }> = {
  DEPARTAMENTO: { singular: 'departamento', plural: 'departamentos' },
  CASA: { singular: 'casa', plural: 'casas' },
  TERRENO: { singular: 'terreno', plural: 'terrenos' },
  OFICINA: { singular: 'oficina', plural: 'oficinas' },
  LOCAL_COMERCIAL: { singular: 'local comercial', plural: 'locales comerciales' },
  OTRO: { singular: 'propiedad', plural: 'propiedades' },
};

export function BarraFiltros({ filtros, alCambiar, distritos }: Props) {
  const [panelFiltrosAbierto, setPanelFiltrosAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const cambiar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => {
    alCambiar({ ...filtros, [campo]: valor });
  };

  // Cantidad de filtros secundarios aplicados dentro del panel
  const secundariosActivos =
    (filtros.habitaciones ? 1 : 0) +
    (filtros.precioMax ? 1 : 0) +
    (filtros.orden !== 'recientes' ? 1 : 0);

  // Cerrar panel al hacer clic afuera o presionar Escape
  useEffect(() => {
    function clickAfuera(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelFiltrosAbierto(false);
      }
    }
    function teclaEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPanelFiltrosAbierto(false);
      }
    }
    if (panelFiltrosAbierto) {
      document.addEventListener('mousedown', clickAfuera);
      document.addEventListener('keydown', teclaEscape);
    }
    return () => {
      document.removeEventListener('mousedown', clickAfuera);
      document.removeEventListener('keydown', teclaEscape);
    };
  }, [panelFiltrosAbierto]);

  return (
    <div className="relative z-30 border-b border-linea bg-papel-alto">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2.5 sm:px-6">
        <div className="sin-barra touch-pan-x flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto py-0.5">
          {/* --- Buscador con mayor amplitud y placeholder conciso --- */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
            <label htmlFor="busqueda" className="solo-lector">
              Buscar por distrito o tipo
            </label>
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-50"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" strokeLinecap="round" />
            </svg>
            <input
              id="busqueda"
              type="search"
              value={filtros.busqueda}
              onChange={(e) => cambiar('busqueda', e.target.value)}
              placeholder="Buscar distrito o tipo…"
              className="campo rounded-full py-2 pl-9 pr-3 text-menor transition-colors focus:border-senal"
            />
          </div>

          {/* --- Segmentado Venta / Alquiler --- */}
          <div
            className="flex shrink-0 rounded-full border border-linea-fuerte bg-papel p-0.5 shadow-2xs"
            role="group"
            aria-label="Tipo de operación"
          >
            {(['VENTA', 'ALQUILER'] as const).map((valor) => {
              const activo = filtros.tipo === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => cambiar('tipo', activo ? '' : valor)}
                  aria-pressed={activo}
                  className={`rounded-full px-3.5 py-1.5 text-menor font-semibold transition-all ${
                    activo
                      ? 'bg-senal text-sobre-marino shadow-xs'
                      : 'text-tinta-70 hover:text-tinta'
                  }`}
                >
                  {valor === 'VENTA' ? 'Venta' : 'Alquiler'}
                </button>
              );
            })}
          </div>

          {/* --- Tipo de inmueble --- */}
          <Selector
            etiqueta="Tipo"
            valor={filtros.tipo_inmueble}
            onChange={(v) => cambiar('tipo_inmueble', v as Filtros['tipo_inmueble'])}
            opciones={TIPOS_INMUEBLE.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
            todosLabel="Todos los tipos"
          />

          {/* --- Distrito --- */}
          <Selector
            etiqueta="Distrito"
            valor={filtros.distrito_id ?? ''}
            onChange={(v) => cambiar('distrito_id', v ? Number(v) : null)}
            opciones={distritos.map((d) => ({ valor: d.id, etiqueta: d.nombre }))}
            todosLabel="Todos los distritos"
          />
        </div>

        {/* --- Botón agrupador "Filtros" con popover (FUERA del scroll horizontal) --- */}
        <div className="relative shrink-0" ref={panelRef}>
            <button
              type="button"
              onClick={() => setPanelFiltrosAbierto((prev) => !prev)}
              aria-expanded={panelFiltrosAbierto}
              aria-haspopup="dialog"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-menor font-medium transition-all ${
                secundariosActivos > 0 || panelFiltrosAbierto
                  ? 'border-senal bg-teal-50 text-senal-hondo font-semibold'
                  : 'border-linea bg-papel-alto text-tinta-70 hover:border-linea-fuerte hover:text-tinta'
              }`}
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
              </svg>
              <span>Filtros</span>
              {secundariosActivos > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-senal px-1 text-micro font-bold text-white">
                  {secundariosActivos}
                </span>
              )}
              <svg
                viewBox="0 0 12 12"
                className={`h-2.5 w-2.5 transition-transform duration-150 ${
                  panelFiltrosAbierto ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Panel flotante de filtros */}
            {panelFiltrosAbierto && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-linea bg-papel-alto p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between border-b border-linea pb-2.5">
                  <span className="text-menor font-semibold text-tinta">Filtros adicionales</span>
                  {secundariosActivos > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        alCambiar({
                          ...filtros,
                          habitaciones: null,
                          precioMax: null,
                          orden: 'recientes',
                        });
                      }}
                      className="text-micro font-medium text-alerta hover:underline"
                    >
                      Restablecer
                    </button>
                  )}
                </div>

                <div className="space-y-3.5">
                  {/* Habitaciones */}
                  <div>
                    <label className="mb-1 block text-micro font-medium text-tinta-70">
                      Habitaciones
                    </label>
                    <div className="flex gap-1.5">
                      {[null, 1, 2, 3, 4, 5].map((n) => {
                        const activo = filtros.habitaciones === n;
                        return (
                          <button
                            key={n ?? 'todos'}
                            type="button"
                            onClick={() => cambiar('habitaciones', n)}
                            className={`flex-1 rounded-lg border py-1.5 text-micro font-medium transition-colors ${
                              activo
                                ? 'border-senal bg-teal-50 text-senal font-semibold'
                                : 'border-linea bg-papel hover:border-linea-fuerte text-tinta-70'
                            }`}
                          >
                            {n === null ? 'Todas' : n === 5 ? '5+' : n}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Precio máximo */}
                  <div>
                    <label htmlFor="precio-panel" className="mb-1 block text-micro font-medium text-tinta-70">
                      Precio máximo
                    </label>
                    <select
                      id="precio-panel"
                      value={filtros.precioMax ?? ''}
                      onChange={(e) => cambiar('precioMax', e.target.value ? Number(e.target.value) : null)}
                      className="campo w-full rounded-xl py-1.5 text-menor"
                    >
                      <option value="">Sin límite de precio</option>
                      <option value="50000">Hasta S/ 50,000</option>
                      <option value="150000">Hasta S/ 150,000</option>
                      <option value="300000">Hasta S/ 300,000</option>
                      <option value="500000">Hasta S/ 500,000</option>
                      <option value="1000000">Hasta S/ 1,000,000</option>
                    </select>
                  </div>

                  {/* Orden */}
                  <div>
                    <label htmlFor="orden-panel" className="mb-1 block text-micro font-medium text-tinta-70">
                      Ordenar publicaciones
                    </label>
                    <select
                      id="orden-panel"
                      value={filtros.orden}
                      onChange={(e) => cambiar('orden', e.target.value as Filtros['orden'])}
                      className="campo w-full rounded-xl py-1.5 text-menor"
                    >
                      <option value="recientes">Más recientes</option>
                      <option value="precio_asc">Menor precio</option>
                      <option value="precio_desc">Mayor precio</option>
                      <option value="populares">Más vistas</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-linea flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPanelFiltrosAbierto(false)}
                    className="btn btn-principal w-full py-1.5 text-menor font-semibold"
                  >
                    Ver resultados
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

/**
 * Menú desplegable con etiqueta integrada.
 */
function Selector({
  etiqueta,
  valor,
  onChange,
  opciones,
  todosLabel,
}: {
  etiqueta: string;
  valor: string | number;
  onChange: (valor: string) => void;
  opciones: { valor: string | number; etiqueta: string }[];
  todosLabel: string;
}) {
  const hayValor = valor !== '' && valor !== null;

  return (
    <div className="relative shrink-0">
      <label className="solo-lector" htmlFor={`filtro-${etiqueta}`}>
        {etiqueta}
      </label>
      <select
        id={`filtro-${etiqueta}`}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`campo w-auto appearance-none rounded-full py-2 pl-3 pr-8 text-menor transition-colors ${
          hayValor
            ? 'border-senal bg-teal-50 font-semibold text-senal-hondo'
            : 'text-tinta-70 hover:border-linea-fuerte'
        }`}
      >
        <option value="">{todosLabel}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>

      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className={`pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 transition-colors ${
          hayValor ? 'text-senal' : 'text-tinta-50'
        }`}
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/** ¿Hay algo que limpiar? */
export function tieneFiltrosActivos(filtros: Filtros): boolean {
  return Boolean(
    filtros.tipo ||
      filtros.tipo_inmueble ||
      filtros.distrito_id ||
      filtros.habitaciones ||
      filtros.precioMax ||
      filtros.busqueda
  );
}

/**
 * Describe el resultado en una frase informativa.
 */
export function construirDescripcion(
  filtros: Filtros,
  distritos: Distrito[],
  total: number
): string {
  if (total === 0) {
    return tieneFiltrosActivos(filtros)
      ? 'No encontramos propiedades con esos filtros.'
      : 'Aún no hay propiedades publicadas.';
  }

  const tipo = filtros.tipo_inmueble ? NOMBRES_INMUEBLE[filtros.tipo_inmueble] : null;
  const sustantivo = tipo
    ? total === 1
      ? tipo.singular
      : tipo.plural
    : total === 1
      ? 'propiedad'
      : 'propiedades';

  const partes: string[] = [`${total} ${sustantivo}`];

  if (filtros.tipo) {
    partes.push(filtros.tipo === 'VENTA' ? 'en venta' : 'en alquiler');
  }

  if (!tipo) {
    partes.push(total === 1 ? 'encontrada' : 'encontradas');
  }

  const distrito = filtros.distrito_id
    ? distritos.find((d) => d.id === filtros.distrito_id)
    : null;

  partes.push(`en ${distrito?.nombre ?? 'Huánuco'}`);

  if (filtros.habitaciones) {
    partes.push(`con ${filtros.habitaciones}+ habitaciones`);
  }

  return partes.join(' ');
}
