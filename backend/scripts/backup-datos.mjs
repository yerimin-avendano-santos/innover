// Backup de los datos actuales en JSON, antes de correr migraciones.
// Ejecutar: node scripts/backup-datos.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';

const prisma = new PrismaClient();
const marca = new Date().toISOString().replace(/[:.]/g, '-');

try {
  const backup = {
    generado: new Date().toISOString(),
    usuarios: await prisma.usuario.findMany(),
    propiedades: await prisma.propiedad.findMany(),
    contactos: await prisma.contacto.findMany(),
  };
  const ruta = `backups/datos-${marca}.json`;
  fs.mkdirSync('backups', { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(backup, null, 2));
  console.log(`Backup guardado en ${ruta}`);
  console.log(
    `usuarios: ${backup.usuarios.length}, propiedades: ${backup.propiedades.length}, contactos: ${backup.contactos.length}`
  );
} catch (e) {
  console.error('ERROR en backup:', e.message);
} finally {
  await prisma.$disconnect();
}
