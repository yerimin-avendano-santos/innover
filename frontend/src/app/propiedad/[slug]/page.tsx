// ========================================
// 📄 FICHA DE UNA PROPIEDAD
// ========================================
// La página de detalle. Se accede por slug, no por id:
//     /propiedad/departamento-vista-al-mar-miraflores-1
//
// Un id numérico se puede adivinar recorriendo /propiedad/1, /2, /3.
// Un slug no, y de paso le dice al usuario de qué trata el enlace antes
// de abrirlo.
//
// 📌 ESTA PÁGINA SE DIBUJA EN EL SERVIDOR, Y ESO ES EL MOTIVO DEL BLOQUE
//
// Antes era un componente de cliente que pedía la propiedad en un
// `useEffect`. Funcionaba para una persona y no servía para lo único para lo
// que esta página existe: ser el enlace que se comparte por WhatsApp y lo que
// indexa Google. El HTML llegaba VACÍO —sin titular, sin precio, sin un solo
// dato, sin metadatos propios— y el contenido aparecía después, cuando
// arrancaba JavaScript.
//
// Se comprobó pidiendo la página de una propiedad real: el `<title>` era el
// genérico del layout y el nombre de la propiedad no aparecía por ningún
// lado. La mitad de la regla —"la ficha es pública"— estaba cumplida; la otra
// mitad, la razón por la que se dejó pública, no.
//
// La guía visual lo pedía desde el principio (`design/desing.md`): *Server
// Components para el SEO de las fichas públicas*. Aquí está.
//
// Lo interactivo —los botones del dueño y el formulario de contacto— vive en
// `components/AccionesPropiedad.tsx`.
//
// ⚠️ NO HAY `loading.tsx` A PROPÓSITO.
//
// Añadirlo sería lo natural para enseñar un esqueleto mientras se carga, y
// rompería el SEO de esta página. La documentación de Next lo dice: cuando la
// respuesta se envía en streaming el estado es 200, y sin streaming es 404.
// Con un `loading.tsx` esta ruta emitiría 200 incluso para una propiedad que
// no existe —un "soft 404"— y Google indexaría como válidas las URLs
// inventadas. El esqueleto es más bonito; el 404 de verdad es lo correcto.
// Sin `loading.tsx` tampoco se pierde nada al navegar: el router mantiene la
// pantalla anterior hasta que llega la nueva.

import { cache } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AccionesDuenio, PanelContacto } from '@/components/AccionesPropiedad';
import BotonFavorito from '@/components/BotonFavorito';
import Galeria from '@/components/Galeria';
import { Mapa } from '@/components/Mapa';
import { formatearPrecio, precioPorM2, etiquetaTipo } from '@/lib/api';
import { aPuntosDeMapa } from '@/lib/mapa';
import type { Propiedad } from '@/lib/tipos';

/**
 * URL del backend. Solo la ve el SERVIDOR, nunca el navegador: por eso no
 * lleva el prefijo NEXT_PUBLIC_. Es la misma variable que usa el puente
 * (`app/api/[...ruta]/route.ts`).
 */
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

/**
 * El resultado de buscar una propiedad, con los dos fallos SEPARADOS.
 *
 * 📌 POR QUÉ NO BASTA CON `Propiedad | null`
 *
 * "Esta propiedad no existe" y "el backend no me contestó" acaban los dos en
 * `null`, y no son lo mismo ni de lejos:
 *
 *   · No existe        → 404. Es la verdad, y Google debe dejar de indexarla.
 *   · No me contestó   → un fallo temporal. Devolver 404 aquí sería decirle a
 *                        Google que una propiedad que SÍ existe ha
 *                        desaparecido: la desindexaría, y el dueño perdería
 *                        su enlace por un corte de red.
 *
 * Distinguirlos es la diferencia entre una caída pasajera y perder el
 * catálogo de cara al buscador.
 */
type Busqueda =
  | { estado: 'ok'; propiedad: Propiedad }
  | { estado: 'no-existe' }
  | { estado: 'fallo' };

/**
 * Trae la propiedad del backend, desde el servidor.
 *
 * Va envuelto en `cache()` de React para que `generateMetadata` y la página
 * —que necesitan lo mismo— no pidan la propiedad dos veces en la misma
 * petición. Es una caché de UN SOLO render: no guarda nada entre visitantes.
 *
 * La cookie SÍ se reenvía, y hace falta: la ruta de la ficha es pública,
 * pero el backend solo deja ver un BORRADOR a su dueño. Sin reenviarla, el
 * dueño no podría abrir su propio anuncio sin publicar.
 */
