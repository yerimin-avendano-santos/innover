-- ============================================================================
-- Migración: tip_inmueble → tipo_inmueble
-- ============================================================================
-- El nombre de la columna mezclaba camelCase con el snake_case del resto del
-- esquema. En PostgreSQL eso obliga a comillas en cada consulta y "tipoInmueble"
-- sin comillas se vuelve "tipoinmueble" y revienta la consulta.
-- Renombrar es más barato que suffered con ese error el resto del proyecto.
-- ============================================================================

ALTER TABLE "Propiedad" RENAME COLUMN "tipoInmueble" TO "tipo_inmueble";

DROP INDEX IF EXISTS "Propiedad_tipoInmueble_idx";
CREATE INDEX "Propiedad_tipo_inmueble_idx" ON "Propiedad"("tipo_inmueble");
