import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * 🔍 Fijar la raíz de Turbopack.
   *
   * Next detecta varios package-lock.json y elige un "workspace root"
   * por su cuenta. Eso provocaba este aviso en cada build:
   *
   *   We detected multiple lockfiles and selected the directory of
   *   INNOVER\package-lock.json as the root directory.
   *
   * Fijarlo aquí elimina el aviso y, sobre todo, evita que Turbopack
   * compile archivos de fuera del frontend por error.
   *
   * 💡 `__dirname` es el directorio de este archivo, así que es
   * una ruta ABSOLUTA. Next 16 avisa si le pasas ".", porque en
   * Windows resolvería contra el directorio actual del proceso.
   */
  turbopack: {
    root: __dirname,
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
