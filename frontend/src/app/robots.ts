// ========================================
// 🤖 /robots.txt — LAS REGLAS DEL SITIO
// ========================================
// Un archivo diminuto que hace dos cosas: decir por dónde NO debe entrar un
// rastreador, y presentarle el sitemap.
//
// 📌 POR QUÉ NO ES OPCIONAL AQUÍ
//
// Sin `robots.txt` no hay nada malo, y Google rastrea TODO lo que encuentre.
// En Innover eso incluye `/admin`, `/perfil`, `/leads` y —lo que importa— las
// rutas `/api/`, que son las que duplican el contenido: la misma propiedad se
// puede leer en `/api/propiedades/mi-casa` y en `/propiedad/mi-casa`. Son dos
// URLs con el mismo texto, y para un buscador eso es contenido duplicado: no
// sabe cuál enseñar y reparte entre las dos la poca autoridad que tiene el
// sitio. Dejar fuera lo que no es una página es la mitad del trabajo de
// indexar bien.
//
// 📌 Y LO QUE NO SE HACE, QUE TAMBIÉN ES UNA DECISIÓN
//
// Aquí NO se protege nada. Esto lo lee quien se porta bien: un `curl` pasa
// por encima de `robots.txt` sin enterarse. Lo que haya que esconder de
// verdad se esconde con sesión —que es como está hecho—, y esto solo evita
// que un rastreador honesto se lleve a Google puertas que no llevan a ninguna
// parte. Confundir las dos cosas es cómo la gente acaba "protegiendo"
// `/admin` con una línea de texto.

import type { MetadataRoute } from 'next';
import { urlDelSitio } from '@/lib/sitio';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await urlDelSitio();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // El puente: mismas propiedades que las fichas, en formato JSON. No
          // es una página y duplica lo que sí lo es.
          '/api/',
          // Paneles y formularios: páginas de trabajo, sin nada que indexar.
          // Google igual las descubre —`Disallow` impide rastrear, no
          // indexar—, así que si algún día importa que no salgan en
          // resultados, lo que toca es `noindex` dentro de la página.
          '/admin',
          '/perfil',
          '/leads',
          '/publicar',
          // Entrar y registrarse: dos formularios vacíos que a nadie le sirve
          // encontrar buscando "innover".
          '/login',
          '/registro',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
