import { Navbar } from '@/components/Navbar';
import { AsistenteVirtual } from '@/components/AsistenteVirtual';

/**
 * El armazón del producto: barra de navegación, contenido y pie.
 *
 * Todo lo que cuelga de `(sitio)/` lo comparte: el buscador, las fichas,
 * el panel del agente, los contactos. La barra es lo único que se ve en
 * todas esas pantallas, y por eso va en azul marino: es donde la marca se
 * reconoce.
 *
 * El `flex min-h-dvh flex-col` con `flex-1` en el `<main>` es lo que deja
 * el pie abajo del todo en una página corta, sin pegarlo a media pantalla.
 */
export default function LayoutSitio({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />

      <main id="contenido" className="flex-1">
        {children}
      </main>

      <AsistenteVirtual />

      <footer className="border-t border-linea bg-papel-alto">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-6 text-micro text-tinta-50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          
          <p>Precios de referencia. Verifica siempre antes de firmar.</p>
        </div>
      </footer>
    </div>
  );
}
