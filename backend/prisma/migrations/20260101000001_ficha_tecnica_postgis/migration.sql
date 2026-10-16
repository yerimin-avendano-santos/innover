-- ============================================================================
-- Migración: ficha técnica completa + PostGIS
-- ============================================================================
-- Qué cambia y por qué:
--
--  1. Activa PostGIS y agrega la columna `locacion` de tipo geography(Point).
--  2. Convierte el modelo mínimo en una ficha técnica real:
--     slug, area_m2, tipoInmueble, estado, distrito, imagenes, destacado.
--  3. Preserva los datos existentes:
--     - `tipo` se migra de TipoPropiedad a TipoOperacion SIN perder valores.
--     - `slug` se backfillea antes de volverse NOT NULL.
--     - `locacion` se calcula desde latitud/longitud de las filas previas.
--  4. Agrega un TRIGGER para que `locacion` se mantenga sola.
-- ============================================================================

-- 1. Extensión espacial -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Distrito ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Distrito" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "latitud_centro" DOUBLE PRECISION,
    "longitud_centro" DOUBLE PRECISION,
    CONSTRAINT "Distrito_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Distrito_nombre_key" ON "Distrito"("nombre");

-- 3. Enums nuevos -----------------------------------------------------------
CREATE TYPE "TipoOperacion" AS ENUM ('VENTA', 'ALQUILER');
CREATE TYPE "TipoInmueble" AS ENUM (
    'DEPARTAMENTO', 'CASA', 'TERRENO', 'OFICINA', 'LOCAL_COMERCIAL', 'OTRO'
);
CREATE TYPE "EstadoPropiedad" AS ENUM (
    'BORRADOR', 'PUBLICADA', 'VENDIDA', 'ALQUILADA', 'RETIRADA'
);

-- DESCARTADO se agrega por separado porque en PostgreSQL un valor nuevo de un
-- enum no puede usarse en la misma transacción en que se crea.
ALTER TYPE "EstadoContacto" ADD VALUE IF NOT EXISTS 'DESCARTADO';

-- 4. Usuario ----------------------------------------------------------------
ALTER TABLE "Usuario"
    ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "avatar_url" TEXT,
    ADD COLUMN IF NOT EXISTS "documento_identidad" TEXT,
    ADD COLUMN IF NOT EXISTS "identidad_verificada" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "telefono" TEXT,
    ADD COLUMN IF NOT EXISTS "ultimo_acceso" TIMESTAMP(3);

-- fecha_actualizacion con @updatedAt no puede ser NOT NULL sin default:
-- las filas viejas no lo tienen.
ALTER TABLE "Usuario"
    ADD COLUMN IF NOT EXISTS "fecha_actualizacion" TIMESTAMP(3);
UPDATE "Usuario" SET "fecha_actualizacion" = "fecha_creacion"
    WHERE "fecha_actualizacion" IS NULL;
ALTER TABLE "Usuario" ALTER COLUMN "fecha_actualizacion" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Usuario_rol_activo_idx" ON "Usuario"("rol", "activo");

-- 5. Propiedad: columnas nuevas --------------------------------------------
ALTER TABLE "Propiedad"
    ADD COLUMN IF NOT EXISTS "area_m2" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "destacado" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "direccion" TEXT,
    ADD COLUMN IF NOT EXISTS "distrito_id" INTEGER,
    ADD COLUMN IF NOT EXISTS "estado" "EstadoPropiedad" NOT NULL DEFAULT 'PUBLICADA',
    ADD COLUMN IF NOT EXISTS "imagenes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS "locacion" geography(Point, 4326),
    ADD COLUMN IF NOT EXISTS "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    ADD COLUMN IF NOT EXISTS "parkederos" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "slug" TEXT,
    ADD COLUMN IF NOT EXISTS "tipoInmueble" "TipoInmueble" NOT NULL DEFAULT 'DEPARTAMENTO',
    ADD COLUMN IF NOT EXISTS "vistas" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Propiedad"
    ADD COLUMN IF NOT EXISTS "fecha_actualizacion" TIMESTAMP(3);
UPDATE "Propiedad" SET "fecha_actualizacion" = "fecha_creacion"
    WHERE "fecha_actualizacion" IS NULL;
ALTER TABLE "Propiedad" ALTER COLUMN "fecha_actualizacion" SET NOT NULL;

-- 6. Migrar `tipo` sin perder los valores existentes ------------------------
-- El enum viejo TipoPropiedad y el nuevo TipoOperacion tienen las mismas
-- etiquetas, así que copiamos los datos antes de tirar el tipo viejo.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Propiedad' AND column_name = 'tipo'
          AND udt_name = 'TipoPropiedad'
    ) THEN
        ALTER TABLE "Propiedad" RENAME COLUMN "tipo" TO "tipo_legacy";
    END IF;
END $$;

ALTER TABLE "Propiedad"
    ADD COLUMN IF NOT EXISTS "tipo" "TipoOperacion";

UPDATE "Propiedad"
SET "tipo" = ("tipo_legacy"::TEXT)::"TipoOperacion"
WHERE "tipo_legacy" IS NOT NULL AND "tipo" IS NULL;

-- El DEFAULT va en su propia sentencia: PostgreSQL no acepta
-- "SET NOT NULL DEFAULT x" en la misma línea.
ALTER TABLE "Propiedad" ALTER COLUMN "tipo" SET DEFAULT 'VENTA';
ALTER TABLE "Propiedad" ALTER COLUMN "tipo" SET NOT NULL;
ALTER TABLE "Propiedad" DROP COLUMN IF EXISTS "tipo_legacy";
DROP TYPE IF EXISTS "TipoPropiedad";

