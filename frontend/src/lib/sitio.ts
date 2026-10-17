// ========================================
// 🌐 ¿CUÁL ES LA DIRECCIÓN PÚBLICA DEL SITIO?
// ========================================
// Lo necesitan dos cosas —`/sitemap.xml` y `/robots.txt`— y ninguna de las
// dos puede usar rutas relativas: el formato de sitemap exige URLs completas,
// porque quien lo lee no está navegando el sitio, está leyendo una lista.
//
// 📌 POR QUÉ LA SACA DE LA PETICIÓN Y NO DE UNA VARIABLE DE ENTORNO
//
// La respuesta correcta ya viene en cada petición: es el dominio que usó quien
// preguntó. Si Innover vive en `innover.pe`, el rastreador pide
// `innover.pe/sitemap.xml` y el `host` es `innover.pe`; si algún día hay un
// subdominio o un dominio de pruebas, cada uno se anuncia a sí mismo sin que
// nadie configure nada. Una variable de entorno, en cambio, hay que acordarse
// de ponerla en cada despliegue —y de cambiarla al mover el dominio—, y el
// fallo sería silencioso: un sitemap apuntando al dominio viejo no da error,
// solo manda a Google a un sitio que no es.
//
// 📌 Y ESTO ES LO QUE HACE QUE EL SITEMAP NO SE GENERE AL COMPILAR
//
// `headers()` es una API de petición: usarla obliga a generar la respuesta en
// cada visita en vez de congelarla en el `build`. Es justo lo que hace falta,
// por dos motivos: la lista de propiedades cambia, y —el importante— un
// sitemap congelado en el build obligaría a que el backend estuviera
// levantado para COMPILAR el frontend. Hoy no lo está y el build no se entera.
// Si algún día alguien sustituye esto por una URL fija «para simplificar»,
// ese acoplamiento vuelve y se descubre en el peor momento: desplegando.

import { headers } from 'next/headers';

export async function urlDelSitio(): Promise<string> {
  const cabeceras = await headers();

  // `host` siempre llega en HTTP/1.1 y HTTP/2. El valor por defecto es el del
  // servidor de desarrollo, para que un `Host` ausente no rompa nada raro.
  const host = cabeceras.get('host') ?? 'localhost:3000';

  /**
   * Detrás de un proxy —Vercel, Nginx, Cloudflare— la conexión que ve Node ya
   * es HTTP, aunque el visitante haya llegado por HTTPS. El protocolo de
   * verdad viaja en `x-forwarded-proto`, y puede venir con varios valores si
   * hubo varios saltos; sirve el primero, que es el del visitante.
   *
   * Si no hay cabecera (desarrollo local, servidor directo) se deduce: en
   * localhost es HTTP; en cualquier otro sitio, HTTPS. Un sitemap que anuncie
   * `http://` en un dominio con HTTPS es una redirección por URL para el
   * rastreador, y Google penaliza las que no terminan donde apuntan.
   */
  const reenviado = cabeceras.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const esLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const protocolo = reenviado || (esLocal ? 'http' : 'https');

  return `${protocolo}://${host}`;
}
