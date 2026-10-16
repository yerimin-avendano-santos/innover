import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const pendientes = await prisma.usuario.findMany({
    where: { documento_identidad: { not: null } },
    select: { email: true, documento_identidad: true, identidad_verificada: true, rol: true },
    orderBy: { email: 'asc' },
  });

  console.log('Usuarios con documento registrado:\n');
  for (const u of pendientes) {
    console.log(
      `  ${u.email.padEnd(32)} doc=${String(u.documento_identidad).padEnd(12)} ` +
      `verificada=${u.identidad_verificada}  rol=${u.rol}`
    );
  }
} finally {
  await prisma.$disconnect();
}
