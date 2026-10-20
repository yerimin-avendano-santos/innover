'use client';

// ========================================
// 🔗 ACCIONES DE COMPARTIR FICHA
// ========================================
// Permite compartir la propiedad en WhatsApp y copiar el enlace
// al portapapeles con confirmación visual interactiva.

import { useState } from 'react';

interface Props {
  titulo: string;
  precioFormateado: string;
}

export default function AccionesCompartir({ titulo, precioFormateado }: Props) {
  const [copiado, setCopiado] = useState(false);

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Si el navegador bloquea el clipboard, seleccionamos el enlace
    }
  };

  const compartirWhatsApp = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const texto = encodeURIComponent(
      `¡Mira esta propiedad en Innover!\n*${titulo}*\nPrecio: ${precioFormateado}\n${url}`
    );
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button
        type="button"
        onClick={compartirWhatsApp}
        className="flex items-center gap-1.5 rounded-full border border-linea bg-papel-alto px-3 py-1.5 text-menor font-medium text-tinta transition hover:border-linea-fuerte hover:bg-papel"
        aria-label="Compartir propiedad por WhatsApp"
      >
        <svg
          className="h-4 w-4 text-[#25D366]"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.146-.532-1.859-.773-3.045-2.673-3.138-2.796-.092-.124-.755-.999-.755-1.906 0-.907.478-1.354.648-1.538.17-.184.372-.23.497-.23.125 0 .248.001.356.006.113.006.265-.043.414.316.155.375.529 1.289.576 1.382.047.094.078.204.016.328-.063.125-.094.204-.188.312-.093.109-.196.243-.28.326-.094.093-.192.195-.083.382.109.187.485.801 1.042 1.296.718.638 1.324.836 1.512.929.188.094.298.079.408-.047.109-.125.469-.546.594-.733.125-.188.25-.157.422-.094.172.063 1.093.516 1.281.609.187.094.312.141.359.219.047.078.047.452-.097.857z" />
        </svg>
        <span>WhatsApp</span>
      </button>

      <button
        type="button"
        onClick={copiarEnlace}
        className="flex items-center gap-1.5 rounded-full border border-linea bg-papel-alto px-3 py-1.5 text-menor font-medium text-tinta transition hover:border-linea-fuerte hover:bg-papel"
        aria-label="Copiar enlace de la propiedad"
      >
        <svg
          className="h-4 w-4 text-tinta-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <span>{copiado ? '¡Enlace copiado!' : 'Copiar enlace'}</span>
      </button>
    </div>
  );
}

