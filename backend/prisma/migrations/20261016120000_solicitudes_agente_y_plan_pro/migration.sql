-- ============================================================================
-- Migración: solicitudes de agente, plan comercial e índices por región
-- ============================================================================
-- Qué cambia y por qué:
--
--  1. `SolicitudAgente` — la cola de "quiero ser agente", que antes no
--     existía. El endpoint guardaba el documento en el usuario y respondía
--     `estado: 'PENDIENTE'` como texto suelto: no había fila que revisar,
--     ni forma de rechazar con motivo, ni historial de intentos.
--
--  2. `Usuario.plan` / `plan_vence` — el plan comercial, SEPARADO del rol.
--     El rol dice qué hace alguien; el plan, qué puede pagar. Un PROPIETARIO
--     con plan PRO tiene 3D igual que un AGENTE con plan PRO.
--
--  3. `Distrito.region` / `provincia` — "Huánuco" es a la vez distrito,
--     provincia y región. Sin estos campos, abrir una segunda región choca
--     contra el `@unique` de `nombre` sin forma de desambiguar.
--
--  ⛔ NO SE TOCA EL ÍNDICE ESPACIAL
--
--  Prisma va a proponer SIEMPRE `DROP INDEX "Propiedad_locacion_gist_idx"`.
--  No es un descuido suyo: la columna `locacion` está declarada como
--  `Unsupported` en el esquema —Prisma sabe que existe pero no la administra—
--  y el índice lo creó a mano la migración `20260101000001_ficha_tecnica_postgis`.
--  Al no estar en el modelo, Prisma lo interpreta como "sobra" y quiere
--  limpiarlo.
--
--  Aplicarlo sería un desastre SILENCIOSO: la búsqueda por cercanía
--  (`/api/propiedades/cercanas`, que usa ST_DWithin) seguiría devolviendo
--  resultados correctos, solo que recorriendo la tabla entera en vez de usar
--  el índice. Nada falla, nada avisa; simplemente se vuelve lenta cuando haya
--  propiedades de verdad. Comprobado con EXPLAIN antes de escribir esto:
--  el plan dice `Index Scan using "Propiedad_locacion_gist_idx"`.
--
--  Si vuelves a generar SQL con `prisma migrate diff`, BORRA esa línea.
--  La prueba "el índice espacial sigue existiendo" de scripts/pruebas.mjs
--  está puesta justo para que esto no pase inadvertido.
-- ============================================================================

-- 1. Enums nuevos ------------------------------------------------------------

CREATE TYPE "PlanUsuario" AS ENUM ('GRATIS', 'PRO');
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- 2. Plan comercial en Usuario ------------------------------------------------

-- `plan` nace con DEFAULT 'GRATIS' para que las filas existentes queden
-- válidas sin backfill: nadie tenía plan, y GRATIS es exactamente eso.
ALTER TABLE "Usuario"
    ADD COLUMN "plan" "PlanUsuario" NOT NULL DEFAULT 'GRATIS',
    ADD COLUMN "plan_vence" TIMESTAMP(3);

-- 3. Región y provincia en Distrito ------------------------------------------

-- Opcionales a propósito: el producto arranca con una sola región. Exigirlos
-- obligaría a inventar datos para zonas que todavía no existen.
ALTER TABLE "Distrito"
    ADD COLUMN "region" TEXT,
    ADD COLUMN "provincia" TEXT;

CREATE INDEX "Distrito_region_provincia_idx" ON "Distrito"("region", "provincia");

-- 4. Tabla de solicitudes de agente ------------------------------------------

CREATE TABLE "SolicitudAgente" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    -- El documento se guarda POR INTENTO, no solo en el usuario: si alguien
    -- corrige el DNI entre un intento y otro, queda registrado qué se revisó.
    "documento" TEXT NOT NULL,

    -- Antes este dato se recibía y se descartaba. El admin revisaba a ciegas.
    "mensaje" TEXT,

    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',

    -- Auditoría: quién aprobó o rechazó.
    "revisor_id" INTEGER,
    "motivo_rechazo" TEXT,

    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMP(3),

    CONSTRAINT "SolicitudAgente_pkey" PRIMARY KEY ("id")
);

-- La cola del panel de admin: "pendientes, de la más vieja a la más nueva".
CREATE INDEX "SolicitudAgente_estado_fecha_creacion_idx"
    ON "SolicitudAgente"("estado", "fecha_creacion");

CREATE INDEX "SolicitudAgente_usuario_id_idx" ON "SolicitudAgente"("usuario_id");

-- 5. Claves foráneas ---------------------------------------------------------

-- En cascada: si se borra el usuario, sus solicitudes no significan nada.
-- (El borrado de usuarios es lógico, así que esto casi nunca corre: es una
-- red de seguridad, no el camino normal.)
ALTER TABLE "SolicitudAgente"
    ADD CONSTRAINT "SolicitudAgente_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull y NO cascada: si se borra la cuenta del admin, la solicitud debe
-- seguir existiendo con revisor desconocido. Es el historial del solicitante,
-- no del admin.
ALTER TABLE "SolicitudAgente"
    ADD CONSTRAINT "SolicitudAgente_revisor_id_fkey"
    FOREIGN KEY ("revisor_id") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
