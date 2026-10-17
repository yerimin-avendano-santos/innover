-- ==========================================
-- Favoritos: anuncios guardados por un usuario
-- ==========================================
--
-- Crea la tabla `Favorito` (ver el comentario largo en `schema.prisma`: es una
-- tabla y no una lista dentro de `Usuario` porque hay que poder preguntar
-- "¿cuánta gente guardó este anuncio?", y el par (usuario, propiedad) es único
-- porque el botón de guardar es un interruptor, no un contador).
--
-- ⛔ ESTE ARCHIVO VENÍA CON UNA LÍNEA MÁS, Y NO SE APLICÓ:
--
--     DROP INDEX "Propiedad_locacion_gist_idx";
--
-- Prisma la propone en TODAS las migraciones que se generen, y no es un
-- descuido suyo: `locacion` está declarada como `Unsupported` (la columna la
-- administra PostGIS), así que no aparece en el modelo, Prisma concluye que el
-- índice sobra y pide borrarlo. Se quitó a mano.
--
-- Qué habría pasado si se aplica: nada visible. `/api/propiedades/cercanas`
-- seguiría devolviendo los mismos resultados, solo que recorriendo la tabla
-- entera en lugar de usar el índice. El fallo aparece cuando hay propiedades de
-- verdad, en forma de lentitud, y para entonces nadie relaciona las dos cosas.
-- Lo protege la prueba "el índice espacial sigue existiendo" (sección 15 de
-- `scripts/pruebas.mjs`), que no comprueba datos sino el PLAN de la consulta.
--
-- Regla para la próxima migración: léela entera antes de aplicarla y borra esa
-- línea si aparece. Aparecerá.

-- CreateTable
CREATE TABLE "Favorito" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "propiedad_id" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Favorito_usuario_id_fecha_creacion_idx" ON "Favorito"("usuario_id", "fecha_creacion");

-- CreateIndex
CREATE INDEX "Favorito_propiedad_id_idx" ON "Favorito"("propiedad_id");

-- CreateIndex
CREATE UNIQUE INDEX "Favorito_usuario_id_propiedad_id_key" ON "Favorito"("usuario_id", "propiedad_id");

-- AddForeignKey
ALTER TABLE "Favorito" ADD CONSTRAINT "Favorito_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorito" ADD CONSTRAINT "Favorito_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "Propiedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
