'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Mapa } from '@/components/Mapa';
import { FichaPropiedad } from '@/components/FichaPropiedad';
import CampoImagenes from '@/components/CampoImagenes';
import { api, ErrorPeticion } from '@/lib/api';
import { useAuth } from '@/contextos/Auth';
import type { PuntoMapa, Propiedad, TipoInmueble } from '@/lib/tipos';

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
  destacado: boolean;
  imagenes: string[];
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
  destacado: false,
  imagenes: [],
};

export default function PaginaPublicar() {
  const { estaConectado, cargando: cargandoAuth, usuario } = useAuth();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const editando = Boolean(params.id);

  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [errorCampo, setErrorCampo] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(editando);

  const [tourOriginal, setTourOriginal] = useState<string | null>(null);

  const puedePlanPro = usuario?.rol === 'ADMIN' || usuario?.plan_pro_activo === true;

  // Redirigir a login si no hay sesión
  useEffect(() => {
    if (!cargandoAuth && !estaConectado) {
      router.replace(`/login?redirect=/publicar${params.id ? `/${params.id}` : ''}`);
    }
  }, [estaConectado, cargandoAuth, router, params.id]);

  // Cargar propiedad en caso de edición
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
          destacado: propiedad.destacado,
          imagenes: propiedad.imagenes ?? [],
        });
        setTourOriginal(propiedad.tour_3d_url ?? null);
      })
      .catch((e) => {
        setError(e instanceof ErrorPeticion ? e.message : 'No pudimos cargar la publicación.');
      })
      .finally(() => setCargando(false));
  }, [editando, params.id]);

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setFormulario((f) => ({ ...f, [campo]: valor }));
    if (errorCampo[campo]) {
      setErrorCampo((prev) => {
        const nuevo = { ...prev };
        delete nuevo[campo];
        return nuevo;
      });
    }
  };

  const aObjetoApi = () => ({
    titulo: formulario.titulo.trim(),
    descripcion: formulario.descripcion.trim(),
    precio: Number(formulario.precio),
    moneda: formulario.moneda,
    tipo: formulario.tipo,
    tipo_inmueble: formulario.tipo_inmueble,
    estado: formulario.estado,
    area_m2: formulario.area_m2 ? Number(formulario.area_m2) : undefined,
    habitaciones: formulario.habitaciones ? Number(formulario.habitaciones) : 0,
    banos: formulario.banos ? Number(formulario.banos) : 0,
    parkederos: formulario.parkederos ? Number(formulario.parkederos) : 0,
    direccion: formulario.direccion.trim() || undefined,
    latitud: formulario.latitud ? Number(formulario.latitud) : undefined,
    longitud: formulario.longitud ? Number(formulario.longitud) : undefined,
    tour_3d_url: formulario.tour_3d_url.trim(),
    imagenes: formulario.imagenes.map((u) => u.trim()).filter(Boolean),
    ...(puedePlanPro ? { destacado: formulario.destacado } : {}),
  });

  const alEnviar = async (
    evento?: React.FormEvent,
    estadoForzado?: 'BORRADOR' | 'PUBLICADA'
  ) => {
    evento?.preventDefault();
    setError(null);
    setErrorCampo({});
    setEnviando(true);

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
        setErrorCampo(
          Object.fromEntries(
            e.detalles.map((d) => [d.campo.split('.')[0], d.mensaje])
          )
        );
      } else {
        setError('No pudimos guardar la publicación. Revisa los datos ingresados.');
      }
    } finally {
      setEnviando(false);
    }
  };

  if (cargandoAuth || cargando || !estaConectado) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="h-10 w-1/3 animate-pulse rounded-xl bg-papel-hundido" />
      </div>
    );
  }

  const pinAproximada: PuntoMapa[] =
    formulario.latitud && formulario.longitud
      ? [
          {
            id: 0,
            latitud: Number(formulario.latitud),
            longitud: Number(formulario.longitud),
            titulo: formulario.titulo || 'Tu publicación',
            precio: Number(formulario.precio) || 0,
            moneda: formulario.moneda,
            tipo_inmueble: (formulario.tipo_inmueble || 'DEPARTAMENTO') as TipoInmueble,
            habitaciones: Number(formulario.habitaciones) || 0,
            area_m2: formulario.area_m2 ? Number(formulario.area_m2) : null,
            destacado: formulario.destacado,
            distrito: null,
          },
        ]
      : [];

  const faltanObligatorios =
    !formulario.titulo.trim() ||
    !formulario.descripcion.trim() ||
    !formulario.precio.trim();

  return (
    <div className="min-h-screen bg-papel">
      {/* Contenedor principal con migas de pan y cabecera */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Migas de pan / Volver al mapa */}
        <nav aria-label="Migas de pan" className="mb-4">
          <ol className="flex items-center gap-2 text-menor text-tinta-50">
            <li>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 font-medium text-tinta-70 hover:text-senal transition-colors"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M10 13l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Volver al mapa
              </Link>
            </li>
            <li>/</li>
            <li className="font-semibold text-tinta" aria-current="page">
              {editando ? 'Editar publicación' : 'Publicar propiedad'}
            </li>
          </ol>
        </nav>

        {/* Título de la página */}
        <div className="mb-8">
          <h1 className="text-titulo font-bold tracking-tight text-tinta sm:text-3xl">
            {editando ? 'Editar publicación' : 'Publicar nueva propiedad'}
          </h1>
          <p className="mt-1 text-menor text-tinta-70">
            Completa la información de tu inmueble. Los campos marcados con{' '}
            <span className="text-alerta font-bold">*</span> son obligatorios.
          </p>
        </div>

        {/* Error global */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-alerta bg-alerta-suave px-4 py-3 text-menor text-alerta shadow-xs"
          >
            {error}
          </div>
        )}

        <form onSubmit={(e) => alEnviar(e)} noValidate>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
            {/* Columna izquierda: Formulario estructurado en tarjetas blancas */}
            <div className="space-y-6">
              {/* 1 · La propiedad */}
              <TarjetaSeccion
                numero="1"
                titulo="La propiedad"
                descripcion="Información básica y descriptiva del inmueble"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="titulo" className="etiqueta text-menor font-medium text-tinta">
                      Título <span className="text-alerta font-bold">*</span>
                    </label>
                    <span className="text-micro text-tinta-50">
                      {formulario.titulo.length}/80 caracteres
                    </span>
                  </div>
                  <input
                    id="titulo"
                    type="text"
                    value={formulario.titulo}
                    maxLength={80}
                    onChange={(e) => cambiar('titulo', e.target.value)}
                    placeholder="Ej. Departamento moderno a dos cuadras de la Plaza de Armas"
                    className={`campo mt-1 text-menor placeholder:text-slate-400 focus:border-senal focus:ring-2 focus:ring-teal-500/20 ${
                      errorCampo.titulo ? 'border-alerta' : ''
                    }`}
                  />
                  <p className="mt-1 text-micro text-tinta-50">
                    Incluye el tipo de inmueble, zona y un punto de referencia clave.
                  </p>
                  {errorCampo.titulo && (
                    <p className="mt-1 text-micro text-alerta">{errorCampo.titulo}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="descripcion"
                      className="etiqueta text-menor font-medium text-tinta"
                    >
                      Descripción detallada <span className="text-alerta font-bold">*</span>
                    </label>
                    <span className="text-micro text-tinta-50">
                      {formulario.descripcion.length}/1000 caracteres
                    </span>
                  </div>
                  <textarea
                    id="descripcion"
                    rows={4}
                    maxLength={1000}
                    value={formulario.descripcion}
                    onChange={(e) => cambiar('descripcion', e.target.value)}
                    placeholder="Describe los ambientes, acabados, servicios disponibles y facilidades de acceso…"
                    className={`campo mt-1 resize-y text-menor placeholder:text-slate-400 focus:border-senal focus:ring-2 focus:ring-teal-500/20 ${
                      errorCampo.descripcion ? 'border-alerta' : ''
                    }`}
                  />
                  {errorCampo.descripcion && (
                    <p className="mt-1 text-micro text-alerta">{errorCampo.descripcion}</p>
                  )}
                </div>
              </TarjetaSeccion>

              {/* 2 · Fotos */}
              <TarjetaSeccion
                numero="2"
                titulo="Fotos del inmueble"
                descripcion="Sube fotografías atractivas con buena iluminación"
              >
                <CampoImagenes
                  valor={formulario.imagenes}
                  onChange={(urls) => cambiar('imagenes', urls)}
                  error={errorCampo.imagenes}
                />
              </TarjetaSeccion>

              {/* 3 · Condiciones y precio */}
              <TarjetaSeccion
                numero="3"
                titulo="Condiciones y precio"
                descripcion="Modalidad de transacción y valor económico"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="precio" className="etiqueta text-menor font-medium text-tinta">
                      Precio <span className="text-alerta font-bold">*</span>
                    </label>
                    <input
                      id="precio"
                      type="number"
                      step="any"
                      value={formulario.precio}
                      onChange={(e) => cambiar('precio', e.target.value)}
                      placeholder="Ej. 250000"
                      className={`campo mt-1 text-menor placeholder:text-slate-400 focus:border-senal focus:ring-2 focus:ring-teal-500/20 ${
                        errorCampo.precio ? 'border-alerta' : ''
                      }`}
                    />
                    {errorCampo.precio && (
                      <p className="mt-1 text-micro text-alerta">{errorCampo.precio}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="moneda" className="etiqueta text-menor font-medium text-tinta">
                      Moneda
                    </label>
                    <select
                      id="moneda"
                      value={formulario.moneda}
                      onChange={(e) => cambiar('moneda', e.target.value as 'PEN' | 'USD')}
                      className="campo mt-1 text-menor"
                    >
                      <option value="PEN">Soles (S/)</option>
                      <option value="USD">Dólares (US$)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="tipo" className="etiqueta text-menor font-medium text-tinta">
                      Operación <span className="text-alerta font-bold">*</span>
                    </label>
                    <select
                      id="tipo"
                      value={formulario.tipo}
                      onChange={(e) => cambiar('tipo', e.target.value as 'VENTA' | 'ALQUILER')}
                      className="campo mt-1 text-menor"
                    >
                      <option value="VENTA">Venta</option>
                      <option value="ALQUILER">Alquiler</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="tipo_inmueble"
                      className="etiqueta text-menor font-medium text-tinta"
                    >
                      Tipo de inmueble
                    </label>
                    <select
                      id="tipo_inmueble"
                      value={formulario.tipo_inmueble}
                      onChange={(e) => cambiar('tipo_inmueble', e.target.value)}
                      className="campo mt-1 text-menor"
                    >
                      <option value="DEPARTAMENTO">Departamento</option>
                      <option value="CASA">Casa</option>
                      <option value="TERRENO">Terreno</option>
                      <option value="OFICINA">Oficina</option>
                      <option value="LOCAL_COMERCIAL">Local comercial</option>
                      <option value="OTRO">Otro inmueble</option>
                    </select>
                  </div>
                </div>
              </TarjetaSeccion>

              {/* 4 · Características */}
              <TarjetaSeccion
                numero="4"
                titulo="Características"
                descripcion="Dimensiones y distribución de espacios"
              >
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <label htmlFor="area_m2" className="etiqueta text-micro font-medium text-tinta-70">
                      Área (m²)
                    </label>
                    <input
                      id="area_m2"
                      type="number"
                      step="any"
                      value={formulario.area_m2}
                      onChange={(e) => cambiar('area_m2', e.target.value)}
                      placeholder="Ej. 120"
                      className="campo mt-1 text-menor placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="habitaciones"
                      className="etiqueta text-micro font-medium text-tinta-70"
                    >
                      Habitaciones
                    </label>
                    <input
                      id="habitaciones"
                      type="number"
                      value={formulario.habitaciones}
                      onChange={(e) => cambiar('habitaciones', e.target.value)}
                      placeholder="Ej. 3"
                      className="campo mt-1 text-menor placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="banos" className="etiqueta text-micro font-medium text-tinta-70">
                      Baños
                    </label>
                    <input
                      id="banos"
                      type="number"
                      value={formulario.banos}
                      onChange={(e) => cambiar('banos', e.target.value)}
                      placeholder="Ej. 2"
                      className="campo mt-1 text-menor placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="parkederos"
                      className="etiqueta text-micro font-medium text-tinta-70"
                    >
                      Estacionamiento
                    </label>
                    <input
                      id="parkederos"
                      type="number"
                      value={formulario.parkederos}
                      onChange={(e) => cambiar('parkederos', e.target.value)}
                      placeholder="Ej. 1"
                      className="campo mt-1 text-menor placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </TarjetaSeccion>

              {/* 5 · Ubicación */}
              <TarjetaSeccion
                numero="5"
                titulo="Ubicación en el mapa"
                descripcion="Dirección y coordenadas para geolocalizar la propiedad en Huánuco"
              >
                <div>
                  <label htmlFor="direccion" className="etiqueta text-menor font-medium text-tinta">
                    Dirección o referencia
                  </label>
                  <input
                    id="direccion"
                    type="text"
                    value={formulario.direccion}
                    onChange={(e) => cambiar('direccion', e.target.value)}
                    placeholder="Ej. Jr. Dos de Mayo 450, Huánuco"
                    className="campo mt-1 text-menor placeholder:text-slate-400"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="latitud" className="etiqueta text-menor font-medium text-tinta">
                      Latitud
                    </label>
                    <input
                      id="latitud"
                      type="number"
                      step="any"
                      value={formulario.latitud}
                      onChange={(e) => cambiar('latitud', e.target.value)}
                      placeholder="-9.9293"
                      className="campo mt-1 text-menor placeholder:text-slate-400"
                    />
                    <p className="mt-1 text-micro text-tinta-50">
                      Plaza de Armas de Huánuco: -9.9293
                    </p>
                  </div>

                  <div>
                    <label htmlFor="longitud" className="etiqueta text-menor font-medium text-tinta">
                      Longitud
                    </label>
                    <input
                      id="longitud"
                      type="number"
                      step="any"
                      value={formulario.longitud}
                      onChange={(e) => cambiar('longitud', e.target.value)}
                      placeholder="-76.2395"
                      className="campo mt-1 text-menor placeholder:text-slate-400"
                    />
                    <p className="mt-1 text-micro text-tinta-50">
                      Plaza de Armas de Huánuco: -76.2395
                    </p>
                  </div>
                </div>

                {pinAproximada.length > 0 && (
                  <div className="h-56 overflow-hidden rounded-xl border border-linea">
                    <Mapa puntos={pinAproximada} className="h-full w-full" />
                  </div>
                )}
              </TarjetaSeccion>

              {/* 6 · Plan PRO */}
              <TarjetaSeccion
                numero="6"
                titulo="Plan PRO: recorrido 3D y destaque"
                descripcion="Funcionalidades exclusivas para suscriptores PRO"
              >
                {puedePlanPro || tourOriginal ? (
                  <div>
                    <label
                      htmlFor="tour_3d_url"
                      className="etiqueta text-menor font-medium text-tinta"
                    >
                      Enlace al recorrido virtual 3D
                    </label>
                    <input
                      id="tour_3d_url"
                      type="url"
                      value={formulario.tour_3d_url}
                      onChange={(e) => cambiar('tour_3d_url', e.target.value)}
                      placeholder="https://my.matterport.com/show/?m=…"
                      className="campo mt-1 text-menor placeholder:text-slate-400"
                    />
                    <p className="mt-1 text-micro text-tinta-50">
                      Compatible con Matterport, Sketchfab o Kuula.
                    </p>
                  </div>
                ) : null}

                {puedePlanPro ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-linea bg-papel-alto p-3.5 transition hover:bg-papel">
                    <input
                      type="checkbox"
                      checked={formulario.destacado}
                      onChange={(e) => cambiar('destacado', e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-amber-500"
                    />
                    <div>
                      <span className="text-menor font-semibold text-tinta">
                        Destacar esta publicación
                      </span>
                      <p className="text-micro text-tinta-50">
                        Aparecerá en los primeros resultados de búsqueda con la insignia ámbar de
                        destacado.
                      </p>
                    </div>
                  </label>
                ) : null}

                {!puedePlanPro && !tourOriginal && (
                  <div className="rounded-xl border border-linea bg-papel-hundido/60 p-4">
                    <p className="text-menor text-tinta-70">
                      El recorrido 3D y el destaque prioritario van incluidos en el plan{' '}
                      <strong className="font-semibold text-tinta">PRO</strong>. Puedes publicar y
                      recibir contactos normalmente con tu cuenta actual.
                    </p>
                  </div>
                )}
              </TarjetaSeccion>
            </div>

            {/* Columna derecha: Vista previa en tiempo real pegajosa */}
            <div className="hidden lg:block">
              <div className="sticky top-20 space-y-4">
                <div className="rounded-2xl border border-linea bg-white p-5 shadow-xs">
                  <div className="mb-3 flex items-center justify-between border-b border-linea pb-2.5">
                    <span className="text-menor font-semibold text-tinta">
                      Vista previa del anuncio
                    </span>
                    <span className="rounded-md bg-teal-50 px-2 py-0.5 text-micro font-semibold text-senal">
                      En vivo
                    </span>
                  </div>
                  <p className="mb-4 text-micro text-tinta-50">
                    Así se presentará tu publicación a las personas que busquen en el mapa y la
                    lista.
                  </p>

                  <FichaPropiedad
                    propiedad={{
                      id: 0,
                      slug: 'vista-previa',
                      titulo: formulario.titulo || 'Título de tu inmueble en Huánuco',
                      descripcion: formulario.descripcion || 'Descripción del inmueble…',
                      precio: Number(formulario.precio) || 0,
                      moneda: formulario.moneda,
                      tipo: formulario.tipo,
                      tipo_inmueble: (formulario.tipo_inmueble || 'DEPARTAMENTO') as TipoInmueble,
                      estado: formulario.estado,
                      area_m2: formulario.area_m2 ? Number(formulario.area_m2) : null,
                      habitaciones: Number(formulario.habitaciones) || 0,
                      banos: Number(formulario.banos) || 0,
                      parkederos: Number(formulario.parkederos) || 0,
                      direccion: formulario.direccion || null,
                      latitud: formulario.latitud ? Number(formulario.latitud) : null,
                      longitud: formulario.longitud ? Number(formulario.longitud) : null,
                      destacado: formulario.destacado,
                      tour_3d_url: formulario.tour_3d_url || null,
                      imagenes: formulario.imagenes.filter(Boolean),
                      distrito_id: null,
                      distrito: null,
                      propietario: {
                        id: usuario?.id ?? 0,
                        nombre: usuario?.nombre ?? 'Tú',
                        identidad_verificada: usuario?.identidad_verificada ?? false,
                      },
                      fecha_creacion: new Date().toISOString(),
                      fecha_actualizacion: new Date().toISOString(),
                      vistas: 0,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Barra de acciones inferior fija (Sticky bottom action bar) */}
          <div className="sticky bottom-0 z-40 mt-12 -mx-4 border-t border-linea bg-white/95 px-4 py-3.5 shadow-lg backdrop-blur-md sm:-mx-6 sm:px-6">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => alEnviar(undefined, 'BORRADOR')}
                disabled={enviando}
                className="text-menor font-medium text-tinta-70 hover:text-tinta transition-colors"
              >
                Guardar borrador
              </button>

              <div className="flex items-center gap-3">
                {faltanObligatorios && (
                  <span className="hidden text-micro text-tinta-50 sm:inline">
                    Faltan campos obligatorios (*)
                  </span>
                )}
                <Link
                  href="/perfil"
                  className="rounded-full border border-linea px-4 py-2 text-menor font-medium text-tinta-70 hover:bg-papel transition-colors"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={enviando}
                  className="btn-coral flex items-center gap-2 rounded-full px-6 py-2.5 text-menor font-bold shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                >
                  {enviando ? (
                    'Guardando…'
                  ) : editando ? (
                    'Guardar cambios'
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 16 16"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                      </svg>
                      Publicar propiedad
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Componente de tarjeta de sección blanca con número distintivo */
function TarjetaSeccion({
  numero,
  titulo,
  descripcion,
  children,
}: {
  numero: string;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-linea bg-white p-6 shadow-2xs">
      <div className="mb-5 flex items-start gap-3 border-b border-linea/60 pb-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-menor font-bold text-senal">
          {numero}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-tinta leading-tight">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-micro text-tinta-50">{descripcion}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
