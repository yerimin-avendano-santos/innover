'use client';

// ========================================
// 🌐 VISOR DE RECORRIDO 3D (TOUR 3D)
// ========================================
// Permite visualizar recorridos virtuales (Matterport, Kuula, etc.)
// tanto incrustados en la ficha como aislados en modo inmersivo a
// pantalla completa.
//
// ⚠️ SEGURIDAD:
// El iframe lleva `sandbox="allow-scripts allow-same-origin allow-popups"`
// y `allow="fullscreen; xr-spatial-tracking"`. Esto previene que un enlace
// malintencionado pueda navegar la ventana principal o leer cookies.

import { useState, useEffect } from 'react';

interface Props {
  url: string;
  titulo: string;
}

export default function Tour3DViewer({ url, titulo }: Props) {
  const [inmersivo, setInmersivo] = useState(false);

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
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="distintivo distintivo-senal">Experiencia 3D</span>
          <h2 className="text-grande font-semibold text-tinta">Recorrido Virtual</h2>
        </div>

        <button
          type="button"
          onClick={() => setInmersivo(true)}
          className="btn btn-secundario text-menor"
          aria-label="Abrir recorrido 3D a pantalla completa"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
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
      <div className="relative overflow-hidden rounded-grande border border-linea bg-papel-hundido">
        <iframe
          src={url}
          title={`Recorrido 3D de ${titulo}`}
          className="h-96 w-full"
          allowFullScreen
          allow="fullscreen; xr-spatial-tracking"
          sandbox="allow-scripts allow-same-origin allow-popups"
          loading="lazy"
        />
      </div>

      {/* Modo inmersivo a pantalla completa */}
      {inmersivo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Recorrido 3D inmersivo de ${titulo}`}
          className="fixed inset-0 z-50 flex flex-col bg-marino p-3 sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between text-sobre-marino">
            <div className="min-w-0 pr-4">
              <span className="text-micro font-medium uppercase tracking-wider text-turquesa">
                Recorrido 3D inmersivo
              </span>
              <p className="truncate text-cuerpo font-semibold">{titulo}</p>
            </div>

            <button
              type="button"
              onClick={() => setInmersivo(false)}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-menor font-medium text-sobre-marino transition hover:bg-white/20"
              aria-label="Salir de pantalla completa"
            >
              <span>Cerrar (Esc)</span>
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-hidden rounded-medio border border-white/10 bg-black">
            <iframe
              src={url}
              title={`Recorrido 3D inmersivo de ${titulo}`}
              className="h-full w-full"
              allowFullScreen
              allow="fullscreen; xr-spatial-tracking"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </div>
      )}
    </section>
  );
}

