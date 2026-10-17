// ========================================
// 🔌 PUENTE ENTRE EL NAVEGADOR Y EL BACKEND
// ========================================
// ¿Por qué existe este archivo?
//
// ⛔ Si el navegador llamara directo a http://localhost:5000, pasarían
// tres cosas malas:
//
//   1. CORS. El navegador bloquea la petición porque el origen no
//      coincide. Habría que abrir CORS a "*" en el backend, lo que
//      permite que CUALQUIER sitio del mundo use tu API.
//
//   2. La URL del backend queda expuesta en el JavaScript del navegador.
//      No es un secreto grave, pero es información que no necesita ver
//      el visitante.
//
//   3. Las cookies de sesión solo viajan a peticiones del mismo origen.
//      Con un intermediario, "login" y "guardar cookie" funcionan juntas
//      sin trucos.
//
// La solución es la más simple que existe en Next.js: una "Route Handler"
// que reenvía la petición y copia la respuesta, incluyendo cookies.
//
// Este archivo se llama [..ruta].ts (con dos puntos) porque captura
// cualquier subruta: /api/propiedades, /api/propiedades/12, etc.

import { NextResponse } from 'next/server';

/**
 * URL del backend. Solo la ve el SERVIDOR, nunca el navegador.
 * Por eso no lleva el prefijo NEXT_PUBLIC_.
 */
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

/**
 * Encabezados que se reenvían del navegador al backend.
 * Lo demás se descarta: dejar pasar todo "permitiría" que un cliente
 * mande cabeceras internas, lo cual no aporta nada y ensucia el código.
 */
const CABECERAS_PERMITIDOS = ['content-type'];

/**
 * Encabezados de la respuesta del backend que se copian tal cual.
 *
 * ⚠️ `set-cookie` NO está en esta lista a propósito: no se puede copiar con
 * `get()`. Ver el bloque de las cookies más abajo.
 */
const CABECERAS_RESPUESTA = ['content-type'];

async function reenviar(
  peticion: Request,
  ruta: string[]
): Promise<NextResponse> {
  const url = new URL(peticion.url);
  // Solo el query string, sin el prefijo /api que ya consumimos.
  const destino = `${BACKEND}/api/${ruta.join('/')}${url.search}`;

  const cabeceras: Record<string, string> = {};
  for (const nombre of CABECERAS_PERMITIDOS) {
    const valor = peticion.headers.get(nombre);
    if (valor) cabeceras[nombre] = valor;
  }

  // 🔑 La cookie de sesión del navegador viaja al backend.
  const cookie = peticion.headers.get('cookie');
  if (cookie) cabeceras.cookie = cookie;

  // Los cuerpos de GET/HEAD no se pueden reenviar.
  const metodo = peticion.method;
  const tieneCuerpo = !['GET', 'HEAD'].includes(metodo);

  try {
    const respuesta = await fetch(destino, {
      method: metodo,
      headers: cabeceras,
      body: tieneCuerpo ? await peticion.text() : undefined,
      // Nunca queremos la caché de Next aquí: si el usuario crea una
      // propiedad y recarga, tiene que verla. La caché la maneja
      // React (`use cache`) en el lugar donde tiene sentido.
      cache: 'no-store',
    });

    const cuerpo = await respuesta.text();

    const cabecerasRespuesta = new Headers();
    for (const nombre of CABECERAS_RESPUESTA) {
      const valor = respuesta.headers.get(nombre);
      if (valor) cabecerasRespuesta.set(nombre, valor);
    }

    /**
     * 🔑 LAS COOKIES, Y POR QUÉ NO SE COPIAN CON `get('set-cookie')`
     *
     * Son lo más importante que reenvía este archivo: si no llegan al
     * navegador, el usuario inicia sesión y sigue "deslogueado".
     *
     * Y ahora son DOS (el pase corto y el token que lo renueva), lo que
     * convierte el atajo anterior en un fallo silencioso. `headers.get()`
     * devuelve las cabeceras repetidas pegadas con una coma — y una coma
     * también separa atributos DENTRO de una cookie (`Expires=Wed, 21 Oct
     * 2026 07:28:00 GMT`), así que el navegador recibe un texto ambiguo que
     * puede leer a medias: media sesión que funciona y media que no, sin un
     * solo error por ninguna parte.
     *
     * `getSetCookie()` da la lista entera, y `append` pone cada una como
     * cabecera independiente — que es como las manda el backend y como el
     * navegador las espera.
     */
    for (const galleta of respuesta.headers.getSetCookie?.() ?? []) {
      cabecerasRespuesta.append('set-cookie', galleta);
    }

    return new NextResponse(cuerpo, {
      status: respuesta.status,
      headers: cabecerasRespuesta,
    });
  } catch {
    // El backend no respondió (está caído, o no arrancó).
    return NextResponse.json(
      {
        error: 'El servidor no está disponible. Inténtalo en un momento.',
        codigo: 'BACKEND_NO_DISPONIBLE',
      },
      { status: 503 }
    );
  }
}

export async function GET(
  peticion: Request,
  contexto: { params: Promise<{ ruta: string[] }> }
) {
  const { ruta } = await contexto.params;
  return reenviar(peticion, ruta);
}

export async function POST(
  peticion: Request,
  contexto: { params: Promise<{ ruta: string[] }> }
) {
  const { ruta } = await contexto.params;
  return reenviar(peticion, ruta);
}

export async function PUT(
  peticion: Request,
  contexto: { params: Promise<{ ruta: string[] }> }
) {
  const { ruta } = await contexto.params;
  return reenviar(peticion, ruta);
}

export async function PATCH(
  peticion: Request,
  contexto: { params: Promise<{ ruta: string[] }> }
) {
  const { ruta } = await contexto.params;
  return reenviar(peticion, ruta);
}

export async function DELETE(
  peticion: Request,
  contexto: { params: Promise<{ ruta: string[] }> }
) {
  const { ruta } = await contexto.params;
  return reenviar(peticion, ruta);
}
