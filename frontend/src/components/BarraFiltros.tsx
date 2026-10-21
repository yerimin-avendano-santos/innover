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
//
// 📌 UNA SOLA FILA, Y EL CONTADOR EN LA LISTA
//
// Antes el contador y "Limpiar filtros" ocupaban una segunda franja
// debajo de los controles. Eso le robaba ~40 px de alto al mapa y
// duplicaba el borde con la lista. El contador se mudó a la cabecera de
// la lista (ver `Buscador.tsx`), donde pertenece: cuenta lo que hay
// debajo, no lo que hay en el filtro.

import Link from 'next/link';
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

/**
 * Cómo se nombra cada tipo en la frase del contador.
 *
 * No se reutiliza `TIPOS_INMUEBLE` porque sus etiquetas están en plural
 * ("Departamentos") y el contador tiene que decir "1 departamento". Con
 * un `if` por tipo, "Local comercial" se pluraliza como "locales
 * comerciales"; añadir una "s" al final daría "local comercials".
 */
const NOMBRES_INMUEBLE: Record<TipoInmueble, { singular: string; plural: string }> = {
  DEPARTAMENTO: { singular: 'departamento', plural: 'departamentos' },
  CASA: { singular: 'casa', plural: 'casas' },
  TERRENO: { singular: 'terreno', plural: 'terrenos' },
  OFICINA: { singular: 'oficina', plural: 'oficinas' },
  LOCAL_COMERCIAL: { singular: 'local comercial', plural: 'locales comerciales' },
  OTRO: { singular: 'propiedad', plural: 'propiedades' },
};

export function BarraFiltros({ filtros, alCambiar, distritos }: Props) {
  const cambiar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => {
    alCambiar({ ...filtros, [campo]: valor });
  };

  return (
    <div className="border-b border-linea bg-papel-alto">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2.5 sm:px-6">
        {/*
          Los filtros se desplazan dentro de su propio carril y el CTA se
          queda fuera. Antes el CTA viajaba dentro del scroll: a 1024 la
          fila ya no cabía y «Publicar propiedad» se iba fuera de la
          pantalla justo cuando el usuario no encuentra lo que busca, que
          es cuando más lo necesita. Así los filtros pueden seguir
          desplazándose sin esconder la acción.
        */}
        <div className="sin-barra flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {/* --- Buscador ---
              La lupa va dentro del campo y no al lado: es una pista de
              qué hace el control, no un botón. El `pl-9` le deja sitio
              al icono sin que el texto empiece debajo de él. */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-[240px]">
            <label htmlFor="busqueda" className="solo-lector">
              Buscar por nombre del distrito o tipo de inmueble
            </label>
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-50"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" strokeLinecap="round" />
            </svg>
            <input
              id="busqueda"
              type="search"
              value={filtros.busqueda}
              onChange={(e) => cambiar('busqueda', e.target.value)}
              placeholder="Buscar por distrito o tipo…"
              className="campo rounded-full py-2 pl-9 pr-3 text-menor transition-colors focus:border-senal"
            />
          </div>

          {/* --- Venta / Alquiler ---
              Segmentado, no un <select>. Son dos opciones y se eligen
              seguido; un desplegable para eso es un clic de más.
              El activo usa `senal-hondo`, el mismo teal de la barra. */}
          <div
            className="flex shrink-0 rounded-full border border-linea-fuerte bg-papel-alto p-0.5"
            role="group"
            aria-label="Tipo de operación"
          >
            {(['VENTA', 'ALQUILER'] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => cambiar('tipo', filtros.tipo === valor ? '' : valor)}
                aria-pressed={filtros.tipo === valor}
                className={`rounded-full px-3 py-1.5 text-menor font-medium transition-colors ${
                  filtros.tipo === valor
                    ? 'bg-senal-hondo text-sobre-marino'
                    : 'text-tinta-70 hover:text-tinta'
                }`}
              >
                {valor === 'VENTA' ? 'Venta' : 'Alquiler'}
              </button>
            ))}
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

          {/* --- Orden --- */}
          <div className="relative shrink-0">
            <label className="solo-lector" htmlFor="orden">
              Ordenar resultados
            </label>
            <select
              id="orden"
              value={filtros.orden}
              onChange={(e) => cambiar('orden', e.target.value as Filtros['orden'])}
              className="campo w-auto appearance-none rounded-full py-2 pl-3 pr-8 text-menor text-tinta-70 transition-colors hover:border-linea-fuerte"
            >
              <option value="recientes">Más recientes</option>
              <option value="precio_asc">Menor precio</option>
              <option value="precio_desc">Mayor precio</option>
              <option value="populares">Más vistas</option>
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-tinta-50"
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {/* --- Publicar ---
            El CTA vive aquí, junto a los filtros, porque es la acción
            que completa la pantalla: si no encuentras lo que buscas,
            publica lo tuyo. Va FUERA del carril que se desplaza: así
            sigue visible a 1024, donde los filtros ya no caben. En móvil
            se oculta porque la navegación ya tiene el enlace. */}
        <Link
          href="/publicar"
          className="btn btn-principal hidden shrink-0 px-3 text-menor sm:inline-flex"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
          </svg>
          Publicar propiedad
        </Link>
      </div>
    </div>
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
        className={`campo w-auto appearance-none rounded-full py-2 pl-3 pr-8 text-menor transition-colors ${
          hayValor
            ? 'border-senal bg-senal-suave font-medium text-senal-hondo'
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

      {/* La flecha dibujada a mano en vez de usar un icono de librerías
          o el del sistema, que cambia entre navegadores. */}
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
 * Describe el resultado en una frase.
 *
 * "9 propiedades encontradas en Huánuco" comunica mucho más que
 * "Resultados: 9". Es la diferencia entre un rótulo y una respuesta.
 *
 * ⚠️ EL ORDEN DE LAS PALABRAS NO ES LIBRE. La versión anterior metía el
 * tipo después de la operación y producía "9 propiedades en venta
 * departamentos en Amarilis": el sustantivo tiene que ir primero, y si
 * hay tipo, él ES el sustantivo. "8 departamentos en venta en Amarilis".
 */
export function construirDescripcion(
  filtros: Filtros,
  distritos: Distrito[],
  total: number
): string {
  if (total === 0) {
    // Sin filtros, "no encontramos propiedades con esos filtros" se
    // contradice con el estado vacío, que dice que todavía no hay ninguna
    // publicada. El contador tiene que contar la misma historia que la
    // lista que tiene debajo.
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

  // "encontradas" solo cuando el sustantivo es "propiedades": con un tipo
  // ("8 departamentos encontrados") la frase se alarga sin aportar nada.
  if (!tipo) {
    partes.push(total === 1 ? 'encontrada' : 'encontradas');
  }

  const distrito = filtros.distrito_id
    ? distritos.find((d) => d.id === filtros.distrito_id)
    : null;

  // Sin distrito se dice la región, no un "en todas partes" que no
  // informa de nada: Innover opera en Huánuco.
  partes.push(`en ${distrito?.nombre ?? 'Huánuco'}`);

  if (filtros.habitaciones) {
    partes.push(`con ${filtros.habitaciones}+ habitaciones`);
  }

  return partes.join(' ');
}
