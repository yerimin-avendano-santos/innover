'use client';

// ========================================
// 📥 BANDEJA DE CONTACTOS (CRM)
// ========================================
// Esta pantalla es el producto B2B: el agente ve a quién le escribió,
// por qué propiedad, y lo mueve de "nuevo" a "en proceso" a "cerrado".
//
// Es la parte del negocio que se cobra. Ofrece vista de lista y vista
// de tablero Kanban con acciones directas de WhatsApp y teléfono.

import { useEffect, useState, useMemo } from 'react';
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
  const [vista, setVista] = useState<'lista' | 'kanban'>('lista');
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Redirección si no tiene sesión o no es agente.
   */
  useEffect(() => {
    if (!cargandoAuth && (!estaConectado || !esAgente)) {
      router.replace('/');
    }
  }, [estaConectado, esAgente, cargandoAuth, router]);

  useEffect(() => {
    if (!estaConectado || !esAgente) return;

    let vivo = true;

    // Si estamos en vista kanban, traemos todos para poder poblar las columnas
    const consulta = vista === 'kanban' || !filtro ? '' : `?estado=${filtro}`;

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
  }, [estaConectado, esAgente, filtro, vista]);

  // Filtrado en memoria por búsqueda de texto
  const leadsFiltrados = useMemo(() => {
    if (!terminoBusqueda.trim()) return leads;
    const termino = terminoBusqueda.toLowerCase();
    return leads.filter(
      (l) =>
        l.cliente.nombre.toLowerCase().includes(termino) ||
        l.propiedad.titulo.toLowerCase().includes(termino) ||
        l.mensaje.toLowerCase().includes(termino) ||
        (l.contacto.telefono && l.contacto.telefono.includes(termino))
    );
  }, [leads, terminoBusqueda]);

  if (cargandoAuth || (!estaConectado && !cargandoAuth)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="h-8 w-1/3 animate-pulse rounded-chico bg-papel-hundido" />
      </div>
    );
  }

  if (!esAgente) return null;

  const mover = async (id: number, estado: EstadoContacto) => {
    try {
      await api(`/api/contactos/${id}`, { metodo: 'PUT', cuerpo: { estado } });

      // Actualización optimista
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-titulo font-semibold text-tinta">Bandeja de Contactos (CRM)</h1>
          <p className="mt-1 text-cuerpo text-tinta-50">
            Gestiona cada consulta recibida sobre tus propiedades en Huánuco.
          </p>
        </div>

        {/* Alternador de Vista: Lista vs Tablero */}
        <div className="flex rounded-medio border border-linea bg-papel-alto p-1">
          <button
            type="button"
            onClick={() => setVista('lista')}
            className={`flex items-center gap-1.5 rounded-chico px-3 py-1.5 text-menor font-medium transition ${
              vista === 'lista'
                ? 'bg-tinta text-white'
                : 'text-tinta-70 hover:bg-papel-hundido'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Lista</span>
          </button>
          <button
            type="button"
            onClick={() => setVista('kanban')}
            className={`flex items-center gap-1.5 rounded-chico px-3 py-1.5 text-menor font-medium transition ${
              vista === 'kanban'
                ? 'bg-tinta text-white'
                : 'text-tinta-70 hover:bg-papel-hundido'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <span>Tablero</span>
          </button>
        </div>
      </header>

      {/* --- Métricas --- */}
      {metricas && (
        <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-medio border border-linea bg-linea sm:grid-cols-4">
          <Metrica etiqueta="Total contactos" valor={metricas.total} destacado />
          <Metrica etiqueta="Sin atender" valor={metricas.resumen.NUEVO} />
          <Metrica etiqueta="Cerrados" valor={metricas.resumen.CERRADO} />
          <Metrica etiqueta="Tasa de cierre" valor={`${metricas.tasa_cierre_porcentaje}%`} />
        </dl>
      )}

      {/* --- Barra de herramientas: Búsqueda y Pestañas --- */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {vista === 'lista' ? (
          <div className="sin-barra flex gap-1 overflow-x-auto">
            <FiltroPestana
              etiqueta="Todos"
              activo={filtro === ''}
              onClick={() => setFiltro('')}
            />
            {FLUJO.map((estado) => (
              <FiltroPestana
                key={estado}
                etiqueta={`${nombreEstado(estado)}${metricas ? ` (${metricas.resumen[estado]})` : ''}`}
                activo={filtro === estado}
                onClick={() => setFiltro(estado)}
              />
            ))}
          </div>
        ) : (
          <p className="text-menor font-medium text-tinta-50">
            Columnas por etapa de atención:
          </p>
        )}

        <div className="w-full sm:w-72">
          <input
            type="search"
            placeholder="Buscar por cliente o propiedad..."
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
            className="campo py-1.5 text-menor text-tinta"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-medio border border-alerta bg-alerta-suave px-4 py-3 text-cuerpo text-alerta">
          {error}
        </div>
      )}

      {/* --- Contenido: Lista o Tablero --- */}
      {cargando ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-medio bg-papel-hundido" />
          ))}
        </div>
      ) : vista === 'kanban' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FLUJO.map((colEstado) => {
            const leadsEnColumna = leadsFiltrados.filter((l) => l.estado === colEstado);
            return (
              <div key={colEstado} className="flex flex-col rounded-grande border border-linea bg-papel p-3">
                <div className="mb-3 flex items-center justify-between border-b border-linea pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`distintivo ${tonoEstado(colEstado)}`}>
                      {nombreEstado(colEstado)}
                    </span>
                  </div>
                  <span className="cifra text-menor font-semibold text-tinta-50">
                    {leadsEnColumna.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {leadsEnColumna.length === 0 ? (
                    <div className="rounded-medio border border-dashed border-linea py-6 text-center text-micro text-tinta-50">
                      Sin prospectos
                    </div>
                  ) : (
                    leadsEnColumna.map((lead) => (
                      <TarjetaLead
                        key={lead.id}
                        lead={lead}
                        mover={mover}
                        modo="kanban"
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : leadsFiltrados.length === 0 ? (
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
          {leadsFiltrados.map((lead) => (
            <li key={lead.id}>
              <TarjetaLead
                lead={lead}
                mover={mover}
                modo="lista"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaLead({
  lead,
  mover,
  modo,
}: {
  lead: RespuestaLead;
  mover: (id: number, estado: EstadoContacto) => void;
  modo: 'lista' | 'kanban';
}) {
  const telefonoLimpio = lead.contacto.telefono
    ? lead.contacto.telefono.replace(/[^0-9]/g, '')
    : null;
  const whatsappUrl = telefonoLimpio
    ? `https://wa.me/${telefonoLimpio.startsWith('51') ? telefonoLimpio : `51${telefonoLimpio}`}?text=${encodeURIComponent(
        `Hola ${lead.cliente.nombre}, te contacto desde Innover respecto a tu consulta sobre "${lead.propiedad.titulo}". ¿En qué horario podemos conversar?`
      )}`
    : null;

  return (
    <div className="rounded-medio border border-linea bg-papel-alto p-4 shadow-xs">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-tinta">{lead.cliente.nombre}</p>
          <p className="text-micro text-tinta-50">
            {tiempoRelativo(lead.fecha_creacion)}
          </p>
        </div>
        {modo === 'lista' && (
          <span className={`distintivo ${tonoEstado(lead.estado)}`}>
            {nombreEstado(lead.estado)}
          </span>
        )}
      </div>

      <blockquote className="mb-3 border-l-2 border-linea pl-3 text-menor text-tinta-70">
        {lead.mensaje}
      </blockquote>

      <div className="mb-3 text-micro text-tinta-50">
        <Link
          href={`/propiedad/${lead.propiedad.slug}`}
          className="font-medium hover:text-senal hover:underline"
        >
          {lead.propiedad.titulo}
        </Link>
        <span className="cifra">
          {' · '}
          {formatearPrecio(lead.propiedad.precio, lead.propiedad.moneda)}
        </span>
      </div>

      {/* Acciones directas de comunicación: WhatsApp, Teléfono, Correo */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[#E8F8EE] px-2.5 py-1 text-micro font-medium text-[#1B6F39] transition hover:bg-[#D5F2E0]"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.146-.532-1.859-.773-3.045-2.673-3.138-2.796-.092-.124-.755-.999-.755-1.906 0-.907.478-1.354.648-1.538.17-.184.372-.23.497-.23.125 0 .248.001.356.006.113.006.265-.043.414.316.155.375.529 1.289.576 1.382.047.094.078.204.016.328-.063.125-.094.204-.188.312-.093.109-.196.243-.28.326-.094.093-.192.195-.083.382.109.187.485.801 1.042 1.296.718.638 1.324.836 1.512.929.188.094.298.079.408-.047.109-.125.469-.546.594-.733.125-.188.25-.157.422-.094.172.063 1.093.516 1.281.609.187.094.312.141.359.219.047.078.047.452-.097.857z" />
            </svg>
            <span>WhatsApp</span>
          </a>
        )}
        {lead.contacto.telefono && (
          <a
            href={`tel:${lead.contacto.telefono}`}
            className="inline-flex items-center gap-1 rounded-full bg-papel px-2.5 py-1 text-micro font-medium text-tinta hover:bg-linea"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{lead.contacto.telefono}</span>
          </a>
        )}
        {lead.contacto.email && (
          <a
            href={`mailto:${lead.contacto.email}`}
            className="inline-flex items-center gap-1 rounded-full bg-papel px-2.5 py-1 text-micro font-medium text-tinta hover:bg-linea"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Email</span>
          </a>
        )}
      </div>

      {/* Botones de cambio de estado */}
      <div className="flex flex-wrap items-center gap-1 border-t border-linea pt-2.5">
        <span className="text-micro text-tinta-50">Mover a:</span>
        {FLUJO.filter((e) => e !== lead.estado).map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={() => mover(lead.id, estado)}
            className="btn btn-fantasma py-0.5 text-micro"
          >
            {nombreEstado(estado)}
          </button>
        ))}
      </div>
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
