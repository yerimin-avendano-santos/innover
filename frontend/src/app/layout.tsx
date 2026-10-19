import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { ProveedorAuth } from '@/contextos/Auth';
import './globals.css';

/**
 * La tipografía de trabajo: todo el producto.
 *
 * Inter y no otra, por lo que pide la guía visual: está diseñada para
 * interfaces y para leer cifras —precios, metros cuadrados, habitaciones—,
 * y en Innover la mitad de la pantalla son cifras. Sus dígitos son
 * especialmente claros a tamaños pequeños, que es donde se leen las
 * fichas de propiedad.
 *
 * Antes se usaba Archivo, eligiéndola por su eje de ancho variable
 * ("condensado"). Se comprobó que ese eje no se usaba en ninguna clase
 * del proyecto: era una capacidad declarada que no llegaba a la pantalla.
 * Cambiar de familia no perdió nada.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/**
 * La tipografía de titular: solo el panel de la pantalla de acceso.
 *
 * Es una serif de alto contraste para una frase grande sobre fondo
 * oscuro. No entra en el resto del producto por dos razones: un titular
 * de catálogo se lee mejor en Inter (y se compara con las cifras de al
 * lado), y cada familia extra son dos archivos de fuente que alguien
 * descarga.
 *
 * Se descargó del mismo sitio que Inter y la sirve el propio servidor
 * (`next/font` las trae al compilar): no hay una petición a Google en el
 * navegador de quien entra, así que la pantalla de acceso no depende de
 * un tercero ni filtra la visita.
 *
 * Sin `weight`: Playfair Display es una fuente variable, así que pesa
 * menos traer el eje completo que dos pesos sueltos.
 */
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-titulo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Innover · Propiedades en el mapa',
    template: '%s · Innover',
  },
  description:
    'Busca departamentos, casas y terrenos por zona en Huánuco. Elige viendo el mapa, no recorriendo calles.',
};

export const viewport: Viewport = {
  // Color de la barra del navegador en móvil. Va con el azul marino de
  // la barra de navegación: si se dejara el gris del fondo, al hacer
  // scroll se vería un salto de color entre el sistema y la aplicación.
  themeColor: '#0f295a',
};

/**
 * El layout raíz ya NO dibuja la barra de navegación ni el pie.
 *
 * ── Por qué ──
 *
 * Un layout hijo no puede quitar lo que dibuja su padre: lo que hay aquí
 * lo ven TODAS las pantallas. Y el acceso (entrar / registrarse) no es
 * una pantalla más: es una tarjeta de marca a pantalla completa, sin
 * navegación, como en el diseño. Dejar la barra arriba ofrecía además
 * "Buscar" y "Publicar" a quien todavía no tiene sesión.
 *
 * Así que el armazón vive donde le toca, en dos grupos de rutas:
 *
 *   (sitio)/layout.tsx   → barra + contenido + pie  (el producto)
 *   (acceso)/layout.tsx  → solo contenido           (entrar / registrarse)
 *
 * Los paréntesis son un grupo de rutas: organizan sin aparecer en la URL.
 * `/`, `/leads` o `/login` siguen siendo exactamente las mismas
 * direcciones que antes; lo único que cambia es qué armazón las envuelve.
 *
 * Se declara el tipo de `children` a mano en vez de usar el `LayoutProps`
 * generado por Next.
 *
 * Ese tipo se crea en `.next/types/`, que está en el .gitignore. Si se
 * usa, TypeScript falla en un clon recién bajado hasta que corras el
 * dev server una vez. Declararlo aquí evita esa trampa.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es-PE"
      className={`${inter.variable} ${playfair.variable} h-full`}
    >
      <body className="min-h-full">
        <ProveedorAuth>
          {/* El enlace de salto apunta a `#contenido`, y ese id lo pone
              cada armazón en su propio `<main>`. Va aquí arriba y no en
              cada layout para no repetirlo dos veces. */}
          <a href="#contenido" className="saltar-contenido">
            Saltar al contenido
          </a>

          {children}
        </ProveedorAuth>
      </body>
    </html>
  );
}
