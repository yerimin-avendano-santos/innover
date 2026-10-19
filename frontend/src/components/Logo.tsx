// ========================================
// 🔷 LOGO
// ========================================
//
// La fuente de verdad del dibujo es `design/nuevo/logoinnover.svg`. Este
// archivo es ese mismo SVG, recortado y traducido a un componente por dos
// motivos:
//
// 1. El original incluye la palabra "INNOVER" como texto SVG. Aquí se
//    recorta con el `viewBox` para que la palabra sea texto HTML en la
//    interfaz. Un texto SVG no se puede seleccionar, ni buscar, ni leer un
//    lector de pantalla, y un buscador no lo indexa. Como rótulo de marca
//    que es, conviene que sea texto de verdad.
//
// 2. El original mide 1024×1024 con márgenes. El `viewBox` que se usa
//    aquí —`253 105 518 610`— encuadra solo el icono, así que el dibujo
//    llena la caja en la que se le pone.
//
// ⚠️ Si algún día cambia el logo, hay que actualizar los dos sitios.
// No se genera automáticamente a propósito: el SVG de `design/` es la
// entrega del diseñador y este archivo es código de producción; unirlos
// con un script de compilación añadiría un paso de build para ahorrar
// una edición que ocurre una vez al año.

interface Props {
  /** Clases de tamaño. El icono no lleva tamaño propio: lo decide quien lo usa. */
  className?: string;
  /**
   * Nombre accesible.
   *
   * Cuando el icono acompaña a la palabra "INNOVER" escrita en HTML, hay
   * que dejarlo vacío: si ambos se anunciaran, un lector de pantalla
   * diría "Innover Innover". Cuando va solo, sin texto al lado, este
   * prop es obligatorio para que no quede un gráfico mudo.
   */
  titulo?: string;
}

