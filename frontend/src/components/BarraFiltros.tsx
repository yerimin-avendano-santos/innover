'use client';

// ========================================
// 🎛️ BARRA DE FILTROS
// ========================================
// El instrumento de búsqueda.
//
// 📌 POR QUÉ ES UNA BARRA HORIZONTAL Y NO UN MENÚ LATERAL
//
// En una página con mapa, el mapa ya ocupa el lateral. Si además el
// filtro se lleva el otro lado, la pantalla se parte en dos columnas
// estrechas y el mapa queda en un hueco diminuto. La barra horizontal
// deja el mapa a pantalla completa.
//
// En móvil la barra se desplaza horizontalmente: cabe el Triple, pero
// un menú desplegable por cada filtro sería 5 toques antes de buscar.

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
  total: number;
  cargando: boolean;
}

const TIPOS_INMUEBLE: { valor: TipoInmueble; etiqueta: string }[] = [
  { valor: 'DEPARTAMENTO', etiqueta: 'Departamentos' },
  { valor: 'CASA', etiqueta: 'Casas' },
  { valor: 'TERRENO', etiqueta: 'Terrenos' },
  { valor: 'OFICINA', etiqueta: 'Oficinas' },
  { valor: 'LOCAL_COMERCIAL', etiqueta: 'Locales' },
];

