// ========================================
// 🗺️ /sitemap.xml — LA LISTA DE PÁGINAS
// ========================================
// 📌 POR QUÉ ESTE ARCHIVO ES IMPORTANTE EN ESTE PROYECTO EN CONCRETO
//
// La ficha de una propiedad es pública y está escrita para que la indexe
// Google. Pero pública no es lo mismo que ENCONTRABLE, y aquí el problema era
// el segundo: el buscador exige sesión, así que un rastreador no puede navegar
// el catálogo, y no queda un solo enlace interno que lleve a una ficha. Sin
// esta lista, Google solo sabría de una propiedad si alguien la enlazara desde
// fuera. Es decir: el trabajo de SEO de la ficha no se cobraría.
//
// Este archivo es la respuesta al problema, y es el mecanismo estándar: una
// lista de URLs que el buscador lee sin depender de enlaces.
//
// 📌 LA ÚNICA RUTA DE LECTURA PÚBLICA DE PROPIEDADES, DESPUÉS DE LA FICHA
//
// `GET /api/propiedades/sitemap` devuelve dos campos —slug y fecha de
// actualización— y nada más. Detrás de una puerta abierta conviene que haya
// poco: aquí no hay precios, ni direcciones, ni dueños, ni contadores.
//
// La decisión de abrirla está razonada en `propiedadRoutes.js`, y tiene prueba
// propia: solo aparecen propiedades PUBLICADAS.

import type { MetadataRoute } from 'next';
import { urlDelSitio } from '@/lib/sitio';

/**
 * URL del backend. Solo la ve el servidor — igual que en el puente y en la
 * ficha, que son los otros dos sitios que hablan con él.
 */
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

/**
 * Sin caché en el build: la lista tiene que salir fresca.
 *
 * ⚠️ Es `force-dynamic` y no un `revalidate` por lo que está explicado en
 * `lib/sitio.ts`: generar el sitemap al compilar obligaría a que el backend
 * estuviera levantado durante el `build` del frontend. Además, un sitemap es
 * lo último que debería mentir — si dice que una propiedad existe y ya no
 * está, se manda al rastreador a un 404.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await urlDelSitio();

  /**
   * La portada entra, sin fecha.
   *
   * Es una página de verdad aunque tenga el buscador detrás del muro: quien
   * entra sin cuenta ve la invitación, que explica el producto. (Y Google
   * ejecuta JavaScript, así que la ve renderizada.)
   *
   * ⚠️ Y va SIN `lastModified`, no con la fecha de ahora. Poner `new Date()`
   * sería decirle «esta página cambia en cada visita que haces», que es falso;
   * y una fecha que siempre es nueva es una fecha que Google aprende a
   * ignorar, incluidas las que sí importan. Sin fecha está diciendo la verdad:
   * no sé cuándo cambió.
   */
  const portada: MetadataRoute.Sitemap = [{ url: `${base}/` }];

  const respuesta = await fetch(`${BACKEND}/api/propiedades/sitemap`, {
    cache: 'no-store',
  });

  /**
   * Si el backend no contesta, se falla a propósito.
   *
   * La tentación es devolver solo la portada «para no romper el archivo». Y es
   * peor: un sitemap sin las fichas le dice a Google que el sitio tiene una
   * página, y este archivo es justamente el que le enseña las que hay. Un 500
   * el rastreador lo reintenta —y no da de baja ninguna URL—; un sitemap a
   * medias no se reintenta, se cree.
   */
  if (!respuesta.ok) {
    throw new Error(`El sitemap no pudo listar las propiedades (${respuesta.status}).`);
  }

  const { datos } = await respuesta.json();

  return [
    ...portada,
    ...(datos ?? []).map((propiedad: { slug: string; fecha_actualizacion: string }) => ({
      url: `${base}/propiedad/${propiedad.slug}`,
      lastModified: new Date(propiedad.fecha_actualizacion),
      // 📌 No se pone `priority` ni `changeFrequency` a propósito.
      //
      // Los dos campos existen en el formato y GOOGLE LOS IGNORA: lo tiene
      // dicho en su documentación. Ponerlos sería ruido que parece una
      // decisión —«esta ficha vale 0.8»— y no lo es. `lastModified` sí se usa:
      // es con lo que decide si merece la pena volver a mirar.
    })),
  ];
}
