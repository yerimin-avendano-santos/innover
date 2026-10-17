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

import { useState } from 'react';

export default function Galeria({
  imagenes,
  titulo,
}: {
  imagenes: string[];
  titulo: string;
}) {
  const [elegida, setElegida] = useState(0);

  // El índice se recorta en vez de confiar: si la lista cambiara por debajo,
  // `imagenes[7]` de una lista de 3 daría `undefined` y la foto saldría rota.
  const indice = Math.min(elegida, imagenes.length - 1);
  const principal = imagenes[indice];
  const varias = imagenes.length > 1;

  return (
    <figure className="mb-6">
      <img
        src={principal}
        alt={`${titulo} — foto ${indice + 1} de ${imagenes.length}`}
        width={1200}
        height={900}
        className="aspect-[4/3] w-full rounded-grande border border-linea bg-papel-hundido object-cover"
      />

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
  );
}
