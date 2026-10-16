'use client';

// ========================================
// 📐 PUBLICAR PROPIEDAD
// ========================================
// Formulario de alta y edición.
//
// 📌 POR QUÉ ES UN FORMULARIO Y NO UN WIZARD DE PASOS
//
// Un wizard de 5 pasos esconde el total: el usuario no sabe cuánto
// falta. Y con la tasa de abandono de los formularios largos, cada
// paso extra es una fuga. Un formulario largo pero visible retiene más
// usuarios que uno corto que no se entiende.
//
// La sección de ubicación va aparte porque es la única con algo que no
// es obvio (elegir el punto en el mapa), y ahí conviene dar contexto.

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Mapa } from '@/components/Mapa';
import { api, ErrorPeticion } from '@/lib/api';
import { useAuth } from '@/contextos/Auth';
import type { Propiedad } from '@/lib/tipos';

interface Formulario {
  titulo: string;
  descripcion: string;
  precio: string;
  moneda: 'PEN' | 'USD';
  tipo: 'VENTA' | 'ALQUILER';
  tipo_inmueble: string;
  estado: 'BORRADOR' | 'PUBLICADA';
  area_m2: string;
  habitaciones: string;
  banos: string;
  parkederos: string;
  direccion: string;
  latitud: string;
  longitud: string;
  tour_3d_url: string;
}

const FORMULARIO_VACIO: Formulario = {
  titulo: '',
  descripcion: '',
  precio: '',
  moneda: 'PEN',
  tipo: 'VENTA',
  tipo_inmueble: 'DEPARTAMENTO',
  estado: 'PUBLICADA',
  area_m2: '',
  habitaciones: '',
  banos: '',
  parkederos: '',
  direccion: '',
  latitud: '',
  longitud: '',
  tour_3d_url: '',
};

