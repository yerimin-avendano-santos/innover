'use client';

// ========================================
// 🧾 COLA DE SOLICITUDES DE AGENTE (solo ADMIN)
// ========================================
//
// 📌 POR QUÉ ESTA COLA VA ARRIBA DEL PANEL Y NO AL FINAL
//
// Porque es una persona esperando. La lista de usuarios es un catálogo —se
// consulta, se filtra, se busca cuando hace falta— mientras que una solicitud
// pendiente es una tarea con dueño y con fecha: alguien mandó su documento y
// está parado hasta que alguien lo mire. Lo que espera va arriba.
//
// Aprobar es la única vía legítima para llegar a AGENTE (el registro nunca da
// ese rol). Por eso resolver una solicitud cambia el rol de una cuenta, y por
// eso el panel recarga su lista después: el mismo usuario que estaba abajo como
// CLIENTE ahora es AGENTE, y dejarlo pintado como estaba sería mentir.
//
// ⛔ Rechazar EXIGE motivo, y no es una cortesía del formulario: el backend lo
// valida. Sin motivo, quien lo recibió no sabe qué corregir —vuelve a mandar
// exactamente lo mismo y lo vuelven a rechazar— y la cola se llena de intentos
// idénticos. El motivo es parte del dato.

import { useEffect, useState } from 'react';
import { api, ErrorPeticion, tiempoRelativo } from '@/lib/api';
import type { EstadoSolicitud, SolicitudAgente } from '@/lib/tipos';

/** Las tres pestañas. `PENDIENTE` primero: es el trabajo. */
const PESTANAS: { estado: EstadoSolicitud; etiqueta: string }[] = [
  { estado: 'PENDIENTE', etiqueta: 'Pendientes' },
  { estado: 'APROBADA', etiqueta: 'Aprobadas' },
  { estado: 'RECHAZADA', etiqueta: 'Rechazadas' },
];

