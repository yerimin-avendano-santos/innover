-- ==========================================
-- TokenRenovacion: la sesión que se puede revocar
-- ==========================================
--
-- El JWT de sesión dura 2 horas y es autocontenido: el servidor lo verifica con
-- la firma sin consultar nada. Rápido, pero irreversible — no se puede revocar
-- antes de que venza. Esta tabla es la otra mitad: un token opaco (cadena al
-- azar) que existe en la base, dura 30 días, y por eso SÍ se puede apagar.
--
-- Cuando el corto vence, el frontend lo cambia por uno nuevo usando este, sin
-- pedir la contraseña. Y si alguien copió uno, se apagan todas las sesiones.
--
-- ⛔ OJO: la migración que generó Prisma traía además esta línea, y se quitó a
-- mano (como en TODAS las migraciones de este proyecto):
--
--     DROP INDEX "Propiedad_locacion_gist_idx";
--
-- `locacion` es `Unsupported` para Prisma (existe, pero no la administra), así
-- que no ve su índice y lo cree sobrante. Borrarlo no rompería nada visible:
-- `/api/propiedades/cercanas` seguiría devolviendo lo mismo, solo que
-- recorriendo la tabla entera. La sección 16 de `scripts/pruebas.mjs` lo
-- protege con un `EXPLAIN`.

-- CreateTable
CREATE TABLE "TokenRenovacion" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira" TIMESTAMP(3) NOT NULL,
    "rotado_en" TIMESTAMP(3),
    "revocado_en" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRenovacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenRenovacion_token_hash_key" ON "TokenRenovacion"("token_hash");

-- CreateIndex
CREATE INDEX "TokenRenovacion_usuario_id_idx" ON "TokenRenovacion"("usuario_id");

-- CreateIndex
CREATE INDEX "TokenRenovacion_expira_idx" ON "TokenRenovacion"("expira");

-- AddForeignKey
ALTER TABLE "TokenRenovacion" ADD CONSTRAINT "TokenRenovacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
