// ========================================
// 🔷 LOGO
// ========================================
//
// La fuente de verdad del dibujo es `design/logosvg.svg`. Este archivo es
// ese mismo SVG, recortado y traducido a un componente por dos motivos:
//
// 1. El original incluye la palabra "Innover" como texto SVG. Aquí se
//    recorta con el `viewBox` para que la palabra sea texto HTML en la
//    interfaz. Un texto SVG no se puede seleccionar, ni buscar, ni
//    leer un lector de pantalla, y un buscador no lo indexa. Como
//    rótulo de marca que es, conviene que sea texto de verdad.
//
// 2. El original mide 400×420 con márgenes. El `viewBox` que se usa
//    aquí —`85 36 230 260`— encuadra solo el icono, así que el dibujo
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
   * Cuando el icono acompaña a la palabra "Innover" escrita en HTML, hay
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
       *   dibujo (con su trazo):  x [88,5 .. 311,5]   y [42 .. 292]
       *   sombra:                 `dy="8"`, desenfoque 6, y la región del
       *                           filtro (-10 % / +120 %) deja el grupo del
       *                           mapa llegando hasta y ≈ 304
       *
       * Con eso, `78 32 244 274` deja 10 px de margen a los lados y arriba,
       * y 14 abajo —los últimos no son aire, son la sombra—. El centro del
       * recorte cae en x = 200, exactamente el centro del dibujo, así que el
       * icono queda centrado.
       *
       * Si algún día se cambia el dibujo en `design/logosvg.svg`, hay que
       * volver a medir. Y si se recorta de más, la única señal es que el
       * logo se ve mal: el compilador no dice nada.
       */
      viewBox="78 32 244 274"
      className={className}
      // Con `titulo` el SVG se anuncia con ese nombre; sin él es decorativo.
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* Los degradados del logo, con los identificadores tal cual
            vienen del original.

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
        <linearGradient id="marcaAzul" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0052D4" />
          <stop offset="100%" stopColor="#0082FF" />
        </linearGradient>

        <linearGradient id="marcaTurquesa" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D2B8" />
          <stop offset="100%" stopColor="#008B9B" />
        </linearGradient>

        <filter id="marcaSombra" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#1A3E62" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* ===== Base del mapa 3D ===== */}
      <g filter="url(#marcaSombra)">
        {/* Borde inferior azul oscuro (base profunda) */}
        <path d="M 95 232 L 200 282 L 305 232 L 305 242 L 200 292 L 95 242 Z" fill="#10316B" />

        {/* Grosor intermedio de la plataforma */}
        <path d="M 90 218 L 200 270 L 310 218 L 310 230 L 200 282 L 90 230 Z" fill="#CBD5E1" />

        {/* Superficie superior del mapa (rombo isométrico) */}
        <polygon points="200,168 310,218 200,270 90,218" fill="#F8FAFC" />

        {/* Parcelas y calles (izquierda, tonos azules) */}
        <polygon points="194,178 145,200 175,214 222,191" fill="#CBD5E1" />
        <polygon points="135,205 105,218 138,234 168,219" fill="#3898FF" />
        <polygon points="175,223 146,238 195,261 224,246" fill="#5CA8FF" />

        {/* Parques (derecha, tonos verdes y turquesas) */}
        <polygon points="230,195 183,218 215,233 262,210" fill="#86CFA3" />
        <polygon points="270,214 223,237 245,247 292,224" fill="#74B896" />
        <polygon points="215,241 198,249 218,258 235,250" fill="#5BB5A2" />
      </g>

      {/* ===== Pin hexagonal y casa 3D ===== */}
      <g filter="url(#marcaSombra)">
        {/* Fondo blanco interior del pin */}
        <polygon points="200,52 268,90 268,162 200,238 132,162 132,90" fill="#FFFFFF" />

        {/* Mitad izquierda del pin (azul) */}
        <path
          d="M 200 42 L 136 78 A 16 16 0 0 0 128 92 L 128 156 A 22 22 0 0 0 135 172 L 200 245 L 200 216 L 150 160 L 150 96 L 200 68 Z"
          fill="url(#marcaAzul)"
        />

        {/* Mitad derecha del pin (turquesa) */}
        <path
          d="M 200 42 L 264 78 A 16 16 0 0 1 272 92 L 272 156 A 22 22 0 0 1 265 172 L 200 245 L 200 216 L 250 160 L 250 96 L 200 68 Z"
          fill="url(#marcaTurquesa)"
        />

        {/* Casa interior, mitad izquierda */}
        <path
          d="M 200 96 L 162 118 L 162 174 L 178 192 L 178 130 L 200 117 Z"
          fill="url(#marcaAzul)"
        />

        {/* Casa interior, mitad derecha */}
        <path
          d="M 200 96 L 238 118 L 238 174 L 222 192 L 222 130 L 200 117 Z"
          fill="url(#marcaTurquesa)"
        />

        {/* Ventana central de 4 paneles */}
        <g fill="#0072E5">
          <rect x="190" y="142" width="8" height="8" rx="1.5" />
          <rect x="202" y="142" width="8" height="8" rx="1.5" />
          <rect x="190" y="154" width="8" height="8" rx="1.5" />
          <rect x="202" y="154" width="8" height="8" rx="1.5" />
        </g>
      </g>
    </svg>
  );
}

/**
 * La marca completa: el icono más la palabra escrita en HTML.
 *
 * La palabra no va en el SVG a propósito. Así hereda la tipografía
 * (Inter), se puede seleccionar y copiar, y los buscadores la leen como
 * texto y no como un dibujo.
 */
export function Marca({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Logo className="h-7 w-7 shrink-0" />
      <span className="text-normal font-bold tracking-tight">Innover</span>
    </span>
  );
}
