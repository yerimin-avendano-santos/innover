import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { ProveedorAuth } from '@/contextos/Auth';
import { Navbar } from '@/components/Navbar';
import './globals.css';

/**
 * Una sola familia tipográfica, dos ejes de uso.
 *
 * Archivo tiene un rango de pesos amplio (100-900) y, sobre todo, un eje
 * de "ancho" (variable width). Eso permite titular en condensado, que
 * es justo el gesto de un rótulo urbano o de un plano técnico: las
 * letras altas y estrechas se leen rápido de lejos.
 *
 * Antes se usaba Geist (por defecto de create-next-app) y el CSS pedía
 * Inter y luego Nunar: tres familias declaradas, ninguna cargada.
 */
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  // El eje de ancho abre el rango de condensado a expandido.
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: {
    default: 'INNOVER · Propiedades en el mapa',
    template: '%s · INNOVER',
  },
  description:
    'Busca departamentos, casas y terrenos por zona en Huánuco. Elige viendo el mapa, no recorriendo calles.',
};

export const viewport: Viewport = {
  themeColor: '#f7f6f2',
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
    <html lang="es-PE" className={`${archivo.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <ProveedorAuth>
          <a
            href="#contenido"
            className="solo-lector focus:not-solo-lector focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-medio focus:bg-senal focus:px-4 focus:py-2 focus:text-white"
          >
            Saltar al contenido
          </a>

          <Navbar />

          <main id="contenido" className="flex-1">
            {children}
          </main>

          <footer className="border-t border-linea bg-papel-alto">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-6 text-micro text-tinta-50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p>INNOVER · Proyecto de aprendizaje full-stack</p>
              <p>Precios de referencia. Verifica siempre antes de firmar.</p>
            </div>
          </footer>
        </ProveedorAuth>
      </body>
    </html>
  );
}