-- 7. Defaults de conteos ----------------------------------------------------
ALTER TABLE "Propiedad" ALTER COLUMN "habitaciones" SET DEFAULT 0;
ALTER TABLE "Propiedad" ALTER COLUMN "banos" SET DEFAULT 0;

-- 8. Precio con precisión explícita ----------------------------------------
ALTER TABLE "Propiedad"
    ALTER COLUMN "precio" TYPE DECIMAL(12,2) USING "precio"::DECIMAL(12,2);

-- 9. Slug: backfill antes de volverlo NOT NULL ------------------------------
-- Se genera a partir del título + id para garantizar unicidad aunque dos
-- propiedades tengan el mismo nombre.
UPDATE "Propiedad"
SET "slug" = LOWER(
    regexp_replace(
        regexp_replace(
            COALESCE(NULLIF("titulo", ''), 'propiedad') || '-' || "id",
            '[^a-zA-Z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
    )
)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "Propiedad" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Propiedad_slug_key" ON "Propiedad"("slug");

-- 10. Backfill de la columna espacial ---------------------------------------
UPDATE "Propiedad"
SET "locacion" = ST_SetSRID(ST_MakePoint("longitud", "latitud"), 4326)::geography
WHERE "latitud" IS NOT NULL
  AND "longitud" IS NOT NULL
  AND "locacion" IS NULL;

-- 11. TRIGGER: mantener `locacion` sincronizada con lat/long -----------------
-- Así Prisma sigue escribiendo floats comfortable, y PostGIS mantiene el
-- punto geográfico listo para consultas e índices espaciales.
CREATE OR REPLACE FUNCTION sync_propiedad_locacion() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."latitud" IS NOT NULL AND NEW."longitud" IS NOT NULL THEN
        NEW."locacion" = ST_SetSRID(
            ST_MakePoint(NEW."longitud", NEW."latitud"), 4326
        )::geography;
    ELSE
        NEW."locacion" = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_locacion ON "Propiedad";
CREATE TRIGGER trg_sync_locacion
    BEFORE INSERT OR UPDATE OF "latitud", "longitud" ON "Propiedad"
    FOR EACH ROW EXECUTE FUNCTION sync_propiedad_locacion();

-- 12. Índice espacial (GIST) ------------------------------------------------
CREATE INDEX IF NOT EXISTS "Propiedad_locacion_gist_idx"
    ON "Propiedad" USING GIST ("locacion");

-- 13. Índices de búsqueda ----------------------------------------------------
CREATE INDEX IF NOT EXISTS "Propiedad_estado_tipo_precio_idx"
    ON "Propiedad"("estado", "tipo", "precio");
CREATE INDEX IF NOT EXISTS "Propiedad_tipoInmueble_idx"
    ON "Propiedad"("tipoInmueble");
CREATE INDEX IF NOT EXISTS "Propiedad_distrito_id_idx"
    ON "Propiedad"("distrito_id");
CREATE INDEX IF NOT EXISTS "Propiedad_destacado_fecha_creacion_idx"
    ON "Propiedad"("destacado", "fecha_creacion");
CREATE INDEX IF NOT EXISTS "Propiedad_usuario_id_idx"
    ON "Propiedad"("usuario_id");
CREATE INDEX IF NOT EXISTS "Propiedad_fecha_creacion_idx"
    ON "Propiedad"("fecha_creacion");

-- 14. Contacto: leads del CRM -----------------------------------------------
ALTER TABLE "Contacto"
    ADD COLUMN IF NOT EXISTS "email_contacto" TEXT,
    ADD COLUMN IF NOT EXISTS "telefono_contacto" TEXT,
    ADD COLUMN IF NOT EXISTS "propietario_id" INTEGER,
    ADD COLUMN IF NOT EXISTS "fecha_actualizacion" TIMESTAMP(3);

-- Un lead puede no tener agente asignado (propietario directo).
ALTER TABLE "Contacto" ALTER COLUMN "agente_id" DROP NOT NULL;

UPDATE "Contacto" SET "fecha_actualizacion" = "fecha_creacion"
    WHERE "fecha_actualizacion" IS NULL;
ALTER TABLE "Contacto" ALTER COLUMN "fecha_actualizacion" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Contacto_agente_id_estado_idx" ON "Contacto"("agente_id", "estado");
CREATE INDEX IF NOT EXISTS "Contacto_propiedad_id_idx" ON "Contacto"("propiedad_id");
CREATE INDEX IF NOT EXISTS "Contacto_cliente_id_idx" ON "Contacto"("cliente_id");
CREATE INDEX IF NOT EXISTS "Contacto_fecha_creacion_idx" ON "Contacto"("fecha_creacion");

-- 15. Relaciones ------------------------------------------------------------
-- Primero se sueltan las FK viejas, porque no tienen ON DELETE y bloquean.
ALTER TABLE "Contacto" DROP CONSTRAINT IF EXISTS "Contacto_agente_id_fkey";
ALTER TABLE "Contacto" DROP CONSTRAINT IF EXISTS "Contacto_cliente_id_fkey";
ALTER TABLE "Contacto" DROP CONSTRAINT IF EXISTS "Contacto_propiedad_id_fkey";
ALTER TABLE "Propiedad" DROP CONSTRAINT IF EXISTS "Propiedad_usuario_id_fkey";

ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_distrito_id_fkey"
    FOREIGN KEY ("distrito_id") REFERENCES "Distrito"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_propiedad_id_fkey"
    FOREIGN KEY ("propiedad_id") REFERENCES "Propiedad"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_agente_id_fkey"
    FOREIGN KEY ("agente_id") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_propietario_id_fkey"
    FOREIGN KEY ("propietario_id") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
