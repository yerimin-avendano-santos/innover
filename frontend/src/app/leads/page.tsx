'use client';

// ========================================
// 📥 BANDEJA DE CONTACTOS (CRM)
// ========================================
// Esta pantalla es el producto B2B: el agente ve a quién le escribió,
// por qué propiedad, y lo mueve de "nuevo" a "en proceso" a "cerrado".
//
// Es la parte del negocio que se cobra. Por eso la métrica que domina
// la pantalla es una sola: cuántos leads nuevos hay sin atender.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contextos/Auth';
import { api, ErrorPeticion, formatearPrecio, tiempoRelativo } from '@/lib/api';
import type { EstadisticasCRM, EstadoContacto, RespuestaLead } from '@/lib/tipos';

/** Orden en el que se procesa un lead. */
const FLUJO: EstadoContacto[] = ['NUEVO', 'EN_PROCESO', 'CERRADO', 'DESCARTADO'];

export default function PaginaLeads() {
  const { estaConectado, esAgente, cargando: cargandoAuth } = useAuth();
  const router = useRouter();

  const [leads, setLeads] = useState<RespuestaLead[]>([]);
  const [metricas, setMetricas] = useState<EstadisticasCRM | null>(null);
  const [filtro, setFiltro] = useState<EstadoContacto | ''>('NUEVO');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Redirección si no tiene sesión o no es agente.
   *
   * 📌 El replace() va dentro del efecto a propósito: redirigir ES la
   * sincronización con la URL. Si el usuario no tiene sesión,
   * mostrarle la pantalla un instante antes de echarlo produce un
   * parpadeo feo.
   */
  useEffect(() => {
    if (!cargandoAuth && (!estaConectado || !esAgente)) {
      router.replace('/');
    }
  }, [estaConectado, esAgente, cargandoAuth, router]);

  useEffect(() => {
    if (!estaConectado || !esAgente) return;

    let vivo = true;

    const consulta = filtro ? `?estado=${filtro}` : '';

    Promise.all([
      api<{ datos: RespuestaLead[] }>(`/api/contactos/mis-leads${consulta}`).then(
        (r) => {
          if (vivo) setLeads(r.datos);
        }
      ),
      api<EstadisticasCRM>('/api/contactos/estadisticas').then((m) => {
        if (vivo) setMetricas(m);
      }),
    ])
      .catch((e) => {
        if (!vivo) return;
        setError(e instanceof ErrorPeticion ? e.message : 'No pudimos cargar los contactos.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [estaConectado, esAgente, filtro]);

  if (cargandoAuth || (!estaConectado && !cargandoAuth)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="h-8 w-1/3 animate-pulse rounded-chico bg-papel-hundido" />
      </div>
    );
  }

  if (!esAgente) return null;

  const mover = async (id: number, estado: EstadoContacto) => {
    try {
      await api(`/api/contactos/${id}`, { metodo: 'PUT', cuerpo: { estado } });

      // Actualización optimista: la interfaz responde al instante y si
      // la petición falla, el error se muestra arriba. La alternativa
      // (recargar todo) hace que cambiar un estado parpadee la página.
      setLeads((actuales) =>
        actuales.map((l) => (l.id === id ? { ...l, estado } : l))
      );

      const resumen = metricas?.resumen;
      if (resumen) {
        setMetricas({ ...metricas, resumen: { ...resumen } });
      }
    } catch (e) {
      setError(e instanceof ErrorPeticion ? e.message : 'No pudimos actualizar.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-titulo font-semibold text-tinta">Contactos recibidos</h1>
        <p className="mt-1 text-cuerpo text-tinta-50">
          Cada persona que escribió sobre una de tus propiedades.
        </p>
      </header>

      {/* --- Métricas --- */}
      {metricas && (
        <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-medio border border-linea bg-linea sm:grid-cols-4">
          <Metrica etiqueta="Total" valor={metricas.total} destacado />
          <Metrica etiqueta="Sin atender" valor={metricas.resumen.NUEVO} />
          <Metrica etiqueta="Cerrados" valor={metricas.resumen.CERRADO} />
          <Metrica etiqueta="Tasa de cierre" valor={`${metricas.tasa_cierre_porcentaje}%`} />
        </dl>
      )}

      {/* --- Filtro por estado --- */}
      <div className="sin-barra mb-4 flex gap-1 overflow-x-auto">
        <FiltroPestana
          etiqueta="Todos"
          activo={filtro === ''}
          onClick={() => setFiltro('')}
        />
        {FLUJO.map((estado) => (
          <FiltroPestana
            key={estado}
            etiqueta={`${nombreEstado(estado)}${metricas ? ` ${metricas.resumen[estado]}` : ''}`}
            activo={filtro === estado}
            onClick={() => setFiltro(estado)}
          />
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-medio border border-alerta bg-alerta-suave px-4 py-3 text-cuerpo text-alerta">
          {error}
        </div>
      )}

      {/* --- Lista --- */}
      {cargando ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-medio bg-papel-hundido" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-grande border border-dashed border-linea-fuerte px-6 py-12 text-center">
          <p className="text-cuerpo font-medium text-tinta">
            {filtro === 'NUEVO' ? 'No tienes contactos sin atender' : 'No hay contactos aquí'}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-menor text-tinta-50">
            Cuando alguien escriba sobre una de tus propiedades, aparecerá
            en esta lista con su teléfono y correo.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => (
            <li key={lead.id} className="rounded-medio border border-linea bg-papel-alto p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-tinta">{lead.cliente.nombre}</p>
                  <p className="text-micro text-tinta-50">
                    {tiempoRelativo(lead.fecha_creacion)}
                  </p>
                </div>
                <span className={`distintivo ${tonoEstado(lead.estado)}`}>
                  {nombreEstado(lead.estado)}
                </span>
              </div>

              {/* El mensaje va entre comillas para que se lea como cita
                  y separe visualmente de los datos. */}
              <blockquote className="mb-3 border-l-2 border-linea pl-3 text-cuerpo text-tinta-70">
                {lead.mensaje}
              </blockquote>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-3">
                <div className="text-micro text-tinta-50">
                  <Link
                    href={`/propiedad/${lead.propiedad.slug}`}
                    className="hover:text-senal hover:underline"
                  >
                    {lead.propiedad.titulo}
                  </Link>
                  <span className="cifra">
                    {' · '}
                    {formatearPrecio(lead.propiedad.precio, lead.propiedad.moneda)}
                  </span>
                  {lead.contacto.telefono && (
                    <a
                      href={`tel:${lead.contacto.telefono}`}
                      className="ml-2 hover:text-senal hover:underline"
                    >
                      {lead.contacto.telefono}
                    </a>
                  )}
                </div>

                <div className="flex gap-1">
                  {FLUJO.filter((e) => e !== lead.estado).map((estado) => (
                    <button
                      key={estado}
                      type="button"
                      onClick={() => mover(lead.id, estado)}
                      className="btn btn-fantasma text-micro"
                    >
                      {nombreEstado(estado)}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metrica({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string | number;
  destacado?: boolean;
}) {
  return (
    <div className={`px-4 py-3 ${destacado ? 'bg-senal-suave' : 'bg-papel-alto'}`}>
      <dt className="text-micro text-tinta-50">{etiqueta}</dt>
      <dd className={`cifra mt-0.5 text-grande font-medium ${destacado ? 'text-senal-hondo' : 'text-tinta'}`}>
        {valor}
      </dd>
    </div>
  );
}

function FiltroPestana({
  etiqueta,
  activo,
  onClick,
}: {
  etiqueta: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`shrink-0 rounded-medio px-3 py-1.5 text-menor transition-colors ${
        activo
          ? 'bg-tinta text-white'
          : 'bg-papel-alto text-tinta-70 hover:bg-papel-hundido'
      }`}
    >
      {etiqueta}
    </button>
  );
}

function nombreEstado(estado: EstadoContacto): string {
  const nombres: Record<EstadoContacto, string> = {
    NUEVO: 'Nuevo',
    EN_PROCESO: 'En proceso',
    CERRADO: 'Cerrado',
    DESCARTADO: 'Descartado',
  };
  return nombres[estado];
}

function tonoEstado(estado: EstadoContacto): string {
  switch (estado) {
    case 'NUEVO':
      return 'distintivo-aviso';
    case 'CERRADO':
      return 'distintivo-senal';
    default:
      return 'distintivo-neutro';
  }
}
