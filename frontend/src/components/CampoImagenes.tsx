'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';

const MAX = 10;
const MAX_TAMANO_MB = 5;

interface Props {
  valor: string[];
  onChange: (urls: string[]) => void;
  error?: string;
}

export default function CampoImagenes({ valor, onChange, error }: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const [mostrarUrls, setMostrarUrls] = useState(false);
  const [urlManual, setUrlManual] = useState('');
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const procesarArchivos = (archivos: FileList | null) => {
    if (!archivos || archivos.length === 0) return;
    setAvisoLocal(null);

    const disponibles = MAX - valor.length;
    if (disponibles <= 0) {
      setAvisoLocal(`Ya alcanzaste el máximo de ${MAX} fotos permitidas.`);
      return;
    }

    const seleccionados = Array.from(archivos).slice(0, disponibles);
    const nuevasUrls: string[] = [];
    let procesados = 0;

    seleccionados.forEach((archivo) => {
      // Validar tipo
      if (!archivo.type.startsWith('image/')) {
        setAvisoLocal('Solo se permiten imágenes (JPG, PNG, WebP).');
        return;
      }

      // Validar tamaño (5 MB)
      if (archivo.size > MAX_TAMANO_MB * 1024 * 1024) {
        setAvisoLocal(`El archivo "${archivo.name}" supera el límite de ${MAX_TAMANO_MB} MB.`);
        return;
      }

      const lector = new FileReader();
      lector.onload = (e) => {
        const resultado = e.target?.result;
        if (typeof resultado === 'string') {
          nuevasUrls.push(resultado);
        }
        procesados += 1;
        if (procesados === seleccionados.length && nuevasUrls.length > 0) {
          onChange([...valor, ...nuevasUrls]);
        }
      };
      lector.readAsDataURL(archivo);
    });
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrando(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrando(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrando(false);
    procesarArchivos(e.dataTransfer.files);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    procesarArchivos(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const quitarFoto = (indice: number) => {
    onChange(valor.filter((_, i) => i !== indice));
  };

  const moverPortada = (indice: number) => {
    if (indice === 0) return;
    const seleccionada = valor[indice];
    const resto = valor.filter((_, i) => i !== indice);
    onChange([seleccionada, ...resto]);
  };

  const moverIzquierda = (indice: number) => {
    if (indice === 0) return;
    const copia = [...valor];
    [copia[indice - 1], copia[indice]] = [copia[indice], copia[indice - 1]];
    onChange(copia);
  };

  const moverDerecha = (indice: number) => {
    if (indice === valor.length - 1) return;
    const copia = [...valor];
    [copia[indice + 1], copia[indice]] = [copia[indice], copia[indice + 1]];
    onChange(copia);
  };

  const agregarUrlManual = () => {
    const limpia = urlManual.trim();
    if (!limpia) return;
    const conEsquema = /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`;
    if (valor.length < MAX) {
      onChange([...valor, conEsquema]);
      setUrlManual('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Zona de arrastrar y soltar (Drag and drop) */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          arrastrando
            ? 'border-senal bg-teal-50/50 scale-[1.01]'
            : 'border-linea-fuerte bg-papel-alto hover:border-senal hover:bg-teal-50/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={onFileChange}
          className="hidden"
          aria-label="Subir fotos de la propiedad"
        />

        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-senal transition-transform group-hover:scale-110">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>

        <p className="text-normal font-semibold text-tinta">
          Arrastra tus fotos aquí o haz clic para subir
        </p>
        <p className="mt-1 text-menor text-tinta-50">
          Hasta 10 fotos · JPG o PNG · máx. 5 MB cada una
        </p>

        {valor.length > 0 && (
          <span className="mt-2 inline-flex items-center rounded-full bg-papel px-2.5 py-0.5 text-micro font-medium text-tinta-70">
            {valor.length} de {MAX} fotos cargadas
          </span>
        )}
      </div>

      {/* Avisos locales o errores */}
      {(avisoLocal || error) && (
        <div role="alert" className="rounded-xl border border-alerta bg-alerta-suave px-3.5 py-2.5 text-menor text-alerta">
          {avisoLocal || error}
        </div>
      )}

      {/* Cuadrícula de fotos cargadas */}
      {valor.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-menor font-semibold text-tinta">
              Fotos seleccionadas ({valor.length})
            </span>
            <span className="text-micro text-tinta-50">
              La primera foto se utilizará como portada
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {valor.map((url, i) => (
              <div
                key={i}
                className={`group relative aspect-4/3 overflow-hidden rounded-xl border bg-papel-hundido shadow-2xs transition-all ${
                  i === 0 ? 'border-senal ring-2 ring-teal-500/30' : 'border-linea'
                }`}
              >
                <img
                  src={url}
                  alt={`Foto ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />

                {/* Badge portada */}
                {i === 0 ? (
                  <span className="absolute left-2 top-2 rounded-md bg-senal px-2 py-0.5 text-micro font-bold text-white shadow-sm">
                    Portada
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => moverPortada(i)}
                    className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-micro font-medium text-white opacity-0 backdrop-blur-xs transition hover:bg-senal group-hover:opacity-100"
                    title="Definir como foto de portada"
                  >
                    Hacer portada
                  </button>
                )}

                {/* Botón eliminar (X) */}
                <button
                  type="button"
                  onClick={() => quitarFoto(i)}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white opacity-0 backdrop-blur-xs transition hover:bg-alerta group-hover:opacity-100"
                  title="Eliminar foto"
                  aria-label={`Eliminar foto ${i + 1}`}
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>

                {/* Controles de reordenar */}
                <div className="absolute bottom-1.5 left-2 right-2 flex justify-between opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => moverIzquierda(i)}
                    disabled={i === 0}
                    className="rounded bg-black/60 px-1.5 py-0.5 text-micro text-white disabled:opacity-30 hover:bg-black/90"
                    title="Mover a la izquierda"
                    aria-label={`Mover foto ${i + 1} a la izquierda`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => moverDerecha(i)}
                    disabled={i === valor.length - 1}
                    className="rounded bg-black/60 px-1.5 py-0.5 text-micro text-white disabled:opacity-30 hover:bg-black/90"
                    title="Mover a la derecha"
                    aria-label={`Mover foto ${i + 1} a la derecha`}
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opción secundaria: Pegar enlaces directos */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setMostrarUrls((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-menor font-medium text-senal hover:underline"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1" strokeLinecap="round" />
          </svg>
          {mostrarUrls ? 'Ocultar opción de enlace' : '¿Tienes un enlace? Pégalo aquí'}
        </button>

        {mostrarUrls && (
          <div className="mt-2.5 flex gap-2">
            <input
              type="url"
              value={urlManual}
              onChange={(e) => setUrlManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarUrlManual();
                }
              }}
              placeholder="https://ejemplo.com/foto-inmueble.jpg"
              className="campo flex-1 rounded-xl text-menor"
            />
            <button
              type="button"
              onClick={agregarUrlManual}
              disabled={!urlManual.trim() || valor.length >= MAX}
              className="btn btn-secundario shrink-0 text-menor"
            >
              Añadir foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