export function BarraFiltros({ filtros, alCambiar, distritos, total, cargando }: Props) {
  const cambiar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => {
    alCambiar({ ...filtros, [campo]: valor });
  };

  // El texto de la cabecera cambia con el resultado: "9 Departamentos en
  // venta en Amarilis" es información; "Resultados" es un rótulo vacío.
  const descripcion = construirDescripcion(filtros, distritos, total);

  return (
    <div className="border-b border-linea bg-papel-alto">
      <div className="sin-barra overflow-x-auto">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-3 sm:px-6">
          {/* --- Buscador --- */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <label htmlFor="busqueda" className="solo-lector">
              Buscar por nombre del distrito o tipo de inmueble
            </label>
            <input
              id="busqueda"
              type="search"
              value={filtros.busqueda}
              onChange={(e) => cambiar('busqueda', e.target.value)}
              placeholder="Buscar propiedad"
              className="campo py-2 text-cuerpo"
            />
          </div>

          <Separador />

          {/* --- Venta / Alquiler ---
              Segmentado, no un <select>. Son dos opciones y se eligen
              seguido; un desplegable para eso es un clic de más. */}
          <div
            className="flex shrink-0 rounded-medio border border-linea-fuerte bg-papel-alto p-0.5"
            role="group"
            aria-label="Tipo de operación"
          >
            {(['VENTA', 'ALQUILER'] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => cambiar('tipo', filtros.tipo === valor ? '' : valor)}
                aria-pressed={filtros.tipo === valor}
                className={`rounded-chico px-3 py-1.5 text-menor font-medium transition-colors ${
                  filtros.tipo === valor
                    ? 'bg-senal text-white'
                    : 'text-tinta-70 hover:text-tinta'
                }`}
              >
                {valor === 'VENTA' ? 'Venta' : 'Alquiler'}
              </button>
            ))}
          </div>

          <Separador />

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

          {/* --- Habitaciones --- */}
          <Selector
            etiqueta="Hab."
            valor={filtros.habitaciones ?? ''}
            onChange={(v) => cambiar('habitaciones', v ? Number(v) : null)}
            opciones={[1, 2, 3, 4, 5].map((n) => ({
              valor: n,
              etiqueta: n === 5 ? '5+' : String(n),
            }))}
            todosLabel="Cualquiera"
          />

          {/* --- Precio máximo ---
              Solo el máximo, no el rango completo. El usuario que busca
              "hasta 300 mil" es el caso común; el que busca "entre 200 y
              300" puede ajustar el slider después. Un rango doble aquí
              ocuparía media pantalla. */}
          <Selector
            etiqueta="Precio"
            valor={filtros.precioMax ?? ''}
            onChange={(v) => cambiar('precioMax', v ? Number(v) : null)}
            opciones={[
              { valor: 50000, etiqueta: 'Hasta S/ 50 mil' },
              { valor: 150000, etiqueta: 'Hasta S/ 150 mil' },
              { valor: 300000, etiqueta: 'Hasta S/ 300 mil' },
              { valor: 1000000, etiqueta: 'Hasta S/ 1 millón' },
            ]}
            todosLabel="Sin tope"
          />

          <Separador />

          {/* --- Orden --- */}
          <label className="sr-only" htmlFor="orden">
            Ordenar resultados
          </label>
          <select
            id="orden"
            value={filtros.orden}
            onChange={(e) => cambiar('orden', e.target.value as Filtros['orden'])}
            className="campo w-auto shrink-0 py-2 text-cuerpo"
          >
            <option value="recientes">Más recientes</option>
            <option value="precio_asc">Menor precio</option>
            <option value="precio_desc">Mayor precio</option>
            <option value="populares">Más vistas</option>
          </select>
        </div>
      </div>

      {/* --- Resultado y limpieza --- */}
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 border-t border-linea px-4 py-2 sm:px-6">
        <p aria-live="polite" className="text-menor text-tinta-70">
          {cargando ? (
            'Buscando…'
          ) : (
            descripcion
          )}
        </p>

        {tieneFiltrosActivos(filtros) && (
          <button
            type="button"
            onClick={() => alCambiar({ ...FILTROS_VACIOS })}
            className="btn btn-fantasma text-menor"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}

/** Una línea vertical que separa visualmente grupos de filtros. */
function Separador() {
  return (
    <span
      aria-hidden="true"
      className="hidden h-6 w-px shrink-0 bg-linea sm:block"
    />
  );
}

/**
 * Menú desplegable con etiqueta.
 *
 * La etiqueta ("Tipo", "Distrito") va DENTRO del control, a la izquierda
 * y en gris. Es el patrón de los instrumentos: el nombre del ajuste y su
 * valor conviven, así no hay que recordar qué columna era cada uno.
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
        className={`campo w-auto appearance-none py-2 pr-8 text-cuerpo ${
          hayValor ? 'border-senal text-senal' : ''
        }`}
      >
        <option value="">{todosLabel}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>

      {/* La flecha dibujada a mano en vez de usar un icono de librerías
          o el del sistema, que cambia entre navegadores. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-tinta-50"
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/** ¿Hay algo que limpiar? */
function tieneFiltrosActivos(filtros: Filtros): boolean {
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
 * Describe el resultado en una frase.
 *
 * "9 propiedades en venta en Amarilis" comunica mucho más que
 * "Resultados: 9". Es la diferencia entre un rótulo y una respuesta.
 */
function construirDescripcion(
  filtros: Filtros,
  distritos: Distrito[],
  total: number
): string {
  if (total === 0) {
    return 'No encontramos propiedades con esos filtros.';
  }

  const partes: string[] = [`${total} ${total === 1 ? 'propiedad' : 'propiedades'}`];

  if (filtros.tipo) partes.push(filtros.tipo === 'VENTA' ? 'en venta' : 'en alquiler');

  if (filtros.tipo_inmueble) {
    const tipo = TIPOS_INMUEBLE.find((t) => t.valor === filtros.tipo_inmueble);
    if (tipo) partes.push(tipo.etiqueta.toLowerCase());
  }

  if (filtros.distrito_id) {
    const distrito = distritos.find((d) => d.id === filtros.distrito_id);
    if (distrito) partes.push(`en ${distrito.nombre}`);
  }

  if (filtros.habitaciones) {
    partes.push(`con ${filtros.habitaciones}+ habitaciones`);
  }

  return partes.join(' ');
}
