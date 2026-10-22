'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

interface Props {
  url: string;
  titulo: string;
  tipo?: 'glb' | 'iframe';
}

export default function Tour3DViewer({ url, titulo, tipo }: Props) {
  const [inmersivo, setInmersivo] = useState(false);
  const esGlb = tipo === 'glb' || url.endsWith('.glb') || url.endsWith('.gltf');

  useEffect(() => {
    if (!inmersivo) return;

    const alPulsarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setInmersivo(false);
      }
    };

    document.addEventListener('keydown', alPulsarTecla);
    const scrollOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      document.body.style.overflow = scrollOriginal;
    };
  }, [inmersivo]);

  return (
    <section className="mb-8">
      {esGlb && (
        <Script
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
          type="module"
          strategy="lazyOnload"
        />
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="distintivo distintivo-senal font-semibold">
            {esGlb ? 'Modelo 3D Interactivo' : 'Experiencia 3D'}
          </span>
          <h2 className="text-grande font-semibold text-tinta">
            {esGlb ? 'Diseño y Modelo 3D' : 'Recorrido Virtual'}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setInmersivo(true)}
          className="btn btn-secundario text-menor flex items-center gap-1.5"
          aria-label="Abrir vista 3D a pantalla completa"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          <span>Pantalla completa</span>
        </button>
      </div>

      {/* Contenedor estándar incrustado */}
      <div className="relative h-96 w-full overflow-hidden rounded-2xl border border-linea bg-[#0B3F45] shadow-inner">
        {esGlb ? (
          <div className="relative h-full w-full">
            {/* @ts-expect-error Custom web component model-viewer */}
            <model-viewer
              src={url}
              alt={`Modelo 3D de ${titulo}`}
              auto-rotate
              camera-controls
              shadow-intensity="1.2"
              touch-action="pan-y"
              interaction-prompt="auto"
              style={{ width: '100%', height: '100%' }}
            />
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-micro text-white backdrop-blur-xs">
              Arrastra para rotar 360° · Usa la rueda para zoom
            </div>
          </div>
        ) : (
          <iframe
            src={url}
            title={`Recorrido 3D de ${titulo}`}
            className="h-full w-full"
            allowFullScreen
            allow="fullscreen; xr-spatial-tracking"
            sandbox="allow-scripts allow-same-origin allow-popups"
            loading="lazy"
          />
        )}
      </div>

      {/* Modo inmersivo a pantalla completa */}
      {inmersivo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vista 3D inmersiva de ${titulo}`}
          className="fixed inset-0 z-50 flex flex-col bg-[#0B3F45] p-3 sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between text-white">
            <div className="min-w-0 pr-4">
              <span className="text-micro font-bold uppercase tracking-wider text-[#5EEAD4]">
                {esGlb ? 'Modelo 3D Inmersivo' : 'Recorrido 3D Inmersivo'}
              </span>
              <p className="truncate text-cuerpo font-semibold">{titulo}</p>
            </div>

            <button
              type="button"
              onClick={() => setInmersivo(false)}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-menor font-medium text-white transition hover:bg-white/20"
              aria-label="Salir de pantalla completa"
            >
              <span>Cerrar (Esc)</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black">
            {esGlb ? (
              // @ts-expect-error Custom web component model-viewer
              <model-viewer
                src={url}
                alt={`Modelo 3D de ${titulo}`}
                auto-rotate
                camera-controls
                shadow-intensity="1.5"
                touch-action="pan-y"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <iframe
                src={url}
                title={`Recorrido 3D inmersivo de ${titulo}`}
                className="h-full w-full"
                allowFullScreen
                allow="fullscreen; xr-spatial-tracking"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
