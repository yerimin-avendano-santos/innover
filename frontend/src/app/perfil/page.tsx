'use client';

// ========================================
// 👤 MI PERFIL
// ========================================
// Dos cosas: ver el perfil y administrar tus propias publicaciones.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contextos/Auth';
import { api, formatearPrecio, tiempoRelativo } from '@/lib/api';
import type { MiPerfil, Propiedad } from '@/lib/tipos';
import type { EstadoPropiedad } from '@/lib/tipos';

export default function PaginaPerfil() {
  const { estaConectado, cargando: cargandoAuth, refrescar } = useAuth();
  const router = useRouter();

  const [perfil, setPerfil] = useState<MiPerfil | null>(null);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!cargandoAuth && !estaConectado) {
      router.replace('/login?redirect=/perfil');
    }
  }, [estaConectado, cargandoAuth, router]);

  useEffect(() => {
    if (!estaConectado) return;

    let vivo = true;

    Promise.all([
      api<MiPerfil>('/api/auth/perfil').then((p) => {
        if (vivo) setPerfil(p);
      }),
      api<{ datos: (Propiedad & { leads: number })[] }>('/api/propiedades/mias').then(
        (r) => {
          if (vivo) setPropiedades(r.datos);
        }
      ),
    ])
      .catch(() => {
        // El navbar ya avisa si algo falla. Aquí no hace falta otro error.
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [estaConectado, refrescar]);

  if (cargandoAuth || cargando || !estaConectado) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="h-8 w-1/3 animate-pulse rounded-chico bg-papel-hundido" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-titulo font-semibold text-tinta">
            {perfil?.nombre ?? 'Mi perfil'}
          </h1>
          <p className="mt-1 text-cuerpo text-tinta-50">{perfil?.email}</p>
        </div>

        <Link href="/publicar" className="btn btn-principal">
          Publicar propiedad
        </Link>
      </header>

      {/* --- Números --- */}
      <dl className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-medio border border-linea bg-linea sm:grid-cols-4">
        <Metrica etiqueta="Publicaciones" valor={propiedades.length} />
        <Metrica
          etiqueta="Publicadas"
          valor={propiedades.filter((p) => p.estado === 'PUBLICADA').length}
        />
        <Metrica
          etiqueta="Leads recibidos"
          valor={perfil?.resumen.leads_recibidos ?? 0}
        />
        <Metrica etiqueta="Rol" valor={etiquetaRol(perfil?.rol)} />
      </dl>

      {/* --- Publicaciones --- */}
      <section>
        <h2 className="mb-3 text-grande font-semibold text-tinta">
          Mis publicaciones
        </h2>

        {propiedades.length === 0 ? (
          <div className="rounded-grande border border-dashed border-linea-fuerte px-6 py-12 text-center">
            <p className="text-cuerpo font-medium text-tinta">
              Todavía no publicaste nada
            </p>
            <p className="mx-auto mt-1 max-w-xs text-menor text-tinta-50">
              Tu propiedad aparecerá en el mapa para que la vean compradores
              y agentes.
            </p>
            <Link href="/publicar" className="btn btn-principal mt-5">
              Publicar la primera
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-linea border-y border-linea">
            {propiedades.map((propiedad) => (
              <li key={propiedad.id} className="flex flex-wrap items-center gap-4 py-4">
                <div className="min-w-[200px] flex-1">
                  <Link
                    href={`/propiedad/${propiedad.slug}`}
                    className="font-medium text-tinta hover:text-senal hover:underline"
                  >
                    {propiedad.titulo}
                  </Link>
                  <p className="cifra mt-0.5 text-menor text-tinta-50">
                    {formatearPrecio(propiedad.precio, propiedad.moneda)}
                    {' · '}
                    {tiempoRelativo(propiedad.fecha_creacion)}
                  </p>
                </div>

                <span className={`distintivo ${tonoEstado(propiedad.estado)}`}>
                  {etiquetaEstado(propiedad.estado)}
                </span>

                {'leads' in propiedad && (
                  <span className="text-menor text-tinta-50">
                    {(propiedad as { leads: number }).leads}{' '}
                    {(propiedad as { leads: number }).leads === 1 ? 'lead' : 'leads'}
                  </span>
                )}

                <Link
                  href={`/publicar/${propiedad.id}`}
                  className="btn btn-fantasma text-menor"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="bg-papel-alto px-4 py-3">
      <dt className="text-micro text-tinta-50">{etiqueta}</dt>
      <dd className="cifra mt-0.5 text-grande font-medium text-tinta">{valor}</dd>
    </div>
  );
}

function etiquetaEstado(estado: EstadoPropiedad): string {
  const etiquetas: Record<EstadoPropiedad, string> = {
    BORRADOR: 'Borrador',
    PUBLICADA: 'Publicada',
    VENDIDA: 'Vendida',
    ALQUILADA: 'Alquilada',
    RETIRADA: 'Retirada',
  };
  return etiquetas[estado];
}

/** Un borrador es neutro; lo visible usa el color de señal. */
function tonoEstado(estado: EstadoPropiedad): string {
  return estado === 'PUBLICADA' ? 'distintivo-senal' : 'distintivo-neutro';
}

function etiquetaRol(rol?: string): string {
  const etiquetas: Record<string, string> = {
    CLIENTE: 'Comprador',
    PROPIETARIO: 'Propietario',
    AGENTE: 'Agente',
    ADMIN: 'Admin',
  };
  return rol ? etiquetas[rol] ?? rol : '—';
}