const traerPropiedad = cache(async (slug: string): Promise<Busqueda> => {
  const jar = await cookies();
  const cookie = jar.toString();

  try {
    const respuesta = await fetch(
      `${BACKEND}/api/propiedades/${encodeURIComponent(slug)}`,
      {
        headers: cookie ? { cookie } : {},
        // Nada de caché: si el dueño cambia el precio y recarga, tiene que
        // verlo. Es el mismo criterio que sigue el puente.
        cache: 'no-store',
      }
    );

    if (respuesta.status === 404) return { estado: 'no-existe' };

    // 403 = "existe, pero no es para ti": un BORRADOR ajeno. Hacia fuera se
    // contesta lo mismo que si no existiera, y no es un detalle de estilo:
    // decir "existe pero no puedes verlo" convierte esta ruta en un oráculo
    // para averiguar qué hay sin publicar. Un borrador es justo lo que su
    // dueño todavía no ha decidido enseñar.
    if (respuesta.status === 403) return { estado: 'no-existe' };

    if (!respuesta.ok) return { estado: 'fallo' };

    const datos = await respuesta.json();
    if (!datos?.propiedad) return { estado: 'no-existe' };

    return { estado: 'ok', propiedad: datos.propiedad as Propiedad };
  } catch {
    // El backend no respondió: está caído, o arrancando.
    return { estado: 'fallo' };
  }
});

