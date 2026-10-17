'use client';

// ========================================
// 🧾 PEDIR SER AGENTE (la mitad visible del trámite)
// ========================================
//
// 📌 POR QUÉ ESTA PANTALLA NO EXISTÍA, Y POR QUÉ HACÍA FALTA
//
// El camino de CLIENTE a AGENTE es el único que no se puede recorrer solo: el
// registro nunca da ese rol (a propósito) y solo un ADMIN lo aprueba. Toda la
// API llevaba tiempo hecha —hay cola, historial, auditoría de quién resolvió y
// pruebas de integración— pero no había ninguna pantalla. En la práctica eso
// significaba que ese camino no existía: nadie pide ser agente con un `curl`.
//
// 📌 Y LA SEGUNDA MITAD IMPORTA MÁS QUE LA PRIMERA
//
// Mandar la solicitud es lo fácil. Lo que deja a alguien colgado es la espera:
// sin esta pantalla, quien solicita no tiene forma de saber si le aprobaron, si
// le rechazaron ni por qué. Y un rechazo sin motivo visible es el peor caso
// —no sabe qué corregir, así que vuelve a mandar exactamente lo mismo y le
// vuelven a rechazar—. El backend guarda `motivo_rechazo` precisamente para que
// se lea aquí.
//
// ⛔ Y NO LLAMA A `POST` PARA SABER EL ESTADO. Para eso está `mi-solicitud`,
// que devuelve la última: pedirla es una lectura, y una lectura se puede
// repetir sin consecuencias.

import { useEffect, useState, type FormEvent } from 'react';
import { api, ErrorPeticion, tiempoRelativo } from '@/lib/api';
import type { RolUsuario, SolicitudAgente } from '@/lib/tipos';

