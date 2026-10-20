'use client';

// ========================================
// 🏠 CLIENTE DE PÁGINA PRINCIPAL
// ========================================
// Se ejecuta cuando el visitante tiene credenciales de sesión en cookies.
// Conecta el estado de autenticación y monta el Buscador interactivo.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Marca } from '@/components/Logo';
import { Buscador } from '@/components/Buscador';
import { useAuth } from '@/contextos/Auth';

export default function PrincipalCliente() {
  const { estaConectado, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (cargando || estaConectado) return;
    router.replace('/login?redirect=/');
  }, [cargando, estaConectado, router]);

  if (cargando || !estaConectado) return <Espera />;

  return <Buscador />;
}

function Espera() {
  return (
    <div className="superficie-clara flex h-[calc(100vh-3.5rem)] items-center justify-center bg-papel">
      <Marca className="animate-pulse text-tinta-30" />
    </div>
  );
}
