// Este archivo conecta Prisma con nuestra base de datos.
// Lo separamos para no repetir "new PrismaClient()" en cada archivo.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;

