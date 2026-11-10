import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv[2] || 'yeriminavendanosantos@gmail.com';

try {
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!usuario) {
    console.error(`No se encontró el usuario con email: ${email}`);
    process.exit(1);
  }

  const actualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      rol: 'ADMIN',
      plan: 'PRO',
      identidad_verificada: true,
      activo: true,
    },
  });

  console.log(`✅ Usuario #${actualizado.id} (${actualizado.email}) actualizado exitosamente:`);
  console.log(`   Rol: ${actualizado.rol}`);
  console.log(`   Plan: ${actualizado.plan}`);
  console.log(`   Identidad Verificada: ${actualizado.identidad_verificada}`);
} catch (error) {
  console.error('Error al actualizar usuario:', error);
} finally {
  await prisma.$disconnect();
}

