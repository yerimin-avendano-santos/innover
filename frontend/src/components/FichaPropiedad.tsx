'use client';

// ========================================
// 📋 FICHA DE PROPIEDAD
// ========================================
// La tarjeta de una propiedad.
//
// 📌 POR QUÉ ESTA FICHA ES UN "PLANO", NO UNA TARJETA BONITA
//
// En una búsqueda inmobiliaria el usuario no compara "estilos", compara
// números: precio por m², área, cuántas habitaciones. Antes esta tarjeta
// escondía esos datos detrás de adornos y esquinas redondeadas que no
// significaban nada (una tenía radio arriba, otra abajo).
//
// Ahora los datos van en fila, alineados a la derecha, con cifras
// tabulares. Se pueden escanear en vertical, que es como se comparan.
//
// El precio por m² va en la esquina porque es la cifra con la que el
// comprador realmente decide: dos propiedades del mismo precio pueden
// estar en barrios completamente distintos.

import { formatearPrecio, precioPorM2, tiempoRelativo, etiquetaTipo } from '@/lib/api';
import type { Propiedad } from '@/lib/tipos';

interface Props {
  propiedad: Propiedad;
  seleccionada?: boolean;
  alSeleccionar?: (id: number) => void;
}

export function FichaPropiedad({ propiedad, seleccionada, alSeleccionar }: Props) {
  const porM2 = precioPorM2(propiedad.precio, propiedad.area_m2, propiedad.moneda);

  return (
    <article
      className={`ficha group cursor-pointer p-4 ${
        seleccionada ? 'border-tinta' : ''
      }`}
      onClick={() => alSeleccionar?.(propiedad.id)}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          alSeleccionar?.(propiedad.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={seleccionada}
    >
      {/* --- Cabecera --- */}
      <header className="mb-3">
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <h3 className="text-grande font-semibold leading-tight text-tinta">
            {propiedad.titulo}
          </h3>

          {/* El distintivo de "destacado" es lo que el agente PAGÓ por
              tener. Por eso tiene color propio (ámbar) y no el color
              de acción: el usuario no debe confundirlo con un
              elemento interactivo. */}
          {propiedad.destacado && (
            <span className="distintivo distintivo-destacado shrink-0">Destacado</span>
          )}
        </div>

        <p className="text-menor text-tinta-50">
          {etiquetaTipo(propiedad.tipo_inmueble)}
          {propiedad.distrito && ` · ${propiedad.distrito.nombre}`}
        </p>
      </header>

      {/* --- Precio ---
          Es el dato dominante. Por eso va grande y en la señal. */}
      <div className="mb-3 flex items-baseline justify-between gap-2 border-t border-linea pt-3">
        <div>
          <p className="cifra text-grande font-semibold text-senal">
            {formatearPrecio(propiedad.precio, propiedad.moneda)}
          </p>
          {porM2 && (
            <p className="cifra mt-0.5 text-micro text-tinta-50">{porM2}</p>
          )}
        </div>

        <span className="distintivo distintivo-neutro shrink-0">
          {propiedad.tipo === 'VENTA' ? 'Venta' : 'Alquiler'}
        </span>
      </div>

      {/* --- Especificaciones ---
          Fila de datos, no tarjetas. Alineados para que se lean
          como los rótulos de un plano: nombre arriba, cifra abajo. */}
      <dl className="grid grid-cols-4 gap-2 border-t border-linea pt-3">
        <Dato etiqueta="Área" valor={propiedad.area_m2 ? `${propiedad.area_m2} m²` : '—'} />
        <Dato etiqueta="Hab." valor={propiedad.habitaciones || '—'} />
        <Dato etiqueta="Baños" valor={propiedad.banos || '—'} />
        <Dato etiqueta="Auto" valor={propiedad.parkederos || '—'} />
      </dl>

      {/* --- Pie --- */}
      <footer className="mt-3 flex items-center justify-between gap-3 border-t border-linea pt-3">
        <p className="text-micro text-tinta-30">
          {tiempoRelativo(propiedad.fecha_creacion)}
        </p>

        {/* El sello de identidad verificada es la promesa central del
            startup ("directorio de propietarios validados"), así que
            tiene presencia visual y no un texto suelto. */}
        {propiedad.propietario?.identidad_verificada && (
          <span className="distintivo distintivo-senal">
            Propietario verificado
          </span>
        )}
      </footer>
    </article>
  );
}

/**
 * Una celda de la tabla de especificaciones.
 *
 * La etiqueta va arriba en gris pequeño y la cifra debajo en grande.
 * Al revés sería más difícil de escanear: el ojo busca los números
 * grandes y los compara, no las etiquetas.
 */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div>
      <dt className="text-micro text-tinta-50">{etiqueta}</dt>
      <dd className="cifra text-cuerpo font-medium text-tinta">{valor}</dd>
    </div>
  );
}