export default function PaginaPublicar() {
  const { estaConectado, cargando: cargandoAuth } = useAuth();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const editando = Boolean(params.id);

  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [errorCampo, setErrorCampo] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(editando);

  // Sin sesión no se publica nada.
  useEffect(() => {
    if (!cargandoAuth && !estaConectado) {
      router.replace(`/login?redirect=/publicar${params.id ? `/${params.id}` : ''}`);
    }
  }, [estaConectado, cargandoAuth, router, params.id]);

  // Cargar la propiedad si estamos editando.
  useEffect(() => {
    if (!editando || !params.id) return;

    api<{ propiedad: Propiedad }>(`/api/propiedades/${params.id}`)
      .then(({ propiedad }) => {
        setFormulario({
          titulo: propiedad.titulo,
          descripcion: propiedad.descripcion,
          precio: String(propiedad.precio),
          moneda: propiedad.moneda,
          tipo: propiedad.tipo,
          tipo_inmueble: propiedad.tipo_inmueble,
          estado: propiedad.estado === 'BORRADOR' ? 'BORRADOR' : 'PUBLICADA',
          area_m2: propiedad.area_m2 ? String(propiedad.area_m2) : '',
          habitaciones: String(propiedad.habitaciones || ''),
          banos: String(propiedad.banos || ''),
          parkederos: String(propiedad.parkederos || ''),
          direccion: propiedad.direccion ?? '',
          latitud: propiedad.latitud !== null ? String(propiedad.latitud) : '',
          longitud: propiedad.longitud !== null ? String(propiedad.longitud) : '',
          tour_3d_url: propiedad.tour_3d_url ?? '',
        });
      })
      .catch((e) => {
        setError(e instanceof ErrorPeticion ? e.message : 'No pudimos cargar la publicación.');
      })
      .finally(() => setCargando(false));
  }, [editando, params.id]);

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setFormulario((f) => ({ ...f, [campo]: valor }));
  };

  /**
   * Convierte un formulario (todo texto) al objeto que espera la API.
   *
   * Los campos numéricos llegan como string desde <input>. Los vacíos se
   * mandan como `undefined` y no como `""`, porque el backend rechaza
   * una cadena donde espera un número.
   */
  const aObjetoApi = () => ({
    titulo: formulario.titulo,
    descripcion: formulario.descripcion,
    precio: Number(formulario.precio),
    moneda: formulario.moneda,
    tipo: formulario.tipo,
    tipo_inmueble: formulario.tipo_inmueble,
    estado: formulario.estado,
    area_m2: formulario.area_m2 ? Number(formulario.area_m2) : undefined,
    habitaciones: formulario.habitaciones ? Number(formulario.habitaciones) : undefined,
    banos: formulario.banos ? Number(formulario.banos) : undefined,
    parkederos: formulario.parkederos ? Number(formulario.parkederos) : undefined,
    direccion: formulario.direccion || undefined,
    latitud: formulario.latitud ? Number(formulario.latitud) : undefined,
    longitud: formulario.longitud ? Number(formulario.longitud) : undefined,

    /*
     * ⛔ AQUÍ NO VALE `|| undefined`, Y LA DIFERENCIA IMPORTA.
     *
     * En los campos numéricos de arriba, `undefined` significa "no lo mandes".
     * En esta URL significa lo mismo — y eso rompe el borrado:
     *
     *   - `JSON.stringify` ELIMINA las claves con valor `undefined`, así que
     *     `tour_3d_url: undefined` desaparece del cuerpo de la petición.
     *   - El backend interpreta "la clave no está" como "no toques este
     *     campo" (que es lo correcto: si no, editar el precio borraría el
     *     recorrido de paso).
     *   - Resultado: vaciar el campo en el formulario y guardar no borraba
     *     nada. El usuario veía su recorrido 3D ahí después de quitarlo, sin
     *     ningún error que explicara por qué.
     *
     * Mandar `''` de forma explícita resuelve la ambigüedad: el schema del
     * backend lo convierte en `null` y eso SÍ significa "bórralo".
     *
     * `trim()` para que un campo con solo espacios cuente como vacío.
     */
    tour_3d_url: formulario.tour_3d_url.trim(),
  });

  /**
   * @param estadoForzado  "PUBLICADA" | "BORRADOR" para el botón de
   *                       guardar borrador sin tocar el <select>.
   */
  const alEnviar = async (
    evento?: React.FormEvent,
    estadoForzado?: 'BORRADOR' | 'PUBLICADA'
  ) => {
    evento?.preventDefault();
    setError(null);
    setErrorCampo({});
    setEnviando(true);

    // El borrador es una publicación a medio hacer: se guarda con
    // estado BORRADOR sin cambiar lo que el usuario eligió en el select.
    const cuerpo = {
      ...aObjetoApi(),
      ...(estadoForzado && { estado: estadoForzado }),
    };

    try {
      if (editando) {
        await api(`/api/propiedades/${params.id}`, { metodo: 'PUT', cuerpo });
      } else {
        await api('/api/propiedades', { metodo: 'POST', cuerpo });
      }

      router.push('/perfil');
      router.refresh();
    } catch (e) {
      if (e instanceof ErrorPeticion) {
        setError(e.message);
        setErrorCampo(Object.fromEntries(e.detalles.map((d) => [d.campo, d.mensaje])));
      } else {
        setError('No pudimos guardar la publicación.');
      }
    } finally {
      setEnviando(false);
    }
  };

  // Mientras se verifica la sesión o se cargan los datos, no pintamos nada
  // para evitar un parpadeo con contenido que luego desaparece.
  if (cargandoAuth || cargando || !estaConectado) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="h-8 w-1/2 animate-pulse rounded-chico bg-papel-hundido" />
      </div>
    );
  }

  // Pin approximation to show on the map while the user types coordinates.
  const pinAproximada: Propiedad[] =
    formulario.latitud && formulario.longitud
      ? [
          {
            id: 0,
            slug: 'preview',
            titulo: formulario.titulo || 'Tu publicación',
            descripcion: '',
            precio: Number(formulario.precio) || 0,
            moneda: formulario.moneda,
            tipo: formulario.tipo,
            tipo_inmueble: formulario.tipo_inmueble as never,
            estado: 'PUBLICADA',
            area_m2: formulario.area_m2 ? Number(formulario.area_m2) : null,
            habitaciones: 0,
            banos: 0,
            parkederos: 0,
            distrito_id: null,
            direccion: null,
            latitud: Number(formulario.latitud),
            longitud: Number(formulario.longitud),
            tour_3d_url: null,
            imagenes: [],
            destacado: false,
            vistas: 0,
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString(),
            propietario: null,
            distrito: null,
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-titulo font-semibold text-tinta">
          {editando ? 'Editar publicación' : 'Publicar propiedad'}
        </h1>
        <p className="mt-1 text-cuerpo text-tinta-50">
          Los campos marcados con * son obligatorios.
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-medio border border-alerta bg-alerta-suave px-4 py-3 text-cuerpo text-alerta">
          {error}
        </div>
      )}

      <form onSubmit={(e) => alEnviar(e)} noValidate className="space-y-8">
        {/* ---------- Datos ---------- */}
        <Seccion titulo="La propiedad">
          <CampoTexto
            etiqueta="Título *"
            value={formulario.titulo}
            onChange={(v) => cambiar('titulo', v)}
            placeholder="Departamento a dos cuadras de la Plaza de Armas"
            error={errorCampo.titulo}
            minLength={10}
          />

          <CampoTexto
            etiqueta="Descripción *"
            value={formulario.descripcion}
            onChange={(v) => cambiar('descripcion', v)}
            placeholder="Describe la propiedad: estado, servicios, qué incluye…"
            error={errorCampo.descripcion}
            minLength={30}
            multiline
            filas={5}
          />
        </Seccion>

        {/* ---------- Condiciones ---------- */}
        <Seccion titulo="Condiciones">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              etiqueta="Precio *"
              value={formulario.precio}
              onChange={(v) => cambiar('precio', v)}
              placeholder="350000"
              type="number"
              error={errorCampo.precio}
            />

            <div>
              <label htmlFor="moneda" className="etiqueta">Moneda</label>
              <select
                id="moneda"
                value={formulario.moneda}
                onChange={(e) => cambiar('moneda', e.target.value as 'PEN' | 'USD')}
                className="campo"
              >
                <option value="PEN">Soles (S/)</option>
                <option value="USD">Dólares (US$)</option>
              </select>
            </div>

            <div>
              <label htmlFor="tipo" className="etiqueta">¿Venta o alquiler? *</label>
              <select
                id="tipo"
                value={formulario.tipo}
                onChange={(e) => cambiar('tipo', e.target.value as 'VENTA' | 'ALQUILER')}
                className="campo"
              >
                <option value="VENTA">Venta</option>
                <option value="ALQUILER">Alquiler</option>
              </select>
            </div>

            <div>
              <label htmlFor="tipo_inmueble" className="etiqueta">Tipo de inmueble</label>
              <select
                id="tipo_inmueble"
                value={formulario.tipo_inmueble}
                onChange={(e) => cambiar('tipo_inmueble', e.target.value)}
                className="campo"
              >
                <option value="DEPARTAMENTO">Departamento</option>
                <option value="CASA">Casa</option>
                <option value="TERRENO">Terreno</option>
                <option value="OFICINA">Oficina</option>
                <option value="LOCAL_COMERCIAL">Local comercial</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>
        </Seccion>

        {/* ---------- Características ---------- */}
        <Seccion titulo="Características">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <CampoTexto etiqueta="Área (m²)" value={formulario.area_m2} onChange={(v) => cambiar('area_m2', v)} type="number" />
            <CampoTexto etiqueta="Habitaciones" value={formulario.habitaciones} onChange={(v) => cambiar('habitaciones', v)} type="number" />
            <CampoTexto etiqueta="Baños" value={formulario.banos} onChange={(v) => cambiar('banos', v)} type="number" />
            <CampoTexto etiqueta="Estacionamientos" value={formulario.parkederos} onChange={(v) => cambiar('parkederos', v)} type="number" />
          </div>
        </Seccion>

        {/* ---------- Ubicación ---------- */}
        <Seccion titulo="Ubicación">
          <CampoTexto
            etiqueta="Dirección"
            value={formulario.direccion}
            onChange={(v) => cambiar('direccion', v)}
            placeholder="Calle, número, distrito"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              etiqueta="Latitud"
              value={formulario.latitud}
              onChange={(v) => cambiar('latitud', v)}
              placeholder="-9.9293"
              type="number"
              hint="Plaza de Armas de Huánuco: -9.9293"
              error={errorCampo.latitud}
            />
            <CampoTexto
              etiqueta="Longitud"
              value={formulario.longitud}
              onChange={(v) => cambiar('longitud', v)}
              placeholder="-76.2395"
              type="number"
              error={errorCampo.longitud}
            />
          </div>

          {/* Vista previa mientras se escriben las coordenadas. */}
          {pinAproximada.length > 0 && (
            <div className="h-56 overflow-hidden rounded-medio border border-linea">
              <Mapa propiedades={pinAproximada} className="h-full w-full" />
            </div>
          )}
        </Seccion>

        {/* ---------- Tour 3D ---------- */}
        <Seccion titulo="Tour 3D (opcional)">
          <CampoTexto
            etiqueta="Enlace al recorrido virtual"
            value={formulario.tour_3d_url}
            onChange={(v) => cambiar('tour_3d_url', v)}
            placeholder="https://my.matterport.com/show/?m=…"
            type="url"
            hint="Matterport, Sketchfab o similar."
            error={errorCampo.tour_3d_url}
          />
        </Seccion>

        {/* ---------- Publicar ---------- */}
        <div className="flex flex-col gap-3 border-t border-linea pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => alEnviar(undefined, 'BORRADOR')}
              disabled={enviando}
              className="btn btn-secundario"
            >
              Guardar como borrador
            </button>
          </div>

          <div className="flex gap-2">
            <Link href="/perfil" className="btn btn-secundario">
              Cancelar
            </Link>
            <button type="submit" disabled={enviando} className="btn btn-principal">
              {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Agrupa campos bajo un subtítulo. */
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-grande font-semibold text-tinta">{titulo}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Campo de texto, numérico o área de texto. */
function CampoTexto({
  etiqueta,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  hint,
  multiline,
  filas = 3,
  minLength,
}: {
  etiqueta: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  hint?: string;
  multiline?: boolean;
  filas?: number;
  minLength?: number;
}) {
  const id = etiqueta.toLowerCase().replace(/[^a-z]/g, '-');

  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={filas}
          minLength={minLength}
          aria-invalid={error ? 'true' : undefined}
          className="campo resize-y"
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={minLength}
          step={type === 'number' ? 'any' : undefined}
          aria-invalid={error ? 'true' : undefined}
          className="campo"
        />
      )}
      {error ? (
        <p className="mt-1 text-micro text-alerta">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-micro text-tinta-30">{hint}</p>
      ) : null}
    </div>
  );
}
