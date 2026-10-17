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
//
// 📌 Y HAY UN TERCER ESTADO: "EL SERVIDOR NO ME RECONOCIÓ".
//
// `es_favorito` puede llegar ausente, y eso NO significa "no hay sesión": el
// servidor solo ve el pase corto, que dura 2 horas, mientras que el token que
// mantiene la sesión dura 30 días. Alguien que abre un enlace de WhatsApp a la
// mañana siguiente tiene la sesión viva y el pase vencido: la ficha sale
// anónima.
//
// En ese caso la isla se corrige sola: pregunta si el anuncio está guardado, y
// esa pregunta —que pasa por el cliente de la API, que renueva el pase por su
// cuenta— contesta las dos cosas de una vez. Si devuelve 401, no había sesión
// de verdad y se queda el enlace de entrar. Si devuelve 200, aparece el
// corazón, con su estado real.
//
// Es la diferencia entre "no sé" y "no": tratar la ausencia como un `false`
// pintaría un corazón apagado sobre algo que sí está guardado, y esos dos
// casos, para quien mira, no son lo mismo.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ErrorPeticion } from '@/lib/api';

export default function BotonFavorito({
  propiedadId,
  inicial,
  slug,
}: {
  propiedadId: number;
  /** Lo que dijo el servidor. Ausente = no pudo reconocer a quien mira. */
  inicial?: boolean;
  /** Para volver a esta ficha después de entrar (el interés ya está dado). */
  slug: string;
}) {
  const [haySesion, setHaySesion] = useState(inicial !== undefined);
  const [guardado, setGuardado] = useState(inicial ?? false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * La corrección de la que habla la cabecera. Solo hace algo cuando el
   * servidor no pudo reconocer al usuario: si ya trajo el dato, preguntar otra
   * vez sería una petición para que nos digan lo que ya sabemos.
   */
  useEffect(() => {
    if (inicial !== undefined) return;

    // El efecto puede desmontarse antes de que llegue la respuesta (StrictMode
    // monta, desmonta y vuelve a montar en desarrollo). Escribir estado
    // después sería escribir en un componente que ya no está.
    let vivo = true;

    api<{ es_favorito: boolean }>(`/api/favoritos/${propiedadId}`)
      .then((respuesta) => {
        if (!vivo) return;
        setGuardado(respuesta.es_favorito);
        setHaySesion(true);
      })
      .catch(() => {
        // 401: de verdad no hay sesión, o el servidor no respondió. En los dos
        // casos se deja el enlace de entrar, que es lo correcto para un
        // visitante. Y no se enseña el error: nadie hizo nada.
      });

    return () => {
      vivo = false;
    };
  }, [inicial, propiedadId]);

  /** Sin sesión, el botón sería un 401 disfrazado. */
  if (!haySesion) {
    return (
      <Link
        href={`/login?redirect=/propiedad/${slug}`}
        className="btn btn-secundario text-menor"
      >
        <span aria-hidden="true">♡</span> Guardar
      </Link>
    );
  }

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
