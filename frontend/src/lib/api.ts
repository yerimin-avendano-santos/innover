// ========================================
// 🌐 CLIENTE DE LA API
// ========================================
// Un único lugar por donde salen todas las peticiones al backend.
//
// ¿POR QUÉ NO HACER `fetch(...)` EN CADA COMPONENTE?
//
// 1. La URL base quedaría escrita en 15 archivos.
// 2. El manejo de errores se repetiría 15 veces, y cada copia se
//    desviaría un poco de la otra.
// 3. Cuando haya que mandar el token, hay que acordarse de hacerlo
//    en todos lados. Y siempre se olvidan uno.
//
// Aquí se resuelve una vez: la URL, el token y los errores.

import type { ErrorAPI } from './tipos';

/**
 * URL del backend.
 *
 * ⚠️ En el navegador NO usamos NEXT_PUBLIC_* para llamar al backend
 * directamente. Hacemos las peticiones a rutas relativas ("/api/...")
 * y el servidor de Next hace de intermediario (ver src/app/api/).
 *
 * Motivo: si el navegador llama directo a http://localhost:5000, el
 * navegador exige CORS y además la URL del backend queda expuesta.
 * Con el intermediario, todo es del mismo origen y no hay CORS.
 */
const BASE = '';

/** Un campo que falló la validación, con el mensaje para el usuario. */
export interface DetalleValidacion {
  campo: string;
  mensaje: string;
}

/** Error de la API con los datos del problema ya normalizados. */
export class ErrorPeticion extends Error {
  estado: number;
  codigo: string;
  detalles: DetalleValidacion[];

  constructor(
    mensaje: string,
    estado: number,
    codigo = 'ERROR',
    detalles: DetalleValidacion[] = []
  ) {
    super(mensaje);
    this.name = 'ErrorPeticion';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }

  /** ¿Faltan credenciales? Entonces toca iniciar sesión. */
  get esSesion(): boolean {
    return this.estado === 401;
  }

  /** ¿El problema está en los datos que envió el usuario? */
  get esValidacion(): boolean {
    return this.estado === 400 || this.estado === 422;
  }

  /** Busca el mensaje de un campo concreto. */
  mensajeDe(campo: string): string | undefined {
    return this.detalles.find((d) => d.campo === campo)?.mensaje;
  }
}

interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  /** Señal de cancelación, para Searches que se cancelan al escribir. */
  signal?: AbortSignal;
}

/**
 * Hace una petición a la API.
 *
 * `credentials: 'include'` es lo que hace que la cookie de sesión viaje.
 * El backend la manda como `httpOnly`, así que el JavaScript no puede
 * leerla: la gestiona el navegador sola. Por eso este código nunca
 * menciona el token.
 */
export async function api<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const { metodo = 'GET', cuerpo, signal } = opciones;

  // Se construye objeto por objeto en vez de `...(cuerpo && {...})`.
  // El operador && devuelve `undefined`, `false` o el objeto, y TypeScript
  // no puede asegurar que sea un objeto: de ahí el error "Spread types may
  // only be created from object types".
  const cabeceras: Record<string, string> = {};
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  let res: Response;

  try {
    res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      credentials: 'include',
      headers: cabeceras,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal,
    });
  } catch (error) {
    // fetch solo falla así si no hay red o si se abortó.
    if ((error as Error).name === 'AbortError') throw error;

    throw new ErrorPeticion(
      'No pudimos conectar con el servidor. Revisa tu conexión.',
      0,
      'SIN_CONEXION'
    );
  }

  // Un 204 no tiene cuerpo JSON que leer.
  if (res.status === 204) return undefined as T;

  let datos: unknown = null;

  try {
    datos = await res.json();
  } catch {
    // Si no es JSON, dejamos datos en null y nos quedamos con el estado.
  }

  if (!res.ok) {
    const info = (datos ?? {}) as ErrorAPI;
    throw new ErrorPeticion(
      info.error || `Error ${res.status}`,
      res.status,
      info.codigo || 'ERROR',
      info.detalles || []
    );
  }

  return datos as T;
}

/**
 * Construye una URL con query params, ignorando los vacíos.
 *
 * Ejemplo:
 *   conQuery('/api/propiedades', { tipo: 'VENTA', precioMin: undefined })
 *   → "/api/propiedades?tipo=VENTA"
 *
 * Sin esto hay que estar limpiando `undefined` a mano en cada filtro,
 * y es la fuente clásica de "?tipo=undefined" en las URLs.
 */
export function conQuery(
  base: string,
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const buscar = new URLSearchParams();

  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    buscar.set(clave, String(valor));
  }

  const cadena = buscar.toString();
  return cadena ? `${base}?${cadena}` : base;
}

// ========================================
// Formateo
// ========================================

/**
 * Formatea un precio para mostrarlo.
 *
 * 385000 USD → "US$ 385,000"
 * 1680 PEN   → "S/ 1,680"
 *
 * OJO con el separador de miles: en Perú es la coma, no el punto.
 * "US$ 385.000" se lee como trescientos ochenta y cinco mil en Estados
 * Unidos, y el usuario peruano lo va a leer mal.
 */
export function formatearPrecio(
  precio: number | null | undefined,
  moneda: 'PEN' | 'USD' = 'PEN'
): string {
  if (precio === null || precio === undefined) return 'A consultar';

  const simbolo = moneda === 'USD' ? 'US$' : 'S/';

  return `${simbolo} ${precio.toLocaleString('es-PE', {
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Precio por metro cuadrado.
 *
 * Es LA métrica con la que realmente compara un comprador: dos casas
 * pueden costar lo mismo y estar a precios por m² completamente distintos.
 *
 * ⚠️ El símbolo de la moneda DEBE venir del argumento `moneda`.
 * Antes estaba fijo en "S/", así que una propiedad en dólares
 * mostraba "US$ 385,000" y debajo "S/ 3,928/m²". Dos monedas distintas
 * en la misma ficha, que es peor que no mostrarlo.
 */
export function precioPorM2(
  precio: number,
  area: number | null | undefined,
  moneda: 'PEN' | 'USD' = 'PEN'
): string | null {
  if (!area || area <= 0) return null;

  const simbolo = moneda === 'USD' ? 'US$' : 'S/';

  return `${simbolo} ${Math.round(precio / area).toLocaleString('es-PE')}/m²`;
}

/** "hace 3 días" a partir de una fecha ISO. */
export function tiempoRelativo(fechaISO: string): string {
  const segundos = (Date.now() - new Date(fechaISO).getTime()) / 1000;

  if (segundos < 60) return 'recién publicado';
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;

  const dias = Math.floor(segundos / 86400);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;

  const meses = Math.floor(dias / 30);
  if (meses === 1) return 'hace 1 mes';
  return `hace ${meses} meses`;
}

/** Etiqueta legible del tipo de inmueble. */
export function etiquetaTipo(tipo: string): string {
  const etiquetas: Record<string, string> = {
    DEPARTAMENTO: 'Departamento',
    CASA: 'Casa',
    TERRENO: 'Terreno',
    OFICINA: 'Oficina',
    LOCAL_COMERCIAL: 'Local comercial',
    OTRO: 'Otro',
  };
  return etiquetas[tipo] ?? tipo;
}
