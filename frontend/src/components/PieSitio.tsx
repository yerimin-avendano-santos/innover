'use client';

import { usePathname } from 'next/navigation';

/**
 * Pie de página general del sitio.
 *
 * El buscador principal ('/') es una aplicación interactiva que ocupa la pantalla completa
 * (mapa y lista sincronizados). En esa pantalla no se dibuja el pie para no romper la altura
 * del viewport ni provocar desplazamientos indeseados sobre los controles móviles.
 */
export function PieSitio() {
  const ruta = usePathname();

  if (ruta === '/') return null;

  return (
    <footer className="border-t border-linea bg-papel-alto">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-6 text-micro text-tinta-50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Precios de referencia. Verifica siempre antes de firmar.</p>
      </div>
    </footer>
  );
}