/** Un renglón con los datos que caben en un resultado de búsqueda. */
function descripcionDe(propiedad: Propiedad): string {
  return [
    `${etiquetaTipo(propiedad.tipo_inmueble)} en ${
      propiedad.tipo === 'VENTA' ? 'venta' : 'alquiler'
    }`,
    propiedad.distrito?.nombre ? `en ${propiedad.distrito.nombre}` : 'en Huánuco',
    `· ${formatearPrecio(propiedad.precio, propiedad.moneda)}`,
    propiedad.area_m2 ? `· ${propiedad.area_m2} m²` : null,
    propiedad.habitaciones ? `· ${propiedad.habitaciones} habitaciones` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Los metadatos de la ficha.
 *
 * Es lo que hace que un enlace compartido por WhatsApp se vea como LA
 * PROPIEDAD y no como "Innover · Propiedades en el mapa": sin esto, los
 * títulos y la descripción son los de la portada, y quien recibe el enlace no
 * sabe qué le están mandando.
 *
 * El `title` de aquí se combina con la plantilla del layout (`%s · Innover`),
 * así que se devuelve solo el nombre de la propiedad.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const busqueda = await traerPropiedad(slug);

  if (busqueda.estado !== 'ok') {
    return { title: 'Propiedad no encontrada' };
  }

  const propiedad = busqueda.propiedad;
  const descripcion = descripcionDe(propiedad);

  /**
   * La portada: la primera foto. Es lo que convierte el enlace en una tarjeta
   * con imagen al compartirlo, que es para lo que existe esta página.
   *
   * No hay que componer ninguna dirección con el dominio del sitio: las fotos
   * ya son direcciones absolutas porque las escribe quien publica (y el
   * esquema solo acepta `http://` o `https://`).
   */
  const portada = propiedad.imagenes?.[0];

  return {
    title: propiedad.titulo,
    description: descripcion,
    openGraph: {
      title: propiedad.titulo,
      description: descripcion,
      type: 'article',
      // Sin foto NO se manda un `images` vacío: la previsualización saldría
      // con un recuadro roto, que se ve peor que no tener miniatura.
      ...(portada ? { images: [{ url: portada, alt: propiedad.titulo }] } : {}),
    },
  };
}

export default async function PaginaPropiedad({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const busqueda = await traerPropiedad(slug);

  // Los tres finales posibles, cada uno con su estado HTTP correcto:
  // 404 si no existe, error de servidor si no se pudo preguntar, y la ficha
  // si todo fue bien.
  if (busqueda.estado === 'no-existe') notFound();
  if (busqueda.estado === 'fallo') {
    throw new Error('No se pudo cargar la propiedad: el backend no respondió.');
  }

  const propiedad = busqueda.propiedad;
  const porM2 = precioPorM2(propiedad.precio, propiedad.area_m2, propiedad.moneda);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* ---------- Encabezado ---------- */}
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="distintivo distintivo-neutro">
            {etiquetaTipo(propiedad.tipo_inmueble)}
          </span>
          <span className="distintivo distintivo-neutro">
            {propiedad.tipo === 'VENTA' ? 'Venta' : 'Alquiler'}
          </span>
          {propiedad.destacado && (
            // `destacado` es el anuncio pagado; `aviso` es otra cosa (una
            // tarea pendiente). Compartían color y por eso se separaron.
            <span className="distintivo distintivo-destacado">Destacado</span>
          )}
          {propiedad.estado !== 'PUBLICADA' && (
            <span className="distintivo distintivo-aviso">{propiedad.estado}</span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-titulo font-semibold leading-tight text-tinta">
            {propiedad.titulo}
          </h1>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {/*
              Guardar es lo ÚNICO de esta página que hace alguien que todavía
              no es cliente, así que va arriba y con nombre: un corazón suelto
              hay que adivinarlo.

              📌 Y SIN SESIÓN NO HAY BOTÓN: HAY ENLACE.

              Guardar exige cuenta, así que ofrecer el botón a un visitante
              sería ofrecerle un 401. El servidor manda `es_favorito` solo si
              reconoce a quien mira (ver `obtenerPropiedadPorId`), así que su
              ausencia es la señal — la interfaz no adivina nada mirando una
              cookie que no puede leer. El enlace lleva de vuelta aquí después
              de entrar, porque el interés ya está demostrado y perderlo sería
              tirar el único dato bueno que ha dado este visitante.
            */}
            {propiedad.es_favorito === undefined ? (
              <Link
                href={`/login?redirect=/propiedad/${propiedad.slug}`}
                className="btn btn-secundario text-menor"
              >
                <span aria-hidden="true">♡</span> Guardar
              </Link>
            ) : (
              <BotonFavorito propiedadId={propiedad.id} inicial={propiedad.es_favorito} />
            )}

            <AccionesDuenio
              propiedadId={propiedad.id}
              propietarioId={propiedad.propietario?.id ?? null}
            />
          </div>
        </div>

        {propiedad.distrito && (
          <p className="mt-1 text-cuerpo text-tinta-50">
            {propiedad.distrito.nombre}
            {propiedad.direccion && ` · ${propiedad.direccion}`}
          </p>
        )}
      </header>

      {/* --- Fotos ---
          Van después del encabezado y antes que todo lo demás, fuera de la
          rejilla de dos columnas, porque son lo primero que mira quien entra:
          la foto decide si esa visita sigue leyendo el precio. */}
      {(propiedad.imagenes?.length ?? 0) > 0 && (
        <Galeria imagenes={propiedad.imagenes} titulo={propiedad.titulo} />
      )}

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* ---------- Columna principal ---------- */}
        <div>
          {/* --- Precio: lo primero que se lee --- */}
          <div className="mb-6 flex items-baseline gap-4 border-y border-linea py-4">
            <p className="cifra text-display font-semibold text-senal">
              {formatearPrecio(propiedad.precio, propiedad.moneda)}
            </p>
            {porM2 && <p className="cifra text-cuerpo text-tinta-50">{porM2}</p>}
          </div>

          {/* --- Mapa: una sola propiedad, con zoom cercano ---
              `Mapa` es un componente de cliente (Mapbox vive en el
              navegador), pero se puede usar desde el servidor: lo que cruza
              la frontera son las props, y una propiedad es un objeto plano. */}
          {propiedad.latitud !== null && propiedad.longitud !== null && (
            <div className="mb-6 h-80 overflow-hidden rounded-grande border border-linea">
              <Mapa puntos={aPuntosDeMapa([propiedad])} className="h-full w-full" />
            </div>
          )}

          {/* --- Especificaciones --- */}
          <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-medio border border-linea bg-linea sm:grid-cols-4">
            <Celda
              etiqueta="Área"
              valor={propiedad.area_m2 ? `${propiedad.area_m2} m²` : '—'}
            />
            <Celda etiqueta="Habitaciones" valor={propiedad.habitaciones || '—'} />
            <Celda etiqueta="Baños" valor={propiedad.banos || '—'} />
            <Celda etiqueta="Estacionamientos" valor={propiedad.parkederos || '—'} />
          </dl>

          {/* --- Descripción --- */}
          <section className="mb-8">
            <h2 className="mb-2 text-grande font-semibold text-tinta">Descripción</h2>
            {/* whitespace-pre-line conserva los saltos de línea que el
                dueño escribió, sin tener que convertirlos en <br>. */}
            <p className="whitespace-pre-line text-normal leading-relaxed text-tinta-70">
              {propiedad.descripcion}
            </p>
          </section>

          {/* --- Tour 3D --- */}
          {propiedad.tour_3d_url && (
            <section className="mb-8">
              <h2 className="mb-2 text-grande font-semibold text-tinta">
                Recorrido 3D
              </h2>
              {/* sandbox + allowfullscreen: sin esto, un iframe externo
                  podría navegar la página o leer su DOM. */}
              <iframe
                src={propiedad.tour_3d_url}
                title={`Recorrido 3D de ${propiedad.titulo}`}
                className="h-96 w-full rounded-grande border border-linea"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups"
                loading="lazy"
              />
            </section>
          )}
        </div>

        {/* ---------- Columna lateral: contacto ---------- */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-grande border border-linea bg-papel-alto p-5">
            {propiedad.propietario && (
              <div className="mb-4 border-b border-linea pb-4">
                <p className="text-micro text-tinta-50">Publicado por</p>
                <p className="mt-0.5 text-grande font-semibold text-tinta">
                  {propiedad.propietario.nombre}
                </p>
                {propiedad.propietario.identidad_verificada && (
                  <span className="distintivo distintivo-senal mt-2">
                    Identidad verificada
                  </span>
                )}
              </div>
            )}

            <PanelContacto
              propiedadId={propiedad.id}
              propietarioId={propiedad.propietario?.id ?? null}
              slug={propiedad.slug}
            />
          </div>

          <p className="mt-3 text-micro text-tinta-30">
            Referencia #{propiedad.id} · {propiedad.vistas} visitas
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Celda de la tabla de especificaciones. */
function Celda({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="bg-papel-alto px-4 py-3">
      <dt className="text-micro text-tinta-50">{etiqueta}</dt>
      <dd className="cifra mt-0.5 text-grande font-medium text-tinta">{valor}</dd>
    </div>
  );
}