export default function PanelSolicitudAgente({ rol }: { rol?: RolUsuario }) {
  const [solicitud, setSolicitud] = useState<SolicitudAgente | null>(null);
  const [cargando, setCargando] = useState(true);

  /** El formulario, cuando toca mostrarlo. Un rechazo lo abre a mano. */
  const [abierto, setAbierto] = useState(false);

  const [documento, setDocumento] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null);

  const yaEsAgente = rol === 'AGENTE' || rol === 'ADMIN';

  useEffect(() => {
    // Un agente no tiene nada que pedir: ni se pregunta. Aquí no se toca
    // `cargando` —eso sería un `setState` síncrono dentro de un efecto, que
    // provoca renderizados en cascada— y no hace falta: el render sale antes
    // por `yaEsAgente`.
    if (yaEsAgente) return;

    let vivo = true;

    api<{ solicitud: SolicitudAgente | null }>('/api/auth/mi-solicitud')
      .then((r) => {
        if (!vivo) return;
        setSolicitud(r.solicitud);
        // Si ya pidió una vez, el documento se rellena con el que presentó.
        // Casi siempre el rechazo es por otra cosa (un documento ilegible, un
        // RUC que falta) y volver a teclearlo desde cero es gratuito solo para
        // quien escribe el código.
        if (r.solicitud) setDocumento(r.solicitud.documento);
      })
      .catch(() => {
        // El navbar ya avisa de que algo no va. Aquí no hace falta repetirlo.
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [yaEsAgente]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setErrorDocumento(null);

    try {
      await api('/api/auth/solicitar-agente', {
        metodo: 'POST',
        cuerpo: {
          documento: documento.trim(),
          // El mensaje vacío no se manda: el esquema lo acepta, pero una
          // cadena vacía y "no escribió nada" son cosas distintas y la cola
          // del admin las pinta distinto.
          ...(mensaje.trim() && { mensaje: mensaje.trim() }),
        },
      });

      // Y en vez de reconstruir el estado a mano con lo que devolvió el POST,
      // se le pregunta al servidor cómo quedó. Es una petición más y ahorra una
      // copia de la verdad que se iría separando con el tiempo.
      const { solicitud: creada } = await api<{ solicitud: SolicitudAgente | null }>(
        '/api/auth/mi-solicitud'
      );
      setSolicitud(creada);
      setAbierto(false);
      setMensaje('');
    } catch (e) {
      if (e instanceof ErrorPeticion) {
        setErrorDocumento(e.mensajeDe('documento') ?? null);
        setError(e.message);

        // Dos pestañas abiertas: la otra ya la mandó. Recargamos para que se
        // vea el estado real en vez de dejar un error que ya no aplica.
        if (e.estado === 409) {
          const { solicitud: actual } = await api<{ solicitud: SolicitudAgente | null }>(
            '/api/auth/mi-solicitud'
          ).catch(() => ({ solicitud: null }));
          setSolicitud(actual);
        }
      } else {
        setError('No pudimos enviar la solicitud. Inténtalo de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  if (yaEsAgente) return null;

  if (cargando) {
    return (
      <section className="mt-10" aria-busy="true">
        <div className="h-28 animate-pulse rounded-grande bg-papel-hundido" />
      </section>
    );
  }

  // --- En revisión: no hay formulario, hay espera ---
  if (solicitud?.estado === 'PENDIENTE') {
    return (
      <section className="mt-10 rounded-grande border border-aviso bg-aviso-suave px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-normal font-semibold text-tinta">Solicitud enviada</h2>
          <span className="distintivo distintivo-aviso">En revisión</span>
        </div>
        <p className="mt-1 text-menor text-tinta-70">
          La mandaste {tiempoRelativo(solicitud.fecha_creacion)}. Un administrador la
          revisará y podrás ver aquí mismo la respuesta.
        </p>
        <p className="cifra mt-2 text-micro text-tinta-50">
          Documento presentado: {solicitud.documento}
        </p>
      </section>
    );
  }

  // --- Rechazada: el motivo es lo único que permite corregir ---
  if (solicitud?.estado === 'RECHAZADA') {
    return (
      <section className="mt-10 rounded-grande border border-alerta bg-alerta-suave px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-normal font-semibold text-alerta">Solicitud rechazada</h2>
          <span className="text-micro text-tinta-50">
            {tiempoRelativo(solicitud.fecha_resolucion ?? solicitud.fecha_creacion)}
            {solicitud.revisor && ` · la revisó ${solicitud.revisor.nombre}`}
          </span>
        </div>

        {solicitud.motivo_rechazo && (
          <p className="mt-2 text-menor text-tinta-70">{solicitud.motivo_rechazo}</p>
        )}

        {/* El botón solo abre el formulario. El rechazo NO impide volver a
            intentarlo —para eso está el motivo—, solo impide encolar dos a la
            vez, y eso lo comprueba el servidor. */}
        {!abierto ? (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="btn btn-secundario mt-3 text-menor"
          >
            Volver a solicitarlo
          </button>
        ) : null}

        {abierto && (
          <Formulario
            documento={documento}
            mensaje={mensaje}
            enviando={enviando}
            error={error}
            errorDocumento={errorDocumento}
            onDocumento={setDocumento}
            onMensaje={setMensaje}
            onSubmit={enviar}
            titulo="Corrige lo que haga falta y vuelve a enviarla"
          />
        )}
      </section>
    );
  }

  // --- Aprobada sin ser agente ---
  //
  // Es un estado raro pero posible: alguien aprobado al que después le bajaron
  // el rol. Sin esta salida, la pantalla no sabría qué pintar y mostraría el
  // formulario como si nunca hubiera pasado nada.
  if (solicitud?.estado === 'APROBADA') {
    return (
      <section className="mt-10 rounded-grande border border-linea bg-papel-alto px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-normal font-semibold text-tinta">Tu solicitud fue aprobada</h2>
          <span className="distintivo distintivo-senal">Aprobada</span>
        </div>
        <p className="mt-1 text-menor text-tinta-70">
          Tu cuenta pasó a ser de agente. Si tu rol no lo refleja, escribe a soporte.
        </p>
      </section>
    );
  }

  // --- Sin solicitud: la invitación y el formulario ---
  return (
    <section className="mt-10 rounded-grande border border-linea bg-papel-alto px-5 py-5">
      <h2 className="text-grande font-semibold text-tinta">¿Quieres ser agente?</h2>
      <p className="mt-1 max-w-xl text-menor text-tinta-70">
        Un agente publica propiedades de otras personas y recibe en su bandeja
        los contactos de quien pregunta. Para serlo hace falta un documento y
        que un administrador lo apruebe.
      </p>

      <Formulario
        documento={documento}
        mensaje={mensaje}
        enviando={enviando}
        error={error}
        errorDocumento={errorDocumento}
        onDocumento={setDocumento}
        onMensaje={setMensaje}
        onSubmit={enviar}
      />
    </section>
  );
}

/**
 * El formulario, que se usa en dos sitios: la primera vez y al reintentar
 * tras un rechazo. `titulo` es lo único que cambia.
 */
function Formulario({
  documento,
  mensaje,
  enviando,
  error,
  errorDocumento,
  onDocumento,
  onMensaje,
  onSubmit,
  titulo,
}: {
  documento: string;
  mensaje: string;
  enviando: boolean;
  error: string | null;
  errorDocumento: string | null;
  onDocumento: (v: string) => void;
  onMensaje: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  titulo?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-md">
      {titulo && <p className="mb-3 text-menor font-medium text-tinta">{titulo}</p>}

      {error && !errorDocumento && (
        <div
          role="alert"
          className="mb-3 rounded-medio border border-alerta bg-alerta-suave px-3 py-2 text-menor text-alerta"
        >
          {error}
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="documento" className="etiqueta">
          DNI o RUC
        </label>
        <input
          id="documento"
          type="text"
          value={documento}
          onChange={(e) => onDocumento(e.target.value)}
          placeholder="Ej. 71234567"
          autoComplete="off"
          aria-invalid={errorDocumento ? 'true' : undefined}
          aria-describedby={errorDocumento ? 'documento-error' : undefined}
          className="campo cifra w-full"
        />
        {errorDocumento ? (
          <p id="documento-error" className="mt-1 text-micro text-alerta">
            {errorDocumento}
          </p>
        ) : (
          <p className="mt-1 text-micro text-tinta-50">
            Es lo que te identifica ante un cliente. Lo revisa un administrador:
            no se muestra en tus propiedades.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="mensaje" className="etiqueta">
          ¿Por qué quieres ser agente?{' '}
          <span className="font-normal text-tinta-50">(opcional)</span>
        </label>
        <textarea
          id="mensaje"
          value={mensaje}
          onChange={(e) => onMensaje(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Tu experiencia, en qué zonas trabajas, si vienes con una cartera de clientes…"
          className="campo w-full resize-y"
        />
      </div>

      <button
        type="submit"
        disabled={enviando || documento.trim().length < 8}
        className="btn btn-principal"
      >
        {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}