export default function ColaSolicitudes({ onResuelta }: { onResuelta?: () => void }) {
  const [pestana, setPestana] = useState<EstadoSolicitud>('PENDIENTE');
  const [solicitudes, setSolicitudes] = useState<SolicitudAgente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** La solicitud cuyo rechazo se está redactando (solo una a la vez). */
  const [rechazando, setRechazando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupada, setOcupada] = useState<number | null>(null);

  /**
   * Sube para volver a pedir la lista sin cambiar de pestaña. Es el "otra vez"
   * de cuando la petición falló.
   */
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;

    api<{ datos: SolicitudAgente[] }>(`/api/solicitudes?estado=${pestana}`)
      .then((r) => {
        if (!vivo) return;
        setSolicitudes(r.datos);
        setError(null);
      })
      .catch((e) => {
        if (!vivo) return;
        setError(
          e instanceof ErrorPeticion ? e.message : 'No pudimos cargar las solicitudes.'
        );
      })
      .finally(() => {
        // `vivo` evita el clásico "estado actualizado tras desmontar": si esto
        // ya no está en pantalla, el resultado de la petición no interesa.
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [pestana, intento]);

  /**
   * Cambiar de pestaña limpia la lista a mano, y no es un detalle: los datos de
   * la pestaña anterior siguen en memoria, así que sin vaciarla se verían las
   * solicitudes aprobadas bajo el encabezado "Pendientes" mientras llega la
   * respuesta. El momento en que una pantalla miente es el que nadie recuerda
   * haber visto.
   */
  const cambiarPestana = (estado: EstadoSolicitud) => {
    if (estado === pestana) return;
    setPestana(estado);
    setSolicitudes([]);
    setCargando(true);
    setError(null);
  };

  const reintentar = () => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  };

  const resolver = async (id: number, estado: 'APROBADA' | 'RECHAZADA', texto?: string) => {
    setOcupada(id);
    setError(null);

    try {
      await api(`/api/solicitudes/${id}`, {
        metodo: 'PATCH',
        cuerpo: { estado, ...(texto && { motivo_rechazo: texto }) },
      });

      // Se quita de la lista en vez de recargarla: en la pestaña de pendientes
      // ya no pertenece aquí, y en las otras dos el historial no mejora por
      // volver a pedirlo. El aviso de qué pasó lo da el panel.
      setSolicitudes((actuales) => actuales.filter((s) => s.id !== id));
      setRechazando(null);
      setMotivo('');
      onResuelta?.();
    } catch (e) {
      setError(
        e instanceof ErrorPeticion ? e.message : 'No se pudo resolver la solicitud.'
      );
    } finally {
      setOcupada(null);
    }
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-grande font-semibold text-tinta">Solicitudes de agente</h2>

        <div className="sin-barra flex gap-1 overflow-x-auto">
          {PESTANAS.map((p) => (
            <button
              key={p.estado}
              type="button"
              onClick={() => cambiarPestana(p.estado)}
              aria-pressed={pestana === p.estado}
              className={`shrink-0 rounded-medio px-3 py-1.5 text-menor transition-colors ${
                pestana === p.estado
                  ? 'bg-tinta text-white'
                  : 'bg-papel-alto text-tinta-70 hover:bg-papel-hundido'
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-medio border border-alerta bg-alerta-suave px-4 py-3 text-cuerpo text-alerta"
        >
          <p>{error}</p>
          <button type="button" onClick={reintentar} className="btn btn-secundario mt-2 text-menor">
            Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <div className="h-24 animate-pulse rounded-medio bg-papel-hundido" />
      ) : solicitudes.length === 0 ? (
        <div className="rounded-grande border border-dashed border-linea-fuerte px-6 py-8 text-center">
          <p className="text-cuerpo font-medium text-tinta">
            {pestana === 'PENDIENTE'
              ? 'No hay nadie esperando'
              : 'Todavía no hay solicitudes aquí'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-menor text-tinta-50">
            {pestana === 'PENDIENTE'
              ? 'Cuando alguien pida ser agente, su documento aparecerá aquí para que lo revises.'
              : 'Las solicitudes resueltas se guardan con quién las resolvió y por qué.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((s) => {
            const abierta = rechazando === s.id;

            return (
              <li
                key={s.id}
                className={`rounded-medio border bg-papel-alto p-4 ${
                  s.estado === 'PENDIENTE' ? 'border-aviso' : 'border-linea'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[220px] flex-1">
                    <p className="font-medium text-tinta">
                      {s.usuario?.nombre ?? `Usuario #${s.usuario_id}`}
                    </p>
                    <p className="text-menor text-tinta-50">
                      <span className="break-all">{s.usuario?.email}</span>
                      {s.usuario?.telefono && <> · {s.usuario.telefono}</>}
                    </p>

                    {/* El documento es lo único que se viene a revisar, así que
                        va destacado y en monoespaciada: los DNI se leen mejor
                        así y es más difícil confundir un dígito. */}
                    <p className="cifra mt-2 text-normal font-medium text-tinta">
                      {s.documento}
                    </p>

                    {s.usuario?.identidad_verificada && (
                      <span className="distintivo distintivo-senal mt-2">
                        Identidad ya verificada
                      </span>
                    )}

                    {s.mensaje && (
                      <blockquote className="mt-2 border-l-2 border-linea pl-3 text-menor text-tinta-70">
                        {s.mensaje}
                      </blockquote>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-micro text-tinta-50">
                      {tiempoRelativo(s.fecha_creacion)}
                    </span>

                    {s.estado === 'PENDIENTE' ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          disabled={ocupada === s.id}
                          onClick={() => void resolver(s.id, 'APROBADA')}
                          className="btn btn-principal text-menor"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={ocupada === s.id}
                          onClick={() => {
                            setRechazando(abierta ? null : s.id);
                            setMotivo('');
                          }}
                          className="btn btn-secundario text-menor"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span
                          className={`distintivo ${
                            s.estado === 'APROBADA' ? 'distintivo-senal' : 'distintivo-neutro'
                          }`}
                        >
                          {s.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada'}
                        </span>
                        {s.revisor && (
                          <p className="mt-1 text-micro text-tinta-50">
                            por {s.revisor.nombre}
                            {s.fecha_resolucion && ` · ${tiempoRelativo(s.fecha_resolucion)}`}
                          </p>
                        )}
                        {s.motivo_rechazo && (
                          <p className="mt-1 max-w-xs text-micro text-tinta-70">
                            {s.motivo_rechazo}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* El motivo se escribe aquí y no en un `prompt()`: hay que
                    poder releerlo antes de mandarlo, y el texto es lo que va a
                    leer un desconocido. */}
                {abierta && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void resolver(s.id, 'RECHAZADA', motivo.trim());
                    }}
                    className="mt-3 border-t border-linea pt-3"
                  >
                    <label htmlFor={`motivo-${s.id}`} className="etiqueta">
                      ¿Por qué se rechaza?
                    </label>
                    <textarea
                      id={`motivo-${s.id}`}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      maxLength={500}
                      rows={2}
                      required
                      placeholder="Lo que tiene que corregir para que la próxima vez salga bien."
                      className="campo w-full resize-y"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={ocupada === s.id || !motivo.trim()}
                        className="btn btn-principal text-menor"
                      >
                        {ocupada === s.id ? 'Rechazando…' : 'Confirmar rechazo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRechazando(null)}
                        className="btn btn-fantasma text-menor"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
