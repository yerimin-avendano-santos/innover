// ========================================
// ❤️ FAVORITOS: los anuncios que alguien guarda
// ========================================
// Guardar un anuncio para volver a él. Tres rutas, y las tres piden sesión.
//
// 📌 POR QUÉ NADA DE ESTO ES PÚBLICO
//
// La lista de favoritos de alguien dice qué está buscando, cuánto le interesa
// y desde cuándo. No es un dato del anuncio: es un dato de la persona. Por eso
// no hay endpoint para preguntar "¿quién guardó esto?" y cada quien ve solo la
// suya — el `usuario_id` sale del token, nunca del cuerpo ni de la URL.
//
// La ficha sí devuelve `es_favorito`, pero eso es el estado de QUIEN MIRA: el
// mismo anuncio es favorito para uno y no para otro, así que no puede ser un
// campo de `propiedadPublica`.
//
// 📌 Y POR QUÉ NO LLEVAN EL LIMITADOR DE ESCRITURA
//
// `limitadorEscritura` existe para que nadie inunde el mercado de anuncios
// falsos ni de leads basura: cosas que ven LOS DEMÁS. Un favorito lo ve solo
// quien lo guarda, y la clave única (usuario, propiedad) impide repetirlo: el
// máximo posible es un favorito por anuncio y persona. No hay nada que
// limitar, y gastar cupo aquí le quitaría cupo a las publicaciones de verdad.

import prisma from '../config/db.js';
import { ErrorNoEncontrado, ErrorProhibido } from '../utils/errores.js';
import { propiedadPublica, esVisiblePara } from './propiedadController.js';

// ========================================
// [READ] Mi lista de favoritos
// ========================================
export const obtenerFavoritos = async (req, res) => {
  const { pagina, porPagina } = req.query;

  /**
   * 📌 SE DEVUELVE SOLO LO QUE SE PUEDE ABRIR.
   *
   * `estado: 'PUBLICADA'` a secas no vale: si alguien guardó su propio
   * borrador, desaparecería de su lista. La condición es la misma que usa la
   * ficha para decidir si deja mirar —lo publicado, más lo mío— y por eso se
   * escribe con la misma función y no con un `OR` copiado aquí.
   *
   * Si un anuncio guardado se retira (su dueño lo pasa a BORRADOR), se cae de
   * la lista en vez de quedarse como un enlace que da 403 al abrirse. Lo
   * amable sería enseñarlo en gris con un "ya no está disponible", y es
   * trabajo para cuando haya anuncios vendidos que valga la pena recordar;
   * hoy solo añadiría un estado más a la pantalla.
   */
  const where = {
    usuario_id: req.usuario.id,
    propiedad: {
      OR: [{ estado: 'PUBLICADA' }, { usuario_id: req.usuario.id }],
    },
  };

  const [total, favoritos] = await Promise.all([
    prisma.favorito.count({ where }),
    prisma.favorito.findMany({
      where,
      include: {
        propiedad: {
          include: {
            usuario: { select: { id: true, nombre: true, identidad_verificada: true } },
            distrito: { select: { id: true, nombre: true } },
          },
        },
      },
      // Lo último que interesó, primero. El `orderBy` va sobre la tabla de
      // favoritos (no sobre las propiedades), que es justo lo que sirve el
      // índice (usuario_id, fecha_creacion).
      orderBy: { fecha_creacion: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
  ]);

  res.json({
    datos: favoritos.map((f) => ({
      ...propiedadPublica(f.propiedad),
      // Cuándo lo guardó. Se enseña en la tarjeta, y es lo que explica el
      // orden de la lista.
      guardado_en: f.fecha_creacion,
    })),
    paginacion: {
      pagina,
      porPagina,
      total,
      paginas: Math.ceil(total / porPagina),
      hayMas: (pagina - 1) * porPagina + favoritos.length < total,
    },
  });
};

// ========================================
// [CREATE] Guardar un anuncio
// ========================================
export const crearFavorito = async (req, res) => {
  const { propiedad_id } = req.body;
  const usuario_id = req.usuario.id;

  const propiedad = await prisma.propiedad.findUnique({
    where: { id: propiedad_id },
    select: { id: true, estado: true, usuario_id: true },
  });

  if (!propiedad) {
    throw new ErrorNoEncontrado('La propiedad');
  }

  /**
   * ⛔ Un BORRADOR ajeno no se puede guardar.
   *
   * Es el mismo candado que la ficha, y aquí importa igual: guardar es la
   * antesala de volver a mirarlo. Si se pudiera guardar sin verlo, el id se
   * convierte en un oráculo — "existe / no existe" — con los anuncios que su
   * dueño no ha decidido enseñar.
   */
  if (propiedad.estado === 'BORRADOR' && !esVisiblePara(req.usuario, propiedad)) {
    throw new ErrorProhibido('Esta publicación no está disponible.');
  }

  /**
   * 📌 `upsert` Y NO `create`.
   *
   * El botón es un INTERRUPTOR, no un contador. Un doble clic, dos pestañas
   * abiertas o una petición que se reintenta no pueden devolver un error de
   * clave duplicada que el usuario no entiende ni puede arreglar: guardar dos
   * veces lo mismo es guardarlo una.
   *
   * Y el `update` va vacío a propósito: no se toca `fecha_creacion`. Guardar
   * un anuncio que ya estaba no es "volver a guardarlo ahora" — la lista se
   * ordena por cuándo interesó, y eso no cambió.
   */
  const favorito = await prisma.favorito.upsert({
    where: {
      usuario_id_propiedad_id: { usuario_id, propiedad_id },
    },
    update: {},
    create: { usuario_id, propiedad_id },
  });

  /**
   * 200 y no 201, aunque en la mayoría de los casos se acabe de crear algo.
   *
   * La operación es idempotente y el cliente no necesita distinguir los dos
   * casos: el interruptor ya está encendido, y si quería saber si lo estaba
   * antes, la ficha le trae `es_favorito`. Devolver 201 unas veces y 200 otras
   * obligaría a la interfaz a tratar como error algo que no lo es.
   */
  res.json({
    favorito: {
      propiedad_id: favorito.propiedad_id,
      guardado_en: favorito.fecha_creacion,
    },
  });
};

// ========================================
// [DELETE] Quitar de la lista
// ========================================
export const eliminarFavorito = async (req, res) => {
  const { id: propiedad_id } = req.params;

  /**
   * `deleteMany` y no `delete`.
   *
   * `delete` lanza si la fila no existe, y quitar de una lista tiene que ser
   * idempotente por naturaleza: apretar dos veces el botón, o quitarlo en dos
   * dispositivos a la vez, no es un error — el resultado buscado (que no esté)
   * es el mismo. `deleteMany` devuelve cuántas borró, y con eso se responde si
   * había algo que quitar.
   */
  const { count } = await prisma.favorito.deleteMany({
    where: { usuario_id: req.usuario.id, propiedad_id },
  });

  res.json({ quitado: count > 0 });
};
