/* eslint-disable @next/next/no-img-element -- son dos PNG propios, servidos desde
   `public/acceso/`; no hay ninguna dirección que venga del usuario, así que el
   motivo por el que la ficha prohíbe `next/image` (el SSRF) aquí no existe. Se
   prefiere `<img>` porque el optimizador de Next añadiría una ruta y una caché
   de variantes por cada tamaño de pantalla para un dibujo decorativo. */

// ========================================
// 🗺️ PANEL DEL ACCESO
// ========================================
//
// La columna derecha de la tarjeta de acceso: el titular de marca sobre
// el degradado, las curvas de nivel y la maqueta del buscador.
//
// ── Por qué es una maqueta y no un mapa de verdad ──
//
// Mapbox se cobra por CARGA de mapa, y esta pantalla es pública: se ve
// antes de tener cuenta y la ve también quien nunca se registrará. Un
// mapa de verdad aquí sería pagar por cada visita de cada rastreador.
//
// Además, lo que se enseña no es un mapa: es una promesa del producto
// ("aquí se busca viendo el mapa"), y una imagen lo dice sin descargar
// nada ni pedir permiso a nadie.
//
// ⚠️ TODO EL PANEL ES DECORATIVO. Va `aria-hidden` y las imágenes con
// `alt=""`: un lector de pantalla no tiene que leer una maqueta. Lo que
// sí importa —el titular y el subtítulo— está escrito como texto de
// verdad, y por eso se lee y se indexa.
//
// ── Las imágenes ──
//
// Los dos PNG viven en `public/acceso/` y salen de los renders de
// `design/nuevo/`, recortados a su dibujo. Traen fondo transparente: sin
// eso se vería el rectángulo gris del render sobre el panel oscuro.

/**
 * Curvas de nivel.
 *
 * Son la misma idea dibujada dos veces —un racimo de líneas
 * concéntricas—, cada una con su propia escala y su sitio. Copiar una
 * forma y escalarla da un mapa topográfico sin tener que dibujar cien
 * curvas a mano, y a 13 % de opacidad nadie ve que son la misma forma.
 *
 * `vectorEffect="non-scaling-stroke"` es lo que mantiene el trazo a 1 px
 * aunque la forma esté escalada: sin eso, las curvas de dentro saldrían
 * más finas que las de fuera y el dibujo se vería sucio.
 */
function Contornos() {
  const arracimado =
    'M 0 -132 C 74 -138 152 -96 176 -18 C 198 58 160 138 88 172 ' +
    'C 14 206 -78 190 -132 132 C -182 78 -196 -14 -150 -74 ' +
    'C -112 -124 -60 -126 0 -132 Z';

  return (
    <svg
      className="contornos pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 600 700"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(430 300)">
        {[1, 0.78, 0.56, 0.34].map((escala) => (
          <path
            key={escala}
            d={arracimado}
            transform={`scale(${escala})`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      <g transform="translate(90 560)">
        {[1.35, 1.05, 0.75, 0.45].map((escala) => (
          <path
            key={escala}
            d={arracimado}
            transform={`scale(${escala})`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* Dos líneas que cruzan el panel de lado a lado: rompen la
          simetría de los dos racimos y dan la sensación de que el mapa
          sigue fuera del recuadro. */}
      <path d="M -40 700 C 120 600 60 470 220 400 C 360 340 330 200 470 130" />
      <path d="M -40 770 C 170 690 130 540 310 470 C 450 415 430 280 590 210" />
    </svg>
  );
}

export function PanelAcceso() {
  return (
    <aside
      className="panel-acceso relative hidden overflow-hidden lg:block"
      aria-hidden="true"
    >
      <Contornos />

      {/* El texto va por ENCIMA de la maqueta (`z-20`): el buscador se
          le acerca por la derecha y sin esto le pasaría por delante. */}
      <div className="relative z-20 p-10 xl:p-14">
        <h2 className="max-w-[16ch] font-display text-titulo leading-apretado font-semibold text-sobre-marino">
          Elige dónde vivir viendo el mapa.
        </h2>
        <p className="mt-4 max-w-[28ch] text-cuerpo text-sobre-marino">
          Encuentra departamentos, casas y terrenos en un solo mapa.
        </p>
      </div>

      {/* La pantalla del buscador, sangrando por la derecha y por abajo
          como en el diseño: recortada por el borde, se lee como una
          ventana al producto y no como una figura pegada en el centro.

          ⚠️ `h-auto` es obligatorio aquí, y no es un adorno. Con los
          atributos `width`/`height` puestos, el navegador aplica los dos
          como si fueran estilos de la etiqueta: `w-[108%]` gana en el
          ancho, pero la altura se quedaría en los 628 px del atributo y
          la imagen saldría aplastada o estirada según el ancho del panel.
          Con `height: auto`, la altura sale de la proporción real del
          archivo y el dibujo nunca se deforma. */}
      <img
        src="/acceso/mapa.png"
        alt=""
        width={900}
        height={628}
        className="pointer-events-none absolute -right-[14%] -bottom-[6%] h-auto w-[108%] max-w-none select-none"
      />

      {/* La tarjeta de filtros, delante y más pequeña, como si estuviera
          desplegada sobre el mapa. */}
      <img
        src="/acceso/filtros.png"
        alt=""
        width={656}
        height={510}
        className="pointer-events-none absolute -left-[6%] bottom-[8%] h-auto w-[42%] max-w-none select-none"
      />
    </aside>
  );
}
