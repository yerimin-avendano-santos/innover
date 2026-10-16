'use client';

// ========================================
// 📄 FICHA DE UNA PROPIEDAD
// ========================================
// La página de detalle. Se accede por slug, no por id:
//     /propiedad/departamento-vista-al-mar-miraflores-1
//
// Un id numérico se puede adivinar recorriendo /propiedad/1, /2, /3.
// Un slug no, y de paso le dice al usuario de qué trata el enlace antes
// de abrirlo.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Mapa } from '@/components/Mapa';
import { api, ErrorPeticion, formatearPrecio, precioPorM2, etiquetaTipo } from '@/lib/api';
import { useAuth } from '@/contextos/Auth';
import type { Propiedad } from '@/lib/tipos';

export default function PaginaPropiedad() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { estaConectado, usuario } = useAuth();

  const [propiedad, setPropiedad] = useState<Propiedad | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Guardamos el slug que YA Terminó de cargar (con éxito o con error).
   *
   * `cargando` se DERIVA comparando con el slug actual:
   *
   *     cargando = slugTerminado !== slugActual
   *
   * Así, al navegar de una propiedad a otra, el esqueleto reaparece
   * solo por cambiar la URL. No hace falta un setCargando(true) dentro
   * del efecto, que es lo que provocaba el render de más y la advertencia
   * del linter.
   */
  const [slugTerminado, setSlugTerminado] = useState<string | null>(null);

  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorContacto, setErrorContacto] = useState<string | null>(null);

  const slug = params.slug;

  /**
   * Cargar la propiedad del slug actual.
   *
   * Los setState van DENTRO de los callbacks de la promesa, nunca en el
   * cuerpo del efecto. Así React solo repinta cuando hay algo nuevo que
   * mostrar, en vez de descartar un render y repetirlo.
   */
  useEffect(() => {
    let vivo = true;

    api<{ propiedad: Propiedad }>(`/api/propiedades/${slug}`)
      .then((r) => {
        if (!vivo) return;
        setPropiedad(r.propiedad);
        setError(null);
      })
      .catch((e) => {
        if (!vivo) return;
        setPropiedad(null);
        setError(
          e instanceof ErrorPeticion
            ? e.message
            : 'No pudimos cargar esta propiedad.'
        );
      })
      .finally(() => {
        if (vivo) setSlugTerminado(slug);
      });

    return () => {
      vivo = false;
    };
  }, [slug]);

  const esDueña =
    propiedad !== null &&
    usuario !== null &&
    (usuario.id === propiedad.propietario?.id || usuario.rol === 'ADMIN');

  // Derivado, no un estado que haya que poner a mano.
  const cargando = slugTerminado !== slug;

  const alEliminar = async () => {
    if (!propiedad) return;
    if (!confirm('¿Eliminar esta publicación? No se puede deshacer.')) return;

    try {
      await api(`/api/propiedades/${propiedad.id}`, { metodo: 'DELETE' });
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof ErrorPeticion ? e.message : 'No se pudo eliminar.');
    }
  };

  // ---------- Estados de carga y error ----------
  if (cargando) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="h-8 w-2/3 animate-pulse rounded-chico bg-papel-hundido" />
        <div className="mt-4 h-4 w-1/3 animate-pulse rounded-chico bg-papel-hundido" />
        <div className="mt-8 h-64 animate-pulse rounded-grande bg-papel-hundido" />
      </div>
    );
  }

  if (error || !propiedad) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <h1 className="text-titulo font-semibold text-tinta">
          {error ?? 'Propiedad no encontrada'}
        </h1>
        <p className="mt-2 text-cuerpo text-tinta-50">
          Es posible que se haya vendido o que el enlace esté mal escrito.
        </p>
        <Link href="/" className="btn btn-principal mt-6">
          Volver al buscador
        </Link>
      </div>
    );
  }

  const porM2 = precioPorM2(propiedad.precio, propiedad.area_m2, propiedad.moneda);

  const alContactar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setErrorContacto(null);

    try {
      await api('/api/contactos', {
        metodo: 'POST',
        cuerpo: {
          propiedad_id: propiedad.id,
          mensaje,
          telefono: usuario?.telefono ?? undefined,
        },
      });
      setEnviado(true);
      setMensaje('');
    } catch (e) {
      setErrorContacto(
        e instanceof ErrorPeticion ? e.message : 'No pudimos enviar tu mensaje.'
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* ---------- Encabezado ---------- */}
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="distintivo distintivo-neutro">
            {etiquetaTipo(propiedad.tipo_inmueble)}
          </span>
          <span className="distintivo distintivo-neutro">
            {propiedad.tipo === 'VENTA' ? 'Venta' : 'Alquiler'}
          </span>
          {propiedad.destacado && (
            <span className="distintivo distintivo-latón">Destacado</span>
          )}
          {propiedad.estado !== 'PUBLICADA' && (
            <span className="distintivo distintivo-latón">{propiedad.estado}</span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-titulo font-semibold leading-tight text-tinta">
            {propiedad.titulo}
          </h1>

          {esDueña && (
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/publicar/${propiedad.id}`}
                className="btn btn-secundario text-menor"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={alEliminar}
                className="btn btn-secundario text-menor text-alerta"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>

        {propiedad.distrito && (
          <p className="mt-1 text-cuerpo text-tinta-50">
            {propiedad.distrito.nombre}
            {propiedad.direccion && ` · ${propiedad.direccion}`}
          </p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* ---------- Columna principal ---------- */}
        <div>
          {/* --- Precio: lo primero que se lee --- */}
          <div className="mb-6 flex items-baseline gap-4 border-y border-linea py-4">
            <p className="cifra text-display font-semibold text-senal">
              {formatearPrecio(propiedad.precio, propiedad.moneda)}
            </p>
            {porM2 && <p className="cifra text-cuerpo text-tinta-50">{porM2}</p>}
          </div>

          {/* --- Mapa: una sola propiedad, con zoom cercano --- */}
          {propiedad.latitud !== null && propiedad.longitud !== null && (
            <div className="mb-6 h-80 overflow-hidden rounded-grande border border-linea">
              <Mapa
                propiedades={[propiedad]}
                className="h-full w-full"
              />
            </div>
          )}

          {/* --- Especificaciones --- */}
          <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-medio border border-linea bg-linea sm:grid-cols-4">
            <Celda etiqueta="Área" valor={propiedad.area_m2 ? `${propiedad.area_m2} m²` : '—'} />
            <Celda etiqueta="Habitaciones" valor={propiedad.habitaciones || '—'} />
            <Celda etiqueta="Baños" valor={propiedad.banos || '—'} />
            <Celda etiqueta="Estacionamientos" valor={propiedad.parkederos || '—'} />
          </dl>

          {/* --- Descripción --- */}
          <section className="mb-8">
            <h2 className="mb-2 text-grande font-semibold text-tinta">Descripción</h2>
            {/* whitespace-pre-line conserva los saltos de línea que el
                dueño escribió, sin tener que convertirlos en <br>. */}
            <p className="whitespace-pre-line text-normal leading-relaxed text-tinta-70">
              {propiedad.descripcion}
            </p>
          </section>

          {/* --- Tour 3D --- */}
          {propiedad.tour_3d_url && (
            <section className="mb-8">
              <h2 className="mb-2 text-grande font-semibold text-tinta">
                Recorrido 3D
              </h2>
              {/* sandbox + allowfullscreen: sin esto, un iframe externo
                  podría navegar la página o leer su DOM. */}
              <iframe
                src={propiedad.tour_3d_url}
                title={`Recorrido 3D de ${propiedad.titulo}`}
                className="h-96 w-full rounded-grande border border-linea"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups"
                loading="lazy"
              />
            </section>
          )}
        </div>

        {/* ---------- Columna lateral: contacto ---------- */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-grande border border-linea bg-papel-alto p-5">
            {propiedad.propietario && (
              <div className="mb-4 border-b border-linea pb-4">
                <p className="text-micro text-tinta-50">Publicado por</p>
                <p className="mt-0.5 text-grande font-semibold text-tinta">
                  {propiedad.propietario.nombre}
                </p>
                {propiedad.propietario.identidad_verificada && (
                  <span className="distintivo distintivo-senal mt-2">
                    Identidad verificada
                  </span>
                )}
              </div>
            )}

            {enviado ? (
              <div className="py-4 text-center">
                <p className="text-cuerpo font-medium text-tinta">
                  Mensaje enviado
                </p>
                <p className="mt-1 text-menor text-tinta-50">
                  Te responderemos por correo. Revisa tu bandeja de spam.
                </p>
              </div>
            ) : esDueña ? (
              <p className="text-cuerpo text-tinta-50">
                Esta publicación es tuya.
              </p>
            ) : !estaConectado ? (
              <div>
                <p className="mb-3 text-cuerpo text-tinta-50">
                  Entra para contactar al propietario.
                </p>
                <Link
                  href={`/login?redirect=/propiedad/${propiedad.slug}`}
                  className="btn btn-principal w-full"
                >
                  Entrar
                </Link>
              </div>
            ) : (
              <form onSubmit={alContactar} className="space-y-3">
                <div>
                  <label htmlFor="mensaje" className="etiqueta">
                    Tu mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    required
                    minLength={10}
                    rows={4}
                    placeholder="Hola, me interesa esta propiedad…"
                    className="campo resize-y"
                  />
                  {errorContacto && (
                    <p role="alert" className="mt-1 text-micro text-alerta">
                      {errorContacto}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={enviando || mensaje.trim().length < 10}
                  className="btn btn-principal w-full"
                >
                  {enviando ? 'Enviando…' : 'Contactar'}
                </button>
              </form>
            )}
          </div>

          <p className="mt-3 text-micro text-tinta-30">
            Referencia #{propiedad.id} · {propiedad.vistas} visitas
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Celda de la tabla de especificaciones. */
function Celda({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="bg-papel-alto px-4 py-3">
      <dt className="text-micro text-tinta-50">{etiqueta}</dt>
      <dd className="cifra mt-0.5 text-grande font-medium text-tinta">{valor}</dd>
    </div>
  );
}
