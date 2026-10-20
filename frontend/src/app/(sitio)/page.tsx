// ========================================
// 🏠 PÁGINA PRINCIPAL · LA PUERTA DIRECTA
// ========================================
// Evalúa en el servidor si el visitante cuenta con cookies de sesión.
// Si no tiene credenciales, redirige de inmediato a /login sin renderizar
// pantallas en blanco ni parpadeos de interfaz.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PrincipalCliente from './PrincipalCliente';

export default async function PaginaPrincipal() {
  const jar = await cookies();
  const tienePase = jar.has('innover_token') || jar.has('innover_renovacion');

  if (!tienePase) {
    redirect('/login?redirect=/');
  }

  return <PrincipalCliente />;
}
