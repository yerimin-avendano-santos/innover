import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * 🔍 Fijar la raíz de Turbopack — a la del MONOREPO, no a la del frontend.
   *
   * Next detecta varios package-lock.json y elige un "workspace root"
   * por su cuenta. Eso provocaba este aviso en cada build:
   *
   *   We detected multiple lockfiles and selected the directory of
   *   INNOVER\package-lock.json as the root directory.
   *
   * Fijarla a mano quita el aviso. Pero OJO CON DÓNDE se fija, porque
   * Turbopack la usa además para RESOLVER MÓDULOS, y lo que quede fuera de
   * ella no existe para él. Está documentado en la guía de Turbopack, en
   * "Filesystem Root": "Files outside of the project root are not resolved".
   *
   * Estaba en `frontend/`, y eso rompía el día que npm izara una dependencia
   * al `node_modules` de la raíz — que es justo lo que npm hace con cualquier
   * paquete NUEVO de un workspace: lo sube a la raíz del monorepo.
   *
   *   Module not found: Can't resolve 'supercluster'
   *
   * Y no falla al instalar ni avisa por consola: falla al compilar, y solo
   * cuando una pantalla usa el paquete. La raíz del monorepo engloba a las
   * dos (`frontend/node_modules` y `node_modules`), así que resuelve con
   * cualquiera de los dos repartos.
   *
   * 💡 `__dirname` es el directorio de este archivo, así que es
   * una ruta ABSOLUTA. Next 16 avisa si le pasas ".", porque en
   * Windows resolvería contra el directorio actual del proceso.
   */
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },

  /**
   * Cabeceras de seguridad para el navegador.
   *
   * ⛔ `unsafe-eval` es necesario porque Next en desarrollo usa
   * eval para el hot reload. En producción se puede quitar.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
