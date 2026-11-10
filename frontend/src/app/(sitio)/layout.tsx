import { Navbar } from '@/components/Navbar';
import { AsistenteVirtual } from '@/components/AsistenteVirtual';
import { PieSitio } from '@/components/PieSitio';

/**
 * El armazón del producto: barra de navegación, contenido y pie.
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

      <PieSitio />
    </div>
  );
}
