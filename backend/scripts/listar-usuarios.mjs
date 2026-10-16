import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      telefono: true,
      _count: { select: { propiedades: true } },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`Usuarios registrados: ${usuarios.length}\n`);
  for (const u of usuarios) {
    console.log(
      `#${String(u.id).padEnd(3)} ${u.rol.padEnd(12)} ${u.activo ? 'activo  ' : 'INACTIVO'} ` +
      `${u.email.padEnd(34)} props=${u._count.propiedades}`
    );
  }

  const [props, contactos, distritos] = await Promise.all([
    prisma.propiedad.count(),
    prisma.contacto.count(),
    prisma.distrito.count(),
  ]);
  console.log(`\nPropiedades: ${props} | Contactos: ${contactos} | Distritos: ${distritos}`);
} finally {
  await prisma.$disconnect();
}