export function Logo({ className = 'h-8 w-8', titulo }: Props) {
  return (
    <svg
      /*
       * El recorte del logo original: se queda solo con el icono y tira la
       * palabra, que va aparte en HTML.
       *
       * ⚠️ EL `viewBox` NO ES UN NÚMERO AL AZAR, Y QUEDARSE CORTO CORTA EL DIBUJO.
       *
       * Todo lo que caiga fuera del `viewBox` se RECORTA en silencio: no da
       * error, solo desaparece. Los cuatro números salen de medir la
       * geometría del SVG original:
       *
       *   dibujo:  x [263 .. 761]   y [115 .. 705]
       *
       * Con un margen de 10 px por lado queda `253 105 518 610`. El centro
       * del recorte cae en x = 512, exactamente el centro del dibujo (el
       * original parte el pin en dos mitades simétricas), así que el icono
       * queda centrado.
       *
       * Si algún día se cambia el dibujo en `design/nuevo/logoinnover.svg`,
       * hay que volver a medir. Y si se recorta de más, la única señal es
       * que el logo se ve mal: el compilador no dice nada.
       */
      viewBox="253 105 518 610"
      className={className}
      // Con `titulo` el SVG se anuncia con ese nombre; sin él es decorativo.
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* Los degradados del logo, con los colores de la entrega nueva.

            ⚠️ Los `id` son fijos y no únicos por instancia: si el logo
            se pinta dos veces en la misma página, hay `id` duplicados.
            Es una infracción formal de HTML, pero inofensiva en este
            caso concreto: las definiciones duplicadas son idénticas, así
            que el navegador resuelva la que resuelva, el degradado que
            se pinta es el mismo.

            Usar `useId()` lo arreglaría y es lo correcto en general,
            pero obliga a marcar el componente como de cliente —un
            `useState` sin estado, solo por el identificador— y eso
            arrastraría JavaScript al cliente por un dibujo estático. Se
            prefiere el `id` fijo porque el coste de la duplicación aquí
            es cero y el de hidratar no lo es. */}
        <linearGradient id="marcaAzul" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#006DE6" />
          <stop offset="100%" stopColor="#0356C4" />
        </linearGradient>

        <linearGradient id="marcaTurquesa" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0DD1D3" />
          <stop offset="100%" stopColor="#089596" />
        </linearGradient>

        <linearGradient id="marcaBase" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#11284A" />
          <stop offset="50%" stopColor="#183863" />
          <stop offset="100%" stopColor="#0E2342" />
        </linearGradient>
      </defs>

      {/* ===== Base del mapa isométrico 3D =====
          El logo no es solo una chincheta: es una chincheta sobre un mapa.
          Ese detalle es el que dice a qué se dedica el producto antes de
          leer una sola palabra. */}
      <path d="M 263 566 L 512 684 L 512 705 L 263 587 Z" fill="url(#marcaBase)" />
      <path d="M 512 684 L 761 566 L 761 587 L 512 705 Z" fill="url(#marcaBase)" />

      {/* Grosor intermedio de la plataforma */}
      <path d="M 263 556 L 512 674 L 512 684 L 263 566 Z" fill="#E2E8F0" />
      <path d="M 512 674 L 761 556 L 761 566 L 512 684 Z" fill="#CBD5E1" />

      {/* Superficie superior del mapa */}
      <path d="M 512 438 L 761 556 L 512 674 L 263 556 Z" fill="#F8FAFC" />

      {/* Parcelas y calles (izquierda, tonos azules) */}
      <path d="M 313 556 L 412 509 L 487 544 L 388 591 Z" fill="#4A90E2" />
      <path d="M 425 621 L 437 615 L 487 639 L 475 645 Z" fill="#71B4F8" />

      {/* Parques (derecha, tonos verdes y turquesas) */}
      <path d="M 612 509 L 711 556 L 637 591 L 537 544 Z" fill="#78C697" />
      <path d="M 562 603 L 599 621 L 549 645 L 512 627 Z" fill="#5EAD9E" />

      {/* Sombra de la chincheta sobre el mapa */}
      <ellipse cx="512" cy="595" rx="45" ry="15" fill="#000000" opacity="0.1" />
      <ellipse cx="512" cy="590" rx="20" ry="6" fill="#000000" opacity="0.15" />

      {/* ===== Chincheta hexagonal y casa =====
          La entrega nueva dibuja el pin como un ANILLO: el hueco del
          centro es transparente y es la superficie del mapa la que se ve
          a través. Por eso no hay polígono blanco de relleno como en la
          versión anterior. */}
      <path
        d="M 512 115 L 320 225 L 320 425 L 512 590 L 512 525 L 390 420 L 390 265 L 512 195 Z"
        fill="url(#marcaAzul)"
      />
      <path
        d="M 512 245 L 420 295 L 420 445 L 512 525 L 512 515 L 460 470 L 460 330 L 512 300 Z"
        fill="url(#marcaAzul)"
      />
      <path
        d="M 512 115 L 704 225 L 704 425 L 512 590 L 512 525 L 634 420 L 634 265 L 512 195 Z"
        fill="url(#marcaTurquesa)"
      />
      <path
        d="M 512 245 L 604 295 L 604 445 L 512 525 L 512 515 L 564 470 L 564 330 L 512 300 Z"
        fill="url(#marcaTurquesa)"
      />

      {/* Ventana central de 4 paneles */}
      <g fill="#006DE6">
        <rect x="486" y="375" width="16" height="16" rx="2" />
        <rect x="522" y="375" width="16" height="16" rx="2" />
        <rect x="486" y="410" width="16" height="16" rx="2" />
        <rect x="522" y="410" width="16" height="16" rx="2" />
      </g>
    </svg>
  );
}

/**
 * La marca completa: el icono más la palabra escrita en HTML.
 *
 * La palabra no va en el SVG a propósito. Así hereda la tipografía
 * (Inter), se puede seleccionar y copiar, y los buscadores la leen como
 * texto y no como un dibujo. Va en mayúsculas y con espaciado porque así
 * la escribe la entrega nueva; el espaciado de 0,07 em es el que trae el
 * SVG (10 unidades sobre un tamaño de 130).
 *
 * `icono` y `texto` existen para la pantalla de acceso, donde la marca va
 * más grande y apilada. Los dos son clases de tamaño, no colores: el
 * color lo hereda de quien lo coloca, así que la misma marca sirve sobre
 * papel y sobre el marino de la barra.
 */
export function Marca({
  className = '',
  icono = 'h-7 w-7',
  texto = 'text-normal',
}: {
  className?: string;
  icono?: string;
  texto?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Logo className={`${icono} shrink-0`} />
      <span className={`${texto} font-extrabold uppercase tracking-[0.07em]`}>
        Innover
      </span>
    </span>
  );
}
