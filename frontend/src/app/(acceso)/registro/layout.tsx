import type { Metadata } from 'next';

/**
 * El título de la pestaña: «Crear cuenta · Innover».
 *
 * Ver el comentario de `../login/layout.tsx`: el motivo de que esto sea un
 * layout y no un `export const metadata` en la página es que la página es
 * de cliente y `metadata` solo se exporta desde el servidor.
 */
export const metadata: Metadata = {
  title: 'Crear cuenta',
};

export default function LayoutRegistro({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
