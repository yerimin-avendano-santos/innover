/**
 * El armazón del acceso: la tarjeta y nada más.
 *
 * Sin barra de navegación y sin pie. Entrar no es una pantalla del
 * producto todavía: es la puerta, y la puerta no lleva menú. Además, la
 * barra ofrecía "Buscar" y "Publicar" a quien no tiene sesión, que era
 * ofrecer una puerta cerrada.
 *
 * El `min-h-dvh` es lo que permite que la tarjeta llene la pantalla del
 * móvil de arriba abajo (allí va a sangre, sin esquinas) y que en
 * escritorio quede centrada en el alto.
 */
export default function LayoutAcceso({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="contenido" className="flex min-h-dvh flex-col bg-papel">
      {children}
    </main>
  );
}
