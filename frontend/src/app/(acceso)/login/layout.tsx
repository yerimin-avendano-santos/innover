import type { Metadata } from 'next';

/**
 * El título de la pestaña: «Entrar · Innover».
 *
 * Este archivo existe por una limitación de Next, no por gusto: `metadata`
 * solo se puede exportar desde el servidor, y la página del login es una
 * página de cliente (`'use client'`, porque tiene estados y eventos). Un
 * layout de servidor que no dibuja nada —solo deja pasar a su hijo— es la
 * forma más corta de darle un título propio a la pantalla.
 *
 * Sin esto, la pestaña mostraría el título por defecto del producto
 * («Innover · Propiedades en el mapa») también en la pantalla de entrar,
 * que es lo que vería alguien con las dos abiertas.
 */
export const metadata: Metadata = {
  title: 'Entrar',
};

export default function LayoutLogin({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
