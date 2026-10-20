'use client';

// ========================================
// 👤 MI PERFIL
// ========================================
// Dos cosas: ver el perfil y administrar tus propias publicaciones.

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contextos/Auth';
import { api, formatearPrecio, tiempoRelativo } from '@/lib/api';
import PanelSolicitudAgente from '@/components/PanelSolicitudAgente';
import type { MiPerfil, Propiedad, EstadoPropiedad } from '@/lib/tipos';

const FECHA_PLAN = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default function PaginaPerfil() {
  const { estaConectado, cargando: cargandoAuth, refrescar } = useAuth();
  const router = useRouter();

  const [perfil, setPerfil] = useState<MiPerfil | null>(null);
  const [propiedades, setPropiedades] = useState<(Propiedad & { leads: number })[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<'TODAS' | 'PUBLICADA' | 'BORRADOR'>('TODAS');
  const [busqueda, setBusqueda] = useState('');
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
        // El navbar ya avisa si algo falla.
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [estaConectado, refrescar]);

  // Filtrado de mis publicaciones
  const propiedadesFiltradas = useMemo(() => {
    return propiedades.filter((p) => {
      const coincideEstado =
        filtroEstado === 'TODAS' || p.estado === filtroEstado;
      const coincideTexto =
        !busqueda.trim() ||
        p.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.direccion && p.direccion.toLowerCase().includes(busqueda.toLowerCase()));
      return coincideEstado && coincideTexto;
    });
  }, [propiedades, filtroEstado, busqueda]);

  if (cargandoAuth || cargando || !estaConectado) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="h-8 w-1/3 animate-pulse rounded-chico bg-papel-hundido" />
      </div>
    );
  }

  const publicadasCount = propiedades.filter((p) => p.estado === 'PUBLICADA').length;
  const borradoresCount = propiedades.filter((p) => p.estado === 'BORRADOR').length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-titulo font-semibold text-tinta">
              {perfil?.nombre ?? 'Mi perfil'}
            </h1>
            {perfil?.identidad_verificada && (
              <span className="distintivo distintivo-senal">Identidad verificada</span>
            )}
          </div>
          <p className="mt-1 text-cuerpo text-tinta-50">{perfil?.email}</p>
        </div>

        <Link href="/publicar" className="btn btn-principal">
          Publicar propiedad
        </Link>
      </header>

      {/* --- Métricas / Resumen --- */}
      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-medio border border-linea bg-linea sm:grid-cols-4">
        <Metrica etiqueta="Publicaciones" valor={propiedades.length} />
        <Metrica etiqueta="Publicadas" valor={publicadasCount} />
        <Metrica
          etiqueta="Leads recibidos"
          valor={perfil?.resumen.leads_recibidos ?? 0}
        />
        <Metrica etiqueta="Rol" valor={etiquetaRol(perfil?.rol)} />
      </dl>

      {/* --- Estado del Plan Comercial --- */}
      <div className="mb-8 rounded-grande border border-linea bg-papel-alto p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-micro font-medium uppercase tracking-wider text-tinta-50">
                Plan de suscripción
              </span>
              <span
                className={`distintivo ${
                  perfil?.plan_pro_activo
                    ? 'distintivo-destacado-solido'
                    : 'distintivo-neutro'
                }`}
              >
                {perfil?.plan === 'PRO' ? 'Plan PRO' : 'Plan Estándar'}
              </span>
            </div>
            <p className="mt-1 text-menor text-tinta-70">
              {perfil?.plan_pro_activo
                ? perfil.plan_vence
                  ? `Vigente hasta el ${FECHA_PLAN.format(new Date(perfil.plan_vence))}`
                  : 'Suscripción PRO permanente activa'
                : 'Plan gratuito. Permite publicar inmuebles y recibir contactos directos.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-micro text-tinta-50">
            <span className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${perfil?.plan_pro_activo ? 'bg-turquesa' : 'bg-linea-fuerte'}`} />
              Tours 3D {perfil?.plan_pro_activo ? 'habilitados' : 'requiere PRO'}
            </span>
            <span className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${perfil?.plan_pro_activo ? 'bg-destacado' : 'bg-linea-fuerte'}`} />
              Destaques {perfil?.plan_pro_activo ? 'incluidos' : 'requiere PRO'}
            </span>
          </div>
        </div>
      </div>

      {/* --- Pedir ser agente --- */}
      <PanelSolicitudAgente rol={perfil?.rol} />

      {/* --- Publicaciones --- */}
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-grande font-semibold text-tinta">
            Mis publicaciones
          </h2>

          <div className="w-full sm:w-64">
            <input
              type="search"
              placeholder="Buscar en mis publicaciones..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="campo py-1.5 text-menor text-tinta"
            />
          </div>
        </div>

        {/* Pestañas de filtrado rápido */}
        <div className="sin-barra mb-4 flex gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFiltroEstado('TODAS')}
            className={`rounded-medio px-3 py-1.5 text-menor font-medium transition ${
              filtroEstado === 'TODAS'
                ? 'bg-tinta text-white'
                : 'bg-papel-alto text-tinta-70 hover:bg-papel-hundido'
            }`}
          >
            Todas ({propiedades.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('PUBLICADA')}
            className={`rounded-medio px-3 py-1.5 text-menor font-medium transition ${
              filtroEstado === 'PUBLICADA'
                ? 'bg-tinta text-white'
                : 'bg-papel-alto text-tinta-70 hover:bg-papel-hundido'
            }`}
          >
            Publicadas ({publicadasCount})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('BORRADOR')}
            className={`rounded-medio px-3 py-1.5 text-menor font-medium transition ${
              filtroEstado === 'BORRADOR'
                ? 'bg-tinta text-white'
                : 'bg-papel-alto text-tinta-70 hover:bg-papel-hundido'
            }`}
          >
            Borradores ({borradoresCount})
          </button>
        </div>

        {propiedadesFiltradas.length === 0 ? (
          <div className="rounded-grande border border-dashed border-linea-fuerte px-6 py-12 text-center">
            <p className="text-cuerpo font-medium text-tinta">
              {propiedades.length === 0
                ? 'Todavía no publicaste nada'
                : 'No se encontraron publicaciones con los filtros aplicados'}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-menor text-tinta-50">
              {propiedades.length === 0
                ? 'Tu propiedad aparecerá en el mapa para que la vean compradores y agentes.'
                : 'Prueba cambiando el término de búsqueda o la pestaña seleccionada.'}
            </p>
            {propiedades.length === 0 && (
              <Link href="/publicar" className="btn btn-principal mt-5">
                Publicar la primera
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-linea rounded-grande border border-linea bg-papel-alto">
            {propiedadesFiltradas.map((propiedad) => (
              <li
                key={propiedad.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4 transition hover:bg-papel/50"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/propiedad/${propiedad.slug}`}
                      className="font-semibold text-tinta hover:text-senal hover:underline"
                    >
                      {propiedad.titulo}
                    </Link>
                    {propiedad.destacado && (
                      <span className="distintivo distintivo-destacado-solido">
                        Destacado
                      </span>
                    )}
                  </div>
                  <p className="cifra mt-1 text-menor text-tinta-50">
                    {formatearPrecio(propiedad.precio, propiedad.moneda)}
                    {propiedad.direccion && ` · ${propiedad.direccion}`}
                    {' · '}
                    {tiempoRelativo(propiedad.fecha_creacion)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`distintivo ${tonoEstado(propiedad.estado)}`}>
                    {etiquetaEstado(propiedad.estado)}
                  </span>

                  {'leads' in propiedad && (
                    <span className="cifra text-menor text-tinta-50">
                      {(propiedad as { leads: number }).leads}{' '}
                      {(propiedad as { leads: number }).leads === 1 ? 'contacto' : 'contactos'}
                    </span>
                  )}

                  <Link
                    href={`/publicar/${propiedad.id}`}
                    className="btn btn-secundario text-menor"
                  >
                    Editar
                  </Link>
                </div>
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
