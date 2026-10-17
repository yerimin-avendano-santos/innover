// ========================================
// 🚪 LA PUERTA · INVITACIÓN A ENTRAR
// ========================================
// Lo que ve quien llega a Innover sin cuenta.
//
// 📌 POR QUÉ UNA INVITACIÓN Y NO UN REBOTE AL LOGIN
//
// Las páginas interiores (`/publicar`, `/leads`, `/admin`) redirigen a
// `/login`: quien entra ahí ya venía a hacer algo concreto y lo más rápido
// es ponerle el formulario delante.
//
// La portada es el caso contrario. Es lo primero que ve alguien que no
// conoce el producto: si lo primero que encuentra es un formulario, no sabe
// qué hay detrás y se va. Aquí toca explicar antes de pedir.
//
// Y por eso el texto dice lo que dice: qué es Innover, para qué sirve y
// cuánto cuesta entrar (nada). Un muro que no explica por qué está ahí es
// solo un estorbo.
//
// 📌 ESTA PANTALLA NO CARGA EL MAPA
//
// No es un descuido: es el motivo por el que el muro existe. Mapbox se cobra
// por carga de mapa, y el buscador vive en `components/Buscador.tsx`, que no
// se monta hasta que hay sesión. Ver el porqué en la cabecera de ese archivo.

import Link from 'next/link';
import { Marca } from '@/components/Logo';

/**
 * Los tres argumentos.
 *
 * Se escriben como datos y no a mano en el JSX para que el `map` no obligue a
 * repetir la estructura de cada fila tres veces. Si mañana hay que cambiar el
 * orden o quitar uno, se toca esta lista y nada más.
 */
const BENEFICIOS = [
  {
    titulo: 'El mapa primero',
    texto:
      'Filtra por distrito, precio y habitaciones, y mira los resultados aparecer donde están de verdad.',
  },
  {
    titulo: 'Trato directo',
    texto:
      'Escribes desde la ficha al propietario o al agente. Nadie te llama sin que lo hayas pedido.',
  },
  {
    titulo: 'La ficha completa',
    texto:
      'Metros, precio por m², habitaciones y servicios, para comparar manzanas y no folletos.',
  },
];

export function Invitacion() {
  return (
    <section className="superficie-clara bg-papel px-4 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-grande border border-linea bg-papel-alto p-7 shadow-lg sm:p-10">
          <Marca className="text-tinta" />

          {/*
            El `h1`. Lo lleva esta pantalla porque es la que existe para quien
            todavía no es usuario: el buscador, en cambio, es una herramienta
            y no tiene titular que anunciar.
          */}
          <h1 className="mt-6 text-titulo font-bold tracking-tight text-balance text-tinta sm:text-display">
            Elige dónde vivir viendo el mapa
          </h1>

          <p className="mt-4 text-cuerpo text-tinta-70">
            Innover reúne los departamentos, casas y terrenos de Huánuco en un solo
            mapa. Filtras, ves dónde cae cada uno y escribes directo.
          </p>

          <ul className="mt-8 space-y-4">
            {BENEFICIOS.map((beneficio) => (
              <li key={beneficio.titulo} className="flex gap-3">
                {/*
                  Un solo icono para los tres: no aportan información distinta,
                  marcan el ritmo de la lista. `currentColor` lo hereda del
                  `text-senal` del contenedor, así que el color sigue saliendo
                  de `globals.css` y no de aquí.
                */}
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-senal-suave text-senal"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8.5l3.2 3.2L13 5" />
                  </svg>
                </span>

                <p className="text-cuerpo text-tinta-70">
                  <strong className="font-semibold text-tinta">{beneficio.titulo}.</strong>{' '}
                  {beneficio.texto}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/registro" className="btn btn-principal">
              Crear cuenta gratis
            </Link>
            <Link href="/login" className="btn btn-secundario">
              Ya tengo cuenta
            </Link>
          </div>

          {/*
            Esta línea no es relleno: es la excepción del SEO contada al
            usuario. Cuando alguien comparte una propiedad por WhatsApp, quien
            recibe el enlace tiene que saber que puede abrirlo sin registrarse
            — si no, ni lo intenta. Y es verdad: `/propiedad/[slug]` es la
            única lectura pública a propósito (ver `propiedadRoutes.js`).
          */}
          <p className="mt-8 border-t border-linea pt-5 text-menor text-tinta-50">
            ¿Te compartieron el enlace de una propiedad? Ábrelo sin cuenta: las
            fichas son públicas.
          </p>
        </div>
      </div>
    </section>
  );
}
