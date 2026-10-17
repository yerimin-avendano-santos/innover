'use client';

// ========================================
// 🖱️ LO INTERACTIVO DE LA FICHA
// ========================================
// La ficha se sirve desde el servidor (ver `app/propiedad/[slug]/page.tsx`),
// así que lo que necesita estado o sesión vive aquí aparte.
//
// Son DOS trozos y no uno porque van en dos sitios distintos de la página:
// las acciones del dueño, arriba junto al titular, y el contacto, en la
// columna lateral.
//
// 📌 POR QUÉ EL VEREDICTO SE CALCULA AQUÍ Y NO EN EL SERVIDOR
//
// "¿Esto es mío?" necesita dos datos: el id del dueño, que ya lo tiene el
// servidor, y quién eres tú. El servidor PODRÍA saberlo —de hecho reenvía tu
// cookie al backend, para que el dueño pueda ver su propio BORRADOR—, pero la
// sesión también cambia SIN recargar la página: al entrar o al salir, este
// bloque tiene que reaccionar en el sitio. Por eso el servidor solo aporta el
// dato que él sí tiene (`propietarioId`) y el veredicto se toma aquí, con el
// contexto de sesión, que es lo que cambia en vivo.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ErrorPeticion } from '@/lib/api';
import { useAuth } from '@/contextos/Auth';
import type { Usuario } from '@/lib/tipos';

/**
 * ¿Esta persona puede administrar esta publicación?
 *
 * Se extrae a una función porque la pregunta se hace en dos sitios y con dos
 * consecuencias distintas (enseñar los botones de dueño, o esconder el
 * formulario de contacto). Dos copias de la misma condición es cómo se acaba
 * con una pantalla que dice "esta publicación es tuya" y a la vez ofrece
 * contactarte a ti mismo.
 */
function esDuenio(usuario: Usuario | null, propietarioId: number | null): boolean {
  return usuario !== null && (usuario.id === propietarioId || usuario.rol === 'ADMIN');
}

/** Editar y eliminar, junto al titular. Solo los ve quien puede usarlos. */
export function AccionesDuenio({
  propiedadId,
  propietarioId,
}: {
  propiedadId: number;
  propietarioId: number | null;
}) {
  const { usuario } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  if (!esDuenio(usuario, propietarioId)) return null;

  const alEliminar = async () => {
    // `confirm` es del navegador, y borrar una publicación no se deshace:
    // vale la pena la interrupción.
    if (!confirm('¿Eliminar esta publicación? No se puede deshacer.')) return;

    try {
      await api(`/api/propiedades/${propiedadId}`, { metodo: 'DELETE' });
      router.push('/');
      router.refresh();
    } catch (e) {
      // El error se enseña AQUÍ, debajo de los botones. Antes sustituía la
      // página entera por un mensaje, así que un fallo al borrar te dejaba
      // sin la propiedad delante para volver a intentarlo.
      setError(e instanceof ErrorPeticion ? e.message : 'No se pudo eliminar.');
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-2">
        <Link
          href={`/publicar/${propiedadId}`}
          className="btn btn-secundario text-menor"
        >
          Editar
        </Link>
        <button
          type="button"
          onClick={alEliminar}
          className="btn btn-secundario text-menor text-alerta"
        >
          Eliminar
        </button>
      </div>

      {error && (
        <p role="alert" className="text-micro text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * La columna de contacto, con sus cuatro estados posibles.
 *
 * El orden de las comprobaciones importa: primero "ya lo enviaste", después
 * "es tuya", después "no tienes sesión" y solo al final el formulario. Si el
 * orden fuera otro, el dueño de la propiedad vería el formulario para
 * escribirse a sí mismo.
 */
export function PanelContacto({
  propiedadId,
  propietarioId,
  slug,
}: {
  propiedadId: number;
  propietarioId: number | null;
  slug: string;
}) {
  const { estaConectado, usuario, cargando } = useAuth();

  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alContactar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      await api('/api/contactos', {
        metodo: 'POST',
        cuerpo: {
          propiedad_id: propiedadId,
          mensaje,
          telefono: usuario?.telefono ?? undefined,
        },
      });
      setEnviado(true);
      setMensaje('');
    } catch (e) {
      setError(e instanceof ErrorPeticion ? e.message : 'No pudimos enviar tu mensaje.');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Mientras se comprueba la sesión no se enseña ninguno de los cuatro.
   *
   * Sin esto, quien ya tiene cuenta vería un instante el "Entra para
   * contactar al propietario" de los visitantes anónimos: un parpadeo que le
   * está diciendo justo lo contrario de lo que es cierto.
   */
  if (cargando) {
    return <div className="h-28 animate-pulse rounded-medio bg-papel-hundido" />;
  }

  if (enviado) {
    return (
      <div className="py-4 text-center">
        <p className="text-cuerpo font-medium text-tinta">Mensaje enviado</p>
        <p className="mt-1 text-menor text-tinta-50">
          Te responderemos por correo. Revisa tu bandeja de spam.
        </p>
      </div>
    );
  }

  if (esDuenio(usuario, propietarioId)) {
    return <p className="text-cuerpo text-tinta-50">Esta publicación es tuya.</p>;
  }

  if (!estaConectado) {
    return (
      <div>
        <p className="mb-3 text-cuerpo text-tinta-50">
          Entra para contactar al propietario.
        </p>
        {/*
          `?redirect=` devuelve a la persona a ESTA ficha después de entrar.
          Sin eso, quien venía de un enlace compartido acabaría en la portada
          y tendría que volver a buscar la propiedad que le pasaron.
        */}
        <Link
          href={`/login?redirect=/propiedad/${slug}`}
          className="btn btn-principal w-full"
        >
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={alContactar} className="space-y-3">
      <div>
        <label htmlFor="mensaje" className="etiqueta">
          Tu mensaje
        </label>
        <textarea
          id="mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          required
          minLength={10}
          rows={4}
          placeholder="Hola, me interesa esta propiedad…"
          className="campo resize-y"
        />
        {error && (
          <p role="alert" className="mt-1 text-micro text-alerta">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={enviando || mensaje.trim().length < 10}
        className="btn btn-principal w-full"
      >
        {enviando ? 'Enviando…' : 'Contactar'}
      </button>
    </form>
  );
}
