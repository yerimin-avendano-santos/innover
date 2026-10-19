/**
 * El armazón del acceso: la pantalla y nada más.
 *
 * Sin barra de navegación y sin pie. Entrar no es una pantalla del
 * producto todavía: es la puerta, y la puerta no lleva menú. Además, la
 * barra ofrecía "Buscar" y "Publicar" a quien no tiene sesión, que era
 * ofrecer una puerta cerrada.
 *
 * El `min-h-dvh` es lo que hace que la pantalla de acceso llene el alto de
 * la ventana en cualquier tamaño: antes, en escritorio, la tarjeta flotaba
 * centrada sobre el gris y esto era lo que la mantenía en el medio; ahora
 * la pantalla ES la pantalla, y esto es lo que impide que se quede corta
 * cuando el contenido es más bajo que la ventana.
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
