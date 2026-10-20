'use client';

/* eslint-disable @next/next/no-img-element -- el motivo está en components/Galeria.tsx */

// ========================================
// 📷 FOTOS DE UNA PUBLICACIÓN
// ========================================
//
// 📌 POR QUÉ SE PEGAN DIRECCIONES Y NO SE SUBEN ARCHIVOS TODAVÍA
//
// Subir archivos pide almacenamiento en la nube (S3, Cloudinary) y unas
// credenciales que este proyecto todavía no tiene. Y resulta que para lo único
// que hace falta —que un anuncio enseñe fotos— no son necesarias: la base ya
// guarda `imagenes` como una LISTA DE DIRECCIONES.
//
// La decisión de guardar direcciones no es un apaño, y conviene no perderla de
// vista: el día que exista la subida, el formulario guardará exactamente lo
// mismo —la dirección que devuelva el almacenamiento— y ni la ficha ni la
// tarjeta de la búsqueda cambiarán una línea. Lo que cambia es este control
// (un campo de texto ahora, un botón de subir después), no el dato.
//
// ⚠️ Y por eso mismo las direcciones las escribe una persona, lo que tiene una
// consecuencia de seguridad que está explicada en `components/Galeria.tsx`:
// nada de `next/image` con estas fotos, porque su optimizador las descargaría
// desde el servidor.

/** El mismo tope que valida el servidor (`z.array(url).max(20)`). */const MAX = 20;

export default function CampoImagenes({
  valor,
  onChange,
  error,
}: {
  valor: string[];
  onChange: (urls: string[]) => void;
  error?: string;
}) {
  const agregar = () => {
    if (valor.length >= MAX) return;
    onChange([...valor, '']);
  };

  const cambiar = (i: number, texto: string) => {
    onChange(valor.map((u, j) => (j === i ? texto : u)));
  };

  const quitar = (i: number) => {
    onChange(valor.filter((_, j) => j !== i));
  };

  const subir = (i: number) => {
    if (i === 0) return;
    const copia = [...valor];
    [copia[i - 1], copia[i]] = [copia[i], copia[i - 1]];
    onChange(copia);
  };

  const bajar = (i: number) => {
    if (i === valor.length - 1) return;
    const copia = [...valor];
    [copia[i + 1], copia[i]] = [copia[i], copia[i + 1]];
    onChange(copia);
  };

  const hacerPortada = (i: number) => {
    if (i === 0) return;
    const elemento = valor[i];
    const resto = valor.filter((_, idx) => idx !== i);
    onChange([elemento, ...resto]);
  };

  /**
   * Al salir del campo: quitar espacios y poner el `https://` que falta.
   *
   * Quien copia una dirección suele copiar `www.algo.com/foto.jpg` o la ruta
   * suelta, y el servidor exige el esquema. Perdonarlo aquí es más barato que
   * devolverle un error de validación por algo que la máquina puede completar
   * sola. Si aun así no es una dirección válida, el servidor lo dirá.
   */
  const normalizar = (i: number) => {
    const texto = valor[i].trim();
    if (!texto) return;

    const conEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;
    if (conEsquema !== valor[i]) cambiar(i, conEsquema);
  };

  return (
    <div>
      <span className="etiqueta">
        Fotos{' '}
        <span className="font-normal text-tinta-30">
          {valor.length > 0 && `· ${valor.length} de ${MAX}`}
        </span>
      </span>

      {valor.length === 0 ? (
        <p className="mb-3 text-menor text-tinta-50">
          Todavía no hay fotos. Pega la dirección de cada una —la primera será
          la portada, la que se ve al compartir el anuncio— y quedará en la
          ficha en ese orden.
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {valor.map((url, i) => (
            <li key={i} className="flex items-center gap-2">
              <Miniatura url={url} posicion={i + 1} />

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => cambiar(i, e.target.value)}
                  onBlur={() => normalizar(i)}
                  placeholder="https://…/foto.jpg"
                  aria-label={`Foto ${i + 1}${i === 0 ? ' (portada)' : ''}`}
                  // `inputMode=url` saca el teclado con barra y punto en el
                  // móvil, que es donde se pega una dirección.
                  inputMode="url"
                  autoComplete="off"
                  className="campo"
                />
              </div>

              {i === 0 ? (
                <span className="distintivo distintivo-senal shrink-0">Portada</span>
              ) : (
                <button
                  type="button"
                  onClick={() => hacerPortada(i)}
                  className="distintivo distintivo-neutro shrink-0 cursor-pointer hover:border-linea-fuerte"
                  title="Mover esta foto como la portada principal"
                >
                  Hacer portada
                </button>
              )}

              {/* Botones de orden y eliminación con teclado accesible */}
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => subir(i)}
                  disabled={i === 0}
                  aria-label={`Subir la foto ${i + 1}`}
                  title="Subir posición"
                  className="btn btn-fantasma px-1.5 py-1 text-cuerpo disabled:opacity-30"
                >
                  ↑
                </button>

                <button
                  type="button"
                  onClick={() => bajar(i)}
                  disabled={i === valor.length - 1}
                  aria-label={`Bajar la foto ${i + 1}`}
                  title="Bajar posición"
                  className="btn btn-fantasma px-1.5 py-1 text-cuerpo disabled:opacity-30"
                >
                  ↓
                </button>

                <button
                  type="button"
                  onClick={() => quitar(i)}
                  aria-label={`Quitar la foto ${i + 1}`}
                  title="Quitar"
                  className="btn btn-fantasma px-1.5 py-1 text-cuerpo text-alerta hover:bg-alerta-suave"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={agregar}
          disabled={valor.length >= MAX}
          className="btn btn-secundario text-menor"
        >
          Añadir foto
        </button>

        {valor.length >= MAX && (
          <span className="text-micro text-tinta-50">
            El máximo son {MAX} fotos por anuncio.
          </span>
        )}
      </div>

      {error ? (
        <p className="mt-1 text-micro text-alerta">{error}</p>
      ) : (
        <p className="mt-1 text-micro text-tinta-30">
          Direcciones que empiecen por http:// o https://. Al pegar una sin el
          «https://», se completa sola.
        </p>
      )}
    </div>
  );
}

/**
 * La vista previa de una fila.
 *
 * Solo intenta cargar la imagen si lo que hay escrito YA parece una dirección
 * (`http…`) y es más larga que el propio esquema: mientras se escribe, un
 * `<img>` con la dirección a medias dispara una petición por pulsación y
 * revienta el registro del navegador. Mientras tanto enseña el número de la
 * foto, que es la información útil en ese momento.
 */
function Miniatura({ url, posicion }: { url: string; posicion: number }) {
  const pareceUrl = /^https?:\/\/\S+$/i.test(url);

  if (!pareceUrl) {
    return (
      <div
        aria-hidden="true"
        className="cifra grid h-10 w-10 shrink-0 place-items-center rounded-chico border border-linea bg-papel-hundido text-micro text-tinta-30"
      >
        {posicion}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      width={80}
      height={80}
      loading="lazy"
      className="h-10 w-10 shrink-0 rounded-chico border border-linea bg-papel-hundido object-cover"
    />
  );
}
