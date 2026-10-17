'use client';

// ========================================
// ❤️ Guardar el anuncio (el corazón de la ficha)
// ========================================
// La ficha se sirve desde el servidor, así que aquí vive lo único que necesita
// estado. Lo que se pinta es un INTERRUPTOR, y su estado inicial llega con la
// página (`es_favorito`), no de una consulta al montarse: preguntándolo al
// abrirse, el corazón aparecería apagado un instante aunque estuviera
// encendido, y ese parpadeo hace dudar de si guardó o no.
//
// 📌 EL ESTADO CAMBIA AL INSTANTE Y SE DESHACE SI EL SERVIDOR DICE QUE NO.
//
// Guardar no debería sentirse como rellenar un formulario. Si el corazón
// esperara lo que tarda la red, se apretaría dos veces "por si acaso", y un
// botón que no responde invita a eso. Se pinta el resultado esperado; si la
// petición falla, se vuelve atrás y se explica por qué — ese es el único caso
// en que la interfaz tiene algo distinto que decir.

import { useState } from 'react';
import { api, ErrorPeticion } from '@/lib/api';

export default function BotonFavorito({
  propiedadId,
  inicial,
}: {
  propiedadId: number;
  /** Lo que dijo el servidor al servir la página. */
  inicial: boolean;
}) {
  const [guardado, setGuardado] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alternar = async () => {
    // Un doble clic no puede mandar dos peticiones contradictorias: la segunda
    // saldría con el estado viejo y el resultado dependería de cuál conteste
    // última. Con esto, el segundo clic simplemente no hace nada.
    if (enviando) return;

    const objetivo = !guardado;
    setGuardado(objetivo);
    setEnviando(true);
    setError(null);

    try {
      if (objetivo) {
        await api('/api/favoritos', {
          metodo: 'POST',
          cuerpo: { propiedad_id: propiedadId },
        });
      } else {
        await api(`/api/favoritos/${propiedadId}`, { metodo: 'DELETE' });
      }
    } catch (e) {
      // Se deshace lo que se había pintado: dejarlo encendido después de un
      // fallo sería mentir sobre algo que el usuario cree hecho.
      setGuardado(!objetivo);
      setError(
        e instanceof ErrorPeticion
          ? e.message
          : 'No pudimos guardarlo. Revisa tu conexión.'
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={alternar}
        disabled={enviando}
        // `aria-pressed` es lo que convierte un botón en un interruptor para
        // quien no ve el color: dice si está activado o no, en vez de dejar que
        // se adivine por el texto.
        aria-pressed={guardado}
        className={`btn ${guardado ? 'btn-turquesa' : 'btn-secundario'} text-menor`}
        title={guardado ? 'Quitar de guardados' : 'Guardar para volver a verlo'}
      >
        <span aria-hidden="true">{guardado ? '♥' : '♡'}</span>{' '}
        {guardado ? 'Guardado' : 'Guardar'}
      </button>

      {error && (
        <p role="alert" className="text-micro text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}
