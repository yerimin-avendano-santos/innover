'use client';

/* eslint-disable @next/next/no-img-element -- ver el motivo más abajo */

// ========================================
// 🖼️ GALERÍA DE FOTOS DE LA FICHA
// ========================================
//
// 📌 POR QUÉ ES UNA ISLA DE CLIENTE Y NO PARTE DE LA FICHA
//
// La ficha entera se sirve desde el servidor a propósito: su contenido tiene
// que llegar ESCRITO en el HTML, porque es el enlace que se comparte por
// WhatsApp y lo que indexa Google. La galería necesita una sola cosa que el
// servidor no puede dar: reaccionar a un clic. Así que es una isla —lo demás
// sigue siendo HTML— y la foto principal también se pinta en el primer
// render, que es el que ve un rastreador.
//
// ⛔ AQUÍ SE USA `<img>` Y NO `next/image`, Y NO ES UN DESCUIDO.
//
// El optimizador de Next NO le pasa la dirección al navegador: la descarga él,
// en el SERVIDOR, para redimensionarla. Y estas direcciones las escribe quien
// publica: bastaría con pegar `http://169.254.169.254/latest/meta-data/` —la
// dirección de metadatos de cualquier servidor en la nube— para usar la ficha
// como puerta hacia la red interna, que es un SSRF de manual. Un `<img>` hace
// que la descarga la haga el NAVEGADOR de quien mira la página, que no puede
// llegar a nada que no pudiera llegar ya. De regalo, tampoco hay que mantener
// una lista blanca de dominios para fotos pegadas a mano, que es imposible de
// mantener por definición.
//
// El `width`/`height` y el `aspect-[4/3]` son los que evitan el salto de
// maquetación que el optimizador vendía como argumento: el hueco está
// reservado ANTES de que la foto llegue.

import { useState, useEffect, useCallback } from 'react';

export default function Galeria({
  imagenes,
  titulo,
}: {
  imagenes: string[];
  titulo: string;
}) {
  const [elegida, setElegida] = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);

  // El índice se recorta en vez de confiar: si la lista cambiara por debajo,
  // `imagenes[7]` de una lista de 3 daría `undefined` y la foto saldría rota.
  const indice = Math.min(elegida, imagenes.length - 1);
  const principal = imagenes[indice];
  const varias = imagenes.length > 1;

  const siguiente = useCallback(() => {
    setElegida((actual) => (actual + 1) % imagenes.length);
  }, [imagenes.length]);

  const anterior = useCallback(() => {
    setElegida((actual) => (actual - 1 + imagenes.length) % imagenes.length);
  }, [imagenes.length]);

  // Navegación por teclado en el visor a pantalla completa
  useEffect(() => {
    if (!modalAbierto) return;

    const alPulsarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setModalAbierto(false);
      } else if (evento.key === 'ArrowRight') {
        siguiente();
      } else if (evento.key === 'ArrowLeft') {
        anterior();
      }
    };

    document.addEventListener('keydown', alPulsarTecla);
    // Bloquear scroll de fondo mientras el visor está abierto
    const scrollOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      document.body.style.overflow = scrollOriginal;
    };
  }, [modalAbierto, siguiente, anterior]);

  return (
    <>
      <figure className="mb-6">
        <div className="group relative overflow-hidden rounded-grande border border-linea bg-papel-hundido">
          <img
            src={principal}
            alt={`${titulo} — foto ${indice + 1} de ${imagenes.length}`}
            width={1200}
            height={900}
            className="aspect-[4/3] w-full cursor-zoom-in object-cover transition-transform duration-200 group-hover:scale-[1.01]"
            onClick={() => setModalAbierto(true)}
          />

          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-marino/80 px-3 py-1.5 text-menor font-medium text-sobre-marino backdrop-blur-xs transition hover:bg-marino"
            aria-label="Abrir galería a pantalla completa"
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
            <span>Ver fotos ({imagenes.length})</span>
          </button>
        </div>

        {varias && (
          <div className="sin-barra mt-2 flex gap-2 overflow-x-auto">
            {imagenes.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setElegida(i)}
                aria-label={`Ver la foto ${i + 1}`}
                aria-current={i === indice}
                className={`shrink-0 overflow-hidden rounded-chico border transition-colors ${
                  i === indice
                    ? 'border-senal'
                    : 'border-linea hover:border-linea-fuerte'
                }`}
              >
                {/* Vacío a propósito: la miniatura repite la foto que ya está
                    descrita arriba y tiene su propio botón etiquetado. Un lector
                    de pantalla anunciaría ocho veces lo mismo. */}
                <img
                  src={url}
                  alt=""
                  width={160}
                  height={120}
                  className={`h-14 w-20 object-cover transition-opacity ${
                    i === indice ? '' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        {varias && (
          <figcaption className="mt-1 text-micro text-tinta-50">
            Foto {indice + 1} de {imagenes.length}
          </figcaption>
        )}
      </figure>

      {/* --- Lightbox modal a pantalla completa --- */}
      {modalAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galería de ${titulo}`}
          className="fixed inset-0 z-50 flex flex-col justify-between bg-marino/95 p-4 backdrop-blur-sm sm:p-6"
        >
          {/* Barra superior con título y botón de cierre */}
          <div className="flex items-center justify-between text-sobre-marino">
            <div className="min-w-0 pr-4">
              <p className="truncate text-cuerpo font-medium">{titulo}</p>
              <p className="text-micro text-sobre-senal-tenue">
                Foto {indice + 1} de {imagenes.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sobre-marino transition hover:bg-white/20"
              aria-label="Cerrar visor"
            >
              <svg
                className="h-5 w-5"
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

          {/* Foto principal centrada con controles anterior/siguiente */}
          <div className="relative flex flex-1 items-center justify-center py-4">
            {varias && (
              <button
                type="button"
                onClick={anterior}
                className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sobre-marino backdrop-blur-xs transition hover:bg-white/20 sm:left-4"
                aria-label="Foto anterior"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            <img
              src={principal}
              alt={`${titulo} — foto ${indice + 1} de ${imagenes.length}`}
              className="max-h-[75vh] max-w-full rounded-medio object-contain shadow-2xl"
            />

            {varias && (
              <button
                type="button"
                onClick={siguiente}
                className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sobre-marino backdrop-blur-xs transition hover:bg-white/20 sm:right-4"
                aria-label="Foto siguiente"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Carrusel inferior de miniaturas en el modal */}
          {varias && (
            <div className="sin-barra flex justify-center gap-2 overflow-x-auto py-2">
              {imagenes.map((url, i) => (
                <button
                  key={`modal-${url}-${i}`}
                  type="button"
                  onClick={() => setElegida(i)}
                  aria-label={`Ir a la foto ${i + 1}`}
                  className={`shrink-0 overflow-hidden rounded-chico border-2 transition ${
                    i === indice
                      ? 'border-turquesa opacity-100'
                      : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img
                    src={url}
                    alt=""
                    width={80}
                    height={60}
                    className="h-12 w-16 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
