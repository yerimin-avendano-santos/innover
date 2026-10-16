import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ProveedorAuth } from '@/contextos/Auth';
import { Navbar } from '@/components/Navbar';
import './globals.css';

/**
 * Una sola familia tipográfica para todo el producto.
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
    <html lang="es-PE" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <ProveedorAuth>
          <a href="#contenido" className="saltar-contenido">
            Saltar al contenido
          </a>

          <Navbar />

          <main id="contenido" className="flex-1">
            {children}
          </main>

          <footer className="border-t border-linea bg-papel-alto">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-6 text-micro text-tinta-50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p>Innover · Proyecto de aprendizaje full-stack</p>
              <p>Precios de referencia. Verifica siempre antes de firmar.</p>
            </div>
          </footer>
        </ProveedorAuth>
      </body>
    </html>
  );
}
